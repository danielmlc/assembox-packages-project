# 配置内容存储详细设计

> 版本：v1.0
> 日期：2026-02-06
> 状态：设计阶段

---

## 一、概述

本文档定义组件配置内容在 OSS（对象存储服务）中的存储策略和管理机制。

### 1.1 存储策略

**存储位置决策**：

根据 `ab_component.store_in_oss` 字段决定配置内容存储位置：

| store_in_oss | 存储位置 | 适用场景 |
|-------------|---------|---------|
| 0 | 数据库（ab_component_config.config_content） | 配置内容较小（< 1KB）|
| 1 | OSS | 配置内容较大（≥ 1KB）|

**本文档重点**：OSS 存储策略（store_in_oss=1）

---

## 二、OSS 存储结构设计

### 2.1 整体目录结构

```
assembox-config/                          # Bucket 根目录
├── draft/                                # 草稿区
│   └── {module_group_code}/              # 模块组
│       └── {module_code}/                # 模块
│           └── {version_code}/           # 版本
│               └── {layer}/              # 层级（system/tenant）
│                   ├── {component_code}.json           # 当前草稿
│                   └── history/                        # 历史草稿
│                       ├── {component_code}.v1.json
│                       ├── {component_code}.v2.json
│                       └── {component_code}.v3.json
│
├── published/                            # 发布区
│   └── {module_group_code}/              # 模块组
│       └── {module_code}/                # 模块
│           └── {version_code}/           # 版本
│               └── {layer}/              # 层级（system/tenant）
│                   ├── {component_code}.json           # 当前发布版本
│                   └── history/                        # 历史发布
│                       ├── {component_code}.v1.json
│                       ├── {component_code}.v2.json
│                       └── {component_code}.v3.json
│
└── snapshot/                             # 快照区
    └── {module_group_code}/              # 模块组
        └── {snapshot_code}/              # 快照编码（S001, S002...）
            └── snapshot.json             # 快照元数据
```

### 2.2 路径规范

#### 2.2.1 草稿路径

**当前草稿**：
```
draft/{module_group_code}/{module_code}/{version_code}/{layer}/{component_code}.json
```

**历史草稿**：
```
draft/{module_group_code}/{module_code}/{version_code}/{layer}/history/{component_code}.v{draft_version}.json
```

**示例**：
```
# 当前草稿
draft/order-service/order/v1.0.0/system/order_controller.json

# 历史草稿
draft/order-service/order/v1.0.0/system/history/order_controller.v1.json
draft/order-service/order/v1.0.0/system/history/order_controller.v2.json
```

#### 2.2.2 发布路径

**当前发布**：
```
published/{module_group_code}/{module_code}/{version_code}/{layer}/{component_code}.json
```

**历史发布**：
```
published/{module_group_code}/{module_code}/{version_code}/{layer}/history/{component_code}.v{publish_version}.json
```

**示例**：
```
# 当前发布
published/order-service/order/v1.0.0/system/order_controller.json

# 历史发布
published/order-service/order/v1.0.0/system/history/order_controller.v1.json
published/order-service/order/v1.0.0/system/history/order_controller.v5.json
```

#### 2.2.3 快照路径

```
snapshot/{module_group_code}/{snapshot_code}/snapshot.json
```

**示例**：
```
snapshot/order-service/S001/snapshot.json
snapshot/order-service/S002/snapshot.json
```

---

## 三、配置文件格式

### 3.1 组件配置文件（JSON）

所有组件配置文件采用 JSON 格式存储。

**通用结构**：

```json
{
  "meta": {
    "component_code": "order_controller",
    "component_type": "controller",
    "version_code": "v1.0.0",
    "layer": "system",
    "created_at": "2026-02-06T10:00:00Z",
    "creator_name": "张三"
  },
  "config": {
    // 组件具体配置内容
  }
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|-----|------|------|
| meta | Object | 元信息 |
| meta.component_code | String | 组件实例编码 |
| meta.component_type | String | 组件类型 |
| meta.version_code | String | 版本编码 |
| meta.layer | String | 配置层级 |
| meta.created_at | String | 创建时间（ISO 8601） |
| meta.creator_name | String | 创建人 |
| config | Object | 组件具体配置内容 |

### 3.2 配置内容示例

#### 3.2.1 Controller 配置

```json
{
  "meta": {
    "component_code": "order_controller",
    "component_type": "controller",
    "version_code": "v1.0.0",
    "layer": "system",
    "created_at": "2026-02-06T10:00:00Z",
    "creator_name": "张三"
  },
  "config": {
    "class_name": "OrderController",
    "base_path": "/api/order",
    "endpoints": [
      {
        "method": "POST",
        "path": "/create",
        "handler": "createOrder",
        "description": "创建订单",
        "params": [
          {
            "name": "orderData",
            "type": "CreateOrderDto",
            "required": true
          }
        ],
        "response": {
          "type": "OrderEntity",
          "description": "订单实体"
        }
      },
      {
        "method": "GET",
        "path": "/:id",
        "handler": "getOrderById",
        "description": "根据ID获取订单",
        "params": [
          {
            "name": "id",
            "type": "string",
            "required": true,
            "in": "path"
          }
        ],
        "response": {
          "type": "OrderEntity"
        }
      }
    ]
  }
}
```

#### 3.2.2 Entity 配置

```json
{
  "meta": {
    "component_code": "order_entity",
    "component_type": "entity",
    "version_code": "v1.0.0",
    "layer": "system",
    "created_at": "2026-02-06T10:00:00Z",
    "creator_name": "张三"
  },
  "config": {
    "table_name": "order_main",
    "entity_name": "OrderEntity",
    "extends": "HasPrimaryFullEntity",
    "fields": [
      {
        "name": "orderNo",
        "column_name": "order_no",
        "type": "varchar",
        "length": 50,
        "nullable": false,
        "unique": true,
        "comment": "订单号"
      },
      {
        "name": "customerId",
        "column_name": "customer_id",
        "type": "bigint",
        "nullable": false,
        "comment": "客户ID"
      },
      {
        "name": "totalAmount",
        "column_name": "total_amount",
        "type": "decimal",
        "precision": 10,
        "scale": 2,
        "nullable": false,
        "comment": "订单总金额"
      },
      {
        "name": "status",
        "column_name": "status",
        "type": "varchar",
        "length": 20,
        "nullable": false,
        "default": "pending",
        "comment": "订单状态"
      }
    ]
  }
}
```

#### 3.2.3 Service 配置

```json
{
  "meta": {
    "component_code": "order_service",
    "component_type": "service",
    "version_code": "v1.0.0",
    "layer": "system",
    "created_at": "2026-02-06T10:00:00Z",
    "creator_name": "张三"
  },
  "config": {
    "class_name": "OrderService",
    "dependencies": [
      "OrderRepository",
      "CustomerService"
    ],
    "methods": [
      {
        "name": "createOrder",
        "description": "创建订单",
        "params": [
          {
            "name": "orderData",
            "type": "CreateOrderDto"
          }
        ],
        "return_type": "Promise<OrderEntity>",
        "logic": [
          {
            "step": "validate_customer",
            "description": "验证客户是否存在",
            "action": "customerService.validateCustomer(orderData.customerId)"
          },
          {
            "step": "calculate_amount",
            "description": "计算订单金额",
            "action": "this.calculateTotalAmount(orderData.items)"
          },
          {
            "step": "create_order",
            "description": "创建订单记录",
            "action": "orderRepository.create(order)"
          }
        ]
      },
      {
        "name": "getOrderById",
        "description": "根据ID获取订单",
        "params": [
          {
            "name": "id",
            "type": "string"
          }
        ],
        "return_type": "Promise<OrderEntity>",
        "logic": [
          {
            "step": "find_order",
            "description": "查询订单",
            "action": "orderRepository.findById(id)"
          },
          {
            "step": "check_exists",
            "description": "检查订单是否存在",
            "action": "if (!order) throw new NotFoundException()"
          }
        ]
      }
    ]
  }
}
```

### 3.3 快照文件格式

快照文件记录构建时刻的完整配置清单。

```json
{
  "snapshot_id": "S002",
  "snapshot_code": "S002",
  "module_group_code": "order-service",
  "module_group_name": "订单服务",
  "created_at": "2026-02-06T14:00:00Z",
  "creator_name": "李四",
  "modules": [
    {
      "module_code": "order",
      "module_name": "订单模块",
      "version_code": "v1.0.0",
      "components": [
        {
          "component_type": "controller",
          "component_code": "order_controller",
          "component_name": "订单控制器",
          "layer": "system",
          "publish_version": 6,
          "config_oss_key": "published/order-service/order/v1.0.0/system/order_controller.json"
        },
        {
          "component_type": "service",
          "component_code": "order_service",
          "component_name": "订单服务",
          "layer": "system",
          "publish_version": 3,
          "config_oss_key": "published/order-service/order/v1.0.0/system/order_service.json"
        },
        {
          "component_type": "entity",
          "component_code": "order_entity",
          "component_name": "订单实体",
          "layer": "system",
          "publish_version": 5,
          "config_oss_key": "published/order-service/order/v1.0.0/system/order_entity.json"
        }
      ]
    },
    {
      "module_code": "payment",
      "module_name": "支付模块",
      "version_code": "v1.0.0",
      "components": [
        {
          "component_type": "controller",
          "component_code": "payment_controller",
          "component_name": "支付控制器",
          "layer": "system",
          "publish_version": 2,
          "config_oss_key": "published/order-service/payment/v1.0.0/system/payment_controller.json"
        }
      ]
    }
  ]
}
```

---

## 四、存储操作流程

### 4.1 草稿保存流程

```
① 前端提交配置内容
   ↓
② 服务端生成 OSS Key
   draft_oss_key = draft/{module_group}/{module}/{version}/{layer}/{component_code}.json
   ↓
③ 上传配置到 OSS（当前草稿）
   - 覆盖当前草稿文件
   ↓
④ 判断是否需要归档历史
   IF (ab_component_config.draft_oss_key != NULL):
     - 读取旧的草稿内容
     - draft_version = 获取 ab_component_config_draft_history 中最大的 draft_version + 1
     - history_oss_key = draft/{...}/history/{component_code}.v{draft_version}.json
     - 将旧草稿内容上传到 history_oss_key
     - 插入 ab_component_config_draft_history 记录
   ↓
⑤ 更新数据库
   UPDATE ab_component_config SET
     draft_oss_key = {当前草稿 OSS Key},
     status = 'draft',
     modifier_at = NOW(),
     modifier_id = {当前用户ID}
   ↓
⑥ 返回成功响应
```

**关键说明**：
- 当前草稿文件会被覆盖
- 每次保存前，如果已有草稿，会先归档到 history 目录
- 历史草稿文件名包含版本号 `.v{draft_version}.json`

### 4.2 发布流程

```
① 触发发布操作（组件/模块/模块组级别）
   ↓
② 确定待发布组件清单
   IF (发布粒度 == 组件):
     待发布组件 = [选中的组件]
   ELSE IF (发布粒度 == 模块):
     待发布组件 = 选中模块下的所有组件
   ELSE IF (发布粒度 == 模块组):
     待发布组件 = 模块组下的所有组件
   ↓
③ 批量发布组件
   FOR EACH 待发布组件:
     │
     ├─ 验证草稿存在
     │  IF (draft_oss_key == NULL):
     │    抛出异常：该组件没有草稿，无法发布
     │
     ├─ 判断是否需要归档历史发布
     │  IF (published_oss_key != NULL):
     │    - 读取旧的发布内容
     │    - history_oss_key = published/{...}/history/{component_code}.v{publish_version}.json
     │    - 将旧发布内容上传到 history_oss_key
     │    - 插入 ab_config_history 记录
     │
     ├─ 复制草稿到发布区
     │  - published_oss_key = published/{module_group}/{module}/{version}/{layer}/{component_code}.json
     │  - OSS Copy: draft_oss_key → published_oss_key
     │
     └─ 更新数据库
        UPDATE ab_component_config SET
          status = 'published',
          publish_version = publish_version + 1,
          published_oss_key = {发布 OSS Key},
          published_at = NOW()
   ↓
④ 返回成功响应
```

**关键说明**：
- 只更新被选中组件的 `publish_version`
- 发布时会归档历史发布版本到 history 目录
- 使用 OSS Copy 操作，避免重复上传

### 4.3 构建时读取配置流程

```
① 触发构建
   ↓
② 生成快照
   - 生成快照号 (S001, S002...)
   - 收集模块组下所有模块的组件清单
   - 记录每个组件的当前 publish_version 和 published_oss_key
   - 写入 ab_snapshot 表
   - 上传快照文件到 OSS: snapshot/{module_group}/{snapshot_code}/snapshot.json
   ↓
③ 根据快照读取配置
   - 读取快照文件
   - 解析组件清单
   ↓
④ 批量下载配置文件
   FOR EACH 组件 IN 快照清单:
     │
     ├─ 确定租户层级
     │  tenant_layer_key = 构造租户层配置 OSS Key
     │  system_layer_key = 组件的 config_oss_key (快照中记录的系统层)
     │
     ├─ 选择配置（租户优先，不合并）
     │  IF (tenant_layer_key 在 OSS 中存在):
     │    final_config = 下载 tenant_layer_key
     │  ELSE:
     │    final_config = 下载 system_layer_key
     │
     └─ 收集配置
        配置清单[组件编码] = final_config
   ↓
⑤ 传递给代码生成器
   - 配置清单传递给代码生成模块
   ↓
⑥ 生成代码
```

**关键说明**：
- 快照锁定了构建时刻的配置状态
- 构建时选择租户或系统配置（不合并）
- 批量下载提高效率

### 4.4 运行时读取配置流程

运行时配置不生成代码，通过 API 动态读取。

```
① API 请求到达
   ↓
② 解析租户信息
   tenant_id = 从请求上下文获取
   ↓
③ 查询配置（支持继承）
   - 查询租户层配置
   - 查询全局层配置
   - 查询系统层配置
   ↓
④ 合并配置（租户 ⊕ 全局 ⊕ 系统）
   final_config = merge(system_config, global_config, tenant_config)
   ↓
⑤ 返回配置
```

**关键说明**：
- 运行时配置支持三层继承（系统 → 全局 → 租户）
- 使用深度合并策略（租户覆盖全局，全局覆盖系统）
- 运行时配置通常不存储在 OSS，存储在数据库

---

## 五、历史归档策略

### 5.1 草稿历史归档

**归档时机**：
- 每次保存草稿前，如果已有草稿，先归档旧草稿

**归档策略**：
```
IF (当前草稿存在):
  1. 读取旧草稿内容（从 draft_oss_key）
  2. 生成 draft_version（递增）
  3. 上传到 history 目录：
     draft/{module_group}/{module}/{version}/{layer}/history/{component_code}.v{draft_version}.json
  4. 插入 ab_component_config_draft_history 记录
```

**保留策略**：
- 默认保留所有历史草稿
- 可配置保留数量（如最近 50 个版本）
- 超出数量的历史草稿自动归档或删除

### 5.2 发布历史归档

**归档时机**：
- 每次发布前，如果已有发布版本，先归档旧发布

**归档策略**：
```
IF (已发布版本存在):
  1. 读取旧发布内容（从 published_oss_key）
  2. 使用当前 publish_version 作为版本号
  3. 上传到 history 目录：
     published/{module_group}/{module}/{version}/{layer}/history/{component_code}.v{publish_version}.json
  4. 插入 ab_config_history 记录
```

**保留策略**：
- 默认保留所有发布历史
- 可配置保留数量（如最近 20 个版本）
- 历史版本支持回滚

### 5.3 快照归档

**归档时机**：
- 构建完成后永久保留

**保留策略**：
- 所有快照永久保留
- 用于追溯和审计

---

## 六、访问控制

### 6.1 OSS 访问权限

| 目录 | 读权限 | 写权限 | 说明 |
|-----|-------|-------|------|
| draft/ | 服务端 | 服务端 | 草稿区，仅服务端可访问 |
| published/ | 服务端 + 构建系统 | 服务端 | 发布区，构建系统可读 |
| snapshot/ | 服务端 + 构建系统 | 服务端 | 快照区，构建系统可读 |

### 6.2 访问策略

**服务端访问**：
- 使用 AccessKey/SecretKey 访问 OSS
- 权限：读写所有目录

**构建系统访问**：
- 使用临时 STS Token 访问 OSS
- 权限：只读 published/ 和 snapshot/ 目录
- Token 有效期：1 小时

**前端访问**：
- 不直接访问 OSS
- 通过服务端 API 间接访问

---


## 七、总结

本文档定义了配置内容在 OSS 中的存储策略：

**核心特点**：
1. **分层存储**：draft（草稿）、published（发布）、snapshot（快照）
2. **历史归档**：支持草稿历史和发布历史的自动归档
3. **路径规范**：清晰的目录结构和命名规范
4. **JSON 格式**：统一的配置文件格式
5. **访问控制**：基于角色的访问权限控制

**下一步**：
- 版本管理存储详细设计（Git 版本控制）
