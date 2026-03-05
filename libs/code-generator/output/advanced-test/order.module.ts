import { Module } from '@nestjs/common';
import { EntityRegistModule } from '@cs/nest-typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { Order } from './order.entity';

/**
 * 订单管理模块
 */
@Module({
  imports: [EntityRegistModule.forRepos([{ entity: Order }])],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
