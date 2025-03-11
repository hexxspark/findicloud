import {Args, Flags} from '@oclif/core';
import fs from 'fs';
import path from 'path';

import {CopyOptions, FileCopier} from '../copy';
import {colors} from '../utils/colors';
import {BaseCommand} from './base';

export default class CopyCommand extends BaseCommand {
  static id = 'copy';
  static description = 'Copy files to iCloud Drive';
  static aliases = ['cp'];

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
    targetApp: Args.string({
      description: 'Target app name to copy to',
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(CopyCommand);
    const options = this.getCommandOptions(flags);

    try {
      const copyOptions: CopyOptions = {
        source: args.source,
        targetApp: args.targetApp,
        pattern: flags.pattern,
        recursive: flags.recursive || false,
        overwrite: flags.force || false,
        dryRun: flags['dry-run'] || false,
        detailed: flags.detailed || false,
        table: flags.table || false,
        skipConfirmation: flags.yes || false,
        interactive: flags.interactive || false,
      };

      if (!options.silent) {
        this.log(colors.info('Analyzing files to copy...'));
      }

      const fileCopier = new FileCopier();

      // First, analyze what files would be copied
      const analysis = await fileCopier.analyze({
        source: copyOptions.source,
        targetApp: copyOptions.targetApp,
        pattern: copyOptions.pattern,
        recursive: copyOptions.recursive,
      });

      // Show analysis
      if (!options.silent) {
        this.displayAnalysis(analysis, copyOptions);
      }

      // If interactive mode is enabled and not skipping confirmation
      if (copyOptions.interactive && !copyOptions.skipConfirmation) {
        const {confirm} = await import('@inquirer/prompts');
        const shouldProceed = await confirm({message: 'Do you want to proceed with the copy operation?'});
        if (!shouldProceed) {
          this.log(colors.info('Copy operation cancelled by user'));
          return;
        }
      }

      // If not a dry run, proceed with copy
      if (!copyOptions.dryRun) {
        if (!options.silent) {
          this.log(colors.info('\nCopying files...'));
        }

        const result = await fileCopier.copy(copyOptions);

        if (!options.silent) {
          if (result.success) {
            this.log(colors.success('\nFiles copied successfully!'));
          } else {
            this.log(colors.error('\nSome files failed to copy:'));
            result.failedFiles.forEach(file => {
              this.log(colors.error(`  ${file}`));
            });
            result.errors.forEach(error => {
              this.log(colors.error(`  Error: ${error.message}`));
            });
            this.error('Copy operation failed');
          }
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
        this.log('Path                          Size       Last Modified');
        this.log('------------------------------------------------------------');
        analysis.filesToCopy.forEach((file: string) => {
          try {
            const stats = fs.statSync(file);
            const size = this.formatSize(stats.size);
            const lastModified = stats.mtime.toISOString().split('T')[0];
            const relativePath = path.relative(analysis.source, file);
            this.log(`${relativePath.padEnd(30)} ${size.padEnd(10)} ${lastModified}`);
          } catch {
            const relativePath = path.relative(analysis.source, file);
            this.log(`${relativePath.padEnd(30)} Unknown    Unknown`);
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
