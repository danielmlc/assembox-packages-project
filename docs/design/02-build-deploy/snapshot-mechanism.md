# 快照机制说明

> 版本：v1.1
> 日期：2026-02-27
> 状态：设计阶段

---

## 一、概述

快照（Snapshot）机制由**存储服务（assembox-storage）负责实现**，构建服务通过 RPC 调用使用，不重复实现。

本文档说明：
- 存储服务中快照的实现逻辑（已有代码）
- 构建服务如何调用快照相关接口
- 快照与 Gitea 仓库的对应关系

---

## 二、存储服务中的快照实现（已有）

### 2.1 核心实体（AbSnapshot）

```
ab_snapshot 表：
  - module_group_id   模块组 ID
  - snapshot_code     快照编码（S001, S002...）
  - snapshot_name     快照名称
  - snapshot_content  快照清单（JSON 字符串）
  - build_status      状态：pending / building / success / failed
  - build_log         日志
```

### 2.2 核心方法（AbSnapshotService）

| 方法 | 说明 |
|-----|------|
| `createSnapshot(moduleGroupId, snapshotName)` | 创建快照记录，返回 snapshot |
| `generateManifest(snapshotId)` | 收集模块组全量组件配置清单，写入 snapshot_content，异步推送到 Gitea |
| `getManifest(snapshotId)` | 读取快照清单（SnapshotManifestItemDto[]） |
| `findByModuleGroupId(moduleGroupId)` | 查询历史快照列表 |

### 2.3 快照清单结构（SnapshotManifestItemDto）

```typescript
// 快照清单顶层：模块列表
SnapshotManifestItemDto[] = [
  {
    moduleId: string,
    moduleCode: string,
    moduleName: string,
    versions: [
      {
        versionId: string,
        versionCode: string,
        versionName: string,
        versionType: string,
        configs: [
          {
            configId: string,
            componentId: string,
            componentCode: string,
            componentName: string,
            layer: string,          // system / tenant
            status: string,         // published / draft
            publishVersion: number, // 锁定的发布版本
            publishedOssKey: string, // OSS 路径，构建时读取内容
            draftOssKey: string,
          }
        ]
      }
    ]
  }
]
```

### 2.4 快照推送到 Gitea（存储服务负责）

`generateManifest` 执行完毕后，**异步**将快照清单推送到对应 Gitea 仓库：

```
仓库名：assembox-configs-{moduleGroupCode}-{pipelineType}
       （模块组绑定的每个流水线类型对应推送一次）

文件路径：snapshots/{snapshotCode}/manifest.json

Tag：snapshot-{snapshotCode}
```

这部分由存储服务的 `pushManifestToGitea` 私有方法处理，构建服务**不感知**此过程。

---

## 三、构建服务的调用方式

### 3.1 RPC 调用序列

```
BuildExecutor（构建服务内）
│
├─① storageRpc.createSnapshot(moduleGroupId, snapshotName)
│     → { snapshotId, snapshotCode, buildStatus: 'pending' }
│
├─② storageRpc.generateManifest(snapshotId)
│     → 收集清单完成（同步）
│     → 异步推送 Gitea（fire-and-forget，不阻塞构建）
│
├─③ storageRpc.getManifest(snapshotId)
│     → SnapshotManifestItemDto[]（完整组件清单）
│
└─④ 过滤清单，只使用构建配置组件（is_runtime=0 的组件类型）
      对每个组件根据 publishedOssKey 读取配置内容
```

### 3.2 StorageRpcService 封装

构建服务通过 RPC 调用存储服务，**仅用于获取快照和配置数据**。Gitea 操作由构建服务自身的 GiteaService 完成，不经过存储服务。

```typescript
// apps/assembox-builder/src/storage-rpc/storage-rpc.service.ts

@Injectable()
export class StorageRpcService {
  // createSnapshot → RPC: POST /snapshot/create
  async createSnapshot(moduleGroupId: string, snapshotName: string): Promise<SnapshotDto>

  // generateManifest → RPC: POST /snapshot/{id}/generate-manifest
  async generateManifest(snapshotId: string): Promise<void>

  // getManifest → RPC: GET /snapshot/{id}/manifest
  async getManifest(snapshotId: string): Promise<SnapshotManifestItemDto[]>

  // getConfigContent → RPC: 通过 publishedOssKey 读取 OSS 内容
  async getConfigContent(ossKey: string): Promise<string>
}
```

> **注意**：`ensureRepository`、`batchCommitFiles` 等 Gitea 操作由构建服务自身的 `GiteaService`（`apps/assembox-builder/src/gitea/gitea.service.ts`）直接调用 Gitea API，**不经过存储服务 RPC**。

---

## 四、仓库内容分工

同一个仓库（`assembox-configs-{code}-{type}`）中，内容来源如下：

| 目录 | 写入方 | 写入时机 |
|-----|-------|---------|
| `modules/` | assembox-storage | 发布配置时 |
| `snapshots/` | assembox-storage | 生成快照清单后（异步） |
| `generated/` | assembox-builder | 代码生成校验通过后 |

---

## 五、快照状态与构建的关系

```
存储服务快照状态（ab_snapshot.build_status）：
  pending   → 刚创建，等待生成清单
  building  → generateManifest 执行中
  success   → 清单生成并写入完毕
  failed    → 清单生成失败

构建服务任务状态（ab_build_task.status）：
  snapshotting → 正在调用 createSnapshot + generateManifest
  generating   → 快照成功，开始生成代码
  ...
```

构建服务在调用 `generateManifest` 后，直接调用 `getManifest` 读取清单内容（清单已写入 DB）。快照推送到 Gitea 的过程是异步的，构建服务不等待，也不依赖此结果继续构建。

---

## 六、快照回滚

若需要基于历史快照重新构建：

```
POST /build/trigger
{
  "module_group_id": "xxx",
  "pipeline_type": "backend",
  "snapshot_id": "历史快照ID"   ← 指定已有快照，跳过创建和生成清单步骤
}
```

构建服务检测到 `snapshot_id` 已存在且状态为 `success`，直接进入**阶段二：读取配置**，跳过阶段一。
