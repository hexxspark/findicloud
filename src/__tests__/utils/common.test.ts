import {vol} from 'memfs';

import {
  calculateTotalSize,
  copyFileWithStreams,
  ensureDirectoryExists,
  fileExists,
  formatFileSize,
  getFileExtension,
  isSubdirectory,
  normalizePath,
} from '../../utils/common';

// Mock fs module
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const memfs = require('memfs');
  return {
    ...actualFs,
    existsSync: (p: string) => memfs.vol.existsSync(p),
    promises: {
      ...actualFs.promises,
      mkdir: (p: string, options: any) => memfs.vol.promises.mkdir(p, options),
      stat: (p: string) => memfs.vol.promises.stat(p),
      access: (p: string, mode: number) => memfs.vol.promises.access(p, mode),
    },
    createReadStream: (p: string) => memfs.vol.createReadStream(p),
    createWriteStream: (p: string) => memfs.vol.createWriteStream(p),
    constants: actualFs.constants,
  };
});

describe('Common Utils', () => {
  beforeEach(() => {
    vol.reset();
  });

  describe('ensureDirectoryExists', () => {
    test('should create directory if it does not exist', async () => {
      // Arrange
      const dirPath = '/test/dir';

      // Act
      await ensureDirectoryExists(dirPath);

      // Assert
      expect(vol.existsSync(dirPath)).toBe(true);
    });

    test('should not throw if directory already exists', async () => {
      // Arrange
      const dirPath = '/test/dir';
      vol.mkdirSync(dirPath, {recursive: true});

      // Act & Assert
      await expect(ensureDirectoryExists(dirPath)).resolves.not.toThrow();
    });
  });

  describe('normalizePath', () => {
    test('should convert backslashes to forward slashes', () => {
      // Arrange
      const windowsPath = 'C:\\Users\\test\\file.txt';

      // Act
      const result = normalizePath(windowsPath);

      // Assert
      expect(result).toBe('C:/Users/test/file.txt');
    });

    test('should not change paths with forward slashes', () => {
      // Arrange
      const unixPath = '/Users/test/file.txt';

      // Act
      const result = normalizePath(unixPath);

      // Assert
      expect(result).toBe(unixPath);
    });
  });

  describe('formatFileSize', () => {
    test('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1023)).toBe('1023 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });

    test('should respect decimal places', () => {
      expect(formatFileSize(1500, 0)).toBe('1 KB');
      expect(formatFileSize(1500, 1)).toBe('1.5 KB');
      expect(formatFileSize(1500, 2)).toBe('1.46 KB');
    });
  });

  describe('isSubdirectory', () => {
    test('should return true for subdirectories', () => {
      expect(isSubdirectory('/parent', '/parent/child')).toBe(true);
      expect(isSubdirectory('/parent', '/parent/child/grandchild')).toBe(true);
    });

    test('should return false for non-subdirectories', () => {
      expect(isSubdirectory('/parent', '/other')).toBe(false);
      expect(isSubdirectory('/parent', '/parent')).toBe(false); // Same directory
      expect(isSubdirectory('/parent/child', '/parent')).toBe(false); // Parent of the "parent"
    });
  });

  describe('fileExists', () => {
    test('should return true if file exists', async () => {
      // Arrange
      const filePath = '/test/file.txt';
      vol.fromJSON({
        '/test/file.txt': 'test content',
      });

      // Act & Assert
      await expect(fileExists(filePath)).resolves.toBe(true);
    });

    test('should return false if file does not exist', async () => {
      // Arrange
      const filePath = '/test/nonexistent.txt';

      // Act & Assert
      await expect(fileExists(filePath)).resolves.toBe(false);
    });
  });

  describe('copyFileWithStreams', () => {
    test('should copy file correctly', async () => {
      // Arrange
      const sourceFile = '/test/source.txt';
      const destFile = '/test/dest.txt';
      const content = 'test content';

      vol.fromJSON({
        [sourceFile]: content,
      });

      // Act
      await copyFileWithStreams(sourceFile, destFile);

      // Assert
      expect(vol.existsSync(destFile)).toBe(true);
      expect(vol.readFileSync(destFile, 'utf8')).toBe(content);
    });

    test('should throw if destination exists and overwrite is false', async () => {
      // Arrange
      const sourceFile = '/test/source.txt';
      const destFile = '/test/dest.txt';

      vol.fromJSON({
        [sourceFile]: 'source content',
        [destFile]: 'destination content',
      });

      // Act & Assert
      await expect(copyFileWithStreams(sourceFile, destFile, false)).rejects.toThrow();
    });

    test('should overwrite if destination exists and overwrite is true', async () => {
      // Arrange
      const sourceFile = '/test/source.txt';
      const destFile = '/test/dest.txt';
      const content = 'new content';

      vol.fromJSON({
        [sourceFile]: content,
        [destFile]: 'old content',
      });

      // Act
      await copyFileWithStreams(sourceFile, destFile, true);

      // Assert
      expect(vol.readFileSync(destFile, 'utf8')).toBe(content);
    });
  });

  describe('calculateTotalSize', () => {
    test('should calculate total size correctly', async () => {
      // Arrange
      vol.fromJSON({
        '/test/file1.txt': 'content1',
        '/test/file2.txt': 'longer content2',
      });

      const files = ['/test/file1.txt', '/test/file2.txt'];

      // Act
      const result = await calculateTotalSize(files);

      // Assert
      expect(result).toBe(8 + 15); // 'content1' + 'longer content2'
    });

    test('should handle nonexistent files', async () => {
      // Arrange
      vol.fromJSON({
        '/test/file1.txt': 'content1',
      });

      const files = ['/test/file1.txt', '/test/nonexistent.txt'];

      // Act
      const result = await calculateTotalSize(files);

      // Assert
      expect(result).toBe(8); // Only 'content1'
    });
  });

  describe('getFileExtension', () => {
    test('should return file extension', () => {
      expect(getFileExtension('file.txt')).toBe('txt');
      expect(getFileExtension('path/to/file.jpg')).toBe('jpg');
      expect(getFileExtension('file.with.multiple.dots.pdf')).toBe('pdf');
    });

    test('should return empty string for files without extension', () => {
      expect(getFileExtension('file')).toBe('');
      expect(getFileExtension('path/to/file')).toBe('');
    });
  });
});
