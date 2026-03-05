# 服务层代码生成核心包设计

> 版本：v1.0
> 日期：2026-02-27
> 状态：设计阶段

---

## 一、设计概述

### 1.1 定位

服务层代码生成核心包（`libs/code-generator`）是面向**服务端**的代码生成引擎，基于 NestJS 生态，将元数据配置（JSON）转换为结构清晰、可直接运行的 TypeScript 代码。

当前已有 MVP 实现，本文档基于 MVP 现状对设计规范进行系统梳理，指导后续迭代。

### 1.2 设计目标

| 目标 | 说明 |
|-----|------|
| **配置驱动** | 业务逻辑通过 JSON 配置描述，无需手写代码 |
| **NestJS 原生** | 生成代码完全符合 NestJS 规范，与现有项目无缝集成 |
| **逐步迭代** | 从 MVP 基础能力出发，按需扩展，不过度设计 |
| **可调试** | 支持 CLI 模式独立运行，便于本地测试生成结果 |

### 1.3 当前 MVP 能力

**已实现（生成产物）**：

| 生成产物 | 状态 | 说明 |
|---------|-----|------|
| TypeORM Entity | ✅ | 支持继承基类 `HasPrimaryFullEntity` 或裸实体，复合主键，多数据源注册 |
| NestJS Service（默认 CRUD） | ✅ | create/findAll/findMany/findOne/update/remove/count，7 个方法 |
| NestJS Service（自定义方法） | ✅ | 16 种步骤类型，支持 condition/call/transaction 等复杂逻辑 |
| RESTful Controller | ✅ | 含 Swagger 注解，支持单/复合主键路由，统一 findAll + findMany 逻辑 |
| DTO（Create/Update/Query） | ✅ | class-validator + Swagger 装饰器，含复合主键 DTO |
| NestJS Module | ✅ | 自动整合所有实体，支持多数据源 `EntityRegistModule` |
| 单元测试文件（*.spec.ts） | 🔲 | 规划中 |
| RPC Handler | 🔲 | 规划中 |

**已实现（能力特性）**：

| 特性 | 状态 | 说明 |
|-----|-----|------|
| 双格式字段类型 | ✅ | `fieldType` 同时支持语义类型（`string`）和 SQL 别名（`varchar`） |
| 显式列名 | ✅ | `columnName` 字段；省略时回退到 `fieldCode` |
| 平台基类继承 | ✅ | `useBaseEntity` 控制是否继承 `HasPrimaryFullEntity`，自动跳过重叠字段 |
| 外部服务注入 | ✅ | `dependencies` 配置，自动生成构造函数注入 |
| condition 步骤 | ✅ | 结构化 if/else if/else，支持 11 种 JS 比较运算符，支持嵌套 |
| call 步骤 | ✅ | 调用自身方法或注入的外部服务，支持 await/result 捕获 |
| 表达式解析器 | ✅ | `literal`/`expr` 两种格式，支持 `${ctx:xxx}` / `${fn:xxx}` 等命名空间插值 |

---

## 二、核心配置规范

### 2.1 配置层级

```
ModuleConfig（模块级配置）
  └── EntityConfig[]（实体级配置）
        ├── FieldConfig[]（字段配置）
        ├── ServiceMethodConfig[]（自定义 Service 方法，可选）
        └── ServiceDependency[]（依赖注入，可选）
```

### 2.2 标准 Entity 配置示例

```json
{
  "moduleCode": "order",
  "moduleName": "订单模块",
  "connectionName": "trade",
  "entities": [
    {
      "entityCode": "order_main",
      "entityName": "订单主表",
      "tableName": "t_order",
      "apiPrefix": "order",
      "generateController": true,
      "generateService": true,
      "fields": [
        {
          "fieldCode": "order_id",
          "fieldName": "订单ID",
          "fieldType": "bigint",
          "primaryKey": true,
          "required": true
        },
        {
          "fieldCode": "order_no",
          "fieldName": "订单号",
          "fieldType": "string",
          "length": 32,
          "required": true
        },
        {
          "fieldCode": "tenant_id",
          "fieldName": "租户ID",
          "fieldType": "bigint",
          "required": true
        },
        {
          "fieldCode": "status",
          "fieldName": "状态 0-待支付 1-已支付 2-已关闭",
          "fieldType": "int",
          "required": true,
          "defaultValue": 0
        },
        {
          "fieldCode": "total_amount",
          "fieldName": "订单总金额",
          "fieldType": "decimal",
          "precision": 12,
          "scale": 2,
          "required": true
        },
        {
          "fieldCode": "remark",
          "fieldName": "备注",
          "fieldType": "text",
          "nullable": true
        },
        {
          "fieldCode": "created_at",
          "fieldName": "创建时间",
          "fieldType": "datetime",
          "required": true
        }
      ]
    }
  ]
}
```

### 2.3 自定义 Service 方法配置示例

```json
{
  "entityCode": "order_main",
  "entityName": "订单主表",
  "tableName": "t_order",
  "fields": [...],
  "dependencies": [
    {
      "service": "PaymentService",
      "property": "paymentService",
      "module": "../payment/payment.service"
    }
  ],
  "serviceMethods": [
    {
      "methodName": "submitOrder",
      "description": "提交并支付订单",
      "async": true,
      "parameters": [
        { "name": "orderId", "type": "string" },
        { "name": "dto", "type": "SubmitOrderDto" }
      ],
      "returnType": "OrderMain",
      "steps": [
        {
          "type": "queryOne",
          "comment": "查询订单",
          "config": {
            "result": "order",
            "where": [
              { "field": "orderId", "operator": "eq", "value": { "expr": "orderId" } }
            ],
            "notFoundBehavior": "throw",
            "notFoundMessage": "订单不存在"
          }
        },
        {
          "type": "validate",
          "comment": "校验订单状态",
          "config": {
            "rules": [
              {
                "condition": { "expr": "order.status === 0" },
                "message": "订单状态不允许支付",
                "exceptionType": "BadRequest"
              }
            ]
          }
        },
        {
          "type": "transaction",
          "comment": "事务：更新订单状态 + 创建支付记录",
          "config": {
            "steps": [
              {
                "type": "update",
                "config": {
                  "where": [
                    { "field": "orderId", "operator": "eq", "value": { "expr": "orderId" } }
                  ],
                  "data": {
                    "type": "build",
                    "fields": [
                      { "field": "status", "value": { "literal": 1 } }
                    ]
                  }
                }
              }
            ],
            "onError": { "throw": true }
          }
        },
        {
          "type": "queryOne",
          "comment": "重新查询并返回最新状态",
          "config": {
            "result": "updatedOrder",
            "where": [
              { "field": "orderId", "operator": "eq", "value": { "expr": "orderId" } }
            ]
          }
        },
        {
          "type": "return",
          "config": { "value": { "expr": "updatedOrder" } }
        }
      ]
    }
  ]
}
```

---

## 三、生成器设计规范

### 3.1 生成器接口规范

所有生成器遵循统一接口：

```typescript
interface IGenerator<TConfig> {
  /**
   * 生成代码
   * @param config 配置输入
   * @param options 可选参数
   * @returns 生成的代码字符串
   */
  generate(config: TConfig, options?: GeneratorOptions): string;
}

interface GeneratorOptions {
  connectionName?: string;  // 数据库连接名
  [key: string]: any;       // 扩展选项
}
```

### 3.2 代码质量规范

生成器产出的代码需满足：

| 规范 | 要求 |
|-----|------|
| TypeScript 严格模式 | 生成代码通过 `tsc --strict --noEmit` |
| 格式规范 | 缩进 2 空格，与项目统一 |
| 注释规范 | 类/方法级 JSDoc 注释，字段含描述 |
| 导入规范 | 按来源分组（@nestjs、typeorm、@cs/...、相对路径） |
| 命名规范 | 类名 PascalCase，变量/方法 camelCase，常量 UPPER_CASE |

### 3.3 ts-morph 使用规范

生成器统一使用 `ts-morph` 操作 TypeScript AST：

```typescript
// 正确：使用 ts-morph API 生成 AST，保证格式正确
const entityClass = sourceFile.addClass({
  name: 'OrderMain',
  isExported: true,
  decorators: [{ name: 'Entity', arguments: ["'t_order'"] }]
});

// 避免：直接拼接字符串（难以维护，格式不可控）
// const code = `export class OrderMain { ... }`;
```

---

## 四、字段类型系统

### 4.1 类型映射

```
配置 fieldType → TypeScript 类型 → 数据库类型 → TypeORM Column type

string   → string  → varchar  → varchar
int      → number  → int      → int
bigint   → string  → bigint   → bigint   （JS 不能精确表示 BigInt，用 string）
decimal  → number  → decimal  → decimal
boolean  → number  → tinyint  → tinyint  （用 0/1 表示）
date     → Date    → date     → date
datetime → Date    → datetime → datetime
text     → string  → text     → text
json     → any     → json     → json
```

### 4.2 主键策略

| 场景 | 配置 | 生成装饰器 |
|-----|------|---------|
| 单主键 | 一个字段 `primaryKey: true` | `@PrimaryColumn` |
| 复合主键 | 多个字段 `primaryKey: true` | 多个 `@PrimaryColumn` |

> 注：当前不使用 `@PrimaryGeneratedColumn`，主键值由业务层生成（雪花 ID 等）

---

## 五、逻辑步骤系统

### 5.1 步骤类型规范

**数据查询类**：

| 步骤 | 生成代码模式 | 配置字段 |
|-----|------------|---------|
| `query` | `const {result} = await repo.find({where, order, skip, take})` | result, where, orderBy, pagination |
| `queryOne` | `const {result} = await repo.findOne({where})` | result, where, notFoundBehavior |
| `count` | `const {result} = await repo.count({where})` | result, where |
| `exists` | `const {result} = await repo.exists({where})` | result, where |

**数据写入类**：

| 步骤 | 生成代码模式 | 配置字段 |
|-----|------------|---------|
| `save` | `const entity = repo.create(dto); await repo.save(entity)` | data(type: param/build), result |
| `update` | `await repo.update(where, data)` | where, data |
| `delete` | `await repo.delete(where)` | where |

**控制流类**：

| 步骤 | 生成代码模式 | 配置字段 |
|-----|------------|---------|
| `declare` | `let/const {name}: {type} = {initialValue}` | name, type, initialValue, const |
| `assign` | `{target} = {value}` | target, value |
| `validate` | `if(!(cond)) { throw new XXX(msg) }` | rules[{condition, message, exceptionType}] |
| `transaction` | `try { ... commit } catch { rollback } finally { release }` | steps, onError |
| `return` | `return {value}` | value |
| `throw` | `throw new {exceptionType}({message})` | exceptionType, message |
| `log` | `this.logger.{level}({message})` | level, message |

### 5.2 Where 条件规范

```typescript
interface WhereCondition {
  field: string;      // 字段名（camelCase）
  operator: Operator; // 操作符
  value: Expression;  // 值（literal 或 expr）
  logic?: 'and' | 'or'; // 逻辑关系（默认 and）
}

type Operator =
  | 'eq'        // field = value
  | 'ne'        // field != value (Not)
  | 'gt'        // field > value (MoreThan)
  | 'gte'       // field >= value (MoreThanOrEqual)
  | 'lt'        // field < value (LessThan)
  | 'lte'       // field <= value (LessThanOrEqual)
  | 'like'      // field LIKE %value%
  | 'in'        // field IN (values)
  | 'notIn'     // field NOT IN (values)
  | 'isNull'    // field IS NULL
  | 'isNotNull'; // field IS NOT NULL
```

### 5.3 表达式规范

```typescript
interface Expression {
  literal?: any;   // 字面量（string/number/boolean/null）
  expr?: string;   // 表达式字符串（直接作为 TS 代码插入）
}

// 使用示例
{ "literal": "pending" }     → 'pending'
{ "literal": 0 }             → 0
{ "literal": null }          → null
{ "expr": "dto.orderId" }    → dto.orderId
{ "expr": "new Date()" }     → new Date()
```

---

## 六、异常类型规范

```typescript
type ExceptionType =
  | 'NotFound'      → NotFoundException（404）
  | 'BadRequest'    → BadRequestException（400）
  | 'Conflict'      → ConflictException（409）
  | 'Forbidden'     → ForbiddenException（403）
  // 默认：BadRequestException
```

---

## 七、与构建流程的集成

### 7.1 调用方式

```typescript
// 构建服务调用（程序化）
import { CodeGenerator } from '@assembox/code-generator';

const generator = new CodeGenerator();
await generator.generate(moduleConfig, outputDir);
```

### 7.2 CLI 调用方式（本地调试）

```bash
npx assembox-codegen \
  --config ./configs/order.json \
  --output ./output/order-service/src/modules/order
```

### 7.3 配置来源转换（存储层 → 生成器）

```
存储层组件配置（OSS JSON）→ ModuleConfig 转换规则：

组件 type="entity"     → EntityConfig 的 entityCode/entityName/tableName/fields
组件 type="service"    → EntityConfig 的 serviceMethods（可选，无则用默认 CRUD）
组件 type="controller" → EntityConfig 的 apiPrefix/generateController

同一 moduleCode 下的多个组件合并为一个 EntityConfig
```

---

## 八、迭代计划

### 8.1 近期（高优先级）

| 功能 | 说明 |
|-----|------|
| 分页支持 | findMany 支持 page/pageSize 参数，Controller 统一分页格式 |
| 软删除 | 实体支持 deleted_at 字段，findOne/findMany 自动过滤已删除 |
| 公共字段 | created_at/updated_at/created_by/updated_by 字段配置化注入 |
| 单元测试生成 | 生成 *.spec.ts，mock repository，测试 CRUD 方法 |

### 8.2 中期

| 功能 | 说明 |
|-----|------|
| RPC Handler 生成 | 生成 RPC 接口处理器，接入云阙 RPC 框架 |
| 复杂查询支持 | findMany 支持 OR 条件组合、关联查询 |
| 关联关系 | @ManyToOne / @OneToMany 装饰器生成 |
| 数据库迁移 | 根据实体变化生成 TypeORM Migration 脚本 |

### 8.3 原则

- **在当前 MVP 基础上逐步迭代**，不推倒重来
- **保持向后兼容**，新特性通过可选配置开启
- **NestJS 生态优先**，与云阙平台现有框架保持一致

---

## 九、文档导航

| 文档 | 内容 |
|-----|------|
| [code-generation.md](code-generation.md) | 代码生成核心包详细设计（配置结构、生成器、步骤系统） |
