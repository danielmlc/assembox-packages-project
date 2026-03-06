import { ModuleConfig } from '../types/meta-schema';
import { EntityContext } from './entity.context';
import { toPascalCase, toCamelCase, toKebabCase } from '../utils/naming';

/**
 * 模块上下文 — 聚合多个 EntityContext，计算模块级命名和连接信息
 */
export class ModuleContext {
  /** PascalCase 模块类名（如 OrderModule） */
  public readonly className: string;
  /** camelCase 实例名（如 order） */
  public readonly instanceName: string;
  /** kebab-case 文件名前缀（如 order） */
  public readonly fileName: string;

  /** 模块显示名称（中文） */
  public readonly displayName: string;

  /** 模块级默认连接名 */
  public readonly connectionName: string;

  /** 包含的实体上下文列表 */
  public readonly entities: EntityContext[];

  constructor(public readonly raw: ModuleConfig) {
    this.className = toPascalCase(raw.moduleCode);
    this.instanceName = toCamelCase(raw.moduleCode);
    this.fileName = toKebabCase(raw.moduleCode);
    this.displayName = raw.moduleName;
    this.connectionName = raw.connectionName || 'default';

    // 构建实体上下文，实体级 connectionName 优先于模块级
    this.entities = raw.entities.map((entityConfig) => {
      const enriched = {
        ...entityConfig,
        connectionName: entityConfig.connectionName || this.connectionName,
      };
      return new EntityContext(enriched);
    });
  }

  /** 需要生成 Controller 的实体列表 */
  get controllableEntities(): EntityContext[] {
    return this.entities.filter((e) => e.generateController);
  }

  /** 需要生成 Service 的实体列表 */
  get serviceableEntities(): EntityContext[] {
    return this.entities.filter((e) => e.generateService);
  }

  /** 所有涉及的 connectionName 集合（用于 config.yaml 生成） */
  get connectionNames(): string[] {
    const names = new Set(this.entities.map((e) => e.connectionName));
    return [...names];
  }
}
