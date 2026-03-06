import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNumber, IsOptional, IsNotEmpty } from "class-validator";
import { HasPrimaryFullDto } from "@cs/nest-common";

/** 常用字段示例表（更新后） 响应 DTO */
export class CommonFieldsDemoDto extends HasPrimaryFullDto {
  @ApiProperty({ description: '编码' })
  code: string;
  @ApiProperty({ description: '名称' })
  name: string;
}

/** 创建 常用字段示例表（更新后） 请求参数 */
export class CreateCommonFieldsDemoDto {
  @ApiProperty({ description: '编码' })
  @IsNotEmpty()
  @IsString()
  code!: string;
  @ApiProperty({ description: '名称' })
  @IsNotEmpty()
  @IsString()
  name!: string;
}

/** 更新 常用字段示例表（更新后） 请求参数 */
export class UpdateCommonFieldsDemoDto {
  @ApiPropertyOptional({ description: '编码' })
  @IsOptional()
  @IsString()
  code?: string;
  @ApiPropertyOptional({ description: '名称' })
  @IsOptional()
  @IsString()
  name?: string;
}
