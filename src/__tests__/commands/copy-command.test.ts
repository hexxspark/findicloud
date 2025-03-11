import {confirm} from '@inquirer/prompts';
import {test} from '@oclif/test';

import {CopyResult, FileAnalysis, FileCopier} from '../../copy';

// Mock dependencies
jest.mock('../../copy');
jest.mock('@inquirer/prompts', () => ({
  confirm: jest.fn(),
}));

describe('copy command', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (confirm as jest.Mock).mockResolvedValue(true);
  });

  test.stdout().command(['copy', '--help']).exit(0).it('shows help information');

  test
    .do(() => {
      const mockAnalyze = jest.spyOn(FileCopier.prototype, 'analyze');
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');

      mockAnalyze.mockResolvedValueOnce({
        source: '/test/source',
        targetPaths: [
          {
            path: '/icloud/docs',
            isAccessible: true,
            metadata: {},
          },
        ],
        filesToCopy: ['/test/source/file1.txt'],
        totalFiles: 1,
        totalSize: 1024,
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt'],
        failedFiles: [],
        errors: [],
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './documents', 'docs'])
    .it('copies files to documents');

  test
    .do(() => {
      const mockAnalyze = jest.spyOn(FileCopier.prototype, 'analyze');
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');

      mockAnalyze.mockResolvedValueOnce({
        source: '/test/source',
        targetPaths: [
          {
            path: '/icloud/apps/Notes',
            isAccessible: true,
            metadata: {},
          },
        ],
        filesToCopy: ['/test/source/notes.txt'],
        totalFiles: 1,
        totalSize: 2048,
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/apps/Notes',
        copiedFiles: ['note1.txt'],
        failedFiles: [],
        errors: [],
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './notes', 'Notes'])
    .it('copies files to specific app');

  test
    .do(() => {
      const mockAnalyze = jest.spyOn(FileCopier.prototype, 'analyze');
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');

      mockAnalyze.mockResolvedValueOnce({
        source: '/test/source',
        targetPaths: [
          {
            path: '/icloud/docs',
            isAccessible: true,
            metadata: {},
          },
        ],
        filesToCopy: ['/test/source/file1.txt'],
        totalFiles: 1,
        totalSize: 1024,
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['/test/source/file1.txt'],
        failedFiles: [],
        errors: [],
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './documents', 'docs', '--dry-run'])
    .it('supports dry run mode');

  test
    .do(() => {
      const mockAnalyze = jest.spyOn(FileCopier.prototype, 'analyze');
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');

      mockAnalyze.mockResolvedValueOnce({
        source: '/test/source',
        targetPaths: [
          {
            path: '/icloud/docs',
            isAccessible: true,
            metadata: {},
          },
        ],
        filesToCopy: ['/test/source/file1.txt', '/test/source/subdir/file2.txt'],
        totalFiles: 2,
        totalSize: 2048,
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt', 'subdir/file2.txt'],
        failedFiles: [],
        errors: [],
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './documents', 'docs', '-r'])
    .it('supports recursive copy');

  test
    .do(() => {
      const mockAnalyze = jest.spyOn(FileCopier.prototype, 'analyze');
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');

      mockAnalyze.mockResolvedValueOnce({
        source: '/test/source',
        targetPaths: [
          {
            path: '/icloud/docs',
            isAccessible: true,
            metadata: {},
          },
        ],
        filesToCopy: ['/test/source/file1.txt', '/test/source/file2.txt'],
        totalFiles: 2,
        totalSize: 2048,
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt', 'file2.txt'],
        failedFiles: [],
        errors: [],
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './documents', 'docs', '-p', '*.txt'])
    .it('supports file pattern matching');

  test
    .do(() => {
      const mockAnalyze = jest.spyOn(FileCopier.prototype, 'analyze');
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');

      mockAnalyze.mockResolvedValueOnce({
        source: '/test/source',
        targetPaths: [
          {
            path: '/icloud/docs',
            isAccessible: true,
            metadata: {},
          },
        ],
        filesToCopy: ['/test/source/file1.txt'],
        totalFiles: 1,
        totalSize: 1024,
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: false,
        targetPath: '/icloud/docs',
        copiedFiles: [],
        failedFiles: ['file1.txt'],
        errors: [new Error('Permission denied')],
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './documents', 'docs'])
    .exit(2)
    .it('handles copy operation failure');

  // New test cases for interactive and detailed output features
  test
    .do(() => {
      const mockAnalyze = jest.spyOn(FileCopier.prototype, 'analyze');
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');

      mockAnalyze.mockResolvedValueOnce({
        source: '/test/source',
        targetPaths: [
          {
            path: '/icloud/docs',
            isAccessible: true,
            metadata: {},
          },
        ],
        filesToCopy: ['/test/source/file1.txt'],
        totalFiles: 1,
        totalSize: 1024,
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt'],
        failedFiles: [],
        errors: [],
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './documents', 'docs', '--detailed'])
    .it('displays detailed file information');

  test
    .do(() => {
      const mockAnalyze = jest.spyOn(FileCopier.prototype, 'analyze');
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');

      mockAnalyze.mockResolvedValueOnce({
        source: '/test/source',
        targetPaths: [
          {
            path: '/icloud/docs',
            isAccessible: true,
            metadata: {},
          },
        ],
        filesToCopy: ['/test/source/file1.txt'],
        totalFiles: 1,
        totalSize: 1024,
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt'],
        failedFiles: [],
        errors: [],
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './documents', 'docs', '--detailed', '--table'])
    .it('displays file information in table format');

  test
    .do(() => {
      const mockAnalyze = jest.spyOn(FileCopier.prototype, 'analyze');
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');

      mockAnalyze.mockResolvedValueOnce({
        source: '/test/source',
        targetPaths: [
          {
            path: '/icloud/docs',
            isAccessible: true,
            metadata: {},
          },
        ],
        filesToCopy: ['/test/source/file1.txt'],
        totalFiles: 1,
        totalSize: 1024,
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt'],
        failedFiles: [],
        errors: [],
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './documents', 'docs', '-y'])
    .it('skips confirmation with --yes flag');

  test
    .do(() => {
      const mockAnalyze = jest.spyOn(FileCopier.prototype, 'analyze');
      (confirm as jest.Mock).mockResolvedValueOnce(false);

      mockAnalyze.mockResolvedValueOnce({
        source: '/test/source',
        targetPaths: [
          {
            path: '/icloud/docs',
            isAccessible: true,
            metadata: {},
          },
        ],
        filesToCopy: ['/test/source/file1.txt'],
        totalFiles: 1,
        totalSize: 1024,
      } as FileAnalysis);
    })
    .stdout()
    .command(['copy', './documents', 'docs', '-i'])
    .it('cancels operation when user declines in interactive mode');
});
