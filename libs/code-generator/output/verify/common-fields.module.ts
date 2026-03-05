import { Module } from '@nestjs/common';
import { EntityRegistModule } from '@cs/nest-typeorm';
import { CommonFieldsController } from './common-fields.controller';
import { CommonFieldsService } from './common-fields.service';
import { CommonFields } from './common-fields.entity';

/**
 * 常用字段模块
 */
@Module({
  imports: [
    EntityRegistModule.forRepos([
      {
        entity: CommonFields,
        connectionName: 'common',
      },
    ]),
  ],
  controllers: [CommonFieldsController],
  providers: [CommonFieldsService],
  exports: [CommonFieldsService],
})
export class CommonFieldsModule {}
