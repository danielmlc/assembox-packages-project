import { LoggerService } from '@cs/nest-common';
import { Inject, Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

import {
  GiteaBatchCommitRequest,
  GiteaCommitFileRequest,
  GiteaConfig,
  GiteaCreateRepoRequest,
  GiteaCreateTagRequest,
  GiteaRepository,
} from './gitea.interface';

export const GITEA_CONFIG = Symbol('GITEA_CONFIG');

/**
 * Gitea 服务
 * 提供与 Gitea API 交互的功能
 */
@Injectable()
export class GiteaService {
  private readonly httpClient: AxiosInstance;

  constructor(
    @Inject(LoggerService)
    private readonly logger: LoggerService,
    @Inject(GITEA_CONFIG)
    private readonly config: GiteaConfig,
  ) {
    this.httpClient = axios.create({
      baseURL: config.apiUrl,
      headers: {
        Authorization: `token ${config.token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        // 404 是"检查资源是否存在"的正常结果，不记录为错误
        if (error.response?.status !== 404) {
          this.logger.error('Gitea API 调用失败', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      },
    );
  }

  /**
   * 确保仓库存在（不存在则自动创建）
   * @param name 仓库名称
   * @param description 仓库描述
   * @returns 仓库信息
   */
  async ensureRepository(name: string, description?: string): Promise<GiteaRepository> {
    const exists = await this.repositoryExists(this.config.defaultOwner, name);
    if (exists) {
      const repo = await this.getRepository(this.config.defaultOwner, name);
      // 仓库存在但为空（极少见），补充初始化确保后续文件提交可用
      if (repo.empty) {
        await this.initializeEmptyRepo(this.config.defaultOwner, name);
      }
      return repo;
    }
    return await this.createRepository({ name, description });
  }

  /**
   * 提交单个文件
   *
   * 同一仓库的并发提交会导致 git HEAD 冲突（500），通过 per-repo 队列串行化解决。
   * @param request 提交文件请求
   */
  // Per-repo 提交队列：防止并发提交造成 git HEAD 冲突
  private readonly commitQueue = new Map<string, Promise<void>>();

  async commitFile(request: GiteaCommitFileRequest): Promise<void> {
    const key = `${request.owner}/${request.repo}`;
    const previous = this.commitQueue.get(key) ?? Promise.resolve();

    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    this.commitQueue.set(key, pending);

    await previous;
    try {
      await this.doCommitFile(request);
    } finally {
      release();
      if (this.commitQueue.get(key) === pending) {
        this.commitQueue.delete(key);
      }
    }
  }

  private async doCommitFile(request: GiteaCommitFileRequest, maxRetries = 2): Promise<void> {
    const branch = request.branch || this.config.defaultBranch;
    const author = request.author ?? this.config.defaultAuthor ?? { name: 'Assembox', email: 'noreply@assembox.com' };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 检查文件是否已存在（更新时需要提供 sha，新建时使用 POST）
        let sha: string | undefined;
        try {
          const fileResponse = await this.httpClient.get(
            `/repos/${request.owner}/${request.repo}/contents/${request.filePath}`,
            { params: { ref: branch } },
          );
          sha = fileResponse.data.sha;
        } catch {
          // 文件不存在，sha 保持 undefined
        }

        const apiPath = `/repos/${request.owner}/${request.repo}/contents/${request.filePath}`;
        const body = {
          message: request.message,
          content: this.toBase64(request.content),
          branch,
          author: { name: author.name, email: author.email },
          ...(sha ? { sha } : {}),
        };

        if (sha) {
          await this.httpClient.put(apiPath, body);
        } else {
          await this.httpClient.post(apiPath, body);
        }

        this.logger.log(`文件提交成功: ${request.repo}/${request.filePath}`);
        return;
      } catch (error: unknown) {
        const err = error as { response?: { status?: number } };
        if (err.response?.status === 500 && attempt < maxRetries) {
          this.logger.warn(`文件提交 500，1000ms 后重试 (${attempt}/${maxRetries}): ${request.filePath}`);
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        this.logger.error(`文件提交失败: ${request.repo}/${request.filePath}`);
        throw error;
      }
    }
  }

  /**
   * 批量提交文件
   * Gitea API 不支持原子批量提交，逐个提交实现
   * @param request 批量提交请求
   */
  async batchCommitFiles(request: GiteaBatchCommitRequest): Promise<void> {
    const branch = request.branch || this.config.defaultBranch;
    const author = request.author ?? this.config.defaultAuthor ?? { name: 'Assembox', email: 'noreply@assembox.com' };

    this.logger.log(`开始批量提交: ${request.repo}, 文件数量: ${request.files.length}`);

    try {
      for (const file of request.files) {
        await this.commitFile({
          owner: request.owner,
          repo: request.repo,
          branch,
          filePath: file.path,
          content: file.content,
          message: request.message,
          author,
        });
      }

      this.logger.log(`批量提交成功: ${request.repo}, 共 ${request.files.length} 个文件`);
    } catch (error) {
      this.logger.error('批量提交失败', error);
      throw error;
    }
  }

  /**
   * 创建 Tag（用于快照版本标记）
   * @param request 创建 Tag 请求
   */
  async createTag(request: GiteaCreateTagRequest): Promise<void> {
    try {
      let target = request.target;
      if (!target) {
        const branchResponse = await this.httpClient.get(
          `/repos/${request.owner}/${request.repo}/branches/${this.config.defaultBranch}`,
        );
        target = branchResponse.data.commit.id;
      }

      await this.httpClient.post(`/repos/${request.owner}/${request.repo}/tags`, {
        tag_name: request.tagName,
        message: request.message || '',
        target,
      });

      this.logger.log(`Tag 创建成功: ${request.repo} - ${request.tagName}`);
    } catch (error) {
      this.logger.error(`Tag 创建失败: ${request.tagName}`, error);
      throw error;
    }
  }

  /**
   * 检查仓库是否存在
   */
  async repositoryExists(owner: string, repo: string): Promise<boolean> {
    try {
      await this.getRepository(owner, repo);
      return true;
    } catch (error) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }

  get defaultOwner(): string {
    return this.config.defaultOwner;
  }

  // ==================== 私有方法 ====================

  private async createRepository(request: GiteaCreateRepoRequest): Promise<GiteaRepository> {
    const payload = {
      name: request.name,
      description: request.description || '',
      private: request.private !== false,
      auto_init: request.auto_init !== false,
      default_branch: request.default_branch || this.config.defaultBranch,
    };

    let repo: GiteaRepository;
    try {
      // 优先使用组织接口（auto_init 更可靠）
      const response = await this.httpClient.post<GiteaRepository>(
        `/orgs/${this.config.defaultOwner}/repos`,
        payload,
      );
      repo = response.data;
      this.logger.log(`仓库创建成功（组织）: ${request.name}`);
    } catch (orgError: unknown) {
      const err = orgError as { response?: { status?: number } };
      if (err.response?.status === 409) {
        // 仓库已存在，直接获取返回
        this.logger.warn(`仓库已存在: ${request.name}`);
        return await this.getRepository(this.config.defaultOwner, request.name);
      }
      // 组织接口失败，回退到用户接口
      this.logger.warn(`组织接口失败 (${err.response?.status})，回退用户接口: ${request.name}`);
      const response = await this.httpClient.post<GiteaRepository>(`/user/repos`, payload);
      repo = response.data;
      this.logger.log(`仓库创建成功（用户）: ${request.name}`);
    }

    // auto_init 未生效时（部分 Gitea 实例），手动初始化使仓库可用
    if (repo.empty) {
      const owner = repo.owner?.login || this.config.defaultOwner;
      await this.initializeEmptyRepo(owner, request.name);
    }

    return repo;
  }

  /**
   * 初始化真正空仓库（无任何 commit）
   * auto_init 未生效时的回退方案：直接 POST 第一个文件建立初始 commit
   */
  private async initializeEmptyRepo(owner: string, repo: string): Promise<void> {
    const branch = this.config.defaultBranch;
    this.logger.warn(`检测到空仓库，正在初始化: ${owner}/${repo} @ ${branch}`);
    const readmeContent = `# ${repo}\n\n由 Assembox 自动初始化。\n`;
    try {
      await this.httpClient.post(`/repos/${owner}/${repo}/contents/README.md`, {
        message: 'chore: 初始化仓库',
        content: this.toBase64(readmeContent),
        branch,
        author: this.config.defaultAuthor ?? { name: 'Assembox', email: 'noreply@assembox.com' },
      });
      this.logger.log(`空仓库初始化成功: ${owner}/${repo}`);
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      // 409 = 并发初始化已完成；422 = 文件已存在（Gitea 部分版本）；均视为成功
      if (err.response?.status === 409 || err.response?.status === 422) {
        this.logger.warn(`仓库已由并发请求初始化，跳过: ${owner}/${repo}`);
        return;
      }
      this.logger.error(`空仓库初始化失败: ${owner}/${repo}`, error);
      throw error;
    }
  }

  private async getRepository(owner: string, repo: string): Promise<GiteaRepository> {
    const response = await this.httpClient.get<GiteaRepository>(`/repos/${owner}/${repo}`);
    return response.data;
  }

  private toBase64(content: string | Buffer): string {
    if (Buffer.isBuffer(content)) {
      return content.toString('base64');
    }
    return Buffer.from(content, 'utf-8').toString('base64');
  }
}
