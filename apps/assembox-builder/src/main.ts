import { bootstrap } from '@cs/nest-cloud';

import { AppModule } from './app.module';

bootstrap(AppModule, async (_app, _config) => {
  // 服务启动后回调
});
