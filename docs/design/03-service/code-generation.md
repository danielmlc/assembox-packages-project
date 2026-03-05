# 代码生成设计（服务层）

> 版本：v1.0
> 日期：2026-02-27
> 状态：设计阶段

---

## 一、概述

### 1.1 定位

服务层代码生成器（`libs/code-generator`）是构建发布层的核心能力之一，负责将**服务层组件配置**转换为**可运行的 NestJS 模块代码**。

当前已实现 MVP 版本，后续在此基础上持续迭代扩展。

### 1.2 生成目标

基于 NestJS 生态，生成完整的 NestJS 模块代码：

| 生成产物 | 说明 |
|---------|------|
| `*.entity.ts` | TypeORM 实体，对应数据库表结构 |
| `*.service.ts` | 业务逻辑服务，支持自定义方法配置 |
| `*.controller.ts` | HTTP 接口控制器，生成 RESTful API |
| `*.dto.ts` | 数据传输对象（Create/Update/Query DTO） |
| `*.module.ts` | NestJS 模块定义文件，组装上述所有组件 |

### 1.3 迭代路径

```
MVP（当前）:
  EntityConfig → Entity + Service + Controller + DTO + Module

迭代一（计划）:
  + 测试文件生成（*.spec.ts）
  + RPC 接口生成（*.rpc-handler.ts）

迭代二（计划）:
  + 事件处理器生成（*.event-handler.ts）
  + 数据迁移脚本生成（*.migration.ts）
```

---

## 二、配置结构设计

### 2.1 模块配置（ModuleConfig）

```typescript
/**
 * 模块配置 - 代码生成的顶层输入
 */
interface ModuleConfig {
  moduleCode: string;       // 模块代码，如 "order"
  moduleName: string;       // 模块名称，如 "订单模块"
  connectionName?: string;  // 数据库连接名（多数据源场景）
  entities: EntityConfig[]; // 实体配置列表
}
```

### 2.2 实体配置（EntityConfig）

```typescript
interface EntityConfig {
  entityCode: string;            // 实体代码，如 "order_main"
  entityName: string;            // 实体名称，如 "订单主表"
  tableName: string;             // 数据库表名，如 "t_order"
  fields: FieldConfig[];         // 字段列表
  generateController?: boolean;  // 是否生成 Controller（默认 true）
  generateService?: boolean;     // 是否生成 Service（默认 true）
  apiPrefix?: string;            // API 路由前缀，如 "/order"
  serviceMethods?: ServiceMethodConfig[];  // 自定义 Service 方法（可选）
  dependencies?: ServiceDependency[];      // 注入的外部服务依赖（可选）
  useBaseEntity?: boolean;       // 是否继承平台基类（默认 true，见下方说明）
}
```

**useBaseEntity 说明**：

| 值 | 行为 |
|----|------|
| `true`（默认） | 继承 `HasPrimaryFullEntity`，自动获得 11 个平台字段，配置中重复的字段静默跳过 |
| `false` | 生成裸实体，需自定义主键字段（适用于纯关联表）；无主键字段时生成器抛出校验错误 |

`HasPrimaryFullEntity` 提供的 11 个字段（继承基类时这些字段无需在 fields 中配置）：

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | bigint | 主键 |
| `created_at` | datetime | 创建时间 |
| `creator_id` | bigint | 创建人 ID |
| `creator_name` | varchar | 创建人姓名 |
| `modifier_at` | datetime | 修改时间 |
| `modifier_id` | bigint | 修改人 ID |
| `modifier_name` | varchar | 修改人姓名 |
| `is_removed` | tinyint | 软删除标记 |
| `version` | int | 乐观锁版本号 |
| `sort_code` | int | 排序码 |
| `is_enable` | tinyint | 启用状态 |

### 2.3 字段配置（FieldConfig）

```typescript
interface FieldConfig {
  fieldCode: string;       // JS 属性名，同时作为默认 DB 列名（如 "order_no"）
  fieldName: string;       // 字段名称（注释），如 "订单号"
  columnName?: string;     // 显式指定 DB 列名；省略时自动使用 fieldCode
  fieldType: FieldType;    // 字段类型（语义类型或 SQL 类型别名均可）
  length?: number;         // 长度（varchar 用）
  precision?: number;      // 精度（decimal 用）
  scale?: number;          // 小数位（decimal 用）
  primaryKey?: boolean;    // 是否主键
  required?: boolean;      // 是否必填
  nullable?: boolean;      // 是否可空
  defaultValue?: any;      // 默认值
}

// 语义类型（推荐）
type SemanticFieldType =
  | 'string'    // → varchar
  | 'int'       // → int
  | 'bigint'    // → bigint（TypeScript 用 string 表示）
  | 'decimal'   // → decimal
  | 'boolean'   // → tinyint（0/1）
  | 'date'      // → date
  | 'datetime'  // → datetime
  | 'text'      // → text
  | 'json';     // → json

// SQL 类型别名（存储层兼容，可直接透传）
type SqlFieldType =
  | 'varchar' | 'char' | 'tinyint' | 'smallint'
  | 'float' | 'double' | 'longtext';

type FieldType = SemanticFieldType | SqlFieldType;
```

> **columnName 说明**：存储层配置通常使用 `columnName: 'order_no'` + `fieldCode: 'orderNo'`，而旧格式用 `fieldCode: 'order_no'` 同时充当 JS 属性名和列名。两种格式均兼容，优先使用 `columnName`。

### 2.4 Service 方法配置（ServiceMethodConfig）

```typescript
interface ServiceMethodConfig {
  methodName: string;                 // 方法名
  description?: string;              // 方法描述
  async?: boolean;                   // 是否异步（默认 true）
  parameters?: MethodParameterConfig[]; // 参数列表
  returnType?: string;               // 返回类型
  steps: LogicStepConfig[];          // 执行步骤列表
}
```

### 2.5 逻辑步骤（LogicStepConfig）

```typescript
interface LogicStepConfig {
  type: StepType;    // 步骤类型
  comment?: string;  // 步骤注释（生成代码注释）
  config: any;       // 步骤配置（各类型 config 见下表）
}

type StepType =
  | 'declare'      // 声明变量
  | 'assign'       // 赋值
  | 'query'        // 查询列表（findMany）
  | 'queryOne'     // 查询单条（findOne）
  | 'count'        // 计数
  | 'exists'       // 判断存在
  | 'save'         // 保存（insert）
  | 'update'       // 更新
  | 'delete'       // 删除
  | 'validate'     // 业务校验（抛异常）
  | 'condition'    // 条件分支（if / else if / else）
  | 'call'         // 调用方法（自身方法或注入的外部服务）
  | 'transaction'  // 事务块
  | 'return'       // 返回值
  | 'throw'        // 抛出异常
  | 'log'          // 日志输出
  | 'transform'    // 数据转换（规划中）
  | 'loop';        // 循环（规划中）
```

---

## 三、代码生成器架构

### 3.1 模块结构

```
libs/code-generator/
├── src/
│   ├── index.ts                      ← 主入口（CLI + 程序化调用）
│   ├── types/
│   │   └── config.ts                 ← 所有配置类型定义
│   ├── parsers/
│   │   └── expression-parser.ts      ← 表达式解析（literal/expr 两种模式）
│   └── generators/
│       ├── entity-generator.ts       ← Entity 生成器（基于 ts-morph）
│       ├── service-generator.ts      ← Service 生成器（步骤化逻辑）
│       ├── controller-generator.ts   ← Controller 生成器
│       ├── dto-generator.ts          ← DTO 生成器（规划独立）
│       └── module-generator.ts       ← Module 生成器（规划独立）
├── package.json
└── tsconfig.json
```

### 3.2 生成器技术选型

| 技术 | 用途 | 说明 |
|-----|------|------|
| `ts-morph` | TypeScript AST 操作 | 生成格式规范的 TS 代码，支持类/方法/属性/装饰器 |
| `commander` | CLI 入口 | 支持命令行模式调用（调试用） |

### 3.3 生成流程

```
输入：ModuleConfig（JSON）
│
├─ 遍历 entities
│   │
│   ├─ EntityGenerator.generate(entity, connectionName)
│   │   → 生成 *.entity.ts（TypeORM Entity 类）
│   │
│   ├─ ServiceGenerator.generate(entity, connectionName)
│   │   → 生成 *.service.ts（默认 CRUD 或自定义方法）
│   │
│   ├─ ControllerGenerator.generate(entity)
│   │   → 生成 *.controller.ts（RESTful API）
│   │
│   └─ DtoGenerator.generate(entity)
│       → 生成 *.dto.ts（Create/Update/Query DTO）
│
└─ ModuleGenerator.generate(config)
    → 生成 *.module.ts（NestJS Module）

输出：目标目录下完整的 NestJS 模块文件
```

---

## 四、各生成器详细设计

### 4.1 Entity 生成器

**输入**：`EntityConfig`

**生成示例**：

```typescript
// 配置输入
{
  entityCode: "order_main",
  entityName: "订单主表",
  tableName: "t_order",
  fields: [
    { fieldCode: "order_id", fieldName: "订单ID", fieldType: "bigint", primaryKey: true, required: true },
    { fieldCode: "order_no", fieldName: "订单号", fieldType: "string", length: 32, required: true },
    { fieldCode: "status", fieldName: "状态", fieldType: "int", required: true, defaultValue: 0 }
  ]
}

// 生成输出
import { Entity, Column, PrimaryColumn } from 'typeorm';
import { registerEntity } from '@cs/nest-typeorm';

/**
 * 订单主表
 * 该表位于数据库中
 */
@Entity('t_order')
export class OrderMain {
  @PrimaryColumn({ name: 'order_id', type: 'bigint', comment: '订单ID' })
  orderId!: string;

  @Column({ name: 'order_no', type: 'varchar', length: 32, comment: '订单号' })
  orderNo!: string;

  @Column({ name: 'status', type: 'int', comment: '状态', default: 0 })
  status!: number;
}

registerEntity({ entity: OrderMain, connectionName: 'trade' });
```

**类型映射规则**：

语义类型与 SQL 类型别名均可使用，最终映射关系如下：

| 语义类型 | SQL 别名 | TypeScript 类型 | 数据库类型 |
|---------|---------|----------------|-----------|
| `string` | `varchar`, `char` | `string` | `varchar` / `char` |
| `int` | `smallint` | `number` | `int` / `smallint` |
| `bigint` | — | `string` | `bigint` |
| `decimal` | `float`, `double` | `number` | `decimal` / `float` / `double` |
| `boolean` | `tinyint` | `number` | `tinyint` |
| `date` | — | `Date` | `date` |
| `datetime` | — | `Date` | `datetime` |
| `text` | `longtext` | `string` | `text` / `longtext` |
| `json` | — | `any` | `json` |

> SQL 类型别名直接透传到 `@Column({ type })` 装饰器，无需转换。

### 4.2 Service 生成器

**两种模式**：

**模式一：默认 CRUD**（未配置 `serviceMethods` 时）

自动生成：`create` / `findAll` / `findMany` / `findOne` / `update` / `remove` / `count`

**模式二：自定义方法**（配置了 `serviceMethods` 时）

按 `steps` 列表生成方法体，当前支持的步骤类型：

| 步骤类型 | 状态 | 生成代码示例 |
|---------|------|------------|
| `declare` | ✅ | `let result: OrderMain[] = [];` |
| `assign` | ✅ | `result = orderList;` |
| `query` | ✅ | `const orders = await this.repo.find({ where: {...}, order: {...}, skip, take });` |
| `queryOne` | ✅ | `const order = await this.repo.findOne({ where: {...} });` |
| `count` | ✅ | `const total = await this.repo.count({ where: {...} });` |
| `exists` | ✅ | `const exists = await this.repo.exists({ where: {...} });` |
| `save` | ✅ | `const entity = this.repo.create(dto); await this.repo.save(entity);` |
| `update` | ✅ | `await this.repo.update({ id }, dto);` |
| `delete` | ✅ | `await this.repo.delete({ id });` |
| `validate` | ✅ | `if (!(condition)) { throw new BadRequestException('xxx'); }` |
| `condition` | ✅ | `if (...) { ... } else if (...) { ... } else { ... }` |
| `call` | ✅ | `const result = await this.service.method(arg1, arg2);` |
| `transaction` | ✅ | `try { ... await commit } catch { rollback } finally { release }` |
| `return` | ✅ | `return value;` |
| `throw` | ✅ | `throw new NotFoundException('xxx');` |
| `log` | ✅ | `this.logger.debug('xxx');` |
| `loop` | 🔲 | 循环（规划中） |
| `transform` | 🔲 | 数据转换（规划中） |

**condition 步骤详解**：

```json
{
  "type": "condition",
  "config": {
    "if": {
      "conditions": [
        { "field": "count", "operator": "gt", "value": { "literal": 0 } }
      ],
      "then": [
        { "type": "throw", "config": { "exceptionType": "Conflict", "message": { "literal": "记录已存在" } } }
      ]
    },
    "elseIf": [
      {
        "conditions": [
          { "field": "dto.type", "operator": "eq", "value": { "literal": "A" } }
        ],
        "then": [...]
      }
    ],
    "else": [...]
  }
}
```

> condition 中的 `field` 是 JS 变量路径（如 `count`、`user.status`），`operator` 映射为 JS 比较运算符：
> `eq → ===`，`ne → !==`，`gt/gte/lt/lte → >/>=/</<= `，`in → value.includes(field)`，`isNull → == null`，`like → field.includes(value)`

**call 步骤详解**：

```json
{
  "type": "call",
  "config": {
    "result": "user",           // 可选，捕获返回值到变量
    "service": "userService",   // 可选，省略则调用 this.方法名()
    "method": "findById",
    "args": [
      { "expr": "dto.userId" }
    ],
    "await": true               // 默认 true
  }
}
```

生成代码：`const user = await this.userService.findById(dto.userId);`

调用自身方法（省略 service）：`await this.validateOrder(orderId);`

**自定义方法配置示例**：

```json
{
  "serviceMethods": [
    {
      "methodName": "submitOrder",
      "description": "提交订单",
      "async": true,
      "parameters": [
        { "name": "dto", "type": "SubmitOrderDto" }
      ],
      "returnType": "OrderMain",
      "steps": [
        {
          "type": "validate",
          "comment": "校验订单状态",
          "config": {
            "rules": [
              {
                "condition": { "expr": "dto.amount > 0" },
                "message": "订单金额必须大于0",
                "exceptionType": "BadRequest"
              }
            ]
          }
        },
        {
          "type": "save",
          "comment": "创建订单记录",
          "config": {
            "data": { "type": "param", "name": "dto" },
            "result": "order"
          }
        },
        {
          "type": "return",
          "config": { "value": { "expr": "order" } }
        }
      ]
    }
  ]
}
```

### 4.3 Controller 生成器

**生成 RESTful API 端点**：

| HTTP 方法 | 路径 | 对应 Service 方法 |
|---------|-----|----------------|
| POST | /{prefix} | create |
| GET | /{prefix} | findAll |
| GET | /{prefix}/query | findMany |
| GET | /{prefix}/:id | findOne |
| PATCH | /{prefix}/:id | update |
| DELETE | /{prefix}/:id | remove |

**生成示例**：

```typescript
@ApiTags('订单主表')
@Controller('order-main')
export class OrderMainController {
  constructor(private readonly orderMainService: OrderMainService) {}

  @Post()
  @ApiOperation({ summary: '创建记录' })
  create(@Body() createDto: CreateOrderMainDto) {
    return this.orderMainService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: '查询所有记录' })
  findAll() {
    return this.orderMainService.findAll();
  }

  // ... 其他端点
}
```

### 4.4 DTO 生成器

**生成三类 DTO**：

| DTO 类型 | 用途 | 字段规则 |
|---------|------|---------|
| `Create{Entity}Dto` | 创建时入参 | 所有字段，主键排除 |
| `Update{Entity}Dto` | 更新时入参 | 非主键字段，全部 optional |
| `Query{Entity}Dto` | 查询条件 | 所有字段，全部 optional |

使用 `class-validator` 装饰器进行入参校验，`@nestjs/swagger` 装饰器生成 API 文档。

---

## 五、表达式解析器

### 5.1 表达式类型

```typescript
interface Expression {
  literal?: any;  // 字面量（原样输出）
  expr?: string;  // 表达式字符串（直接作为代码插入）
}
```

### 5.2 使用示例

```json
// 字面量
{ "literal": "pending" }      → 生成: 'pending'
{ "literal": 1 }              → 生成: 1
{ "literal": null }           → 生成: null
{ "literal": [1, 2, 3] }      → 生成: [1, 2, 3]

// 表达式（直接作为代码）
{ "expr": "dto.orderId" }     → 生成: dto.orderId
{ "expr": "dto.amount > 0" }  → 生成: dto.amount > 0
{ "expr": "new Date()" }      → 生成: new Date()
```

### 5.3 命名空间插值语法

在 `expr` 字符串中可使用 `${namespace:path}` 语法引用变量或调用内置函数：

| 语法 | 生成代码 | 说明 |
|------|---------|------|
| `${param:userId}` | `${userId}` | 方法参数（模板字符串插值） |
| `${var:total}` | `${total}` | 局部变量 |
| `${ctx:userId}` | `${this.contextService.getUserId()}` | 请求上下文 |
| `${ctx:tenantId}` | `${this.contextService.getTenantId()}` | 租户上下文 |
| `${fn:now}` | `${new Date()}` | 内置函数：当前时间 |
| `${fn:uuid}` | `${uuidv4()}` | 内置函数：UUID |
| `${fn:snowflake}` | `${this.idGenerator.nextId()}` | 内置函数：雪花 ID |
| `${fn:isEmpty(x)}` | `${isEmpty(x)}` | 内置函数：空值判断 |
| `${fn:toNumber(x)}` | `${Number(x)}` | 内置函数：类型转换 |
| `${item:field}` | `${item.field}` | 循环项字段（loop 步骤用） |
| `${index}` | `${index}` | 循环索引（loop 步骤用） |

---

## 六、构建集成

### 6.1 构建服务调用方式

构建服务（`assembox-builder`）作为 Consumer 调用代码生成器：

```typescript
// codegen-coordinator.service.ts
import { CodeGenerator } from '@assembox/code-generator';

@Injectable()
export class ServiceCodegenService {
  async generate(
    moduleConfigs: ModuleConfig[],
    outputDir: string
  ): Promise<void> {
    const generator = new CodeGenerator();
    for (const config of moduleConfigs) {
      const moduleOutputDir = path.join(outputDir, config.moduleCode);
      await generator.generate(config, moduleOutputDir);
    }
  }
}
```

### 6.2 配置转换（存储配置 → 生成器输入）

存储层的组件配置（JSON）需要转换为生成器输入格式（ModuleConfig）：

```
存储层组件配置:
  EntityConfig（type=entity）    → ModuleConfig.entities[].entityCode/entityName/tableName/fields
  ServiceConfig（type=service）  → ModuleConfig.entities[].serviceMethods
  ControllerConfig（type=controller）→ ModuleConfig.entities[].generateController/apiPrefix

转换规则：
  - 同一 module 下的 entity/service/controller 组件合并为一个 EntityConfig
  - entity 组件提供字段定义
  - service 组件提供自定义方法（可选，无则用默认 CRUD）
  - controller 组件提供路由配置（可选）
```

### 6.3 本地校验实现

```bash
# 阶段一：TypeScript 编译检查
cd /tmp/build/{task_id}/{module_group_code}
npx tsc --noEmit --project tsconfig.json

# 阶段二：单元测试（如生成了 *.spec.ts）
npx jest --testPathPattern=src/ --passWithNoTests
```

单元测试文件（*.spec.ts）生成规划：
- MVP 阶段：暂不生成测试文件，`--passWithNoTests` 跳过
- 迭代阶段：为每个 Service 生成基础单元测试（mock repository，测试主要方法）

---

## 七、迭代规划

### 7.1 近期迭代（优先级高）

| 功能 | 说明 |
|-----|------|
| 测试文件生成 | 为 Service 生成 *.spec.ts 骨架，校验阶段自动运行 |
| 分页查询支持 | Controller/Service 支持分页参数（page, pageSize） |
| 软删除支持 | 生成代码支持 deleted_at 软删除字段 |
| 公共字段注入 | created_at, updated_at, created_by 等系统字段自动注入 |

### 7.2 中期迭代

| 功能 | 说明 |
|-----|------|
| RPC 接口生成 | 生成 RPC handler，对接云阙 RPC 框架 |
| 事件处理器生成 | 生成 MQ 事件消费者代码 |
| 自定义 WHERE 条件 | Service findMany 支持更复杂的动态查询条件 |
| 关联查询 | Entity 支持 @ManyToOne / @OneToMany 关系 |

### 7.3 长期规划

| 功能 | 说明 |
|-----|------|
| 数据迁移脚本 | 根据实体变化自动生成 TypeORM Migration 脚本 |
| Swagger 文档增强 | 自动生成更丰富的 API 文档描述 |
| 多框架支持 | 插件化扩展，支持非 NestJS 框架（低优先级） |
