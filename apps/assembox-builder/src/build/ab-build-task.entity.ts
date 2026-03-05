import { HasPrimaryFullEntity, registerEntity } from '@cs/nest-typeorm';
import { Column, Entity } from 'typeorm';

/**
 * 构建任务表
 */
@Entity('ab_build_task')
export class AbBuildTask extends HasPrimaryFullEntity {
  @Column({
    name: 'task_code',
    type: 'varchar',
    length: 32,
    comment: '任务编号，如 BT0001',
  })
  taskCode: string;

  @Column({
    name: 'module_group_id',
    type: 'bigint',
    comment: '模块组 ID',
  })
  moduleGroupId: string;

  @Column({
    name: 'module_group_code',
    type: 'varchar',
    length: 64,
    comment: '模块组编码（冗余，便于查询）',
  })
  moduleGroupCode: string;

  @Column({
    name: 'pipeline_type',
    type: 'varchar',
    length: 20,
    comment: '流水线类型：backend / website',
  })
  pipelineType: string;

  @Column({
    name: 'snapshot_id',
    type: 'bigint',
    nullable: true,
    comment: '关联的存储层快照 ID（ab_snapshot.id）',
  })
  snapshotId: string;

  @Column({
    name: 'snapshot_code',
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '快照编码（冗余，便于查询）',
  })
  snapshotCode: string;

  @Column({
    name: 'snapshot_name',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '快照名称',
  })
  snapshotName: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 32,
    default: 'pending',
    comment: '任务状态：pending/snapshotting/generating/validating/pushing/completed/failed',
  })
  status: string;

  @Column({
    name: 'error_message',
    type: 'text',
    nullable: true,
    comment: '失败原因',
  })
  errorMessage: string;

  @Column({
    name: 'gitea_repo',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '推送的 Gitea 仓库名',
  })
  giteaRepo: string;

  @Column({
    name: 'gitea_commit',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '推送的 commit hash',
  })
  giteaCommit: string;

  @Column({
    name: 'completed_at',
    type: 'datetime',
    nullable: true,
    comment: '完成时间',
  })
  completedAt: Date;
}

registerEntity({ entity: AbBuildTask });
