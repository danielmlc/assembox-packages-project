import { Module } from '@nestjs/common';

import { StorageRpcService } from './storage-rpc.service';

@Module({
  providers: [StorageRpcService],
  exports: [StorageRpcService],
})
export class StorageRpcModule {}
