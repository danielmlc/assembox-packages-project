/**
 * 集成测试脚本
 *
 * 验证内容：
 * 1. EntityContext 解析（命名计算、审计字段过滤、基类推导）
 * 2. 全量生成（4 插件管线：TypeORM + ServiceGap + DTO + Module）
 * 3. 代沟保护（二次生成不覆盖 custom service）
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodeEngine } from '../src/engine/code-engine';
import { TypeOrmPlugin } from '../src/plugins/typeorm.plugin';
import { ServiceGapPlugin } from '../src/plugins/service-gap.plugin';
import { DtoPlugin } from '../src/plugins/dto.plugin';
import { ModulePlugin } from '../src/plugins/module.plugin';
import { EntityContext } from '../src/context/entity.context';
import { ModuleContext } from '../src/context/module.context';
import { ModuleConfig } from '../src/types/meta-schema';

const OUTPUT_DIR = path.resolve(__dirname, '../output/verify-new');

// =========================================================================
// 测试用例 1: EntityContext 解析验证
// =========================================================================

function testContextParsing() {
  console.log('=== 测试 1: EntityContext 解析 ===\n');

  const ctx = new EntityContext({
    entityCode: 'user_order',
    entityName: '用户订单表',
    tableName: 't_user_order',
    baseClass: 'HasPrimaryFullEntity',
    fields: [
      { fieldCode: 'order_no', fieldName: '订单编号', fieldType: 'string', required: true },
      { fieldCode: 'amount', fieldName: '订单金额', fieldType: 'int', required: true },
      // 以下是基类自带的审计字段，应被自动过滤
      { fieldCode: 'id', fieldName: '主键', fieldType: 'bigint', primaryKey: true },
      { fieldCode: 'creator_id', fieldName: '创建人', fieldType: 'bigint' },
      { fieldCode: 'sort_code', fieldName: '排序码', fieldType: 'int' },
      { fieldCode: 'is_removed', fieldName: '删除标记', fieldType: 'boolean' },
    ],
  });

  const checks = [
    ['className', ctx.className, 'UserOrder'],
    ['instanceName', ctx.instanceName, 'userOrder'],
    ['fileName', ctx.fileName, 'user-order'],
    ['baseEntityClass', ctx.baseEntityClass, 'HasPrimaryFullEntity'],
    ['baseDtoClass', ctx.baseDtoClass, 'HasPrimaryFullDto'],
    ['allFields.length', ctx.allFields.length, 6],
    ['businessFields.length', ctx.businessFields.length, 2],
    ['primaryKeys.length', ctx.primaryKeys.length, 1],
    ['businessFields[0]', ctx.businessFields[0]?.propertyName, 'orderNo'],
    ['businessFields[1]', ctx.businessFields[1]?.propertyName, 'amount'],
  ];

  let passed = 0;
  for (const [name, actual, expected] of checks) {
    const ok = actual === expected;
    console.log(`  ${ok ? '✅' : '❌'} ${name}: ${actual} ${ok ? '' : `(期望: ${expected})`}`);
    if (ok) passed++;
  }

  console.log(`\n  结果: ${passed}/${checks.length} 通过\n`);
  return passed === checks.length;
}

// =========================================================================
// 测试用例 2: 全量生成
// =========================================================================

async function testFullGeneration() {
  console.log('=== 测试 2: 全量生成 ===\n');

  // 清理旧输出
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }

  const config: ModuleConfig = {
    moduleCode: 'common-fields',
    moduleName: '常用字段模块',
    connectionName: 'common',
    entities: [
      {
        entityCode: 'common_fields_demo',
        entityName: '常用字段示例表',
        tableName: 'common_fields_demo',
        baseClass: 'HasPrimaryFullEntity',
        fields: [
          { fieldCode: 'id', fieldName: '主键', fieldType: 'bigint', primaryKey: true, required: true },
          { fieldCode: 'tenant', fieldName: '租户编码', fieldType: 'string', columnName: 'tenant', length: 50, primaryKey: true, required: true },
          { fieldCode: 'order_id', fieldName: '单据主键', fieldType: 'bigint', columnName: 'order_id', primaryKey: true, required: true },
          { fieldCode: 'code', fieldName: '编码', fieldType: 'string', length: 50, required: true },
          { fieldCode: 'name', fieldName: '名称', fieldType: 'string', length: 100, required: true },
          { fieldCode: 'sort_code', fieldName: '排序码', fieldType: 'int', defaultValue: 0 },
          { fieldCode: 'is_enable', fieldName: '启用状态', fieldType: 'boolean', defaultValue: 1 },
          { fieldCode: 'org_id', fieldName: '组织机构ID', fieldType: 'bigint' },
          { fieldCode: 'remark', fieldName: '备注', fieldType: 'string', length: 500 },
        ],
      },
    ],
  };

  const engine = new CodeEngine();
  engine
    .use(new TypeOrmPlugin())
    .use(new ServiceGapPlugin())
    .use(new DtoPlugin())
    .use(new ModulePlugin());

  await engine.generate(config, OUTPUT_DIR);

  // 验证生成的文件
  const expectedFiles = [
    'common-fields-demo.entity.ts',
    'common-fields-demo.repository.ts',
    'common-fields-demo.service.ts',
    'common-fields-demo.dto.ts',
    'common-fields.module.ts',
    'base/common-fields-demo.service.base.ts',
  ];

  let allExist = true;
  console.log('\n  文件检查:');
  for (const file of expectedFiles) {
    const exists = fs.existsSync(path.join(OUTPUT_DIR, file));
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allExist = false;
  }

  return allExist;
}

// =========================================================================
// 测试用例 3: 代沟保护
// =========================================================================

async function testGenerationGapProtection() {
  console.log('\n=== 测试 3: 代沟保护 ===\n');

  const customServicePath = path.join(OUTPUT_DIR, 'common-fields-demo.service.ts');
  const CUSTOM_MARKER = '// 🧪 THIS IS CUSTOM CODE THAT MUST NOT BE OVERWRITTEN';

  // 在 custom service 中注入标记
  const content = fs.readFileSync(customServicePath, 'utf-8');
  fs.writeFileSync(customServicePath, content + '\n' + CUSTOM_MARKER + '\n');

  // 再次运行生成
  const config: ModuleConfig = {
    moduleCode: 'common-fields',
    moduleName: '常用字段模块',
    connectionName: 'common',
    entities: [
      {
        entityCode: 'common_fields_demo',
        entityName: '常用字段示例表（更新后）',
        tableName: 'common_fields_demo',
        baseClass: 'HasPrimaryFullEntity',
        fields: [
          { fieldCode: 'code', fieldName: '编码', fieldType: 'string', length: 50, required: true },
          { fieldCode: 'name', fieldName: '名称', fieldType: 'string', length: 100, required: true },
        ],
      },
    ],
  };

  const engine = new CodeEngine();
  engine
    .use(new TypeOrmPlugin())
    .use(new ServiceGapPlugin())
    .use(new DtoPlugin())
    .use(new ModulePlugin());

  await engine.generate(config, OUTPUT_DIR);

  // 验证 custom service 文件仍包含标记
  const updatedContent = fs.readFileSync(customServicePath, 'utf-8');
  const preserved = updatedContent.includes(CUSTOM_MARKER);
  console.log(`  ${preserved ? '✅' : '❌'} Custom Service 自定义代码${preserved ? '已保护' : '被覆盖！'}`);

  // 验证 base service 已更新（entityName 变了）
  const basePath = path.join(OUTPUT_DIR, 'base/common-fields-demo.service.base.ts');
  const baseContent = fs.readFileSync(basePath, 'utf-8');
  const baseUpdated = baseContent.includes('更新后');
  console.log(`  ${baseUpdated ? '✅' : '❌'} Base Service ${baseUpdated ? '已更新' : '未更新'}`);

  return preserved && baseUpdated;
}

// =========================================================================
// 主入口
// =========================================================================

async function main() {
  console.log('\n🧪 代码生成引擎集成测试\n');
  console.log('='.repeat(50));

  const results: boolean[] = [];

  results.push(testContextParsing());
  results.push(await testFullGeneration());
  results.push(await testGenerationGapProtection());

  console.log('\n' + '='.repeat(50));
  const allPassed = results.every(Boolean);
  console.log(`\n${allPassed ? '🎉 全部测试通过！' : '💥 存在失败的测试'}\n`);

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('测试运行错误:', err);
  process.exit(1);
});
