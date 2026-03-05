import { CSModule, RpcModule } from '@cs/nest-cloud';
import { ConfigService } from '@cs/nest-config';
import { RedisModule } from '@cs/nest-redis';
import { DatabaseModule } from '@cs/nest-typeorm';
import { Global } from '@nestjs/common';

import { GiteaModule } from './gitea/gitea.module';

/**
 * 共享模块
 * 注册数据库连接、Redis、Gitea、RpcClient，供所有业务模块使用
 */
@Global()
@CSModule({
  imports: [
    DatabaseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        return {
          ...config.get('mysql'),
        };
      },
    }),
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        return {
          ...config.get('redis'),
        };
      },
    }),
    GiteaModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        return {
          ...config.get('gitea'),
        };
      },
    }),
    RpcModule.forRoot({ protocol: 'http' }),
  ],
  exports: [DatabaseModule, RedisModule, GiteaModule],
})
export class ShareModule {}
