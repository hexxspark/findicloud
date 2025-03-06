#!/usr/bin/env node

import {BaseCommand} from './commands/base';
import {CopyCommand} from './commands/copy';
import {ListCommand} from './commands/list';
import {PathType, SearchOptions} from './types';
import {colors, setColorEnabled} from './utils/colors';

interface CliOptions extends SearchOptions {
  showHelp: boolean;
  jsonOutput: boolean;
  noColor: boolean;
  silent: boolean;
  source?: string;
  targetType?: PathType;
  targetApp?: string;
  pattern?: string;
  recursive?: boolean;
  overwrite?: boolean;
  dryRun?: boolean;
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
      case '--source':
        options.source = args[++i];
        break;
      case '--target-type':
        options.targetType = args[++i] as PathType;
        break;
      case '--target-app':
        options.targetApp = args[++i];
        break;
      case '--pattern':
        options.pattern = args[++i];
        break;
      case '--recursive':
      case '-r':
        options.recursive = true;
        break;
      case '--force':
      case '-f':
        options.overwrite = true;
        break;
      case '--dry-run':
      case '-d':
        options.dryRun = true;
        break;
    }
    i++;
  }

  if (!options.types?.length) {
    options.types = Object.values(PathType);
  }

  return options;
}

export class CLI {
  private commands: Map<string, BaseCommand> = new Map();

  constructor() {
    this.registerCommand(new ListCommand());
    this.registerCommand(new CopyCommand());
  }

  private registerCommand(command: BaseCommand) {
    this.commands.set(command.name, command);
    if (command.aliases) {
      command.aliases.forEach(alias => this.commands.set(alias, command));
    }
  }

  private findCommand(name: string): BaseCommand | undefined {
    return this.commands.get(name);
  }

  async run(args: string[] = process.argv.slice(2)): Promise<void> {
    let options: CliOptions | undefined;
    try {
      // Parse options first to handle color settings early
      options = parseArgs(args.slice(1));
      
      // Set color mode based on options
      setColorEnabled(!options.noColor);

      // Check if first argument is --help
      if (args[0] === '--help') {
        this.showHelp();
        process.exit(0);
        return;
      }

      const commandName = args[0] || 'list'; // Default to list command
      const command = this.findCommand(commandName);

      if (!command) {
        console.error(colors.formatError(`Unknown command: ${commandName}`));
        process.exit(1);
        return;
      }

      if (options.showHelp) {
        console.log(colors.formatHelp(command.getHelp()));
        process.exit(0);
        return;
      }

      await command.execute(options);
    } catch (error) {
      if (!options?.silent) {
        console.error(colors.formatError(error instanceof Error ? error.message : String(error)));
      }
      process.exit(1);
    }
  }

  private showHelp(): void {
    const helpText = `
Usage: icloudy [command] [options]

Commands:
  list [options]    List iCloud Drive paths and files (default command)
  copy [options]    Copy files to iCloud Drive

Global Options:
  -n, --no-color   Disable colorized output
  -s, --silent     Suppress all output except errors
  -j, --json       Output in JSON format
  -h, --help       Display help information

Use 'icloudy <command> --help' for more information about a command.
    `;
    console.log(colors.formatHelp(helpText));
  }
}

// Only run if called directly
if (require.main === module) {
  const cli = new CLI();
  cli.run().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
