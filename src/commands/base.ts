import {CommandOptions} from '../types';

export abstract class BaseCommand {
  abstract name: string;
  abstract description: string;
  aliases?: string[];
  abstract execute(options: CommandOptions): Promise<void>;
  abstract getHelp(): string;
}
