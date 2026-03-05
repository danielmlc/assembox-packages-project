# 版本管理存储详细设计

> 版本：v1.0
> 日期：2026-02-06
> 状态：设计阶段

---

## 一、概述

本文档定义基于 Git 的配置版本管理策略，用于追溯配置的完整历史、支持分支管理和回滚操作。

### 1.1 版本管理目标

1. **版本追溯**：记录每次配置变更的完整历史
2. **分支管理**：支持系统版本和租户版本的独立迭代
3. **回滚支持**：支持回退到任意历史版本
4. **审计合规**：满足配置变更的审计要求

### 1.2 存储策略

| 存储位置 | 用途 | 说明 |
|---------|------|------|
| 数据库（MySQL） | 配置元信息 | 配置索引、状态、版本号等 |
| OSS | 配置内容 | JSON 配置文件 |
| Git | 配置版本追溯 | 已发布配置的版本历史 |
| Gitea | 生成代码 | 构建生成的代码版本管理 |

**本文档重点**：Git 版本管理策略

---

## 二、Git 仓库结构

### 2.1 仓库组织方式

**方案**：按模块组（Module Group）创建独立仓库

```
assembox-config-{module_group_code}
```

**示例**：
```
assembox-config-order-service       # 订单服务配置仓库
assembox-config-user-service        # 用户服务配置仓库
assembox-config-payment-service     # 支付服务配置仓库
```

**优势**：
- 仓库粒度合理，便于管理
- 权限控制更灵活
- 构建时只需克隆对应仓库

### 2.2 仓库目录结构

```
assembox-config-order-service/
├── .git/
├── .gitignore
├── README.md
├── order/                              # 模块目录
│   ├── v1.0.0/                         # 版本目录（系统版本）
│   │   └── system/                     # 系统层
│   │       ├── order_controller.json
│   │       ├── order_service.json
│   │       └── order_entity.json
│   ├── v1.1.0/                         # 另一个系统版本
│   │   └── system/
│   │       └── ...
│   └── tenant-{tenant_id}/             # 租户版本目录
│       └── v1.0.0-custom/              # 租户定制版本
│           ├── system/                 # 系统层（继承自系统版本）
│           │   └── order_controller.json
│           └── tenant/                 # 租户层（租户定制）
│               └── order_controller.json
├── payment/                            # 另一个模块
│   └── v1.0.0/
│       └── system/
│           └── ...
└── .metadata.json                      # 仓库元数据
```

**目录层级**：
```
{module_code}/                          # 模块
  ├── {version_code}/                   # 系统版本
  │   └── system/                       # 系统层
  │       └── {component_code}.json
  └── tenant-{tenant_id}/               # 租户定制目录
      └── {version_code}/               # 租户版本
          ├── system/                   # 系统层
          └── tenant/                   # 租户层
```

---

## 三、分支管理策略

### 3.1 分支模型

采用 **主干开发 + 发布分支** 模型：

```
main (主分支)
  ├── release/v1.0.0 (发布分支 - 系统版本)
  ├── release/v1.1.0 (发布分支 - 系统版本)
  └── tenant/{tenant_id}/v1.0.0 (租户分支)
```

### 3.2 分支类型

| 分支类型 | 命名规范 | 用途 | 生命周期 |
|---------|---------|------|---------|
| main | main | 主干分支，草稿阶段 | 永久 |
| 系统发布分支 | release/v{version} | 系统版本发布 | 永久保留 |
| 租户分支 | tenant/{tenant_id}/v{version} | 租户定制版本 | 永久保留 |

### 3.3 分支操作流程

#### 3.3.1 系统版本发布

```
① 草稿阶段（main 分支）
   - 开发人员在 main 分支上修改配置
   - 提交到 main 分支
   ↓
② 发布触发
   - 用户在设计器中点击"发布"
   - 系统将配置复制到 OSS published/ 目录
   - 更新数据库 ab_component_config.publish_version
   ↓
③ 创建发布分支
   - 从 main 分支创建 release/v{version} 分支
   - 提交已发布的配置到发布分支
   - 打标签：v{version}
   ↓
④ 合并回 main（可选）
   - 如果发布后需要继续开发，保持 main 最新
```

**命令示例**：
```bash
# ③ 创建发布分支
git checkout main
git pull origin main
git checkout -b release/v1.0.0
git add order/v1.0.0/system/*.json
git commit -m "release: 发布订单模块 v1.0.0"
git push origin release/v1.0.0
git tag v1.0.0
git push origin v1.0.0

# ④ 合并回 main
git checkout main
git merge release/v1.0.0
git push origin main
```

#### 3.3.2 租户版本发布

```
① 基于系统版本创建租户分支
   - 从 release/v{system_version} 创建租户分支
   - 分支名：tenant/{tenant_id}/v{version}
   ↓
② 租户定制开发
   - 在租户分支上修改配置
   - 租户层配置放在 tenant/ 目录
   - 系统层配置放在 system/ 目录（覆盖）
   ↓
③ 租户版本发布
   - 提交配置到租户分支
   - 打标签：tenant/{tenant_id}/v{version}
```

**命令示例**：
```bash
# ① 创建租户分支（基于系统版本 v1.0.0）
git checkout release/v1.0.0
git checkout -b tenant/1001/v1.0.0
git push origin tenant/1001/v1.0.0

# ② 租户定制
mkdir -p order/tenant-1001/v1.0.0/tenant
# 修改租户层配置
git add order/tenant-1001/v1.0.0/tenant/*.json
git commit -m "feat(tenant-1001): 定制订单模块"
git push origin tenant/1001/v1.0.0

# ③ 打标签
git tag tenant/1001/v1.0.0
git push origin tenant/1001/v1.0.0
```

---

## 四、提交管理

### 4.1 提交时机

| 操作 | 提交时机 | 分支 |
|-----|---------|------|
| 草稿保存 | 不提交 Git | - |
| 组件发布 | 立即提交 | main 或对应分支 |
| 模块发布 | 批量提交 | main 或对应分支 |
| 版本发布 | 创建发布分支并提交 | release/v{version} |

**说明**：
- 草稿保存只更新 OSS 和数据库，不提交 Git
- 发布操作才会提交到 Git，保证 Git 中的都是已发布的稳定版本

### 4.2 提交信息规范

采用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type）**：

| 类型 | 说明 | 示例 |
|-----|------|------|
| feat | 新增功能 | `feat(order): 新增订单取消功能` |
| fix | 修复问题 | `fix(order): 修复订单金额计算错误` |
| refactor | 重构 | `refactor(order): 重构订单服务` |
| release | 发布版本 | `release: 发布订单模块 v1.0.0` |
| tenant | 租户定制 | `feat(tenant-1001): 定制订单流程` |

**示例**：

```bash
# 系统版本发布
git commit -m "release: 发布订单模块 v1.0.0

- 新增订单创建功能
- 新增订单查询功能
- 新增订单取消功能

Closes #123"

# 租户定制
git commit -m "feat(tenant-1001): 定制订单审批流程

- 新增订单审批节点
- 修改订单状态流转规则

Refs #456"
```

### 4.3 批量提交策略

**模块级发布**：
```bash
# 一次性提交模块下所有组件的变更
git add order/v1.0.0/system/*.json
git commit -m "release(order): 发布订单模块 v1.0.0

批量发布组件：
- order_controller.json (v6)
- order_service.json (v3)
- order_entity.json (v5)
"
```

**模块组级发布**：
```bash
# 一次性提交模块组下所有模块的变更
git add order/ payment/
git commit -m "release(order-service): 发布订单服务 v1.0.0

包含模块：
- 订单模块 (order)
- 支付模块 (payment)
"
```

---

## 五、标签管理

### 5.1 标签命名规范

| 标签类型 | 命名规范 | 示例 |
|---------|---------|------|
| 系统版本 | v{version} | `v1.0.0`, `v1.1.0` |
| 租户版本 | tenant/{tenant_id}/v{version} | `tenant/1001/v1.0.0` |
| 快照 | snapshot/{snapshot_code} | `snapshot/S001` |

### 5.2 标签创建时机

| 操作 | 标签 | 说明 |
|-----|------|------|
| 系统版本发布 | v{version} | 在发布分支上打标签 |
| 租户版本发布 | tenant/{tenant_id}/v{version} | 在租户分支上打标签 |
| 构建快照 | snapshot/{snapshot_code} | 在构建时打标签（可选） |

### 5.3 标签操作示例

```bash
# 创建系统版本标签
git tag -a v1.0.0 -m "订单服务 v1.0.0"
git push origin v1.0.0

# 创建租户版本标签
git tag -a tenant/1001/v1.0.0 -m "租户 1001 订单服务定制版本 v1.0.0"
git push origin tenant/1001/v1.0.0

# 创建快照标签
git tag -a snapshot/S001 -m "订单服务快照 S001"
git push origin snapshot/S001

# 列出所有标签
git tag -l

# 查看标签详情
git show v1.0.0

# 删除标签
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0
```

---

## 六、版本回滚

### 6.1 回滚场景

| 场景 | 操作 | 说明 |
|-----|------|------|
| 系统版本回滚 | 切换到历史标签 | 回退到某个系统版本 |
| 租户版本回滚 | 切换到租户历史标签 | 回退到租户某个版本 |
| 组件回滚 | 恢复历史提交 | 回退某个组件配置 |

### 6.2 回滚流程

#### 6.2.1 系统版本回滚

```
① 选择目标版本
   - 查看历史版本：git tag -l
   ↓
② 创建回滚分支
   - git checkout -b rollback/v1.0.0 v1.0.0
   ↓
③ 验证配置
   - 检查配置文件是否正确
   ↓
④ 发布回滚版本
   - 复制配置到 OSS published/
   - 更新数据库
   - 提交到 main 分支
```

**命令示例**：
```bash
# ① 查看历史版本
git tag -l

# ② 创建回滚分支（基于 v1.0.0）
git checkout -b rollback/v1.0.0 v1.0.0

# ③ 查看配置
cat order/v1.0.0/system/order_controller.json

# ④ 合并到 main（如果需要）
git checkout main
git merge rollback/v1.0.0
git push origin main
```

#### 6.2.2 组件回滚

```
① 查看组件历史
   - git log -- order/v1.0.0/system/order_controller.json
   ↓
② 恢复到指定提交
   - git checkout <commit_hash> -- order/v1.0.0/system/order_controller.json
   ↓
③ 提交回滚
   - git commit -m "revert(order): 回滚订单控制器到提交 <commit_hash>"
   ↓
④ 发布
   - 复制到 OSS
   - 更新数据库
```

**命令示例**：
```bash
# ① 查看组件历史
git log --oneline -- order/v1.0.0/system/order_controller.json

# ② 恢复到指定提交
git checkout a1b2c3d -- order/v1.0.0/system/order_controller.json

# ③ 提交回滚
git commit -m "revert(order): 回滚订单控制器到提交 a1b2c3d"

# ④ 推送
git push origin main
```

---

## 七、冲突解决

### 7.1 冲突场景

| 场景 | 原因 | 解决方案 |
|-----|------|---------|
| 并发发布 | 多人同时发布 | 后发布者需要合并 |
| 租户分支同步 | 租户分支落后系统版本 | 手动合并系统更新 |

### 7.2 冲突解决流程

```
① 拉取最新代码
   - git pull origin main
   ↓
② 识别冲突文件
   - git status
   ↓
③ 解决冲突
   - 手动编辑冲突文件
   - 选择保留哪个版本或合并
   ↓
④ 标记已解决
   - git add <file>
   ↓
⑤ 提交合并结果
   - git commit -m "merge: 解决配置冲突"
```

### 7.3 避免冲突的最佳实践

1. **频繁同步**：发布前先拉取最新代码
2. **小粒度提交**：按组件提交，减少冲突范围
3. **沟通协作**：团队成员发布前相互通知
4. **分支隔离**：租户定制使用独立分支

---

## 八、与 Gitea 的关系

### 8.1 职责划分

| 存储 | 内容 | 用途 |
|-----|------|------|
| Git (配置仓库) | 原始配置（JSON） | 配置版本追溯 |
| Gitea (代码仓库) | 生成代码 | 代码版本管理、CI/CD |

### 8.2 工作流程

```
① 配置发布 → Git 配置仓库
   - 配置 JSON 文件提交到 Git
   ↓
② 触发构建 → 生成代码
   - 从 Git 读取配置
   - 生成代码
   ↓
③ 推送代码 → Gitea 代码仓库
   - 生成的代码推送到 Gitea
   ↓
④ CI/CD → 自动部署
   - Gitea 触发 CI/CD 流水线
   - 自动构建、测试、部署
```

### 8.3 Gitea 仓库命名

```
assembox-service-{module_group_code}
```

**示例**：
```
assembox-service-order-service      # 订单服务代码仓库
assembox-service-user-service       # 用户服务代码仓库
assembox-service-payment-service    # 支付服务代码仓库
```

---

## 九、操作接口设计

### 9.1 Git 操作服务

**服务类**：`GitVersionService`

**核心方法**：

```typescript
export class GitVersionService {
  /**
   * 初始化配置仓库
   */
  async initRepository(moduleGroupCode: string): Promise<void>

  /**
   * 提交配置到 Git
   */
  async commitConfig(params: {
    moduleGroupCode: string;
    moduleCodes: string[];
    versionCode: string;
    layer: string;
    commitMessage: string;
    branch?: string;
  }): Promise<string>

  /**
   * 创建发布分支
   */
  async createReleaseBranch(params: {
    moduleGroupCode: string;
    versionCode: string;
  }): Promise<void>

  /**
   * 创建租户分支
   */
  async createTenantBranch(params: {
    moduleGroupCode: string;
    tenantId: string;
    baseVersion: string;
    targetVersion: string;
  }): Promise<void>

  /**
   * 创建标签
   */
  async createTag(params: {
    moduleGroupCode: string;
    tagName: string;
    tagMessage: string;
    branch?: string;
  }): Promise<void>

  /**
   * 获取配置历史
   */
  async getConfigHistory(params: {
    moduleGroupCode: string;
    filePath: string;
    limit?: number;
  }): Promise<GitCommit[]>

  /**
   * 回滚配置
   */
  async revertConfig(params: {
    moduleGroupCode: string;
    filePath: string;
    commitHash: string;
  }): Promise<void>

  /**
   * 获取标签列表
   */
  async listTags(moduleGroupCode: string): Promise<string[]>

  /**
   * 获取分支列表
   */
  async listBranches(moduleGroupCode: string): Promise<string[]>
}
```

### 9.2 使用示例

```typescript
// 系统版本发布
await gitVersionService.commitConfig({
  moduleGroupCode: 'order-service',
  moduleCodes: ['order'],
  versionCode: 'v1.0.0',
  layer: 'system',
  commitMessage: 'release(order): 发布订单模块 v1.0.0',
  branch: 'main',
});

await gitVersionService.createReleaseBranch({
  moduleGroupCode: 'order-service',
  versionCode: 'v1.0.0',
});

await gitVersionService.createTag({
  moduleGroupCode: 'order-service',
  tagName: 'v1.0.0',
  tagMessage: '订单服务 v1.0.0',
  branch: 'release/v1.0.0',
});

// 租户版本发布
await gitVersionService.createTenantBranch({
  moduleGroupCode: 'order-service',
  tenantId: '1001',
  baseVersion: 'v1.0.0',
  targetVersion: 'v1.0.0-custom',
});

await gitVersionService.commitConfig({
  moduleGroupCode: 'order-service',
  moduleCodes: ['order'],
  versionCode: 'v1.0.0-custom',
  layer: 'tenant',
  commitMessage: 'feat(tenant-1001): 定制订单流程',
  branch: 'tenant/1001/v1.0.0',
});

await gitVersionService.createTag({
  moduleGroupCode: 'order-service',
  tagName: 'tenant/1001/v1.0.0',
  tagMessage: '租户 1001 订单服务定制版本',
  branch: 'tenant/1001/v1.0.0',
});
```

---

## 十、监控与审计

### 10.1 监控指标

| 指标 | 说明 | 阈值 |
|-----|------|------|
| Git 提交成功率 | 配置提交成功率 | > 99.9% |
| Git 操作响应时间 | Git 操作平均响应时间 | < 1s |
| 仓库大小 | Git 仓库占用空间 | < 1GB |

### 10.2 审计日志

**记录内容**：
- 提交人、提交时间
- 提交分支、提交信息
- 变更文件列表
- 变更内容 Diff

**存储位置**：
- Git 原生日志：`git log`
- 数据库审计表：`ab_git_audit_log`

---

## 十一、最佳实践

### 11.1 版本命名规范

遵循 [Semantic Versioning](https://semver.org/)：

```
v{MAJOR}.{MINOR}.{PATCH}
```

- **MAJOR**：不兼容的 API 变更
- **MINOR**：向下兼容的功能新增
- **PATCH**：向下兼容的问题修复

**示例**：
```
v1.0.0 → v1.0.1 (修复问题)
v1.0.1 → v1.1.0 (新增功能)
v1.1.0 → v2.0.0 (不兼容变更)
```

### 11.2 分支保护

**保护分支**：
- main
- release/*
- tenant/*

**保护规则**：
- 禁止强制推送（force push）
- 禁止删除分支
- 要求代码审查（可选）

### 11.3 仓库清理

**定期清理**：
- 清理未使用的分支
- 压缩 Git 历史：`git gc`
- 清理大文件：`git filter-branch`

---

## 十二、总结

本文档定义了基于 Git 的配置版本管理策略：

**核心特点**：
1. **独立仓库**：按模块组创建独立 Git 仓库
2. **分支模型**：主干开发 + 发布分支 + 租户分支
3. **提交规范**：遵循 Conventional Commits
4. **标签管理**：系统版本标签 + 租户版本标签
5. **回滚支持**：基于标签或提交的版本回滚
6. **审计追溯**：完整的版本历史和审计日志

**与其他存储的关系**：
- **数据库**：存储配置元信息
- **OSS**：存储配置内容
- **Git**：版本追溯和历史管理
- **Gitea**：生成代码的版本管理

**下一步**：
- 构建发布层总体设计
