import * as fs from 'fs';
import { minimatch } from 'minimatch';
import * as path from 'path';
import { vol } from 'memfs';

import { FileCopier } from '../copy';
import { findDrivePaths } from '../locate';
import { PathType } from '../types';

jest.mock('../locate');
jest.mock('fs', () => {
  const memfs = require('memfs');
  return {
    ...memfs.fs,
    promises: memfs.fs.promises,
    existsSync: memfs.vol.existsSync.bind(memfs.vol),
    statSync: memfs.vol.statSync.bind(memfs.vol),
    readdirSync: memfs.vol.readdirSync.bind(memfs.vol),
  };
});

jest.mock('path', () => {
  const originalPath = jest.requireActual('path');
  return {
    ...originalPath,
    join: (...args: string[]) => args.join('/'),
    relative: (from: string, to: string) => to.replace(from + '/', ''),
  };
});

describe('FileCopier', () => {
  let fileCopier: FileCopier;
  const mockSourcePath = '/test/source';
  const mockTargetPath = '/test/target';

  beforeEach(() => {
    jest.clearAllMocks();
    fileCopier = new FileCopier();

    // Reset the virtual file system
    vol.reset();

    // Mock findICloudDrivePaths
    (findDrivePaths as jest.Mock).mockResolvedValue([
      {
        path: mockTargetPath,
        type: 'documents',
        score: 100,
        isAccessible: true,
        exists: true,
        metadata: {},
      },
    ]);
  });

  describe('copy', () => {
    const mockOptions = {
      source: mockSourcePath,
      targetType: 'documents' as PathType,
      targetApp: undefined,
      pattern: undefined,
      recursive: false,
      overwrite: false,
      dryRun: false,
    };

    it('should successfully copy a single file', async () => {
      // Setup virtual file system
      const fileContent = 'test content';
      vol.mkdirSync(mockSourcePath, { recursive: true });
      vol.writeFileSync(path.join(mockSourcePath, 'file1.txt'), fileContent);

      const result = await fileCopier.copy(mockOptions);

      expect(result.success).toBe(true);
      expect(result.copiedFiles).toContain(path.join(mockSourcePath, 'file1.txt'));
      expect(result.failedFiles).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      // Verify file was copied
      const targetFile = path.join(mockTargetPath, 'file1.txt');
      expect(vol.existsSync(targetFile)).toBe(true);
      expect(vol.readFileSync(targetFile, 'utf8')).toBe(fileContent);
    });

    it('should handle recursive directory copy', async () => {
      const recursiveOptions = { ...mockOptions, recursive: true };

      // Setup virtual file system with nested structure
      // First create the directory structure
      vol.mkdirSync(path.join(mockSourcePath), { recursive: true });
      vol.mkdirSync(path.join(mockSourcePath, 'dir1'), { recursive: true });

      // Then create the files
      vol.writeFileSync(path.join(mockSourcePath, 'file1.txt'), 'content1');
      vol.writeFileSync(path.join(mockSourcePath, 'dir1', 'file2.txt'), 'content2');

      // Ensure directory exists and is recognized as a directory
      const stats = vol.statSync(path.join(mockSourcePath, 'dir1'));
      expect(stats.isDirectory()).toBe(true);

      const result = await fileCopier.copy(recursiveOptions);

      expect(result.success).toBe(true);
      expect(result.copiedFiles).toContain(path.join(mockSourcePath, 'file1.txt'));
      expect(result.copiedFiles).toContain(path.join(mockSourcePath, 'dir1', 'file2.txt'));
      expect(result.failedFiles).toHaveLength(0);

      // Verify files were copied
      expect(vol.existsSync(path.join(mockTargetPath, 'file1.txt'))).toBe(true);
      expect(vol.existsSync(path.join(mockTargetPath, 'dir1', 'file2.txt'))).toBe(true);

      // Verify directory structure was maintained
      const targetDirStats = vol.statSync(path.join(mockTargetPath, 'dir1'));
      expect(targetDirStats.isDirectory()).toBe(true);
    });

    it('should handle file pattern matching', async () => {
      const patternOptions = { ...mockOptions, pattern: '*.txt' };

      // Setup virtual file system
      vol.mkdirSync(mockSourcePath, { recursive: true });
      vol.writeFileSync(path.join(mockSourcePath, 'file1.txt'), 'content1');
      vol.writeFileSync(path.join(mockSourcePath, 'file2.doc'), 'content2');

      const result = await fileCopier.copy(patternOptions);

      expect(result.success).toBe(true);
      expect(result.copiedFiles).toContain(path.join(mockSourcePath, 'file1.txt'));
      expect(result.copiedFiles).not.toContain(path.join(mockSourcePath, 'file2.doc'));

      // Verify only .txt file was copied
      expect(vol.existsSync(path.join(mockTargetPath, 'file1.txt'))).toBe(true);
      expect(vol.existsSync(path.join(mockTargetPath, 'file2.doc'))).toBe(false);
    });

    it('should handle copy errors', async () => {
      // Setup virtual file system with a read-only file
      vol.mkdirSync(mockSourcePath, { recursive: true });
      vol.writeFileSync(path.join(mockSourcePath, 'file1.txt'), 'content');

      // Mock copyFile to throw an error
      const mockCopyFile = jest.spyOn(fs.promises, 'copyFile');
      mockCopyFile.mockRejectedValue(new Error('Permission denied'));

      const result = await fileCopier.copy(mockOptions);

      expect(result.success).toBe(false);
      expect(result.failedFiles).toContain(path.join(mockSourcePath, 'file1.txt'));
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Permission denied');
    });

    it('should handle dry run mode', async () => {
      const dryRunOptions = { ...mockOptions, dryRun: true };

      // Setup virtual file system
      vol.mkdirSync(mockSourcePath, { recursive: true });
      vol.writeFileSync(path.join(mockSourcePath, 'file1.txt'), 'content');

      const result = await fileCopier.copy(dryRunOptions);

      expect(result.success).toBe(true);
      expect(result.copiedFiles).toContain(path.join(mockSourcePath, 'file1.txt'));

      // Verify no files were actually copied
      expect(vol.existsSync(path.join(mockTargetPath, 'file1.txt'))).toBe(false);
    });
  });

  describe('analyze', () => {
    const mockOptions = {
      source: mockSourcePath,
      targetType: 'documents' as PathType,
      targetApp: undefined,
      pattern: undefined,
      recursive: false,
    };

    it('should analyze a single file', async () => {
      // Setup virtual file system
      const fileContent = 'test content';
      vol.mkdirSync(mockSourcePath, { recursive: true });
      vol.writeFileSync(path.join(mockSourcePath, 'file1.txt'), fileContent);

      const analysis = await fileCopier.analyze(mockOptions);

      expect(analysis.files).toHaveLength(1);
      expect(analysis.files[0]).toMatchObject({
        sourcePath: path.join(mockSourcePath, 'file1.txt'),
        targetPath: path.join(mockTargetPath, 'file1.txt'),
        size: expect.any(Number),
      });
      expect(analysis.totalSize).toBe(analysis.files[0].size);
      expect(analysis.targetPath).toBe(mockTargetPath);
    });

    it('should analyze files with pattern matching', async () => {
      const patternOptions = { ...mockOptions, pattern: '*.txt' };

      // Setup virtual file system
      vol.mkdirSync(mockSourcePath, { recursive: true });
      vol.writeFileSync(path.join(mockSourcePath, 'file1.txt'), 'content1');
      vol.writeFileSync(path.join(mockSourcePath, 'file2.doc'), 'content2');

      const analysis = await fileCopier.analyze(patternOptions);

      expect(analysis.files).toHaveLength(1);
      expect(analysis.files[0].sourcePath).toBe(path.join(mockSourcePath, 'file1.txt'));
      expect(analysis.files).not.toContainEqual(
        expect.objectContaining({
          sourcePath: path.join(mockSourcePath, 'file2.doc'),
        }),
      );
    });

    it('should analyze directories recursively', async () => {
      const recursiveOptions = { ...mockOptions, recursive: true };

      // Setup virtual file system with nested structure
      vol.mkdirSync(path.join(mockSourcePath), { recursive: true });
      vol.mkdirSync(path.join(mockSourcePath, 'dir1'), { recursive: true });
      vol.writeFileSync(path.join(mockSourcePath, 'file1.txt'), 'content1');
      vol.writeFileSync(path.join(mockSourcePath, 'dir1/file2.txt'), 'content2');

      const analysis = await fileCopier.analyze(recursiveOptions);

      expect(analysis.files).toHaveLength(2);
      expect(analysis.files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourcePath: path.join(mockSourcePath, 'file1.txt'),
            targetPath: path.join(mockTargetPath, 'file1.txt'),
          }),
          expect.objectContaining({
            sourcePath: path.join(mockSourcePath, 'dir1/file2.txt'),
            targetPath: path.join(mockTargetPath, 'dir1/file2.txt'),
          }),
        ]),
      );
      expect(analysis.totalSize).toBe(
        analysis.files.reduce((total, file) => total + file.size, 0),
      );
    });

    it('should handle no matching files', async () => {
      const patternOptions = { ...mockOptions, pattern: '*.xyz' };

      // Setup virtual file system
      vol.mkdirSync(mockSourcePath, { recursive: true });
      vol.writeFileSync(path.join(mockSourcePath, 'file1.txt'), 'content');

      const analysis = await fileCopier.analyze(patternOptions);

      expect(analysis.files).toHaveLength(0);
      expect(analysis.totalSize).toBe(0);
    });

    it('should throw error when no valid target path found', async () => {
      (findDrivePaths as jest.Mock).mockResolvedValueOnce([]);

      await expect(fileCopier.analyze(mockOptions)).rejects.toThrow('No valid target path found');
    });
  });
});
