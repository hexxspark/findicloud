import {FileCopier} from '../copy';
import {CommandOptions, PathType} from '../types';
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
      console.log(`Successfully copied ${result.copiedFiles.length} files to: ${result.targetPath}`);
      if (result.failedFiles.length > 0) {
        console.warn(`Failed to copy ${result.failedFiles.length} files`);
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
  -s, --silent             Suppress output messages

Examples:
  icloudy copy ./documents -t documents
  icloudy copy ./notes -t app_storage -a Notes
  icloudy copy ./photos/*.jpg -t photos -r
    `;
  }
}
