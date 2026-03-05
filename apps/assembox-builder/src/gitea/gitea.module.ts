import { ConfigService } from '@cs/nest-config';
import { DynamicModule, Module } from '@nestjs/common';

import { GiteaConfig } from './gitea.interface';
import { GITEA_CONFIG, GiteaService } from './gitea.service';

export interface GiteaModuleAsyncOptions {
  inject?: any[];
  useFactory: (...args: any[]) => Promise<GiteaConfig> | GiteaConfig;
}

@Module({})
export class GiteaModule {
  static forRootAsync(options: GiteaModuleAsyncOptions): DynamicModule {
    return {
      module: GiteaModule,
      providers: [
        {
          provide: GITEA_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        GiteaService,
      ],
      exports: [GiteaService],
    };
  }
}
