import {execSync} from 'child_process';
import {vol} from 'memfs';
import * as os from 'os';
import * as path from 'path';

import {DriveLocator} from '../locate';

jest.mock('child_process');
jest.mock('os');

// Handle jest mock types correctly
const mockedPlatform = os.platform as jest.MockedFunction<typeof os.platform>;
const mockedHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

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

describe('DriveLocator', () => {
  let locator: DriveLocator;

  beforeEach(() => {
    vol.reset();
    mockedPlatform.mockReturnValue('darwin');
    mockedHomedir.mockReturnValue('/Users/testuser');
    mockedExecSync.mockReturnValue(Buffer.from(''));
  });

  afterEach(() => {
    vol.reset();
    jest.clearAllMocks();
  });

  describe('locate', () => {
    beforeEach(() => {
      // Set up the test file system
      const testFiles = {
        '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Documents/test.txt': 'test content',
        '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/.icloud': '',
        '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/desktop.ini': 'iCloud config',
        '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Photos/photo1.jpg': 'photo data',
        '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Photos/photo2.jpg': 'photo data',
        '/Users/testuser/Library/Mobile Documents/iCloud~com~apple~notes/notes.txt': 'notes content',
        '/Users/testuser/Library/Mobile Documents/iCloud~com~testapp~TestApp/data.json': 'testapp content',
        '/Users/testuser/Library/Mobile Documents/iCloud~md~obsidian~Obsidian/test.md': 'obsidian content',
      };

      vol.fromJSON(testFiles);
      // Reset singleton state and get instance
      DriveLocator.reset();
      locator = DriveLocator.getInstance();
    });

    it('should find app data', async () => {
      const results = await locator.locate({
        appName: 'TestApp',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.metadata.appName?.toLowerCase().includes('testapp'.toLowerCase()))).toBe(true);
    });

    it('should find photos directory', async () => {
      // Manually add Photos path
      const photosPath = '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Photos';
      locator['finder']['_addPath'](photosPath, {source: 'common'});

      const results = await locator.locate();
      const photoPaths = results.filter(p => p.path.includes('Photos'));
      expect(photoPaths.length).toBeGreaterThan(0);
    });

    it('should find documents directory', async () => {
      const results = await locator.locate();
      const docPaths = results.filter(p => p.path.includes('Documents'));
      expect(docPaths.length).toBeGreaterThan(0);
    });

    it('should handle accessible paths', async () => {
      const results = await locator.locate();
      expect(results.every(r => r.isAccessible)).toBe(true);
    });

    it('should respect minimum score threshold', async () => {
      const minScore = 50;
      const results = await locator.locate({
        minScore,
      });

      expect(results.every(r => r.score >= minScore)).toBe(true);
    });

    it('should find all paths by default', async () => {
      const results = await locator.locate();
      expect(results.length).toBeGreaterThan(0);
    });

    it('should work with singleton pattern', async () => {
      // Reset singleton
      DriveLocator.reset();

      // Get instance and test
      const instance1 = DriveLocator.getInstance();
      const results1 = await instance1.locate();
      expect(results1.length).toBeGreaterThan(0);

      // Get another instance (should be the same)
      const instance2 = DriveLocator.getInstance();
      expect(instance2).toBe(instance1);

      // Use different platform parameter
      const instance3 = DriveLocator.getInstance('win32');
      expect(instance3).not.toBe(instance1);
    });
  });

  describe('Windows Environment', () => {
    beforeEach(() => {
      mockedPlatform.mockReturnValue('win32');
      mockedHomedir.mockReturnValue('C:\\Users\\TestUser');
      process.env.USERPROFILE = 'C:\\Users\\TestUser';

      // Setup Windows test files
      const testFiles = {
        'C:\\Users\\TestUser\\iCloudDrive\\desktop.ini': 'iCloud config',
        'C:\\Users\\TestUser\\iCloudDrive\\.icloud': '',
        'C:\\Users\\TestUser\\iCloudDrive\\iCloud~com~apple~notes\\notes.txt': 'notes content',
      };

      vol.fromJSON(testFiles);

      // Mock registry query response
      mockedExecSync.mockReturnValue(
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\SyncRootManager\\iCloudDrive\r\n' +
          '    UserSyncRootPath    REG_SZ    C:\\Users\\TestUser\\iCloudDrive\r\n',
      );

      // Use singleton pattern
      DriveLocator.reset();
      locator = DriveLocator.getInstance();
    });

    it('should find paths on Windows', async () => {
      const paths = await locator.locate();
      expect(paths).toContainEqual(
        expect.objectContaining({
          path: path.normalize('C:\\Users\\TestUser\\iCloudDrive'),
          metadata: expect.any(Object),
        }),
      );
    });

    it('should find app storage paths', async () => {
      const paths = await locator.locate();
      const appPaths = paths.filter(p => p.metadata.appId);
      expect(appPaths).toContainEqual(
        expect.objectContaining({
          path: path.normalize('C:\\Users\\TestUser\\iCloudDrive\\iCloud~com~apple~notes'),
          metadata: expect.objectContaining({
            appId: 'iCloud~com~apple~notes',
          }),
        }),
      );
    });
  });

  describe('macOS Environment', () => {
    beforeEach(() => {
      mockedPlatform.mockReturnValue('darwin');
      mockedHomedir.mockReturnValue('/Users/testuser');

      // Setup macOS test files
      const testFiles = {
        '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/.icloud': '',
        '/Users/testuser/Library/Mobile Documents/iCloud~com~apple~notes/notes.txt': 'notes content',
        '/Users/otheruser/Library/Mobile Documents/com~apple~CloudDocs/other.txt': 'other content',
      };

      vol.fromJSON(testFiles);

      locator = new DriveLocator();
    });

    it('should find paths on macOS', async () => {
      const paths = await locator.locate();
      expect(paths).toContainEqual(
        expect.objectContaining({
          path: '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs',
          metadata: expect.any(Object),
        }),
      );
    });

    it('should find app storage paths', async () => {
      const paths = await locator.locate();
      const appPaths = paths.filter(p => p.metadata.appId);
      expect(appPaths).toContainEqual(
        expect.objectContaining({
          path: '/Users/testuser/Library/Mobile Documents/iCloud~com~apple~notes',
          metadata: expect.objectContaining({
            appId: 'iCloud~com~apple~notes',
          }),
        }),
      );
    });
  });

  describe('Unsupported Platform', () => {
    beforeEach(() => {
      mockedPlatform.mockReturnValue('linux');
    });

    it('should throw error for unsupported platform', () => {
      expect(() => new DriveLocator()).toThrow('Unsupported platform: linux');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockedPlatform.mockReturnValue('win32');
      mockedHomedir.mockReturnValue('C:\\Users\\TestUser');
      locator = new DriveLocator();
    });

    it('should handle registry access errors', async () => {
      mockedExecSync.mockImplementationOnce(() => {
        throw new Error('Registry access denied');
      });

      const paths = await locator.locate();
      expect(Array.isArray(paths)).toBeTruthy();
    });

    it('should handle missing user profile', async () => {
      delete process.env.USERPROFILE;
      const paths = await locator.locate();
      expect(Array.isArray(paths)).toBeTruthy();
    });

    it('should handle inaccessible directories', async () => {
      vol.mkdirSync('C:\\Restricted');
      const paths = await locator.locate();
      expect(Array.isArray(paths)).toBeTruthy();
    });
  });
});
