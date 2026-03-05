import * as fs from 'fs';
import * as path from 'path';
import { ModuleConfig } from './types/config';
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

      // 生成 DTO
      const dtoCode = this.generateDto(entity);
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
   * 生成 DTO 文件
   */
  private generateDto(entity: any): string {
    const entityName = this.toPascalCase(entity.entityCode);
    const lines: string[] = [];

    lines.push(
      `import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';`,
    );
    lines.push(
      `import { IsOptional, IsNotEmpty, IsString, IsNumber } from 'class-validator';`,
    );
    lines.push('');

    const primaryKeys = entity.fields.filter((f: any) => f.primaryKey);
    const nonPkFields = entity.fields.filter((f: any) => !f.primaryKey);

    // CreateDTO
    lines.push(`/**`);
    lines.push(` * 创建${entity.entityName}DTO`);
    lines.push(` */`);
    lines.push(`export class Create${entityName}Dto {`);
    for (const field of entity.fields) {
      const fieldName = this.toCamelCase(field.fieldCode);
      const tsType = this.mapFieldTypeToTs(field);
      const isRequired = field.required && !field.nullable;

      if (isRequired) {
        lines.push(`  @ApiProperty({ description: '${field.fieldName}' })`);
        lines.push(`  @IsNotEmpty()`);
      } else {
        lines.push(
          `  @ApiPropertyOptional({ description: '${field.fieldName}' })`,
        );
        lines.push(`  @IsOptional()`);
      }
      if (tsType === 'string') lines.push(`  @IsString()`);
      else if (tsType === 'number') lines.push(`  @IsNumber()`);
      lines.push(`  ${fieldName}${isRequired ? '!' : '?'}: ${tsType};`);
      lines.push('');
    }
    lines.push(`}`);
    lines.push('');

    // UpdateDTO
    lines.push(`/**`);
    lines.push(` * 更新${entity.entityName}DTO`);
    lines.push(` */`);
    lines.push(`export class Update${entityName}Dto {`);
    for (const field of nonPkFields) {
      const fieldName = this.toCamelCase(field.fieldCode);
      const tsType = this.mapFieldTypeToTs(field);
      lines.push(
        `  @ApiPropertyOptional({ description: '${field.fieldName}' })`,
      );
      lines.push(`  @IsOptional()`);
      if (tsType === 'string') lines.push(`  @IsString()`);
      else if (tsType === 'number') lines.push(`  @IsNumber()`);
      lines.push(`  ${fieldName}?: ${tsType};`);
      lines.push('');
    }
    lines.push(`}`);
    lines.push('');

    // QueryDTO
    lines.push(`/**`);
    lines.push(` * 查询${entity.entityName}DTO`);
    lines.push(` */`);
    lines.push(`export class Query${entityName}Dto {`);
    for (const field of entity.fields) {
      const fieldName = this.toCamelCase(field.fieldCode);
      const tsType = this.mapFieldTypeToTs(field);
      lines.push(
        `  @ApiPropertyOptional({ description: '${field.fieldName}' })`,
      );
      lines.push(`  @IsOptional()`);
      lines.push(`  ${fieldName}?: ${tsType};`);
      lines.push('');
    }
    lines.push(`}`);

    // 复合主键 DTO（如果有）
    if (primaryKeys.length > 1) {
      lines.push('');
      lines.push(`/**`);
      lines.push(` * 复合主键DTO`);
      lines.push(` */`);
      lines.push(`export class CompositeKeyDto {`);
      for (const pk of primaryKeys) {
        const fieldName = this.toCamelCase(pk.fieldCode);
        const tsType = this.mapFieldTypeToTs(pk);
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

  private mapFieldTypeToTs(field: any): string {
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

  private toPascalCase(str: string): string {
    return str.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
  }

  private toCamelCase(str: string): string {
    return str.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
  }
}
