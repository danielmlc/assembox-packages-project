import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository, Like } from 'typeorm';
import { LoggerService } from '@cs/nest-common';
import { InjectRepository } from '@cs/nest-typeorm';
import { CommonFields } from './common-fields.entity';
import {
  CreateCommonFieldsDto,
  UpdateCommonFieldsDto,
  QueryCommonFieldsDto,
} from './common-fields.dto';

/** 常用字段示例表服务 */
@Injectable()
export class CommonFieldsService {
  constructor(
    @InjectRepository({
      entity: CommonFields,
      connectionName: 'common',
    })
    private readonly commonFieldsRepository: Repository<CommonFields>,
    private readonly logger: LoggerService,
  ) {}

  /** 创建记录 */
  async create(createDto: CreateCommonFieldsDto): Promise<CommonFields> {
    this.logger.debug('创建常用字段示例表记录');

    const entity = this.commonFieldsRepository.create(createDto);
    return await this.commonFieldsRepository.save(entity);
  }

  /** 查询所有记录 */
  async findAll(): Promise<CommonFields[]> {
    this.logger.debug('查询所有常用字段示例表记录');
    return await this.commonFieldsRepository.find();
  }

  /** 根据条件查询记录列表 */
  async findMany(queryDto: QueryCommonFieldsDto): Promise<CommonFields[]> {
    this.logger.debug('查询常用字段示例表记录列表');

    const where: any = {};

    if (queryDto.id !== undefined) {
      where.id = queryDto.id;
    }
    if (queryDto.tenant !== undefined) {
      where.tenant = queryDto.tenant;
    }
    if (queryDto.orderId !== undefined) {
      where.orderId = queryDto.orderId;
    }
    if (queryDto.code) {
      where.code = queryDto.code;
    }
    if (queryDto.name) {
      where.name = Like(`%${queryDto.name}%`);
    }
    if (queryDto.sortCode !== undefined) {
      where.sortCode = queryDto.sortCode;
    }
    if (queryDto.isEnable !== undefined) {
      where.isEnable = queryDto.isEnable;
    }
    if (queryDto.orgId !== undefined) {
      where.orgId = queryDto.orgId;
    }
    if (queryDto.remark) {
      where.remark = queryDto.remark;
    }

    return await this.commonFieldsRepository.find({ where });
  }

  /** 根据复合主键查询单条记录 */
  async findOne(compositeKey: {
    id: string;
    tenant: string;
    orderId: string;
  }): Promise<CommonFields> {
    this.logger.debug(
      `查询常用字段示例表记录: id=${compositeKey.id}, tenant=${compositeKey.tenant}, orderId=${compositeKey.orderId}`,
    );

    const record = await this.commonFieldsRepository.findOne({
      id,
      tenant,
      orderId,
    });

    if (!record) {
      throw new NotFoundException(
        `记录不存在: id=${compositeKey.id}, tenant=${compositeKey.tenant}, orderId=${compositeKey.orderId}`,
      );
    }

    return record;
  }

  /** 根据复合主键更新记录 */
  async update(
    compositeKey: { id: string; tenant: string; orderId: string },
    updateDto: UpdateCommonFieldsDto,
  ): Promise<CommonFields> {
    this.logger.debug(
      `更新常用字段示例表记录: id=${compositeKey.id}, tenant=${compositeKey.tenant}, orderId=${compositeKey.orderId}`,
    );

    await this.findOne(compositeKey);

    await this.commonFieldsRepository.update(
      { id: compositeKey.id, tenant: compositeKey.tenant, orderId: compositeKey.orderId },
      updateDto,
    );

    return await this.findOne(compositeKey);
  }

  /** 根据复合主键删除记录 */
  async remove(compositeKey: { id: string; tenant: string; orderId: string }): Promise<void> {
    this.logger.debug(
      `删除常用字段示例表记录: id=${compositeKey.id}, tenant=${compositeKey.tenant}, orderId=${compositeKey.orderId}`,
    );

    await this.findOne(compositeKey);

    await this.commonFieldsRepository.delete({
      id: compositeKey.id,
      tenant: compositeKey.tenant,
      orderId: compositeKey.orderId,
    });
  }

  /** 统计记录数量 */
  async count(queryDto?: QueryCommonFieldsDto): Promise<number> {
    this.logger.debug('统计常用字段示例表记录数量');

    if (!queryDto) {
      return await this.commonFieldsRepository.count();
    }

    const where: any = {};
    if (queryDto.id !== undefined) {
      where.id = queryDto.id;
    }
    if (queryDto.tenant !== undefined) {
      where.tenant = queryDto.tenant;
    }
    if (queryDto.orderId !== undefined) {
      where.orderId = queryDto.orderId;
    }
    if (queryDto.code) {
      where.code = queryDto.code;
    }
    if (queryDto.name) {
      where.name = Like(`%${queryDto.name}%`);
    }
    if (queryDto.sortCode !== undefined) {
      where.sortCode = queryDto.sortCode;
    }
    if (queryDto.isEnable !== undefined) {
      where.isEnable = queryDto.isEnable;
    }
    if (queryDto.orgId !== undefined) {
      where.orgId = queryDto.orgId;
    }
    if (queryDto.remark) {
      where.remark = queryDto.remark;
    }

    return await this.commonFieldsRepository.count({ where });
  }
}
