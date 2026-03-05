/**
 * Gitea API 相关接口定义
 */

/**
 * Gitea 仓库信息
 */
export interface GiteaRepository {
  id?: number;
  name: string;
  full_name?: string;
  description?: string;
  private?: boolean;
  /** 仓库是否为空（无任何 commit） */
  empty?: boolean;
  /** 仓库所有者信息 */
  owner?: { login: string };
  html_url?: string;
  clone_url?: string;
  ssh_url?: string;
  default_branch?: string;
}

/**
 * Gitea 提交文件请求
 */
export interface GiteaCommitFileRequest {
  /** 仓库所有者 */
  owner: string;
  /** 仓库名称 */
  repo: string;
  /** 分支名称 */
  branch?: string;
  /** 文件路径（相对于仓库根目录） */
  filePath: string;
  /** 文件内容（可以是字符串或 Buffer） */
  content: string | Buffer;
  /** 提交信息 */
  message: string;
  /** 提交者信息 */
  author?: {
    name: string;
    email: string;
  };
}

/**
 * Gitea 批量提交请求
 */
export interface GiteaBatchCommitRequest {
  /** 仓库所有者 */
  owner: string;
  /** 仓库名称 */
  repo: string;
  /** 分支名称 */
  branch?: string;
  /** 提交信息 */
  message: string;
  /** 文件列表 */
  files: Array<{
    path: string;
    content: string | Buffer;
  }>;
  /** 提交者信息 */
  author?: {
    name: string;
    email: string;
  };
}

/**
 * Gitea 创建 Tag 请求
 */
export interface GiteaCreateTagRequest {
  /** 仓库所有者 */
  owner: string;
  /** 仓库名称 */
  repo: string;
  /** Tag 名称 */
  tagName: string;
  /** Tag 说明 */
  message?: string;
  /** 目标提交 SHA（可选，默认为当前分支最新提交） */
  target?: string;
}

/**
 * Gitea 创建仓库请求
 */
export interface GiteaCreateRepoRequest {
  /** 仓库名称 */
  name: string;
  /** 仓库描述 */
  description?: string;
  /** 是否私有 */
  private?: boolean;
  /** 是否自动初始化（创建 README） */
  auto_init?: boolean;
  /** 默认分支 */
  default_branch?: string;
}

/**
 * Gitea 服务配置
 */
export interface GiteaConfig {
  /** Gitea API 地址 */
  apiUrl: string;
  /** 访问令牌 */
  token: string;
  /** 默认组织/用户名 */
  defaultOwner: string;
  /** 默认分支 */
  defaultBranch?: string;
  /** 默认提交者信息 */
  defaultAuthor?: {
    name: string;
    email: string;
  };
}
