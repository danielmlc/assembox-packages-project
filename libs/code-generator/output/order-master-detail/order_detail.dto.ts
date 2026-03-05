import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNotEmpty, IsString, IsNumber } from 'class-validator';

/**
 * 创建订单明细表DTO
 */
export class CreateOrderDetailDto {
  @ApiProperty({ description: '明细ID' })
  @IsNotEmpty()
  @IsString()
  id!: string;

  @ApiProperty({ description: '订单ID' })
  @IsNotEmpty()
  @IsString()
  orderId!: string;

  @ApiProperty({ description: '商品ID' })
  @IsNotEmpty()
  @IsString()
  productId!: string;

  @ApiProperty({ description: '商品名称' })
  @IsNotEmpty()
  @IsString()
  productName!: string;

  @ApiProperty({ description: '数量' })
  @IsNotEmpty()
  @IsNumber()
  quantity!: number;

  @ApiProperty({ description: '单价' })
  @IsNotEmpty()
  @IsNumber()
  price!: number;

  @ApiProperty({ description: '小计' })
  @IsNotEmpty()
  @IsNumber()
  subtotal!: number;
}

/**
 * 更新订单明细表DTO
 */
export class UpdateOrderDetailDto {
  @ApiPropertyOptional({ description: '订单ID' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: '商品ID' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: '商品名称' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({ description: '数量' })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiPropertyOptional({ description: '单价' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ description: '小计' })
  @IsOptional()
  @IsNumber()
  subtotal?: number;
}

/**
 * 查询订单明细表DTO
 */
export class QueryOrderDetailDto {
  @ApiPropertyOptional({ description: '明细ID' })
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ description: '订单ID' })
  @IsOptional()
  orderId?: string;

  @ApiPropertyOptional({ description: '商品ID' })
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ description: '商品名称' })
  @IsOptional()
  productName?: string;

  @ApiPropertyOptional({ description: '数量' })
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ description: '单价' })
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: '小计' })
  @IsOptional()
  subtotal?: number;
}
