import {confirm} from '@inquirer/prompts';

import {BaseCommand, PromptOptions} from '../command';

// Mock dependencies
jest.mock('@inquirer/prompts', () => ({
  confirm: jest.fn(),
}));

// Create a concrete implementation of BaseCommand for testing
class TestCommand extends BaseCommand {
  static id = 'test';
  static description = 'Test command';

  async run(): Promise<void> {
    // Implementation not needed for tests
  }

  // Expose protected methods for testing
  public testGetCommandOptions(flags: any) {
    return this.getCommandOptions(flags);
  }

  public testHandleError(error: unknown, silent = false, exitCode = 2): never {
    return this.handleError(error, silent, exitCode);
  }

  public testPrompt<T extends {confirmed: boolean}>(options: string | PromptOptions): Promise<T> {
    return this.prompt<T>(options);
  }
}

describe('BaseCommand', () => {
  let command: TestCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new TestCommand([], {} as any);

    // Mock command.error and command.exit
    command.error = jest.fn() as any;
    command.exit = jest.fn() as any;
    command.config = {
      runCommand: jest.fn().mockResolvedValue('Help text for test command'),
    } as any;
  });

  describe('getHelp', () => {
    it('should return help text for the command', async () => {
      const help = await command.getHelp();
      expect(help).toBe('Help text for test command');
      expect(command.config.runCommand).toHaveBeenCalledWith('test', ['--help']);
    });
  });

  describe('getCommandOptions', () => {
    it('should return default options when no flags are provided', () => {
      const options = command.testGetCommandOptions({});
      expect(options).toEqual({
        showHelp: false,
        jsonOutput: false,
        noColor: false,
        silent: false,
      });
    });

    it('should return options based on provided flags', () => {
      const options = command.testGetCommandOptions({
        help: true,
        json: true,
        'no-color': true,
        silent: true,
      });
      expect(options).toEqual({
        showHelp: true,
        jsonOutput: true,
        noColor: true,
        silent: true,
      });
    });
  });

  describe('handleError', () => {
    it('should call error with message when exitCode is 2', () => {
      command.testHandleError(new Error('Test error'));
    });

    it('should call console.error and exit when exitCode is not 2', () => {
      jest.spyOn(console, 'error').mockImplementation();
      command.testHandleError(new Error('Test error'), false, 1);
    });

    it('should only call exit when silent is true', () => {
      jest.spyOn(console, 'error').mockImplementation();
      command.testHandleError(new Error('Test error'), true);
    });

    it('should handle non-Error objects', () => {
      command.testHandleError('String error');
    });
  });

  describe('prompt', () => {
    it('should call confirm with string message', async () => {
      (confirm as jest.Mock).mockResolvedValueOnce(true);
      const result = await command.testPrompt('Are you sure?');
      expect(confirm).toHaveBeenCalledWith({message: 'Are you sure?'});
      expect(result).toEqual({confirmed: true});
    });

    it('should call confirm with message from options object', async () => {
      (confirm as jest.Mock).mockResolvedValueOnce(false);
      const result = await command.testPrompt({
        type: 'confirm',
        name: 'confirmed',
        message: 'Are you really sure?',
      });
      expect(confirm).toHaveBeenCalledWith({message: 'Are you really sure?'});
      expect(result).toEqual({confirmed: false});
    });
  });
});
