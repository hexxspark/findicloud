import {findDrivePaths} from '../list';
import {CommandOptions, PathType} from '../types';
import {colors} from '../utils/colors';
import {BaseCommand} from './base';

export class ListCommand extends BaseCommand {
  name = 'list';
  aliases = ['ls'];
  description = 'List iCloud Drive paths';

  async execute(args: string[]): Promise<void> {
    // Analyze parameters
    const options = this.parseArgs(args);
    
    try {
      if (!options.silent) {
        console.log(colors.info('Locating iCloud Drive paths...'));
      }

      const paths = await findDrivePaths(options);

      if (paths.length === 0) {
        if (!options.silent) {
          console.log(colors.warning('No iCloud Drive paths found.'));
        }
        return;
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

  protected parseArgs(args: string[]): CommandOptions {
    const options: CommandOptions = {
      showHelp: false,
      jsonOutput: false,
      noColor: false,
      silent: false,
      includeInaccessible: false,
      minScore: 0
    };

    // Handle main parameters (type and app name)
    if (args.length > 0) {
      const type = args[0].toUpperCase();
      if (type in PathType) {
        options.type = PathType[type as keyof typeof PathType];
        
        // If the type is app, the second parameter is app name
        if (options.type === PathType.APP && args.length > 1) {
          options.appName = args[1];
        }
      }
    }

    // Handle other options
    for (let i = 0; i < args.length; i++) {
      const arg = args[i].toLowerCase();
      switch (arg) {
        case '--json':
        case '-j':
          options.jsonOutput = true;
          break;
        case '--no-color':
        case '-n':
          options.noColor = true;
          break;
        case '--silent':
        case '-s':
          options.silent = true;
          break;
        case '--help':
        case '-h':
          options.showHelp = true;
          break;
        case '--min-score':
        case '-m':
          options.minScore = parseInt(args[++i], 10) || 0;
          break;
        case '--include-inaccessible':
        case '-i':
          options.includeInaccessible = true;
          break;
      }
    }

    return options;
  }

  getHelp(): string {
    return `
Usage: icloudy list [type] [app-name] [options]

Types:
  app <name>    List specific application data
  photos        List photos library
  docs          List documents library
  root          List root directory
  all           List all paths (default)

Options:
  -m, --min-score <n>         Minimum path score (default: 0)
  -i, --include-inaccessible  Include inaccessible paths
  -j, --json                  Output in JSON format
  -n, --no-color             Disable colorized output
  -s, --silent               Suppress all output except errors
  -h, --help                 Display help information

Examples:
  icloudy list                    # List all paths
  icloudy list app Word          # List Word app data
  icloudy list photos            # List photos library
  icloudy list docs              # List documents library
  icloudy list app "Microsoft Word"  # List Microsoft Word app data
    `;
  }
}
