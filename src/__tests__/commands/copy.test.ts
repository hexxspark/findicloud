import {CopyCommand} from '../../commands/copy';
import {FileCopier} from '../../copy';
import {CommandOptions, PathType} from '../../types';

// Mock dependencies
jest.mock('../../copy');

describe('CopyCommand', () => {
  let copyCommand: CopyCommand;
  let mockFileCopier: jest.Mocked<FileCopier>;

  beforeEach(() => {
    jest.clearAllMocks();
    copyCommand = new CopyCommand();
    mockFileCopier = new FileCopier() as jest.Mocked<FileCopier>;
    (FileCopier as jest.Mock).mockImplementation(() => mockFileCopier);
  });

  describe('execute', () => {
    const mockOptions: CommandOptions = {
      source: '/test/source',
      targetType: 'documents' as PathType,
      targetApp: undefined,
      pattern: undefined,
      recursive: false,
      overwrite: false,
      dryRun: false,
      silent: false,
      showHelp: false,
      jsonOutput: false,
      noColor: false,
      types: [],
    };

    it('should successfully copy files', async () => {
      const mockResult = {
        success: true,
        copiedFiles: ['/test/source/file1.txt', '/test/source/file2.txt'],
        failedFiles: [],
        targetPath: '/test/target',
        errors: [],
      };

      mockFileCopier.copy.mockResolvedValue(mockResult);

      await copyCommand.execute(mockOptions);

      expect(mockFileCopier.copy).toHaveBeenCalledWith({
        source: mockOptions.source,
        targetType: mockOptions.targetType,
        targetApp: mockOptions.targetApp,
        pattern: mockOptions.pattern,
        recursive: mockOptions.recursive,
        overwrite: mockOptions.overwrite,
        dryRun: mockOptions.dryRun,
      });
    });

    it('should throw error when source path is not provided', async () => {
      const invalidOptions = {...mockOptions, source: undefined};

      await expect(copyCommand.execute(invalidOptions)).rejects.toThrow('Source path is required');
    });

    it('should throw error when target type is not provided', async () => {
      const invalidOptions = {...mockOptions, targetType: undefined};

      await expect(copyCommand.execute(invalidOptions)).rejects.toThrow('Target type is required');
    });

    it('should handle copy operation failure', async () => {
      const mockResult = {
        success: false,
        copiedFiles: [],
        failedFiles: ['/test/source/file1.txt'],
        targetPath: '/test/target',
        errors: [new Error('Permission denied')],
      };

      mockFileCopier.copy.mockResolvedValue(mockResult);

      await expect(copyCommand.execute(mockOptions)).rejects.toThrow('Copy operation failed: Permission denied');
    });

    it('should handle dry run mode', async () => {
      const dryRunOptions = {...mockOptions, dryRun: true};
      const mockResult = {
        success: true,
        copiedFiles: ['/test/source/file1.txt'],
        failedFiles: [],
        targetPath: '/test/target',
        errors: [],
      };

      mockFileCopier.copy.mockResolvedValue(mockResult);

      await copyCommand.execute(dryRunOptions);

      expect(mockFileCopier.copy).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRun: true,
        }),
      );
    });

    it('should handle recursive copy', async () => {
      const recursiveOptions = {...mockOptions, recursive: true};
      const mockResult = {
        success: true,
        copiedFiles: ['/test/source/file1.txt', '/test/source/dir/file2.txt'],
        failedFiles: [],
        targetPath: '/test/target',
        errors: [],
      };

      mockFileCopier.copy.mockResolvedValue(mockResult);

      await copyCommand.execute(recursiveOptions);

      expect(mockFileCopier.copy).toHaveBeenCalledWith(
        expect.objectContaining({
          recursive: true,
        }),
      );
    });

    it('should handle file pattern matching', async () => {
      const patternOptions = {...mockOptions, pattern: '*.txt'};
      const mockResult = {
        success: true,
        copiedFiles: ['/test/source/file1.txt', '/test/source/file2.txt'],
        failedFiles: [],
        targetPath: '/test/target',
        errors: [],
      };

      mockFileCopier.copy.mockResolvedValue(mockResult);

      await copyCommand.execute(patternOptions);

      expect(mockFileCopier.copy).toHaveBeenCalledWith(
        expect.objectContaining({
          pattern: '*.txt',
        }),
      );
    });
  });

  describe('getHelp', () => {
    it('should return help text', () => {
      const helpText = copyCommand.getHelp();
      expect(helpText).toContain('Usage: icloudy copy [options] <source>');
      expect(helpText).toContain('Options:');
      expect(helpText).toContain('Examples:');
    });
  });
});
