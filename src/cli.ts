#!/usr/bin/env node

import {BaseCommand} from './commands/base';
import {CopyCommand} from './commands/copy';
import {ListCommand} from './commands/list';
import {PathType, SearchOptions} from './types';

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
  private aliases: Map<string, string> = new Map();

  constructor() {
    // 注册命令
    this.registerCommand(new ListCommand());
    this.registerCommand(new CopyCommand());
  }

  registerCommand(command: BaseCommand) {
    this.commands.set(command.name, command);
    // 注册别名
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }
  }

  private findCommand(name: string): BaseCommand | undefined {
    // 直接匹配命令名
    let command = this.commands.get(name);
    if (!command) {
      // 尝试通过别名查找
      const mainCommandName = this.aliases.get(name);
      if (mainCommandName) {
        command = this.commands.get(mainCommandName);
      }
    }
    return command;
  }

  async run(args: string[] = process.argv.slice(2)): Promise<void> {
    let options: CliOptions | undefined;
    try {
      // 检查第一个参数是否为 --help
      if (args[0] === '--help') {
        this.showHelp();
        process.exit(0);
        return;
      }

      const commandName = args[0] || 'list'; // 默认使用 list 命令
      const command = this.findCommand(commandName);

      if (!command) {
        console.error(`Unknown command: ${commandName}`);
        process.exit(1);
        return;
      }

      options = parseArgs(args.slice(1));
      if (options.showHelp) {
        console.log(command.getHelp());
        process.exit(0);
        return;
      }

      await command.execute(options);
    } catch (error) {
      if (!options?.silent) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  }

  private showHelp(): void {
    console.log(`
Usage: icloudy [command] [options]

Commands:
  ls [options]     List iCloud Drive paths and files (default command)
  cp [options]     Copy files to iCloud Drive

Use 'icloudy <command> --help' for more information about a command.
    `);
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
