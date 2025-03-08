import {vol} from 'memfs';
import path from 'path';

import {DriveLocator} from '../locate';
import {PathType} from '../types';

const mockExecSync = jest.fn();

jest.mock('child_process', () => ({
  execSync: (...args: string[]) => mockExecSync(...args),
}));

jest.mock('os', () => {
  const actual = jest.requireActual('os');
  return {
    ...actual,
    platform: jest.fn().mockReturnValue('win32'),
    homedir: jest.fn(),
  };
});

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
      readdir: (path: string, options: any) => memfs.vol.promises.readdir(path, options),
    },
  };
});

// Mock path module
jest.mock('path', () => {
  const actualPath = jest.requireActual('path');
  return {
    ...actualPath,
    get sep() {
      return os.platform() === 'win32' ? '\\' : '/';
    },
    posix: actualPath.posix,
    win32: actualPath.win32,
    join: (...args: string[]) => (os.platform() === 'win32' ? args.join('\\') : args.join('/')),
  };
});

const os = require('os');

describe('DriveLocator', () => {
  let lister: DriveLocator;

  describe('findPaths', () => {
    beforeEach(() => {
      os.platform.mockReturnValue('darwin');
      os.homedir.mockReturnValue('/Users/testuser');

      // Setup test files for different path types in macOS structure
      const testFiles = {
        // Root iCloud Drive directory
        '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/.icloud': '',

        // App data
        '/Users/testuser/Library/Mobile Documents/iCloud~com~testapp/data.txt': 'test content',
        '/Users/testuser/Library/Mobile Documents/iCloud~com~testapp/Documents/config.json': 'config',

        // Photos directory structure
        '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Photos': null,
        '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Photos/vacation.jpg': 'photo content',
        '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Photos/family.jpg': 'photo content',

        // Documents
        '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Documents/report.doc': 'document content',
        '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Documents/notes.txt': 'notes content',
      };

      vol.fromJSON(testFiles);

      lister = new DriveLocator();
    });

    it('should find app data', async () => {
      const results = await lister.findPaths({
        type: PathType.APP,
        appName: 'TestApp',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === PathType.APP)).toBe(true);
      expect(results.every(r => r.metadata.appName?.toLowerCase().includes('testapp'.toLowerCase()))).toBe(true);
    });

    it('should find photos', async () => {
      const results = await lister.findPaths({
        type: PathType.PHOTOS,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === PathType.PHOTOS)).toBe(true);
    });

    it('should find documents', async () => {
      const results = await lister.findPaths({
        type: PathType.DOCS,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === PathType.DOCS)).toBe(true);
    });

    it('should filter inaccessible paths', async () => {
      const results = await lister.findPaths({
        includeInaccessible: false,
      });

      expect(results.every(r => r.isAccessible)).toBe(true);
    });

    it('should filter by minimum score', async () => {
      const minScore = 50;
      const results = await lister.findPaths({
        minScore,
      });

      expect(results.every(r => r.score >= minScore)).toBe(true);
    });

    it('should find all paths when no type specified', async () => {
      const results = await lister.findPaths();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Windows Environment', () => {
    beforeEach(() => {
      os.platform.mockReturnValue('win32');
      os.homedir.mockReturnValue('C:\\Users\\TestUser');
      process.env.USERPROFILE = 'C:\\Users\\TestUser';

      // Setup Windows test files
      const testFiles = {
        'C:\\Users\\TestUser\\iCloudDrive\\desktop.ini': 'iCloud config',
        'C:\\Users\\TestUser\\iCloudDrive\\.icloud': '',
        'C:\\Users\\TestUser\\iCloudDrive\\iCloud~com~apple~notes\\notes.txt': 'notes content',
      };

      vol.fromJSON(testFiles);

      // Mock registry query response
      mockExecSync.mockReturnValue(
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\SyncRootManager\\iCloudDrive\r\n' +
          '    UserSyncRootPath    REG_SZ    C:\\Users\\TestUser\\iCloudDrive\r\n',
      );

      lister = new DriveLocator();
    });

    it('should find paths on Windows', async () => {
      const paths = await lister.findPaths();
      expect(paths).toContainEqual(
        expect.objectContaining({
          path: path.normalize('C:\\Users\\TestUser\\iCloudDrive'),
          type: PathType.ROOT,
        }),
      );
    });

    it('should find app storage paths', async () => {
      const paths = await lister.findPaths();
      const appPaths = paths.filter(p => p.type === PathType.APP);
      expect(appPaths).toContainEqual(
        expect.objectContaining({
          path: path.normalize('C:\\Users\\TestUser\\iCloudDrive\\iCloud~com~apple~notes'),
          type: PathType.APP,
          metadata: expect.objectContaining({
            appId: 'iCloud~com~apple~notes',
          }),
        }),
      );
    });
  });

  describe('macOS Environment', () => {
    beforeEach(() => {
      os.platform.mockReturnValue('darwin');
      os.homedir.mockReturnValue('/Users/testuser');

      // Setup macOS test files
      const testFiles = {
        '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/.icloud': '',
        '/Users/testuser/Library/Mobile Documents/iCloud~com~apple~notes/notes.txt': 'notes content',
        '/Users/otheruser/Library/Mobile Documents/com~apple~CloudDocs/other.txt': 'other content',
      };

      vol.fromJSON(testFiles);

      lister = new DriveLocator();
    });

    it('should find paths on macOS', async () => {
      const paths = await lister.findPaths();
      expect(paths).toContainEqual(
        expect.objectContaining({
          path: '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs',
          type: PathType.ROOT,
        }),
      );
    });

    it('should find app storage paths', async () => {
      const paths = await lister.findPaths();
      const appPaths = paths.filter(p => p.type === PathType.APP);
      expect(appPaths).toContainEqual(
        expect.objectContaining({
          path: '/Users/testuser/Library/Mobile Documents/iCloud~com~apple~notes',
          type: PathType.APP,
          metadata: expect.objectContaining({
            appId: 'iCloud~com~apple~notes',
          }),
        }),
      );
    });
  });

  describe('Unsupported Platform', () => {
    beforeEach(() => {
      os.platform.mockReturnValue('linux');
    });

    it('should throw error for unsupported platform', () => {
      expect(() => new DriveLocator()).toThrow('Unsupported platform: linux');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      os.platform.mockReturnValue('win32');
      os.homedir.mockReturnValue('C:\\Users\\TestUser');
      lister = new DriveLocator();
    });

    it('should handle registry access errors', async () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('Registry access denied');
      });

      const paths = await lister.findPaths();
      expect(Array.isArray(paths)).toBeTruthy();
    });

    it('should handle missing user profile', async () => {
      delete process.env.USERPROFILE;
      const paths = await lister.findPaths();
      expect(Array.isArray(paths)).toBeTruthy();
    });

    it('should handle inaccessible directories', async () => {
      vol.mkdirSync('C:\\Restricted');
      const paths = await lister.findPaths();
      expect(Array.isArray(paths)).toBeTruthy();
    });
  });
});
