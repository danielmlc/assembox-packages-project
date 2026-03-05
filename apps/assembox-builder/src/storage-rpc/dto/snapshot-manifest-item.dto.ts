/**
 * 快照清单中的组件配置项
 */
export interface SnapshotManifestConfigDto {
  configId: string;
  componentId: string;
  componentCode: string;
  componentName: string;
  /** 配置层级：system / tenant */
  layer: string;
  /** 配置状态：published / draft */
  status: string;
  /** 锁定的发布版本号 */
  publishVersion: number;
  /** OSS 路径，构建时读取配置内容 */
  publishedOssKey: string;
  draftOssKey: string;
}

/**
 * 快照清单中的版本项
 */
export interface SnapshotManifestVersionDto {
  versionId: string;
  versionCode: string;
  versionName: string;
  versionType: string;
  configs: SnapshotManifestConfigDto[];
}

/**
 * 快照清单顶层：模块列表项
 */
export interface SnapshotManifestItemDto {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  versions: SnapshotManifestVersionDto[];
}

/**
 * createSnapshot 返回的快照信息
 */
export interface SnapshotDto {
  id: string;
  snapshotCode: string;
  snapshotName: string;
  buildStatus: string;
}
