import * as fs from 'fs';
import {vol} from 'memfs';
import * as path from 'path';

import {FileCopier} from '../copy';
import {findDrivePaths} from '../list';
import {PathType} from '../types';

// Mock dependencies
jest.mock('../list');
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const memfs = require('memfs');
  return {
    ...actualFs,
    existsSync: (path: string) => memfs.vol.existsSync(path),
    readdirSync: (path: string) => memfs.vol.readdirSync(path),
    statSync: (path: string) => memfs.vol.statSync(path),
    promises: {
      ...actualFs.promises,
      mkdir: (path: string, options: any) => memfs.vol.promises.mkdir(path, options),
      copyFile: (src: string, dest: string) => memfs.vol.promises.copyFile(src, dest),
    },
  };
});

jest.mock('minimatch', () => ({
  minimatch: (filename: string, pattern: string) => {
    if (pattern === '*') return true;
    const extension = pattern.replace('*.', '');
    return filename.endsWith(extension);
  },
}));

// Mock path module for cross-platform compatibility
jest.mock('path', () => {
  const actualPath = jest.requireActual('path');
  return {
    ...actualPath,
    sep: '/',
    join: (...args: string[]) => args.join('/'),
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
      vol.mkdirSync(mockSourcePath, {recursive: true});
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
      const recursiveOptions = {...mockOptions, recursive: true};

      // Setup virtual file system with nested structure
      // First create the directory structure
      vol.mkdirSync(path.join(mockSourcePath), {recursive: true});
      vol.mkdirSync(path.join(mockSourcePath, 'dir1'), {recursive: true});

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
      const patternOptions = {...mockOptions, pattern: '*.txt'};

      // Setup virtual file system
      vol.mkdirSync(mockSourcePath, {recursive: true});
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
      vol.mkdirSync(mockSourcePath, {recursive: true});
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
      const dryRunOptions = {...mockOptions, dryRun: true};

      // Setup virtual file system
      vol.mkdirSync(mockSourcePath, {recursive: true});
      vol.writeFileSync(path.join(mockSourcePath, 'file1.txt'), 'content');

      const result = await fileCopier.copy(dryRunOptions);

      expect(result.success).toBe(true);
      expect(result.copiedFiles).toContain(path.join(mockSourcePath, 'file1.txt'));

      // Verify no files were actually copied
      expect(vol.existsSync(path.join(mockTargetPath, 'file1.txt'))).toBe(false);
    });
  });
});
