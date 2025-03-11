import {Args, Flags} from '@oclif/core';
import fs from 'fs';
import path from 'path';

import {BaseCommand} from '../command';
import {CopyOptions, FileCopier} from '../copy';
import {colors} from '../utils/colors';

export default class CopyCommand extends BaseCommand {
  static id = 'copy';
  static description = 'Copy files to iCloud Drive';

  static examples = [
    '$ icloudy copy file.txt Word                # Copy file to Word app data',
    '$ icloudy copy folder Word -r               # Copy folder recursively',
    '$ icloudy copy *.txt Word -p "*.txt"        # Copy only .txt files',
    '$ icloudy copy folder Word -r -f            # Force overwrite existing files',
    '$ icloudy copy folder Word -r --dry-run     # Show what would be copied',
  ];

  static flags = {
    ...BaseCommand.flags,
    recursive: Flags.boolean({
      char: 'r',
      description: 'Copy directories recursively',
      default: false,
    }),
    pattern: Flags.string({
      char: 'p',
      description: 'File pattern to match (e.g. "*.txt")',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force overwrite existing files',
      default: false,
    }),
    'dry-run': Flags.boolean({
      description: 'Show what would be copied without actually copying',
      default: false,
    }),
    detailed: Flags.boolean({
      description: 'Display detailed file information',
      default: false,
    }),
    table: Flags.boolean({
      description: 'Display file information in table format',
      default: false,
    }),
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompt',
      default: false,
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactive mode with confirmation prompts',
      default: false,
    }),
  };

  static args = {
    source: Args.string({
      description: 'Source path to copy from',
      required: true,
    }),
    app: Args.string({
      description: 'Target app name to copy to',
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(CopyCommand);
    const options = this.getCommandOptions(flags);

    try {
      // 准备复制选项
      const copyOptions: Omit<CopyOptions, 'source' | 'app'> = {
        pattern: flags.pattern,
        recursive: flags.recursive || false,
        overwrite: flags.force || false,
        dryRun: flags['dry-run'] || false,
        detailed: flags.detailed || false,
        table: flags.table || false,
        force: flags.yes || false,
        interactive: flags.interactive || false,
      };

      if (!options.silent) {
        this.log(colors.info('Analyzing files to copy...'));
      }

      const fileCopier = new FileCopier();

      // 使用新的函数调用方式
      // First, analyze what files would be copied
      const analysis = await fileCopier.analyze({
        source: args.source,
        app: args.app,
        pattern: flags.pattern,
        recursive: flags.recursive,
      });

      // Show analysis
      if (!options.silent) {
        this.displayAnalysis(analysis, {
          source: args.source,
          app: args.app,
          ...copyOptions,
        });
      }

      // If interactive mode is enabled and not skipping confirmation
      if (copyOptions.interactive && !copyOptions.force) {
        const {confirm} = await import('@inquirer/prompts');
        const shouldProceed = await confirm({message: 'Do you want to proceed with the copy operation?'});
        if (!shouldProceed) {
          this.log(colors.warning('Operation cancelled by user'));
          return;
        }
      }

      // 使用新的函数调用方式执行复制
      const result = await fileCopier.copy(args.source, args.app, copyOptions);

      if (!options.silent) {
        if (result.success) {
          this.log(colors.success(`\nSuccessfully copied ${result.copiedFiles.length} files to ${result.targetPath}`));
        } else {
          this.log(colors.error(`\nFailed to copy ${result.failedFiles.length} files`));
          result.errors.forEach(err => {
            this.log(colors.error(`- ${err.message}`));
          });
          this.error('Copy operation failed');
        }
      }
    } catch (error: any) {
      this.error(error);
    }
  }

  private displayAnalysis(analysis: any, options: CopyOptions): void {
    this.log(colors.bold('\nCopy Analysis:'));
    this.log(`Source: ${analysis.source}`);
    this.log(`Target Paths: ${analysis.targetPaths.map((p: any) => p.path).join(', ')}`);
    this.log(`Files to Copy: ${analysis.totalFiles}`);
    this.log(`Total Size: ${this.formatSize(analysis.totalSize)}`);

    if (options.dryRun || options.detailed) {
      if (options.table) {
        this.log(colors.dim('\nFiles to copy (table format):'));

        // 定义列宽
        const pathWidth = 30;
        const sizeWidth = 10;
        const dateWidth = 10;

        // 计算表头和分隔线
        const header = `Path${' '.repeat(pathWidth - 4)} Size${' '.repeat(sizeWidth - 4)} Last Modified`;
        const separatorWidth = pathWidth + sizeWidth + dateWidth + 2; // +2 for spaces between columns
        const separator = '─'.repeat(separatorWidth);

        this.log(header);
        this.log(colors.dim(separator));

        analysis.filesToCopy.forEach((file: string) => {
          try {
            const stats = fs.statSync(file);
            const size = this.formatSize(stats.size);
            const lastModified = stats.mtime.toISOString().split('T')[0];
            const relativePath = path.relative(analysis.source, file);
            this.log(`${relativePath.padEnd(pathWidth)} ${size.padEnd(sizeWidth)} ${lastModified}`);
          } catch {
            const relativePath = path.relative(analysis.source, file);
            this.log(`${relativePath.padEnd(pathWidth)} Unknown${' '.repeat(sizeWidth - 7)} Unknown`);
          }
        });
      } else {
        this.log(colors.dim('\nFiles that would be copied:'));
        analysis.filesToCopy.forEach((file: string) => {
          const relativePath = path.relative(analysis.source, file);
          if (options.detailed) {
            try {
              const stats = fs.statSync(file);
              this.log(
                `  ${relativePath} (${this.formatSize(stats.size)}, last modified: ${stats.mtime.toISOString()})`,
              );
            } catch {
              this.log(`  ${relativePath} (size unknown)`);
            }
          } else {
            this.log(`  ${relativePath}`);
          }
        });
      }
    }
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
