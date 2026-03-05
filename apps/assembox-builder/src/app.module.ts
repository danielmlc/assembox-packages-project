import { Module } from '@nestjs/common';

import { BuildModule } from './build/build.module';
import { ShareModule } from './share.module';

/**
 * 应用根模块
 */
@Module({
  imports: [
    ShareModule,
    BuildModule,
  ],
})
export class AppModule {}
