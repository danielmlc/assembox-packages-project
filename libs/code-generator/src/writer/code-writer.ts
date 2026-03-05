import * as fs from 'fs';
import * as path from 'path';
import { GenerationMode } from '../types/config';

// ============================================================
// Generation Gap Pattern 实现
// ============================================================

/**
 * 文件写入选项
 */
export interface WriteOptions {
  /**
   * 冲突策略（文件已存在时）
   * - overwrite：直接覆盖（default）
   * - skip：跳过，保留现有文件
   * - diff：打印差异（dry-run）
   */
  conflictStrategy?: 'overwrite' | 'skip' | 'diff';
  /** dry-run 模式：不实际写文件，仅打印会生成的内容 */
  dryRun?: boolean;
  /** 是否显示详细日志 */
  verbose?: boolean;
}

/**
 * 代码写入器
 *
 * 支持三种 Generation Gap 模式：
 *
 * 1. overwrite（默认）：直接覆盖目标文件
 *
 * 2. base-class：
 *    - 生成 generated/base-{name}.{ext}（始终覆盖）
 *    - 首次生成 {name}.{ext}（子类骨架，后续不覆盖）
 *
 * 3. protected-blocks：
 *    - 生成前扫描已有文件中的 @gen-protected 块
 *    - 生成后将保护块重新注入新文件
 */
export class CodeWriter {
  private options: Required<WriteOptions>;

  constructor(options: WriteOptions = {}) {
    this.options = {
      conflictStrategy: options.conflictStrategy ?? 'overwrite',
      dryRun: options.dryRun ?? false,
      verbose: options.verbose ?? false,
    };
  }

  /**
   * 写入文件（统一入口）
   *
   * @param filePath 目标文件路径
   * @param content 生成的代码内容
   * @param mode 生成模式（来自 generation.mode 配置）
   * @param isBaseFile 当前文件是否为 base-class 模式下的 Base 文件
   */
  write(
    filePath: string,
    content: string,
    mode: GenerationMode = 'overwrite',
    isBaseFile = false,
  ): WriteResult {
    switch (mode) {
      case 'base-class':
        return this.writeBaseClass(filePath, content, isBaseFile);
      case 'protected-blocks':
        return this.writeProtectedBlocks(filePath, content);
      default:
        return this.writeOverwrite(filePath, content);
    }
  }

  // ─── overwrite 模式 ─────────────────────────────────────────

  private writeOverwrite(filePath: string, content: string): WriteResult {
    return this.doWrite(filePath, content, 'overwrite');
  }

  // ─── base-class 模式 ────────────────────────────────────────

  /**
   * base-class 模式写入
   *
   * Base 文件（isBaseFile = true）：始终覆盖到 generated/ 子目录
   * 子类文件（isBaseFile = false）：仅在不存在时创建骨架，后续跳过
   */
  private writeBaseClass(
    filePath: string,
    content: string,
    isBaseFile: boolean,
  ): WriteResult {
    if (isBaseFile) {
      // Base 文件放在 generated/ 子目录下
      const dir = path.dirname(filePath);
      const basename = path.basename(filePath);
      const baseName = this.toBaseFileName(basename);
      const targetPath = path.join(dir, 'generated', baseName);
      this.ensureDir(path.dirname(targetPath));
      return this.doWrite(targetPath, content, 'overwrite');
    } else {
      // 子类骨架文件：不存在时创建，已存在时跳过（保护手写代码）
      if (fs.existsSync(filePath)) {
        if (this.options.verbose) {
          console.log(`  ⏩ Skip (exists): ${filePath}`);
        }
        return { action: 'skipped', filePath };
      }
      return this.doWrite(filePath, content, 'overwrite');
    }
  }

  /**
   * 将普通文件名转换为 Base 文件名
   * 例如：user.service.ts → base-user.service.ts
   */
  private toBaseFileName(basename: string): string {
    const dotIndex = basename.indexOf('.');
    if (dotIndex === -1) return `base-${basename}`;
    return `base-${basename.slice(0, dotIndex)}${basename.slice(dotIndex)}`;
  }

  // ─── protected-blocks 模式 ──────────────────────────────────

  /**
   * protected-blocks 模式写入
   *
   * 规则：
   * - 提取目标文件中 @gen-protected 标记的代码块
   * - 将新内容写入文件
   * - 将提取的保护块注入到新文件对应标记位置
   *
   * 标记格式（生成器在模板中预留）：
   *   // @gen-protected:custom-methods
   *   // @gen-protected-end:custom-methods
   */
  private writeProtectedBlocks(filePath: string, content: string): WriteResult {
    let finalContent = content;

    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, 'utf-8');
      const blocks = this.extractProtectedBlocks(existing);

      if (blocks.size > 0) {
        finalContent = this.injectProtectedBlocks(content, blocks);
      }
    }

    return this.doWrite(filePath, finalContent, 'overwrite');
  }

  /**
   * 从已有文件中提取 @gen-protected 块
   * 返回 Map<blockName, blockContent>
   */
  private extractProtectedBlocks(source: string): Map<string, string> {
    const blocks = new Map<string, string>();
    const regex = /\/\/ @gen-protected:(\S+)([\s\S]*?)\/\/ @gen-protected-end:\1/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      const [, name, body] = match;
      blocks.set(name, body);
    }
    return blocks;
  }

  /**
   * 将保护块注入到新生成的内容中
   */
  private injectProtectedBlocks(content: string, blocks: Map<string, string>): string {
    let result = content;
    for (const [name, body] of blocks) {
      const startMark = `// @gen-protected:${name}`;
      const endMark = `// @gen-protected-end:${name}`;

      const startIdx = result.indexOf(startMark);
      const endIdx = result.indexOf(endMark);

      if (startIdx !== -1 && endIdx !== -1) {
        const before = result.slice(0, startIdx + startMark.length);
        const after = result.slice(endIdx);
        result = `${before}${body}${after}`;
      }
    }
    return result;
  }

  // ─── 底层写入 ────────────────────────────────────────────────

  private doWrite(
    filePath: string,
    content: string,
    _strategy: 'overwrite' | 'skip',
  ): WriteResult {
    if (this.options.dryRun) {
      console.log(`  [dry-run] Would write: ${filePath}`);
      console.log(`  ${'-'.repeat(60)}`);
      console.log(content.split('\n').slice(0, 10).map(l => `  ${l}`).join('\n'));
      if (content.split('\n').length > 10) console.log(`  ... (${content.split('\n').length} lines total)`);
      console.log(`  ${'-'.repeat(60)}`);
      return { action: 'dry-run', filePath };
    }

    this.ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf-8');

    if (this.options.verbose) {
      console.log(`  ✓ Written: ${filePath}`);
    }

    return { action: 'written', filePath };
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export interface WriteResult {
  action: 'written' | 'skipped' | 'dry-run';
  filePath: string;
}

// ============================================================
// Base Class 骨架生成器（为 base-class 模式生成子类骨架）
// ============================================================

/**
 * 生成子类骨架代码（base-class 模式专用）
 *
 * 首次运行时，为 Service / Controller 生成继承 Base 类的空子类，
 * 开发者在其中添加业务逻辑后，后续重新生成不再覆盖。
 *
 * 保护块（@gen-protected）预留在子类中，供开发者填写自定义逻辑。
 */
export class SubclassScaffolder {
  /**
   * 生成 Service 子类骨架
   */
  static service(entityCode: string, entityName: string): string {
    const pascal = toPascalCase(entityCode);
    const kebab = toKebabCase(entityCode);
    return [
      `import { Injectable } from '@nestjs/common';`,
      `import { Base${pascal}Service } from './generated/base-${kebab}.service';`,
      ``,
      `/**`,
      ` * ${entityName} 服务（自定义扩展层）`,
      ` * 此文件生成后不会被代码生成器覆盖，可在此添加业务逻辑`,
      ` */`,
      `@Injectable()`,
      `export class ${pascal}Service extends Base${pascal}Service {`,
      `  // @gen-protected:custom-methods`,
      `  // 在此添加自定义业务方法`,
      `  // @gen-protected-end:custom-methods`,
      `}`,
    ].join('\n');
  }

  /**
   * 生成 Controller 子类骨架
   */
  static controller(entityCode: string, entityName: string, prefix?: string): string {
    const pascal = toPascalCase(entityCode);
    const kebab = toKebabCase(entityCode);
    const apiPrefix = prefix ?? kebab;
    return [
      `import { Controller } from '@nestjs/common';`,
      `import { Base${pascal}Controller } from './generated/base-${kebab}.controller';`,
      `import { ApiTags } from '@nestjs/swagger';`,
      ``,
      `/**`,
      ` * ${entityName} 控制器（自定义扩展层）`,
      ` * 此文件生成后不会被代码生成器覆盖，可在此添加自定义路由`,
      ` */`,
      `@ApiTags('${entityName}')`,
      `@Controller('${apiPrefix}')`,
      `export class ${pascal}Controller extends Base${pascal}Controller {`,
      `  // @gen-protected:custom-routes`,
      `  // 在此添加自定义路由方法`,
      `  // @gen-protected-end:custom-routes`,
      `}`,
    ].join('\n');
  }
}

// ─── 命名工具 ──────────────────────────────────────────────

function toPascalCase(str: string): string {
  return str.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
}

function toKebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, m => `-${m.toLowerCase()}`)
    .replace(/_/g, '-')
    .replace(/^-/, '');
}
