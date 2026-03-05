import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TriggerBuildDto {
  @IsNotEmpty({ message: '模块组 ID 不能为空' })
  @IsString()
  moduleGroupId: string;

  @IsNotEmpty({ message: '模块组编码不能为空' })
  @IsString()
  moduleGroupCode: string;

  @IsNotEmpty({ message: '流水线类型不能为空' })
  @IsString()
  pipelineType: string;

  /** 快照名称（新建快照时必填，复用已有快照时可选） */
  @IsOptional()
  @IsString()
  snapshotName?: string;

  /**
   * 历史快照 ID（传入时跳过快照创建，直接基于该快照重新构建）
   * 用于回滚场景
   */
  @IsOptional()
  @IsString()
  snapshotId?: string;
}
