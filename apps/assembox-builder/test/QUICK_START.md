# 快速开始 - 构建服务 E2E 测试

## 前置条件

测试脚本会依次启动两个服务：
1. **存储服务（assembox-storage）**：用于创建模块组、发布配置、生成快照
2. **构建服务（assembox-builder）**：被测试的目标服务

## 步骤一：启动存储服务

```bash
# 在项目根目录
pnpm dev:storage
```

等待看到 `Database XXX initialized successfully!` 后继续。

## 步骤二：启动构建服务

```bash
# 新开一个终端，在项目根目录
pnpm dev:builder
```

等待看到服务启动成功日志后继续。

## 步骤三：运行测试脚本

```bash
# 在 assembox-builder 目录下运行
cd apps/assembox-builder
npx ts-node test/manual-test.ts
```

或者通过 npm 脚本（需要先更新 package.json）：

```bash
pnpm test:builder:e2e
```

## 测试流程说明

测试脚本分六个部分，按设计文档的构建流程逐步验证：

### 第一部分：准备存储层数据

在存储服务中创建完整的测试数据链路：

| 步骤 | 操作 | 说明 |
|-----|------|------|
| 1 | 创建模块组 | order-service |
| 2 | 绑定流水线 | backend 类型 |
| 3 | 创建模块 | order 模块 |
| 4 | 创建系统版本 | v1.0.0 |
| 5 | 创建组件类型 | entity、service_method |
| 6 | 创建并发布组件配置 | order_entity、order_service_method |

### 第二部分：触发构建

| 步骤 | 操作 | 验证点 |
|-----|------|--------|
| 7 | POST /build/trigger | 返回 taskId, status=pending |
| 8 | 并发检查 | 同一模块组再次触发应被拒绝 |

### 第三部分：等待构建完成

| 步骤 | 操作 | 验证点 |
|-----|------|--------|
| 9 | 轮询任务状态 | 状态依次经过：snapshotting → generating → validating → pushing → completed |
| 10 | 查询任务详情 | giteaRepo 已填写，status=completed |

### 第四部分：查询历史

| 步骤 | 操作 | 验证点 |
|-----|------|--------|
| 11 | GET /build/by-group/:id | 返回历史任务列表，包含已完成的任务 |
| 12 | GET /build/:taskId | 返回任务详情，字段完整 |

### 第五部分：回滚构建

| 步骤 | 操作 | 验证点 |
|-----|------|--------|
| 13 | 传入 snapshotId 触发回滚 | 跳过快照创建，直接进入 generating |
| 14 | 等待回滚完成 | status=completed |

### 第六部分：CI/CD 回调

| 步骤 | 操作 | 验证点 |
|-----|------|--------|
| 15 | POST /build/cicd-result (success) | 返回 {success: true} |
| 16 | POST /build/cicd-result (failure) | 返回 {success: true}，相关任务标记 failed |

## 故障排查

### 问题 1：连接拒绝

```
Error: connect ECONNREFUSED
```

确保两个服务均已启动。

### 问题 2：构建任务长时间停在 snapshotting

检查 Nacos 配置是否正确，构建服务通过 Nacos 发现存储服务地址：

```bash
# 所需环境变量
export CS_NACOSSERVERIP=<nacos-ip>
export CS_NACOSNAME=<nacos-username>
export CS_NACOSPASSWORD=<nacos-password>
export CS_SERVICEENV=dev
```

### 问题 3：构建停在 generating（代码生成阶段）

检查 entity 配置内容的 JSON 格式是否符合 libs/code-generator 的 EntityConfig 规范。

### 问题 4：构建停在 pushing

检查 Gitea 配置（apiUrl、token、defaultOwner）是否正确，
以及网络是否可达 `config.yaml` 中配置的 Gitea 实例。

### 问题 5：任务状态变为 failed

查看构建服务日志中的错误信息，或通过 GET /build/:taskId 查看 errorMessage 字段。

## 清理测试数据

```bash
npx ts-node test/cleanup-test-data.ts
```

清理脚本会删除测试脚本创建的所有数据（构建任务 + 存储层测试数据）。
