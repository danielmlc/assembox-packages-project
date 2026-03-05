import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository, Like } from 'typeorm';
import { LoggerService } from '@cs/nest-common';
import { InjectRepository } from '@cs/nest-typeorm';
import { Order } from './order.entity';
import { CreateOrderDto, UpdateOrderDto, QueryOrderDto } from './order.dto';
import { OrderDetailService } from './order-detail.service';
import { InventoryService } from './inventory.service';
import { LogisticsService } from './logistics.service';

/** 订单主表服务 */
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository({ entity: Order }) private readonly orderRepository: Repository<Order>,
    private readonly logger: LoggerService,
    private readonly orderDetailService: OrderDetailService,
    private readonly inventoryService: InventoryService,
    private readonly logisticsService: LogisticsService,
  ) {}

  /** 创建订单（主表+明细表，带完整事务） */
  async createOrderWithDetails(
    orderData: CreateOrderDto,
    detailsData: CreateOrderDetailDto[],
  ): Promise<Order> {
    this.logger.info(`开始创建订单，明细数量: ${detailsData.length}`);

    if (!(detailsData && detailsData.length > 0)) {
      throw new BadRequestException('订单明细不能为空');
    }

    const queryRunner = this.orderRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const entity = this.orderRepository.create(orderData);
      const order = await this.orderRepository.save(entity);
      this.logger.info(`订单主表已创建，订单ID: ${order.id}`);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`创建订单失败: ${err.message}`);
      throw err;
    } finally {
      await queryRunner.release();
    }

    return order;
  }

  /** 确认订单（调用库存服务） */
  async confirmOrder(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (!(order.status === 'pending')) {
      throw new BadRequestException('只有待处理的订单可以确认');
    }

    this.logger.info(`调用库存服务锁定库存，订单ID: ${orderId}`);

    const queryRunner = this.orderRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.orderRepository.update(
        { id: orderId },
        {
          status: 'confirmed',
        },
      );

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    this.logger.info(`订单 ${orderId} 已确认`);

    const updatedOrder = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    return updatedOrder;
  }
}
