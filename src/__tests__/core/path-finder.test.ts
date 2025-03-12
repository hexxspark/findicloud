import {execSync} from 'child_process';
import {vol} from 'memfs';
import * as os from 'os';

import {PathFinder} from '../../core/path-finder';
import {PathInfo} from '../../types';

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

// 创建一个简单的模拟适配器
class MockAdapter {
  private paths: PathInfo[] = [];

  constructor(initialPaths: PathInfo[] = []) {
    this.paths = initialPaths;
  }

  async findPaths(): Promise<PathInfo[]> {
    return this.paths;
  }

  setMockPaths(paths: PathInfo[]): void {
    this.paths = paths;
  }
}

// Mock adapter factory
jest.mock('../../adapters/adapter-factory', () => {
  const testHelpers = jest.requireActual('../test-helpers');

  return {
    getAdapter: jest.fn(() => new MockAdapter(testHelpers.createStandardTestPaths())),
  };
});

describe('PathFinder', () => {
  let finder: PathFinder;
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    vol.reset();
    mockedPlatform.mockReturnValue('darwin');
    mockedHomedir.mockReturnValue('/Users/testuser');
    mockedExecSync.mockReturnValue(Buffer.from(''));

    // Reset singleton and get instance
    PathFinder.reset();
    finder = PathFinder.getInstance('mock');

    // Get mock adapter instance
    mockAdapter = finder['adapter'] as unknown as MockAdapter;
  });

  afterEach(() => {
    vol.reset();
    jest.clearAllMocks();
  });

  describe('find', () => {
    it('should find all paths by default', async () => {
      const results = await finder.find();
      expect(results.length).toBe(5); // Standard test paths have 5 elements
    });

    it('should filter inaccessible paths', async () => {
      const results = await finder.find({includeInaccessible: false});
      expect(results.length).toBe(5);
      expect(results.every(r => r.isAccessible)).toBe(true);
    });

    it('should filter by minimum score', async () => {
      const results = await finder.find({minScore: 80});
      expect(results.length).toBe(5);
      expect(results.every(r => r.score >= 80)).toBe(true);
    });

    it('should find app by name', async () => {
      const results = await finder.find({appName: 'TestApp'});
      expect(results.length).toBe(1);
      expect(results[0].metadata.appName).toBe('TestApp');
    });

    it('should find app by partial name match', async () => {
      const results = await finder.find({appName: 'Test'});
      expect(results.length).toBe(1);
      expect(results[0].metadata.appName).toBe('TestApp');
    });

    it('should handle empty results', async () => {
      mockAdapter.setMockPaths([]);
      const results = await finder.find();
      expect(results).toEqual([]);
    });

    it('should handle errors', async () => {
      // Mock error
      jest.spyOn(mockAdapter, 'findPaths').mockRejectedValue(new Error('Test error'));
      await expect(finder.find()).rejects.toThrow('Test error');
    });
  });

  describe('singleton pattern', () => {
    it('should work with singleton pattern', () => {
      // Reset singleton
      PathFinder.reset();

      // Get instance and test
      const instance1 = PathFinder.getInstance('mock');
      expect(instance1).toBeInstanceOf(PathFinder);

      // Get another instance (should be the same)
      const instance2 = PathFinder.getInstance('mock');
      expect(instance2).toBe(instance1);

      // Use different platform parameter
      const instance3 = PathFinder.getInstance('win32');
      expect(instance3).not.toBe(instance1);
    });
  });
});
