import { Project, SourceFile, ClassDeclaration } from 'ts-morph';
import { EntityConfig, FieldConfig } from '../types/config';

/**
 * HasPrimaryFullEntity 及其父类提供的 DB 列名集合
 * 继承基类时，配置中出现这些字段会被静默跳过
 */
const BASE_ENTITY_COLUMNS = new Set([
  'id',
  'created_at',
  'creator_id',
  'creator_name',
  'modifier_at',
  'modifier_id',
  'modifier_name',
  'is_removed',
  'version',
  'sort_code',
  'is_enable',
]);

/**
 * Entity 生成器
 */
export class EntityGenerator {
  private project: Project;

  constructor() {
    this.project = new Project();
  }

  /**
   * 生成 Entity 文件内容
   */
  generate(entity: EntityConfig, connectionName?: string): string {
    const useBase = entity.useBaseEntity !== false;

    // 裸实体校验：必须有至少一个主键字段
    if (!useBase && !entity.fields.some((f) => f.primaryKey)) {
      throw new Error(
        `[EntityGenerator] Entity "${entity.entityCode}" has useBaseEntity=false but no primary key field defined.`,
      );
    }

    const sourceFile = this.project.createSourceFile(`${entity.entityCode}.entity.ts`, '', {
      overwrite: true,
    });

    // 1. 添加导入
    this.addImports(sourceFile, entity, connectionName);

    // 2. 生成 Entity 类
    const entityClass = this.generateEntityClass(sourceFile, entity);

    // 3. 生成字段
    this.generateFields(entityClass, entity.fields, entity.useBaseEntity !== false);

    // 4. 添加实体注册
    if (connectionName && connectionName !== 'default') {
      this.addEntityRegistration(sourceFile, entity, connectionName);
    }

    return sourceFile.getFullText();
  }

  /**
   * 添加导入语句
   */
  private addImports(sourceFile: SourceFile, entity: EntityConfig, connectionName?: string): void {
    const useBase = entity.useBaseEntity !== false;
    const willRegister = !!(connectionName && connectionName !== 'default');

    // typeorm 导入：裸实体有主键时需要 PrimaryColumn；
    // Column 仅在有业务字段（非基类字段）时才需要
    const typeormImports = ['Entity'];
    const hasBusinessFields = entity.fields.some(
      (f) => !f.primaryKey && !BASE_ENTITY_COLUMNS.has(f.fieldCode),
    );
    if (!useBase && entity.fields.some((f) => f.primaryKey)) {
      typeormImports.push('PrimaryColumn');
    }
    if (hasBusinessFields) {
      typeormImports.push('Column');
    }

    sourceFile.addImportDeclaration({
      namedImports: typeormImports,
      moduleSpecifier: 'typeorm',
    });

    // @cs/nest-typeorm 导入：按需引入
    const nestTypeormImports: string[] = [];
    if (useBase) nestTypeormImports.push('HasPrimaryFullEntity');
    if (willRegister) nestTypeormImports.push('registerEntity');

    if (nestTypeormImports.length > 0) {
      sourceFile.addImportDeclaration({
        namedImports: nestTypeormImports,
        moduleSpecifier: '@cs/nest-typeorm',
      });
    }
  }

  /**
   * 生成 Entity 类
   */
  private generateEntityClass(sourceFile: SourceFile, entity: EntityConfig): ClassDeclaration {
    const useBase = entity.useBaseEntity !== false;
    return sourceFile.addClass({
      name: this.toPascalCase(entity.entityCode),
      isExported: true,
      extends: useBase ? 'HasPrimaryFullEntity' : undefined,
      decorators: [
        {
          name: 'Entity',
          arguments: [`'${entity.tableName}'`],
        },
      ],
      docs: [
        {
          description: `${entity.entityName}\n该表位于数据库中`,
        },
      ],
    });
  }

  /**
   * 生成字段
   */
  private generateFields(entityClass: ClassDeclaration, fields: FieldConfig[], useBase: boolean): void {
    for (const field of fields) {
      // 继承基类时：跳过主键字段及基类已提供的列
      if (useBase && (field.primaryKey || BASE_ENTITY_COLUMNS.has(field.fieldCode))) {
        continue;
      }

      const decorators = this.getFieldDecorators(field);
      const tsType = this.mapFieldTypeToTs(field);
      const isRequired = field.required && !field.nullable;

      entityClass.addProperty({
        name: this.toCamelCase(field.fieldCode),
        type: tsType,
        hasExclamationToken: isRequired,
        hasQuestionToken: !isRequired,
        decorators,
      });
    }
  }

  /**
   * 获取字段装饰器
   */
  private getFieldDecorators(field: FieldConfig): any[] {
    const decorators = [];
    const columnOptions = this.getColumnOptions(field);

    if (field.primaryKey) {
      decorators.push({
        name: 'PrimaryColumn',
        arguments: [columnOptions],
      });
    } else {
      decorators.push({
        name: 'Column',
        arguments: [columnOptions],
      });
    }

    return decorators;
  }

  /**
   * 获取列选项
   */
  private getColumnOptions(field: FieldConfig): string {
    const options: Record<string, any> = {
      name: field.columnName ?? field.fieldCode,
      type: this.mapFieldTypeToDb(field.fieldType),
      comment: field.fieldName,
    };

    if (field.length) {
      options.length = field.length;
    }

    if (field.precision) {
      options.precision = field.precision;
    }

    if (field.scale !== undefined) {
      options.scale = field.scale;
    }

    if (field.nullable || !field.required) {
      options.nullable = true;
    }

    if (field.defaultValue !== undefined) {
      options.default = field.defaultValue;
    }

    return this.formatObject(options);
  }

  /**
   * 添加实体注册
   */
  private addEntityRegistration(
    sourceFile: SourceFile,
    entity: EntityConfig,
    connectionName: string,
  ): void {
    const entityName = this.toPascalCase(entity.entityCode);

    sourceFile.addStatements(`
// 注册实体到 ${connectionName} 数据库连接
registerEntity({
  entity: ${entityName},
  connectionName: '${connectionName}',
});
`);
  }

  /**
   * 映射字段类型到 TypeScript 类型
   * 同时支持语义类型（string/int/...）和 SQL 类型别名（varchar/tinyint/...）
   */
  private mapFieldTypeToTs(field: FieldConfig): string {
    const typeMap: Record<string, string> = {
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
    return typeMap[field.fieldType] || 'any';
  }

  /**
   * 映射字段类型到数据库类型
   * SQL 类型别名直接透传，语义类型转换为对应 SQL 类型
   */
  private mapFieldTypeToDb(type: string): string {
    const semanticToDb: Record<string, string> = {
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
    // SQL 类型别名集合，直接透传
    const sqlTypes = new Set([
      'varchar', 'char', 'tinyint', 'smallint', 'int', 'bigint',
      'float', 'double', 'decimal', 'date', 'datetime', 'text', 'longtext', 'json',
    ]);
    if (sqlTypes.has(type)) return type;
    return semanticToDb[type] || 'varchar';
  }

  /**
   * 格式化对象为代码字符串
   */
  private formatObject(obj: Record<string, any>): string {
    const entries = Object.entries(obj).map(([key, value]) => {
      return `${key}: ${JSON.stringify(value)}`;
    });
    return `{\n    ${entries.join(',\n    ')}\n  }`;
  }

  /**
   * 转换为 PascalCase
   */
  private toPascalCase(str: string): string {
    return str.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
  }

  /**
   * 转换为 camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
  }
}
