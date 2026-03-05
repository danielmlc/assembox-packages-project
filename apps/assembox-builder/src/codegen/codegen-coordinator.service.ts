import { LoggerService } from '@cs/nest-common';
import { Inject, Injectable } from '@nestjs/common';

import { SnapshotManifestItemDto } from '../storage-rpc/dto';
import { StorageRpcService } from '../storage-rpc/storage-rpc.service';

/**
 * 代码生成协调器
 *
 * 职责：将快照清单（SnapshotManifestItemDto[]）转换为代码生成器所需的 ModuleConfig[] 格式：
 *   1. 过滤：只保留 is_runtime=0 的构建配置组件
 *   2. 优先级：同一组件 tenant 层覆盖 system 层
 *   3. 读取 OSS 配置内容（通过存储服务 RPC）
 *   4. 按模块聚合为 ModuleConfig[]
 */
@Injectable()
export class CodegenCoordinatorService {
  constructor(
    @Inject(LoggerService)
    private readonly logger: LoggerService,
    private readonly storageRpc: StorageRpcService,
  ) {}

  /**
   * 将快照清单转换为代码生成器输入格式
   *
   * @param manifest 快照清单
   * @param buildComponentCodes 参与构建的组件编码列表（is_runtime=0 的组件类型，如 ['entity', 'service_method']）
   * @returns ModuleConfig[] 代码生成器输入
   */
  async buildModuleConfigs(
    manifest: SnapshotManifestItemDto[],
    buildComponentCodes: string[],
  ): Promise<any[]> {
    const moduleConfigs: any[] = [];

    for (const moduleItem of manifest) {
      this.logger.log(`处理模块: ${moduleItem.moduleCode}`);

      // 收集当前模块所有版本中的构建配置（按 componentCode 去重，tenant 优先于 system）
      const componentConfigMap = new Map<string, { ossKey: string; componentCode: string }>();

      for (const version of moduleItem.versions) {
        // 按 componentCode 分组，先收集 system，再用 tenant 覆盖
        const systemConfigs = version.configs.filter(
          (c) => c.layer === 'system' && buildComponentCodes.includes(c.componentCode),
        );
        const tenantConfigs = version.configs.filter(
          (c) => c.layer === 'tenant' && buildComponentCodes.includes(c.componentCode),
        );

        for (const config of systemConfigs) {
          if (config.publishedOssKey) {
            componentConfigMap.set(config.componentCode, {
              ossKey: config.publishedOssKey,
              componentCode: config.componentCode,
            });
          }
        }
        // tenant 层覆盖 system 层
        for (const config of tenantConfigs) {
          if (config.publishedOssKey) {
            componentConfigMap.set(config.componentCode, {
              ossKey: config.publishedOssKey,
              componentCode: config.componentCode,
            });
          }
        }
      }

      if (componentConfigMap.size === 0) {
        this.logger.log(`模块 ${moduleItem.moduleCode} 无构建配置，跳过`);
        continue;
      }

      // 读取每个组件配置内容
      const entityConfigs: any[] = [];
      for (const [, { ossKey, componentCode }] of componentConfigMap) {
        try {
          const contentStr = await this.storageRpc.getConfigContent(ossKey);
          const content = JSON.parse(contentStr);

          // entity 组件：EntityConfig 格式
          if (componentCode === 'entity') {
            if (Array.isArray(content)) {
              entityConfigs.push(...content);
            } else {
              entityConfigs.push(content);
            }
          }
        } catch (error) {
          this.logger.error(`读取组件配置失败: ${componentCode} ossKey=${ossKey}`, error.message);
          throw error;
        }
      }

      if (entityConfigs.length === 0) {
        this.logger.log(`模块 ${moduleItem.moduleCode} 无 entity 配置，跳过`);
        continue;
      }

      moduleConfigs.push({
        moduleCode: moduleItem.moduleCode,
        moduleName: moduleItem.moduleName,
        entities: entityConfigs,
      });
    }

    this.logger.log(`共组装 ${moduleConfigs.length} 个模块配置`);
    return moduleConfigs;
  }
}
