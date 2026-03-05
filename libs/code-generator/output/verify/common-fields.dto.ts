import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNotEmpty, IsString, IsNumber } from 'class-validator';

/**
 * 创建常用字段示例表DTO
 */
export class CreateCommonFieldsDto {
  @ApiProperty({ description: '主键' })
  @IsNotEmpty()
  @IsString()
  id!: string;

  @ApiProperty({ description: '租户编码' })
  @IsNotEmpty()
  @IsString()
  tenant!: string;

  @ApiProperty({ description: '单据主键' })
  @IsNotEmpty()
  @IsString()
  orderId!: string;

  @ApiProperty({ description: '编码' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiProperty({ description: '名称' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: '排序码' })
  @IsOptional()
  @IsNumber()
  sortCode?: number;

  @ApiPropertyOptional({ description: '启用状态' })
  @IsOptional()
  @IsNumber()
  isEnable?: number;

  @ApiPropertyOptional({ description: '组织机构ID' })
  @IsOptional()
  @IsString()
  orgId?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

/**
 * 更新常用字段示例表DTO
 */
export class UpdateCommonFieldsDto {
  @ApiPropertyOptional({ description: '编码' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: '名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '排序码' })
  @IsOptional()
  @IsNumber()
  sortCode?: number;

  @ApiPropertyOptional({ description: '启用状态' })
  @IsOptional()
  @IsNumber()
  isEnable?: number;

  @ApiPropertyOptional({ description: '组织机构ID' })
  @IsOptional()
  @IsString()
  orgId?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

/**
 * 查询常用字段示例表DTO
 */
export class QueryCommonFieldsDto {
  @ApiPropertyOptional({ description: '主键' })
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ description: '租户编码' })
  @IsOptional()
  tenant?: string;

  @ApiPropertyOptional({ description: '单据主键' })
  @IsOptional()
  orderId?: string;

  @ApiPropertyOptional({ description: '编码' })
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: '名称' })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '排序码' })
  @IsOptional()
  sortCode?: number;

  @ApiPropertyOptional({ description: '启用状态' })
  @IsOptional()
  isEnable?: number;

  @ApiPropertyOptional({ description: '组织机构ID' })
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  remark?: string;
}

/**
 * 复合主键DTO
 */
export class CompositeKeyDto {
  @ApiProperty({ description: '主键' })
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ description: '租户编码' })
  @IsNotEmpty()
  tenant!: string;

  @ApiProperty({ description: '单据主键' })
  @IsNotEmpty()
  orderId!: string;
}
