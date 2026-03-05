import { EntityRegistModule, CustomRepository } from '@cs/nest-typeorm';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { CodegenModule } from '../codegen/codegen.module';
import { StorageRpcModule } from '../storage-rpc/storage-rpc.module';

import { AbBuildTask } from './ab-build-task.entity';
import { BuildController } from './build.controller';
import { BuildExecutorService } from './build-executor.service';
import { BuildService } from './build.service';
import { BuildWorkerService } from './build-worker.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EntityRegistModule.forRepos([
      {
        entity: AbBuildTask,
        repository: CustomRepository,
      },
    ]),
    StorageRpcModule,
    CodegenModule,
  ],
  controllers: [BuildController],
  providers: [BuildService, BuildExecutorService, BuildWorkerService],
  exports: [BuildService],
})
export class BuildModule {}
