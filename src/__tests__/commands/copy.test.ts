import { confirm } from '@inquirer/prompts';
import { test } from '@oclif/test';

import { CopyResult, FileAnalysis, FileCopier } from '../../copy';

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

  test
    .stdout()
    .command(['copy', '--help'])
    .exit(0)
    .it('shows help information');

  test
    .do(() => {
      const mockAnalyze = jest.spyOn(FileCopier.prototype, 'analyze');
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');

      mockAnalyze.mockResolvedValueOnce({
        files: [{
          sourcePath: 'file1.txt',
          targetPath: '/icloud/docs/file1.txt',
          size: 1024
        }],
        totalSize: 1024,
        targetPath: '/icloud/docs'
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt'],
        failedFiles: [],
        errors: []
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
        files: [{
          sourcePath: 'note1.txt',
          targetPath: '/icloud/apps/Notes/note1.txt',
          size: 1024
        }],
        totalSize: 1024,
        targetPath: '/icloud/apps/Notes'
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/apps/Notes',
        copiedFiles: ['note1.txt'],
        failedFiles: [],
        errors: []
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './notes', 'app', 'Notes'])
    .it('copies files to specific app');

  test
    .do(() => {
      const mockAnalyze = jest.spyOn(FileCopier.prototype, 'analyze');
      mockAnalyze.mockResolvedValueOnce({
        files: [{
          sourcePath: 'file1.txt',
          targetPath: '/icloud/docs/file1.txt',
          size: 1024
        }],
        totalSize: 1024,
        targetPath: '/icloud/docs'
      } as FileAnalysis);
    })
    .stdout()
    .command(['copy', './documents', 'docs', '--dry-run'])
    .it('supports dry run mode');

  test
    .do(() => {
      const mockAnalyze = jest.spyOn(FileCopier.prototype, 'analyze');
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');

      mockAnalyze.mockResolvedValueOnce({
        files: [
          {
            sourcePath: 'file1.txt',
            targetPath: '/icloud/docs/file1.txt',
            size: 1024
          },
          {
            sourcePath: 'subdir/file2.txt',
            targetPath: '/icloud/docs/subdir/file2.txt',
            size: 2048
          }
        ],
        totalSize: 3072,
        targetPath: '/icloud/docs'
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt', 'subdir/file2.txt'],
        failedFiles: [],
        errors: []
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
        files: [
          {
            sourcePath: 'file1.txt',
            targetPath: '/icloud/docs/file1.txt',
            size: 1024
          },
          {
            sourcePath: 'file2.txt',
            targetPath: '/icloud/docs/file2.txt',
            size: 2048
          }
        ],
        totalSize: 3072,
        targetPath: '/icloud/docs'
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt', 'file2.txt'],
        failedFiles: [],
        errors: []
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
        files: [{
          sourcePath: 'file1.txt',
          targetPath: '/icloud/docs/file1.txt',
          size: 1024
        }],
        totalSize: 1024,
        targetPath: '/icloud/docs'
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: false,
        targetPath: '/icloud/docs',
        copiedFiles: [],
        failedFiles: ['file1.txt'],
        errors: [new Error('Permission denied')]
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
        files: [{
          sourcePath: 'file1.txt',
          targetPath: '/icloud/docs/file1.txt',
          size: 1024
        }],
        totalSize: 1024,
        targetPath: '/icloud/docs'
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt'],
        failedFiles: [],
        errors: []
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
        files: [{
          sourcePath: 'file1.txt',
          targetPath: '/icloud/docs/file1.txt',
          size: 1024
        }],
        totalSize: 1024,
        targetPath: '/icloud/docs'
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt'],
        failedFiles: [],
        errors: []
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
        files: [{
          sourcePath: 'file1.txt',
          targetPath: '/icloud/docs/file1.txt',
          size: 1024
        }],
        totalSize: 1024,
        targetPath: '/icloud/docs'
      } as FileAnalysis);

      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt'],
        failedFiles: [],
        errors: []
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
        files: [{
          sourcePath: 'file1.txt',
          targetPath: '/icloud/docs/file1.txt',
          size: 1024
        }],
        totalSize: 1024,
        targetPath: '/icloud/docs'
      } as FileAnalysis);
    })
    .stdout()
    .command(['copy', './documents', 'docs', '-i'])
    .it('cancels operation when user declines in interactive mode');
});
