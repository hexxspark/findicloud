import * as locateModule from '../../locate';
import {LocateCommand} from '../../commands/locate';
import {PathInfo, PathType} from '../../types';
import stripAnsi from 'strip-ansi';

// Mock findDrivePaths function
jest.mock('../../locate');
const mockFindDrivePaths = jest.fn().mockResolvedValue([]);
(locateModule.findDrivePaths as jest.Mock) = mockFindDrivePaths;

describe('LocateCommand', () => {
  let command: LocateCommand;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;
  let mockExit: jest.SpyInstance;

  beforeEach(() => {
    command = new LocateCommand();
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Command Execution', () => {
    it('should locate root paths by default when no arguments provided', async () => {
      await command.execute([]);
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PathType.ROOT
        })
      );
    });

    it('should locate all paths when "all" type is specified', async () => {
      await command.execute(['all']);
      // When 'all' is specified, type should not be set
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.not.objectContaining({
          type: expect.anything()
        })
      );
    });

    it('should locate app paths with name filter', async () => {
      await command.execute(['app', 'TestApp']);
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PathType.APP,
          appName: 'TestApp'
        })
      );
    });

    it('should locate photo paths', async () => {
      await command.execute(['photos']);
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PathType.PHOTOS
        })
      );
    });

    it('should locate document paths', async () => {
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
      
      // Get actual call arguments and strip color codes
      const actualErrorOutput = mockConsoleError.mock.calls[0][0];
      expect(stripAnsi(actualErrorOutput)).toBe('Error: Test error');
      
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should output simple paths by default', async () => {
      const mockPaths = [
        {
          path: '/test/path',
          type: PathType.ROOT,
          score: 100,
          exists: true,
          isAccessible: true,
          metadata: {}
        } as PathInfo
      ];
      mockFindDrivePaths.mockResolvedValueOnce(mockPaths);
      
      await command.execute([]);
      // In simple mode, only the path should be output
      expect(mockConsoleLog).toHaveBeenCalledWith('/test/path');
    });

    it('should output detailed information when detailed flag is used', async () => {
      const mockPaths = [
        {
          path: '/test/path',
          type: PathType.APP,
          score: 100,
          exists: true,
          isAccessible: true,
          metadata: {
            appName: 'Test App',
            bundleId: 'com.test.app'
          }
        } as PathInfo
      ];
      mockFindDrivePaths.mockResolvedValueOnce(mockPaths);
      
      await command.execute(['--detailed']);
      
      // Check that detailed information is included
      const calls = mockConsoleLog.mock.calls.map(call => stripAnsi(call[0]));
      const detailedOutput = calls.join('\n');
      
      expect(detailedOutput).toContain('Path:');
      expect(detailedOutput).toContain('/test/path');
      expect(detailedOutput).toContain('Application:');
      expect(detailedOutput).toContain('Test App');
      expect(detailedOutput).toContain('Bundle ID:');
      expect(detailedOutput).toContain('com.test.app');
    });

    it('should output table format when table flag is used', async () => {
      const mockPaths = [
        {
          path: '/test/path',
          type: PathType.APP,
          score: 100,
          exists: true,
          isAccessible: true,
          metadata: {
            appName: 'Test App',
            bundleId: 'com.test.app'
          }
        } as PathInfo
      ];
      mockFindDrivePaths.mockResolvedValueOnce(mockPaths);
      
      await command.execute(['--table']);
      
      // Check that table format is used
      const calls = mockConsoleLog.mock.calls.map(call => stripAnsi(call[0]));
      const tableOutput = calls.join('\n');
      
      expect(tableOutput).toContain('│');
      expect(tableOutput).toContain('Status');
      expect(tableOutput).toContain('Path');
      expect(tableOutput).toContain('Type');
      expect(tableOutput).toContain('Details');
    });

    it('should output JSON format when json flag is used', async () => {
      const mockPaths = [
        {
          path: '/test/path',
          type: PathType.APP,
          score: 100,
          exists: true,
          isAccessible: true,
          metadata: {
            appName: 'Test App',
            bundleId: 'com.test.app'
          }
        } as PathInfo
      ];
      mockFindDrivePaths.mockResolvedValueOnce(mockPaths);
      
      await command.execute(['--json']);
      
      // Check that JSON format is used
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const jsonOutput = mockConsoleLog.mock.calls[0][0];
      const parsedJson = JSON.parse(jsonOutput);
      
      expect(parsedJson).toHaveProperty('status', 'success');
      expect(parsedJson).toHaveProperty('paths');
      expect(parsedJson.paths).toHaveLength(1);
      expect(parsedJson.paths[0].path).toBe('/test/path');
    });

    it('should handle table formatting with long text correctly', async () => {
      const mockPaths = [
        {
          path: '/very/long/path/that/should/be/truncated/in/table/format/to/ensure/proper/alignment',
          type: PathType.APP,
          score: 100,
          exists: true,
          isAccessible: true,
          metadata: {
            appName: 'Very Long App Name That Should Be Truncated',
            bundleId: 'com.very.long.bundle.id.that.should.be.truncated'
          }
        } as PathInfo
      ];
      mockFindDrivePaths.mockResolvedValueOnce(mockPaths);
      
      await command.execute(['--table']);
      
      // Just verify that it doesn't throw an error
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Helper Methods', () => {
    it('should strip ANSI color codes correctly', () => {
      const coloredText = '\u001b[31mRed Text\u001b[0m';
      // @ts-ignore - Accessing private method for testing
      const result = command.stripAnsi(coloredText);
      expect(result).toBe('Red Text');
    });

    it('should calculate string width correctly', () => {
      // @ts-ignore - Accessing private method for testing
      expect(command.getStringWidth('abc')).toBe(3);
      // @ts-ignore - Accessing private method for testing
      expect(command.getStringWidth('你好')).toBe(4); // Each CJK character is width 2
    });
  });
}); 