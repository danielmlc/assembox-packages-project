import { Project, SourceFile, ClassDeclaration, Scope } from 'ts-morph';
import { EntityConfig } from '../types/config';

/**
 * Controller 生成器
 */
export class ControllerGenerator {
  private project: Project;

  constructor() {
    this.project = new Project();
  }

  /**
   * 生成 Controller 文件内容
   */
  generate(entity: EntityConfig): string {
    const sourceFile = this.project.createSourceFile(
      `${entity.entityCode}.controller.ts`,
      '',
      {
        overwrite: true,
      },
    );

    // 1. 添加导入
    this.addImports(sourceFile, entity);

    // 2. 生成 Controller 类
    const controllerClass = this.generateControllerClass(sourceFile, entity);

    // 3. 生成构造函数
    this.generateConstructor(controllerClass, entity);

    // 4. 生成 CRUD 方法
    this.generateCrudMethods(controllerClass, entity);

    return sourceFile.getFullText();
  }

  /**
   * 添加导入语句
   */
  private addImports(sourceFile: SourceFile, entity: EntityConfig): void {
    sourceFile.addImportDeclaration({
      namedImports: [
        'Controller',
        'Get',
        'Post',
        'Put',
        'Delete',
        'Body',
        'Query',
        'Param',
      ],
      moduleSpecifier: '@nestjs/common',
    });

    sourceFile.addImportDeclaration({
      namedImports: ['ApiTags', 'ApiOperation', 'ApiResponse'],
      moduleSpecifier: '@nestjs/swagger',
    });

    const entityName = this.toPascalCase(entity.entityCode);
    const serviceName = `${entityName}Service`;

    sourceFile.addImportDeclaration({
      namedImports: [serviceName],
      moduleSpecifier: `./${entity.entityCode}.service`,
    });

    sourceFile.addImportDeclaration({
      namedImports: [
        `Create${entityName}Dto`,
        `Update${entityName}Dto`,
        `Query${entityName}Dto`,
      ],
      moduleSpecifier: `./${entity.entityCode}.dto`,
    });

    sourceFile.addImportDeclaration({
      namedImports: [entityName],
      moduleSpecifier: `./${entity.entityCode}.entity`,
    });
  }

  /**
   * 生成 Controller 类
   */
  private generateControllerClass(
    sourceFile: SourceFile,
    entity: EntityConfig,
  ): ClassDeclaration {
    const className = this.toPascalCase(entity.entityCode) + 'Controller';
    const apiPrefix = entity.apiPrefix || this.toKebabCase(entity.entityCode);

    return sourceFile.addClass({
      name: className,
      isExported: true,
      decorators: [
        {
          name: 'ApiTags',
          arguments: [`'${entity.entityName}管理'`],
        },
        {
          name: 'Controller',
          arguments: [`'${apiPrefix}'`],
        },
      ],
      docs: [
        {
          description: `${entity.entityName}控制器`,
        },
      ],
    });
  }

  /**
   * 生成构造函数
   */
  private generateConstructor(
    controllerClass: ClassDeclaration,
    entity: EntityConfig,
  ): void {
    const entityName = this.toPascalCase(entity.entityCode);
    const serviceName = `${this.toCamelCase(entity.entityCode)}Service`;
    const serviceType = `${entityName}Service`;

    controllerClass.addConstructor({
      parameters: [
        {
          name: serviceName,
          type: serviceType,
          scope: Scope.Private,
          isReadonly: true,
        },
      ],
    });
  }

  /**
   * 生成 CRUD 方法
   */
  private generateCrudMethods(
    controllerClass: ClassDeclaration,
    entity: EntityConfig,
  ): void {
    const entityName = this.toPascalCase(entity.entityCode);
    const serviceName = `this.${this.toCamelCase(entity.entityCode)}Service`;
    const primaryKeys = entity.fields.filter((f) => f.primaryKey);

    // POST create
    controllerClass.addMethod({
      name: 'create',
      isAsync: true,
      decorators: [
        { name: 'Post', arguments: [] },
        {
          name: 'ApiOperation',
          arguments: [`{ summary: '创建${entity.entityName}记录' }`],
        },
        {
          name: 'ApiResponse',
          arguments: [
            `{ status: 201, description: '创建成功', type: ${entityName} }`,
          ],
        },
      ],
      parameters: [
        {
          name: 'createDto',
          type: `Create${entityName}Dto`,
          decorators: [{ name: 'Body', arguments: [] }],
        },
      ],
      returnType: `Promise<${entityName}>`,
      statements: `return await ${serviceName}.create(createDto);`,
    });

    // GET findMany
    controllerClass.addMethod({
      name: 'findMany',
      isAsync: true,
      decorators: [
        { name: 'Get', arguments: [] },
        {
          name: 'ApiOperation',
          arguments: [`{ summary: '查询${entity.entityName}记录列表' }`],
        },
        {
          name: 'ApiResponse',
          arguments: [
            `{ status: 200, description: '查询成功', type: [${entityName}] }`,
          ],
        },
      ],
      parameters: [
        {
          name: 'queryDto',
          type: `Query${entityName}Dto`,
          decorators: [{ name: 'Query', arguments: [] }],
        },
      ],
      returnType: `Promise<${entityName}[]>`,
      statements: [
        `if (Object.keys(queryDto).length === 0) {`,
        `  return await ${serviceName}.findAll();`,
        `}`,
        `return await ${serviceName}.findMany(queryDto);`,
      ].join('\n'),
    });

    // GET count
    controllerClass.addMethod({
      name: 'count',
      isAsync: true,
      decorators: [
        { name: 'Get', arguments: [`'count'`] },
        {
          name: 'ApiOperation',
          arguments: [`{ summary: '统计${entity.entityName}记录数量' }`],
        },
        {
          name: 'ApiResponse',
          arguments: [`{ status: 200, description: '统计成功' }`],
        },
      ],
      parameters: [
        {
          name: 'queryDto',
          type: `Query${entityName}Dto`,
          hasQuestionToken: true,
          decorators: [{ name: 'Query', arguments: [] }],
        },
      ],
      returnType: 'Promise<number>',
      statements: `return await ${serviceName}.count(queryDto);`,
    });

    // 根据主键数量生成不同的 findOne/update/remove 方法
    if (primaryKeys.length === 1) {
      this.generateSinglePkMethods(controllerClass, entity, primaryKeys[0]);
    } else if (primaryKeys.length > 1) {
      this.generateCompositePkMethods(controllerClass, entity, primaryKeys);
    }
  }

  /**
   * 生成单主键方法
   */
  private generateSinglePkMethods(
    controllerClass: ClassDeclaration,
    entity: EntityConfig,
    pk: any,
  ): void {
    const entityName = this.toPascalCase(entity.entityCode);
    const serviceName = `this.${this.toCamelCase(entity.entityCode)}Service`;
    const pkName = this.toCamelCase(pk.fieldCode);

    // GET :id
    controllerClass.addMethod({
      name: 'findOne',
      isAsync: true,
      decorators: [
        { name: 'Get', arguments: [`':${pkName}'`] },
        {
          name: 'ApiOperation',
          arguments: [`{ summary: '根据${pk.fieldName}查询单条记录' }`],
        },
        {
          name: 'ApiResponse',
          arguments: [
            `{ status: 200, description: '查询成功', type: ${entityName} }`,
          ],
        },
        {
          name: 'ApiResponse',
          arguments: [`{ status: 404, description: '记录不存在' }`],
        },
      ],
      parameters: [
        {
          name: pkName,
          type: 'string',
          decorators: [{ name: 'Param', arguments: [`'${pkName}'`] }],
        },
      ],
      returnType: `Promise<${entityName}>`,
      statements: `return await ${serviceName}.findOne(${pkName});`,
    });

    // PUT :id
    controllerClass.addMethod({
      name: 'update',
      isAsync: true,
      decorators: [
        { name: 'Put', arguments: [`':${pkName}'`] },
        {
          name: 'ApiOperation',
          arguments: [`{ summary: '根据${pk.fieldName}更新记录' }`],
        },
        {
          name: 'ApiResponse',
          arguments: [
            `{ status: 200, description: '更新成功', type: ${entityName} }`,
          ],
        },
        {
          name: 'ApiResponse',
          arguments: [`{ status: 404, description: '记录不存在' }`],
        },
      ],
      parameters: [
        {
          name: pkName,
          type: 'string',
          decorators: [{ name: 'Param', arguments: [`'${pkName}'`] }],
        },
        {
          name: 'updateDto',
          type: `Update${entityName}Dto`,
          decorators: [{ name: 'Body', arguments: [] }],
        },
      ],
      returnType: `Promise<${entityName}>`,
      statements: `return await ${serviceName}.update(${pkName}, updateDto);`,
    });

    // DELETE :id
    controllerClass.addMethod({
      name: 'remove',
      isAsync: true,
      decorators: [
        { name: 'Delete', arguments: [`':${pkName}'`] },
        {
          name: 'ApiOperation',
          arguments: [`{ summary: '根据${pk.fieldName}删除记录' }`],
        },
        {
          name: 'ApiResponse',
          arguments: [`{ status: 200, description: '删除成功' }`],
        },
        {
          name: 'ApiResponse',
          arguments: [`{ status: 404, description: '记录不存在' }`],
        },
      ],
      parameters: [
        {
          name: pkName,
          type: 'string',
          decorators: [{ name: 'Param', arguments: [`'${pkName}'`] }],
        },
      ],
      returnType: 'Promise<void>',
      statements: `await ${serviceName}.remove(${pkName});`,
    });
  }

  /**
   * 生成复合主键方法
   */
  private generateCompositePkMethods(
    controllerClass: ClassDeclaration,
    entity: EntityConfig,
    primaryKeys: any[],
  ): void {
    const entityName = this.toPascalCase(entity.entityCode);
    const serviceName = `this.${this.toCamelCase(entity.entityCode)}Service`;

    // 构建路径参数
    const pathParams = primaryKeys
      .map((pk) => `:${this.toCamelCase(pk.fieldCode)}`)
      .join('/');
    const paramDecorators = primaryKeys.map((pk) => {
      const name = this.toCamelCase(pk.fieldCode);
      return {
        name,
        type: 'string',
        decorators: [{ name: 'Param', arguments: [`'${name}'`] }],
      };
    });

    const compositeKeyObj = `{ ${primaryKeys.map((pk) => this.toCamelCase(pk.fieldCode)).join(', ')} }`;

    // GET findOne
    controllerClass.addMethod({
      name: 'findOne',
      isAsync: true,
      decorators: [
        { name: 'Get', arguments: [`'${pathParams}'`] },
        {
          name: 'ApiOperation',
          arguments: [`{ summary: '根据复合主键查询单条记录' }`],
        },
        {
          name: 'ApiResponse',
          arguments: [
            `{ status: 200, description: '查询成功', type: ${entityName} }`,
          ],
        },
        {
          name: 'ApiResponse',
          arguments: [`{ status: 404, description: '记录不存在' }`],
        },
      ],
      parameters: paramDecorators,
      returnType: `Promise<${entityName}>`,
      statements: `return await ${serviceName}.findOne(${compositeKeyObj});`,
    });

    // PUT update
    controllerClass.addMethod({
      name: 'update',
      isAsync: true,
      decorators: [
        { name: 'Put', arguments: [`'${pathParams}'`] },
        {
          name: 'ApiOperation',
          arguments: [`{ summary: '根据复合主键更新记录' }`],
        },
        {
          name: 'ApiResponse',
          arguments: [
            `{ status: 200, description: '更新成功', type: ${entityName} }`,
          ],
        },
        {
          name: 'ApiResponse',
          arguments: [`{ status: 404, description: '记录不存在' }`],
        },
      ],
      parameters: [
        ...paramDecorators,
        {
          name: 'updateDto',
          type: `Update${entityName}Dto`,
          decorators: [{ name: 'Body', arguments: [] }],
        },
      ],
      returnType: `Promise<${entityName}>`,
      statements: `return await ${serviceName}.update(${compositeKeyObj}, updateDto);`,
    });

    // DELETE remove
    controllerClass.addMethod({
      name: 'remove',
      isAsync: true,
      decorators: [
        { name: 'Delete', arguments: [`'${pathParams}'`] },
        {
          name: 'ApiOperation',
          arguments: [`{ summary: '根据复合主键删除记录' }`],
        },
        {
          name: 'ApiResponse',
          arguments: [`{ status: 200, description: '删除成功' }`],
        },
        {
          name: 'ApiResponse',
          arguments: [`{ status: 404, description: '记录不存在' }`],
        },
      ],
      parameters: paramDecorators,
      returnType: 'Promise<void>',
      statements: `await ${serviceName}.remove(${compositeKeyObj});`,
    });
  }

  private toPascalCase(str: string): string {
    return str.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
  }

  private toCamelCase(str: string): string {
    return str.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
  }

  private toKebabCase(str: string): string {
    return str.replace(/_/g, '-');
  }
}
