// ============================================================
// 顶层模块配置
// ============================================================

/**
 * 模块配置
 */
export interface ModuleConfig {
  /** Schema 版本（供未来升级使用） */
  $version?: string;
  /** 模块代码 */
  moduleCode: string;
  /** 模块名称 */
  moduleName: string;
  /** 数据库连接名 */
  connectionName?: string;
  /**
   * 可复用字段组片段（fragments）
   * key 为片段名，value 为字段列表；实体通过 useFragments 引用
   */
  fragments?: Record<string, FieldConfig[]>;
  /**
   * 枚举类型定义（统一管理，可跨实体复用）
   * 生成独立的 .enum.ts 文件，并在 entity / dto 中引用
   */
  enums?: EnumTypeConfig[];
  /** 实体配置列表 */
  entities: EntityConfig[];
}

// ============================================================
// 枚举类型
// ============================================================

/** 枚举类型定义 */
export interface EnumTypeConfig {
  /** 枚举类型标识，如 'OrderStatus'，生成的 TypeScript enum 名同此值 */
  enumCode: string;
  /** 枚举项列表 */
  values: EnumValueConfig[];
}

export interface EnumValueConfig {
  /** TypeScript 枚举键，如 'PENDING' */
  key: string;
  /** DB 存储值（string 或 number） */
  value: string | number;
  /** 展示标签（注释 / 前端渲染用） */
  label: string;
}

// ============================================================
// 字段配置
// ============================================================

/**
 * 字段校验规则（生成到 DTO 的 class-validator 装饰器）
 */
export interface FieldValidationConfig {
  /** 最小字符串长度 → @MinLength */
  minLength?: number;
  /** 最大字符串长度 → @MaxLength */
  maxLength?: number;
  /** 最小数值 → @Min */
  min?: number;
  /** 最大数值 → @Max */
  max?: number;
  /** 正则表达式（字符串形式） → @Matches */
  pattern?: string;
  /** 是否邮箱格式 → @IsEmail */
  isEmail?: boolean;
  /** 是否 URL 格式 → @IsUrl */
  isUrl?: boolean;
  /** 是否 UUID 格式 → @IsUUID */
  isUUID?: boolean;
  /** 是否必须为整数 → @IsInt */
  isInt?: boolean;
  /** 是否必须为正数 → @IsPositive */
  isPositive?: boolean;
  /** 自定义 class-validator 装饰器名（直接追加，如 'IsMobilePhone'） */
  custom?: string;
  /** 全局错误提示（作为各装饰器 message 选项） */
  message?: string;
}

/**
 * 字段 UI 元数据（低代码前端渲染 / 表单生成使用）
 */
export interface FieldMetaConfig {
  /** 前端表单标签（省略时回退到 fieldName） */
  label?: string;
  /** 输入框 placeholder */
  placeholder?: string;
  /** 帮助说明文字 */
  hint?: string;
  /** 展示格式（如日期 'YYYY-MM-DD'） */
  format?: string;
  /** 是否默认隐藏 */
  hidden?: boolean;
  /** 是否只读 */
  readonly?: boolean;
  /**
   * 是否出现在查询 DTO（QueryXxxDto）
   * 默认：required 字段不自动出现；显式设为 true 则出现
   */
  searchable?: boolean;
  /** 是否支持排序（生成 orderBy 参数） */
  sortable?: boolean;
}

/**
 * 字段配置
 */
export interface FieldConfig {
  /** 字段代码（JS 属性名，同时作为默认 DB 列名） */
  fieldCode: string;
  /** 字段名称（注释 / 表单标签回退值） */
  fieldName: string;
  /** 显式指定 DB 列名；省略时使用 fieldCode */
  columnName?: string;
  /**
   * 字段类型
   *
   * 语义类型（推荐）：string / int / bigint / decimal / boolean / date / datetime / text / json
   * SQL 类型别名：varchar / char / tinyint / smallint / float / double / longtext
   * 扩展类型：
   *   - enum   枚举，需配合 enumCode 引用 ModuleConfig.enums 中的定义
   *   - virtual 虚拟/计算字段，不写入 DB，需配合 virtualExpr 定义取值表达式
   */
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
    // SQL 类型别名（存储层直接透传）
    | 'varchar'
    | 'char'
    | 'tinyint'
    | 'smallint'
    | 'float'
    | 'double'
    | 'longtext'
    // 扩展类型
    | 'enum'
    | 'virtual';
  /**
   * 枚举引用（fieldType = 'enum' 时必填）
   * 引用 ModuleConfig.enums[].enumCode
   */
  enumCode?: string;
  /**
   * 虚拟字段计算表达式（fieldType = 'virtual' 时使用）
   * 支持 ExpressionParser 的 ${} 语法
   */
  virtualExpr?: string;
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
  /**
   * 字段校验规则
   * 消费方：DtoGenerator → 生成 class-validator 装饰器
   */
  validation?: FieldValidationConfig;
  /**
   * 字段 UI 元数据
   * 消费方：前端低代码渲染引擎 / QueryDTO 字段过滤
   */
  meta?: FieldMetaConfig;
}

// ============================================================
// 实体关联关系
// ============================================================

/** 实体关联关系配置（TypeORM 关系装饰器） */
export interface RelationConfig {
  /** 关联类型 */
  type: 'OneToOne' | 'OneToMany' | 'ManyToOne' | 'ManyToMany';
  /** 目标实体 entityCode（同一模块内）或完整类名（跨模块时） */
  target: string;
  /** 当前实体侧的属性名 */
  propertyName: string;
  /** 外键列名（OneToOne / ManyToOne 使用 @JoinColumn） */
  joinColumn?: string;
  /** 中间表名（ManyToMany 使用 @JoinTable） */
  joinTable?: string;
  /** 是否级联（cascade: true） */
  cascade?: boolean;
  /** 是否 eager 加载 */
  eager?: boolean;
  /** 是否可空（影响外键 nullable） */
  nullable?: boolean;
  /** 反向关联属性名（inverseSide，用于双向关联） */
  inverseSide?: string;
}

/** 数据库索引配置 */
export interface IndexConfig {
  /** 索引字段列表（使用 fieldCode） */
  fields: string[];
  /** 是否唯一索引 */
  unique?: boolean;
  /** 显式索引名（省略时自动生成） */
  name?: string;
}

// ============================================================
// 生命周期钩子
// ============================================================

/**
 * 实体生命周期钩子
 * 每个钩子接受步骤列表，生成到 Service 对应 CRUD 方法的前/后位置
 */
export interface EntityHooksConfig {
  /** 创建前（可校验 / 修改 dto，可 throw 阻止操作） */
  beforeCreate?: LogicStepConfig[];
  /** 创建后 */
  afterCreate?: LogicStepConfig[];
  /** 更新前 */
  beforeUpdate?: LogicStepConfig[];
  /** 更新后 */
  afterUpdate?: LogicStepConfig[];
  /** 删除前 */
  beforeDelete?: LogicStepConfig[];
  /** 删除后 */
  afterDelete?: LogicStepConfig[];
}

// ============================================================
// 服务依赖
// ============================================================

/**
 * 服务依赖配置（注入其他 Service）
 */
export interface ServiceDependency {
  /** 服务类名，如 'OrderService' */
  service: string;
  /** 注入属性名，如 'orderService' */
  property: string;
  /** 导入路径（省略时自动推断为同目录 kebab-case） */
  module?: string;
}

// ============================================================
// 实体配置
// ============================================================

/** 生成文件控制 */
export interface GenerationControl {
  /** 是否生成 entity 文件（default: true） */
  entity?: boolean;
  /** 是否生成 dto 文件（default: true） */
  dto?: boolean;
  /** 是否生成 service 文件（default: true） */
  service?: boolean;
  /** 是否生成 controller 文件（default: true） */
  controller?: boolean;
  /** 是否生成 module 文件（default: true） */
  module?: boolean;
}

/**
 * 实体配置
 */
export interface EntityConfig {
  /** 实体代码（文件名 / 类名前缀） */
  entityCode: string;
  /** 实体名称（注释 / Swagger 标签） */
  entityName: string;
  /** 表名 */
  tableName: string;
  /**
   * 是否继承平台基础实体类 HasPrimaryFullEntity（default: true）
   * false 时生成裸实体，需在 fields 中自定义主键，适用于纯关联表等场景
   */
  useBaseEntity?: boolean;
  /**
   * 引用 ModuleConfig.fragments 中的字段组（追加到 fields 末尾）
   * 示例：['tenantFields', 'auditFields']
   */
  useFragments?: string[];
  /** 字段列表 */
  fields: FieldConfig[];
  /** 关联关系列表 */
  relations?: RelationConfig[];
  /** 数据库索引 */
  indexes?: IndexConfig[];
  /** 生命周期钩子 */
  hooks?: EntityHooksConfig;
  /** 服务方法配置（不填则生成默认 CRUD 方法） */
  serviceMethods?: ServiceMethodConfig[];
  /** 服务依赖（需注入的其他 Service） */
  dependencies?: ServiceDependency[];
  /** API 路由前缀（省略时使用 entityCode） */
  apiPrefix?: string;
  /**
   * 生成文件控制
   * 优先级高于顶层的 generateService / generateController（向后兼容）
   */
  generation?: GenerationControl;
  /**
   * @deprecated 使用 generation.service 替代
   * 是否生成 Service（default: true）
   */
  generateService?: boolean;
  /**
   * @deprecated 使用 generation.controller 替代
   * 是否生成 Controller（default: true）
   */
  generateController?: boolean;
}

// ============================================================
// 服务方法配置
// ============================================================

/**
 * 服务方法配置
 */
export interface ServiceMethodConfig {
  /** 方法名 */
  methodName: string;
  /** 方法描述（JSDoc） */
  description?: string;
  /** 是否异步（default: true） */
  async?: boolean;
  /** 参数列表 */
  parameters?: MethodParameterConfig[];
  /** 返回类型 */
  returnType?: string;
  /** 执行步骤列表 */
  steps: LogicStepConfig[];
}

/**
 * 方法参数配置
 */
export interface MethodParameterConfig {
  /** 参数名 */
  name: string;
  /** 参数类型（TypeScript 类型字符串） */
  type: string;
  /** 是否可选 */
  optional?: boolean;
  /** 默认值 */
  defaultValue?: any;
  /** 描述 */
  description?: string;
}

// ============================================================
// 逻辑步骤配置（discriminated union，消除 config: any）
// ============================================================

/**
 * 逻辑步骤配置（discriminated union by `type`）
 *
 * 使用方：switch(step.type) 后 TypeScript 自动收窄 step.config 类型
 */
export type LogicStepConfig =
  | { type: 'declare';     comment?: string; config: DeclareStepConfig }
  | { type: 'assign';      comment?: string; config: AssignStepConfig }
  | { type: 'query';       comment?: string; config: QueryStepConfig }
  | { type: 'queryOne';    comment?: string; config: QueryOneStepConfig }
  | { type: 'count';       comment?: string; config: CountStepConfig }
  | { type: 'exists';      comment?: string; config: ExistsStepConfig }
  | { type: 'save';        comment?: string; config: SaveStepConfig }
  | { type: 'update';      comment?: string; config: UpdateStepConfig }
  | { type: 'delete';      comment?: string; config: DeleteStepConfig }
  | { type: 'validate';    comment?: string; config: ValidateStepConfig }
  | { type: 'transform';   comment?: string; config: TransformStepConfig }
  | { type: 'condition';   comment?: string; config: ConditionStepConfig }
  | { type: 'loop';        comment?: string; config: LoopStepConfig }
  | { type: 'call';        comment?: string; config: CallStepConfig }
  | { type: 'transaction'; comment?: string; config: TransactionStepConfig }
  | { type: 'tryCatch';    comment?: string; config: TryCatchStepConfig }
  | { type: 'return';      comment?: string; config: ReturnStepConfig }
  | { type: 'throw';       comment?: string; config: ThrowStepConfig }
  | { type: 'log';         comment?: string; config: LogStepConfig };

/** 步骤类型联合（供外部引用） */
export type StepType = LogicStepConfig['type'];

// ============================================================
// 各步骤 config 接口定义
// ============================================================

/** declare 步骤：声明变量 → `let/const name: type = initialValue` */
export interface DeclareStepConfig {
  /** 变量名 */
  name: string;
  /** TypeScript 类型字符串 */
  type: string;
  /** 初始值表达式（省略则为 undefined） */
  initialValue?: Expression;
  /** 是否使用 const（default: false → let） */
  const?: boolean;
}

/** assign 步骤：赋值 → `target = value` */
export interface AssignStepConfig {
  /** 赋值目标（变量名或属性路径，如 'order.status'） */
  target: string;
  /** 值表达式 */
  value: Expression;
}

/** query 步骤：列表查询 → `repo.find(...)` */
export interface QueryStepConfig {
  /** 结果变量名 */
  result: string;
  /** WHERE 条件列表（AND 组合） */
  where?: WhereCondition[];
  /** 排序 */
  orderBy?: OrderByConfig[];
  /** 分页（省略则不分页） */
  pagination?: PaginationConfig;
  /** select 指定字段（省略则全选） */
  select?: string[];
}

/** queryOne 步骤：单条查询 → `repo.findOne(...)` */
export interface QueryOneStepConfig {
  /** 结果变量名 */
  result: string;
  /** WHERE 条件列表 */
  where: WhereCondition[];
  /** 查询不到时的行为（default: 'none'） */
  notFoundBehavior?: 'throw' | 'none';
  /** notFoundBehavior = 'throw' 时的错误提示 */
  notFoundMessage?: string;
}

/** count 步骤：计数 → `repo.count(...)` */
export interface CountStepConfig {
  /** 结果变量名 */
  result: string;
  /** WHERE 条件列表（省略则全表计数） */
  where?: WhereCondition[];
}

/** exists 步骤：存在性检查 → `repo.exists(...)` */
export interface ExistsStepConfig {
  /** 结果变量名（boolean） */
  result: string;
  /** WHERE 条件列表 */
  where: WhereCondition[];
}

/** save 步骤：新增保存 → `repo.create(...) + repo.save(...)` */
export interface SaveStepConfig {
  /** 返回值变量名（省略则不捕获） */
  result?: string;
  /** 数据来源 */
  data: SaveDataSource;
}

export type SaveDataSource =
  | { type: 'param'; name: string }                     // 直接使用方法参数
  | { type: 'build'; fields: FieldAssignment[] };        // 逐字段构建

/** update 步骤：更新 → `repo.update(where, data)` */
export interface UpdateStepConfig {
  /** WHERE 条件 */
  where: WhereCondition[];
  /** 更新数据 */
  data: UpdateDataSource;
}

export type UpdateDataSource =
  | { type: 'param'; name: string }
  | { type: 'build'; fields: FieldAssignment[] };

/** delete 步骤：删除 → `repo.delete(where)` */
export interface DeleteStepConfig {
  /** WHERE 条件 */
  where: WhereCondition[];
}

/** validate 步骤：业务校验（条件不满足则抛出异常） */
export interface ValidateStepConfig {
  /** 校验规则列表（依次执行） */
  rules: ValidationRule[];
}

export interface ValidationRule {
  /** 条件表达式（为 true 时通过校验） */
  condition: Expression;
  /** 校验失败提示 */
  message: Expression | string;
  /** 异常类型（default: 'BadRequest'） */
  exceptionType?: ExceptionType;
}

/** transform 步骤：数据转换（map/reduce 等） */
export interface TransformStepConfig {
  /** 结果变量名 */
  result: string;
  /** 源数据表达式 */
  source: Expression;
  /** 转换类型 */
  mode: 'map' | 'filter' | 'reduce' | 'custom';
  /** 迭代变量名（map/filter/reduce） */
  itemVar?: string;
  /** 索引变量名 */
  indexVar?: string;
  /** 每项转换表达式 / 过滤条件表达式 */
  expr?: Expression;
  /** reduce 初始值 */
  initialValue?: Expression;
  /** accumulator 变量名（reduce 用） */
  accVar?: string;
}

/** loop 步骤：遍历集合，依次执行 body 步骤 */
export interface LoopStepConfig {
  /** 要遍历的集合（表达式） */
  source: Expression;
  /** 迭代变量名（如 'item'） */
  itemVar: string;
  /** 索引变量名（可选，如 'index'） */
  indexVar?: string;
  /** 循环体步骤 */
  body: LogicStepConfig[];
}

/** condition 步骤：if / else if / else 分支 */
export interface ConditionStepConfig {
  /** if 分支 */
  if: ConditionBranch;
  /** else if 链（可选） */
  elseIf?: ConditionBranch[];
  /** else 步骤（可选） */
  else?: LogicStepConfig[];
}

/** condition 步骤中的一个分支 */
export interface ConditionBranch {
  /** 条件列表（field 为 JS 变量路径，如 'count'、'user.status'） */
  conditions: WhereCondition[];
  /** 满足条件时执行的步骤 */
  then: LogicStepConfig[];
}

/** call 步骤：调用 this 或依赖服务的方法 */
export interface CallStepConfig {
  /** 结果变量名（省略则不捕获返回值） */
  result?: string;
  /** 注入服务的属性名（如 'orderService'）；省略则调用 this 上的方法 */
  service?: string;
  /** 方法名 */
  method: string;
  /** 参数列表 */
  args?: Expression[];
  /** 是否 await（default: true） */
  await?: boolean;
}

/** transaction 步骤：数据库事务包裹 */
export interface TransactionStepConfig {
  /** 事务内步骤 */
  steps: LogicStepConfig[];
  /** 发生错误时的处理（省略则直接 throw） */
  onError?: {
    /** 记录日志（表达式） */
    log?: Expression;
    /** 是否继续抛出（default: true） */
    throw?: boolean;
  };
}

/** tryCatch 步骤：try / catch / finally */
export interface TryCatchStepConfig {
  /** try 块步骤 */
  try: LogicStepConfig[];
  /** catch 块 */
  catch: {
    /** catch(e) 中的错误变量名 */
    errorVar: string;
    /** catch 块步骤 */
    steps: LogicStepConfig[];
  };
  /** finally 块步骤（可选） */
  finally?: LogicStepConfig[];
}

/** return 步骤 */
export interface ReturnStepConfig {
  /** 返回值表达式（省略则 return;） */
  value?: Expression;
}

/** throw 步骤：抛出异常 */
export interface ThrowStepConfig {
  /** 异常类型（default: 'BadRequest'） */
  exceptionType?: ExceptionType;
  /** 异常消息表达式 */
  message: Expression;
}

/** log 步骤：记录日志 */
export interface LogStepConfig {
  /** 日志级别（default: 'debug'） */
  level?: 'debug' | 'log' | 'warn' | 'error' | 'verbose';
  /** 日志消息表达式 */
  message: Expression;
}

// ============================================================
// 共用子类型
// ============================================================

/**
 * 表达式类型
 * literal：字面量（字符串/数字/布尔/null）
 * expr：含 ${} 模板的表达式字符串，由 ExpressionParser 解析
 */
export interface Expression {
  /** 字面量（直接序列化为代码） */
  literal?: any;
  /** 表达式字符串（支持 ${param:x} / ${var:x} / ${ctx:x} / ${fn:x} / ${item:x}） */
  expr?: string;
}

/**
 * WHERE 条件
 */
export interface WhereCondition {
  /** 字段名（DB 列 / JS 变量路径） */
  field: string;
  /** 比较操作符 */
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
  /** 比较值（isNull / isNotNull 时可省略） */
  value: Expression;
  /** 与前一条件的逻辑组合（default: 'and'） */
  logic?: 'and' | 'or';
}

/** 排序配置 */
export interface OrderByConfig {
  field: string;
  direction: 'ASC' | 'DESC';
}

/** 分页配置 */
export interface PaginationConfig {
  page: Expression;
  pageSize: Expression;
}

/** 字段赋值（用于 build 模式的 save / update） */
export interface FieldAssignment {
  /** 目标字段名 */
  field: string;
  /** 值表达式 */
  value: Expression;
}

/** 异常类型 */
export type ExceptionType =
  | 'BadRequest'
  | 'NotFound'
  | 'Forbidden'
  | 'Unauthorized'
  | 'Conflict'
  | 'UnprocessableEntity'
  | 'InternalServerError';
