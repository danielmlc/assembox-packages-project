import { Controller, Get, Post, Put, Delete, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrderDetailService } from './order_detail.service';
import {
  CreateOrderDetailDto,
  UpdateOrderDetailDto,
  QueryOrderDetailDto,
} from './order_detail.dto';
import { OrderDetail } from './order_detail.entity';

/** 订单明细表控制器 */
@ApiTags('订单明细表管理')
@Controller('order-detail')
export class OrderDetailController {
  constructor(private readonly orderDetailService: OrderDetailService) {}

  @Post()
  @ApiOperation({ summary: '创建订单明细表记录' })
  @ApiResponse({ status: 201, description: '创建成功', type: OrderDetail })
  async create(@Body() createDto: CreateOrderDetailDto): Promise<OrderDetail> {
    return await this.orderDetailService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: '查询订单明细表记录列表' })
  @ApiResponse({ status: 200, description: '查询成功', type: [OrderDetail] })
  async findMany(@Query() queryDto: QueryOrderDetailDto): Promise<OrderDetail[]> {
    if (Object.keys(queryDto).length === 0) {
      return await this.orderDetailService.findAll();
    }
    return await this.orderDetailService.findMany(queryDto);
  }

  @Get('count')
  @ApiOperation({ summary: '统计订单明细表记录数量' })
  @ApiResponse({ status: 200, description: '统计成功' })
  async count(@Query() queryDto?: QueryOrderDetailDto): Promise<number> {
    return await this.orderDetailService.count(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '根据明细ID查询单条记录' })
  @ApiResponse({ status: 200, description: '查询成功', type: OrderDetail })
  @ApiResponse({ status: 404, description: '记录不存在' })
  async findOne(@Param('id') id: string): Promise<OrderDetail> {
    return await this.orderDetailService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '根据明细ID更新记录' })
  @ApiResponse({ status: 200, description: '更新成功', type: OrderDetail })
  @ApiResponse({ status: 404, description: '记录不存在' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateOrderDetailDto,
  ): Promise<OrderDetail> {
    return await this.orderDetailService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '根据明细ID删除记录' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '记录不存在' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.orderDetailService.remove(id);
  }
}
