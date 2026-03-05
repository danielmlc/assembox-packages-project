import { Controller, Get, Post, Put, Delete, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderDto, QueryOrderDto } from './order.dto';
import { Order } from './order.entity';

/** 订单主表控制器 */
@ApiTags('订单主表管理')
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: '创建订单主表记录' })
  @ApiResponse({ status: 201, description: '创建成功', type: Order })
  async create(@Body() createDto: CreateOrderDto): Promise<Order> {
    return await this.orderService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: '查询订单主表记录列表' })
  @ApiResponse({ status: 200, description: '查询成功', type: [Order] })
  async findMany(@Query() queryDto: QueryOrderDto): Promise<Order[]> {
    if (Object.keys(queryDto).length === 0) {
      return await this.orderService.findAll();
    }
    return await this.orderService.findMany(queryDto);
  }

  @Get('count')
  @ApiOperation({ summary: '统计订单主表记录数量' })
  @ApiResponse({ status: 200, description: '统计成功' })
  async count(@Query() queryDto?: QueryOrderDto): Promise<number> {
    return await this.orderService.count(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '根据订单ID查询单条记录' })
  @ApiResponse({ status: 200, description: '查询成功', type: Order })
  @ApiResponse({ status: 404, description: '记录不存在' })
  async findOne(@Param('id') id: string): Promise<Order> {
    return await this.orderService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '根据订单ID更新记录' })
  @ApiResponse({ status: 200, description: '更新成功', type: Order })
  @ApiResponse({ status: 404, description: '记录不存在' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateOrderDto): Promise<Order> {
    return await this.orderService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '根据订单ID删除记录' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '记录不存在' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.orderService.remove(id);
  }
}
