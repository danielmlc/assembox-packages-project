import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { AbBuildTask } from './ab-build-task.entity';
import { BuildService } from './build.service';
import { CicdResultDto, TriggerBuildDto } from './dto';

/**
 * 构建任务 API 控制器
 */
@Controller('build')
export class BuildController {
  constructor(private readonly buildService: BuildService) {}

  /**
   * 触发构建
   * POST /build/trigger
   */
  @Post('trigger')
  async trigger(@Body() dto: TriggerBuildDto): Promise<{ taskId: string; taskCode: string; status: string }> {
    const task = await this.buildService.trigger(dto, dto.moduleGroupCode);
    return { taskId: task.id, taskCode: task.taskCode, status: task.status };
  }

  /**
   * 查询模块组构建历史（静态路由需在动态路由 :id 之前注册）
   * GET /build/by-group/:moduleGroupId
   */
  @Get('by-group/:moduleGroupId')
  async findByGroup(@Param('moduleGroupId') moduleGroupId: string): Promise<AbBuildTask[]> {
    return await this.buildService.findByModuleGroup(moduleGroupId);
  }

  /**
   * 查询构建任务详情
   * GET /build/:id
   */
  @Get(':id')
  async findById(@Param('id') id: string): Promise<AbBuildTask> {
    return await this.buildService.findById(id);
  }

  /**
   * CI/CD 结果回调（由 Gitea Actions 在部署完成后调用）
   * POST /build/cicd-result
   */
  @Post('cicd-result')
  async cicdResult(@Body() dto: CicdResultDto): Promise<{ success: boolean }> {
    const tasks = await this.buildService.findByModuleGroup(dto.moduleGroupCode);
    const pushingTask = tasks.find((t) => t.status === 'pushing');
    if (pushingTask) {
      const status = dto.status === 'success' ? 'completed' : 'failed';
      const extra = dto.status === 'failure'
        ? { errorMessage: 'CI/CD 流水线执行失败' }
        : undefined;
      await this.buildService.updateStatus(pushingTask.id, status, extra);
    }
    return { success: true };
  }
}
