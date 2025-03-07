import {CopyCommand} from '../../commands/copy';
import {FileCopier} from '../../copy';
import {PathType} from '../../types';

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
    it('should successfully copy files', async () => {
      const mockResult = {
        success: true,
        copiedFiles: ['/test/source/file1.txt', '/test/source/file2.txt'],
        failedFiles: [],
        targetPath: '/test/target',
        errors: [],
      };

      mockFileCopier.copy.mockResolvedValue(mockResult);

      await copyCommand.execute(['/test/source', '--target-type', 'documents']);

      expect(mockFileCopier.copy).toHaveBeenCalledWith(expect.objectContaining({
        source: '/test/source',
        targetType: PathType.DOCS,
      }));
    });

    it('should throw error when source path is not provided', async () => {
      await expect(copyCommand.execute(['--target-type', 'documents'])).rejects.toThrow('Source path is required');
    });

    it('should throw error when target type is not provided', async () => {
      await expect(copyCommand.execute(['/test/source'])).rejects.toThrow('Target type is required');
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

      await expect(copyCommand.execute(['/test/source', '--target-type', 'documents'])).rejects.toThrow('Copy operation failed: Permission denied');
    });

    it('should handle dry run mode', async () => {
      const mockResult = {
        success: true,
        copiedFiles: ['/test/source/file1.txt'],
        failedFiles: [],
        targetPath: '/test/target',
        errors: [],
      };

      mockFileCopier.copy.mockResolvedValue(mockResult);

      await copyCommand.execute(['/test/source', '--target-type', 'documents', '--dry-run']);

      expect(mockFileCopier.copy).toHaveBeenCalledWith(expect.objectContaining({
        dryRun: true,
      }));
    });

    it('should handle recursive copy', async () => {
      const mockResult = {
        success: true,
        copiedFiles: ['/test/source/file1.txt', '/test/source/dir/file2.txt'],
        failedFiles: [],
        targetPath: '/test/target',
        errors: [],
      };

      mockFileCopier.copy.mockResolvedValue(mockResult);

      await copyCommand.execute(['/test/source', '--target-type', 'documents', '--recursive']);

      expect(mockFileCopier.copy).toHaveBeenCalledWith(expect.objectContaining({
        recursive: true,
      }));
    });

    it('should handle file pattern matching', async () => {
      const mockResult = {
        success: true,
        copiedFiles: ['/test/source/file1.txt', '/test/source/file2.txt'],
        failedFiles: [],
        targetPath: '/test/target',
        errors: [],
      };

      mockFileCopier.copy.mockResolvedValue(mockResult);

      await copyCommand.execute(['/test/source', '--target-type', 'documents', '--pattern', '*.txt']);

      expect(mockFileCopier.copy).toHaveBeenCalledWith(expect.objectContaining({
        pattern: '*.txt',
      }));
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
