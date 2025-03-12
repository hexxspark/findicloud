import {vol} from 'memfs';
import path from 'path';

import {MacAdapter} from '../../adapters/mac-adapter';
import {PathInfo} from '../../types';

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

const {homedir} = require('os');

describe('MacPathFinder', () => {
  let adapter: MacAdapter;
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
    adapter = new MacAdapter();
  });

  afterEach(() => {
    vol.reset();
  });

  describe('Path Finding', () => {
    it('should find root iCloud Drive path', async () => {
      const result = await adapter.findPaths();
      const rootPath = result.find((p: PathInfo) => p.path.includes('com~apple~CloudDocs'));
      expect(rootPath).toBeDefined();
      expect(rootPath?.path).toBe('/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs');
    });

    it('should find app paths', async () => {
      const result = await adapter.findPaths();
      const appPaths = result.filter((p: PathInfo) => p.metadata.appId);

      expect(appPaths.length).toBeGreaterThan(0);
      expect(appPaths).toContainEqual(
        expect.objectContaining({
          path: '/Users/testuser/Library/Mobile Documents/iCloud~com~apple~notes',
          metadata: expect.objectContaining({
            appId: 'iCloud~com~apple~notes',
          }),
        }),
      );
    });

    it('should handle inaccessible paths', async () => {
      // Mock readdir to throw error for specific path
      const mockReaddir = jest.spyOn(vol.promises, 'readdir');
      mockReaddir.mockRejectedValueOnce(new Error('EACCES: permission denied'));

      const result = await adapter.findPaths();
      expect(Array.isArray(result)).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing home directory', async () => {
      homedir.mockReturnValueOnce('');
      const result = await adapter.findPaths();
      expect(Array.isArray(result)).toBeTruthy();
    });

    it('should handle file system errors', async () => {
      jest.spyOn(vol.promises, 'readdir').mockRejectedValueOnce(new Error('File system error'));
      const result = await adapter.findPaths();
      expect(Array.isArray(result)).toBeTruthy();
    });
  });

  describe('Path Metadata', () => {
    it('should enrich app storage metadata', async () => {
      const result = await adapter.findPaths();
      const notesApp = result.find((p: PathInfo) => p.metadata.appId?.includes('apple~notes'));

      expect(notesApp?.metadata.appName).toBe('Notes');
      expect(notesApp?.metadata.bundleId).toBe('com.apple.notes');
      expect(notesApp?.metadata.vendor).toBe('com.apple');
    });

    it('should handle various app naming patterns', async () => {
      const result = await adapter.findPaths();
      const obsidianApp = result.find((p: PathInfo) => p.metadata.appId?.includes('obsidian'));

      expect(obsidianApp?.metadata.appName).toBe('Obsidian');
      expect(obsidianApp?.metadata.bundleId).toBe('md.obsidian.Obsidian');
    });
  });
});
