import {vol} from 'memfs';
import path from 'path';

import {MacPathFinder} from '../../../platforms/mac';
import type {PathInfo} from '../../../types';

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

    // Setup test file system with forward slashes
    const testFiles = {
      '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Documents/test.txt': 'test content',
      '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/.icloud': '',
      '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/desktop.ini': 'iCloud config',
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

  describe('Default locations', () => {
    it('should find iCloud paths in default locations', async () => {
      const result = await finder.findPaths();

      const expectedPath = '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs';
      const foundPath = result.find(p => p.path === expectedPath);
      expect(foundPath).toBeDefined();
      expect(foundPath?.metadata.source?.source).toBe('default');
    });

    it('should check shared CloudDocs directory', async () => {
      const result = await finder.findPaths();
      const sharedPath = result.find(p => p.path === '/Users/Shared/CloudDocs');
      expect(sharedPath).toBeDefined();
      expect(sharedPath?.exists).toBeTruthy();
      expect(sharedPath?.isAccessible).toBeTruthy();
    });
  });

  describe('User directories', () => {
    it('should find iCloud paths in user directories', async () => {
      execSync.mockReturnValueOnce('testuser\notheruser');

      const result = await finder.findPaths();
      const paths = result.map(p => p.path);

      expect(paths).toContain('/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs');
      expect(paths).toContain('/Users/otheruser/Library/Mobile Documents/com~apple~CloudDocs');
    });

    it('should handle inaccessible user directories', async () => {
      execSync.mockReturnValueOnce('testuser\nrestricteduser');

      const mockReaddir = jest.spyOn(require('fs').promises, 'readdir');
      mockReaddir.mockImplementationOnce(() => Promise.resolve([]));
      mockReaddir.mockImplementationOnce(() => Promise.reject(new Error('EACCES: permission denied')));

      const result = await finder.findPaths();

      expect(result.length).toBeGreaterThan(0);
      expect(result.every(p => !p.path.includes('restricteduser'))).toBeTruthy();
    });
  });

  describe('Container paths', () => {
    it('should find iCloud paths in containers', async () => {
      const result = await finder.findPaths();
      const containerPath = '/Users/testuser/Library/Containers/com.apple.iCloud/Data/Library/Mobile Documents';

      const foundPath = result.find(p => p.path === containerPath);
      expect(foundPath).toBeDefined();
      expect(foundPath?.metadata.source?.source).toBe('container');
      expect(foundPath?.metadata.source?.container).toBe('com.apple.iCloud');
      expect(foundPath?.metadata.source?.type).toBe('application');
    });

    it('should handle inaccessible container directories', async () => {
      const mockReaddir = jest.spyOn(require('fs').promises, 'readdir');
      mockReaddir.mockImplementationOnce(() => Promise.reject(new Error('EACCES: permission denied')));

      const result = await finder.findPaths();

      expect(result.length).toBeGreaterThan(0);
      expect(
        result.every((p: PathInfo) => !p.metadata.source || p.metadata.source.source !== 'container'),
      ).toBeTruthy();
    });
  });

  describe('Path evaluation', () => {
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

  describe('Error handling', () => {
    it('should handle dscl command failure', async () => {
      execSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      const result = await finder.findPaths();

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((p: PathInfo) => p.metadata.source?.source === 'default')).toBeTruthy();
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
    });
  });
});
