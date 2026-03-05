import { RpcClient } from '@cs/nest-cloud';
import { Injectable } from '@nestjs/common';

import { SnapshotDto, SnapshotManifestItemDto } from './dto';

/** 存储服务在 Nacos 中注册的服务名称 */
const STORAGE_SERVICE_NAME = 'node-lc-assembox-storage-service';
/** 存储服务的 URL 路径前缀（对应 assembox-storage config.yaml serverPath） */
const STORAGE_SERVICE_PATH = 'assembox-storage';

/**
 * 存储服务 RPC 客户端
 * 通过平台 JSON-RPC 框架（@cs/nest-cloud）调用 assembox-storage 暴露的 storage.* 接口。
 * 服务地址由 Nacos 自动解析，无需硬编码 URL。
 */
@Injectable()
export class StorageRpcService {
  constructor(private readonly rpcClient: RpcClient) {}

  private async call<T>(method: string, params?: object): Promise<T> {
    return this.rpcClient.callWithExtract<object, T>({
      rpcConfig: {
        serviceName: STORAGE_SERVICE_NAME,
        servicePath: STORAGE_SERVICE_PATH,
      },
      payload: { method, params },
    });
  }

  /**
   * 创建快照
   */
  async createSnapshot(moduleGroupId: string, snapshotName: string): Promise<SnapshotDto> {
    return this.call('storage.createSnapshot', { moduleGroupId, snapshotName });
  }

  /**
   * 查询快照详情
   */
  async getSnapshot(snapshotId: string): Promise<SnapshotDto> {
    return this.call('storage.getSnapshot', { snapshotId });
  }

  /**
   * 生成快照清单
   */
  async generateManifest(snapshotId: string): Promise<void> {
    await this.call('storage.generateManifest', { snapshotId });
  }

  /**
   * 获取快照清单
   */
  async getManifest(snapshotId: string): Promise<SnapshotManifestItemDto[]> {
    return this.call('storage.getManifest', { snapshotId });
  }

  /**
   * 通过 OSS Key 读取配置内容
   */
  async getConfigContent(ossKey: string): Promise<string> {
    return this.call('storage.getConfigContent', { ossKey });
  }
}
