import { EntityConfig, FieldConfig, CsBaseEntityClass } from '../types/meta-schema';
import { toPascalCase, toCamelCase, toKebabCase } from '../utils/naming';

// =========================================================================
// 各基类自带的审计字段池（数据库列名 / JS 属性名）
// 引擎在生成业务字段时，会自动剔除这些字段，交由基类接管
// =========================================================================

/** HasOnlyPrimaryEntity 字段：仅 id */
const ONLY_PRIMARY_FIELDS = new Set(['id']);

/** HasPrimaryEntity 在 HasOnlyPrimaryEntity 基础上增加审计字段 */
const PRIMARY_FIELDS = new Set([
  ...ONLY_PRIMARY_FIELDS,
  'created_at', 'createdAt',
  'creator_id', 'creatorId',
  'creator_name', 'creatorName',
  'modifier_at', 'modifierAt',
  'modifier_id', 'modifierId',
  'modifier_name', 'modifierName',
]);

/** HasPrimaryFullEntity 在 HasPrimaryEntity 基础上增加状态控制字段 */
const PRIMARY_FULL_FIELDS = new Set([
  ...PRIMARY_FIELDS,
  'is_removed', 'isRemoved',
  'version',
  'sort_code', 'sortCode',
  'is_enable', 'isEnable',
]);

/** 树形结构字段 */
const TREE_FIELDS = new Set([
  'parent_id', 'parentId',
  'full_id', 'fullId',
  'full_name', 'fullName',
  'level',
  'is_leaf', 'isLeaf',
]);

/** HasPrimaryTreeEntity = HasPrimaryEntity + Tree */
const PRIMARY_TREE_FIELDS = new Set([...PRIMARY_FIELDS, ...TREE_FIELDS]);

/** HasPrimaryFullTreeEntity = HasPrimaryFullEntity + Tree */
const PRIMARY_FULL_TREE_FIELDS = new Set([...PRIMARY_FULL_FIELDS, ...TREE_FIELDS]);

/**
 * 根据基类类型获取该基类自带的字段集合
 */
function getBaseClassFields(baseClass: CsBaseEntityClass): Set<string> {
  switch (baseClass) {
    case 'HasOnlyPrimaryEntity':
      return ONLY_PRIMARY_FIELDS;
    case 'HasPrimaryEntity':
      return PRIMARY_FIELDS;
    case 'HasPrimaryFullEntity':
      return PRIMARY_FULL_FIELDS;
    case 'HasPrimaryTreeEntity':
      return PRIMARY_TREE_FIELDS;
    case 'HasPrimaryFullTreeEntity':
      return PRIMARY_FULL_TREE_FIELDS;
    default:
      return PRIMARY_FIELDS;
  }
}

// =========================================================================
// FieldContext
// =========================================================================

/**
 * 字段上下文 — 预计算好所有命名和类型信息
 */
export class FieldContext {
  /** camelCase 属性名（如 orderNo） */
  public readonly propertyName: string;
  /** 数据库列名（如 order_no） */
  public readonly dbColumnName: string;

  constructor(public readonly raw: FieldConfig) {
    this.propertyName = toCamelCase(raw.fieldCode);
    this.dbColumnName = raw.columnName || raw.fieldCode;
  }
}

// =========================================================================
// EntityContext
// =========================================================================

/**
 * 实体上下文 — 实体级别的"上下文大脑"
 *
 * 职责：
 * 1. 一次性计算好所有命名变体 (PascalCase/camelCase/kebab-case)
 * 2. 根据选定的基类自动推导 DTO 基类名
 * 3. 将原始字段分类为 主键 / 业务字段（自动过滤审计字段）
 */
export class EntityContext {
  // ---------- 命名规范 ----------
  /** PascalCase 类名（如 UserOrder） */
  public readonly className: string;
  /** camelCase 实例名（如 userOrder） */
  public readonly instanceName: string;
  /** kebab-case 文件名前缀（如 user-order） */
  public readonly fileName: string;

  // ---------- @cs/* 规范推导 ----------
  /** 继承的实体基类 */
  public readonly baseEntityClass: CsBaseEntityClass;
  /** 推导出的 DTO 基类（Entity → Dto） */
  public readonly baseDtoClass: string;
  /** 数据源连接名 */
  public readonly connectionName: string;

  // ---------- 字段分类 ----------
  /** 主键字段 */
  public readonly primaryKeys: FieldContext[] = [];
  /** 纯业务字段（剔除基类审计字段后） */
  public readonly businessFields: FieldContext[] = [];
  /** 所有原始字段 */
  public readonly allFields: FieldContext[] = [];

  // ---------- 生成控制 ----------
  public readonly generateController: boolean;
  public readonly generateService: boolean;
  public readonly apiPrefix: string;

  constructor(public readonly raw: EntityConfig) {
    // 1. 命名计算
    this.className = toPascalCase(raw.entityCode);
    this.instanceName = toCamelCase(raw.entityCode);
    this.fileName = toKebabCase(raw.entityCode);

    // 2. 规范推导
    this.connectionName = raw.connectionName || 'default';
    this.baseEntityClass = raw.baseClass || 'HasPrimaryEntity';
    this.baseDtoClass = this.baseEntityClass.replace('Entity', 'Dto');

    // 3. 生成控制
    this.generateController = raw.generateController !== false;
    this.generateService = raw.generateService !== false;
    this.apiPrefix = raw.apiPrefix || this.fileName;

    // 4. 字段分类
    this.parseFields(raw.fields);
  }

  /** 是否为裸实体（不继承任何基类） */
  get isRawEntity(): boolean {
    return false; // 新架构下始终继承某个基类
  }

  /** 是否使用非默认数据源 */
  get hasCustomConnection(): boolean {
    return this.connectionName !== 'default';
  }

  private parseFields(fields: FieldConfig[]): void {
    const baseFields = getBaseClassFields(this.baseEntityClass);

    for (const rawField of fields) {
      const fieldCtx = new FieldContext(rawField);
      this.allFields.push(fieldCtx);

      if (rawField.primaryKey) {
        this.primaryKeys.push(fieldCtx);
      }

      // 如果字段名（fieldCode 或 columnName）不在平台基类的保留字段池中，才算纯业务字段
      const isAuditField =
        baseFields.has(rawField.fieldCode) ||
        baseFields.has(fieldCtx.propertyName) ||
        baseFields.has(fieldCtx.dbColumnName);

      if (!isAuditField) {
        this.businessFields.push(fieldCtx);
      }
    }
  }
}
