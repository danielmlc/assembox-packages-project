import { LoggerService } from '@cs/nest-common';
import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { BuildExecutorService } from './build-executor.service';
import { BuildService } from './build.service';

/**
 * 构建任务轮询 Worker（MVP 数据库轮询模式）
 *
 * 每 5 秒检查一次 pending 任务，串行执行。
 * 迭代方向：接入 RocketMQ 后，此 Worker 改为消费 MQ 消息。
 */
@Injectable()
export class BuildWorkerService {
  /** 防止并发：当前是否有任务正在执行 */
  private running = false;

  constructor(
    @Inject(LoggerService)
    private readonly logger: LoggerService,
    private readonly buildService: BuildService,
    private readonly executor: BuildExecutorService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async pollAndExecute(): Promise<void> {
    if (this.running) return;

    const task = await this.buildService.fetchPendingTask();
    if (!task) return;

    this.running = true;
    try {
      await this.executor.execute(task);
    } finally {
      this.running = false;
    }
  }
}
