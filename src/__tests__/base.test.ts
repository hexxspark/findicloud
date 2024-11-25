import * as fs from 'fs';
import {vol} from 'memfs';
import path from 'path';

import {BasePathFinder} from '../base';
import {PathMetadata, PathSource, PathType} from '../types';

// Mock fs methods
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const memfs = require('memfs');
  return {
    ...actualFs,
    existsSync: (path: string) => memfs.vol.existsSync(path),
    readdirSync: (path: string) => memfs.vol.readdirSync(path),
    statSync: (path: string) => memfs.vol.statSync(path),
  };
});

// Create source constants
const COMMON_SOURCE: PathSource = {source: 'common'};
const REGISTRY_SOURCE: PathSource = {source: 'registry'};

// Create a concrete implementation for testing
class TestPathFinder extends BasePathFinder {
  protected _classifyPath(path: string): PathType {
    if (path.includes('iCloud~')) {
      return PathType.APP_STORAGE;
    }
    return PathType.ROOT;
  }

  protected _enrichMetadata(metadata: PathMetadata, path: string, source: PathSource): PathMetadata {
    return {
      ...metadata,
      source,
      sources: metadata.sources ? [...metadata.sources, source] : [source],
    };
  }

  // Expose protected methods for testing
  public addPath(path: string, source: PathSource = COMMON_SOURCE) {
    return this._addPath(path, source);
  }

  public formatAppName(name: string) {
    return this._formatAppName(name);
  }

  // Get paths for testing
  public getPaths() {
    return Array.from(this.pathMap.values());
  }
}

describe('BasePathFinder', () => {
  let finder: TestPathFinder;

  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();
    finder = new TestPathFinder();
  });

  describe('Path Evaluation', () => {
    it('should evaluate Windows paths correctly', () => {
      const testPath = 'C:\\Users\\Test\\iCloudDrive';
      vol.fromJSON({
        'C:\\Users\\Test\\iCloudDrive\\desktop.ini': 'content',
      });

      const result = finder.evaluatePath(testPath);
      expect(result.exists).toBeTruthy();
      expect(result.score).toBeGreaterThan(0);
    });

    it('should evaluate POSIX paths correctly', () => {
      const testPath = '/Users/test/Library/Mobile Documents/com~apple~CloudDocs';
      vol.fromJSON({
        '/Users/test/Library/Mobile Documents/com~apple~CloudDocs/.icloud': '',
      });

      const result = finder.evaluatePath(testPath);
      expect(result.exists).toBeTruthy();
      expect(result.score).toBeGreaterThan(0);
    });

    it('should handle invalid paths', () => {
      const result = finder.evaluatePath('invalid:path');
      expect(result.score).toBeLessThan(0);
      expect(result.exists).toBeFalsy();
    });

    it('should detect iCloud markers', () => {
      const testPath = '/test/icloud';
      vol.fromJSON({
        '/test/icloud/desktop.ini': '',
        '/test/icloud/.icloud': '',
      });

      const result = finder.evaluatePath(testPath);
      expect(result.metadata.hasICloudMarkers).toBeTruthy();
      expect(result.score).toBeGreaterThan(20); // Base score + iCloud marker bonus
    });

    it('should handle inaccessible directories', () => {
      const testPath = '/restricted/dir';
      vol.fromJSON({'/restricted/dir': null});

      // Mock readdirSync to throw error
      const mockReaddirSync = jest.spyOn(require('fs'), 'readdirSync');
      mockReaddirSync.mockImplementationOnce(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = finder.evaluatePath(testPath);
      expect(result.exists).toBeTruthy();
      expect(result.isAccessible).toBeFalsy();
    });
  });

  describe('Path Management', () => {
    it('should add new paths correctly', () => {
      const testPath = '/test/icloud';
      vol.fromJSON({
        '/test/icloud/desktop.ini': '',
      });

      finder.addPath(testPath, COMMON_SOURCE);
      const paths = finder.getPaths();

      expect(paths).toHaveLength(1);
      expect(paths[0].path).toBe(testPath);
      expect(paths[0].metadata.source).toEqual(COMMON_SOURCE);
    });

    it('should update existing paths with better scores', () => {
      const testPath = '/test/icloud';

      // First add with basic setup
      vol.fromJSON({
        '/test/icloud/file.txt': '',
      });
      finder.addPath(testPath, COMMON_SOURCE);

      // Then update with better setup
      vol.reset();
      vol.fromJSON({
        '/test/icloud/desktop.ini': '',
        '/test/icloud/.icloud': '',
      });
      finder.addPath(testPath, REGISTRY_SOURCE);

      const paths = finder.getPaths();
      expect(paths).toHaveLength(1);
      expect(paths[0].metadata.source).toEqual(REGISTRY_SOURCE);
      expect(paths[0].metadata.hasICloudMarkers).toBeTruthy();
    });

    it('should classify paths correctly', () => {
      const rootPath = '/test/icloud';
      const appPath = '/test/iCloud~com~apple~notes';

      vol.fromJSON({
        '/test/icloud/desktop.ini': '',
        '/test/iCloud~com~apple~notes/notes.txt': '',
      });

      finder.addPath(rootPath);
      finder.addPath(appPath);

      const paths = finder.getPaths();
      expect(paths.find(p => p.path === rootPath)?.type).toBe(PathType.ROOT);
      expect(paths.find(p => p.path === appPath)?.type).toBe(PathType.APP_STORAGE);
    });
  });

  describe('Utility Methods', () => {
    it('should format app names correctly', () => {
      const testCases = [
        {input: 'testApp', expected: 'TestApp'},
        {input: 'test.app', expected: 'Test App'},
        {input: 'test-app', expected: 'Test App'},
        {input: 'TestAppName', expected: 'TestAppName'},
        {input: 'test.app.name', expected: 'Test App Name'},
      ];

      for (const {input, expected} of testCases) {
        expect(finder.formatAppName(input)).toBe(expected);
      }
    });

    it('should handle empty and special characters in app names', () => {
      expect(finder.formatAppName('')).toBe('');
      expect(finder.formatAppName('test..app')).toBe('Test App');
      expect(finder.formatAppName('test--app')).toBe('Test App');
      expect(finder.formatAppName('test  app')).toBe('Test App');
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', () => {
      const mockExistsSync = jest.spyOn(require('fs'), 'existsSync');
      mockExistsSync.mockImplementationOnce(() => {
        throw new Error('File system error');
      });

      const result = finder.evaluatePath('/test/path');
      expect(result.score).toBeLessThan(0);
      expect(result.exists).toBeFalsy();
      expect(result.isAccessible).toBeFalsy();
    });

    it('should handle stat errors', () => {
      const mockStatSync = jest.spyOn(require('fs'), 'statSync');
      mockStatSync.mockImplementationOnce(() => {
        throw new Error('Stat error');
      });

      vol.fromJSON({'/test/path': null});
      const result = finder.evaluatePath('/test/path');
      expect(result.score).toBeLessThan(0);
    });
  });
});
