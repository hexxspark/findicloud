import {vol} from 'memfs';

import {ensureDirectoryExists, formatFileSize, isSubdirectory, normalizePath} from '../../utils/common';

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
    },
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
});
