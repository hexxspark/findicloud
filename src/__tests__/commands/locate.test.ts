import { test } from '@oclif/test';

import * as locateModule from '../../locate';
import { PathType } from '../../types';

// Mock findDrivePaths function
jest.mock('../../locate');
const mockFindDrivePaths = jest.fn().mockResolvedValue([]);
(locateModule.findDrivePaths as jest.Mock) = mockFindDrivePaths;

describe('locate command', () => {
  beforeEach(() => {
    mockFindDrivePaths.mockReset();
    mockFindDrivePaths.mockResolvedValue([]);
  });

  // Basic functionality tests
  test
    .stdout()
    .do(() => {
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/iCloud/root/path',
          type: PathType.ROOT,
          score: 100,
          exists: true,
          isAccessible: true,
          metadata: {},
        },
      ]);
    })
    .command(['locate'])
    .it('displays root paths by default', ({ stdout }) => {
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PathType.ROOT,
        }),
      );
      expect(stdout).toContain('/iCloud/root/path');
    });

  // Application path tests
  test
    .stdout()
    .do(() => {
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/iCloud/apps/MyApp',
          type: PathType.APP,
          score: 100,
          exists: true,
          isAccessible: true,
          metadata: {
            appName: 'MyApp',
            bundleId: 'com.example.myapp',
          },
        },
      ]);
    })
    .command(['locate', 'app', 'MyApp'])
    .it('finds paths for specific application', ({ stdout }) => {
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PathType.APP,
          appName: 'MyApp',
        }),
      );
      expect(stdout).toContain('/iCloud/apps/MyApp');
    });

  // Photos path tests
  test
    .stdout()
    .do(() => {
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/iCloud/photos',
          type: PathType.PHOTOS,
          score: 100,
          exists: true,
          isAccessible: true,
          metadata: {},
        },
      ]);
    })
    .command(['locate', 'photos'])
    .it('finds photos paths', ({ stdout }) => {
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PathType.PHOTOS,
        }),
      );
      expect(stdout).toContain('/iCloud/photos');
    });

  // Documents path tests
  test
    .stdout()
    .do(() => {
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/iCloud/documents',
          type: PathType.DOCS,
          score: 100,
          exists: true,
          isAccessible: true,
          metadata: {},
        },
      ]);
    })
    .command(['locate', 'docs'])
    .it('finds document paths', ({ stdout }) => {
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PathType.DOCS,
        }),
      );
      expect(stdout).toContain('/iCloud/documents');
    });

  // Filter option tests
  test
    .stdout()
    .command(['locate', '--min-score', '80'])
    .it('supports minimum score filtering', () => {
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.objectContaining({
          minScore: 80,
        }),
      );
    });

  test
    .stdout()
    .command(['locate', '--include-inaccessible'])
    .it('supports including inaccessible paths', () => {
      expect(mockFindDrivePaths).toHaveBeenCalledWith(
        expect.objectContaining({
          includeInaccessible: true,
        }),
      );
    });

  // Output format tests
  test
    .stdout()
    .do(() => {
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/iCloud/apps/TestApp',
          type: PathType.APP,
          score: 100,
          exists: true,
          isAccessible: true,
          metadata: {
            appName: 'TestApp',
            bundleId: 'com.test.app',
          },
        },
      ]);
    })
    .command(['locate', '--detailed'])
    .it('supports detailed output format', ({ stdout }) => {
      expect(stdout).toContain('Path:');
      expect(stdout).toContain('/iCloud/apps/TestApp');
      expect(stdout).toContain('Type:');
      expect(stdout).toContain('app');
      expect(stdout).toContain('Score:');
      expect(stdout).toContain('100');
    });

  test
    .stdout()
    .do(() => {
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/iCloud/apps/TestApp',
          type: PathType.APP,
          score: 100,
          exists: true,
          isAccessible: true,
          metadata: {
            appName: 'TestApp',
            bundleId: 'com.test.app',
          },
        },
      ]);
    })
    .command(['locate', '--json'])
    .it('supports JSON output format', ({ stdout }) => {
      const output = JSON.parse(stdout);
      expect(output).toHaveProperty('status', 'success');
      expect(output).toHaveProperty('paths');
      expect(output.paths).toHaveLength(1);
      expect(output.paths[0]).toMatchObject({
        path: '/iCloud/apps/TestApp',
        type: 'app',
        score: 100,
      });
    });

  // Error handling tests
  test
    .stdout()
    .stderr()
    .do(() => {
      mockFindDrivePaths.mockRejectedValueOnce(new Error('Failed to find paths'));
    })
    .command(['locate'])
    .catch(error => {
      expect(error.message).toContain('Failed to find paths');
    })
    .it('handles errors gracefully');

  test
    .stdout()
    .do(() => {
      mockFindDrivePaths.mockResolvedValueOnce([]);
    })
    .command(['locate', '--detailed'])
    .it('displays appropriate message when no paths found', ({ stdout }) => {
      expect(stdout).toContain('No iCloud Drive paths found');
    });
});
