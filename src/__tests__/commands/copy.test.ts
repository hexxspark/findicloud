import { test } from '@oclif/test';
import { FileCopier, CopyResult } from '../../copy';

// Mock copy command dependencies
jest.mock('../../copy');

describe('copy command', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test
    .stdout()
    .command(['copy', '--help'])
    .exit(0)
    .it('shows help information');

  test
    .do(() => {
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');
      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt'],
        failedFiles: [],
        errors: []
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './documents', '-t', 'docs'])
    .it('copies files to documents');

  test
    .do(() => {
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');
      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/apps/Notes',
        copiedFiles: ['note1.txt'],
        failedFiles: [],
        errors: []
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './notes', '-t', 'app', '--target-app', 'Notes'])
    .it('copies files to specific app');

  test
    .do(() => {
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');
      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt'],
        failedFiles: [],
        errors: []
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './documents', '-t', 'docs', '--dry-run'])
    .it('supports dry run mode');

  test
    .do(() => {
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');
      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt', 'subdir/file2.txt'],
        failedFiles: [],
        errors: []
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './documents', '-t', 'docs', '-r'])
    .it('supports recursive copy');

  test
    .do(() => {
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');
      mockCopy.mockResolvedValueOnce({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt', 'file2.txt'],
        failedFiles: [],
        errors: []
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './documents', '-t', 'docs', '-p', '*.txt'])
    .it('supports file pattern matching');

  test
    .do(() => {
      const mockCopy = jest.spyOn(FileCopier.prototype, 'copy');
      mockCopy.mockResolvedValueOnce({
        success: false,
        targetPath: '/icloud/docs',
        copiedFiles: [],
        failedFiles: ['file1.txt'],
        errors: [new Error('Permission denied')]
      } as CopyResult);
    })
    .stdout()
    .command(['copy', './documents', '-t', 'docs'])
    .exit(2)
    .it('handles copy operation failure');
});
