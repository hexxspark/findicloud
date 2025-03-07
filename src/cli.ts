#!/usr/bin/env node

import {BaseCommand} from './commands/base';
import {CopyCommand} from './commands/copy';
import {ListCommand} from './commands/list';
import {PathType, SearchOptions} from './types';
import {colors, setColorEnabled} from './utils/colors';

export interface CliOptions extends SearchOptions {
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

export function parseGlobalOptions(args: string[]): Partial<CliOptions> {
  const options: Partial<CliOptions> = {
    showHelp: false,
    jsonOutput: false,
    noColor: false,
    silent: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i].toLowerCase();
    switch (arg) {
      case '--help':
      case '-h':
        options.showHelp = true;
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
    }
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
    try {
      const globalOptions = parseGlobalOptions(args);
      
      if (globalOptions.noColor) {
        setColorEnabled(false);
      }

      // 检查是否是帮助命令
      if (globalOptions.showHelp) {
        this.showHelp();
        return;
      }

      // 获取命令名称（默认为list）
      const commandName = args[0] || 'list';
      const command = this.findCommand(commandName);

      if (!command) {
        console.error(colors.formatError(`Unknown command: ${commandName}`));
        process.exit(1);
        return;
      }

      // 移除命令名称，传递剩余参数和全局选项
      const commandArgs = args.slice(1);
      
      // 如果命令参数包含帮助选项，显示命令帮助
      if (globalOptions.showHelp) {
        console.log(colors.formatHelp(command.getHelp()));
        return;
      }

      // 执行命令
      await command.execute(commandArgs);
    } catch (error) {
      console.error(colors.formatError(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  }

  private showHelp(): void {
    const helpText = `
Usage: icloudy [command] [options]

Commands:
  list [type] [app-name]  List iCloud Drive paths and files (default)
  copy [options]          Copy files to iCloud Drive

Types (for list command):
  app <name>    List specific application data
  photos        List photos library
  docs          List documents library
  root          List root directory
  all           List all paths (default)

Global Options:
  -n, --no-color   Disable colorized output
  -s, --silent     Suppress all output except errors
  -j, --json       Output in JSON format
  -h, --help       Display help information

Examples:
  icloudy list                    # List all paths
  icloudy list app Word          # List Word app data
  icloudy list photos            # List photos library
  icloudy list docs              # List documents library

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
