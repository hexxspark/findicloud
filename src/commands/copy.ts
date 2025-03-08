import { Args, Flags } from '@oclif/core';

import { FileCopier } from '../copy';
import { PathType } from '../types';
import { colors } from '../utils/colors';
import { BaseCommand } from './base';

export default class CopyCommand extends BaseCommand {
  static id = 'copy';
  static description = 'Copy files to iCloud Drive';
  static aliases = ['cp'];

  static examples = [
    '$ icloudy copy ./documents docs              # Copy local documents to iCloud Drive documents library',
    '$ icloudy copy ./notes app Notes            # Copy local notes to Notes app iCloud storage',
    '$ icloudy copy ./photos photos -r          # Recursively copy all files to iCloud photos library',
    '$ icloudy copy ./data root -p "*.txt" -i   # Interactively copy txt files to iCloud root',
    '$ icloudy copy ./backup docs -y            # Copy to documents library without confirmation',
  ];

  static flags = {
    ...BaseCommand.flags,
    pattern: Flags.string({
      char: 'p',
      description: 'File pattern to match (default: *)',
    }),
    recursive: Flags.boolean({
      char: 'r',
      description: 'Copy directories recursively',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing files',
    }),
    'dry-run': Flags.boolean({
      char: 'd',
      description: 'Show what would be copied without actually copying',
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Enable interactive confirmation for copy operations',
      exclusive: ['yes'],
    }),
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip all confirmations',
      exclusive: ['interactive'],
    }),
    detailed: Flags.boolean({
      char: 'D',
      description: 'Show detailed information for copy operations',
    }),
    table: Flags.boolean({
      char: 't',
      description: 'Show results in table format',
      dependsOn: ['detailed'],
    }),
  };

  static args = {
    source: Args.string({
      description: 'Source path to copy from',
      required: true,
    }),
    type: Args.string({
      description: 'Target path type (root|app|photos|docs)',
      required: true,
    }),
    appName: Args.string({
      description: 'App name (required for app type)',
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(CopyCommand);
    const options = this.getCommandOptions(flags);

    try {
      // Set source path
      options.source = args.source;

      // Convert type argument to PathType
      const type = args.type.toUpperCase();
      if (type in PathType) {
        options.targetType = PathType[type as keyof typeof PathType];
      } else {
        this.error('Invalid target type');
      }

      // Set app name if provided
      if (args.appName) {
        options.targetApp = args.appName;
      }

      // Set additional options
      options.pattern = flags.pattern;
      options.recursive = flags.recursive || false;
      options.overwrite = flags.force || false;
      options.dryRun = flags['dry-run'] || false;
      options.interactive = flags.interactive || false;
      options.skipConfirmation = flags.yes || false;
      options.detailed = flags.detailed || false;
      options.tableFormat = flags.table || false;

      if (!options.silent) {
        this.log(colors.info('Analyzing files to copy...'));
      }

      const fileCopier = new FileCopier();

      // First, analyze what files would be copied
      const analysis = await fileCopier.analyze({
        source: options.source,
        targetType: options.targetType,
        targetApp: options.targetApp,
        pattern: options.pattern,
        recursive: options.recursive,
      });

      // Show analysis and get confirmation if needed
      if (!options.skipConfirmation) {
        if (options.detailed) {
          if (options.tableFormat) {
            this.displayTableOutput(analysis.files);
          } else {
            this.displayDetailedOutput(analysis);
          }
        } else {
          this.log(colors.info(`Found ${analysis.files.length} files to copy:`));
          analysis.files.forEach((file, index) => {
            this.log(colors.formatProgress(index + 1, analysis.files.length, file.sourcePath));
          });
        }

        if (options.interactive && !options.dryRun) {
          const confirmed = await this.confirm('Do you want to proceed with the copy operation?');
          if (!confirmed) {
            this.log(colors.warning('Copy operation cancelled.'));
            return;
          }
        }
      }

      if (options.dryRun) {
        if (!options.silent) {
          this.log(colors.info('Dry run completed. No files were copied.'));
        }
        return;
      }

      // Proceed with copy
      const result = await fileCopier.copy({
        source: options.source,
        targetType: options.targetType,
        targetApp: options.targetApp,
        pattern: options.pattern,
        recursive: options.recursive,
        overwrite: options.overwrite,
      });

      if (!result.success) {
        this.error(`Copy operation failed: ${result.errors.map(e => e.message).join(', ')}`);
      }

      if (!options.silent) {
        this.log(
          colors.formatSuccess(`Successfully copied ${result.copiedFiles.length} files to: ${result.targetPath}`),
        );
        if (result.failedFiles.length > 0) {
          this.warn(colors.formatWarning(`Failed to copy ${result.failedFiles.length} files`));
          result.failedFiles.forEach(file => {
            this.warn(colors.warning(`  - ${file}`));
          });
        }
      }
    } catch (error) {
      this.handleError(error, options.silent);
    }
  }

  private async confirm(message: string): Promise<boolean> {
    interface ConfirmResponse {
      confirmed: boolean;
    }
    const response = await this.prompt<ConfirmResponse>({
      type: 'confirm',
      name: 'confirmed',
      message,
      default: false,
    });
    return response.confirmed;
  }

  private displayTableOutput(files: Array<{ sourcePath: string; targetPath: string; size: number }>): void {
    // Table format output using custom table formatter
    this.log(colors.bold('\nFiles to be copied:'));

    // Define column widths
    const colWidths = [4, 45, 45, 15];
    const totalWidth = colWidths.reduce((sum, width) => sum + width, 0) + colWidths.length + 1;

    // Create separator line
    const separator = colors.dim('─'.repeat(totalWidth));

    // Create header row
    const headerCells = [
      colors.bold('#'),
      colors.bold('Source'),
      colors.bold('Target'),
      colors.bold('Size'),
    ];

    // Print table header
    this.log(separator);
    this.log(this.formatTableRow(headerCells, colWidths));
    this.log(separator);

    // Create rows
    files.forEach((file, index) => {
      const row = this.formatTableRow([
        colors.progress(String(index + 1)),
        file.sourcePath,
        file.targetPath,
        this.formatFileSize(file.size),
      ], colWidths);

      this.log(row);
    });

    this.log(separator);
  }

  private displayDetailedOutput(analysis: { files: Array<{ sourcePath: string; targetPath: string; size: number }> }): void {
    this.log(colors.bold('\nFiles to be copied:'));
    analysis.files.forEach((file, index) => {
      this.log(colors.bold(`\nFile #${index + 1}:`));
      this.log(`  Source: ${file.sourcePath}`);
      this.log(`  Target: ${file.targetPath}`);
      this.log(`  Size: ${this.formatFileSize(file.size)}`);
    });
  }

  private formatTableRow(cells: string[], colWidths: number[]): string {
    let row = '│';
    cells.forEach((cell, index) => {
      const width = colWidths[index];
      const padding = Math.max(0, width - this.stripAnsi(cell).length);
      row += ` ${cell}${' '.repeat(padding)} │`;
    });
    return row;
  }

  private stripAnsi(str: string): string {
    return str.replace(/\u001b\[\d+m/g, '');
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}
