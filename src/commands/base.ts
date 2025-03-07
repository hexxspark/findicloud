import {CommandOptions} from '../types';

export abstract class BaseCommand {
  abstract name: string;
  abstract description: string;
  aliases?: string[];

  abstract execute(args: string[]): Promise<void>;
  abstract getHelp(): string;

  protected parseArgs(args: string[]): CommandOptions {
    throw new Error('parseArgs must be implemented by subclass');
  }
}
