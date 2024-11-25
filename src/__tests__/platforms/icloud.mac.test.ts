import {vol} from 'memfs';
import path from 'path';

import {MacPathFinder} from '../../platforms/mac';
import {PathType} from '../../types';

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
    promises: {
      ...actual.promises,
      readdir: (path: string, options: any) => memfs.vol.promises.readdir(path, options),
    },
  };
});

// Mock os module
jest.mock('os', () => ({
  homedir: jest.fn(),
  platform: jest.fn().mockReturnValue('darwin'),
  type: jest.fn().mockReturnValue('Darwin'),
  release: jest.fn().mockReturnValue('20.0.0'),
}));

// Mock path module
jest.mock('path', () => {
  const actualPath = jest.requireActual('path');
  return {
    ...actualPath,
    sep: '/',
    posix: actualPath.posix,
    win32: actualPath.win32,
    join: (...args: string[]) => args.join('/'),
  };
});

const {execSync} = require('child_process');
const {homedir} = require('os');

describe('MacPathFinder', () => {
  let finder: MacPathFinder;
  let originalPlatform: NodeJS.Platform;

  beforeAll(() => {
    originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();

    homedir.mockReturnValue('/Users/testuser');

    // Setup test file system
    const testFiles = {
      '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Documents/test.txt': 'test content',
      '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/.icloud': '',
      '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/desktop.ini': 'iCloud config',
      '/Users/testuser/Library/Mobile Documents/iCloud~com~apple~notes/notes.txt': 'notes content',
      '/Users/testuser/Library/Mobile Documents/iCloud~md~obsidian~Obsidian/test.md': 'obsidian content',
      '/Users/testuser/Library/Containers/com.apple.iCloud/Data/Library/Mobile Documents/test.doc': 'test doc',
      '/Users/Shared/CloudDocs/shared.txt': 'shared content',
      '/Users/otheruser/Library/Mobile Documents/com~apple~CloudDocs/other.txt': 'other content',
    };

    // Convert Windows-style paths to POSIX paths
    const normalizedFiles = Object.entries(testFiles).reduce(
      (acc, [key, value]) => {
        const normalizedPath = key.split(path.sep).join('/');
        acc[normalizedPath] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    vol.fromJSON(normalizedFiles);
    finder = new MacPathFinder();
  });

  afterEach(() => {
    vol.reset();
  });

  describe('Path Discovery', () => {
    it('should find root iCloud paths', async () => {
      const result = await finder.findPaths();
      const rootPath = result.find(p => p.type === PathType.ROOT);

      expect(rootPath).toBeDefined();
      expect(rootPath?.path).toContain('com~apple~CloudDocs');
      expect(rootPath?.isAccessible).toBeTruthy();
    });

    it('should find app storage paths', async () => {
      const result = await finder.findPaths();
      const appPaths = result.filter(p => p.type === PathType.APP_STORAGE);

      expect(appPaths.length).toBeGreaterThan(0);
      expect(appPaths.some(p => p.metadata.appId?.includes('apple~notes'))).toBeTruthy();
      expect(appPaths.some(p => p.metadata.appId?.includes('obsidian'))).toBeTruthy();
    });

    it('should discover shared paths', async () => {
      const result = await finder.findPaths();
      const sharedPath = result.find(p => p.path.includes('Shared/CloudDocs'));

      expect(sharedPath).toBeDefined();
      expect(sharedPath?.exists).toBeTruthy();
    });
  });

  describe('Multi-user Support', () => {
    it('should find paths for multiple users', async () => {
      execSync.mockReturnValueOnce('testuser\notheruser');
      const result = await finder.findPaths();

      expect(result.some(p => p.path.includes('testuser'))).toBeTruthy();
      expect(result.some(p => p.path.includes('otheruser'))).toBeTruthy();
    });

    it('should handle inaccessible user directories', async () => {
      execSync.mockReturnValueOnce('testuser\nrestricteduser');
      const mockReaddir = jest.spyOn(require('fs').promises, 'readdir');
      mockReaddir
        .mockImplementationOnce(() =>
          Promise.resolve([
            {name: 'com~apple~CloudDocs', isDirectory: () => true},
            {name: 'iCloud~com~apple~notes', isDirectory: () => true},
          ]),
        )
        .mockImplementationOnce(() => Promise.reject(new Error('EACCES: permission denied')));

      const result = await finder.findPaths();
      expect(result.some(p => p.path.includes('testuser'))).toBeTruthy();
      expect(result.every(p => !p.path.includes('restricteduser'))).toBeTruthy();
    });
  });

  describe('Path Metadata', () => {
    it('should enrich app storage metadata', async () => {
      const result = await finder.findPaths();
      const notesApp = result.find(p => p.metadata.appId?.includes('apple~notes'));

      expect(notesApp?.metadata.appName).toBe('Notes');
      expect(notesApp?.metadata.bundleId).toBe('com.apple.notes');
      expect(notesApp?.metadata.vendor).toBe('com.apple');
    });

    it('should handle various app naming patterns', async () => {
      const result = await finder.findPaths();
      const obsidianApp = result.find(p => p.metadata.appId?.includes('obsidian'));

      expect(obsidianApp?.metadata.appName).toBe('Obsidian');
      expect(obsidianApp?.metadata.bundleId).toBe('md.obsidian.Obsidian');
    });
  });

  describe('Path Evaluation', () => {
    it('should correctly evaluate directory contents', async () => {
      const result = finder.evaluatePath('/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs');

      expect(result.exists).toBeTruthy();
      expect(result.isAccessible).toBeTruthy();
      expect(result.metadata.contents).toEqual(expect.arrayContaining(['.icloud', 'desktop.ini', 'Documents']));
    });

    it('should evaluate file stats', async () => {
      const result = finder.evaluatePath(
        '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Documents/test.txt',
      );

      expect(result.exists).toBeTruthy();
      expect(result.metadata.stats).toBeDefined();
      expect(result.metadata.stats?.size).toBe('test content'.length);
    });

    it('should handle access errors', async () => {
      vol.fromJSON({
        '/System/Restricted/iCloud': null,
      });

      const mockReaddirSync = jest.spyOn(require('fs'), 'readdirSync');
      mockReaddirSync.mockImplementationOnce(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = finder.evaluatePath('/System/Restricted/iCloud');
      expect(result.exists).toBeTruthy();
      expect(result.isAccessible).toBeFalsy();
    });

    it('should validate Mac paths', () => {
      const testPaths = [
        {path: '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs', valid: true},
        {path: '/Users/Shared/CloudDocs', valid: true},
        {path: 'NotAPath', valid: false},
        {path: 'C:\\Windows\\Path', valid: false},
      ];

      for (const {path: testPath, valid} of testPaths) {
        const result = finder.evaluatePath(testPath);
        if (valid) {
          expect(result.score).toBeGreaterThan(0);
        } else {
          expect(result.score).toBeLessThanOrEqual(0);
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle dscl command failure', async () => {
      execSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      const result = await finder.findPaths();
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(p => p.type === PathType.ROOT)).toBeTruthy();
    });

    it('should handle missing home directory', async () => {
      homedir.mockReturnValueOnce('');
      const result = await finder.findPaths();
      expect(result.some(p => !p.path.includes('undefined'))).toBeTruthy();
    });

    it('should handle invalid directory entries', async () => {
      const mockReaddir = jest.spyOn(require('fs').promises, 'readdir');
      mockReaddir.mockImplementationOnce(() =>
        Promise.resolve([
          {isDirectory: () => true, name: 'com~apple~CloudDocs'},
          {isDirectory: () => false, name: 'invalid-entry'},
          null,
        ]),
      );

      const result = await finder.findPaths();
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(p => p.path && p.type)).toBeTruthy();
    });
  });
});
