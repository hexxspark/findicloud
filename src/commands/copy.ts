import {FileCopier} from '../copy';
import {CommandOptions, PathType} from '../types';
import {colors} from '../utils/colors';
import {BaseCommand} from './base';

export class CopyCommand extends BaseCommand {
  name = 'copy';
  description = 'Copy files to iCloud Drive';
  aliases = ['cp'];

  async execute(args: string[]): Promise<void> {
    const options = this.parseArgs(args);

    if (!options.source) {
      throw new Error('Source path is required');
    }

    if (!options.targetType) {
      throw new Error('Target type is required');
    }

    if (!options.silent) {
      console.log(colors.info('Starting copy operation...'));
    }

    const fileCopier = new FileCopier();
    const result = await fileCopier.copy({
      source: options.source,
      targetType: options.targetType as PathType,
      targetApp: options.targetApp,
      pattern: options.pattern,
      recursive: options.recursive,
      overwrite: options.overwrite,
      dryRun: options.dryRun,
    });

    if (!result.success) {
      throw new Error(`Copy operation failed: ${result.errors.map(e => e.message).join(', ')}`);
    }

    if (!options.silent) {
      if (options.dryRun) {
        console.log(colors.info('Dry run completed. Would copy:'));
        result.copiedFiles.forEach((file, index) => {
          console.log(colors.formatProgress(index + 1, result.copiedFiles.length, file));
        });
      } else {
        console.log(colors.formatSuccess(`Successfully copied ${result.copiedFiles.length} files to: ${result.targetPath}`));
        if (result.failedFiles.length > 0) {
          console.warn(colors.formatWarning(`Failed to copy ${result.failedFiles.length} files`));
          result.failedFiles.forEach(file => {
            console.warn(colors.warning(`  - ${file}`));
          });
        }
      }
    }
  }

  getHelp(): string {
    return `
Usage: icloudy copy [options] <source> <target>

Options:
  -t, --target-type <type>    Target path type (root|app_storage|photos|documents|other)
  -a, --target-app <name>     Target app name (required for app_storage type)
  -p, --pattern <pattern>     File pattern to match (default: *)
  -r, --recursive            Copy directories recursively
  -f, --force               Overwrite existing files
  -d, --dry-run            Show what would be copied without actually copying
  -n, --no-color           Disable colorized output
  -s, --silent             Suppress output messages
  -h, --help               Display help information

Examples:
  icloudy copy ./documents -t documents
  icloudy copy ./notes -t app_storage -a Notes
  icloudy copy ./photos/*.jpg -t photos -r
    `;
  }

  protected parseArgs(args: string[]): CommandOptions {
    const options: CommandOptions = {
      showHelp: args.includes('--help') || args.includes('-h'),
      jsonOutput: args.includes('--json') || args.includes('-j'),
      noColor: args.includes('--no-color') || args.includes('-n'),
      silent: args.includes('--silent') || args.includes('-s'),
      recursive: args.includes('--recursive') || args.includes('-r'),
      force: args.includes('--force') || args.includes('-f'),
      dryRun: args.includes('--dry-run')
    };

    // Extract source and target type
    const nonOptionArgs = args.filter(arg => !arg.startsWith('-') && 
      args[args.indexOf(arg) - 1] !== '--target-type' && 
      args[args.indexOf(arg) - 1] !== '-t');
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
