import {findDrivePaths} from '../list';
import {CommandOptions, PathType} from '../types';
import {colors} from '../utils/colors';
import {BaseCommand} from './base';

export class ListCommand extends BaseCommand {
  name = 'list';
  aliases = ['ls'];
  description = 'List iCloud Drive paths and files';

  async execute(options: CommandOptions): Promise<void> {
    try {
      if (!options.silent) {
        console.log(colors.info('Locating iCloud Drive paths...'));
      }

      const paths = await findDrivePaths(options);

      if (paths.length === 0) {
        if (!options.silent) {
          console.log(colors.warning('No iCloud Drive paths found.'));
        }
        process.exit(0);
      }

      if (options.jsonOutput) {
        console.log(JSON.stringify(paths, null, 2));
      } else {
        paths.forEach((path, index) => {
          console.log(colors.formatProgress(index + 1, paths.length, colors.formatPath(path, options.noColor)));
        });

        if (!options.silent) {
          console.log(colors.formatSuccess(`Found ${paths.length} paths`));
        }
      }
    } catch (error) {
      if (!options.silent) {
        console.error(colors.formatError(error instanceof Error ? error.message : String(error)));
      }
      process.exit(1);
    }
  }

  getHelp(): string {
    return `
Usage: icloudy list [options]

Options:
  -t, --type <type>           Filter by path type (root|app_storage|photos|documents|other)
  -a, --app <name>            Search for specific app (e.g., "notes", "1password")
  -m, --min-score <number>    Minimum score threshold
  -i, --include-inaccessible  Include inaccessible paths
  -j, --json                  Output in JSON format
  -n, --no-color             Disable colorized output
  -s, --silent               Suppress all output except errors
  -h, --help                 Display help information

Examples:
  icloudy list                      # List all iCloud paths
  icloudy list -t root             # Only show root paths
  icloudy list -a notes           # Show Notes app storage location
  icloudy list -t app_storage -m 10 # Show app storage paths with min score 10
    `;
  }
}
