import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { ModuleConfig } from './types/config';
import { CodeGenerator } from './code-generator';

/**
 * CLI 入口程序
 */
const program = new Command();

program.name('cs-codegen').description('代码生成器 CLI').version('1.0.0');

program
    .requiredOption('-c, --config <path>', '配置文件路径')
    .requiredOption('-o, --output <path>', '输出目录')
    .action(async (options) => {
        try {
            const configPath = path.resolve(options.config);
            const outputPath = path.resolve(options.output);

            if (!fs.existsSync(configPath)) {
                console.error(`配置文件不存在: ${configPath}`);
                process.exit(1);
            }

            const configContent = fs.readFileSync(configPath, 'utf-8');
            const config: ModuleConfig = JSON.parse(configContent);

            const generator = new CodeGenerator();
            await generator.generate(config, outputPath);
        } catch (error) {
            console.error('生成失败:', error);
            process.exit(1);
        }
    });

program.parse();
