import { LoggerService } from '@cs/nest-common';
import { Inject, Injectable } from '@nestjs/common';

import { BackendCodegenService } from '../codegen/backend-codegen.service';
import { CodegenCoordinatorService } from '../codegen/codegen-coordinator.service';
import { GiteaService } from '../gitea/gitea.service';
import { StorageRpcService } from '../storage-rpc/storage-rpc.service';

import { AbBuildTask } from './ab-build-task.entity';
import { BuildService } from './build.service';

/**
 * 构建执行器（核心）
 *
 * 串联完整构建流程的 6 个阶段：
 *   阶段一：快照（RPC 调用存储服务）
 *   阶段二：读取配置（RPC 获取清单 + 配置内容）
 *   阶段三：代码生成（调用 libs/code-generator）
 *   阶段四：本地校验（tsc 编译检查）
 *   阶段五：推送 Gitea（写入 generated/ 目录）
 *   阶段六：完成（等待 CI/CD 由 Gitea Actions 自动触发）
 */
@Injectable()
export class BuildExecutorService {
  /** 参与后端构建的组件类型编码列表（is_runtime=0 的组件） */
  private static readonly BACKEND_BUILD_COMPONENTS = ['entity', 'service_method'];

  constructor(
    @Inject(LoggerService)
    private readonly logger: LoggerService,
    private readonly buildService: BuildService,
    private readonly storageRpc: StorageRpcService,
    private readonly coordinator: CodegenCoordinatorService,
    private readonly backendCodegen: BackendCodegenService,
    private readonly giteaService: GiteaService,
  ) {}

  /**
   * 执行完整构建流程
   */
  async execute(task: AbBuildTask): Promise<void> {
    this.logger.log(`开始执行构建任务: ${task.taskCode}`);
    let tmpDir: string | null = null;

    try {
      // ──── 阶段一：快照 ────
      await this.buildService.updateStatus(task.id, 'snapshotting');

      let snapshotId = task.snapshotId;
      let snapshotCode = task.snapshotCode;

      if (!snapshotId) {
        // 新建快照
        const snapshot = await this.storageRpc.createSnapshot(
          task.moduleGroupId,
          task.snapshotName,
        );
        snapshotId = snapshot.id;
        snapshotCode = snapshot.snapshotCode;

        await this.buildService.updateStatus(task.id, 'snapshotting', {
          snapshotId,
          snapshotCode,
          snapshotName: snapshot.snapshotName,
        });

        await this.storageRpc.generateManifest(snapshotId);
        this.logger.log(`快照生成完成: ${snapshotCode}`);
      } else {
        // 回滚场景：task 创建时 snapshotCode/snapshotName 未填写，需从存储服务补全
        const snapshot = await this.storageRpc.getSnapshot(snapshotId);
        snapshotCode = snapshot.snapshotCode;
        await this.buildService.updateStatus(task.id, 'snapshotting', {
          snapshotCode,
          snapshotName: snapshot.snapshotName,
        });
        this.logger.log(`使用已有快照: ${snapshotCode}（跳过快照创建）`);
      }

      // ──── 阶段二：读取配置 ────
      await this.buildService.updateStatus(task.id, 'generating');

      const manifest = await this.storageRpc.getManifest(snapshotId);
      this.logger.log(`获取快照清单成功，共 ${manifest.length} 个模块`);

      const moduleConfigs = await this.coordinator.buildModuleConfigs(
        manifest,
        BuildExecutorService.BACKEND_BUILD_COMPONENTS,
      );

      if (moduleConfigs.length === 0) {
        this.logger.warn(`模块配置为空，无可生成内容，构建完成`);
        await this.buildService.updateStatus(task.id, 'completed');
        return;
      }

      // ──── 阶段三：代码生成 ────
      tmpDir = await this.backendCodegen.generateCode(moduleConfigs, task.id);

      // ──── 阶段四：本地校验 ────
      await this.buildService.updateStatus(task.id, 'validating');
      await this.backendCodegen.validateCode(tmpDir);

      // ──── 阶段五：推送 Gitea ────
      await this.buildService.updateStatus(task.id, 'pushing');

      const repoName = `assembox-configs-${task.moduleGroupCode}-${task.pipelineType}`;
      await this.giteaService.ensureRepository(
        repoName,
        `模块组 ${task.moduleGroupCode} (${task.pipelineType}) 配置仓库`,
      );

      const files = this.backendCodegen.collectGeneratedFiles(tmpDir);
      const commitMessage = `build: ${snapshotCode} ${task.snapshotName}\n\n- 构建任务: ${task.taskCode}\n- 模块数量: ${moduleConfigs.length}\n\nCo-Authored-By: Assembox Builder <noreply@assembox.com>`;

      await this.giteaService.batchCommitFiles({
        owner: this.giteaService.defaultOwner,
        repo: repoName,
        message: commitMessage,
        files,
      });

      // ──── 阶段六：完成（CI/CD 由 Gitea Actions 自动触发） ────
      await this.buildService.updateStatus(task.id, 'completed', {
        giteaRepo: repoName,
      });

      this.logger.log(`构建任务完成: ${task.taskCode}`);
    } catch (error) {
      const errMsg = error.message || String(error);
      this.logger.error(`构建任务失败: ${task.taskCode}`, errMsg);
      await this.buildService.updateStatus(task.id, 'failed', {
        errorMessage: errMsg,
      });
    } finally {
      if (tmpDir) {
        this.backendCodegen.cleanupTmpDir(tmpDir);
      }
    }
  }
}
