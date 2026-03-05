import { Controller, Get, Post, Put, Delete, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommonFieldsService } from './common-fields.service';
import {
  CreateCommonFieldsDto,
  UpdateCommonFieldsDto,
  QueryCommonFieldsDto,
} from './common-fields.dto';
import { CommonFields } from './common-fields.entity';

/** 常用字段示例表控制器 */
@ApiTags('常用字段示例表管理')
@Controller('common-fields')
export class CommonFieldsController {
  constructor(private readonly commonFieldsService: CommonFieldsService) {}

  @Post()
  @ApiOperation({ summary: '创建常用字段示例表记录' })
  @ApiResponse({ status: 201, description: '创建成功', type: CommonFields })
  async create(@Body() createDto: CreateCommonFieldsDto): Promise<CommonFields> {
    return await this.commonFieldsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: '查询常用字段示例表记录列表' })
  @ApiResponse({ status: 200, description: '查询成功', type: [CommonFields] })
  async findMany(@Query() queryDto: QueryCommonFieldsDto): Promise<CommonFields[]> {
    if (Object.keys(queryDto).length === 0) {
      return await this.commonFieldsService.findAll();
    }
    return await this.commonFieldsService.findMany(queryDto);
  }

  @Get('count')
  @ApiOperation({ summary: '统计常用字段示例表记录数量' })
  @ApiResponse({ status: 200, description: '统计成功' })
  async count(@Query() queryDto?: QueryCommonFieldsDto): Promise<number> {
    return await this.commonFieldsService.count(queryDto);
  }

  @Get(':id/:tenant/:orderId')
  @ApiOperation({ summary: '根据复合主键查询单条记录' })
  @ApiResponse({ status: 200, description: '查询成功', type: CommonFields })
  @ApiResponse({ status: 404, description: '记录不存在' })
  async findOne(
    @Param('id') id: string,
    @Param('tenant') tenant: string,
    @Param('orderId') orderId: string,
  ): Promise<CommonFields> {
    return await this.commonFieldsService.findOne({ id, tenant, orderId });
  }

  @Put(':id/:tenant/:orderId')
  @ApiOperation({ summary: '根据复合主键更新记录' })
  @ApiResponse({ status: 200, description: '更新成功', type: CommonFields })
  @ApiResponse({ status: 404, description: '记录不存在' })
  async update(
    @Param('id') id: string,
    @Param('tenant') tenant: string,
    @Param('orderId') orderId: string,
    @Body() updateDto: UpdateCommonFieldsDto,
  ): Promise<CommonFields> {
    return await this.commonFieldsService.update({ id, tenant, orderId }, updateDto);
  }

  @Delete(':id/:tenant/:orderId')
  @ApiOperation({ summary: '根据复合主键删除记录' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '记录不存在' })
  async remove(
    @Param('id') id: string,
    @Param('tenant') tenant: string,
    @Param('orderId') orderId: string,
  ): Promise<void> {
    await this.commonFieldsService.remove({ id, tenant, orderId });
  }
}
