import { Project } from 'ts-morph';
import { ModuleContext } from '../context/module.context';
import { EntityContext } from '../context/entity.context';

/**
 * 代码生成插件接口
 *
 * 每个插件负责生成一类文件（Entity/Repository/Service/DTO/Module 等）。
 * 插件接收预构建好的上下文对象和共享的 ts-morph Project 实例，
 * 在 VFS 中创建/修改源文件，由引擎统一落盘。
 */
export interface GeneratorPlugin {
  /** 插件名称（用于日志和拓扑排序） */
  readonly name: string;

  /** 依赖的其他插件名（用于拓扑排序调度） */
  readonly dependencies?: string[];

  /**
   * 针对单个实体执行生成逻辑
   *
   * @param entityCtx  实体上下文（预计算好的命名、字段分类等）
   * @param moduleCtx  模块上下文（模块级信息，如连接名、显示名）
   * @param project    ts-morph 共享 Project 实例
   * @param outputDir  输出根目录
   */
  execute(
    entityCtx: EntityContext,
    moduleCtx: ModuleContext,
    project: Project,
    outputDir: string,
  ): Promise<void>;
}
