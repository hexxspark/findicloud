import * as listModule from '../../list';
import {ListCommand} from '../../commands/list';
import {PathType} from '../../types';
import stripAnsi from 'strip-ansi';

// Mock findDrivePaths function
jest.mock('../../list');
const mockFindDrivePaths = jest.fn().mockResolvedValue([]);
(listModule.findDrivePaths as jest.Mock) = mockFindDrivePaths;

describe('ListCommand', () => {
  let command: ListCommand;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;
  let mockExit: jest.SpyInstance;

  beforeEach(() => {
    command = new ListCommand();
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Command Execution', () => {
    it('should list all paths when no arguments provided', async () => {
      await command.execute([]);
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should list app paths with name filter', async () => {
      await command.execute(['app', 'TestApp']);
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PathType.APP,
          appName: 'TestApp'
        })
      );
    });

    it('should list photo paths', async () => {
      await command.execute(['photos']);
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PathType.PHOTOS
        })
      );
    });

    it('should list document paths', async () => {
      await command.execute(['docs']);
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PathType.DOCS
        })
      );
    });

    it('should handle minimum score option', async () => {
      await command.execute(['--min-score', '50']);
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.objectContaining({
          minScore: 50
        })
      );
    });

    it('should handle inaccessible paths option', async () => {
      await command.execute(['--include-inaccessible']);
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.objectContaining({
          includeInaccessible: true
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Test error');
      mockFindDrivePaths.mockRejectedValueOnce(mockError);
      
      await command.execute([]);
      expect(mockConsoleError).toHaveBeenCalledWith(expect.any(String));
      
      // 获取实际调用的参数并去除颜色代码
      const actualErrorOutput = mockConsoleError.mock.calls[0][0];
      expect(stripAnsi(actualErrorOutput)).toBe('Error: Test error');
      
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should format output correctly', async () => {
      const mockPaths = [
        {
          path: '/test/path',
          type: PathType.APP,
          score: 100,
          isAccessible: true,
          metadata: {
            appName: 'Test App'
          }
        }
      ];
      mockFindDrivePaths.mockResolvedValueOnce(mockPaths);
      
      await command.execute([]);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Test App'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/test/path'));
    });
  });
}); 