import * as fs from 'fs';
import * as path from 'path';
import { ModuleConfig, EntityConfig, FieldConfig, FieldValidationConfig, EnumTypeConfig } from './types/config';
import { EntityGenerator } from './generators/entity-generator';
import { ServiceGenerator } from './generators/service-generator';
import { ControllerGenerator } from './generators/controller-generator';

/**
 * 代码生成器
 */
export class CodeGenerator {
  private entityGenerator: EntityGenerator;
  private serviceGenerator: ServiceGenerator;
  private controllerGenerator: ControllerGenerator;

  constructor() {
    this.entityGenerator = new EntityGenerator();
    this.serviceGenerator = new ServiceGenerator();
    this.controllerGenerator = new ControllerGenerator();
  }

  /**
   * 生成模块代码
   */
  async generate(config: ModuleConfig, outputDir: string): Promise<void> {
    console.log(`\n========================================`);
    console.log(`开始生成模块: ${config.moduleName} (${config.moduleCode})`);
    console.log(`输出目录: ${outputDir}`);
    console.log(`========================================\n`);

    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const entity of config.entities) {
      console.log(
        `\n--- 生成实体: ${entity.entityName} (${entity.entityCode}) ---`,
      );

      // 生成 Entity
      const entityCode = this.entityGenerator.generate(
        entity,
        config.connectionName,
        config.enums,
      );
      const entityPath = path.join(outputDir, `${entity.entityCode}.entity.ts`);
      fs.writeFileSync(entityPath, entityCode);
      console.log(`  ✓ Entity: ${entityPath}`);

      // 生成 Service
      if (entity.generateService !== false) {
        const serviceCode = this.serviceGenerator.generate(
          entity,
          config.connectionName,
        );
        const servicePath = path.join(
          outputDir,
          `${entity.entityCode}.service.ts`,
        );
        fs.writeFileSync(servicePath, serviceCode);
        console.log(`  ✓ Service: ${servicePath}`);
      }

      // 生成 Controller
      if (entity.generateController !== false) {
        const controllerCode = this.controllerGenerator.generate(entity);
        const controllerPath = path.join(
          outputDir,
          `${entity.entityCode}.controller.ts`,
        );
        fs.writeFileSync(controllerPath, controllerCode);
        console.log(`  ✓ Controller: ${controllerPath}`);
      }

      // 生成枚举文件（仅生成该实体实际引用的枚举）
      const usedEnumCodes = new Set(
        entity.fields.filter(f => f.fieldType === 'enum' && f.enumCode).map(f => f.enumCode!),
      );
      const usedEnums = (config.enums ?? []).filter(e => usedEnumCodes.has(e.enumCode));
      if (usedEnums.length > 0) {
        const enumCode = usedEnums.map(e => this.generateEnum(e)).join('\n\n');
        const enumPath = path.join(outputDir, `${entity.entityCode}.enum.ts`);
        fs.writeFileSync(enumPath, enumCode);
        console.log(`  ✓ Enum: ${enumPath}`);
      }

      // 生成 DTO
      const dtoCode = this.generateDto(entity, config.enums);
      const dtoPath = path.join(outputDir, `${entity.entityCode}.dto.ts`);
      fs.writeFileSync(dtoPath, dtoCode);
      console.log(`  ✓ DTO: ${dtoPath}`);
    }

    // 生成 Module 文件
    const moduleCode = this.generateModule(config);
    const modulePath = path.join(outputDir, `${config.moduleCode}.module.ts`);
    fs.writeFileSync(modulePath, moduleCode);
    console.log(`\n✓ Module: ${modulePath}`);

    console.log(`\n========================================`);
    console.log(`代码生成完成!`);
    console.log(`========================================\n`);
  }

  /**
   * 生成枚举文件
   */
  private generateEnum(enumDef: EnumTypeConfig): string {
    const lines: string[] = [];
    lines.push(`/**`);
    lines.push(` * ${enumDef.enumCode} 枚举`);
    lines.push(` */`);
    lines.push(`export enum ${enumDef.enumCode} {`);
    for (const item of enumDef.values) {
      lines.push(`  /** ${item.label} */`);
      lines.push(`  ${item.key} = ${JSON.stringify(item.value)},`);
    }
    lines.push(`}`);
    lines.push('');
    lines.push(`/** ${enumDef.enumCode} 枚举标签映射 */`);
    lines.push(`export const ${enumDef.enumCode}Label: Record<${enumDef.enumCode}, string> = {`);
    for (const item of enumDef.values) {
      lines.push(`  [${enumDef.enumCode}.${item.key}]: '${item.label}',`);
    }
    lines.push(`};`);
    return lines.join('\n');
  }

  /**
   * 生成 DTO 文件
   */
  private generateDto(entity: EntityConfig, enums?: EnumTypeConfig[]): string {
    const entityName = this.toPascalCase(entity.entityCode);
    const lines: string[] = [];

    // 收集需要的 class-validator 装饰器
    const validatorImports = new Set<string>(['IsOptional', 'IsNotEmpty']);
    const allFields = entity.fields.filter(f => f.fieldType !== 'virtual');
    for (const field of allFields) {
      const tsType = this.mapFieldTypeToTs(field, enums);
      if (tsType === 'string') validatorImports.add('IsString');
      if (tsType === 'number') validatorImports.add('IsNumber');
      if (tsType === 'boolean' || tsType.includes('boolean')) validatorImports.add('IsBoolean');
      if (tsType === 'Date') validatorImports.add('IsDateString');
      if (field.fieldType === 'enum') validatorImports.add('IsEnum');
      const v = field.validation;
      if (v) {
        if (v.minLength !== undefined) validatorImports.add('MinLength');
        if (v.maxLength !== undefined) validatorImports.add('MaxLength');
        if (v.min !== undefined) validatorImports.add('Min');
        if (v.max !== undefined) validatorImports.add('Max');
        if (v.pattern) validatorImports.add('Matches');
        if (v.isEmail) validatorImports.add('IsEmail');
        if (v.isUrl) validatorImports.add('IsUrl');
        if (v.isUUID) validatorImports.add('IsUUID');
        if (v.isInt) validatorImports.add('IsInt');
        if (v.isPositive) validatorImports.add('IsPositive');
      }
    }

    // 收集枚举导入
    const enumImports = allFields
      .filter(f => f.fieldType === 'enum' && f.enumCode)
      .map(f => f.enumCode as string);
    const uniqueEnumImports = [...new Set(enumImports)];

    lines.push(`import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';`);
    lines.push(`import { ${[...validatorImports].join(', ')} } from 'class-validator';`);
    if (uniqueEnumImports.length > 0) {
      lines.push(`import { ${uniqueEnumImports.join(', ')} } from './${entity.entityCode}.enum';`);
    }
    lines.push('');

    const primaryKeys = allFields.filter(f => f.primaryKey);
    const nonPkFields = allFields.filter(f => !f.primaryKey);

    // ─── CreateDTO ───────────────────────────────────────────────
    lines.push(`/**`);
    lines.push(` * 创建${entity.entityName}DTO`);
    lines.push(` */`);
    lines.push(`export class Create${entityName}Dto {`);
    for (const field of allFields) {
      this.appendDtoField(lines, field, 'create', enums);
    }
    lines.push(`}`);
    lines.push('');

    // ─── UpdateDTO ───────────────────────────────────────────────
    lines.push(`/**`);
    lines.push(` * 更新${entity.entityName}DTO`);
    lines.push(` */`);
    lines.push(`export class Update${entityName}Dto {`);
    for (const field of nonPkFields) {
      this.appendDtoField(lines, field, 'update', enums);
    }
    lines.push(`}`);
    lines.push('');

    // ─── QueryDTO ────────────────────────────────────────────────
    // 出现在 QueryDTO 的字段：primaryKey 字段 + meta.searchable = true 的字段
    const queryFields = allFields.filter(f => f.primaryKey || f.meta?.searchable === true);
    lines.push(`/**`);
    lines.push(` * 查询${entity.entityName}DTO`);
    lines.push(` */`);
    lines.push(`export class Query${entityName}Dto {`);
    for (const field of queryFields) {
      this.appendDtoField(lines, field, 'query', enums);
    }
    lines.push(`}`);

    // ─── CompositeKeyDto ─────────────────────────────────────────
    if (primaryKeys.length > 1) {
      lines.push('');
      lines.push(`/**`);
      lines.push(` * 复合主键DTO`);
      lines.push(` */`);
      lines.push(`export class CompositeKeyDto {`);
      for (const pk of primaryKeys) {
        const fieldName = this.toCamelCase(pk.fieldCode);
        const tsType = this.mapFieldTypeToTs(pk, enums);
        lines.push(`  @ApiProperty({ description: '${pk.fieldName}' })`);
        lines.push(`  @IsNotEmpty()`);
        lines.push(`  ${fieldName}!: ${tsType};`);
        lines.push('');
      }
      lines.push(`}`);
    }

    return lines.join('\n');
  }

  /**
   * 向 DTO 追加单个字段（含 validation 装饰器）
   */
  private appendDtoField(
    lines: string[],
    field: FieldConfig,
    mode: 'create' | 'update' | 'query',
    enums?: EnumTypeConfig[],
  ): void {
    const fieldName = this.toCamelCase(field.fieldCode);
    const tsType = this.mapFieldTypeToTs(field, enums);
    // update / query 模式一律可选；create 模式按 required 判断
    const isRequired = mode === 'create' && !!field.required && !field.nullable;

    if (isRequired) {
      lines.push(`  @ApiProperty({ description: '${field.fieldName}' })`);
      lines.push(`  @IsNotEmpty()`);
    } else {
      lines.push(`  @ApiPropertyOptional({ description: '${field.fieldName}' })`);
      lines.push(`  @IsOptional()`);
    }

    // 基础类型装饰器
    if (tsType === 'string') lines.push(`  @IsString()`);
    else if (tsType === 'number') lines.push(`  @IsNumber()`);
    else if (tsType === 'boolean') lines.push(`  @IsBoolean()`);
    else if (tsType === 'Date') lines.push(`  @IsDateString()`);

    // 枚举装饰器
    if (field.fieldType === 'enum' && field.enumCode) {
      lines.push(`  @IsEnum(${field.enumCode})`);
    }

    // validation 规则装饰器
    if (field.validation && mode !== 'query') {
      this.appendValidationDecorators(lines, field.validation);
    }

    lines.push(`  ${fieldName}${isRequired ? '!' : '?'}: ${tsType};`);
    lines.push('');
  }

  /**
   * 追加 class-validator 校验装饰器
   */
  private appendValidationDecorators(lines: string[], v: FieldValidationConfig): void {
    const msgOpt = v.message ? `, { message: '${v.message}' }` : '';
    if (v.minLength !== undefined) lines.push(`  @MinLength(${v.minLength}${msgOpt})`);
    if (v.maxLength !== undefined) lines.push(`  @MaxLength(${v.maxLength}${msgOpt})`);
    if (v.min !== undefined) lines.push(`  @Min(${v.min}${msgOpt})`);
    if (v.max !== undefined) lines.push(`  @Max(${v.max}${msgOpt})`);
    if (v.pattern) lines.push(`  @Matches(/${v.pattern}/${msgOpt})`);
    if (v.isEmail) lines.push(`  @IsEmail({}${msgOpt})`);
    if (v.isUrl) lines.push(`  @IsUrl({}${msgOpt})`);
    if (v.isUUID) lines.push(`  @IsUUID(undefined${msgOpt})`);
    if (v.isInt) lines.push(`  @IsInt(${msgOpt ? msgOpt.slice(2) : ''})`);
    if (v.isPositive) lines.push(`  @IsPositive(${msgOpt ? msgOpt.slice(2) : ''})`);
    if (v.custom) lines.push(`  @${v.custom}()`);
  }

  /**
   * 生成 Module 文件
   */
  private generateModule(config: ModuleConfig): string {
    const lines: string[] = [];
    const moduleName = this.toPascalCase(config.moduleCode) + 'Module';

    lines.push(`import { Module } from '@nestjs/common';`);
    lines.push(`import { EntityRegistModule } from '@cs/nest-typeorm';`);

    for (const entity of config.entities) {
      const entityName = this.toPascalCase(entity.entityCode);
      if (entity.generateController !== false) {
        lines.push(
          `import { ${entityName}Controller } from './${entity.entityCode}.controller';`,
        );
      }
      if (entity.generateService !== false) {
        lines.push(
          `import { ${entityName}Service } from './${entity.entityCode}.service';`,
        );
      }
      lines.push(
        `import { ${entityName} } from './${entity.entityCode}.entity';`,
      );
    }

    lines.push('');
    lines.push(`/**`);
    lines.push(` * ${config.moduleName}`);
    lines.push(` */`);
    lines.push(`@Module({`);
    lines.push(`  imports: [`);
    lines.push(`    EntityRegistModule.forRepos([`);
    for (const entity of config.entities) {
      const entityName = this.toPascalCase(entity.entityCode);
      if (config.connectionName && config.connectionName !== 'default') {
        lines.push(`      {`);
        lines.push(`        entity: ${entityName},`);
        lines.push(`        connectionName: '${config.connectionName}',`);
        lines.push(`      },`);
      } else {
        lines.push(`      { entity: ${entityName} },`);
      }
    }
    lines.push(`    ]),`);
    lines.push(`  ],`);

    const controllers = config.entities
      .filter((e) => e.generateController !== false)
      .map((e) => `${this.toPascalCase(e.entityCode)}Controller`);
    if (controllers.length > 0) {
      lines.push(`  controllers: [${controllers.join(', ')}],`);
    }

    const providers = config.entities
      .filter((e) => e.generateService !== false)
      .map((e) => `${this.toPascalCase(e.entityCode)}Service`);
    if (providers.length > 0) {
      lines.push(`  providers: [${providers.join(', ')}],`);
      lines.push(`  exports: [${providers.join(', ')}],`);
    }

    lines.push(`})`);
    lines.push(`export class ${moduleName} {}`);

    return lines.join('\n');
  }

  private mapFieldTypeToTs(field: FieldConfig, enums?: EnumTypeConfig[]): string {
    // 枚举类型：使用枚举类名
    if (field.fieldType === 'enum') {
      return field.enumCode ?? 'string';
    }
    // 虚拟字段：推断为 any（实际类型由 virtualExpr 决定）
    if (field.fieldType === 'virtual') {
      return 'any';
    }
    const typeMap: Record<string, string> = {
      // 语义类型
      string: 'string',
      int: 'number',
      bigint: 'string',
      decimal: 'number',
      boolean: 'boolean',
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

  private toPascalCase(str: string): string {
    return str.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
  }

  private toCamelCase(str: string): string {
    return str.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
  }
}
