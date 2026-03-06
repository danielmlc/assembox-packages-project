/**
 * 平台支持的实体基类枚举（严格遵循 @cs/nest-typeorm 规范）
 *
 * - HasOnlyPrimaryEntity:       仅含 id 主键
 * - HasPrimaryEntity:           含 id + 创建/修改审计字段
 * - HasPrimaryFullEntity:       含 id + 审计字段 + version/sortCode/isEnable/isRemoved
 * - HasPrimaryTreeEntity:       含 id + 审计字段 + 树形结构字段 (parentId/fullId/level...)
 * - HasPrimaryFullTreeEntity:   HasPrimaryFullEntity + 树形结构字段
 */
export type CsBaseEntityClass =
  | 'HasOnlyPrimaryEntity'
  | 'HasPrimaryEntity'
  | 'HasPrimaryFullEntity'
  | 'HasPrimaryTreeEntity'
  | 'HasPrimaryFullTreeEntity';

/**
 * 字段类型 — 支持语义类型和 SQL 类型别名
 */
export type FieldType =
  // 语义类型（推荐）
  | 'string'
  | 'int'
  | 'bigint'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'text'
  | 'json'
  // SQL 类型别名（存储层兼容）
  | 'varchar'
  | 'char'
  | 'tinyint'
  | 'smallint'
  | 'float'
  | 'double'
  | 'longtext';

/**
 * 字段配置
 */
export interface FieldConfig {
  /** 字段代码（JS 属性名，同时作为默认 DB 列名） */
  fieldCode: string;
  /** 字段名称（注释） */
  fieldName: string;
  /** 显式指定 DB 列名；省略时使用 fieldCode */
  columnName?: string;
  /** 字段类型 */
  fieldType: FieldType;
  /** 长度 */
  length?: number;
  /** 精度 */
  precision?: number;
  /** 小数位 */
  scale?: number;
  /** 是否主键 */
  primaryKey?: boolean;
  /** 是否必填 */
  required?: boolean;
  /** 是否可空 */
  nullable?: boolean;
  /** 默认值 */
  defaultValue?: any;
}

/**
 * 实体配置
 */
export interface EntityConfig {
  /** 实体代码（如 "user_order"） */
  entityCode: string;
  /** 实体名称（如 "用户订单表"） */
  entityName: string;
  /** 数据库表名（如 "t_user_order"） */
  tableName: string;
  /** 字段列表 */
  fields: FieldConfig[];
  /** 继承的平台基类（默认 HasPrimaryEntity） */
  baseClass?: CsBaseEntityClass;
  /** 数据源连接名（对应 config.yaml 中的 connectionName） */
  connectionName?: string;
  /** 是否生成控制器（默认 true） */
  generateController?: boolean;
  /** 是否生成服务（默认 true） */
  generateService?: boolean;
  /** API 路由前缀 */
  apiPrefix?: string;
}

/**
 * 模块配置 — 代码生成的顶层输入
 */
export interface ModuleConfig {
  /** 模块代码（如 "order"） */
  moduleCode: string;
  /** 模块名称（如 "订单模块"） */
  moduleName: string;
  /** 数据库连接名（模块级默认值，实体级可覆盖） */
  connectionName?: string;
  /** 实体配置列表 */
  entities: EntityConfig[];
}
