/**
 * 统一命名转换工具
 * 消除各 Generator 中重复的 toPascalCase/toCamelCase/toKebabCase
 */

/** snake_case / kebab-case → PascalCase */
export function toPascalCase(str: string): string {
  return str
    .replace(/(?:^|[-_])(\w)/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(\w)/, (_, c) => c.toUpperCase());
}

/** snake_case / kebab-case → camelCase */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** snake_case / PascalCase / camelCase → kebab-case */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]/g, '-')
    .toLowerCase();
}

/**
 * 语义类型 → TypeScript 类型映射
 */
const TS_TYPE_MAP: Record<string, string> = {
  // 语义类型
  string: 'string',
  int: 'number',
  bigint: 'string',
  decimal: 'number',
  boolean: 'number',
  date: 'Date',
  datetime: 'Date',
  text: 'string',
  json: 'any',
  // SQL 类型别名
  varchar: 'string',
  char: 'string',
  tinyint: 'number',
  smallint: 'number',
  float: 'number',
  double: 'number',
  longtext: 'string',
};

/** 字段类型 → TypeScript 类型 */
export function mapFieldTypeToTs(fieldType: string): string {
  return TS_TYPE_MAP[fieldType] || 'any';
}

/**
 * 语义类型 → 数据库类型映射
 */
const DB_TYPE_MAP: Record<string, string> = {
  string: 'varchar',
  int: 'int',
  bigint: 'bigint',
  decimal: 'decimal',
  boolean: 'tinyint',
  date: 'date',
  datetime: 'datetime',
  text: 'text',
  json: 'json',
};

/** SQL 类型别名集合（直接透传） */
const SQL_TYPES = new Set([
  'varchar', 'char', 'tinyint', 'smallint', 'int', 'bigint',
  'float', 'double', 'decimal', 'date', 'datetime', 'text', 'longtext', 'json',
]);

/** 字段类型 → 数据库列类型 */
export function mapFieldTypeToDb(fieldType: string): string {
  if (SQL_TYPES.has(fieldType)) return fieldType;
  return DB_TYPE_MAP[fieldType] || 'varchar';
}
