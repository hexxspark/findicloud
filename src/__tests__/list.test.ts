import {vol} from 'memfs';
import path from 'path';

import {DriveLister as DriveLister} from '../list';
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

describe('ICloudDriveLister', () => {
  let lister: DriveLister;

  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();
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

      lister = new DriveLister();
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
      const appPaths = paths.filter(p => p.type === PathType.APP_STORAGE);
      expect(appPaths).toContainEqual(
        expect.objectContaining({
          path: path.normalize('C:\\Users\\TestUser\\iCloudDrive\\iCloud~com~apple~notes'),
          type: PathType.APP_STORAGE,
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

      lister = new DriveLister();
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
      const appPaths = paths.filter(p => p.type === PathType.APP_STORAGE);
      expect(appPaths).toContainEqual(
        expect.objectContaining({
          path: '/Users/testuser/Library/Mobile Documents/iCloud~com~apple~notes',
          type: PathType.APP_STORAGE,
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
      expect(() => new DriveLister()).toThrow('Unsupported platform: linux');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      os.platform.mockReturnValue('win32');
      os.homedir.mockReturnValue('C:\\Users\\TestUser');
      lister = new DriveLister();
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
