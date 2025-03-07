import {CLI, parseGlobalOptions} from '../cli';
import {LocateCommand} from '../commands/locate';
import stripAnsi from 'strip-ansi';

// Mock LocateCommand
jest.mock('../commands/locate', () => {
  return {
    LocateCommand: jest.fn().mockImplementation(() => ({
      name: 'locate',
      aliases: ['loc'],
      execute: jest.fn().mockResolvedValue(undefined),
      getHelp: jest.fn().mockReturnValue('Locate command help')
    }))
  };
});

// Mock CopyCommand
jest.mock('../commands/copy', () => {
  return {
    CopyCommand: jest.fn().mockImplementation(() => ({
      name: 'copy',
      aliases: ['cp'],
      execute: jest.fn().mockResolvedValue(undefined),
      getHelp: jest.fn().mockReturnValue('Copy command help')
    }))
  };
});

describe('CLI', () => {
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;
  let mockExit: jest.SpyInstance;
  let cli: CLI;
  let mockLocateCommand: jest.Mock;

  beforeEach(() => {
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockLocateCommand = LocateCommand as jest.Mock;
    cli = new CLI();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Parse Global Options', () => {
    it('should parse help option', () => {
      const options = parseGlobalOptions(['--help']);
      expect(options.showHelp).toBeTruthy();
    });

    it('should parse json output option', () => {
      const options = parseGlobalOptions(['--json']);
      expect(options.jsonOutput).toBeTruthy();
    });

    it('should parse no-color option', () => {
      const options = parseGlobalOptions(['--no-color']);
      expect(options.noColor).toBeTruthy();
    });

    it('should parse silent option', () => {
      const options = parseGlobalOptions(['--silent']);
      expect(options.silent).toBeTruthy();
    });

    it('should handle multiple options', () => {
      const options = parseGlobalOptions(['--json', '--silent']);
      expect(options.jsonOutput).toBeTruthy();
      expect(options.silent).toBeTruthy();
    });
  });
 
  describe('Command Execution', () => {
    it('should show help text when --help is provided', async () => {
      await cli.run(['--help']);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });

    it('should show command help when command --help is provided', async () => {
      await cli.run(['locate', '--help']);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.any(String));

      const actualOutput = mockConsoleLog.mock.calls[0][0];
      expect(stripAnsi(actualOutput)).toContain('locate [type] [app-name]  Locate iCloud Drive paths');
    });

    it('should execute locate command by default', async () => {
      await cli.run([]); 
      const mockInstance = mockLocateCommand.mock.results[0].value;
      expect(mockInstance.execute).toHaveBeenCalled();
    });

    it('should execute locate command with alias', async () => {
      await cli.run(['loc']);
      const mockInstance = mockLocateCommand.mock.results[0].value;
      expect(mockInstance.execute).toHaveBeenCalled();
    });

    it('should handle unknown command', async () => {
      await cli.run(['unknown']);
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Unknown command: unknown'));
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should pass remaining args to command', async () => {
      await cli.run(['locate', 'app', 'TestApp']);
      const mockInstance = mockLocateCommand.mock.results[0].value;
      expect(mockInstance.execute).toHaveBeenCalledWith(['app', 'TestApp']);
    });

    it('should handle command execution errors', async () => {
      const mockError = new Error('Command failed');
      const mockInstance = mockLocateCommand.mock.results[0].value;
      mockInstance.execute.mockRejectedValueOnce(mockError);

      await cli.run(['locate']);
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Command failed'));
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
