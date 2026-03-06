import { Project } from 'ts-morph';
import { ModuleConfig } from '../types/meta-schema';
import { ModuleContext } from '../context/module.context';
import { GeneratorPlugin } from './plugin.interface';

/**
 * 代码生成引擎 — 核心调度器
 *
 * 职责：
 * 1. 维护共享的 ts-morph Project（虚拟文件系统）
 * 2. 注册并按顺序调度 Generator Plugin
 * 3. 在内存中完成所有代码构建后，统一格式化并落盘
 */
export class CodeEngine {
  private project: Project;
  private plugins: GeneratorPlugin[] = [];

  constructor() {
    this.project = new Project();
  }

  /**
   * 注册插件（支持链式调用）
   */
  use(plugin: GeneratorPlugin): this {
    this.plugins.push(plugin);
    return this;
  }

  /**
   * 从 ModuleConfig JSON 构建并生成代码
   */
  async generate(config: ModuleConfig, outputDir: string): Promise<void> {
    const moduleCtx = new ModuleContext(config);

    console.log(`\n🚀 开始生成模块: ${moduleCtx.displayName} (${moduleCtx.className})`);
    console.log(`   输出目录: ${outputDir}`);
    console.log(`   实体数量: ${moduleCtx.entities.length}`);
    console.log(`   插件数量: ${this.plugins.length}\n`);

    // 对每个实体依次运行所有插件
    for (const entityCtx of moduleCtx.entities) {
      console.log(`\n--- 实体: ${entityCtx.className} (${entityCtx.raw.tableName}) ---`);

      for (const plugin of this.plugins) {
        console.log(`  [${plugin.name}] 执行中...`);
        await plugin.execute(entityCtx, moduleCtx, this.project, outputDir);
      }
    }

    // 统一格式化
    console.log(`\n📝 格式化代码...`);
    for (const sourceFile of this.project.getSourceFiles()) {
      sourceFile.formatText({
        indentSize: 2,
        convertTabsToSpaces: true,
      });
    }

    // 统一落盘
    await this.project.save();
    console.log(`\n✅ 生成完毕！文件已输出至: ${outputDir}`);
  }

  /**
   * 从 EntityContext 直接构建（便于单实体测试）
   */
  async buildEntity(
    entityCtx: import('../context/entity.context').EntityContext,
    moduleCtx: ModuleContext,
    outputDir: string,
  ): Promise<void> {
    for (const plugin of this.plugins) {
      await plugin.execute(entityCtx, moduleCtx, this.project, outputDir);
    }

    for (const sourceFile of this.project.getSourceFiles()) {
      sourceFile.formatText({ indentSize: 2, convertTabsToSpaces: true });
    }

    await this.project.save();
  }
}
