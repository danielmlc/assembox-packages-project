# 构建发布层设计

> 版本：v1.1
> 日期：2026-02-27
> 状态：设计阶段

---

## 一、设计概述

### 1.1 职责

构建发布层负责将低代码平台的元数据配置转换为可运行的代码，并通过 CI/CD 流程自动部署。

核心职责：
- **触发快照**：通过 RPC 调用存储服务创建快照，锁定本次构建的配置版本
- **读取配置**：通过 RPC 调用存储服务获取快照清单和组件配置内容
- **代码生成**：根据流水线类型（服务层/前端层）调用对应的代码生成器核心包
- **本地校验**：TypeScript 编译检查 + 单元测试，确保生成代码质量
- **推送生成代码**：将生成代码写入模块组 Gitea 仓库的 `generated/` 目录
- **触发 CI/CD**：代码推送后，Gitea Actions 自动触发构建和部署

### 1.2 核心流程总览

```
触发方（设计器 / 定时任务 / API）
      │
      ▼
[assembox-builder 构建服务]
      │
      ├─① 创建构建任务 ────────── 写入 ab_build_task，加入任务队列
      │
      ├─② 触发快照 ─────────────── RPC → assembox-storage.createSnapshot + generateManifest
      │
      ├─③ 读取配置 ─────────────── RPC → assembox-storage.getManifest + 配置内容
      │
      ├─④ 代码生成 ─────────────── 服务层 → libs/code-generator（NestJS）
      │                              前端层 → libs/frontend-code-generator（规划中）
      │
      ├─⑤ 本地校验 ─────────────── tsc 编译检查 + 单元测试运行
      │
      ├─⑥ 推送 Gitea ────────────── 构建服务自身 GiteaService，写入模块组仓库 generated/ 目录
      │
      └─⑦ 触发 CI/CD ────────────── Gitea Actions 监听 generated/** 路径变更自动触发
```

### 1.3 实现策略（分阶段）

| 阶段 | 任务队列 | 说明 |
|-----|---------|------|
| MVP | 数据库轮询 | 简单可靠，快速上线 |
| 迭代 | RocketMQ | 接入云阙平台 MQ 功能包，支持高并发和分布式 |

---

## 二、整体架构

### 2.1 服务关系图

```
┌────────────────────────────────────────────────────────────┐
│                  低代码设计器 / 管理后台                      │
│               （触发构建按钮 / 定时任务）                     │
└──────────────────────┬─────────────────────────────────────┘
                       │ POST /build/trigger
                       ▼
┌────────────────────────────────────────────────────────────┐
│               assembox-builder（构建服务）                   │
│                                                            │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────┐  │
│  │ BuildTask    │  │ StorageRpcClient │  │ CodeGenCoord│  │
│  │ 任务管理      │  │ 存储服务 RPC 客户端│  │ 代码生成协调 │  │
│  └──────────────┘  └──────────────────┘  └─────────────┘  │
│                                                            │
│  ┌──────────────────────────────┐                          │
│  │ GiteaService（builder 自有）  │                          │
│  │ - 确保仓库存在                │                          │
│  │ - 提交生成代码到 generated/   │                          │
│  └──────────────────────────────┘                          │
└──────┬────────────────────────────────────────────────────┘
       │ RPC 调用（仅获取快照和配置数据）
       ▼
┌─────────────────────────────────────────────────────────┐
│                   assembox-storage（存储服务）             │
│                                                         │
│  ┌───────────────┐   ┌───────────────┐                  │
│  │SnapshotService│   │ GiteaService  │                  │
│  │ - 创建快照     │   │ - 文件提交     │                  │
│  │ - 生成清单     │   │ - 创建 Tag    │                  │
│  │ - 获取清单     │   │ - 确保仓库存在 │                  │
│  └───────────────┘   └───────────────┘                  │
│         ↑ 构建服务RPC调用     ↑ 存储服务自用（推送快照清单）  │
│                                                         │
│              assembox-configs-{code}-{type}/            │
│              ├── modules/    ← 发布配置                  │
│              ├── snapshots/  ← 快照清单                  │
│              └── generated/  ← 生成代码（构建服务写入）   │
└─────────────────────────────────────────────────────────┘
                             │
                             │ Gitea Webhook（监听 generated/** 路径）
                             ▼
              ┌──────────────────────────┐
              │  CI/CD（Gitea Actions）   │
              │  - 编译构建               │
              │  - Docker 镜像            │
              │  - 部署到集群             │
              └──────────────────────────┘
```

### 2.2 Gitea 仓库结构（每模块组独立仓库）

每个「模块组 + 流水线类型」对应一个独立仓库（与存储层保持一致）：

**仓库命名**：`assembox-configs-{moduleGroupCode}-{pipelineType}`

例：`assembox-configs-order-service-backend`

```
assembox-configs-order-service-backend/
├── modules/                              ← 发布配置（存储服务维护）
│   └── {moduleCode}/{versionCode}/{layer}/{componentCode}.json
│
├── snapshots/                            ← 快照清单（存储服务维护）
│   └── {snapshotCode}/
│       └── manifest.json
│
└── generated/                            ← 生成代码（构建服务维护）
    └── src/
        └── modules/
            └── {moduleCode}/
                ├── {entityCode}.entity.ts
                ├── {entityCode}.service.ts
                ├── {entityCode}.controller.ts
                ├── {entityCode}.dto.ts
                └── {moduleCode}.module.ts
```

**目录职责划分**：

| 目录 | 维护方 | 触发 CI/CD |
|-----|-------|-----------|
| `modules/` | assembox-storage | 否 |
| `snapshots/` | assembox-storage | 否 |
| `generated/` | assembox-builder | **是**（路径过滤触发） |

**Tag 规则**（复用存储服务已有规范）：
- 快照 Tag：`snapshot-{snapshotCode}`（存储服务在推送快照清单时创建）
- 构建后不额外创建 Tag，CI/CD 通过 `generated/**` 路径变更触发

### 2.3 代码生成器核心包

```
libs/
├── code-generator/                ← 服务层代码生成器（已实现 MVP，持续迭代）
│   ├── src/
│   │   ├── types/config.ts        ← ModuleConfig, EntityConfig, ServiceMethodConfig...
│   │   ├── parsers/               ← 表达式解析器
│   │   └── generators/            ← Entity / Service / Controller 生成器
│   └── index.ts
│
└── frontend-code-generator/       ← 前端代码生成器（规划中）
```

---

## 三、核心流程详细设计

### 3.1 构建触发流程

```
POST /build/trigger
{
  "module_group_id": "xxx",
  "pipeline_type": "backend",   // backend | website
  "snapshot_name": "v1.0-发布"  // 快照名称，便于识别
}

──────────────────────────────────────────────────
① 参数校验
   - module_group_id 是否存在
   - pipeline_type 合法性（查询 ab_module_group_pipeline 确认已绑定）

② 并发检查
   - 同一 module_group + pipeline_type 不允许并行构建
   - 已有 pending/running 任务则拒绝，返回现有任务 ID

③ 创建构建任务
   - INSERT ab_build_task (status='pending', ...)

④ 写入任务队列
   - MVP：DB 记录即队列，后台 Worker 轮询拉取
   - 迭代：发送 MQ 消息，Builder Worker 消费

⑤ 返回
   { "task_id": "BT0023", "status": "pending" }
──────────────────────────────────────────────────
```

### 3.2 构建执行流程（核心）

```
BuildWorker 拉取任务（task_id）
│
├─ 阶段一：快照（RPC → assembox-storage）
│   ① RPC: SnapshotService.createSnapshot(moduleGroupId, snapshotName)
│          → 返回 snapshotId, snapshotCode
│   ② RPC: SnapshotService.generateManifest(snapshotId)
│          → 收集组件配置清单，写入 snapshotContent，异步推送至 Gitea
│   ③ 更新任务：status='snapshotting', snapshot_id=xxx
│
├─ 阶段二：读取配置（RPC → assembox-storage）
│   ④ RPC: SnapshotService.getManifest(snapshotId)
│          → 返回组件清单（moduleCode, versionCode, componentCode, publishedOssKey...）
│   ⑤ 过滤：只保留构建配置组件（is_runtime=0）
│   ⑥ 按继承规则选取（有 tenant 配置用 tenant，否则用 system）
│   ⑦ RPC: ComponentConfigService.getConfigContent(publishedOssKey)
│          → 批量获取 OSS 配置 JSON 内容
│
├─ 阶段三：代码生成
│   ⑧ 将组件配置内容组装为 ModuleConfig[]（存储层 JSON → 生成器输入）
│   ⑨ 按 pipeline_type 调用生成器：
│      - 'backend'  → libs/code-generator（NestJS）
│      - 'website'  → libs/frontend-code-generator（规划中）
│   ⑩ 生成代码写入临时目录：/tmp/build/{task_id}/
│   ⑪ 更新任务：status='generating'
│
├─ 阶段四：本地校验
│   ⑫ tsc --noEmit（TypeScript 编译检查）
│   ⑬ jest --passWithNoTests（单元测试，MVP 阶段无测试文件则跳过）
│   ⑭ 校验失败 → 任务标记 failed，记录错误日志，退出
│   ⑮ 更新任务：status='validating'
│
├─ 阶段五：推送 Gitea（构建服务自身 GiteaService）
│   ⑯ 确定目标仓库：
│      repoName = assembox-configs-{moduleGroupCode}-{pipelineType}
│   ⑰ GiteaService.ensureRepository(repoName, description)
│   ⑱ 批量提交生成文件：
│      filePath = generated/src/modules/{moduleCode}/{fileName}
│      GiteaService.batchCommitFiles(repoName, files, message)
│      message = "build: {snapshotCode} {snapshotName}"
│   ⑲ 更新任务：status='pushing', gitea_commit=xxx
│
└─ 阶段六：等待 CI/CD
    ⑳ Gitea Actions 自动监听 generated/** 变更，触发部署流水线
    ㉑ 更新任务：status='completed'
    ㉒ 清理临时目录：rm -rf /tmp/build/{task_id}/
```

### 3.3 构建任务状态机

```
pending
  │
  ▼
snapshotting ──→ (快照失败) ──→ failed
  │
  ▼
generating ───→ (生成失败) ──→ failed
  │
  ▼
validating ───→ (校验失败) ──→ failed
  │
  ▼
pushing ──────→ (推送失败) ──→ failed
  │
  ▼
completed
```

| 状态 | 说明 |
|-----|------|
| pending | 任务已创建，等待执行 |
| snapshotting | RPC 调用存储服务创建快照中 |
| generating | 正在生成代码 |
| validating | 正在编译校验 + 单元测试 |
| pushing | 正在推送生成代码到 Gitea |
| completed | 构建发布完成，CI/CD 已触发 |
| failed | 构建失败（error_message 记录原因） |

---

## 四、数据模型

### 4.1 ab_build_task（构建任务表）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | bigint | 主键 |
| task_code | varchar(32) | 任务编号（BT0001） |
| module_group_id | bigint | 模块组 ID |
| module_group_code | varchar(64) | 模块组代码（冗余，便于查询） |
| pipeline_type | varchar(20) | 流水线类型（backend / website） |
| snapshot_id | bigint | 关联的存储层快照 ID（ab_snapshot.id） |
| snapshot_code | varchar(32) | 快照编码（冗余，便于查询） |
| status | varchar(32) | 任务状态 |
| error_message | text | 失败原因 |
| gitea_repo | varchar(128) | 推送的 Gitea 仓库名 |
| gitea_commit | varchar(64) | 推送的 commit hash |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 状态更新时间 |
| completed_at | datetime | 完成时间 |

> 说明：快照由存储服务（`ab_snapshot` 表）管理，构建任务只存引用（snapshot_id）。

---

## 五、构建服务目录结构

```
apps/assembox-builder/
├── src/
│   ├── build/
│   │   ├── build.controller.ts       ← 构建 API 接口
│   │   ├── build.service.ts          ← 构建任务管理（创建、查询、状态更新）
│   │   ├── build-executor.service.ts ← 构建执行核心（串联各阶段）
│   │   └── build.module.ts
│   │
│   ├── storage-rpc/
│   │   ├── storage-rpc.service.ts    ← 封装对 assembox-storage 的 RPC 调用（仅快照和配置数据）
│   │   └── storage-rpc.module.ts
│   │
│   ├── gitea/
│   │   ├── gitea.service.ts          ← 构建服务自有 Gitea 客户端（推送生成代码）
│   │   └── gitea.module.ts
│   │
│   ├── codegen/
│   │   ├── codegen-coordinator.service.ts  ← 代码生成协调（组装 ModuleConfig）
│   │   ├── backend-codegen.service.ts      ← 调用 libs/code-generator
│   │   ├── frontend-codegen.service.ts     ← 调用前端生成器（规划中）
│   │   └── codegen.module.ts
│   │
│   └── app.module.ts
│
└── package.json
```

---

## 六、MVP 实现说明

### 6.1 MVP 任务队列（数据库轮询）

```
BuildWorker（定时任务，每 5 秒执行一次）：

① SELECT * FROM ab_build_task
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED       ← 多实例安全并发

② 取到任务 → 更新 status = 'snapshotting'

③ 执行完整构建流程

④ 完成/失败 → 更新最终 status
```

### 6.2 MQ 迭代路径

```
MVP:    BuildController → DB写任务 → Worker DB轮询 → 执行
迭代:   BuildController → DB写任务 → 发送MQ消息 → Worker消费MQ → 执行

迭代要点：
- DB 任务记录保留（作为状态存储和审计）
- MQ 只传递 task_id，Worker 从 DB 读取完整信息
- MQ 失败可通过 DB 轮询兜底（双保险）
```

---

## 七、详细设计文档导航

| 文档 | 内容 |
|-----|------|
| [snapshot-mechanism.md](snapshot-mechanism.md) | 快照机制说明（依赖存储服务） |
| [cicd-pipeline.md](cicd-pipeline.md) | CI/CD 流水线设计 |
| [../03-service/code-generation.md](../03-service/code-generation.md) | 服务层代码生成核心包详细设计 |
