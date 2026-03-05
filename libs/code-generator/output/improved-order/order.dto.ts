import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNotEmpty, IsString, IsNumber } from 'class-validator';

/**
 * 创建订单主表DTO
 */
export class CreateOrderDto {
  @ApiProperty({ description: '订单ID' })
  @IsNotEmpty()
  @IsString()
  id!: string;

  @ApiProperty({ description: '订单编号' })
  @IsNotEmpty()
  @IsString()
  orderNo!: string;

  @ApiProperty({ description: '客户ID' })
  @IsNotEmpty()
  @IsString()
  customerId!: string;

  @ApiProperty({ description: '订单状态' })
  @IsNotEmpty()
  @IsString()
  status!: string;

  @ApiProperty({ description: '订单总金额' })
  @IsNotEmpty()
  @IsNumber()
  totalAmount!: number;
}

/**
 * 更新订单主表DTO
 */
export class UpdateOrderDto {
  @ApiPropertyOptional({ description: '订单编号' })
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiPropertyOptional({ description: '客户ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: '订单状态' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '订单总金额' })
  @IsOptional()
  @IsNumber()
  totalAmount?: number;
}

/**
 * 查询订单主表DTO
 */
export class QueryOrderDto {
  @ApiPropertyOptional({ description: '订单ID' })
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ description: '订单编号' })
  @IsOptional()
  orderNo?: string;

  @ApiPropertyOptional({ description: '客户ID' })
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ description: '订单状态' })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: '订单总金额' })
  @IsOptional()
  totalAmount?: number;
}
