import {CLI, parseArgs} from '../cli';
import {findDrivePaths} from '../list';
import {PathInfo, PathType} from '../types';

jest.mock('../list', () => ({
  findDrivePaths: jest.fn(),
}));

const mockFindPaths = findDrivePaths as jest.MockedFunction<typeof findDrivePaths>;

describe('CLI', () => {
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;
  let mockExit: jest.SpyInstance;
  let cli: CLI;

  const mockAppPath: PathInfo = {
    path: '/test/app/path',
    type: PathType.APP_STORAGE,
    score: 100,
    exists: true,
    isAccessible: true,
    metadata: {
      appName: 'Test App',
      bundleId: 'com.test.app',
    },
  };

  beforeEach(() => {
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    cli = new CLI();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Parse Arguments', () => {
    it('should parse help option', () => {
      const options = parseArgs(['--help']);
      expect(options.showHelp).toBeTruthy();
    });

    it('should parse type filtering', () => {
      const options = parseArgs(['--type', 'APP_STORAGE']);
      expect(options.types).toContain(PathType.APP_STORAGE);
    });

    it('should parse app name search', () => {
      const options = parseArgs(['--app', 'test']);
      expect(options.appNamePattern).toBe('test');
      expect(options.types).toContain(PathType.APP_STORAGE);
    });
  });

  describe('Main Execution', () => {
    it('should show help text', async () => {
      await cli.run(['--help']);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle no paths found', async () => {
      mockFindPaths.mockResolvedValueOnce([]);
      await cli.run(['ls']);
      expect(mockConsoleLog).toHaveBeenCalledWith('No iCloud Drive paths found.');
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should format app storage paths', async () => {
      mockFindPaths.mockResolvedValueOnce([mockAppPath]);
      await cli.run(['ls']);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining(mockAppPath.metadata.appName!));
    });

    it('should handle errors', async () => {
      mockFindPaths.mockRejectedValueOnce(new Error('Test error'));
      await cli.run(['ls']);
      expect(mockConsoleError).toHaveBeenCalledWith('Error:', 'Test error');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should respect silent mode', async () => {
      mockFindPaths.mockResolvedValueOnce([]);
      await cli.run(['ls', '--silent']);
      expect(mockConsoleLog).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle unknown command', async () => {
      await cli.run(['unknown']);
      expect(mockConsoleError).toHaveBeenCalledWith('Unknown command: unknown');
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
