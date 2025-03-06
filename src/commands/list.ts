import {findDrivePaths} from '../list';
import {CommandOptions, PathType} from '../types';
import {BaseCommand} from './base';

export class ListCommand extends BaseCommand {
  name = 'list';
  aliases = ['ls'];
  description = 'List iCloud Drive paths and files';

  async execute(options: CommandOptions): Promise<void> {
    try {
      if (!options.silent) {
        console.log('Locating iCloud Drive paths...');
      }

      const paths = await findDrivePaths(options);

      if (paths.length === 0) {
        if (!options.silent) {
          console.log('No iCloud Drive paths found.');
        }
        process.exit(0);
      }

      if (options.jsonOutput) {
        console.log(JSON.stringify(paths, null, 2));
      } else {
        paths.forEach(path => {
          const accessibility = path.isAccessible ? 'Accessible' : 'Not Accessible';
          const type = path.type;

          let details = '';
          if (path.type === PathType.APP_STORAGE && path.metadata.appName) {
            details = ` (${path.metadata.appName})`;
            if (path.metadata.bundleId) {
              details += ` [${path.metadata.bundleId}]`;
            }
          }

          console.log(`- ${path.path} [${type}${details}] (Score: ${path.score}, ${accessibility})`);
        });
      }
    } catch (error) {
      if (!options.silent) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  }

  getHelp(): string {
    return `
Usage: icloudy ls [options]

Options:
  -t, --type                  Filter by path type (root|app_storage|photos|documents|other)
  -a, --app                   Search for specific app (e.g., "notes", "1password")
  -m, --min-score             Minimum score threshold
  -i, --include-inaccessible  Include inaccessible paths
  -j, --json                  Output in JSON format
  -n, --no-color             Disable colorized output
  -s, --silent               Suppress all prompts
  -h, --help                 Display help information

Examples:
  icloudy ls                        # List all iCloud paths
  icloudy ls -t root               # Only show root paths
  icloudy ls -a notes             # Show Notes app storage location
  icloudy ls -t app_storage -m 10  # Show app storage paths with min score 10
    `;
  }
}
