/**
 * 代码格式化工具
 *
 * 生成代码的最后一步：通过 Prettier 格式化，确保输出与项目手写代码风格一致。
 *
 * 设计原则：
 * - 格式化失败时不抛出异常，返回原始内容并打印警告（不阻塞生成流程）
 * - 支持同步/异步两种调用方式（Prettier v3 为全异步）
 */
export class CodeFormatter {
  private prettier: any | null = null;
  private initialized = false;

  /**
   * 懒加载 Prettier（避免在不需要格式化时引入依赖）
   */
  private async loadPrettier(): Promise<any | null> {
    if (this.initialized) return this.prettier;
    this.initialized = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.prettier = require('prettier');
    } catch {
      console.warn('[CodeFormatter] Prettier not available, skipping formatting.');
      this.prettier = null;
    }
    return this.prettier;
  }

  /**
   * 格式化 TypeScript 代码字符串
   *
   * @param code 原始生成代码
   * @param filePath 文件路径（用于 Prettier 推断配置和解析器）
   * @returns 格式化后的代码（失败时返回原始代码）
   */
  async format(code: string, filePath: string): Promise<string> {
    const prettier = await this.loadPrettier();
    if (!prettier) return code;

    try {
      // 尝试加载项目 .prettierrc 配置
      const config = await prettier.resolveConfig(filePath).catch(() => null);

      const formatted = await prettier.format(code, {
        ...(config ?? {}),
        // 默认 TypeScript 风格（可被 .prettierrc 覆盖）
        parser: 'typescript',
        printWidth: config?.printWidth ?? 100,
        tabWidth: config?.tabWidth ?? 2,
        singleQuote: config?.singleQuote ?? true,
        trailingComma: config?.trailingComma ?? 'all',
        semi: config?.semi !== false,
      });

      return formatted;
    } catch (err: any) {
      console.warn(`[CodeFormatter] Failed to format ${filePath}: ${err?.message}`);
      return code;
    }
  }

  /**
   * 批量格式化（并行处理多个文件）
   */
  async formatAll(files: Array<{ path: string; content: string }>): Promise<Array<{ path: string; content: string }>> {
    return Promise.all(
      files.map(async f => ({
        path: f.path,
        content: await this.format(f.content, f.path),
      })),
    );
  }
}

/** 单例（供 CodeGenerator 直接使用） */
export const codeFormatter = new CodeFormatter();
