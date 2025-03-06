import {FileCopier} from '../copy';
import {CommandOptions, PathType} from '../types';
import {colors} from '../utils/colors';
import {BaseCommand} from './base';

export class CopyCommand extends BaseCommand {
  name = 'copy';
  aliases = ['cp'];
  description = 'Copy files to iCloud Drive';

  async execute(options: CommandOptions): Promise<void> {
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
Usage: icloudy copy [options] <source>

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
}
