import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository, Like } from 'typeorm';
import { LoggerService } from '@cs/nest-common';
import { InjectRepository } from '@cs/nest-typeorm';
import { Order } from './order.entity';
import { CreateOrderDto, UpdateOrderDto, QueryOrderDto } from './order.dto';

/** 订单服务 */
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository({ entity: Order }) private readonly orderRepository: Repository<Order>,
    private readonly logger: LoggerService,
  ) {}

  /** 根据状态查询订单列表 */
  async findByStatus(status: string): Promise<Order[]> {
    // 记录查询日志
    this.logger.debug(`查询订单状态: status`);

    // 查询指定状态的订单
    const orders = await this.orderRepository.find({
      where: { status: status },
      order: { created_at: 'DESC' },
    });

    return orders;
  }

  /** 计算指定客户的订单总金额 */
  async calculateTotalAmount(customerId: string, status?: string): Promise<number> {
    // 声明查询条件
    let conditions: any[] = [];

    // 查询客户订单
    const orders = await this.orderRepository.find({
      where: { customerId: customerId },
    });

    // 计算总金额
    const total: number = orders.reduce((sum, order) => sum + Number(order.amount), 0);

    this.logger.info(`客户 customerId 的订单总金额: total`);
    return total;
  }

  /** 取消订单 */
  async cancelOrder(orderId: string): Promise<Order> {
    // 查询订单
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 验证订单状态
    if (!(order.status === 'pending' || order.status === 'confirmed')) {
      throw new BadRequestException('只有待处理或已确认的订单可以取消');
    }

    // 更新订单状态
    await this.orderRepository.update(
      { id: orderId },
      {
        status: 'cancelled',
      },
    );

    this.logger.info(`订单 orderId 已取消`);

    // 返回更新后的订单
    const updatedOrder = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    return updatedOrder;
  }
}
