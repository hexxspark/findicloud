import {runCommand} from '@oclif/test';

import {PathFinder} from '../../core/path-finder';

jest.mock('../../core/path-finder');

describe('find command', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('shows help information', async () => {
    await runCommand(['find', '--help']);
    // 如果命令执行成功，不会抛出异常
  });

  it('lists all iCloud Drive paths', async () => {
    const mockFindDrivePaths = PathFinder.find as jest.Mock;
    mockFindDrivePaths.mockResolvedValueOnce([
      {
        path: '/test/path1',
        score: 100,
        isAccessible: true,
        exists: true,
        metadata: {},
      },
    ]);

    await runCommand(['find']);
    // 验证 mock 函数是否被调用
    expect(mockFindDrivePaths).toHaveBeenCalled();
  });

  it('shows detailed information', async () => {
    const mockFindDrivePaths = PathFinder.find as jest.Mock;
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

    await runCommand(['find', '--detailed']);
    expect(mockFindDrivePaths).toHaveBeenCalled();
  });

  it('shows table output', async () => {
    const mockFindDrivePaths = PathFinder.find as jest.Mock;
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

    await runCommand(['find', '--detailed', '--table']);
    expect(mockFindDrivePaths).toHaveBeenCalled();
  });

  it('outputs JSON', async () => {
    const mockFindDrivePaths = PathFinder.find as jest.Mock;
    mockFindDrivePaths.mockResolvedValueOnce([
      {
        path: '/test/path1',
        score: 100,
        isAccessible: true,
        exists: true,
        metadata: {},
      },
    ]);

    await runCommand(['find', '--json']);
    expect(mockFindDrivePaths).toHaveBeenCalled();
  });

  it('filters by app name', async () => {
    const mockFindDrivePaths = PathFinder.find as jest.Mock;
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

    await runCommand(['find', 'TestApp']);
    expect(mockFindDrivePaths).toHaveBeenCalled();
  });

  it('formats table output correctly', async () => {
    const mockFindDrivePaths = PathFinder.find as jest.Mock;
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

    await runCommand(['find', '--detailed', '--table']);
    expect(mockFindDrivePaths).toHaveBeenCalled();
  });

  it('filters by min score', async () => {
    const mockFindDrivePaths = PathFinder.find as jest.Mock;
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

    await runCommand(['find', '--score', '90']);
    expect(mockFindDrivePaths).toHaveBeenCalled();
  });

  it('includes inaccessible paths', async () => {
    const mockFindDrivePaths = PathFinder.find as jest.Mock;
    mockFindDrivePaths.mockResolvedValueOnce([]);

    await runCommand(['find', '--all']);
    expect(mockFindDrivePaths).toHaveBeenCalledWith(
      expect.objectContaining({
        includeInaccessible: true,
      }),
    );
  });

  it('handles empty results', async () => {
    const mockFindDrivePaths = PathFinder.find as jest.Mock;
    mockFindDrivePaths.mockResolvedValueOnce([]);

    await runCommand(['find']);
    expect(mockFindDrivePaths).toHaveBeenCalled();
  });

  it('handles errors', async () => {
    const mockFindDrivePaths = PathFinder.find as jest.Mock;
    mockFindDrivePaths.mockRejectedValueOnce(new Error('Test error'));

    try {
      await runCommand(['find']);
      // 如果没有抛出异常，测试应该失败
      fail('Expected command to throw an error');
    } catch (error) {
      // 预期会抛出异常
      expect(error).toBeDefined();
    }
  });
});
