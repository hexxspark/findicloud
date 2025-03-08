import {Command, Flags} from '@oclif/core';

import {CommandOptions} from '../types';

export abstract class BaseCommand extends Command {
  static id = 'base';
  static description = 'Base command';
  static aliases: string[] = [];

  static flags = {
    help: Flags.help({char: 'h'}),
    json: Flags.boolean({char: 'j', description: 'Output in JSON format'}),
    'no-color': Flags.boolean({char: 'n', description: 'Disable colorized output'}),
    silent: Flags.boolean({char: 's', description: 'Suppress all output except errors'}),
  };

  async getHelp(): Promise<string> {
    const cmdId = (this.constructor as typeof BaseCommand).id;
    const help = await this.config.runCommand(cmdId, ['--help']);
    return String(help);
  }

  protected getCommandOptions(flags: any): CommandOptions {
    return {
      showHelp: flags.help || false,
      jsonOutput: flags.json || false,
      noColor: flags['no-color'] || false,
      silent: flags.silent || false,
    };
  }

  protected handleError(error: unknown, silent = false): never {
    if (!silent) {
      this.error(error instanceof Error ? error.message : String(error));
    }
    this.exit(1);
  }
}
