/**
 * 模块配置
 */
export interface ModuleConfig {
  /** 模块代码 */
  moduleCode: string;
  /** 模块名称 */
  moduleName: string;
  /** 数据库连接名 */
  connectionName?: string;
  /** 实体配置列表 */
  entities: EntityConfig[];
}

/**
 * 服务依赖配置
 */
export interface ServiceDependency {
  /** 服务类名 */
  service: string;
  /** 属性名 */
  property: string;
  /** 模块路径（可选） */
  module?: string;
}

/**
 * 实体配置
 */
export interface EntityConfig {
  /** 实体代码 */
  entityCode: string;
  /** 实体名称 */
  entityName: string;
  /** 表名 */
  tableName: string;
  /** 字段列表 */
  fields: FieldConfig[];
  /** 是否生成控制器 */
  generateController?: boolean;
  /** 是否生成服务 */
  generateService?: boolean;
  /** API 路由前缀 */
  apiPrefix?: string;
  /** 服务方法配置 */
  serviceMethods?: ServiceMethodConfig[];
  /** 服务依赖（需要注入的其他服务） */
  dependencies?: ServiceDependency[];
  /**
   * 是否继承平台基础实体类 HasPrimaryFullEntity（默认 true）
   * 设为 false 时生成裸实体类，需自定义主键字段，适用于纯关联表等特殊场景
   */
  useBaseEntity?: boolean;
}

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
  /** 字段类型（支持语义类型和 SQL 类型两种格式） */
  fieldType:
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
 * 服务方法配置
 */
export interface ServiceMethodConfig {
  /** 方法名 */
  methodName: string;
  /** 方法描述 */
  description?: string;
  /** 是否异步 */
  async?: boolean;
  /** 参数列表 */
  parameters?: MethodParameterConfig[];
  /** 返回类型 */
  returnType?: string;
  /** 执行步骤 */
  steps: LogicStepConfig[];
}

/**
 * 方法参数配置
 */
export interface MethodParameterConfig {
  /** 参数名 */
  name: string;
  /** 参数类型 */
  type: string;
  /** 是否可选 */
  optional?: boolean;
  /** 默认值 */
  defaultValue?: any;
  /** 描述 */
  description?: string;
}

/**
 * 逻辑步骤配置
 */
export interface LogicStepConfig {
  /** 步骤类型 */
  type: StepType;
  /** 步骤注释 */
  comment?: string;
  /** 步骤配置 */
  config: any;
}

/**
 * 步骤类型
 */
export type StepType =
  | 'declare'
  | 'assign'
  | 'query'
  | 'queryOne'
  | 'count'
  | 'exists'
  | 'save'
  | 'update'
  | 'delete'
  | 'validate'
  | 'transform'
  | 'condition'
  | 'loop'
  | 'call'
  | 'transaction'
  | 'return'
  | 'throw'
  | 'log';

/**
 * 表达式类型
 */
export interface Expression {
  /** 字面量 */
  literal?: any;
  /** 表达式字符串 */
  expr?: string;
}

/**
 * condition 步骤中的一个分支（if / else if）
 */
export interface ConditionBranch {
  /** 条件列表（复用 WhereCondition，field 为 JS 变量路径，如 'count'、'user.status'） */
  conditions: WhereCondition[];
  /** 满足条件时执行的步骤 */
  then: LogicStepConfig[];
}

/**
 * condition 步骤配置
 */
export interface ConditionStepConfig {
  /** if 分支 */
  if: ConditionBranch;
  /** else if 链（可选） */
  elseIf?: ConditionBranch[];
  /** else 步骤（可选） */
  else?: LogicStepConfig[];
}

/**
 * call 步骤配置
 */
export interface CallStepConfig {
  /** 结果变量名（省略则不捕获返回值） */
  result?: string;
  /** 注入服务的属性名（如 'orderService'）。省略则调用 this 上的方法 */
  service?: string;
  /** 方法名 */
  method: string;
  /** 参数列表 */
  args?: Expression[];
  /** 是否 await（默认 true） */
  await?: boolean;
}

/**
 * Where 条件
 */
export interface WhereCondition {
  /** 字段 */
  field: string;
  /** 操作符 */
  operator:
    | 'eq'
    | 'ne'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'like'
    | 'in'
    | 'notIn'
    | 'isNull'
    | 'isNotNull';
  /** 值 */
  value: Expression;
  /** 逻辑组合 */
  logic?: 'and' | 'or';
}
