import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

import { LoggerService } from '@cs/nest-common';
import { Inject, Injectable } from '@nestjs/common';

const execAsync = promisify(exec);

/**
 * 后端代码生成服务
 *
 * 职责：
 *   1. 调用 libs/code-generator 生成 NestJS 代码到临时目录
 *   2. 对生成代码执行 tsc 编译检查
 *   3. 清理临时目录
 */
@Injectable()
export class BackendCodegenService {
  constructor(
    @Inject(LoggerService)
    private readonly logger: LoggerService,
  ) {}

  /**
   * 生成代码并写入临时目录
   *
   * @param moduleConfigs ModuleConfig[] 代码生成器输入
   * @param taskId 构建任务 ID（用于隔离临时目录）
   * @returns 临时目录路径（包含所有生成文件）
   */
  async generateCode(moduleConfigs: any[], taskId: string): Promise<string> {
    // 动态 require，避免在 NestJS 启动时加载（ts-morph 较重）
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { CodeGenerator } = require('../../../../libs/code-generator/src/index');

    const tmpDir = path.join(require('os').tmpdir(), 'assembox-build', taskId);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }

    const generator = new CodeGenerator();
    for (const config of moduleConfigs) {
      const moduleOutputDir = path.join(tmpDir, 'src', 'modules', config.moduleCode);
      this.logger.log(`生成模块代码: ${config.moduleCode} → ${moduleOutputDir}`);
      await generator.generate(config, moduleOutputDir);
    }

    this.logger.log(`代码生成完成，临时目录: ${tmpDir}`);
    return tmpDir;
  }

  /**
   * 对临时目录中的生成代码执行 tsc 编译检查
   *
   * @param tmpDir 生成代码所在临时目录
   */
  async validateCode(tmpDir: string): Promise<void> {
    // 构建服务自身 node_modules 路径（用于类型解析）
    const builderRoot = path.resolve(__dirname, '../..');
    const builderNodeModules = path.join(builderRoot, 'node_modules');

    // 在临时目录创建 node_modules 软链接（junction 模式兼容 Windows）
    const tmpNodeModules = path.join(tmpDir, 'node_modules');
    if (!fs.existsSync(tmpNodeModules)) {
      try {
        fs.symlinkSync(builderNodeModules, tmpNodeModules, 'junction');
      } catch (e) {
        this.logger.warn(`node_modules 软链接创建失败，尝试继续: ${e.message}`);
      }
    }

    // 写入最小化 tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        noEmit: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        skipLibCheck: true,
        strict: false,
        moduleResolution: 'node',
      },
      include: ['src/**/*.ts'],
    };
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

    // 使用构建服务自带的 tsc
    const tscBin = path.join(builderNodeModules, '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
    const cmd = `"${tscBin}" --project "${path.join(tmpDir, 'tsconfig.json')}"`;

    this.logger.log(`开始 tsc 编译检查: ${tmpDir}`);
    try {
      await execAsync(cmd, { cwd: tmpDir });
      this.logger.log('tsc 编译检查通过');
    } catch (error) {
      const errMsg = error.stdout || error.stderr || error.message;
      this.logger.error('tsc 编译检查失败', errMsg);
      throw new Error(`TypeScript 编译错误:\n${errMsg}`);
    }
  }

  /**
   * 收集临时目录中所有生成文件（相对路径 + 内容），供 Gitea 推送使用
   *
   * @param tmpDir 生成代码所在临时目录
   * @returns 文件列表，每项包含 path（相对于仓库根的路径）和 content（文件内容）
   */
  collectGeneratedFiles(tmpDir: string): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];
    const srcDir = path.join(tmpDir, 'src');

    if (!fs.existsSync(srcDir)) return files;

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, entry);
        if (fs.statSync(fullPath).isDirectory()) {
          walk(fullPath);
        } else if (fullPath.endsWith('.ts')) {
          const relativePath = path.relative(tmpDir, fullPath).replace(/\\/g, '/');
          // 目标路径：generated/src/modules/{moduleCode}/{fileName}
          files.push({
            path: `generated/${relativePath}`,
            content: fs.readFileSync(fullPath, 'utf-8'),
          });
        }
      }
    };

    walk(srcDir);
    this.logger.log(`共收集生成文件 ${files.length} 个`);
    return files;
  }

  /**
   * 清理临时目录
   */
  cleanupTmpDir(tmpDir: string): void {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true });
        this.logger.log(`临时目录已清理: ${tmpDir}`);
      }
    } catch (e) {
      this.logger.warn(`临时目录清理失败: ${e.message}`);
    }
  }
}
