#!/usr/bin/env node
import {findICloudDrivePaths} from './finder';
import {PathType, SearchOptions} from './types';

interface CliOptions extends SearchOptions {
  showHelp: boolean;
  jsonOutput: boolean;
  noColor: boolean;
  silent: boolean;
}

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    showHelp: false,
    jsonOutput: false,
    noColor: false,
    silent: false,
    types: [],
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case '--type':
      case '-t':
        const type = args[++i]?.toUpperCase();
        if (type && type in PathType) {
          options.types!.push(PathType[type as keyof typeof PathType]);
        }
        break;
      case '--app':
      case '-a':
        options.appNamePattern = args[++i];
        if (!options.types?.length) {
          options.types = [PathType.APP_STORAGE];
        }
        break;
      case '--min-score':
      case '-m':
        const score = parseInt(args[++i]);
        if (!isNaN(score)) {
          options.minScore = score;
        }
        break;
      case '--include-inaccessible':
      case '-i':
        options.includeInaccessible = true;
        break;
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
    }
    i++;
  }

  if (!options.types?.length) {
    options.types = Object.values(PathType);
  }

  return options;
}

export async function run(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);
  try {
    if (options.showHelp) {
      console.log(`
Usage: icloudy [command] [options]

Commands:
  path [options]    Show local iCloud Drive paths (default command)
  
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
  icloudy path                        # List all iCloud paths
  icloudy path -t root               # Only show root paths
  icloudy path -a notes             # Show Notes app storage location
  icloudy path -t app_storage -m 10  # Show app storage paths with min score 10
`);
      process.exit(0);
    }

    if (!options.silent) {
      console.log('Locating iCloud Drive paths...');
    }

    const paths = await findICloudDrivePaths(options);

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

// Only run if called directly
if (require.main === module) {
  run().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
