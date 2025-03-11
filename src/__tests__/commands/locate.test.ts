import {test} from '@oclif/test';

import {findDrivePaths} from '../../locate';

jest.mock('../../locate');

describe('locate command', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test.stdout().command(['locate', '--help']).exit(0).it('shows help information');

  test
    .do(() => {
      const mockFindDrivePaths = findDrivePaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/test/path1',
          score: 100,
          isAccessible: true,
          exists: true,
          metadata: {},
        },
      ]);
    })
    .stdout()
    .command(['locate'])
    .it('lists all iCloud Drive paths');

  test
    .do(() => {
      const mockFindDrivePaths = findDrivePaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/test/path1',
          score: 100,
          isAccessible: true,
          exists: true,
          metadata: {
            appName: 'TestApp',
            bundleId: 'com.test.app',
          },
        },
      ]);
    })
    .stdout()
    .command(['locate', '--detailed'])
    .it('shows detailed path information');

  test
    .do(() => {
      const mockFindDrivePaths = findDrivePaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/test/path1',
          score: 100,
          isAccessible: true,
          exists: true,
          metadata: {
            appName: 'TestApp',
            bundleId: 'com.test.app',
          },
        },
        {
          path: '/test/path2',
          score: 90,
          isAccessible: false,
          exists: true,
          metadata: {},
        },
      ]);
    })
    .stdout()
    .command(['locate', '--detailed', '--table'])
    .it('shows path information in table format');

  test
    .do(() => {
      const mockFindDrivePaths = findDrivePaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/test/path1',
          score: 100,
          isAccessible: true,
          exists: true,
          metadata: {
            appName: 'TestApp',
            bundleId: 'com.test.app',
          },
        },
      ]);
    })
    .stdout()
    .command(['locate', '--json'])
    .it('outputs in JSON format');

  test
    .do(() => {
      const mockFindDrivePaths = findDrivePaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/test/path1',
          score: 100,
          isAccessible: true,
          exists: true,
          metadata: {
            appName: 'TestApp',
            bundleId: 'com.test.app',
          },
        },
      ]);
    })
    .stdout()
    .command(['locate', 'TestApp'])
    .it('filters paths by app name');

  test
    .do(() => {
      const mockFindDrivePaths = findDrivePaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/test/path1',
          score: 100,
          isAccessible: true,
          exists: true,
          metadata: {},
        },
      ]);
    })
    .stdout()
    .command(['locate', '--min-score', '90'])
    .it('filters paths by minimum score');

  test
    .do(() => {
      const mockFindDrivePaths = findDrivePaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/test/path1',
          score: 100,
          isAccessible: false,
          exists: true,
          metadata: {},
        },
      ]);
    })
    .stdout()
    .command(['locate', '--include-inaccessible'])
    .it('includes inaccessible paths');

  test
    .do(() => {
      const mockFindDrivePaths = findDrivePaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([]);
    })
    .stdout()
    .command(['locate'])
    .it('handles no paths found');

  test
    .do(() => {
      const mockFindDrivePaths = findDrivePaths as jest.Mock;
      mockFindDrivePaths.mockRejectedValueOnce(new Error('Test error'));
    })
    .stdout()
    .command(['locate'])
    .exit(2)
    .it('handles errors');

  test
    .do(() => {
      const mockFindDrivePaths = findDrivePaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/test/path1',
          score: 100,
          isAccessible: true,
          exists: true,
          metadata: {
            appName: 'VeryLongAppName'.repeat(10),
            bundleId: 'com.test.verylongbundleid'.repeat(10),
          },
        },
      ]);
    })
    .stdout()
    .command(['locate', '--detailed', '--table'])
    .it('handles long app names and bundle IDs in table format');
});
