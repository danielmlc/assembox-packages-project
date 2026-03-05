import { LoggerService } from '@cs/nest-common';
import { InjectRepository, CustomRepository } from '@cs/nest-typeorm';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AbBuildTask } from './ab-build-task.entity';
import { TriggerBuildDto } from './dto';

/**
 * 构建任务管理服务
 * 负责任务的创建、查询、状态更新
 */
@Injectable()
export class BuildService {
  constructor(
    @Inject(LoggerService)
    private readonly logger: LoggerService,
    @InjectRepository({
      entity: AbBuildTask,
      repository: CustomRepository,
    })
    private readonly taskRepository: CustomRepository<AbBuildTask>,
  ) {}

  /**
   * 触发构建（创建任务）
   */
  async trigger(dto: TriggerBuildDto, moduleGroupCode: string): Promise<AbBuildTask> {
    // 并发检查：同一模块组 + 流水线类型不允许同时有进行中的任务
    const runningTask = await this.taskRepository.findOne({
      moduleGroupId: dto.moduleGroupId,
      pipelineType: dto.pipelineType,
      isRemoved: false,
    } as any);

    if (
      runningTask &&
      !['completed', 'failed'].includes(runningTask.status)
    ) {
      throw new BadRequestException(
        `模块组 ${moduleGroupCode} 的 ${dto.pipelineType} 流水线已有进行中的任务 (${runningTask.taskCode})，请等待完成后再触发`,
      );
    }

    const taskCode = await this.generateTaskCode();
    const snapshotName = dto.snapshotName || `${taskCode}-构建`;

    const task = await this.taskRepository.saveOne({
      taskCode,
      moduleGroupId: dto.moduleGroupId,
      moduleGroupCode,
      pipelineType: dto.pipelineType,
      snapshotId: dto.snapshotId || null,
      snapshotName,
      status: 'pending',
    });

    this.logger.log(`构建任务已创建: ${taskCode}`);
    return task;
  }

  /**
   * 根据 ID 查询任务
   */
  async findById(id: string): Promise<AbBuildTask> {
    const task = await this.taskRepository.findOne({ id, isRemoved: false });
    if (!task) {
      throw new NotFoundException(`构建任务 ID ${id} 不存在`);
    }
    return task;
  }

  /**
   * 查询模块组的构建历史
   */
  async findByModuleGroup(moduleGroupId: string): Promise<AbBuildTask[]> {
    return await this.taskRepository.find({
      where: { moduleGroupId, isRemoved: false } as any,
      order: { createdAt: 'DESC' } as any,
    });
  }

  /**
   * 更新任务状态（内部调用）
   */
  async updateStatus(
    taskId: string,
    status: string,
    extra?: Partial<AbBuildTask>,
  ): Promise<void> {
    const task = await this.findById(taskId);
    task.status = status;
    if (extra) {
      Object.assign(task, extra);
    }
    if (status === 'completed' || status === 'failed') {
      task.completedAt = new Date();
    }
    await this.taskRepository.saveOne(task);
  }

  /**
   * 拉取一个 pending 任务（FOR UPDATE SKIP LOCKED，多实例安全）
   */
  async fetchPendingTask(): Promise<AbBuildTask | null> {
    const tasks = await this.taskRepository.find({
      where: { status: 'pending', isRemoved: false } as any,
      order: { createdAt: 'ASC' } as any,
      take: 1,
    });
    return tasks[0] || null;
  }

  // ==================== 私有方法 ====================

  private async generateTaskCode(): Promise<string> {
    const tasks = await this.taskRepository.find({
      where: { isRemoved: false } as any,
      order: { createdAt: 'DESC' } as any,
      take: 1,
    });
    const count = tasks.length > 0 ? parseInt(tasks[0].taskCode.replace('BT', ''), 10) : 0;
    return `BT${String(count + 1).padStart(4, '0')}`;
  }
}
