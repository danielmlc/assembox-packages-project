import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository, Like } from 'typeorm';
import { LoggerService } from '@cs/nest-common';
import { InjectRepository } from '@cs/nest-typeorm';
import { OrderDetail } from './order_detail.entity';
import {
  CreateOrderDetailDto,
  UpdateOrderDetailDto,
  QueryOrderDetailDto,
} from './order_detail.dto';

/** 订单明细表服务 */
@Injectable()
export class OrderDetailService {
  constructor(
    @InjectRepository({ entity: OrderDetail })
    private readonly orderDetailRepository: Repository<OrderDetail>,
    private readonly logger: LoggerService,
  ) {}

  /** 根据订单ID查询明细列表 */
  async findByOrderId(orderId: string): Promise<OrderDetail[]> {
    this.logger.debug(`查询订单明细，订单ID: orderId`);

    const details = await this.orderDetailRepository.find({
      where: { orderId: orderId },
    });

    return details;
  }

  /** 批量创建订单明细 */
  async batchCreate(detailsData: CreateOrderDetailDto[]): Promise<OrderDetail[]> {
    this.logger.info(`批量创建订单明细，数量: detailsData.length`);

    // 创建实体列表
    const entities: any[] = detailsData.map((data) => this.orderDetailRepository.create(data));

    // 批量保存
    const savedDetails: any[] = await this.orderDetailRepository.save(entities);

    return savedDetails;
  }
}
