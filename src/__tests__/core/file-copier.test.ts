import fs from 'fs';
import {vol} from 'memfs';
import path from 'path';

import {CopyOptions, FileCopier} from '../../core/file-copier';
import {PathFinder} from '../../core/path-finder';

// Mock path module to ensure consistent path format in tests
jest.mock('path', () => {
  const originalPath = jest.requireActual('path');
  return {
    ...originalPath,
    join: (...args: string[]) => {
      // Ensure consistent path format using forward slashes
      return args.filter(Boolean).join('/');
    },
    resolve: (p: string) => p,
    relative: (from: string, to: string) => {
      if (to.includes('dir1')) return 'dir1/file2.txt';
      return 'file1.txt';
    },
    dirname: (p: string) => {
      if (!p) return '';
      const parts = p.split('/');
      parts.pop();
      return parts.join('/') || '/';
    },
  };
});

// Mock fs module with memfs
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const memfs = require('memfs');

  // Create a properly structured Dirent mock
  const createDirentMock = (name: string, isDir = false) => ({
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
  });

  return {
    ...actualFs,
    existsSync: (p: string) => {
      // Return expected results for test paths
      if (p.includes('test/source') || p.includes('test/target')) {
        return true;
      }
      return memfs.vol.existsSync(p);
    },
    statSync: (_path: string | Buffer | URL) => {
      try {
        return memfs.vol.statSync(_path);
      } catch (error) {
        // Return expected results for test paths
        if (String(_path).includes('test/source/file1.txt')) {
          return {
            isFile: () => true,
            isDirectory: () => false,
            size: 100,
          };
        }
        if (String(_path).includes('test/source') && !String(_path).includes('file')) {
          return {
            isFile: () => false,
            isDirectory: () => true,
            size: 0,
          };
        }
        throw error;
      }
    },
    promises: {
      ...actualFs.promises,
      readdir: (dirPath: string, options?: {withFileTypes?: boolean}) => {
        // Return expected results for test paths
        if (dirPath.includes('test/source')) {
          if (dirPath.includes('dir1')) {
            return options && options.withFileTypes
              ? Promise.resolve([createDirentMock('file2.txt', false)])
              : Promise.resolve(['file2.txt']);
          }
          return options && options.withFileTypes
            ? Promise.resolve([createDirentMock('file1.txt', false), createDirentMock('dir1', true)])
            : Promise.resolve(['file1.txt', 'dir1']);
        }

        // If withFileTypes is true, return Dirent objects
        if (options && options.withFileTypes) {
          try {
            const items = memfs.vol.readdirSync(dirPath);
            return Promise.resolve(
              items.map((name: string) => {
                const fullPath = path.join(dirPath, name);
                const stats = memfs.vol.statSync(fullPath);
                return createDirentMock(name, stats.isDirectory());
              }),
            );
          } catch (error) {
            return Promise.reject(error);
          }
        }
        // Otherwise return string array
        return memfs.vol.promises.readdir(dirPath, options);
      },
      mkdir: (p: string, options?: any) => {
        // Return success for test paths
        if (p.includes('test/')) {
          return Promise.resolve(undefined);
        }
        return memfs.vol.promises.mkdir(p, options);
      },
      copyFile: (_src: string, _dest: string) => {
        // Mock successful file copy
        return Promise.resolve(undefined);
      },
      stat: (p: string) => {
        try {
          return memfs.vol.promises.stat(p);
        } catch (error) {
          // Return expected results for test paths
          if (String(p).includes('test/source/file1.txt') || String(p).includes('test/source/dir1/file2.txt')) {
            return Promise.resolve({size: 100});
          }
          return Promise.reject(error);
        }
      },
    },
  };
});

// Mock locate module
jest.mock('../../core/path-finder');

describe('FileCopier', () => {
  // Use paths without leading slash to avoid Windows issues
  const mockSourcePath = 'test/source';
  const mockTargetPath = 'test/target';

  const mockOptions: CopyOptions = {
    source: mockSourcePath,
    app: 'Documents',
    recursive: false,
    overwrite: true, // Allow overwriting existing files
    dryRun: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();

    // Mock find to return a valid target path
    jest.spyOn(PathFinder, 'find').mockResolvedValue([
      {
        path: mockTargetPath,
        isAccessible: true,
        exists: true,
        score: 100,
        metadata: {
          appName: 'Documents',
          source: {source: 'common'},
        },
      },
    ]);
  });

  describe('copy', () => {
    it('should successfully copy a single file', async () => {
      // Mock FileCopier.analyze method
      jest.spyOn(FileCopier.prototype, 'analyze').mockResolvedValue({
        source: `${mockSourcePath}/file1.txt`,
        targetPaths: [
          {
            path: mockTargetPath,
            isAccessible: true,
            exists: true,
            score: 100,
            metadata: {appName: 'Documents'},
          },
        ],
        filesToCopy: [`${mockSourcePath}/file1.txt`],
        totalFiles: 1,
        totalSize: 100,
      });

      // Mock successful file copy
      jest.spyOn(fs, 'createReadStream').mockImplementation(() => {
        const mockStream = new (require('stream').Readable)();
        mockStream._read = () => {};
        // Emit 'end' event to simulate successful read
        setTimeout(() => {
          mockStream.push(null); // End the stream
        }, 0);
        return mockStream;
      });

      jest.spyOn(fs, 'createWriteStream').mockImplementation(() => {
        const mockStream = new (require('stream').Writable)();
        mockStream._write = (chunk: any, encoding: string, callback: () => void) => {
          callback();
        };
        return mockStream;
      });

      const singleFileOptions = {
        ...mockOptions,
        source: `${mockSourcePath}/file1.txt`,
      };

      const fileCopier = new FileCopier();
      const result = await fileCopier.copy(singleFileOptions);

      expect(result.success).toBe(true);
      expect(result.copiedFiles).toHaveLength(1);
      expect(result.copiedFiles[0]).toBe(`${mockSourcePath}/file1.txt`);
      expect(result.failedFiles).toHaveLength(0);
    });

    it('should handle recursive directory copy', async () => {
      // Mock FileCopier.analyze method
      jest.spyOn(FileCopier.prototype, 'analyze').mockResolvedValue({
        source: mockSourcePath,
        targetPaths: [
          {
            path: mockTargetPath,
            isAccessible: true,
            exists: true,
            score: 100,
            metadata: {appName: 'Documents'},
          },
        ],
        filesToCopy: [`${mockSourcePath}/file1.txt`, `${mockSourcePath}/dir1/file2.txt`],
        totalFiles: 2,
        totalSize: 200,
      });

      // Mock successful file copy
      jest.spyOn(fs, 'createReadStream').mockImplementation(() => {
        const mockStream = new (require('stream').Readable)();
        mockStream._read = () => {};
        // Emit 'end' event to simulate successful read
        setTimeout(() => {
          mockStream.push(null); // End the stream
        }, 0);
        return mockStream;
      });

      jest.spyOn(fs, 'createWriteStream').mockImplementation(() => {
        const mockStream = new (require('stream').Writable)();
        mockStream._write = (chunk: any, encoding: string, callback: () => void) => {
          callback();
        };
        return mockStream;
      });

      const recursiveOptions = {...mockOptions, recursive: true};

      const fileCopier = new FileCopier();
      const result = await fileCopier.copy(recursiveOptions);

      expect(result.success).toBe(true);
      expect(result.copiedFiles).toContain(`${mockSourcePath}/file1.txt`);
      expect(result.copiedFiles).toContain(`${mockSourcePath}/dir1/file2.txt`);
      expect(result.failedFiles).toHaveLength(0);
    });

    it('should handle file pattern matching', async () => {
      // Mock FileCopier.analyze method
      jest.spyOn(FileCopier.prototype, 'analyze').mockResolvedValue({
        source: mockSourcePath,
        targetPaths: [
          {
            path: mockTargetPath,
            isAccessible: true,
            exists: true,
            score: 100,
            metadata: {appName: 'Documents'},
          },
        ],
        filesToCopy: [`${mockSourcePath}/file1.txt`, `${mockSourcePath}/dir1/file2.txt`],
        totalFiles: 2,
        totalSize: 200,
      });

      // Mock successful file copy
      jest.spyOn(fs, 'createReadStream').mockImplementation(() => {
        const mockStream = new (require('stream').Readable)();
        mockStream._read = () => {};
        // Emit 'end' event to simulate successful read
        setTimeout(() => {
          mockStream.push(null); // End the stream
        }, 0);
        return mockStream;
      });

      jest.spyOn(fs, 'createWriteStream').mockImplementation(() => {
        const mockStream = new (require('stream').Writable)();
        mockStream._write = (chunk: any, encoding: string, callback: () => void) => {
          callback();
        };
        return mockStream;
      });

      const patternOptions = {...mockOptions, pattern: '*.txt', recursive: true};

      const fileCopier = new FileCopier();
      const result = await fileCopier.copy(patternOptions);

      expect(result.success).toBe(true);
      expect(result.copiedFiles).toContain(`${mockSourcePath}/file1.txt`);
      expect(result.copiedFiles).toContain(`${mockSourcePath}/dir1/file2.txt`);
      expect(result.failedFiles).toHaveLength(0);
    });

    it('should handle dry run mode', async () => {
      // Mock FileCopier.analyze method
      jest.spyOn(FileCopier.prototype, 'analyze').mockResolvedValue({
        source: mockSourcePath,
        targetPaths: [
          {
            path: mockTargetPath,
            isAccessible: true,
            exists: true,
            score: 100,
            metadata: {appName: 'Documents'},
          },
        ],
        filesToCopy: [`${mockSourcePath}/file1.txt`, `${mockSourcePath}/dir1/file2.txt`],
        totalFiles: 2,
        totalSize: 200,
      });

      // Mock copyFile to track calls
      const mockCopyFile = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(fs.promises, 'copyFile').mockImplementation(mockCopyFile);

      const dryRunOptions = {...mockOptions, dryRun: true, recursive: true};

      const fileCopier = new FileCopier();
      const result = await fileCopier.copy(dryRunOptions);

      expect(result.success).toBe(true);
      expect(result.copiedFiles.length).toBeGreaterThan(0);
      expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it('should handle copy errors', async () => {
      // Mock FileCopier.analyze method
      jest.spyOn(FileCopier.prototype, 'analyze').mockResolvedValue({
        source: mockSourcePath,
        targetPaths: [
          {
            path: mockTargetPath,
            isAccessible: true,
            exists: true,
            score: 100,
            metadata: {appName: 'Documents'},
          },
        ],
        filesToCopy: [`${mockSourcePath}/file1.txt`, `${mockSourcePath}/dir1/file2.txt`],
        totalFiles: 2,
        totalSize: 200,
      });

      // Mock fs.createReadStream to throw an error
      const mockError = new Error('Mock copy error');
      jest.spyOn(fs, 'createReadStream').mockImplementation(() => {
        const mockStream = new (require('stream').Readable)();
        mockStream._read = () => {};
        setTimeout(() => {
          mockStream.emit('error', mockError);
        }, 0);
        return mockStream;
      });

      // Make sure the directory exists for the target path
      jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);

      const fileCopier = new FileCopier();
      const result = await fileCopier.copy({...mockOptions, recursive: true});

      expect(result.success).toBe(false);
      expect(result.failedFiles.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Failed to read');
      expect(result.errors[0].message).toContain('Mock copy error');
    });

    it('should not overwrite existing files when overwrite is false', async () => {
      // Mock FileCopier.analyze method
      jest.spyOn(FileCopier.prototype, 'analyze').mockResolvedValue({
        source: mockSourcePath,
        targetPaths: [
          {
            path: mockTargetPath,
            isAccessible: true,
            exists: true,
            score: 100,
            metadata: {appName: 'Documents'},
          },
        ],
        filesToCopy: [`${mockSourcePath}/file1.txt`],
        totalFiles: 1,
        totalSize: 100,
      });

      // Mock existsSync to return true (file exists)
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      const noOverwriteOptions = {
        ...mockOptions,
        overwrite: false,
      };

      const fileCopier = new FileCopier();
      const result = await fileCopier.copy(noOverwriteOptions);

      expect(result.success).toBe(false);
      expect(result.failedFiles).toContain(`${mockSourcePath}/file1.txt`);
      expect(result.errors[0].message).toContain('Target file already exists');
    });
  });

  describe('analyze', () => {
    it('should analyze a single file', async () => {
      // Mock FileCopier.analyze method for this test
      jest.spyOn(FileCopier.prototype, 'analyze').mockRestore();

      // Mock file system methods
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'statSync').mockImplementation(
        _path =>
          ({
            isFile: () => true,
            isDirectory: () => false,
            size: 100,
          }) as any,
      );
      jest.spyOn(fs.promises, 'stat').mockResolvedValue({size: 100} as any);

      // Mock findFilesToCopy to return a single file
      jest.spyOn(FileCopier.prototype as any, 'findFilesToCopy').mockResolvedValue([`${mockSourcePath}/file1.txt`]);

      const singleFileOptions = {
        ...mockOptions,
        source: `${mockSourcePath}/file1.txt`,
      };

      const fileCopier = new FileCopier();
      const analysis = await fileCopier.analyze(singleFileOptions);

      expect(analysis.filesToCopy).toHaveLength(1);
      expect(analysis.filesToCopy[0]).toBe(`${mockSourcePath}/file1.txt`);
      expect(analysis.totalFiles).toBe(1);
      expect(analysis.totalSize).toBeGreaterThan(0);
    });

    it('should analyze directories recursively', async () => {
      // Mock FileCopier.analyze method for this test
      jest.spyOn(FileCopier.prototype, 'analyze').mockRestore();

      // Mock file system methods
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'statSync').mockImplementation(_path => {
        if (String(_path).includes('file')) {
          return {isFile: () => true, isDirectory: () => false} as any;
        }
        return {isFile: () => false, isDirectory: () => true} as any;
      });

      // Mock findFilesToCopy to return multiple files
      jest
        .spyOn(FileCopier.prototype as any, 'findFilesToCopy')
        .mockResolvedValue([`${mockSourcePath}/file1.txt`, `${mockSourcePath}/dir1/file2.txt`]);

      jest.spyOn(fs.promises, 'stat').mockResolvedValue({size: 100} as any);

      const recursiveOptions = {...mockOptions, recursive: true};

      const fileCopier = new FileCopier();
      const analysis = await fileCopier.analyze(recursiveOptions);

      expect(analysis.filesToCopy.length).toBeGreaterThan(0);
      expect(analysis.filesToCopy).toContain(`${mockSourcePath}/file1.txt`);
      expect(analysis.filesToCopy).toContain(`${mockSourcePath}/dir1/file2.txt`);
    });
  });
});

// Add tests for uncovered code paths
describe('FileCopier - Error Handling', () => {
  const mockSourcePath = 'test/source';
  const mockTargetPath = 'test/target';

  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();
  });

  it('should handle errors during file copy operation', async () => {
    // Mock FileCopier.analyze method
    jest.spyOn(FileCopier.prototype, 'analyze').mockResolvedValue({
      source: mockSourcePath,
      targetPaths: [
        {
          path: mockTargetPath,
          isAccessible: true,
          exists: true,
          score: 100,
          metadata: {appName: 'Documents'},
        },
      ],
      filesToCopy: [`${mockSourcePath}/file1.txt`],
      totalFiles: 1,
      totalSize: 100,
    });

    // Mock copyFile to throw an error
    jest.spyOn(FileCopier.prototype as any, 'copyFile').mockRejectedValue(new Error('Mock copy error'));

    const fileCopier = new FileCopier();
    const result = await fileCopier.copy({
      source: mockSourcePath,
      app: 'Documents',
      recursive: false,
      overwrite: true,
      dryRun: false,
    });

    expect(result.success).toBe(false);
    expect(result.failedFiles).toContain(`${mockSourcePath}/file1.txt`);
    expect(result.errors[0].message).toBe('Mock copy error');

    jest.spyOn(FileCopier.prototype as any, 'copyFile').mockRestore();
    jest.spyOn(FileCopier.prototype, 'analyze').mockRestore();
  });

  it('should use findTargetPaths to locate iCloud paths', async () => {
    // Mock find to return a specific result for this test
    const mockFind = jest.spyOn(PathFinder, 'find').mockResolvedValue([
      {
        path: mockTargetPath,
        isAccessible: true,
        exists: true,
        score: 100,
        metadata: {
          appName: 'Documents',
          source: {source: 'common'},
        },
      },
    ]);

    const fileCopier = new FileCopier();
    // Make sure to call findTargetPaths
    const findTargetPathsSpy = jest.spyOn(fileCopier as any, 'findTargetPaths');

    await fileCopier.analyze({
      source: mockSourcePath,
      app: 'Documents',
      recursive: true,
    });

    // Verify that findTargetPaths and find are called
    expect(findTargetPathsSpy).toHaveBeenCalled();
    expect(mockFind).toHaveBeenCalledWith({
      appName: 'Documents',
      minScore: 10,
    });
  });
});

// Tests for FileCopier.copy method overloads
describe('FileCopier.copy overloads', () => {
  // Use the same paths as in previous tests
  const mockSourcePath = 'test/source';
  const mockTargetPath = 'test/target';

  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();

    // Mock find to return a valid target path
    jest.spyOn(PathFinder, 'find').mockResolvedValue([
      {
        path: mockTargetPath,
        isAccessible: true,
        exists: true,
        score: 100,
        metadata: {
          appName: 'Documents',
          source: {source: 'common'},
        },
      },
    ]);

    // Mock FileCopier.analyze method
    jest.spyOn(FileCopier.prototype, 'analyze').mockResolvedValue({
      source: mockSourcePath,
      targetPaths: [
        {
          path: mockTargetPath,
          isAccessible: true,
          exists: true,
          score: 100,
          metadata: {appName: 'Documents'},
        },
      ],
      filesToCopy: [`${mockSourcePath}/file1.txt`],
      totalFiles: 1,
      totalSize: 100,
    });

    // Mock successful file copy
    jest.spyOn(fs, 'createReadStream').mockImplementation(() => {
      const mockStream = new (require('stream').Readable)();
      mockStream._read = () => {};
      // Emit 'end' event to simulate successful read
      setTimeout(() => {
        mockStream.push(null); // End the stream
      }, 0);
      return mockStream;
    });

    jest.spyOn(fs, 'createWriteStream').mockImplementation(() => {
      const mockStream = new (require('stream').Writable)();
      mockStream._write = (chunk: any, encoding: string, callback: () => void) => {
        callback();
      };
      return mockStream;
    });
  });

  it('should work with options object parameter', async () => {
    // Re-mock the analyze method to ensure it returns the correct result
    jest.spyOn(FileCopier.prototype, 'analyze').mockResolvedValueOnce({
      source: mockSourcePath,
      targetPaths: [
        {
          path: mockTargetPath,
          isAccessible: true,
          exists: true,
          score: 100,
          metadata: {appName: 'Documents'},
        },
      ],
      filesToCopy: [`${mockSourcePath}/file1.txt`],
      totalFiles: 1,
      totalSize: 100,
    });

    // Mock existsSync to return false, indicating the target file does not exist
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);

    const fileCopier = new FileCopier();
    const result = await fileCopier.copy({
      source: mockSourcePath,
      app: 'Documents',
      recursive: true,
      overwrite: true,
    });

    expect(result.success).toBe(true);
    expect(result.copiedFiles).toHaveLength(1);
    expect(result.copiedFiles[0]).toBe(`${mockSourcePath}/file1.txt`);
    expect(result.failedFiles).toHaveLength(0);
  });

  it('should work with source and target parameters', async () => {
    // Re-mock the analyze method to ensure it returns the correct result
    jest.spyOn(FileCopier.prototype, 'analyze').mockResolvedValueOnce({
      source: mockSourcePath,
      targetPaths: [
        {
          path: mockTargetPath,
          isAccessible: true,
          exists: true,
          score: 100,
          metadata: {appName: 'Documents'},
        },
      ],
      filesToCopy: [`${mockSourcePath}/file1.txt`],
      totalFiles: 1,
      totalSize: 100,
    });

    // Mock existsSync to return false, indicating the target file does not exist
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);

    const fileCopier = new FileCopier();
    const result = await fileCopier.copy(mockSourcePath, 'Documents');

    expect(result.success).toBe(true);
    expect(result.copiedFiles).toHaveLength(1);
    expect(result.copiedFiles[0]).toBe(`${mockSourcePath}/file1.txt`);
    expect(result.failedFiles).toHaveLength(0);
  });

  it('should work with source, target, and options parameters', async () => {
    // Re-mock the analyze method to ensure it returns the correct result
    jest.spyOn(FileCopier.prototype, 'analyze').mockResolvedValueOnce({
      source: mockSourcePath,
      targetPaths: [
        {
          path: mockTargetPath,
          isAccessible: true,
          exists: true,
          score: 100,
          metadata: {appName: 'Documents'},
        },
      ],
      filesToCopy: [`${mockSourcePath}/file1.txt`],
      totalFiles: 1,
      totalSize: 100,
    });

    // Mock existsSync to return false, indicating the target file does not exist
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);

    const fileCopier = new FileCopier();
    const result = await fileCopier.copy(mockSourcePath, 'Documents', {
      recursive: true,
      overwrite: true,
    });

    expect(result.success).toBe(true);
    expect(result.copiedFiles).toHaveLength(1);
    expect(result.copiedFiles[0]).toBe(`${mockSourcePath}/file1.txt`);
    expect(result.failedFiles).toHaveLength(0);
  });
});
