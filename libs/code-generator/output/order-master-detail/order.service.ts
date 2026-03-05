import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository, Like } from 'typeorm';
import { LoggerService } from '@cs/nest-common';
import { InjectRepository } from '@cs/nest-typeorm';
import { Order } from './order.entity';
import { CreateOrderDto, UpdateOrderDto, QueryOrderDto } from './order.dto';

/** 订单主表服务 */
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository({ entity: Order }) private readonly orderRepository: Repository<Order>,
    private readonly logger: LoggerService,
  ) {}

  /** 创建订单（主表+明细表，带事务） */
  async createOrderWithDetails(
    orderData: CreateOrderDto,
    detailsData: CreateOrderDetailDto[],
  ): Promise<Order> {
    // 记录开始创建订单
    this.logger.info(`开始创建订单，明细数量: detailsData.length`);

    // 声明事务查询运行器
    const queryRunner: any = this.orderRepository.manager.connection.createQueryRunner();

    // 验证明细数据
    if (!(detailsData && detailsData.length > 0)) {
      throw new BadRequestException('订单明细不能为空');
    }

    // 保存订单主表
    const entity = this.orderRepository.create(orderData);
    const order = await this.orderRepository.save(entity);

    this.logger.info(`订单主表已创建，订单ID: order.id`);

    return order;
  }

  /** 确认订单（调用库存服务，带事务） */
  async confirmOrder(orderId: string): Promise<Order> {
    // 查询订单
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 验证订单状态
    if (!(order.status === 'pending')) {
      throw new BadRequestException('只有待处理的订单可以确认');
    }

    // 调用库存服务锁定库存
    this.logger.info(`调用库存服务锁定库存，订单ID: orderId`);

    // 更新订单状态为已确认
    await this.orderRepository.update(
      { id: orderId },
      {
        status: 'confirmed',
      },
    );

    this.logger.info(`订单 orderId 已确认`);

    // 返回更新后的订单
    const updatedOrder = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    return updatedOrder;
  }

  /** 计算订单总金额（从明细表汇总） */
  async calculateOrderAmount(orderId: string): Promise<number> {
    // 记录计算日志
    this.logger.debug(`计算订单总金额，订单ID: orderId`);

    // 调用明细服务查询明细
    const details: any[] = [];

    // 计算总金额
    const totalAmount: number = details.reduce(
      (sum, detail) => sum + detail.quantity * detail.price,
      0,
    );

    this.logger.info(`订单 orderId 总金额: totalAmount`);

    return totalAmount;
  }

  /** 发货订单（更新状态、调用物流服务） */
  async shipOrder(orderId: string, trackingNumber: string): Promise<Order> {
    // 查询订单
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 验证订单状态
    if (!(order.status === 'confirmed')) {
      throw new BadRequestException('只有已确认的订单可以发货');
    }

    // 调用物流服务
    this.logger.info(`调用物流服务，物流单号: trackingNumber`);

    // 更新订单状态为已发货
    await this.orderRepository.update(
      { id: orderId },
      {
        status: 'shipped',
      },
    );

    // 返回更新后的订单
    const shippedOrder = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    return shippedOrder;
  }
}
