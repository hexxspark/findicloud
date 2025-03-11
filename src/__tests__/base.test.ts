import {vol} from 'memfs';

import {BasePathFinder} from '../base';
import {PathInfo, PathMetadata, PathSource} from '../types';

jest.mock('fs', () => {
  const memfs = require('memfs');
  return {
    ...memfs.fs,
    promises: memfs.fs.promises,
    existsSync: memfs.vol.existsSync.bind(memfs.vol),
    statSync: memfs.vol.statSync.bind(memfs.vol),
    readdirSync: memfs.vol.readdirSync.bind(memfs.vol),
  };
});

const COMMON_SOURCE: PathSource = {
  source: 'common',
};

const REGISTRY_SOURCE: PathSource = {
  source: 'registry',
  path: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\SyncRootManager\\iCloudDrive',
  valueName: 'UserSyncRootPath',
};

class TestPathFinder extends BasePathFinder {
  public async findPaths(): Promise<PathInfo[]> {
    return Array.from(this.pathMap.values());
  }

  protected _enrichMetadata(metadata: PathMetadata, path: string, source: PathSource): PathMetadata {
    return {
      ...metadata,
      source,
    };
  }

  // Expose protected methods for testing
  public testEvaluatePath(path: string): PathInfo {
    return this.evaluatePath(path);
  }

  public testAddPath(path: string, source: PathSource): void {
    this._addPath(path, source);
  }

  public testEnrichMetadata(metadata: PathMetadata, path: string, source: PathSource): PathMetadata {
    return this._enrichMetadata(metadata, path, source);
  }
}

describe('BasePathFinder', () => {
  let finder: TestPathFinder;

  beforeEach(() => {
    vol.reset();
    finder = new TestPathFinder();
  });

  afterEach(() => {
    vol.reset();
  });

  describe('Path Evaluation', () => {
    it('should evaluate existing and accessible paths', () => {
      const testPath = '/test/path';
      vol.fromJSON({[testPath]: 'test content'});

      const result = finder.testEvaluatePath(testPath);
      expect(result.exists).toBe(true);
      expect(result.isAccessible).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should handle non-existent paths', () => {
      const testPath = '/nonexistent/path';
      const result = finder.testEvaluatePath(testPath);

      expect(result.exists).toBe(false);
      expect(result.isAccessible).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should handle inaccessible paths', () => {
      const testPath = '/test/path';
      vol.fromJSON({[testPath]: 'test content'});
      // Mock fs.statSync to throw error
      const mockStatSync = jest.spyOn(require('fs'), 'statSync');
      mockStatSync.mockImplementationOnce(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = finder.testEvaluatePath(testPath);
      expect(result.exists).toBe(false);
      expect(result.isAccessible).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  describe('Path Management', () => {
    it('should add valid paths', async () => {
      const testPath = '/test/path';
      vol.fromJSON({[testPath]: 'test content'});

      finder.testAddPath(testPath, COMMON_SOURCE);
      const paths = await finder.findPaths();

      expect(paths).toHaveLength(1);
      expect(paths[0].path).toBe(testPath);
      expect(paths[0].metadata.source).toEqual(COMMON_SOURCE);
    });

    it('should prioritize paths with higher scores', async () => {
      const testPath = '/test/icloud';
      // Create a directory structure
      vol.mkdirSync(testPath, {recursive: true});
      vol.writeFileSync(`${testPath}/file.txt`, 'content');

      // Mock evaluatePath to return different scores based on source
      const originalEvaluatePath = finder.testEvaluatePath;
      jest.spyOn(finder, 'testEvaluatePath').mockImplementation(path => {
        const result = originalEvaluatePath.call(finder, path);
        // Give registry source a higher score
        if (path === testPath) {
          result.score = 60; // Higher than the default 50
        }
        return result;
      });

      // Add path with registry source (higher score)
      finder.testAddPath(testPath, REGISTRY_SOURCE);
      let paths = await finder.findPaths();
      expect(paths).toHaveLength(1);
      expect(paths[0].metadata.source).toEqual(REGISTRY_SOURCE);

      // Reset the mock to use original implementation
      jest.spyOn(finder, 'testEvaluatePath').mockRestore();
    });

    it('should not update source when scores are equal', async () => {
      const testPath = '/test/equal-score';
      vol.fromJSON({[testPath]: 'test content'});

      // Add path with common source first
      finder.testAddPath(testPath, COMMON_SOURCE);
      let paths = await finder.findPaths();
      expect(paths).toHaveLength(1);
      expect(paths[0].metadata.source).toEqual(COMMON_SOURCE);

      // Add the same path with registry source
      finder.testAddPath(testPath, REGISTRY_SOURCE);

      // Verify that the source is still the original one (common)
      paths = await finder.findPaths();
      expect(paths).toHaveLength(1);
      expect(paths[0].metadata.source).toEqual(COMMON_SOURCE);
    });
  });

  describe('Metadata Enrichment', () => {
    it('should properly enrich metadata with source information', () => {
      const initialMetadata: PathMetadata = {
        appName: 'Test App',
        bundleId: 'com.test.app',
      };

      // Use the test method to access the protected method
      const enrichedMetadata = finder.testEnrichMetadata(initialMetadata, '/test/path', REGISTRY_SOURCE);

      // Verify that the source is added to the metadata
      expect(enrichedMetadata).toEqual({
        ...initialMetadata,
        source: REGISTRY_SOURCE,
      });

      // Verify that the original metadata is not modified
      expect(initialMetadata).not.toHaveProperty('source');
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', () => {
      const mockExistsSync = jest.spyOn(require('fs'), 'existsSync');
      mockExistsSync.mockImplementationOnce(() => {
        throw new Error('File system error');
      });

      const result = finder.testEvaluatePath('/test/path');
      expect(result.score).toBe(0);
      expect(result.exists).toBeFalsy();
      expect(result.isAccessible).toBeFalsy();
    });

    it('should handle stat errors', () => {
      const mockStatSync = jest.spyOn(require('fs'), 'statSync');
      mockStatSync.mockImplementationOnce(() => {
        throw new Error('Stat error');
      });

      vol.fromJSON({'/test/path': null});
      const result = finder.testEvaluatePath('/test/path');
      expect(result.score).toBe(0);
      expect(result.exists).toBeFalsy();
      expect(result.isAccessible).toBeFalsy();
    });
  });
});
