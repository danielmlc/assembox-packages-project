import * as path from 'path';
import { Project } from 'ts-morph';
import { GeneratorPlugin } from '../engine/plugin.interface';
import { EntityContext } from '../context/entity.context';
import { ModuleContext } from '../context/module.context';
import { mapFieldTypeToTs } from '../utils/naming';

/**
 * DTO 插件 — 生成数据传输对象
 *
 * 落地规范：
 * - XxxDto：继承平台 DTO 基类，用于响应
 * - CreateXxxDto：创建入参，带 class-validator + swagger 装饰器
 * - UpdateXxxDto：更新入参，所有字段可选
 */
export class DtoPlugin implements GeneratorPlugin {
  readonly name = 'DtoPlugin';

  async execute(
    entityCtx: EntityContext,
    _moduleCtx: ModuleContext,
    project: Project,
    outputDir: string,
  ): Promise<void> {
    const filePath = path.join(outputDir, `${entityCtx.fileName}.dto.ts`);
    const sourceFile = project.createSourceFile(filePath, '', { overwrite: true });

    // ---- imports ----
    sourceFile.addImportDeclaration({
      namedImports: ['ApiProperty', 'ApiPropertyOptional'],
      moduleSpecifier: '@nestjs/swagger',
    });
    sourceFile.addImportDeclaration({
      namedImports: ['IsString', 'IsNumber', 'IsOptional', 'IsNotEmpty'],
      moduleSpecifier: 'class-validator',
    });
    sourceFile.addImportDeclaration({
      namedImports: [entityCtx.baseDtoClass],
      moduleSpecifier: '@cs/nest-common',
    });

    // ---- 1. 响应 DTO (继承平台基类) ----
    const responseDto = sourceFile.addClass({
      name: `${entityCtx.className}Dto`,
      extends: entityCtx.baseDtoClass,
      isExported: true,
      docs: [{ description: `${entityCtx.raw.entityName} 响应 DTO` }],
    });

    // ---- 2. Create DTO ----
    const createDto = sourceFile.addClass({
      name: `Create${entityCtx.className}Dto`,
      isExported: true,
      docs: [{ description: `创建 ${entityCtx.raw.entityName} 请求参数` }],
    });

    // ---- 3. Update DTO ----
    const updateDto = sourceFile.addClass({
      name: `Update${entityCtx.className}Dto`,
      isExported: true,
      docs: [{ description: `更新 ${entityCtx.raw.entityName} 请求参数` }],
    });

    // ---- 填充字段 ----
    for (const field of entityCtx.businessFields) {
      // 跳过主键字段（主键不应出现在 Create/Update DTO 中）
      if (field.raw.primaryKey) continue;

      const tsType = mapFieldTypeToTs(field.raw.fieldType);
      const isRequired = field.raw.required && !field.raw.nullable;
      const validatorDecorator = tsType === 'number' ? 'IsNumber' : 'IsString';

      // 响应 DTO 字段
      responseDto.addProperty({
        name: field.propertyName,
        type: tsType,
        decorators: [
          {
            name: 'ApiProperty',
            arguments: [`{ description: '${field.raw.fieldName}' }`],
          },
        ],
      });

      // Create DTO 字段
      createDto.addProperty({
        name: field.propertyName,
        type: tsType,
        hasExclamationToken: isRequired,
        hasQuestionToken: !isRequired,
        decorators: [
          {
            name: isRequired ? 'ApiProperty' : 'ApiPropertyOptional',
            arguments: [`{ description: '${field.raw.fieldName}' }`],
          },
          {
            name: isRequired ? 'IsNotEmpty' : 'IsOptional',
            arguments: [],
          },
          {
            name: validatorDecorator,
            arguments: [],
          },
        ],
      });

      // Update DTO 字段（全部可选）
      updateDto.addProperty({
        name: field.propertyName,
        type: tsType,
        hasQuestionToken: true,
        decorators: [
          {
            name: 'ApiPropertyOptional',
            arguments: [`{ description: '${field.raw.fieldName}' }`],
          },
          {
            name: 'IsOptional',
            arguments: [],
          },
          {
            name: validatorDecorator,
            arguments: [],
          },
        ],
      });
    }

    console.log(`    ✓ DTO: ${entityCtx.className}Dto / Create / Update → ${entityCtx.fileName}.dto.ts`);
  }
}
