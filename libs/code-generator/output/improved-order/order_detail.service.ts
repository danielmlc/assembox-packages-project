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

  /** 创建记录 */
  async create(createDto: CreateOrderDetailDto): Promise<OrderDetail> {
    this.logger.debug('创建订单明细表记录');

    const entity = this.orderDetailRepository.create(createDto);
    return await this.orderDetailRepository.save(entity);
  }

  /** 查询所有记录 */
  async findAll(): Promise<OrderDetail[]> {
    this.logger.debug('查询所有订单明细表记录');
    return await this.orderDetailRepository.find();
  }

  /** 根据条件查询记录列表 */
  async findMany(queryDto: QueryOrderDetailDto): Promise<OrderDetail[]> {
    this.logger.debug('查询订单明细表记录列表');

    const where: any = {};

    if (queryDto.id !== undefined) {
      where.id = queryDto.id;
    }
    if (queryDto.orderId !== undefined) {
      where.orderId = queryDto.orderId;
    }
    if (queryDto.productName) {
      where.productName = Like(`%${queryDto.productName}%`);
    }
    if (queryDto.quantity !== undefined) {
      where.quantity = queryDto.quantity;
    }
    if (queryDto.price !== undefined) {
      where.price = queryDto.price;
    }

    return await this.orderDetailRepository.find({ where });
  }

  /** 根据明细ID查询单条记录 */
  async findOne(id: string): Promise<OrderDetail> {
    this.logger.debug(`查询订单明细表记录: id=${id}`);

    const record = await this.orderDetailRepository.findOne({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`记录不存在: id=${id}`);
    }

    return record;
  }

  /** 根据明细ID更新记录 */
  async update(id: string, updateDto: UpdateOrderDetailDto): Promise<OrderDetail> {
    this.logger.debug(`更新订单明细表记录: id=${id}`);

    await this.findOne(id);

    await this.orderDetailRepository.update({ id }, updateDto);

    return await this.findOne(id);
  }

  /** 根据明细ID删除记录 */
  async remove(id: string): Promise<void> {
    this.logger.debug(`删除订单明细表记录: id=${id}`);

    await this.findOne(id);

    await this.orderDetailRepository.delete({ id });
  }

  /** 统计记录数量 */
  async count(queryDto?: QueryOrderDetailDto): Promise<number> {
    this.logger.debug('统计订单明细表记录数量');

    if (!queryDto) {
      return await this.orderDetailRepository.count();
    }

    const where: any = {};
    if (queryDto.id !== undefined) {
      where.id = queryDto.id;
    }
    if (queryDto.orderId !== undefined) {
      where.orderId = queryDto.orderId;
    }
    if (queryDto.productName) {
      where.productName = Like(`%${queryDto.productName}%`);
    }
    if (queryDto.quantity !== undefined) {
      where.quantity = queryDto.quantity;
    }
    if (queryDto.price !== undefined) {
      where.price = queryDto.price;
    }

    return await this.orderDetailRepository.count({ where });
  }
}
