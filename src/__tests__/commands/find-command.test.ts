import {test} from '@oclif/test';

import {findiCloudPaths} from '../../find';

jest.mock('../../find');

describe('find command', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test.stdout().command(['find', '--help']).exit(0).it('shows help information');

  test
    .do(() => {
      const mockFindDrivePaths = findiCloudPaths as jest.Mock;
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
    .command(['find'])
    .it('lists all iCloud Drive paths');

  test
    .do(() => {
      const mockFindDrivePaths = findiCloudPaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/test/path1',
          score: 100,
          isAccessible: true,
          exists: true,
          metadata: {
            appName: 'Test App',
            bundleId: 'com.test.app',
          },
        },
      ]);
    })
    .stdout()
    .command(['find', '--detailed'])
    .it('shows detailed information');

  test
    .do(() => {
      const mockFindDrivePaths = findiCloudPaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/test/path1',
          score: 100,
          isAccessible: true,
          exists: true,
          metadata: {
            appName: 'Test App',
            bundleId: 'com.test.app',
          },
        },
      ]);
    })
    .stdout()
    .command(['find', '--detailed', '--table'])
    .it('shows table output');

  test
    .do(() => {
      const mockFindDrivePaths = findiCloudPaths as jest.Mock;
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
    .command(['find', '--json'])
    .it('outputs JSON');

  test
    .do(() => {
      const mockFindDrivePaths = findiCloudPaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/test/path1',
          score: 100,
          isAccessible: true,
          exists: true,
          metadata: {
            appName: 'TestApp',
          },
        },
      ]);
    })
    .stdout()
    .command(['find', 'TestApp'])
    .it('filters by app name');

  test
    .do(() => {
      const mockFindDrivePaths = findiCloudPaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/test/path1',
          score: 100,
          isAccessible: true,
          exists: true,
          metadata: {
            appName: 'Test App',
            bundleId: 'com.test.app',
            contents: ['file1', 'file2'],
          },
        },
      ]);
    })
    .stdout()
    .command(['find', '--detailed', '--table'])
    .it('formats table output correctly');

  test
    .do(() => {
      const mockFindDrivePaths = findiCloudPaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([
        {
          path: '/test/path1',
          score: 100,
          isAccessible: true,
          exists: true,
          metadata: {
            appName: 'Test App',
            bundleId: 'com.test.app',
            contents: ['file1', 'file2'],
          },
        },
      ]);
    })
    .stdout()
    .command(['find', '--score', '90'])
    .it('filters by min score');

  test
    .do(() => {
      const mockFindDrivePaths = findiCloudPaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([]);
    })
    .stdout()
    .command(['find', '--all'])
    .it('includes inaccessible paths');

  test
    .do(() => {
      const mockFindDrivePaths = findiCloudPaths as jest.Mock;
      mockFindDrivePaths.mockResolvedValueOnce([]);
    })
    .stdout()
    .command(['find'])
    .it('handles empty results');

  test
    .do(() => {
      const mockFindDrivePaths = findiCloudPaths as jest.Mock;
      mockFindDrivePaths.mockRejectedValueOnce(new Error('Test error'));
    })
    .stdout()
    .stderr()
    .command(['find'])
    .exit(1)
    .it('handles errors');
});
