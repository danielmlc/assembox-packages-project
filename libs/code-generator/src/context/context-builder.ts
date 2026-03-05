import { EntityConfig, FieldConfig, ModuleConfig, EnumTypeConfig } from '../types/config';

// ============================================================
// 命名上下文（为每个实体预计算所有命名变体）
// ============================================================

/**
 * 实体命名上下文
 *
 * 生成器不需要在内部重复调用 toPascalCase / toCamelCase / toKebabCase，
 * 直接从 context.names 取对应形式，避免命名不一致的 bug。
 */
export interface EntityNaming {
  /** 原始 entityCode（如 'order_item'） */
  raw: string;
  /** PascalCase（类名），如 'OrderItem' */
  pascal: string;
  /** camelCase（变量名），如 'orderItem' */
  camel: string;
  /** kebab-case（文件名），如 'order-item' */
  kebab: string;
  /** snake_case（DB 关联），如 'order_item' */
  snake: string;
  /** UPPER_SNAKE（常量名），如 'ORDER_ITEM' */
  upperSnake: string;
}

/**
 * 字段上下文（包含预计算的命名 + 类型信息）
 */
export interface FieldContext {
  /** 字段配置原文 */
  config: FieldConfig;
  /** 字段属性名（camelCase），如 'orderNo' */
  propName: string;
  /** DB 列名（snake_case），如 'order_no' */
  columnName: string;
  /** TypeScript 类型字符串，如 'string' / 'OrderStatus' */
  tsType: string;
  /** 数据库类型字符串，如 'varchar' / 'int' */
  dbType: string;
  /** 是否主键 */
  isPrimaryKey: boolean;
  /** 是否必填（用于 DTO） */
  isRequired: boolean;
  /** 是否可空 */
  isNullable: boolean;
  /** 是否虚拟字段（不存 DB） */
  isVirtual: boolean;
  /** 是否枚举字段 */
  isEnum: boolean;
}

/**
 * 实体生成上下文（生成器的统一输入）
 */
export interface EntityGenerationContext {
  /** 实体命名（所有命名变体） */
  names: EntityNaming;
  /** 实体配置原文 */
  config: EntityConfig;
  /** 字段上下文列表（全量） */
  fields: FieldContext[];
  /** 主键字段列表 */
  primaryKeys: FieldContext[];
  /** 非主键字段列表（业务字段） */
  businessFields: FieldContext[];
  /** 虚拟字段列表 */
  virtualFields: FieldContext[];
  /** 可存储字段（非 virtual） */
  storableFields: FieldContext[];
  /** 是否复合主键 */
  isCompositeKey: boolean;
  /** 是否继承 BaseEntity */
  useBaseEntity: boolean;
  /** 枚举类型引用集合（{ enumCode → EnumTypeConfig }） */
  enums: Map<string, EnumTypeConfig>;
  /** 所属模块信息 */
  module: {
    moduleCode: string;
    moduleName: string;
    connectionName?: string;
  };
}

/**
 * 模块生成上下文
 */
export interface ModuleGenerationContext {
  /** 模块命名 */
  names: EntityNaming;
  /** 模块配置原文 */
  config: ModuleConfig;
  /** 实体上下文列表 */
  entities: EntityGenerationContext[];
}

// ============================================================
// ContextBuilder 实现
// ============================================================

/**
 * 生成上下文构建器
 *
 * 将原始 JSON 配置转换为"生成器友好的上下文对象"，包含：
 * - 所有命名变体（camel / pascal / kebab / snake）
 * - 预计算的字段类型信息
 * - 枚举类型索引
 * - 便利分组（primaryKeys / businessFields / virtualFields）
 *
 * 用法：
 * ```
 * const ctx = ContextBuilder.buildModule(config);
 * for (const entityCtx of ctx.entities) {
 *   // entityCtx.names.pascal → 'OrderItem'
 *   // entityCtx.primaryKeys  → [FieldContext]
 * }
 * ```
 */
export class ContextBuilder {
  /**
   * 构建模块级生成上下文
   */
  static buildModule(config: ModuleConfig): ModuleGenerationContext {
    // 构建枚举索引
    const enumMap = new Map<string, EnumTypeConfig>();
    for (const e of config.enums ?? []) {
      enumMap.set(e.enumCode, e);
    }

    // 处理 fragments 展开
    const resolvedConfig = ContextBuilder.resolveFragments(config);

    const entities = resolvedConfig.entities.map(entity =>
      ContextBuilder.buildEntity(entity, resolvedConfig, enumMap),
    );

    return {
      names: ContextBuilder.buildNaming(config.moduleCode),
      config,
      entities,
    };
  }

  /**
   * 构建实体级生成上下文
   */
  static buildEntity(
    entity: EntityConfig,
    module: ModuleConfig,
    enumMap: Map<string, EnumTypeConfig>,
  ): EntityGenerationContext {
    const names = ContextBuilder.buildNaming(entity.entityCode);

    const fields: FieldContext[] = entity.fields.map(f =>
      ContextBuilder.buildField(f, enumMap),
    );

    const primaryKeys = fields.filter(f => f.isPrimaryKey);
    const businessFields = fields.filter(f => !f.isPrimaryKey && !f.isVirtual);
    const virtualFields = fields.filter(f => f.isVirtual);
    const storableFields = fields.filter(f => !f.isVirtual);

    // 收集该实体实际引用的枚举
    const entityEnums = new Map<string, EnumTypeConfig>();
    for (const f of fields) {
      if (f.isEnum && f.config.enumCode && enumMap.has(f.config.enumCode)) {
        entityEnums.set(f.config.enumCode, enumMap.get(f.config.enumCode)!);
      }
    }

    return {
      names,
      config: entity,
      fields,
      primaryKeys,
      businessFields,
      virtualFields,
      storableFields,
      isCompositeKey: primaryKeys.length > 1,
      useBaseEntity: entity.useBaseEntity !== false,
      enums: entityEnums,
      module: {
        moduleCode: module.moduleCode,
        moduleName: module.moduleName,
        connectionName: module.connectionName,
      },
    };
  }

  /**
   * 构建字段上下文
   */
  static buildField(field: FieldConfig, enumMap: Map<string, EnumTypeConfig>): FieldContext {
    const isEnum = field.fieldType === 'enum';
    const isVirtual = field.fieldType === 'virtual';

    return {
      config: field,
      propName: toCamelCase(field.fieldCode),
      columnName: field.columnName ?? field.fieldCode,
      tsType: mapToTsType(field, enumMap),
      dbType: isVirtual ? '' : mapToDbType(field.fieldType),
      isPrimaryKey: !!field.primaryKey,
      isRequired: !!field.required && !field.nullable,
      isNullable: !!field.nullable || !field.required,
      isVirtual,
      isEnum,
    };
  }

  /**
   * 构建命名上下文（所有变体）
   */
  static buildNaming(raw: string): EntityNaming {
    const pascal = toPascalCase(raw);
    const camel = toCamelCase(raw);
    const kebab = toKebabCase(raw);
    const snake = toSnakeCase(raw);
    const upperSnake = snake.toUpperCase();
    return { raw, pascal, camel, kebab, snake, upperSnake };
  }

  /**
   * 展开 fragments（将 useFragments 引用的字段组合并到 entity.fields）
   */
  private static resolveFragments(config: ModuleConfig): ModuleConfig {
    if (!config.fragments || Object.keys(config.fragments).length === 0) {
      return config;
    }

    const resolvedEntities = config.entities.map(entity => {
      if (!entity.useFragments || entity.useFragments.length === 0) {
        return entity;
      }

      const extraFields: FieldConfig[] = [];
      for (const fragName of entity.useFragments) {
        const frag = config.fragments![fragName];
        if (frag) {
          extraFields.push(...frag);
        } else {
          console.warn(`[ContextBuilder] fragment '${fragName}' not found in module '${config.moduleCode}'`);
        }
      }

      // fragment 字段追加到末尾，fields 中同名字段优先（不覆盖）
      const existingCodes = new Set(entity.fields.map(f => f.fieldCode));
      const newFields = extraFields.filter(f => !existingCodes.has(f.fieldCode));

      return {
        ...entity,
        fields: [...entity.fields, ...newFields],
      };
    });

    return { ...config, entities: resolvedEntities };
  }
}

// ============================================================
// 命名转换工具函数（模块私有）
// ============================================================

function toPascalCase(str: string): string {
  return str.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toKebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, m => `-${m.toLowerCase()}`)
    .replace(/_/g, '-')
    .replace(/^-/, '');
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, m => `_${m.toLowerCase()}`)
    .replace(/-/g, '_')
    .replace(/^_/, '');
}

function mapToTsType(field: FieldConfig, enumMap: Map<string, EnumTypeConfig>): string {
  if (field.fieldType === 'enum') return field.enumCode ?? 'string';
  if (field.fieldType === 'virtual') return 'any';

  const map: Record<string, string> = {
    string: 'string', int: 'number', bigint: 'string', decimal: 'number',
    boolean: 'boolean', date: 'Date', datetime: 'Date', text: 'string', json: 'any',
    varchar: 'string', char: 'string', tinyint: 'number', smallint: 'number',
    float: 'number', double: 'number', longtext: 'string',
  };
  return map[field.fieldType] ?? 'any';
}

function mapToDbType(fieldType: string): string {
  if (fieldType === 'enum') return 'varchar';
  const map: Record<string, string> = {
    string: 'varchar', int: 'int', bigint: 'bigint', decimal: 'decimal',
    boolean: 'tinyint', date: 'date', datetime: 'datetime', text: 'text', json: 'json',
  };
  const sqlPassthrough = new Set([
    'varchar', 'char', 'tinyint', 'smallint', 'int', 'bigint',
    'float', 'double', 'decimal', 'date', 'datetime', 'text', 'longtext', 'json',
  ]);
  if (sqlPassthrough.has(fieldType)) return fieldType;
  return map[fieldType] ?? 'varchar';
}
