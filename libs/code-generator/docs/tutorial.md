# @cs/code-generator 代码生成引擎使用教程

## 目录

- [概述](#概述)
- [架构设计](#架构设计)
- [快速开始](#快速开始)
- [配置规约 (JSON DSL)](#配置规约-json-dsl)
  - [ModuleConfig — 模块配置](#moduleconfig--模块配置)
  - [EntityConfig — 实体配置](#entityconfig--实体配置)
  - [FieldConfig — 字段配置](#fieldconfig--字段配置)
  - [字段类型映射](#字段类型映射)
  - [平台基类选择](#平台基类选择)
- [上下文系统](#上下文系统)
  - [EntityContext — 实体上下文](#entitycontext--实体上下文)
  - [ModuleContext — 模块上下文](#modulecontext--模块上下文)
  - [审计字段自动过滤](#审计字段自动过滤)
- [核心引擎](#核心引擎)
- [插件详解](#插件详解)
  - [TypeOrmPlugin — 实体与仓储](#typeormplugin--实体与仓储)
  - [ServiceGapPlugin — 代沟模式服务](#servicegapplugin--代沟模式服务)
  - [DtoPlugin — 数据传输对象](#dtoplugin--数据传输对象)
  - [ModulePlugin — 模块组装](#moduleplugin--模块组装)
- [生成文件一览](#生成文件一览)
- [代沟模式 (Generation Gap)](#代沟模式-generation-gap)
- [多数据源支持](#多数据源支持)
- [编写自定义插件](#编写自定义插件)
- [编程式 API](#编程式-api)
- [常见问题](#常见问题)

---

## 概述

`@cs/code-generator` 是基于 `@cs/*` 平台规范的低代码后端代码生成引擎。输入一份 JSON 配置（DSL），自动生成完整的 NestJS 微服务模块代码，包括 Entity、Repository、Service、DTO 和 Module。

**核心特性：**

- **AST 级代码生成** — 基于 `ts-morph`，操作抽象语法树而非字符串拼接，确保生成代码语法正确
- **代沟模式** — 基础 CRUD 代码可无限次安全重新生成，手写的业务扩展代码永不丢失
- **插件化架构** — 每种文件类型由独立插件负责，极易扩展
- **@cs/* 平台规范** — 生成的代码严格遵循 `@cs/nest-typeorm`、`@cs/nest-common` 等平台包的约定

---

## 架构设计

引擎采用 4 层架构：

```
┌──────────────────────────────────────────────────┐
│  1. 规约层 (Meta-Schema)                          │
│     ModuleConfig / EntityConfig / FieldConfig      │
│     定义 JSON DSL 的结构约束                        │
├──────────────────────────────────────────────────┤
│  2. 上下文层 (Context)                             │
│     ModuleContext / EntityContext / FieldContext     │
│     预处理命名转换、字段分类、基类推导                  │
├──────────────────────────────────────────────────┤
│  3. 引擎层 (Engine)                               │
│     CodeEngine + ts-morph Project (虚拟文件系统)     │
│     插件注册、调度、格式化、统一落盘                    │
├──────────────────────────────────────────────────┤
│  4. 插件层 (Plugins)                              │
│     TypeOrmPlugin / ServiceGapPlugin / DtoPlugin    │
│     / ModulePlugin / 自定义插件...                   │
│     每个插件负责生成一类文件                           │
└──────────────────────────────────────────────────┘
```

**数据流：**

```
JSON 配置 → ModuleContext(EntityContext[]) → CodeEngine 调度插件 → ts-morph AST → formatText → save 落盘
```

---

## 快速开始

### 1. 安装依赖

```bash
cd libs/code-generator
pnpm install
```

### 2. 编写配置文件

创建 `configs/my-module.json`：

```json
{
  "moduleName": "商品管理模块",
  "moduleCode": "product",
  "entities": [
    {
      "entityName": "商品",
      "entityCode": "product",
      "tableName": "t_product",
      "baseClass": "HasPrimaryFullEntity",
      "fields": [
        {
          "fieldCode": "product_name",
          "fieldName": "商品名称",
          "fieldType": "string",
          "length": 200,
          "required": true
        },
        {
          "fieldCode": "price",
          "fieldName": "价格",
          "fieldType": "decimal",
          "precision": 10,
          "scale": 2,
          "required": true
        },
        {
          "fieldCode": "stock",
          "fieldName": "库存数量",
          "fieldType": "int",
          "required": true
        },
        {
          "fieldCode": "description",
          "fieldName": "商品描述",
          "fieldType": "text",
          "nullable": true
        }
      ]
    }
  ]
}
```

### 3. 编写生成脚本

```typescript
import { CodeEngine, TypeOrmPlugin, ServiceGapPlugin, DtoPlugin, ModulePlugin } from '@cs/code-generator';
import config from './configs/my-module.json';

async function main() {
  const engine = new CodeEngine();

  engine
    .use(new TypeOrmPlugin())
    .use(new ServiceGapPlugin())
    .use(new DtoPlugin())
    .use(new ModulePlugin());

  await engine.generate(config, './output/product');
}

main();
```

### 4. 运行

```bash
npx ts-node your-script.ts
```

### 5. 查看生成结果

```
output/product/
├── product.entity.ts           # TypeORM 实体
├── product.repository.ts       # 仓储类
├── product.dto.ts              # DTO (Dto + CreateDto + UpdateDto)
├── product.service.ts          # 业务扩展服务（代沟保护）
├── base/
│   └── product.service.base.ts # 基础 CRUD 服务（每次覆盖）
└── product.module.ts           # NestJS 模块定义
```

---

## 配置规约 (JSON DSL)

### ModuleConfig — 模块配置

代码生成的**顶层输入**，一个模块可以包含多个实体。

```typescript
interface ModuleConfig {
  moduleCode: string;       // 模块代码，如 "order"，用于生成类名和文件名
  moduleName: string;       // 模块名称，如 "订单管理模块"，用于注释
  connectionName?: string;  // 数据库连接名（模块级默认值），默认 "default"
  entities: EntityConfig[]; // 实体配置列表
}
```

**示例：**

```json
{
  "moduleCode": "order",
  "moduleName": "订单管理模块",
  "connectionName": "trade",
  "entities": [...]
}
```

`moduleCode` 决定了生成的 Module 类名和文件名：
- `"order"` → `OrderModule` / `order.module.ts`
- `"user-auth"` → `UserAuthModule` / `user-auth.module.ts`

### EntityConfig — 实体配置

每个实体对应数据库中的一张表。

```typescript
interface EntityConfig {
  entityCode: string;           // 实体代码，如 "user_order"
  entityName: string;           // 实体名称，如 "用户订单表"
  tableName: string;            // 数据库表名，如 "t_user_order"
  fields: FieldConfig[];        // 字段列表
  baseClass?: CsBaseEntityClass; // 继承的平台基类，默认 "HasPrimaryEntity"
  connectionName?: string;      // 数据源连接名（覆盖模块级设置）
  generateController?: boolean; // 是否生成 Controller，默认 true
  generateService?: boolean;    // 是否生成 Service，默认 true
  apiPrefix?: string;           // API 路由前缀
}
```

`entityCode` 决定了所有生成文件的命名：
- `"user_order"` → 类名 `UserOrder` / 文件名前缀 `user-order`

### FieldConfig — 字段配置

```typescript
interface FieldConfig {
  fieldCode: string;      // JS 属性名，同时作为默认 DB 列名
  fieldName: string;      // 字段中文名称（用于注释和 Swagger 描述）
  fieldType: FieldType;   // 字段类型
  columnName?: string;    // 显式指定 DB 列名，省略时使用 fieldCode
  length?: number;        // varchar 长度
  precision?: number;     // decimal 总位数
  scale?: number;         // decimal 小数位
  primaryKey?: boolean;   // 是否主键
  required?: boolean;     // 是否必填
  nullable?: boolean;     // 是否可空
  defaultValue?: any;     // 默认值
}
```

**字段命名转换规则：**

| fieldCode (输入) | propertyName (TS属性) | dbColumnName (DB列) |
|---|---|---|
| `order_no` | `orderNo` | `order_no` |
| `customer_id` | `customerId` | `customer_id` |
| `productName` | `productName` | `productName` |

如果 `columnName` 显式指定，则 DB 列名使用 `columnName` 而非 `fieldCode`。

### 字段类型映射

引擎支持**语义类型**和**SQL 类型别名**两种写法：

| 配置 fieldType | TypeScript 类型 | 数据库列类型 | 说明 |
|---|---|---|---|
| `string` | `string` | `varchar` | 短字符串（推荐） |
| `int` | `number` | `int` | 整数 |
| `bigint` | `string` | `bigint` | 大整数（JS 中用 string 表示） |
| `decimal` | `number` | `decimal` | 精确小数，需配合 precision/scale |
| `boolean` | `number` | `tinyint` | 布尔值（0/1） |
| `date` | `Date` | `date` | 日期 |
| `datetime` | `Date` | `datetime` | 日期时间 |
| `text` | `string` | `text` | 长文本 |
| `json` | `any` | `json` | JSON 对象 |
| `varchar` | `string` | `varchar` | SQL 别名，等同 string |
| `char` | `string` | `char` | 定长字符 |
| `tinyint` | `number` | `tinyint` | SQL 别名 |
| `smallint` | `number` | `smallint` | SQL 别名 |
| `float` | `number` | `float` | 浮点数 |
| `double` | `number` | `double` | 双精度浮点 |
| `longtext` | `string` | `longtext` | 超长文本 |

### 平台基类选择

`baseClass` 决定了 Entity 继承哪个 `@cs/nest-typeorm` 基类，以及自动获得哪些内置字段：

| 基类 | 内置字段 | 适用场景 |
|---|---|---|
| `HasOnlyPrimaryEntity` | `id` | 仅需主键的轻量表 |
| `HasPrimaryEntity` | `id` + 创建/修改审计字段 | **默认推荐**，一般业务表 |
| `HasPrimaryFullEntity` | 上述 + `isRemoved`/`version`/`sortCode`/`isEnable` | 需要软删除、乐观锁、排序的表 |
| `HasPrimaryTreeEntity` | HasPrimary + 树形字段 (`parentId`/`fullId`/`level`...) | 树形结构表 |
| `HasPrimaryFullTreeEntity` | HasPrimaryFull + 树形字段 | 完整功能的树形表 |

**`HasPrimaryEntity` 包含的审计字段：**
- `id` (bigint) — 主键
- `created_at` / `createdAt` — 创建时间
- `creator_id` / `creatorId` — 创建人 ID
- `creator_name` / `creatorName` — 创建人姓名
- `modifier_at` / `modifierAt` — 修改时间
- `modifier_id` / `modifierId` — 修改人 ID
- `modifier_name` / `modifierName` — 修改人姓名

**`HasPrimaryFullEntity` 额外包含：**
- `is_removed` / `isRemoved` — 软删除标记
- `version` — 乐观锁版本号
- `sort_code` / `sortCode` — 排序码
- `is_enable` / `isEnable` — 启用状态

> **重要：** 如果你的 JSON 配置中包含了基类已有的字段（如 `id`、`creator_id`），引擎会**自动过滤**，不会重复生成 `@Column` 装饰器。

---

## 上下文系统

上下文层是引擎的"大脑"，负责将原始 JSON 配置预处理为插件可直接使用的强类型对象。

### EntityContext — 实体上下文

每个 `EntityConfig` 被解析为一个 `EntityContext` 实例，预计算好所有命名和字段分类：

```typescript
const ctx = new EntityContext({
  entityCode: 'user_order',
  entityName: '用户订单表',
  tableName: 't_user_order',
  baseClass: 'HasPrimaryFullEntity',
  connectionName: 'trade',
  fields: [
    { fieldCode: 'order_no', fieldName: '订单编号', fieldType: 'string', required: true },
    { fieldCode: 'amount', fieldName: '订单金额', fieldType: 'int', required: true },
    { fieldCode: 'creator_id', fieldName: '创建人', fieldType: 'bigint' }, // 基类字段，将被过滤
  ]
});

// 命名计算结果
ctx.className      // → "UserOrder"
ctx.instanceName   // → "userOrder"
ctx.fileName       // → "user-order"

// 规范推导
ctx.baseEntityClass // → "HasPrimaryFullEntity"
ctx.baseDtoClass    // → "HasPrimaryFullDto"  (Entity → Dto 自动替换)
ctx.connectionName  // → "trade"

// 字段分类
ctx.allFields.length       // → 3 (所有原始字段)
ctx.businessFields.length  // → 2 (纯业务字段，creator_id 已被过滤)
ctx.primaryKeys.length     // → 0

// 辅助属性
ctx.hasCustomConnection    // → true (非 default 连接)
ctx.generateController     // → true
ctx.generateService        // → true
ctx.apiPrefix              // → "user-order"
```

### ModuleContext — 模块上下文

聚合多个 `EntityContext`，提供模块级的计算结果：

```typescript
const moduleCtx = new ModuleContext({
  moduleCode: 'order',
  moduleName: '订单管理模块',
  connectionName: 'trade',
  entities: [orderConfig, orderDetailConfig]
});

moduleCtx.className     // → "Order"
moduleCtx.fileName      // → "order"
moduleCtx.displayName   // → "订单管理模块"

moduleCtx.entities                // → [EntityContext, EntityContext]
moduleCtx.controllableEntities    // → 需要生成 Controller 的实体
moduleCtx.serviceableEntities     // → 需要生成 Service 的实体
moduleCtx.connectionNames         // → ["trade"]  所有涉及的数据源
```

**连接名继承规则：** 实体级 `connectionName` > 模块级 `connectionName` > 默认值 `"default"`

### 审计字段自动过滤

引擎根据选择的基类，精确过滤对应的审计字段。不同基类过滤的字段不同：

```
HasOnlyPrimaryEntity:     只过滤 id
HasPrimaryEntity:         过滤 id + 6个审计字段
HasPrimaryFullEntity:     过滤 id + 6个审计字段 + 4个状态字段
HasPrimaryTreeEntity:     过滤 id + 6个审计字段 + 5个树形字段
HasPrimaryFullTreeEntity: 过滤 id + 6个审计字段 + 4个状态字段 + 5个树形字段
```

这意味着：如果你选择了 `HasOnlyPrimaryEntity`，配置中的 `sort_code` 字段不会被过滤（因为这个基类没有该字段）；但如果选择了 `HasPrimaryFullEntity`，`sort_code` 会被自动过滤。

---

## 核心引擎

`CodeEngine` 是引擎的调度中心。它维护一个共享的 `ts-morph Project` 实例（虚拟文件系统），所有插件在内存中操作 AST，最后统一格式化并写入磁盘。

```typescript
import { CodeEngine } from '@cs/code-generator';

const engine = new CodeEngine();

// 链式注册插件
engine
  .use(new TypeOrmPlugin())
  .use(new ServiceGapPlugin())
  .use(new DtoPlugin())
  .use(new ModulePlugin());

// 从 JSON 配置生成代码
await engine.generate(moduleConfig, './output/my-module');
```

**`generate()` 执行流程：**

1. 将 `ModuleConfig` 构建为 `ModuleContext`
2. 遍历每个 `EntityContext`，依次执行所有注册的插件
3. 对所有生成的源文件执行 `formatText()`（2 空格缩进）
4. 调用 `project.save()` 统一写入磁盘

> **注意：** 插件的注册顺序即执行顺序。推荐顺序为：TypeOrmPlugin → ServiceGapPlugin → DtoPlugin → ModulePlugin

---

## 插件详解

### TypeOrmPlugin — 实体与仓储

生成 `*.entity.ts` 和 `*.repository.ts`，每次运行都会覆盖。

**生成的 Entity 文件示例：**

```typescript
// product.entity.ts
import { Entity, Column } from "typeorm";
import { HasPrimaryFullEntity, registerEntity } from "@cs/nest-typeorm";

/**
 * 商品
 * @autoGenerated 此文件由代码生成引擎自动生成
 */
@Entity('t_product')
export class Product extends HasPrimaryFullEntity {
  @Column({ name: "product_name", type: "varchar", comment: "商品名称", length: 200 })
  productName!: string;

  @Column({ name: "price", type: "decimal", comment: "价格", precision: 10, scale: 2 })
  price!: number;

  @Column({ name: "stock", type: "int", comment: "库存数量" })
  stock!: number;

  @Column({ name: "description", type: "text", comment: "商品描述", nullable: true })
  description?: string;
}

registerEntity({ entity: Product });
```

**关键行为：**
- 继承指定的 `@cs/nest-typeorm` 基类
- 只生成 `businessFields`（基类审计字段已被自动过滤）
- 必填字段使用 `!`（非空断言），可选字段使用 `?`
- 文件末尾调用 `registerEntity()` 注册到连接管理器
- 非 default 连接时自动添加 `connectionName` 参数

**生成的 Repository 文件示例：**

```typescript
// product.repository.ts
import { Injectable } from "@nestjs/common";
import { BaseRepository } from "@cs/nest-typeorm";
import { Product } from "./product.entity";

/**
 * 商品 仓储
 * @autoGenerated 此文件由代码生成引擎自动生成
 */
@Injectable()
export class ProductRepository extends BaseRepository<Product> {
}
```

### ServiceGapPlugin — 代沟模式服务

这是引擎的核心亮点。生成两个文件，采用不同的覆盖策略：

**1. `base/*.service.base.ts` — 每次强覆盖：**

```typescript
// base/product.service.base.ts
import { LoggerService, QueryConditionInput, PageResult } from "@cs/nest-common";
import { InjectRepository } from "@cs/nest-typeorm";
import { Product } from "../product.entity";
import { ProductRepository } from "../product.repository";

export class ProductServiceBase {
  constructor(
    protected readonly logger: LoggerService,
    @InjectRepository({ entity: Product, repository: ProductRepository })
    protected readonly repo: ProductRepository
  ) {}

  /** 分页查询 */
  public async findPage(query: QueryConditionInput): Promise<PageResult<Product>> {
    return await this.repo.findManyBase(query);
  }

  /** 根据 ID 查询单条记录 */
  public async findById(id: string): Promise<Product | null> {
    return await this.repo.findOne({ where: { id } as any });
  }

  /** 创建记录 */
  public async create(data: Partial<Product>): Promise<Product> {
    this.logger.log('创建商品记录', 'ProductServiceBase');
    return await this.repo.saveOne(data);
  }

  /** 根据 ID 更新记录 */
  public async update(id: string, data: Partial<Product>): Promise<void> {
    await this.repo.updateByCondition(data, { id } as any);
  }

  /** 软删除记录 */
  public async remove(id: string): Promise<void> {
    await this.repo.softDeletion({ id } as any);
  }
}
```

**2. `*.service.ts` — 仅首次生成，后续不覆盖：**

```typescript
// product.service.ts
import { Injectable } from "@nestjs/common";
import { ProductServiceBase } from "./base/product.service.base";

/**
 * 商品 业务扩展服务
 *
 * AI Agent 或开发者可在此处编写自定义业务逻辑。
 * 低代码引擎的再次生成不会覆盖此文件。
 */
@Injectable()
export class ProductService extends ProductServiceBase {
  // 在这里编写自定义业务逻辑
}
```

**关键行为：**
- `generateService` 为 `false` 时跳过整个 Service 生成
- Base Service 使用 `protected` 暴露 `logger` 和 `repo`，子类可直接访问
- 非 default 连接时 `@InjectRepository` 自动带上 `connectionName`

### DtoPlugin — 数据传输对象

生成 `*.dto.ts`，包含三个 DTO 类，每次运行覆盖。

```typescript
// product.dto.ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNumber, IsOptional, IsNotEmpty } from "class-validator";
import { HasPrimaryFullDto } from "@cs/nest-common";

/** 商品 响应 DTO */
export class ProductDto extends HasPrimaryFullDto {
  @ApiProperty({ description: '商品名称' })
  productName: string;

  @ApiProperty({ description: '价格' })
  price: number;

  @ApiProperty({ description: '库存数量' })
  stock: number;

  @ApiProperty({ description: '商品描述' })
  description: string;
}

/** 创建 商品 请求参数 */
export class CreateProductDto {
  @ApiProperty({ description: '商品名称' })
  @IsNotEmpty()
  @IsString()
  productName!: string;

  @ApiProperty({ description: '价格' })
  @IsNotEmpty()
  @IsNumber()
  price!: number;

  @ApiProperty({ description: '库存数量' })
  @IsNotEmpty()
  @IsNumber()
  stock!: number;

  @ApiPropertyOptional({ description: '商品描述' })
  @IsOptional()
  @IsString()
  description?: string;
}

/** 更新 商品 请求参数 */
export class UpdateProductDto {
  @ApiPropertyOptional({ description: '商品名称' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({ description: '价格' })
  @IsOptional()
  @IsNumber()
  price?: number;

  // ... 所有字段均为可选
}
```

**关键行为：**
- `ResponseDto` 继承平台 DTO 基类（如 `HasPrimaryFullDto`），自动包含审计字段
- `CreateDto` 和 `UpdateDto` 不继承基类，只包含业务字段
- 主键字段不会出现在 Create/Update DTO 中
- 必填字段使用 `@IsNotEmpty()` + `@ApiProperty`
- 可选字段使用 `@IsOptional()` + `@ApiPropertyOptional`
- 根据 TS 类型自动选择 `@IsString()` 或 `@IsNumber()`

### ModulePlugin — 模块组装

生成 `*.module.ts`，自动收集实体、仓储和服务进行注册。

```typescript
// product.module.ts
import { Module } from "@nestjs/common";
import { EntityRegistModule } from "@cs/nest-typeorm";
import { Product } from "./product.entity";
import { ProductRepository } from "./product.repository";
import { ProductService } from "./product.service";

/**
 * 商品管理模块
 * @autoGenerated 此文件由代码生成引擎自动生成
 */
@Module({
  imports: [
    EntityRegistModule.forRepos([
      { entity: Product, repository: ProductRepository }
    ])
  ],
  controllers: [],
  providers: [ProductService],
  exports: [ProductService]
})
export class ProductModule {}
```

**关键行为：**
- 使用 `EntityRegistModule.forRepos()` 注册实体与仓储（`@cs/nest-typeorm` 规范）
- 多实体模块会将所有实体一次性注册
- 非 default 连接时自动添加 `connectionName`
- 只有 `generateService=true` 的实体才会被加入 providers
- Module 在处理第一个实体时生成（避免多实体重复生成）

---

## 生成文件一览

对于一个包含单实体 `product` 的模块，生成的完整文件结构如下：

```
output/my-module/
├── product.entity.ts              # [覆盖] TypeORM 实体，继承平台基类
├── product.repository.ts          # [覆盖] 仓储类，继承 BaseRepository
├── product.dto.ts                 # [覆盖] DTO 三件套 (Dto/CreateDto/UpdateDto)
├── product.service.ts             # [保护] 业务扩展服务（仅首次生成）
├── base/
│   └── product.service.base.ts    # [覆盖] 基础 CRUD 服务
└── my-module.module.ts            # [覆盖] NestJS Module 定义
```

| 文件 | 覆盖策略 | 修改者 |
|---|---|---|
| `*.entity.ts` | 每次覆盖 | 引擎 |
| `*.repository.ts` | 每次覆盖 | 引擎 |
| `*.dto.ts` | 每次覆盖 | 引擎 |
| `base/*.service.base.ts` | 每次覆盖 | 引擎 |
| `*.service.ts` | 仅首次生成 | **开发者 / AI Agent** |
| `*.module.ts` | 每次覆盖 | 引擎 |

---

## 代沟模式 (Generation Gap)

代沟模式是引擎的核心设计，解决了低代码平台"生成的代码不能改、改了又会被覆盖"的经典难题。

### 工作原理

```
                    ┌──────────────────────────┐
                    │   Base Service (base/)    │
                    │   标准 CRUD 逻辑           │
                    │   ● findPage()            │
                    │   ● findById()            │
    每次生成覆盖 ──→ │   ● create()              │
                    │   ● update()              │
                    │   ● remove()              │
                    └──────────┬───────────────┘
                               │ extends
                    ┌──────────┴───────────────┐
                    │   Custom Service          │
                    │   业务扩展逻辑             │
    仅首次生成 ──→  │   ● calculateDiscount()   │ ← 开发者/AI Agent 编写
                    │   ● syncToWarehouse()     │
                    │   ● notifyCustomer()      │
                    └──────────────────────────┘
```

### 使用示例

**第一次运行：** 引擎生成 base service 和空的 custom service。

**开发者添加业务逻辑：**

```typescript
// product.service.ts (手动编辑)
@Injectable()
export class ProductService extends ProductServiceBase {

  /** 计算折扣价格 */
  async calculateDiscount(productId: string, discountRate: number): Promise<number> {
    const product = await this.findById(productId);  // 调用 Base 的方法
    if (!product) throw new NotFoundException('商品不存在');
    this.logger.log(`计算折扣: ${product.productName} × ${discountRate}`);  // 使用 Base 暴露的 logger
    return product.price * (1 - discountRate);
  }

  /** 批量更新库存 */
  async batchUpdateStock(items: { id: string; delta: number }[]): Promise<void> {
    for (const item of items) {
      const product = await this.repo.findOne({ where: { id: item.id } as any });  // 使用 Base 暴露的 repo
      if (product) {
        await this.update(item.id, { stock: product.stock + item.delta } as any);
      }
    }
  }
}
```

**第 N 次运行（配置变更后重新生成）：**
- `base/product.service.base.ts` → 被覆盖更新（反映新字段/新配置）
- `product.service.ts` → **完全不受影响**，手写代码安全

---

## 多数据源支持

引擎原生支持多数据源场景（对应 `config.yaml` 中的不同 `connectionName`）。

### 配置方式

```json
{
  "moduleCode": "multi-db-demo",
  "moduleName": "多数据源示例",
  "entities": [
    {
      "entityCode": "user",
      "tableName": "t_user",
      "connectionName": "user-db",
      "fields": [...]
    },
    {
      "entityCode": "order",
      "tableName": "t_order",
      "connectionName": "trade-db",
      "fields": [...]
    }
  ]
}
```

### 生成效果

非 default 连接时，引擎会在以下位置自动注入 `connectionName`：

**Entity：**
```typescript
registerEntity({ entity: User, connectionName: 'user-db' });
```

**Base Service：**
```typescript
@InjectRepository({
  entity: User,
  repository: UserRepository,
  connectionName: 'user-db'
})
```

**Module：**
```typescript
EntityRegistModule.forRepos([
  { entity: User, repository: UserRepository, connectionName: 'user-db' },
  { entity: Order, repository: OrderRepository, connectionName: 'trade-db' }
])
```

---

## 编写自定义插件

引擎支持通过实现 `GeneratorPlugin` 接口来扩展新的生成能力。

### 插件接口

```typescript
import { Project } from 'ts-morph';
import { EntityContext } from '@cs/code-generator';
import { ModuleContext } from '@cs/code-generator';

interface GeneratorPlugin {
  readonly name: string;
  readonly dependencies?: string[];  // 依赖的其他插件名

  execute(
    entityCtx: EntityContext,
    moduleCtx: ModuleContext,
    project: Project,
    outputDir: string,
  ): Promise<void>;
}
```

### 示例：ControllerPlugin

```typescript
import * as path from 'path';
import { Project } from 'ts-morph';
import { GeneratorPlugin, EntityContext, ModuleContext } from '@cs/code-generator';

export class ControllerPlugin implements GeneratorPlugin {
  readonly name = 'ControllerPlugin';
  readonly dependencies = ['TypeOrmPlugin', 'DtoPlugin'];

  async execute(
    entityCtx: EntityContext,
    _moduleCtx: ModuleContext,
    project: Project,
    outputDir: string,
  ): Promise<void> {
    if (!entityCtx.generateController) return;

    const filePath = path.join(outputDir, `${entityCtx.fileName}.controller.ts`);
    const sourceFile = project.createSourceFile(filePath, '', { overwrite: true });

    // 使用 ts-morph API 构建 Controller AST...
    sourceFile.addImportDeclaration({
      namedImports: ['Controller', 'Get', 'Post', 'Body', 'Param'],
      moduleSpecifier: '@nestjs/common',
    });

    // ... 添加类、方法、装饰器等
  }
}
```

### 注册使用

```typescript
const engine = new CodeEngine();
engine
  .use(new TypeOrmPlugin())
  .use(new ServiceGapPlugin())
  .use(new DtoPlugin())
  .use(new ControllerPlugin())  // 加入自定义插件
  .use(new ModulePlugin());
```

---

## 编程式 API

### 导出清单

```typescript
// 核心引擎
import { CodeEngine, GeneratorPlugin } from '@cs/code-generator';

// 上下文
import { EntityContext, FieldContext, ModuleContext } from '@cs/code-generator';

// 内置插件
import { TypeOrmPlugin, ServiceGapPlugin, DtoPlugin, ModulePlugin } from '@cs/code-generator';

// 类型定义
import { ModuleConfig, EntityConfig, FieldConfig, CsBaseEntityClass, FieldType } from '@cs/code-generator';

// 命名工具
import { toPascalCase, toCamelCase, toKebabCase, mapFieldTypeToTs, mapFieldTypeToDb } from '@cs/code-generator';
```

### 命名工具函数

```typescript
toPascalCase('user_order')    // → "UserOrder"
toPascalCase('product-name')  // → "ProductName"

toCamelCase('user_order')     // → "userOrder"

toKebabCase('UserOrder')      // → "user-order"
toKebabCase('user_order')     // → "user-order"

mapFieldTypeToTs('int')       // → "number"
mapFieldTypeToTs('bigint')    // → "string"
mapFieldTypeToTs('datetime')  // → "Date"

mapFieldTypeToDb('string')    // → "varchar"
mapFieldTypeToDb('boolean')   // → "tinyint"
```

### 单实体生成

如果只需要测试单个实体的生成，可以使用 `buildEntity()`：

```typescript
const engine = new CodeEngine();
engine.use(new TypeOrmPlugin());

const entityCtx = new EntityContext({ ... });
const moduleCtx = new ModuleContext({ moduleCode: 'test', moduleName: '测试', entities: [] });

await engine.buildEntity(entityCtx, moduleCtx, './output');
```

---

## 常见问题

### Q: 为什么生成的 Entity 中没有 `id`、`createdAt` 等字段？

这些字段由你选择的基类（如 `HasPrimaryEntity`）提供。引擎会自动过滤这些审计字段，避免重复生成。如果你的配置中包含了 `id` 或 `creator_id` 等字段，它们会被静默过滤。

### Q: 我修改了 `product.service.ts` 后重新生成，手写代码会丢失吗？

不会。这正是代沟模式的核心设计：`product.service.ts` 一旦生成后不会再被覆盖。只有 `base/product.service.base.ts` 会被每次覆盖更新。

### Q: 怎么支持复合主键？

在字段配置中，将多个字段的 `primaryKey` 设为 `true` 即可：

```json
{
  "fields": [
    { "fieldCode": "tenant", "fieldType": "string", "primaryKey": true },
    { "fieldCode": "order_id", "fieldType": "bigint", "primaryKey": true }
  ]
}
```

引擎会为这些字段生成 `@PrimaryColumn` 而非 `@Column`。

### Q: 如何跳过某个实体的 Service 或 Controller 生成？

在 `EntityConfig` 中设置 `generateService: false` 或 `generateController: false`。

### Q: 插件的执行顺序重要吗？

重要。插件按 `.use()` 的注册顺序执行。推荐顺序：

1. `TypeOrmPlugin` — 生成 Entity 和 Repository（其他插件依赖这些类名）
2. `ServiceGapPlugin` — 生成 Service（依赖 Entity/Repository）
3. `DtoPlugin` — 生成 DTO
4. `ModulePlugin` — 最后执行，收集所有已生成的组件进行模块注册

### Q: 生成的代码格式不美观？

引擎在落盘前会自动调用 `ts-morph` 的 `formatText()` 进行格式化（2 空格缩进）。如果需要进一步格式化，可以在生成后对输出目录运行 `prettier`。
