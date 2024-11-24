import {vol} from 'memfs';

import {WindowsPathFinder} from '../../../platforms/win';

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Mock fs methods
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  const memfs = require('memfs');
  return {
    ...actual,
    existsSync: (path: string) => memfs.vol.existsSync(path),
    readdirSync: (path: string) => memfs.vol.readdirSync(path),
    statSync: (path: string) => memfs.vol.statSync(path),
  };
});

// Mock os module
jest.mock('os', () => ({
  homedir: jest.fn(),
  platform: jest.fn().mockReturnValue('win32'),
  type: jest.fn().mockReturnValue('Windows_NT'),
  release: jest.fn().mockReturnValue('10.0.19045'),
}));

// Mock path module
jest.mock('path', () => {
  const actualPath = jest.requireActual('path');
  return {
    ...actualPath,
    sep: '\\',
    win32: actualPath.win32,
    posix: actualPath.posix,
    join: (...args: string[]) => args.join('\\'),
  };
});

const {execSync} = require('child_process');

describe('WindowsPathFinder', () => {
  let finder: WindowsPathFinder;
  let originalPlatform: NodeJS.Platform;

  beforeAll(() => {
    // Store original platform
    originalPlatform = process.platform;
    // Mock process.platform
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
  });

  afterAll(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset and initialize memfs volume
    vol.reset();

    // Setup test file system
    const testFiles = {
      'C:\\Users\\TestUser\\iCloudDrive\\desktop.ini': 'iCloud config',
      'C:\\Users\\TestUser\\iCloudDrive\\Documents': null,
      'C:\\Users\\TestUser\\iCloudDrive\\Photos': null,
      'C:\\Users\\TestUser\\iCloudDrive\\iCloud~1': null,
      'D:\\iCloudDrive\\.icloud': null,
      'D:\\iCloudDrive\\iCloud~1': null,
      'D:\\iCloudDrive\\desktop.ini': 'iCloud config',
      'C:\\Users\\TestUser\\iCloudDrive\\test.txt': 'test content',
      'D:\\iCloudDrive\\sample.doc': 'sample content',
    };

    // Convert paths to use correct separators for the current platform
    const normalizedFiles = Object.entries(testFiles).reduce(
      (acc, [key, value]) => {
        const normalizedPath = key.split('/').join('\\');
        acc[normalizedPath] = value;
        return acc;
      },
      {} as Record<string, string | null>,
    );

    vol.fromJSON(normalizedFiles);

    process.env.USERPROFILE = 'C:\\Users\\TestUser';
    finder = new WindowsPathFinder();
  });

  afterEach(() => {
    vol.reset();
  });

  describe('Registry parsing', () => {
    it('should correctly parse primary registry path', async () => {
      execSync.mockReturnValueOnce(
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\SyncRootManager\\iCloudDrive\r\n' +
          '    UserSyncRootPath    REG_SZ    C:\\Users\\TestUser\\iCloudDrive\r\n' +
          '    MountPoint         REG_SZ    C:\\Users\\TestUser\\iCloudDrive\r\n' +
          '    ProviderName      REG_SZ    iCloud\r\n\r\n',
      );

      const result = await finder.findPaths();

      const icloudPath = result.find(p => p.path === 'C:\\Users\\TestUser\\iCloudDrive');
      expect(icloudPath).toBeDefined();
      expect(icloudPath?.exists).toBeTruthy();
      expect(icloudPath?.isAccessible).toBeTruthy();
      expect(icloudPath?.metadata.contents).toContain('desktop.ini');
      expect(icloudPath?.metadata.contents).toContain('Documents');
      expect(icloudPath?.metadata.hasICloudMarkers).toBeTruthy();
    });

    it('should parse fallback registry paths', async () => {
      execSync
        .mockImplementationOnce(() => {
          throw new Error('The system cannot find the specified key');
        })
        .mockReturnValueOnce(
          'HKEY_LOCAL_MACHINE\\SOFTWARE\\Apple Inc.\\iCloud\r\n' +
            '    StorageDir    REG_SZ    D:\\iCloudDrive\r\n' +
            '    InstallDir    REG_SZ    C:\\Program Files\\Common Files\\Apple\\Internet Services\r\n\r\n',
        );

      const result = await finder.findPaths();

      expect(result).toContainEqual(
        expect.objectContaining({
          path: 'D:\\iCloudDrive',
          metadata: expect.objectContaining({
            source: expect.objectContaining({
              source: 'registry',
              regPath: expect.stringContaining('SOFTWARE\\Apple Inc.\\iCloud'),
            }),
          }),
        }),
      );
    });

    it('should handle WOW6432Node registry paths', async () => {
      execSync
        .mockImplementationOnce(() => {
          throw new Error('The system cannot find the specified key');
        })
        .mockReturnValueOnce('')
        .mockReturnValueOnce(
          'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Apple Inc.\\iCloud\r\n' +
            '    StorageDir    REG_SZ    C:\\Users\\TestUser\\iCloudDrive\r\n' +
            '    Version       REG_SZ    7.21.0.23\r\n\r\n',
        );

      const result = await finder.findPaths();

      expect(result).toContainEqual(
        expect.objectContaining({
          path: 'C:\\Users\\TestUser\\iCloudDrive',
          metadata: expect.objectContaining({
            source: expect.objectContaining({
              source: 'registry',
              regPath: expect.stringContaining('WOW6432Node'),
            }),
          }),
        }),
      );
    });
  });

  describe('Path evaluation', () => {
    it('should correctly evaluate directory contents', async () => {
      const result = finder.evaluatePath('D:\\iCloudDrive');

      expect(result.exists).toBeTruthy();
      expect(result.isAccessible).toBeTruthy();
      expect(result.metadata.contents).toEqual(
        expect.arrayContaining(['.icloud', 'iCloud~1', 'desktop.ini', 'sample.doc']),
      );
    });

    it('should evaluate file stats', async () => {
      const result = finder.evaluatePath('C:\\Users\\TestUser\\iCloudDrive\\desktop.ini');

      expect(result.exists).toBeTruthy();
      expect(result.metadata.stats).toBeDefined();
      expect(result.metadata.stats?.size).toBe('iCloud config'.length);
    });

    it('should handle access errors', async () => {
      // Create a restricted directory
      vol.fromJSON({
        'C:\\Restricted\\iCloudDrive': null, // Empty string instead of null
      });

      // Mock access error
      const mockReaddirSync = jest.spyOn(require('fs'), 'readdirSync');
      mockReaddirSync.mockImplementationOnce(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = finder.evaluatePath('C:\\Restricted\\iCloudDrive');

      expect(result.exists).toBeTruthy();
      expect(result.isAccessible).toBeFalsy();
    });

    it('should validate Windows paths', () => {
      const testPaths = [
        {path: 'C:\\Users\\TestUser\\iCloudDrive', valid: true},
        {path: 'C:iCloudDrive', valid: false},
        {path: 'C:/Users/TestUser/iCloudDrive', valid: true}, // Forward slashes are also valid
        {path: '\\\\NetworkShare\\iCloudDrive', valid: true},
        {path: 'NotAPath', valid: false},
      ];

      for (const {path, valid} of testPaths) {
        const result = finder.evaluatePath(path);
        if (valid) {
          expect(result.score).toBeGreaterThan(-100);
        } else {
          expect(result.score).toBeLessThanOrEqual(0);
        }
      }
    });
  });

  describe('Error handling', () => {
    it('should handle registry access denied', async () => {
      execSync.mockImplementation(() => {
        throw new Error('Access is denied.');
      });

      const result = await finder.findPaths();

      // Should still find paths from common locations
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(p => p.path.includes('iCloudDrive'))).toBeTruthy();
    });

    it('should handle invalid registry values', async () => {
      execSync.mockReturnValueOnce(
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Apple Inc.\\iCloud\r\n' +
          '    StorageDir    REG_SZ    \r\n' + // Empty value
          '    DataPath      REG_SZ    %INVALID%\\Path\r\n', // Invalid path
      );

      const result = await finder.findPaths();

      // Should not include invalid paths
      expect(result.every(p => p.path.includes(':\\'))).toBeTruthy();
    });

    it('should handle missing environment variables', async () => {
      delete process.env.USERPROFILE;

      const result = await finder.findPaths();

      // Should still find paths that don't depend on USERPROFILE
      expect(result.some(p => !p.path.includes('Users'))).toBeTruthy();
    });
  });
});
