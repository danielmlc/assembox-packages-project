import { Module } from '@nestjs/common';
import { EntityRegistModule } from '@cs/nest-typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { Order } from './order.entity';
import { OrderDetailController } from './order_detail.controller';
import { OrderDetailService } from './order_detail.service';
import { OrderDetail } from './order_detail.entity';

/**
 * 订单管理模块（改进版）
 */
@Module({
  imports: [EntityRegistModule.forRepos([{ entity: Order }, { entity: OrderDetail }])],
  controllers: [OrderController, OrderDetailController],
  providers: [OrderService, OrderDetailService],
  exports: [OrderService, OrderDetailService],
})
export class ImprovedOrderModule {}
