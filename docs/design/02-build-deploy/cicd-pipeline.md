# CI/CD 流水线设计

> 版本：v1.1
> 日期：2026-02-27
> 状态：设计阶段

---

## 一、概述

### 1.1 CI/CD 在构建流程中的位置

```
assembox-builder（构建服务）
    │
    ├─ 代码生成 ✓
    ├─ 本地校验 ✓（tsc + jest）
    ├─ 推送 Gitea ✓
    │
    └─ 触发 CI/CD ───────────────→ Gitea Actions（本文档范围）
                                        │
                                        ├─ 编译构建（tsc build）
                                        ├─ 单元测试
                                        ├─ 构建 Docker 镜像
                                        └─ 部署到目标环境
```

### 1.2 触发方式

CI/CD 流水线通过**路径过滤**的 push 事件触发：

| 触发条件 | 说明 |
|---------|------|
| `push` 到 `generated/**` | 构建服务提交生成代码时自动触发 |

**注意**：`modules/` 和 `snapshots/` 目录的变更（存储服务写入配置和快照清单）**不触发** CI/CD，通过路径过滤隔离。

---

## 二、Gitea Actions 工作流设计

### 2.1 工作流文件位置

工作流配置存储在各模块组自己的仓库中：

```
assembox-configs-{moduleGroupCode}-backend/
└── .gitea/
    └── workflows/
        └── backend-build.yml    ← 后端构建工作流

assembox-configs-{moduleGroupCode}-website/
└── .gitea/
    └── workflows/
        └── website-build.yml    ← 前端构建工作流（规划中）
```

工作流文件由构建服务在**初始化仓库**时一次性写入（或由运维预置），后续构建不更新工作流本身。

### 2.2 后端构建工作流（backend-build.yml）

```yaml
name: Backend Build and Deploy

on:
  push:
    paths:
      - 'generated/**'           # 只监听生成代码目录，配置/快照变更不触发

env:
  # 仓库名即 moduleGroupCode-pipelineType，从仓库名中提取 moduleGroupCode
  # 例：assembox-configs-order-service-backend → order-service
  MODULE_GROUP_CODE: ${{ vars.MODULE_GROUP_CODE }}   # 仓库创建时预设的变量

jobs:
  build-and-test:
    name: Build and Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        working-directory: generated
        run: npm ci

      - name: TypeScript compile check
        working-directory: generated
        run: npx tsc --noEmit

      - name: Run unit tests
        working-directory: generated
        run: npx jest --passWithNoTests --coverage

  build-docker:
    name: Build Docker Image
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set image tag
        id: image
        run: |
          COMMIT_SHA=$(echo ${{ github.sha }} | cut -c1-8)
          echo "image=registry.example.com/assembox/${{ env.MODULE_GROUP_CODE }}:${COMMIT_SHA}" >> $GITHUB_OUTPUT
          echo "image_latest=registry.example.com/assembox/${{ env.MODULE_GROUP_CODE }}:latest" >> $GITHUB_OUTPUT

      - name: Build Docker image
        run: |
          docker build \
            -t ${{ steps.image.outputs.image }} \
            -t ${{ steps.image.outputs.image_latest }} \
            -f generated/Dockerfile \
            services/${{ needs.detect-changed-service.outputs.module_group }}

      - name: Push to Registry
        run: |
          docker push ${{ steps.image.outputs.image }}
          docker push ${{ steps.image.outputs.image_latest }}

  deploy:
    name: Deploy to Environment
    needs: [detect-changed-service, build-docker]
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        env:
          MODULE_GROUP: ${{ env.MODULE_GROUP_CODE }}
          IMAGE: ${{ steps.image.outputs.image }}
        run: |
          # 更新 K8s Deployment 的镜像版本
          kubectl set image deployment/${MODULE_GROUP} \
            app=${IMAGE} \
            -n assembox

          # 等待滚动更新完成
          kubectl rollout status deployment/${MODULE_GROUP} -n assembox

      - name: Notify build result
        if: always()
        run: |
          # 回调 assembox-builder，更新任务最终状态
          curl -X POST ${{ secrets.BUILDER_CALLBACK_URL }}/build/cicd-result \
            -H 'Content-Type: application/json' \
            -d '{
              "module_group_code": "${{ env.MODULE_GROUP_CODE }}",
              "status": "${{ job.status }}"
            }'
```

---

## 三、Dockerfile 设计

### 3.1 生成的服务 Dockerfile

Dockerfile 由构建服务在**初始化仓库**时写入 `generated/Dockerfile`（或由运维预置），后续构建不覆盖：

```dockerfile
# generated/Dockerfile

# ────────────── 构建阶段 ──────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖（利用 Docker 层缓存）
COPY package*.json ./
RUN npm ci --only=production

# 复制源码并编译
COPY . .
RUN npx tsc --project tsconfig.build.json


# ────────────── 运行阶段 ──────────────
FROM node:20-alpine AS runner

WORKDIR /app

# 只复制必要文件
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# 非 root 用户运行
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

---

## 四、环境策略

### 4.1 部署环境

| 环境 | 触发条件 | 说明 |
|-----|---------|------|
| **dev** | `generated/**` push | 开发测试环境，自动部署 |
| **staging** | 手动审批（Gitea environment 保护） | 预发布环境 |
| **prod** | 手动触发 | 生产环境，严格审批流程 |

### 4.2 多环境工作流扩展（规划）

```yaml
deploy-staging:
  environment: staging        # Gitea 中配置需要审批人
  needs: build-docker
  if: github.event_name == 'workflow_dispatch'

deploy-prod:
  environment: production
  needs: deploy-staging
  if: github.event_name == 'workflow_dispatch'
```

---

## 五、租户构建的 CI/CD

租户定制构建使用独立仓库（`assembox-configs-{moduleGroupCode}-backend` 中包含租户层配置），通过仓库级别的 Kubernetes Namespace 变量区分：

```
# 系统构建仓库的 vars.NAMESPACE = assembox-system
# 租户仓库（规划）assembox-configs-order-service-t001-backend
# 的 vars.NAMESPACE = assembox-tenant-t001
```

通过 Kubernetes Namespace 隔离不同租户的服务实例。

---

## 六、构建结果回调

CI/CD 完成后（无论成功失败），通过 Gitea Actions 中的 Notify 步骤回调 assembox-builder：

```
POST /build/cicd-result
{
  "module_group_code": "order-service",
  "status": "success" | "failure"
}
```

assembox-builder 收到回调后：
- 成功：更新 ab_build_task.status = 'completed'
- 失败：更新 ab_build_task.status = 'failed'，记录 CI/CD 失败信息

---

## 七、回滚策略

### 7.1 快速回滚（镜像层面）

```bash
# 直接切换 K8s Deployment 到历史镜像（commit sha 对应的镜像）
kubectl set image deployment/order-service \
  app=registry/assembox/order-service:{commitSha} \
  -n assembox
```

特点：秒级回滚，不需要重新走 CI/CD 流程（历史镜像已在 Registry 中）。

### 7.2 代码层面回滚（基于历史快照重建）

通过 assembox-builder 触发回滚构建，传入历史快照 ID：

```
POST /build/trigger
{
  "module_group_id": "xxx",
  "pipeline_type": "backend",
  "snapshot_id": "历史快照ID"   ← 指定已有快照，跳过快照创建步骤
}
```

流程：
1. 以历史快照中的组件版本重新生成代码
2. 推送到 Gitea `generated/`，触发 CI/CD
3. CI/CD 构建新镜像，部署

适用场景：历史镜像已清理，或需要重新生成代码确保一致性。

---

## 八、监控与告警

| 监控点 | 告警条件 | 处理方式 |
|-------|---------|---------|
| 构建任务超时 | pending 状态超过 30 分钟 | 自动标记 failed，发送告警 |
| CI/CD 失败 | Actions 工作流失败 | 回调失败，发送告警 |
| Gitea 推送失败 | push 命令返回非 0 | 任务标记 failed，可重试 |
| Docker Registry 不可达 | push image 失败 | CI/CD 任务失败，告警 |
