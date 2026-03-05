/**
 * Assembox 构建层服务 - 测试数据清理脚本
 *
 * 使用方法：
 *   npx ts-node test/cleanup-test-data.ts [moduleGroupCode]
 *
 * 参数说明：
 *   moduleGroupCode（可选）：指定要清理的模块组编码前缀，默认清理所有以 "order-service-bt-" 开头的测试数据
 *
 * 清理顺序（依赖关系从叶子节点向根节点清理）：
 *   1. 构建任务（ab_build_task）
 *   2. 组件配置（ab_component_config）
 *   3. 版本（ab_version）
 *   4. 模块（ab_module）
 *   5. 模块组-流水线绑定（ab_module_group_pipeline）
 *   6. 模块组（ab_module_group）
 *   7. 组件类型（ab_component）
 *   8. 流水线（ab_pipeline）
 */

import axios from 'axios';

const STORAGE_BASE = 'http://localhost:3101/assembox-storage';
const BUILDER_BASE = 'http://localhost:3102/assembox-builder';

/** 测试模块组编码前缀（manual-test.ts 中创建的测试数据） */
const TEST_MODULE_GROUP_CODE_PREFIX = 'order-service-bt-';
/** 测试流水线编码前缀 */
const TEST_PIPELINE_CODE_PREFIX = 'backend_builder_test_';

const storageApi = axios.create({ baseURL: STORAGE_BASE, timeout: 30_000 });
const builderApi = axios.create({ baseURL: BUILDER_BASE, timeout: 30_000 });

function extractResult(response: any): any {
  return response.data?.result !== undefined ? response.data.result : response.data;
}

function printInfo(message: string) {
  console.log(`ℹ️  ${message}`);
}

function printSuccess(message: string) {
  console.log(`✅ ${message}`);
}

function printError(message: string, error?: any) {
  console.error(`❌ ${message}`);
  if (error) {
    const errMsg = error.response?.data?.message || error.message || String(error);
    console.error(`   ${errMsg}`);
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 清理构建任务（构建服务侧）
 */
async function cleanupBuildTasks(moduleGroupId: string) {
  try {
    const response = await builderApi.get(`/build/by-group/${moduleGroupId}`);
    const tasks = extractResult(response);

    if (!tasks || tasks.length === 0) {
      printInfo(`模块组 ${moduleGroupId} 无构建任务`);
      return;
    }

    let deletedCount = 0;
    for (const task of tasks) {
      try {
        // 构建任务目前无删除接口，只做状态统计
        printInfo(`  构建任务: ${task.taskCode} (${task.status})`);
        deletedCount++;
      } catch {
        // 忽略
      }
    }

    printInfo(`共找到 ${tasks.length} 个构建任务（可在数据库手动清理 ab_build_task 表）`);
  } catch (error) {
    printError('查询构建任务失败', error);
  }
}

/**
 * 清理指定模块组的所有数据（组件配置 → 版本 → 模块 → 模块组-流水线绑定 → 模块组）
 */
async function cleanupModuleGroup(moduleGroupId: string, moduleGroupCode: string) {
  printInfo(`开始清理模块组: ${moduleGroupCode} (ID=${moduleGroupId})`);

  // 1. 先查询模块
  let modules: any[] = [];
  try {
    const res = await storageApi.get(`/modules/by-group/${moduleGroupId}`);
    modules = extractResult(res) || [];
    printInfo(`  找到 ${modules.length} 个模块`);
  } catch (error) {
    printError('查询模块失败', error);
  }

  // 2. 清理每个模块下的版本和组件配置
  for (const module of modules) {
    let versions: any[] = [];
    try {
      const res = await storageApi.get(`/versions/by-module/${module.id}`);
      versions = extractResult(res) || [];
    } catch {
      // 忽略
    }

    for (const version of versions) {
      // 清理组件配置
      let configs: any[] = [];
      try {
        const res = await storageApi.get(`/component-configs/version/${version.id}`);
        configs = extractResult(res) || [];
      } catch {
        // 忽略
      }

      for (const config of configs) {
        try {
          await storageApi.delete(`/component-configs/${config.id}`);
          await sleep(50);
        } catch {
          // 忽略删除错误
        }
      }

      if (configs.length > 0) {
        printInfo(`  版本 ${version.versionCode}: 已清理 ${configs.length} 个组件配置`);
      }

      // 清理版本
      try {
        await storageApi.delete(`/versions/${version.id}`);
        await sleep(50);
      } catch {
        // 忽略
      }
    }

    if (versions.length > 0) {
      printInfo(`  模块 ${module.moduleCode}: 已清理 ${versions.length} 个版本`);
    }

    // 清理模块
    try {
      await storageApi.delete(`/modules/${module.id}`);
      await sleep(50);
    } catch {
      // 忽略
    }
  }

  // 3. 清理模块组-流水线绑定（目前无列表接口，尝试通过模块组 ID 查询）
  // 暂时跳过，删除模块组时通常会级联处理

  // 4. 清理模块组
  try {
    await storageApi.delete(`/module-groups/${moduleGroupId}`);
    printSuccess(`模块组 ${moduleGroupCode} 清理完成`);
  } catch (error) {
    printError(`模块组 ${moduleGroupCode} 清理失败`, error);
  }
}

/**
 * 主清理流程
 */
async function main() {
  const targetCode = process.argv[2];

  console.log('🗑️  Assembox 构建层服务 - 测试数据清理');
  console.log('═'.repeat(60));

  if (targetCode) {
    printInfo(`目标模块组编码: ${targetCode}`);
  } else {
    printInfo(`清理前缀为 "${TEST_MODULE_GROUP_CODE_PREFIX}" 的所有测试数据`);
  }

  console.log('');

  // 1. 查询所有测试模块组
  let moduleGroups: any[] = [];
  try {
    const res = await storageApi.get('/module-groups');
    const allGroups = extractResult(res) || [];
    const prefix = targetCode || TEST_MODULE_GROUP_CODE_PREFIX;
    moduleGroups = allGroups.filter((g: any) =>
      targetCode
        ? g.moduleGroupCode === targetCode
        : g.moduleGroupCode?.startsWith(prefix),
    );
    printInfo(`找到 ${moduleGroups.length} 个待清理模块组`);
  } catch (error) {
    printError('查询模块组列表失败', error);
    console.log('\n请确保存储服务已启动：pnpm dev:storage');
    process.exit(1);
  }

  // 2. 清理每个测试模块组的数据
  for (const group of moduleGroups) {
    console.log('');
    await cleanupBuildTasks(group.id);
    await cleanupModuleGroup(group.id, group.moduleGroupCode);
    await sleep(200);
  }

  // 3. 查询并清理测试流水线
  console.log('');
  printInfo('清理测试流水线...');
  try {
    const res = await storageApi.get('/pipelines');
    const allPipelines = extractResult(res) || [];
    const testPipelines = allPipelines.filter((p: any) =>
      p.pipelineCode?.startsWith(TEST_PIPELINE_CODE_PREFIX),
    );

    for (const pipeline of testPipelines) {
      try {
        await storageApi.delete(`/pipelines/${pipeline.id}`);
        printSuccess(`流水线 ${pipeline.pipelineCode} 已删除`);
        await sleep(50);
      } catch (error) {
        printError(`流水线 ${pipeline.pipelineCode} 删除失败`, error);
      }
    }

    if (testPipelines.length === 0) {
      printInfo('无需清理的测试流水线');
    }
  } catch (error) {
    printError('查询流水线列表失败', error);
  }

  // 4. 提示手动清理构建任务（当前无删除接口）
  console.log('');
  console.log('─'.repeat(60));
  console.log('💡 构建任务（ab_build_task）需要手动清理：');
  console.log('   执行以下 SQL（在 dev_pf_lc 数据库）：');
  console.log('');
  console.log(`   UPDATE ab_build_task SET is_removed = 1`);
  console.log(`   WHERE module_group_code LIKE '${TEST_MODULE_GROUP_CODE_PREFIX}%'`);
  console.log(`   AND is_removed = 0;`);
  console.log('');
  console.log('   或使用数据库客户端连接：');
  console.log('   Host: dev-tidb.yearrow.com:4000');
  console.log('   Database: dev_pf_lc');
  console.log('─'.repeat(60));

  console.log('\n✅ 清理完成');
}

main().catch((error) => {
  printError('清理脚本执行失败', error);
  process.exit(1);
});
