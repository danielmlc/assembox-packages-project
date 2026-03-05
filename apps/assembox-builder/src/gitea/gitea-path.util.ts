/**
 * Gitea 路径工具类
 * 用于生成 Git 仓库中的文件路径
 */
export class GiteaPathUtil {
  /**
   * 生成仓库名称
   * @param moduleGroupCode 模块组编码
   * @param pipelineType 流水线类型 (backend/frontend/model)
   * @returns 仓库名称，格式: assembox-configs-{moduleGroupCode}-{pipelineType}
   *
   * @example
   * generateRepoName('order-service', 'backend')
   * // => assembox-configs-order-service-backend
   */
  static generateRepoName(moduleGroupCode: string, pipelineType: string): string {
    return `assembox-configs-${moduleGroupCode}-${pipelineType}`;
  }

  /**
   * 生成配置文件路径
   * @param moduleCode 模块编码
   * @param versionCode 版本编码
   * @param layer 层级 (system/tenant)
   * @param componentCode 组件编码
   * @param tenantId 租户ID（租户层必填）
   * @returns 配置文件路径
   *
   * @example
   * // 系统层配置
   * generateConfigPath('order', 'v1.0.0', 'system', 'order_controller')
   * // => modules/order/v1.0.0/system/order_controller.json
   *
   * // 租户层配置
   * generateConfigPath('order', 'v1.0.0', 'tenant', 'order_controller', 'T001')
   * // => modules/order/v1.0.0/tenant/T001/order_controller.json
   */
  static generateConfigPath(
    moduleCode: string,
    versionCode: string,
    layer: string,
    componentCode: string,
    tenantId?: string,
  ): string {
    const basePath = `modules/${moduleCode}/${versionCode}/${layer}`;

    if (layer === 'tenant' && tenantId) {
      return `${basePath}/${tenantId}/${componentCode}.json`;
    }

    return `${basePath}/${componentCode}.json`;
  }

  /**
   * 生成快照清单路径
   * @param snapshotCode 快照编码
   * @returns 快照清单路径
   *
   * @example
   * generateSnapshotManifestPath('S001')
   * // => snapshots/S001/manifest.json
   */
  static generateSnapshotManifestPath(snapshotCode: string): string {
    return `snapshots/${snapshotCode}/manifest.json`;
  }

  /**
   * 生成快照元数据路径
   * @param snapshotCode 快照编码
   * @returns 快照元数据路径
   */
  static generateSnapshotMetaPath(snapshotCode: string): string {
    return `snapshots/${snapshotCode}/meta.json`;
  }

  /**
   * 生成快照 Tag 名称
   * @param snapshotCode 快照编码
   * @returns Tag 名称
   *
   * @example
   * generateSnapshotTag('S001')
   * // => snapshot-S001
   */
  static generateSnapshotTag(snapshotCode: string): string {
    return `snapshot-${snapshotCode}`;
  }

  /**
   * 生成提交信息 - 发布配置
   * @param componentCode 组件编码
   * @param publishVersion 发布版本号
   * @param moduleCode 模块编码
   * @param versionCode 版本编码
   * @param layer 层级
   * @returns 提交信息
   */
  static generatePublishCommitMessage(
    componentCode: string,
    publishVersion: number,
    moduleCode: string,
    versionCode: string,
    layer: string,
  ): string {
    return `feat: 发布 ${componentCode} 配置 (v${publishVersion})

- 模块: ${moduleCode}
- 版本: ${versionCode}
- 层级: ${layer}
- 发布版本: ${publishVersion}

Co-Authored-By: Assembox Storage Service <noreply@assembox.com>`;
  }

  /**
   * 生成提交信息 - 批量发布
   * @param configCount 配置数量
   * @param moduleGroupCode 模块组编码
   * @returns 提交信息
   */
  static generateBatchPublishCommitMessage(
    configCount: number,
    moduleGroupCode: string,
  ): string {
    return `feat: 批量发布配置 (${configCount}个)

- 模块组: ${moduleGroupCode}
- 配置数量: ${configCount}

Co-Authored-By: Assembox Storage Service <noreply@assembox.com>`;
  }

  /**
   * 生成提交信息 - 创建快照
   * @param snapshotCode 快照编码
   * @param snapshotName 快照名称
   * @param description 快照描述
   * @returns 提交信息
   */
  static generateSnapshotCommitMessage(
    snapshotCode: string,
    snapshotName: string,
    description?: string,
  ): string {
    return `snapshot: 创建快照 ${snapshotCode}

- 快照名称: ${snapshotName}
${description ? `- 说明: ${description}` : ''}

Co-Authored-By: Assembox Storage Service <noreply@assembox.com>`;
  }
}
