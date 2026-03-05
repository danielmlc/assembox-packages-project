import { Project, SourceFile, ClassDeclaration, Scope } from 'ts-morph';
import {
  EntityConfig,
  ServiceMethodConfig,
  LogicStepConfig,
  WhereCondition,
  ConditionStepConfig,
  CallStepConfig,
  LoopStepConfig,
  TryCatchStepConfig,
} from '../types/config';
import { ExpressionParser } from '../parsers/expression-parser';

/**
 * Service 生成器
 */
export class ServiceGenerator {
  private project: Project;
  private expressionParser: ExpressionParser;

  constructor() {
    this.project = new Project();
    this.expressionParser = new ExpressionParser();
  }

  /**
   * 生成 Service 文件内容
   */
  generate(entity: EntityConfig, connectionName?: string): string {
    const sourceFile = this.project.createSourceFile(
      `${entity.entityCode}.service.ts`,
      '',
      {
        overwrite: true,
      },
    );

    // 1. 添加导入
    this.addImports(sourceFile, entity, connectionName);

    // 2. 生成 Service 类
    const serviceClass = this.generateServiceClass(sourceFile, entity);

    // 3. 生成构造函数
    this.generateConstructor(serviceClass, entity, connectionName);

    // 4. 生成方法
    if (entity.serviceMethods) {
      for (const method of entity.serviceMethods) {
        this.generateMethod(serviceClass, method, entity);
      }
    } else {
      // 生成默认的 CRUD 方法
      this.generateDefaultMethods(serviceClass, entity);
    }

    return sourceFile.getFullText();
  }

  /**
   * 添加导入语句
   */
  private addImports(
    sourceFile: SourceFile,
    entity: EntityConfig,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    connectionName?: string,
  ): void {
    sourceFile.addImportDeclaration({
      namedImports: ['Injectable', 'NotFoundException'],
      moduleSpecifier: '@nestjs/common',
    });

    sourceFile.addImportDeclaration({
      namedImports: ['Repository', 'Like'],
      moduleSpecifier: 'typeorm',
    });

    sourceFile.addImportDeclaration({
      namedImports: ['LoggerService'],
      moduleSpecifier: '@cs/nest-common',
    });

    sourceFile.addImportDeclaration({
      namedImports: ['InjectRepository'],
      moduleSpecifier: '@cs/nest-typeorm',
    });

    const entityName = this.toPascalCase(entity.entityCode);
    sourceFile.addImportDeclaration({
      namedImports: [entityName],
      moduleSpecifier: `./${entity.entityCode}.entity`,
    });

    // DTO 导入
    sourceFile.addImportDeclaration({
      namedImports: [
        `Create${entityName}Dto`,
        `Update${entityName}Dto`,
        `Query${entityName}Dto`,
      ],
      moduleSpecifier: `./${entity.entityCode}.dto`,
    });

    // 添加依赖服务的导入
    if (entity.dependencies && entity.dependencies.length > 0) {
      for (const dep of entity.dependencies) {
        sourceFile.addImportDeclaration({
          namedImports: [dep.service],
          moduleSpecifier:
            dep.module ||
            `./${this.toKebabCase(dep.service.replace(/Service$/, ''))}.service`,
        });
      }
    }
  }

  /**
   * 生成 Service 类
   */
  private generateServiceClass(
    sourceFile: SourceFile,
    entity: EntityConfig,
  ): ClassDeclaration {
    const className = this.toPascalCase(entity.entityCode) + 'Service';

    return sourceFile.addClass({
      name: className,
      isExported: true,
      decorators: [{ name: 'Injectable', arguments: [] }],
      docs: [
        {
          description: `${entity.entityName}服务`,
        },
      ],
    });
  }

  /**
   * 生成构造函数
   */
  private generateConstructor(
    serviceClass: ClassDeclaration,
    entity: EntityConfig,
    connectionName?: string,
  ): void {
    const entityName = this.toPascalCase(entity.entityCode);
    const repoName = `${this.toCamelCase(entity.entityCode)}Repository`;

    const injectArgs =
      connectionName && connectionName !== 'default'
        ? `{\n      entity: ${entityName},\n      connectionName: '${connectionName}',\n    }`
        : `{ entity: ${entityName} }`;

    const parameters: any[] = [
      {
        name: repoName,
        type: `Repository<${entityName}>`,
        decorators: [
          {
            name: 'InjectRepository',
            arguments: [injectArgs],
          },
        ],
        scope: Scope.Private,
        isReadonly: true,
      },
      {
        name: 'logger',
        type: 'LoggerService',
        scope: Scope.Private,
        isReadonly: true,
      },
    ];

    // 添加额外的服务依赖
    if (entity.dependencies && entity.dependencies.length > 0) {
      for (const dep of entity.dependencies) {
        parameters.push({
          name: dep.property,
          type: dep.service,
          scope: Scope.Private,
          isReadonly: true,
        });
      }
    }

    serviceClass.addConstructor({
      parameters,
    });
  }

  /**
   * 生成默认的 CRUD 方法
   */
  private generateDefaultMethods(
    serviceClass: ClassDeclaration,
    entity: EntityConfig,
  ): void {
    const entityName = this.toPascalCase(entity.entityCode);
    const repoName = `this.${this.toCamelCase(entity.entityCode)}Repository`;

    // create 方法
    serviceClass.addMethod({
      name: 'create',
      isAsync: true,
      parameters: [{ name: 'createDto', type: `Create${entityName}Dto` }],
      returnType: `Promise<${entityName}>`,
      docs: [{ description: '创建记录' }],
      statements: [
        `this.logger.debug('创建${entity.entityName}记录');`,
        '',
        `const entity = ${repoName}.create(createDto);`,
        `return await ${repoName}.save(entity);`,
      ].join('\n'),
    });

    // findAll 方法
    serviceClass.addMethod({
      name: 'findAll',
      isAsync: true,
      returnType: `Promise<${entityName}[]>`,
      docs: [{ description: '查询所有记录' }],
      statements: [
        `this.logger.debug('查询所有${entity.entityName}记录');`,
        `return await ${repoName}.find();`,
      ].join('\n'),
    });

    // findMany 方法
    serviceClass.addMethod({
      name: 'findMany',
      isAsync: true,
      parameters: [{ name: 'queryDto', type: `Query${entityName}Dto` }],
      returnType: `Promise<${entityName}[]>`,
      docs: [{ description: '根据条件查询记录列表' }],
      statements: this.generateFindManyBody(entity),
    });

    // findOne 方法
    this.generateFindOneMethod(serviceClass, entity);

    // update 方法
    this.generateUpdateMethod(serviceClass, entity);

    // remove 方法
    this.generateRemoveMethod(serviceClass, entity);

    // count 方法
    serviceClass.addMethod({
      name: 'count',
      isAsync: true,
      parameters: [
        {
          name: 'queryDto',
          type: `Query${entityName}Dto`,
          hasQuestionToken: true,
        },
      ],
      returnType: 'Promise<number>',
      docs: [{ description: '统计记录数量' }],
      statements: [
        `this.logger.debug('统计${entity.entityName}记录数量');`,
        '',
        `if (!queryDto) {`,
        `  return await ${repoName}.count();`,
        `}`,
        '',
        `const where: any = {};`,
        ...this.generateWhereConditions(entity.fields),
        '',
        `return await ${repoName}.count({ where });`,
      ].join('\n'),
    });
  }

  /**
   * 生成 findMany 方法体
   */
  private generateFindManyBody(entity: EntityConfig): string {
    const repoName = `this.${this.toCamelCase(entity.entityCode)}Repository`;

    const lines = [
      `this.logger.debug('查询${entity.entityName}记录列表');`,
      '',
      'const where: any = {};',
      '',
      ...this.generateWhereConditions(entity.fields),
      '',
      `return await ${repoName}.find({ where });`,
    ];

    return lines.join('\n');
  }

  /**
   * 生成 where 条件
   */
  private generateWhereConditions(fields: any[]): string[] {
    const conditions: string[] = [];

    for (const field of fields) {
      const fieldName = this.toCamelCase(field.fieldCode);

      if (field.fieldType === 'string' && !field.primaryKey) {
        // 字符串字段使用模糊查询
        conditions.push(`if (queryDto.${fieldName}) {`);
        if (field.fieldCode === 'name' || field.fieldCode.endsWith('_name')) {
          conditions.push(
            `  where.${fieldName} = Like(\`%\${queryDto.${fieldName}}%\`);`,
          );
        } else {
          conditions.push(`  where.${fieldName} = queryDto.${fieldName};`);
        }
        conditions.push(`}`);
      } else {
        // 其他字段精确匹配
        conditions.push(`if (queryDto.${fieldName} !== undefined) {`);
        conditions.push(`  where.${fieldName} = queryDto.${fieldName};`);
        conditions.push(`}`);
      }
    }

    return conditions;
  }

  /**
   * 生成 findOne 方法
   */
  private generateFindOneMethod(
    serviceClass: ClassDeclaration,
    entity: EntityConfig,
  ): void {
    const entityName = this.toPascalCase(entity.entityCode);
    const repoName = `this.${this.toCamelCase(entity.entityCode)}Repository`;

    // 获取主键字段
    const primaryKeys = entity.fields.filter((f) => f.primaryKey);

    if (primaryKeys.length === 1) {
      // 单主键
      const pk = primaryKeys[0];
      const pkName = this.toCamelCase(pk.fieldCode);
      const pkType = this.mapFieldTypeToTs(pk);

      serviceClass.addMethod({
        name: 'findOne',
        isAsync: true,
        parameters: [{ name: pkName, type: pkType }],
        returnType: `Promise<${entityName}>`,
        docs: [{ description: `根据${pk.fieldName}查询单条记录` }],
        statements: [
          `this.logger.debug(\`查询${entity.entityName}记录: ${pkName}=\${${pkName}}\`);`,
          '',
          `const record = await ${repoName}.findOne({`,
          `  where: { ${pkName} },`,
          `});`,
          '',
          `if (!record) {`,
          `  throw new NotFoundException(\`记录不存在: ${pkName}=\${${pkName}}\`);`,
          `}`,
          '',
          `return record;`,
        ].join('\n'),
      });
    } else if (primaryKeys.length > 1) {
      // 复合主键
      const paramType = `{ ${primaryKeys.map((pk) => `${this.toCamelCase(pk.fieldCode)}: ${this.mapFieldTypeToTs(pk)}`).join('; ')} }`;
      const whereObj = primaryKeys
        .map((pk) => this.toCamelCase(pk.fieldCode))
        .join(', ');
      const logStr = primaryKeys
        .map(
          (pk) =>
            `${this.toCamelCase(pk.fieldCode)}=\${compositeKey.${this.toCamelCase(pk.fieldCode)}}`,
        )
        .join(', ');

      serviceClass.addMethod({
        name: 'findOne',
        isAsync: true,
        parameters: [{ name: 'compositeKey', type: paramType }],
        returnType: `Promise<${entityName}>`,
        docs: [{ description: '根据复合主键查询单条记录' }],
        statements: [
          `this.logger.debug(\`查询${entity.entityName}记录: ${logStr}\`);`,
          '',
          `const record = await ${repoName}.findOne({`,
          `  ${whereObj},`,
          `});`,
          '',
          `if (!record) {`,
          `  throw new NotFoundException(\`记录不存在: ${logStr}\`);`,
          `}`,
          '',
          `return record;`,
        ].join('\n'),
      });
    }
  }

  /**
   * 生成 update 方法
   */
  private generateUpdateMethod(
    serviceClass: ClassDeclaration,
    entity: EntityConfig,
  ): void {
    const entityName = this.toPascalCase(entity.entityCode);
    const repoName = `this.${this.toCamelCase(entity.entityCode)}Repository`;
    const primaryKeys = entity.fields.filter((f) => f.primaryKey);

    if (primaryKeys.length === 1) {
      const pk = primaryKeys[0];
      const pkName = this.toCamelCase(pk.fieldCode);
      const pkType = this.mapFieldTypeToTs(pk);

      serviceClass.addMethod({
        name: 'update',
        isAsync: true,
        parameters: [
          { name: pkName, type: pkType },
          { name: 'updateDto', type: `Update${entityName}Dto` },
        ],
        returnType: `Promise<${entityName}>`,
        docs: [{ description: `根据${pk.fieldName}更新记录` }],
        statements: [
          `this.logger.debug(\`更新${entity.entityName}记录: ${pkName}=\${${pkName}}\`);`,
          '',
          `await this.findOne(${pkName});`,
          '',
          `await ${repoName}.update({ ${pkName} }, updateDto);`,
          '',
          `return await this.findOne(${pkName});`,
        ].join('\n'),
      });
    } else if (primaryKeys.length > 1) {
      const paramType = `{ ${primaryKeys.map((pk) => `${this.toCamelCase(pk.fieldCode)}: ${this.mapFieldTypeToTs(pk)}`).join('; ')} }`;
      const whereObj = `{ ${primaryKeys.map((pk) => `${this.toCamelCase(pk.fieldCode)}: compositeKey.${this.toCamelCase(pk.fieldCode)}`).join(', ')} }`;
      const logStr = primaryKeys
        .map(
          (pk) =>
            `${this.toCamelCase(pk.fieldCode)}=\${compositeKey.${this.toCamelCase(pk.fieldCode)}}`,
        )
        .join(', ');

      serviceClass.addMethod({
        name: 'update',
        isAsync: true,
        parameters: [
          { name: 'compositeKey', type: paramType },
          { name: 'updateDto', type: `Update${entityName}Dto` },
        ],
        returnType: `Promise<${entityName}>`,
        docs: [{ description: '根据复合主键更新记录' }],
        statements: [
          `this.logger.debug(\`更新${entity.entityName}记录: ${logStr}\`);`,
          '',
          `await this.findOne(compositeKey);`,
          '',
          `await ${repoName}.update(${whereObj}, updateDto);`,
          '',
          `return await this.findOne(compositeKey);`,
        ].join('\n'),
      });
    }
  }

  /**
   * 生成 remove 方法
   */
  private generateRemoveMethod(
    serviceClass: ClassDeclaration,
    entity: EntityConfig,
  ): void {
    const repoName = `this.${this.toCamelCase(entity.entityCode)}Repository`;
    const primaryKeys = entity.fields.filter((f) => f.primaryKey);

    if (primaryKeys.length === 1) {
      const pk = primaryKeys[0];
      const pkName = this.toCamelCase(pk.fieldCode);
      const pkType = this.mapFieldTypeToTs(pk);

      serviceClass.addMethod({
        name: 'remove',
        isAsync: true,
        parameters: [{ name: pkName, type: pkType }],
        returnType: 'Promise<void>',
        docs: [{ description: `根据${pk.fieldName}删除记录` }],
        statements: [
          `this.logger.debug(\`删除${entity.entityName}记录: ${pkName}=\${${pkName}}\`);`,
          '',
          `await this.findOne(${pkName});`,
          '',
          `await ${repoName}.delete({ ${pkName} });`,
        ].join('\n'),
      });
    } else if (primaryKeys.length > 1) {
      const paramType = `{ ${primaryKeys.map((pk) => `${this.toCamelCase(pk.fieldCode)}: ${this.mapFieldTypeToTs(pk)}`).join('; ')} }`;
      const whereObj = `{ ${primaryKeys.map((pk) => `${this.toCamelCase(pk.fieldCode)}: compositeKey.${this.toCamelCase(pk.fieldCode)}`).join(', ')} }`;
      const logStr = primaryKeys
        .map(
          (pk) =>
            `${this.toCamelCase(pk.fieldCode)}=\${compositeKey.${this.toCamelCase(pk.fieldCode)}}`,
        )
        .join(', ');

      serviceClass.addMethod({
        name: 'remove',
        isAsync: true,
        parameters: [{ name: 'compositeKey', type: paramType }],
        returnType: 'Promise<void>',
        docs: [{ description: '根据复合主键删除记录' }],
        statements: [
          `this.logger.debug(\`删除${entity.entityName}记录: ${logStr}\`);`,
          '',
          `await this.findOne(compositeKey);`,
          '',
          `await ${repoName}.delete(${whereObj});`,
        ].join('\n'),
      });
    }
  }

  /**
   * 生成自定义方法
   */
  private generateMethod(
    serviceClass: ClassDeclaration,
    method: ServiceMethodConfig,
    entity: EntityConfig,
  ): void {
    const statements = this.generateMethodBody(method.steps, entity);

    serviceClass.addMethod({
      name: method.methodName,
      isAsync: method.async !== false,
      parameters:
        method.parameters?.map((p) => ({
          name: p.name,
          type: p.type,
          hasQuestionToken: p.optional,
          initializer:
            p.defaultValue !== undefined ? String(p.defaultValue) : undefined,
        })) || [],
      returnType:
        method.async !== false
          ? `Promise<${method.returnType || 'void'}>`
          : method.returnType || 'void',
      docs: method.description
        ? [{ description: method.description }]
        : undefined,
      statements: statements.join('\n'),
    });
  }

  /**
   * 生成方法体
   */
  private generateMethodBody(
    steps: LogicStepConfig[],
    entity: EntityConfig,
  ): string[] {
    const statements: string[] = [];

    for (const step of steps) {
      if (step.comment) {
        statements.push(`// ${step.comment}`);
      }

      const stepCode = this.generateStepCode(step, entity);
      statements.push(...stepCode);
      statements.push('');
    }

    return statements;
  }

  /**
   * 生成步骤代码
   */
  private generateStepCode(
    step: LogicStepConfig,
    entity: EntityConfig,
  ): string[] {
    const repoName = `this.${this.toCamelCase(entity.entityCode)}Repository`;

    switch (step.type) {
      case 'declare':
        return this.generateDeclareStep(step.config);
      case 'assign':
        return this.generateAssignStep(step.config);
      case 'query':
        return this.generateQueryStep(step.config, repoName);
      case 'queryOne':
        return this.generateQueryOneStep(step.config, repoName);
      case 'count':
        return this.generateCountStep(step.config, repoName);
      case 'exists':
        return this.generateExistsStep(step.config, repoName);
      case 'save':
        return this.generateSaveStep(step.config, repoName);
      case 'update':
        return this.generateUpdateStep(step.config, repoName);
      case 'delete':
        return this.generateDeleteStep(step.config, repoName);
      case 'validate':
        return this.generateValidateStep(step.config);
      case 'transaction':
        return this.generateTransactionStep(step.config, entity);
      case 'return':
        return this.generateReturnStep(step.config);
      case 'throw':
        return this.generateThrowStep(step.config);
      case 'log':
        return this.generateLogStep(step.config);
      case 'condition':
        return this.generateConditionStep(step.config, entity);
      case 'call':
        return this.generateCallStep(step.config);
      case 'loop':
        return this.generateLoopStep(step.config, entity);
      case 'tryCatch':
        return this.generateTryCatchStep(step.config, entity);
      case 'transform':
        return [`// [transform] ${step.config.result} = ${step.config.mode}(...)`];
      default:
        return [`// TODO: step not implemented`];
    }
  }

  private generateDeclareStep(config: any): string[] {
    const value =
      config.initialValue !== undefined
        ? this.expressionParser.parse(config.initialValue)
        : 'undefined';
    const keyword = config.const ? 'const' : 'let';
    return [`${keyword} ${config.name}: ${config.type} = ${value};`];
  }

  private generateAssignStep(config: any): string[] {
    const value = this.expressionParser.parse(config.value);
    return [`${config.target} = ${value};`];
  }

  private generateQueryStep(config: any, repoName: string): string[] {
    const lines = [`const ${config.result} = await ${repoName}.find({`];

    if (config.where && config.where.length > 0) {
      lines.push(`  where: ${this.generateWhereObject(config.where)},`);
    }

    if (config.orderBy && config.orderBy.length > 0) {
      const order = config.orderBy
        .map((o: any) => `${o.field}: '${o.direction}'`)
        .join(', ');
      lines.push(`  order: { ${order} },`);
    }

    if (config.pagination) {
      const page = this.expressionParser.parse(config.pagination.page);
      const pageSize = this.expressionParser.parse(config.pagination.pageSize);
      lines.push(`  skip: (${page} - 1) * ${pageSize},`);
      lines.push(`  take: ${pageSize},`);
    }

    lines.push(`});`);
    return lines;
  }

  private generateQueryOneStep(config: any, repoName: string): string[] {
    const lines = [
      `const ${config.result} = await ${repoName}.findOne({`,
      `  where: ${this.generateWhereObject(config.where)},`,
      `});`,
    ];

    if (config.notFoundBehavior === 'throw') {
      lines.push(`if (!${config.result}) {`);
      lines.push(
        `  throw new NotFoundException('${config.notFoundMessage || '记录不存在'}');`,
      );
      lines.push(`}`);
    }

    return lines;
  }

  private generateCountStep(config: any, repoName: string): string[] {
    if (config.where && config.where.length > 0) {
      return [
        `const ${config.result} = await ${repoName}.count({`,
        `  where: ${this.generateWhereObject(config.where)},`,
        `});`,
      ];
    }
    return [`const ${config.result} = await ${repoName}.count();`];
  }

  private generateExistsStep(config: any, repoName: string): string[] {
    return [
      `const ${config.result} = await ${repoName}.exists({`,
      `  where: ${this.generateWhereObject(config.where)},`,
      `});`,
    ];
  }

  private generateSaveStep(config: any, repoName: string): string[] {
    const lines: string[] = [];

    if (config.data.type === 'param') {
      lines.push(`const entity = ${repoName}.create(${config.data.name});`);
    } else if (config.data.type === 'build') {
      const fields = config.data.fields.map((f: any) => {
        const value = this.expressionParser.parse(f.value);
        return `  ${f.field}: ${value},`;
      });
      lines.push(`const entity = ${repoName}.create({`);
      lines.push(...fields);
      lines.push(`});`);
    }

    if (config.result) {
      lines.push(`const ${config.result} = await ${repoName}.save(entity);`);
    } else {
      lines.push(`await ${repoName}.save(entity);`);
    }

    return lines;
  }

  private generateUpdateStep(config: any, repoName: string): string[] {
    const where = this.generateWhereObject(config.where);
    const lines: string[] = [];

    if (config.data.type === 'build') {
      const fields = config.data.fields.map((f: any) => {
        const value = this.expressionParser.parse(f.value);
        return `  ${f.field}: ${value},`;
      });
      lines.push(`await ${repoName}.update(`);
      lines.push(`  ${where},`);
      lines.push(`  {`);
      lines.push(...fields);
      lines.push(`  }`);
      lines.push(`);`);
    } else {
      lines.push(`await ${repoName}.update(${where}, ${config.data.name});`);
    }

    return lines;
  }

  private generateDeleteStep(config: any, repoName: string): string[] {
    const where = this.generateWhereObject(config.where);
    return [`await ${repoName}.delete(${where});`];
  }

  private generateValidateStep(config: any): string[] {
    const lines: string[] = [];

    for (const rule of config.rules) {
      const condition = this.expressionParser.parse(rule.condition);
      const message =
        typeof rule.message === 'string'
          ? `'${rule.message}'`
          : this.expressionParser.parse(rule.message);

      const exceptionClass = this.getExceptionClass(rule.exceptionType);

      lines.push(`if (!(${condition})) {`);
      lines.push(`  throw new ${exceptionClass}(${message});`);
      lines.push(`}`);
    }

    return lines;
  }

  private generateReturnStep(config: any): string[] {
    if (config.value === undefined) {
      return ['return;'];
    }
    const value = this.expressionParser.parse(config.value);
    return [`return ${value};`];
  }

  private generateThrowStep(config: any): string[] {
    const exceptionClass = this.getExceptionClass(config.exceptionType);
    const message = this.expressionParser.parse(config.message);
    return [`throw new ${exceptionClass}(${message});`];
  }

  private generateLogStep(config: any): string[] {
    const level = config.level || 'debug';
    const message = this.expressionParser.parse(config.message);
    return [`this.logger.${level}(${message});`];
  }

  private generateTransactionStep(config: any, entity: EntityConfig): string[] {
    const lines: string[] = [];
    const repoName = `this.${this.toCamelCase(entity.entityCode)}Repository`;

    // 创建查询运行器
    lines.push(
      `const queryRunner = ${repoName}.manager.connection.createQueryRunner();`,
    );
    lines.push(`await queryRunner.connect();`);
    lines.push(`await queryRunner.startTransaction();`);
    lines.push('');
    lines.push(`try {`);

    // 执行事务内的步骤
    if (config.steps && Array.isArray(config.steps)) {
      for (const step of config.steps) {
        const stepLines = this.generateStepCode(step, entity);
        stepLines.forEach((line) => {
          lines.push(`  ${line}`);
        });
      }
    }

    lines.push('');
    lines.push(`  await queryRunner.commitTransaction();`);
    lines.push(`} catch (err) {`);
    lines.push(`  await queryRunner.rollbackTransaction();`);

    // 如果配置了错误处理
    if (config.onError) {
      if (config.onError.log) {
        const message = this.expressionParser.parse(config.onError.log);
        lines.push(`  this.logger.error(${message});`);
      }
      if (config.onError.throw !== false) {
        lines.push(`  throw err;`);
      }
    } else {
      lines.push(`  throw err;`);
    }

    lines.push(`} finally {`);
    lines.push(`  await queryRunner.release();`);
    lines.push(`}`);

    return lines;
  }

  private generateConditionStep(
    config: ConditionStepConfig,
    entity: EntityConfig,
  ): string[] {
    if (!config?.if) {
      return ['// [condition step] missing if branch'];
    }

    const lines: string[] = [];

    // if 分支
    const ifExpr = this.generateJsConditionExpr(config.if.conditions);
    lines.push(`if (${ifExpr}) {`);
    for (const step of config.if.then) {
      const stepLines = this.generateStepCode(step, entity);
      stepLines.forEach((line) => lines.push(`  ${line}`));
    }

    // else if 链
    if (config.elseIf && config.elseIf.length > 0) {
      for (const branch of config.elseIf) {
        const elseIfExpr = this.generateJsConditionExpr(branch.conditions);
        lines.push(`} else if (${elseIfExpr}) {`);
        for (const step of branch.then) {
          const stepLines = this.generateStepCode(step, entity);
          stepLines.forEach((line) => lines.push(`  ${line}`));
        }
      }
    }

    // else 分支
    if (config.else && config.else.length > 0) {
      lines.push(`} else {`);
      for (const step of config.else) {
        const stepLines = this.generateStepCode(step, entity);
        stepLines.forEach((line) => lines.push(`  ${line}`));
      }
    }

    lines.push(`}`);
    return lines;
  }

  private generateCallStep(config: CallStepConfig): string[] {
    const args = (config.args || []).map((arg) =>
      this.expressionParser.parse(arg),
    );
    const target = config.service
      ? `this.${config.service}.${config.method}`
      : `this.${config.method}`;
    const awaitPrefix = config.await !== false ? 'await ' : '';
    const callExpr = `${awaitPrefix}${target}(${args.join(', ')})`;

    if (config.result) {
      return [`const ${config.result} = ${callExpr};`];
    }
    return [`${callExpr};`];
  }

  private generateLoopStep(config: any, entity: EntityConfig): string[] {
    const source = this.expressionParser.parse(config.source);
    const item = config.itemVar ?? 'item';
    const index = config.indexVar ? `, ${config.indexVar}` : '';
    const lines: string[] = [`for (const ${item}${index} of ${source}) {`];
    for (const step of (config.body ?? [])) {
      const stepLines = this.generateStepCode(step, entity);
      stepLines.forEach((line: string) => lines.push(`  ${line}`));
    }
    lines.push(`}`);
    return lines;
  }

  private generateTryCatchStep(config: any, entity: EntityConfig): string[] {
    const lines: string[] = ['try {'];
    for (const step of (config.try ?? [])) {
      const stepLines = this.generateStepCode(step, entity);
      stepLines.forEach((line: string) => lines.push(`  ${line}`));
    }
    const errVar = config.catch?.errorVar ?? 'err';
    lines.push(`} catch (${errVar}) {`);
    for (const step of (config.catch?.steps ?? [])) {
      const stepLines = this.generateStepCode(step, entity);
      stepLines.forEach((line: string) => lines.push(`  ${line}`));
    }
    if (config.finally && config.finally.length > 0) {
      lines.push('} finally {');
      for (const step of config.finally) {
        const stepLines = this.generateStepCode(step, entity);
        stepLines.forEach((line: string) => lines.push(`  ${line}`));
      }
    }
    lines.push('}');
    return lines;
  }

  /**
   * 将 WhereCondition[] 转换为 JS 条件表达式字符串
   * 每个条件的 field 为 JS 变量路径，operator/value 映射为 JS 比较运算符
   */
  private generateJsConditionExpr(conditions: WhereCondition[]): string {
    if (!conditions || conditions.length === 0) return 'true';

    const parts: string[] = [];
    for (let i = 0; i < conditions.length; i++) {
      const expr = this.conditionToJsExpr(conditions[i]);
      if (i === 0) {
        parts.push(expr);
      } else {
        const logic = conditions[i].logic === 'or' ? '||' : '&&';
        parts.push(`${logic} ${expr}`);
      }
    }
    return parts.join(' ');
  }

  private conditionToJsExpr(c: WhereCondition): string {
    const field = c.field;
    const value = c.value ? this.expressionParser.parse(c.value) : 'undefined';
    switch (c.operator) {
      case 'eq':
        return `${field} === ${value}`;
      case 'ne':
        return `${field} !== ${value}`;
      case 'gt':
        return `${field} > ${value}`;
      case 'gte':
        return `${field} >= ${value}`;
      case 'lt':
        return `${field} < ${value}`;
      case 'lte':
        return `${field} <= ${value}`;
      case 'in':
        return `${value}.includes(${field})`;
      case 'notIn':
        return `!${value}.includes(${field})`;
      case 'isNull':
        return `${field} == null`;
      case 'like':
        return `${field}.includes(${value})`;
      case 'isNotNull':
        return `${field} != null`;
      default:
        return field;
    }
  }

  private generateWhereObject(conditions: WhereCondition[]): string {
    const parts: string[] = [];

    for (const cond of conditions) {
      const value = this.expressionParser.parse(cond.value);
      parts.push(
        `${cond.field}: ${this.generateConditionValue(cond.operator, value)}`,
      );
    }

    return `{ ${parts.join(', ')} }`;
  }

  private generateConditionValue(operator: string, value: string): string {
    switch (operator) {
      case 'eq':
        return value;
      case 'ne':
        return `Not(${value})`;
      case 'gt':
        return `MoreThan(${value})`;
      case 'gte':
        return `MoreThanOrEqual(${value})`;
      case 'lt':
        return `LessThan(${value})`;
      case 'lte':
        return `LessThanOrEqual(${value})`;
      case 'like':
        return `Like(\`%\${${value}}%\`)`;
      case 'in':
        return `In(${value})`;
      case 'notIn':
        return `Not(In(${value}))`;
      case 'isNull':
        return 'IsNull()';
      case 'isNotNull':
        return 'Not(IsNull())';
      default:
        return value;
    }
  }

  private getExceptionClass(type?: string): string {
    switch (type) {
      case 'NotFound':
        return 'NotFoundException';
      case 'BadRequest':
        return 'BadRequestException';
      case 'Conflict':
        return 'ConflictException';
      case 'Forbidden':
        return 'ForbiddenException';
      default:
        return 'BadRequestException';
    }
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

  private toKebabCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  }
}
