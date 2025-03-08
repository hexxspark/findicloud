import { Args, Flags } from '@oclif/core';

import { FileCopier } from '../copy';
import { CommandOptions, PathType } from '../types';
import { colors } from '../utils/colors';
import { BaseCommand } from './base';

export default class CopyCommand extends BaseCommand {
  static id = 'copy';
  static description = 'Copy files to iCloud Drive';
  static aliases = ['cp'];

  static examples = [
    '$ icloudy copy ./documents -t documents    # Copy local documents to iCloud Drive documents library',
    '$ icloudy copy ./notes -t app -a Notes    # Copy local notes to Notes app iCloud storage',
    '$ icloudy copy ./photos/*.jpg -t photos -r # Recursively copy all jpg photos to iCloud photos library',
  ];

  static flags = {
    ...BaseCommand.flags,
    'target-type': Flags.string({
      char: 't',
      description: 'Target path type (root|app|photos|docs|other)',
      required: true,
    }),
    'target-app': Flags.string({
      char: 'a',
      description: 'Target app name (required for app type)',
      dependsOn: ['target-type'],
    }),
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
  };

  static args = {
    source: Args.string({
      description: 'Source path to copy from',
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(CopyCommand);
    const options = this.getCommandOptions(flags);

    try {
      // Set source path
      options.source = args.source;

      // Convert target type
      const type = flags['target-type'].toUpperCase();
      if (type in PathType) {
        options.targetType = PathType[type as keyof typeof PathType];
      } else {
        this.error('Invalid target type');
      }

      // Set additional options
      options.targetApp = flags['target-app'];
      options.pattern = flags.pattern;
      options.recursive = flags.recursive || false;
      options.overwrite = flags.force || false;
      options.dryRun = flags['dry-run'] || false;

      if (!options.silent) {
        this.log(colors.info('Starting copy operation...'));
      }

      const fileCopier = new FileCopier();
      const result = await fileCopier.copy({
        source: options.source,
        targetType: options.targetType,
        targetApp: options.targetApp,
        pattern: options.pattern,
        recursive: options.recursive,
        overwrite: options.overwrite,
        dryRun: options.dryRun,
      });

      if (!result.success) {
        this.error(`Copy operation failed: ${result.errors.map(e => e.message).join(', ')}`);
      }

      if (!options.silent) {
        if (options.dryRun) {
          this.log(colors.info('Dry run completed. Would copy:'));
          result.copiedFiles.forEach((file, index) => {
            this.log(colors.formatProgress(index + 1, result.copiedFiles.length, file));
          });
        } else {
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
      }
    } catch (error) {
      this.handleError(error, options.silent);
    }
  }

  async getHelp(): Promise<string> {
    return `Usage: icloudy copy [options] <source>

Copy files to iCloud Drive.

Options:
  --target-type <type>    Target type (documents, app)
  --target-app <app>      Target app name (required when target-type is app)
  --dry-run              Show what would be copied without actually copying
  --recursive            Copy directories recursively
  --pattern <pattern>    File pattern to match (e.g. *.txt)
  --force               Overwrite existing files
  -h, --help           Show this help

Examples:
  $ icloudy copy ./myfile.txt --target-type documents
  $ icloudy copy ./myapp/ --target-type app --target-app MyApp
  $ icloudy copy ./docs/ --target-type documents --recursive
  $ icloudy copy ./ --target-type documents --pattern "*.txt"`;
  }

  protected parseArgs(args: string[]): CommandOptions {
    const options: CommandOptions = {
      showHelp: args.includes('--help') || args.includes('-h'),
      jsonOutput: args.includes('--json') || args.includes('-j'),
      noColor: args.includes('--no-color') || args.includes('-n'),
      silent: args.includes('--silent') || args.includes('-s'),
      recursive: args.includes('--recursive') || args.includes('-r'),
      force: args.includes('--force') || args.includes('-f'),
      dryRun: args.includes('--dry-run'),
    };

    // Extract source and target type
    const nonOptionArgs = args.filter(
      arg =>
        !arg.startsWith('-') && args[args.indexOf(arg) - 1] !== '--target-type' && args[args.indexOf(arg) - 1] !== '-t',
    );
    if (nonOptionArgs.length > 0) {
      options.source = nonOptionArgs[0];
    }

    // Find target type
    const typeIndex = args.indexOf('--target-type');
    if (typeIndex !== -1 && typeIndex + 1 < args.length) {
      const type = args[typeIndex + 1].toLowerCase();
      switch (type) {
        case 'documents':
          options.targetType = PathType.DOCS;
          break;
        case 'photos':
          options.targetType = PathType.PHOTOS;
          break;
        case 'app':
          options.targetType = PathType.APP;
          break;
        case 'root':
          options.targetType = PathType.ROOT;
          break;
        default:
          options.targetType = PathType.OTHER;
      }
    }

    // Find pattern
    const patternIndex = args.indexOf('--pattern') !== -1 ? args.indexOf('--pattern') : args.indexOf('-p');
    if (patternIndex !== -1 && patternIndex + 1 < args.length) {
      options.pattern = args[patternIndex + 1];
    }

    return options;
  }
}
