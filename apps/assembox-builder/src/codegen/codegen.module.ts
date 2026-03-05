import { Module } from '@nestjs/common';

import { StorageRpcModule } from '../storage-rpc/storage-rpc.module';

import { BackendCodegenService } from './backend-codegen.service';
import { CodegenCoordinatorService } from './codegen-coordinator.service';

@Module({
  imports: [StorageRpcModule],
  providers: [CodegenCoordinatorService, BackendCodegenService],
  exports: [CodegenCoordinatorService, BackendCodegenService],
})
export class CodegenModule {}
