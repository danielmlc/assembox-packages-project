# 元数据存储详细设计

> 版本：v1.0
> 日期：2026-02-06
> 状态：设计阶段

---

## 一、概述

本文档定义存储层中所有元数据相关的数据库表结构设计。

### 1.1 设计原则

1. **实体继承**：所有表继承平台基础实体（HasPrimaryFullEntity）
2. **命名规范**：表名使用 `ab_` 前缀，小写下划线命名，单数形式
3. **主键规范**：使用 BIGINT 类型，雪花算法生成；关联表可使用复合主键
4. **外键约束**：不使用数据库外键，通过应用层保证数据一致性
5. **索引策略**：初始不定义索引（除主键外），根据实际查询需求添加

### 1.2 基础实体继承层次

```
HasOnlyPrimaryEntity
    │
    └── BaseEntity (+ 审计字段)
            │
            └── HasEnableEntity (+ 启用/排序)
                    │
                    └── HasPrimaryFullEntity (+ 主键)
```

**公共字段**（所有表继承）：

```sql
-- 主键 (HasPrimaryFullEntity)
id                BIGINT NOT NULL COMMENT '主键',

-- 审计字段 (BaseEntity)
created_at        DATETIME COMMENT '创建时间',
creator_id        BIGINT COMMENT '创建人ID',
creator_name      VARCHAR(50) COMMENT '创建人姓名',
modifier_at       DATETIME COMMENT '修改时间',
modifier_id       BIGINT COMMENT '修改人ID',
modifier_name     VARCHAR(50) COMMENT '修改人姓名',
is_removed        TINYINT(1) DEFAULT 0 COMMENT '逻辑删除标记',
version           BIGINT COMMENT '乐观锁版本号',

-- 启用/排序 (HasEnableEntity)
sort_code         INT COMMENT '排序码',
is_enable         TINYINT(1) DEFAULT 1 COMMENT '启用状态'
```

---

## 二、核心表设计

### 2.1 模块组表（ab_module_group）

**用途**：定义业务块/模块组，对应一个微服务/构建发布单元。

**表结构**：

```sql
CREATE TABLE ab_module_group (
  -- 主键及公共字段（继承 HasPrimaryFullEntity）
  id                BIGINT NOT NULL COMMENT '主键',
  created_at        DATETIME COMMENT '创建时间',
  creator_id        BIGINT COMMENT '创建人ID',
  creator_name      VARCHAR(50) COMMENT '创建人姓名',
  modifier_at       DATETIME COMMENT '修改时间',
  modifier_id       BIGINT COMMENT '修改人ID',
  modifier_name     VARCHAR(50) COMMENT '修改人姓名',
  is_removed        TINYINT(1) DEFAULT 0 COMMENT '逻辑删除标记',
  version           BIGINT COMMENT '乐观锁版本号',
  sort_code         INT COMMENT '排序码',
  is_enable         TINYINT(1) DEFAULT 1 COMMENT '启用状态',

  -- 业务字段
  module_group_code VARCHAR(50) NOT NULL COMMENT '模块组编码，唯一标识，如 order-service',
  module_group_name VARCHAR(100) NOT NULL COMMENT '模块组名称，如 订单服务',
  description       VARCHAR(500) COMMENT '描述',

  PRIMARY KEY (id),
  UNIQUE KEY uk_module_group_code (module_group_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模块组定义表';
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| module_group_code | VARCHAR(50) | 是 | 模块组编码，全局唯一，如 `order-service` |
| module_group_name | VARCHAR(100) | 是 | 模块组名称，用于展示 |
| description | VARCHAR(500) | 否 | 模块组描述 |

**业务规则**：
- `module_group_code` 全局唯一，建议使用短横线命名（kebab-case）
- 一个模块组对应一个微服务/构建发布单元
- 删除模块组需检查是否有关联模块

---

### 2.2 模块表（ab_module）

**用途**：定义模块，模块是模块组下的逻辑分组。

**表结构**：

```sql
CREATE TABLE ab_module (
  -- 主键及公共字段（继承 HasPrimaryFullEntity）
  id                BIGINT NOT NULL COMMENT '主键',
  created_at        DATETIME COMMENT '创建时间',
  creator_id        BIGINT COMMENT '创建人ID',
  creator_name      VARCHAR(50) COMMENT '创建人姓名',
  modifier_at       DATETIME COMMENT '修改时间',
  modifier_id       BIGINT COMMENT '修改人ID',
  modifier_name     VARCHAR(50) COMMENT '修改人姓名',
  is_removed        TINYINT(1) DEFAULT 0 COMMENT '逻辑删除标记',
  version           BIGINT COMMENT '乐观锁版本号',
  sort_code         INT COMMENT '排序码',
  is_enable         TINYINT(1) DEFAULT 1 COMMENT '启用状态',

  -- 业务字段
  module_group_id   BIGINT NOT NULL COMMENT '所属模块组ID',
  module_code       VARCHAR(50) NOT NULL COMMENT '模块编码，模块组内唯一，如 order',
  module_name       VARCHAR(100) NOT NULL COMMENT '模块名称，如 订单模块',
  description       VARCHAR(500) COMMENT '描述',

  PRIMARY KEY (id),
  UNIQUE KEY uk_module_group_module (module_group_id, module_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模块定义表';
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| module_group_id | BIGINT | 是 | 所属模块组ID |
| module_code | VARCHAR(50) | 是 | 模块编码，模块组内唯一 |
| module_name | VARCHAR(100) | 是 | 模块名称，用于展示 |
| description | VARCHAR(500) | 否 | 模块描述 |

**业务规则**：
- `module_code` 在模块组内唯一（组合唯一键）
- 模块是逻辑分组，无物理隔离
- 删除模块需检查是否有关联版本

---

### 2.3 版本表（ab_version）

**用途**：管理模块的版本，支持产品迭代版本和租户定制版本。

**表结构**：

```sql
CREATE TABLE ab_version (
  -- 主键及公共字段（继承 HasPrimaryFullEntity）
  id                BIGINT NOT NULL COMMENT '主键',
  created_at        DATETIME COMMENT '创建时间',
  creator_id        BIGINT COMMENT '创建人ID',
  creator_name      VARCHAR(50) COMMENT '创建人姓名',
  modifier_at       DATETIME COMMENT '修改时间',
  modifier_id       BIGINT COMMENT '修改人ID',
  modifier_name     VARCHAR(50) COMMENT '修改人姓名',
  is_removed        TINYINT(1) DEFAULT 0 COMMENT '逻辑删除标记',
  version           BIGINT COMMENT '乐观锁版本号',
  sort_code         INT COMMENT '排序码',
  is_enable         TINYINT(1) DEFAULT 1 COMMENT '启用状态',

  -- 业务字段
  module_id         BIGINT NOT NULL COMMENT '所属模块ID',
  version_code      VARCHAR(50) NOT NULL COMMENT '版本编码，如 v1.0.0',
  version_name      VARCHAR(100) NOT NULL COMMENT '版本名称',
  version_type      VARCHAR(20) NOT NULL COMMENT '版本类型：system=系统版本, tenant=租户版本',
  tenant_id         BIGINT COMMENT '租户ID，租户版本必填',
  parent_version_id BIGINT COMMENT '父版本ID，租户版本基于哪个系统版本创建',
  description       VARCHAR(500) COMMENT '描述',

  PRIMARY KEY (id),
  UNIQUE KEY uk_module_version_tenant (module_id, version_code, version_type, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='版本管理表';
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| module_id | BIGINT | 是 | 所属模块ID |
| version_code | VARCHAR(50) | 是 | 版本编码，如 `v1.0.0` |
| version_name | VARCHAR(100) | 是 | 版本名称，用于展示 |
| version_type | VARCHAR(20) | 是 | 版本类型：`system`=系统版本, `tenant`=租户版本 |
| tenant_id | BIGINT | 条件 | 租户ID，当 version_type='tenant' 时必填 |
| parent_version_id | BIGINT | 否 | 父版本ID，租户版本基于哪个系统版本创建 |
| description | VARCHAR(500) | 否 | 版本描述 |

**业务规则**：
- 系统版本：`version_type='system'`, `tenant_id` 为空
- 租户版本：`version_type='tenant'`, `tenant_id` 必填
- 租户版本可基于系统版本创建（`parent_version_id` 指向系统版本）
- 组合唯一键：`(module_id, version_code, version_type, tenant_id)`
  - 同一模块下，系统版本的 version_code 唯一
  - 同一模块下，不同租户可以有相同的 version_code

---

### 2.4 组件类型注册表（ab_component）

**用途**：定义系统支持的组件类型（如 Controller, Service, Entity, Form, Table 等）。

**表结构**：

```sql
CREATE TABLE ab_component (
  -- 主键及公共字段（继承 HasPrimaryFullEntity）
  id                BIGINT NOT NULL COMMENT '主键',
  created_at        DATETIME COMMENT '创建时间',
  creator_id        BIGINT COMMENT '创建人ID',
  creator_name      VARCHAR(50) COMMENT '创建人姓名',
  modifier_at       DATETIME COMMENT '修改时间',
  modifier_id       BIGINT COMMENT '修改人ID',
  modifier_name     VARCHAR(50) COMMENT '修改人姓名',
  is_removed        TINYINT(1) DEFAULT 0 COMMENT '逻辑删除标记',
  version           BIGINT COMMENT '乐观锁版本号',
  sort_code         INT COMMENT '排序码',
  is_enable         TINYINT(1) DEFAULT 1 COMMENT '启用状态',

  -- 业务字段
  component_code    VARCHAR(50) NOT NULL COMMENT '组件类型编码，如 controller, service, entity',
  component_name    VARCHAR(100) NOT NULL COMMENT '组件类型名称，如 控制器, 服务, 实体',
  category          VARCHAR(20) NOT NULL COMMENT '组件分类：server=服务端, frontend=前端, model=模型',
  is_runtime        TINYINT(1) DEFAULT 0 COMMENT '是否运行时配置：0=构建配置（生成代码）, 1=运行时配置（不生成代码）',
  is_inheritable    TINYINT(1) DEFAULT 1 COMMENT '是否支持继承：0=不支持继承, 1=支持租户/全局覆盖',
  is_cacheable      TINYINT(1) DEFAULT 0 COMMENT '是否可缓存：0=不缓存, 1=可缓存到Redis（仅运行时配置有效）',
  config_schema     TEXT COMMENT '组件配置Schema（JSON格式）',
  store_in_oss      TINYINT(1) DEFAULT 0 COMMENT '是否存储到OSS：0=数据库, 1=OSS',
  description       VARCHAR(500) COMMENT '描述',

  PRIMARY KEY (id),
  UNIQUE KEY uk_component_code (component_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组件类型注册表';
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| component_code | VARCHAR(50) | 是 | 组件类型编码，全局唯一，如 `controller`, `service` |
| component_name | VARCHAR(100) | 是 | 组件类型名称，用于展示 |
| category | VARCHAR(20) | 是 | 组件分类：`server`=服务端, `frontend`=前端, `model`=模型 |
| is_runtime | TINYINT(1) | 是 | 是否运行时配置：0=构建配置（生成代码），1=运行时配置（不生成代码） |
| is_inheritable | TINYINT(1) | 是 | 是否支持继承：0=不支持继承，1=支持租户/全局覆盖 |
| is_cacheable | TINYINT(1) | 是 | 是否可缓存：0=不缓存，1=可缓存到Redis（仅运行时配置有效） |
| config_schema | TEXT | 否 | 组件配置Schema，JSON格式，定义该类型组件的配置结构 |
| store_in_oss | TINYINT(1) | 是 | 是否存储到OSS：0=数据库, 1=OSS |
| description | VARCHAR(500) | 否 | 组件类型描述 |

**业务规则**：
- `component_code` 全局唯一
- `category` 取值：`server`, `frontend`, `model`
- `is_runtime` 决定组件是否生成代码：
  - 0=构建配置：构建时读取，生成代码
  - 1=运行时配置：运行时动态读取，不生成代码
- `is_inheritable` 控制配置继承规则：
  - 0=不支持继承：租户层和系统层独立，不合并
  - 1=支持继承：租户层可覆盖系统层配置
- `is_cacheable` 控制运行时缓存策略：
  - 0=不缓存：每次请求都读取
  - 1=可缓存：缓存到 Redis（仅对 `is_runtime=1` 的组件有效）
- `store_in_oss` 决定组件配置内容存储位置
- `config_schema` 用于前端配置表单生成和校验

**示例数据**：

```sql
-- 构建配置示例（生成代码）
INSERT INTO ab_component (id, component_code, component_name, category, is_runtime, is_inheritable, is_cacheable, store_in_oss, sort_code) VALUES
(1, 'controller', '控制器', 'server', 0, 0, 0, 1, 1),
(2, 'service', '服务', 'server', 0, 0, 0, 1, 2),
(3, 'entity', '实体', 'model', 0, 0, 0, 1, 3),
(4, 'repository', '仓储', 'server', 0, 0, 0, 1, 4),
(5, 'form', '表单', 'frontend', 0, 0, 0, 1, 10),
(6, 'table', '表格', 'frontend', 0, 0, 0, 1, 11),
(7, 'filter', '过滤器', 'frontend', 0, 0, 0, 1, 12);

-- 运行时配置示例（不生成代码）
INSERT INTO ab_component (id, component_code, component_name, category, is_runtime, is_inheritable, is_cacheable, store_in_oss, sort_code) VALUES
(20, 'permission_rule', '权限规则', 'server', 1, 1, 1, 0, 20),
(21, 'ui_layout', 'UI布局', 'frontend', 1, 1, 1, 1, 21),
(22, 'field_display_rule', '字段显示规则', 'frontend', 1, 1, 1, 0, 22);
```

---

### 2.5 组件配置索引表（ab_component_config）

**用途**：记录组件配置的元信息和索引，配置内容可能存储在 OSS 或数据库。

**表结构**：

```sql
CREATE TABLE ab_component_config (
  -- 主键及公共字段（继承 HasPrimaryFullEntity）
  id                BIGINT NOT NULL COMMENT '主键',
  created_at        DATETIME COMMENT '创建时间',
  creator_id        BIGINT COMMENT '创建人ID',
  creator_name      VARCHAR(50) COMMENT '创建人姓名',
  modifier_at       DATETIME COMMENT '修改时间',
  modifier_id       BIGINT COMMENT '修改人ID',
  modifier_name     VARCHAR(50) COMMENT '修改人姓名',
  is_removed        TINYINT(1) DEFAULT 0 COMMENT '逻辑删除标记',
  version           BIGINT COMMENT '乐观锁版本号',
  sort_code         INT COMMENT '排序码',
  is_enable         TINYINT(1) DEFAULT 1 COMMENT '启用状态',

  -- 业务字段
  version_id        BIGINT NOT NULL COMMENT '所属版本ID',
  component_id      BIGINT NOT NULL COMMENT '组件类型ID',
  component_code    VARCHAR(50) NOT NULL COMMENT '组件实例编码，版本内唯一，如 order_controller',
  component_name    VARCHAR(100) NOT NULL COMMENT '组件实例名称',
  layer             VARCHAR(20) NOT NULL COMMENT '配置层级：system=系统, tenant=租户',

  -- 配置内容（二选一）
  config_content    TEXT COMMENT '配置内容（存数据库时使用）',
  config_oss_key    VARCHAR(500) COMMENT '配置OSS路径（存OSS时使用）',

  -- 草稿/发布管理
  status            VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT '状态：draft=草稿, published=已发布',
  draft_oss_key     VARCHAR(500) COMMENT '草稿OSS路径',
  published_oss_key VARCHAR(500) COMMENT '已发布OSS路径',
  publish_version   INT DEFAULT 0 COMMENT '发布版本号，每次发布递增',
  published_at      DATETIME COMMENT '发布时间',

  description       VARCHAR(500) COMMENT '描述',

  PRIMARY KEY (id),
  UNIQUE KEY uk_version_component_layer (version_id, component_id, component_code, layer)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组件配置索引表';
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| version_id | BIGINT | 是 | 所属版本ID |
| component_id | BIGINT | 是 | 组件类型ID，关联 ab_component |
| component_code | VARCHAR(50) | 是 | 组件实例编码，版本内唯一 |
| component_name | VARCHAR(100) | 是 | 组件实例名称，用于展示 |
| layer | VARCHAR(20) | 是 | 配置层级：`system`=系统, `tenant`=租户 |
| config_content | TEXT | 条件 | 配置内容，当组件类型 store_in_oss=0 时使用 |
| config_oss_key | VARCHAR(500) | 条件 | 配置OSS路径，当组件类型 store_in_oss=1 时使用（已废弃，改用 draft_oss_key/published_oss_key） |
| status | VARCHAR(20) | 是 | 状态：`draft`=草稿, `published`=已发布 |
| draft_oss_key | VARCHAR(500) | 否 | 草稿OSS路径，如 `draft/module_group/module/version/component_code.json` |
| published_oss_key | VARCHAR(500) | 否 | 已发布OSS路径，如 `published/module_group/module/version/component_code.json` |
| publish_version | INT | 是 | 发布版本号，每次发布递增，初始为 0 |
| published_at | DATETIME | 否 | 最后发布时间 |
| description | VARCHAR(500) | 否 | 组件配置描述 |

**业务规则**：
- 组合唯一键：`(version_id, component_id, component_code, layer)`
  - 同一版本下，同一组件类型，同一 component_code，同一层级只能有一条配置
- 配置内容存储策略：
  - 如果 `ab_component.store_in_oss=1`，使用 `draft_oss_key`/`published_oss_key`
  - 如果 `ab_component.store_in_oss=0`，使用 `config_content`
- 发布流程：
  - 草稿状态：`status='draft'`, `draft_oss_key` 有值
  - 发布后：`status='published'`, `published_oss_key` 有值，`publish_version` 递增
- `layer` 取值：
  - `system`：系统层配置
  - `tenant`：租户层配置（仅当版本为租户版本时存在）

**OSS 路径规范**：

```
# 草稿路径
draft/{module_group_code}/{module_code}/{version_code}/{layer}/{component_code}.json

# 发布路径
published/{module_group_code}/{module_code}/{version_code}/{layer}/{component_code}.json

# 示例
draft/order-service/order/v1.0.0/system/order_controller.json
published/order-service/order/v1.0.0/system/order_controller.json
```

---

### 2.6 组件配置草稿历史表（ab_component_config_draft_history）

**用途**：记录组件配置的每次草稿保存历史，用于版本追溯和回滚。

**表结构**：

```sql
CREATE TABLE ab_component_config_draft_history (
  -- 主键及公共字段（继承 HasPrimaryFullEntity）
  id                BIGINT NOT NULL COMMENT '主键',
  created_at        DATETIME COMMENT '创建时间',
  creator_id        BIGINT COMMENT '创建人ID',
  creator_name      VARCHAR(50) COMMENT '创建人姓名',
  modifier_at       DATETIME COMMENT '修改时间',
  modifier_id       BIGINT COMMENT '修改人ID',
  modifier_name     VARCHAR(50) COMMENT '修改人姓名',
  is_removed        TINYINT(1) DEFAULT 0 COMMENT '逻辑删除标记',
  version           BIGINT COMMENT '乐观锁版本号',
  sort_code         INT COMMENT '排序码',
  is_enable         TINYINT(1) DEFAULT 1 COMMENT '启用状态',

  -- 业务字段
  config_id         BIGINT NOT NULL COMMENT '组件配置ID，关联 ab_component_config',
  draft_version     INT NOT NULL COMMENT '草稿版本号，自增',
  draft_oss_key     VARCHAR(500) NOT NULL COMMENT '草稿OSS路径',
  change_summary    VARCHAR(500) COMMENT '变更摘要',

  PRIMARY KEY (id),
  UNIQUE KEY uk_config_draft_version (config_id, draft_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组件配置草稿历史表';
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| config_id | BIGINT | 是 | 组件配置ID，关联 ab_component_config |
| draft_version | INT | 是 | 草稿版本号，从 1 开始自增 |
| draft_oss_key | VARCHAR(500) | 是 | 草稿OSS路径 |
| change_summary | VARCHAR(500) | 否 | 变更摘要，可自动生成或用户填写 |

**业务规则**：
- 组合唯一键：`(config_id, draft_version)`
- 每次保存草稿时，`draft_version` 递增
- OSS 路径包含 draft_version：
  ```
  draft/{module_group_code}/{module_code}/{version_code}/{layer}/history/{component_code}.v{draft_version}.json
  ```
- 例如：`draft/order-service/order/v1.0.0/system/history/order_controller.v1.json`

---

### 2.7 快照表（ab_snapshot）

**用途**：记录构建时的快照，锁定模块组下所有组件的配置版本。

**表结构**：

```sql
CREATE TABLE ab_snapshot (
  -- 主键及公共字段（继承 HasPrimaryFullEntity）
  id                BIGINT NOT NULL COMMENT '主键',
  created_at        DATETIME COMMENT '创建时间',
  creator_id        BIGINT COMMENT '创建人ID',
  creator_name      VARCHAR(50) COMMENT '创建人姓名',
  modifier_at       DATETIME COMMENT '修改时间',
  modifier_id       BIGINT COMMENT '修改人ID',
  modifier_name     VARCHAR(50) COMMENT '修改人姓名',
  is_removed        TINYINT(1) DEFAULT 0 COMMENT '逻辑删除标记',
  version           BIGINT COMMENT '乐观锁版本号',
  sort_code         INT COMMENT '排序码',
  is_enable         TINYINT(1) DEFAULT 1 COMMENT '启用状态',

  -- 业务字段
  module_group_id   BIGINT NOT NULL COMMENT '模块组ID',
  snapshot_code     VARCHAR(50) NOT NULL COMMENT '快照编码，如 S001, S002',
  snapshot_name     VARCHAR(100) NOT NULL COMMENT '快照名称',
  snapshot_content  TEXT NOT NULL COMMENT '快照内容，JSON格式，包含所有组件配置清单',
  build_status      VARCHAR(20) DEFAULT 'pending' COMMENT '构建状态：pending=待构建, building=构建中, success=成功, failed=失败',
  build_log         TEXT COMMENT '构建日志',
  description       VARCHAR(500) COMMENT '描述',

  PRIMARY KEY (id),
  UNIQUE KEY uk_module_group_snapshot (module_group_id, snapshot_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='快照管理表';
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| module_group_id | BIGINT | 是 | 模块组ID |
| snapshot_code | VARCHAR(50) | 是 | 快照编码，模块组内唯一，如 `S001`, `S002` |
| snapshot_name | VARCHAR(100) | 是 | 快照名称，用于展示 |
| snapshot_content | TEXT | 是 | 快照内容，JSON格式 |
| build_status | VARCHAR(20) | 是 | 构建状态：`pending`, `building`, `success`, `failed` |
| build_log | TEXT | 否 | 构建日志 |
| description | VARCHAR(500) | 否 | 快照描述 |

**业务规则**：
- 组合唯一键：`(module_group_id, snapshot_code)`
- 快照在构建触发时生成
- `snapshot_content` 包含完整的配置清单（JSON格式）

**快照内容格式**（snapshot_content）：

```json
{
  "snapshot_id": "S002",
  "module_group": "order-service",
  "modules": [
    {
      "module_code": "order",
      "version": "v1.0.0",
      "components": [
        {
          "component_type": "controller",
          "component_code": "order_controller",
          "publish_version": 6,
          "layer": "system",
          "config_oss_key": "published/order-service/order/v1.0.0/system/order_controller.json"
        },
        {
          "component_type": "service",
          "component_code": "order_service",
          "publish_version": 3,
          "layer": "system",
          "config_oss_key": "published/order-service/order/v1.0.0/system/order_service.json"
        }
      ]
    }
  ]
}
```

---

### 2.8 配置发布历史表（ab_config_history）

**用途**：记录组件配置的发布历史，用于追溯和审计。

**表结构**：

```sql
CREATE TABLE ab_config_history (
  -- 主键及公共字段（继承 HasPrimaryFullEntity）
  id                BIGINT NOT NULL COMMENT '主键',
  created_at        DATETIME COMMENT '创建时间',
  creator_id        BIGINT COMMENT '创建人ID',
  creator_name      VARCHAR(50) COMMENT '创建人姓名',
  modifier_at       DATETIME COMMENT '修改时间',
  modifier_id       BIGINT COMMENT '修改人ID',
  modifier_name     VARCHAR(50) COMMENT '修改人姓名',
  is_removed        TINYINT(1) DEFAULT 0 COMMENT '逻辑删除标记',
  version           BIGINT COMMENT '乐观锁版本号',
  sort_code         INT COMMENT '排序码',
  is_enable         TINYINT(1) DEFAULT 1 COMMENT '启用状态',

  -- 业务字段
  config_id         BIGINT NOT NULL COMMENT '组件配置ID，关联 ab_component_config',
  publish_version   INT NOT NULL COMMENT '发布版本号',
  published_oss_key VARCHAR(500) NOT NULL COMMENT '发布时的OSS路径',
  change_summary    VARCHAR(500) COMMENT '变更摘要',

  PRIMARY KEY (id),
  UNIQUE KEY uk_config_publish_version (config_id, publish_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配置发布历史表';
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| config_id | BIGINT | 是 | 组件配置ID，关联 ab_component_config |
| publish_version | INT | 是 | 发布版本号，对应 ab_component_config.publish_version |
| published_oss_key | VARCHAR(500) | 是 | 发布时的OSS路径 |
| change_summary | VARCHAR(500) | 否 | 变更摘要 |

**业务规则**：
- 组合唯一键：`(config_id, publish_version)`
- 每次发布时创建一条记录
- `publish_version` 对应 `ab_component_config.publish_version`

---

### 2.9 流水线定义表（ab_pipeline）

**用途**：定义系统支持的流水线类型（前端、后端、全栈等）。

**表结构**：

```sql
CREATE TABLE ab_pipeline (
  -- 主键及公共字段（继承 HasPrimaryFullEntity）
  id                BIGINT NOT NULL COMMENT '主键',
  created_at        DATETIME COMMENT '创建时间',
  creator_id        BIGINT COMMENT '创建人ID',
  creator_name      VARCHAR(50) COMMENT '创建人姓名',
  modifier_at       DATETIME COMMENT '修改时间',
  modifier_id       BIGINT COMMENT '修改人ID',
  modifier_name     VARCHAR(50) COMMENT '修改人姓名',
  is_removed        TINYINT(1) DEFAULT 0 COMMENT '逻辑删除标记',
  version           BIGINT COMMENT '乐观锁版本号',
  sort_code         INT COMMENT '排序码',
  is_enable         TINYINT(1) DEFAULT 1 COMMENT '启用状态',

  -- 业务字段
  pipeline_code     VARCHAR(50) NOT NULL COMMENT '流水线编码，如 standard_frontend',
  pipeline_name     VARCHAR(100) NOT NULL COMMENT '流水线名称，如 标准前端流水线',
  pipeline_type     VARCHAR(20) NOT NULL COMMENT '流水线类型：frontend=前端, backend=后端, fullstack=全栈',
  template_code     VARCHAR(50) COMMENT '流水线模板编码，为空表示自定义流水线',
  config_content    TEXT COMMENT '流水线配置内容（JSON格式）',
  description       VARCHAR(500) COMMENT '描述',

  PRIMARY KEY (id),
  UNIQUE KEY uk_pipeline_code (pipeline_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='流水线定义表';
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| pipeline_code | VARCHAR(50) | 是 | 流水线编码，全局唯一，如 `standard_frontend` |
| pipeline_name | VARCHAR(100) | 是 | 流水线名称，用于展示 |
| pipeline_type | VARCHAR(20) | 是 | 流水线类型：`frontend`=前端, `backend`=后端, `fullstack`=全栈 |
| template_code | VARCHAR(50) | 否 | 流水线模板编码，为空表示自定义流水线 |
| config_content | TEXT | 否 | 流水线配置内容，JSON格式，包含构建步骤、Docker镜像等 |
| description | VARCHAR(500) | 否 | 流水线描述 |

**业务规则**：
- `pipeline_code` 全局唯一
- `pipeline_type` 取值：`frontend`, `backend`, `fullstack`
- `template_code` 用于标识流水线模板：
  - 不为空：表示该流水线基于指定模板创建
  - 为空：表示该流水线是自定义配置
- `config_content` 存储流水线配置（JSON格式）：
  - 包含构建工具、Docker镜像、构建步骤、部署目标等信息
  - 配置量较小（通常 1-10 KB），存储在数据库更高效

**示例数据**：

```sql
-- 基于模板的流水线
INSERT INTO ab_pipeline (id, pipeline_code, pipeline_name, pipeline_type, template_code, config_content, sort_code) VALUES
(1, 'standard_frontend', '标准前端流水线', 'frontend', 'react_vite', '{"buildTool":"vite","nodeVersion":"18.x","dockerImage":"node:18-alpine","buildSteps":["npm install","npm run build"]}', 1),
(2, 'standard_backend', '标准后端流水线', 'backend', 'nestjs', '{"buildTool":"npm","nodeVersion":"18.x","dockerImage":"node:18-alpine","buildSteps":["npm install","npm run build"]}', 2);

-- 自定义流水线（template_code 为空）
INSERT INTO ab_pipeline (id, pipeline_code, pipeline_name, pipeline_type, template_code, config_content, sort_code) VALUES
(3, 'custom_fullstack', '自定义全栈流水线', 'fullstack', NULL, '{"buildTool":"pnpm","nodeVersion":"20.x","dockerImage":"node:20-alpine","buildSteps":["pnpm install","pnpm build:all"]}', 3);
```

---

### 2.10 模块组流水线关联表（ab_module_group_pipeline）

**用途**：记录模块组与流水线的关联关系，支持一个模块组绑定多个流水线。

**表结构**：

```sql
CREATE TABLE ab_module_group_pipeline (
  -- 主键及公共字段（继承 HasPrimaryFullEntity）
  id                BIGINT NOT NULL COMMENT '主键',
  created_at        DATETIME COMMENT '创建时间',
  creator_id        BIGINT COMMENT '创建人ID',
  creator_name      VARCHAR(50) COMMENT '创建人姓名',
  modifier_at       DATETIME COMMENT '修改时间',
  modifier_id       BIGINT COMMENT '修改人ID',
  modifier_name     VARCHAR(50) COMMENT '修改人姓名',
  is_removed        TINYINT(1) DEFAULT 0 COMMENT '逻辑删除标记',
  version           BIGINT COMMENT '乐观锁版本号',
  sort_code         INT COMMENT '排序码',
  is_enable         TINYINT(1) DEFAULT 1 COMMENT '启用状态',

  -- 业务字段
  module_group_id   BIGINT NOT NULL COMMENT '模块组ID',
  pipeline_id       BIGINT NOT NULL COMMENT '流水线ID',
  pipeline_type     VARCHAR(20) NOT NULL COMMENT '流水线类型：frontend=前端, backend=后端, fullstack=全栈',

  PRIMARY KEY (id),
  UNIQUE KEY uk_group_pipeline (module_group_id, pipeline_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模块组流水线关联表';
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| module_group_id | BIGINT | 是 | 模块组ID |
| pipeline_id | BIGINT | 是 | 流水线ID |
| pipeline_type | VARCHAR(20) | 是 | 流水线类型，冗余字段，便于查询 |

**业务规则**：
- 组合唯一键：`(module_group_id, pipeline_type)`
  - 一个模块组的每种流水线类型只能绑定一个流水线
  - 例如：一个模块组只能有一个前端流水线，但可以同时有前端和后端流水线
- 流水线不支持租户定制，只有系统层配置
- 删除模块组时，级联删除关联关系
- 删除流水线前，检查是否有模块组使用

**使用场景示例**：

```sql
-- 全栈模块组（前端 + 后端）
INSERT INTO ab_module_group_pipeline (module_group_id, pipeline_id, pipeline_type) VALUES
(1, 1, 'frontend'),  -- 订单服务使用标准前端流水线
(1, 2, 'backend');   -- 订单服务使用标准后端流水线

-- 纯后端模块组
INSERT INTO ab_module_group_pipeline (module_group_id, pipeline_id, pipeline_type) VALUES
(2, 2, 'backend');   -- 库存服务只使用标准后端流水线
```

---

## 三、表关系图

```
ab_module_group (模块组)
    │
    ├──< ab_module (模块)
    │       │
    │       └──< ab_version (版本)
    │               │
    │               └──< ab_component_config (组件配置)
    │                       │
    │                       ├──< ab_component_config_draft_history (草稿历史)
    │                       └──< ab_config_history (发布历史)
    │
    ├──< ab_snapshot (快照)
    │
    └──< ab_module_group_pipeline (模块组流水线关联)
            │
            └──> ab_pipeline (流水线定义)

ab_component (组件类型) ──────> ab_component_config
```

**关系说明**：

| 父表 | 子表 | 关系 | 说明 |
|-----|------|------|------|
| ab_module_group | ab_module | 1:N | 一个模块组包含多个模块 |
| ab_module | ab_version | 1:N | 一个模块包含多个版本 |
| ab_version | ab_component_config | 1:N | 一个版本包含多个组件配置 |
| ab_component | ab_component_config | 1:N | 一个组件类型可创建多个配置实例 |
| ab_component_config | ab_component_config_draft_history | 1:N | 一个配置有多个草稿历史 |
| ab_component_config | ab_config_history | 1:N | 一个配置有多个发布历史 |
| ab_module_group | ab_snapshot | 1:N | 一个模块组有多个快照 |
| ab_module_group | ab_module_group_pipeline | 1:N | 一个模块组可绑定多个流水线 |
| ab_pipeline | ab_module_group_pipeline | 1:N | 一个流水线可被多个模块组使用 |

---

## 四、索引建议

初始阶段不创建索引（除主键和唯一键外），根据实际查询需求逐步添加。

**可能需要的索引**（待性能测试后决定）：

```sql
-- ab_module
ALTER TABLE ab_module ADD INDEX idx_module_group_id (module_group_id);

-- ab_version
ALTER TABLE ab_version ADD INDEX idx_module_id (module_id);
ALTER TABLE ab_version ADD INDEX idx_tenant_id (tenant_id);

-- ab_component_config
ALTER TABLE ab_component_config ADD INDEX idx_version_id (version_id);
ALTER TABLE ab_component_config ADD INDEX idx_component_id (component_id);
ALTER TABLE ab_component_config ADD INDEX idx_status (status);

-- ab_component_config_draft_history
ALTER TABLE ab_component_config_draft_history ADD INDEX idx_config_id (config_id);

-- ab_config_history
ALTER TABLE ab_config_history ADD INDEX idx_config_id (config_id);

-- ab_snapshot
ALTER TABLE ab_snapshot ADD INDEX idx_module_group_id (module_group_id);
ALTER TABLE ab_snapshot ADD INDEX idx_build_status (build_status);

-- ab_module_group_pipeline
ALTER TABLE ab_module_group_pipeline ADD INDEX idx_module_group_id (module_group_id);
ALTER TABLE ab_module_group_pipeline ADD INDEX idx_pipeline_id (pipeline_id);
```

---

## 五、数据完整性约束

### 5.1 应用层约束

由于不使用数据库外键，需要在应用层保证数据一致性：

1. **删除检查**：
   - 删除模块组前，检查是否有关联模块
   - 删除模块前，检查是否有关联版本
   - 删除版本前，检查是否有关联组件配置
   - 删除组件配置前，检查是否在快照中被引用

2. **状态一致性**：
   - 组件配置发布时，更新 `status`、`publish_version`、`published_at`
   - 创建快照时，锁定所有组件的 `publish_version`

3. **租户隔离**：
   - 租户版本的 `tenant_id` 必填
   - 租户层配置只能属于租户版本

### 5.2 业务规则校验

1. **版本管理**：
   - 系统版本：`version_type='system'`, `tenant_id` 为空
   - 租户版本：`version_type='tenant'`, `tenant_id` 必填

2. **配置层级**：
   - 系统版本只能有 `layer='system'` 的配置
   - 租户版本可以有 `layer='system'` 和 `layer='tenant'` 的配置

3. **发布流程**：
   - 只有 `status='draft'` 的配置可以发布
   - 发布后 `publish_version` 递增

---

## 六、Entity 类定义示例

### 6.1 模块组 Entity

```typescript
import { Entity, Column } from 'typeorm';
import { HasPrimaryFullEntity } from '@lib/nest-typeorm';

@Entity('ab_module_group')
export class ModuleGroupEntity extends HasPrimaryFullEntity {
  @Column({
    name: 'module_group_code',
    type: 'varchar',
    length: 50,
    comment: '模块组编码',
  })
  moduleGroupCode: string;

  @Column({
    name: 'module_group_name',
    type: 'varchar',
    length: 100,
    comment: '模块组名称',
  })
  moduleGroupName: string;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '描述',
  })
  description: string;
}
```

### 6.2 组件类型 Entity

```typescript
import { Entity, Column } from 'typeorm';
import { HasPrimaryFullEntity } from '@lib/nest-typeorm';

@Entity('ab_component')
export class ComponentEntity extends HasPrimaryFullEntity {
  @Column({
    name: 'component_code',
    type: 'varchar',
    length: 50,
    comment: '组件类型编码',
  })
  componentCode: string;

  @Column({
    name: 'component_name',
    type: 'varchar',
    length: 100,
    comment: '组件类型名称',
  })
  componentName: string;

  @Column({
    name: 'category',
    type: 'varchar',
    length: 20,
    comment: '组件分类',
  })
  category: string;

  @Column({
    name: 'is_runtime',
    type: 'tinyint',
    default: 0,
    comment: '是否运行时配置',
  })
  isRuntime: boolean;

  @Column({
    name: 'is_inheritable',
    type: 'tinyint',
    default: 1,
    comment: '是否支持继承',
  })
  isInheritable: boolean;

  @Column({
    name: 'is_cacheable',
    type: 'tinyint',
    default: 0,
    comment: '是否可缓存',
  })
  isCacheable: boolean;

  @Column({
    name: 'config_schema',
    type: 'text',
    nullable: true,
    comment: '组件配置Schema',
  })
  configSchema: string;

  @Column({
    name: 'store_in_oss',
    type: 'tinyint',
    default: 0,
    comment: '是否存储到OSS',
  })
  storeInOss: boolean;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '描述',
  })
  description: string;
}
```

### 6.3 组件配置 Entity

```typescript
import { Entity, Column } from 'typeorm';
import { HasPrimaryFullEntity } from '@lib/nest-typeorm';

@Entity('ab_component_config')
export class ComponentConfigEntity extends HasPrimaryFullEntity {
  @Column({
    name: 'version_id',
    type: 'bigint',
    comment: '所属版本ID',
  })
  versionId: string;

  @Column({
    name: 'component_id',
    type: 'bigint',
    comment: '组件类型ID',
  })
  componentId: string;

  @Column({
    name: 'component_code',
    type: 'varchar',
    length: 50,
    comment: '组件实例编码',
  })
  componentCode: string;

  @Column({
    name: 'component_name',
    type: 'varchar',
    length: 100,
    comment: '组件实例名称',
  })
  componentName: string;

  @Column({
    name: 'layer',
    type: 'varchar',
    length: 20,
    comment: '配置层级',
  })
  layer: string;

  @Column({
    name: 'config_content',
    type: 'text',
    nullable: true,
    comment: '配置内容',
  })
  configContent: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'draft',
    comment: '状态',
  })
  status: string;

  @Column({
    name: 'draft_oss_key',
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '草稿OSS路径',
  })
  draftOssKey: string;

  @Column({
    name: 'published_oss_key',
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '已发布OSS路径',
  })
  publishedOssKey: string;

  @Column({
    name: 'publish_version',
    type: 'int',
    default: 0,
    comment: '发布版本号',
  })
  publishVersion: number;

  @Column({
    name: 'published_at',
    type: 'datetime',
    nullable: true,
    comment: '发布时间',
  })
  publishedAt: Date;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '描述',
  })
  description: string;
}
```

### 6.4 流水线 Entity

```typescript
import { Entity, Column } from 'typeorm';
import { HasPrimaryFullEntity } from '@lib/nest-typeorm';

@Entity('ab_pipeline')
export class PipelineEntity extends HasPrimaryFullEntity {
  @Column({
    name: 'pipeline_code',
    type: 'varchar',
    length: 50,
    comment: '流水线编码',
  })
  pipelineCode: string;

  @Column({
    name: 'pipeline_name',
    type: 'varchar',
    length: 100,
    comment: '流水线名称',
  })
  pipelineName: string;

  @Column({
    name: 'pipeline_type',
    type: 'varchar',
    length: 20,
    comment: '流水线类型',
  })
  pipelineType: string;

  @Column({
    name: 'template_code',
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '流水线模板编码',
  })
  templateCode: string;

  @Column({
    name: 'config_content',
    type: 'text',
    nullable: true,
    comment: '流水线配置内容',
  })
  configContent: string;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '描述',
  })
  description: string;
}
```

### 6.5 模块组流水线关联 Entity

```typescript
import { Entity, Column } from 'typeorm';
import { HasPrimaryFullEntity } from '@lib/nest-typeorm';

@Entity('ab_module_group_pipeline')
export class ModuleGroupPipelineEntity extends HasPrimaryFullEntity {
  @Column({
    name: 'module_group_id',
    type: 'bigint',
    comment: '模块组ID',
  })
  moduleGroupId: string;

  @Column({
    name: 'pipeline_id',
    type: 'bigint',
    comment: '流水线ID',
  })
  pipelineId: string;

  @Column({
    name: 'pipeline_type',
    type: 'varchar',
    length: 20,
    comment: '流水线类型',
  })
  pipelineType: string;
}
```

---

## 七、总结

本文档定义了元数据存储的 10 个核心表：

1. **ab_module_group**：模块组定义（微服务/构建单元）
2. **ab_module**：模块定义（逻辑分组）
3. **ab_version**：版本管理（系统版本 + 租户版本）
4. **ab_component**：组件类型注册（Controller, Service, Entity 等）
5. **ab_component_config**：组件配置索引（元信息 + OSS路径）
6. **ab_component_config_draft_history**：草稿历史（版本追溯）
7. **ab_snapshot**：快照管理（构建时配置锁定）
8. **ab_config_history**：发布历史（审计追溯）
9. **ab_pipeline**：流水线定义（前端/后端/全栈流水线）
10. **ab_module_group_pipeline**：模块组流水线关联（支持多流水线）

**关键设计特点**：

- 所有表继承 `HasPrimaryFullEntity`，包含完整的审计字段和启用/排序字段
- 不使用数据库外键，通过应用层保证数据一致性
- 配置内容存储灵活：支持数据库存储或 OSS 存储
- 草稿与发布分离：支持增量发布和版本追溯
- 支持系统版本和租户版本独立管理
- 快照机制锁定构建时的配置状态
- 流水线与模块组解耦：支持流水线复用和多流水线绑定
- 组件类型支持三种标识：
  - `is_runtime`：区分构建配置（生成代码）和运行时配置（不生成代码）
  - `is_inheritable`：控制配置继承规则（支持或不支持租户覆盖）
  - `is_cacheable`：控制运行时缓存策略（提升性能）

**下一步**：
- 配置内容存储详细设计（OSS 存储策略）
- 版本管理存储详细设计（Git 版本控制）
