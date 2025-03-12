import {confirm} from '@inquirer/prompts';
import {runCommand} from '@oclif/test';

import {FileCopier} from '../../core/file-copier';

// Mock dependencies
jest.mock('@inquirer/prompts', () => ({
  confirm: jest.fn(),
}));

// Mock FileCopier
jest.mock('../../core/file-copier', () => {
  const mockCopy = jest.fn();
  return {
    FileCopier: jest.fn().mockImplementation(() => ({
      copy: mockCopy,
    })),
    CopyResult: jest.requireActual('../../core/file-copier').CopyResult,
  };
});

describe('copy command', () => {
  // 获取 mock 实例的 copy 方法
  const mockCopy = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    (confirm as jest.Mock).mockResolvedValue(true);

    // 重置 FileCopier 构造函数的 mock 实现
    (FileCopier as unknown as jest.Mock).mockImplementation(() => ({
      copy: mockCopy,
    }));

    // 设置默认的 mock 实现
    mockCopy.mockResolvedValue({
      success: true,
      targetPath: '/icloud/docs',
      copiedFiles: ['file1.txt'],
      failedFiles: [],
      errors: [],
    });
  });

  it('shows help information', async () => {
    await runCommand(['copy', '--help']);
    // 如果命令执行成功，不会抛出异常
  });

  it('copies files to documents', async () => {
    mockCopy.mockResolvedValueOnce({
      success: true,
      targetPath: '/icloud/docs',
      copiedFiles: ['file1.txt'],
      failedFiles: [],
      errors: [],
    });

    await runCommand(['copy', './documents', 'docs']);
    expect(mockCopy).toHaveBeenCalled();
  });

  it('copies files to specific app', async () => {
    mockCopy.mockResolvedValueOnce({
      success: true,
      targetPath: '/icloud/apps/Notes',
      copiedFiles: ['note1.txt'],
      failedFiles: [],
      errors: [],
    });

    await runCommand(['copy', './notes', 'Notes']);
    expect(mockCopy).toHaveBeenCalled();
  });

  it('supports dry run mode', async () => {
    mockCopy.mockImplementation((source, targetOrOptions, maybeOptions) => {
      // 检查是否传递了 dry-run 选项
      if (typeof targetOrOptions === 'string' && maybeOptions && maybeOptions.dryRun) {
        // 在 dry-run 模式下，不应该执行实际的复制操作
        return Promise.resolve({
          success: true,
          targetPath: '/icloud/docs',
          copiedFiles: ['/test/source/file1.txt'],
          failedFiles: [],
          errors: [],
        });
      }

      // 这里不应该被调用，因为我们期望 dry-run 模式下不执行复制
      return Promise.resolve({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: [],
        failedFiles: [],
        errors: [],
      });
    });

    await runCommand(['copy', './documents', 'docs', '--dry-run']);
    expect(mockCopy).toHaveBeenCalled();
    // 验证传递给 copy 方法的参数中包含 dry-run 选项
    expect(mockCopy.mock.calls[0][2]).toHaveProperty('dryRun', true);
  });

  it('supports recursive copy', async () => {
    mockCopy.mockImplementation((source, targetOrOptions, maybeOptions) => {
      // 检查是否传递了 recursive 选项
      if (typeof targetOrOptions === 'string' && maybeOptions) {
        expect(maybeOptions.recursive).toBe(true);
      }

      return Promise.resolve({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt', 'subdir/file2.txt'],
        failedFiles: [],
        errors: [],
      });
    });

    await runCommand(['copy', './documents', 'docs', '-r']);
    expect(mockCopy).toHaveBeenCalled();
    // 验证传递给 copy 方法的参数中包含 recursive 选项
    expect(mockCopy.mock.calls[0][2]).toHaveProperty('recursive', true);
  });

  it('supports file pattern matching', async () => {
    mockCopy.mockImplementation((source, targetOrOptions, maybeOptions) => {
      // 检查是否传递了 pattern 选项
      if (typeof targetOrOptions === 'string' && maybeOptions) {
        expect(maybeOptions.pattern).toBe('*.txt');
      }

      return Promise.resolve({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt', 'file2.txt'],
        failedFiles: [],
        errors: [],
      });
    });

    await runCommand(['copy', './documents', 'docs', '-p', '*.txt']);
    expect(mockCopy).toHaveBeenCalled();
    // 验证传递给 copy 方法的参数中包含 pattern 选项
    expect(mockCopy.mock.calls[0][2]).toHaveProperty('pattern', '*.txt');
  });

  it('handles copy operation failure', async () => {
    mockCopy.mockResolvedValueOnce({
      success: false,
      targetPath: '/icloud/docs',
      copiedFiles: [],
      failedFiles: ['file1.txt'],
      errors: [new Error('Permission denied')],
    });

    try {
      await runCommand(['copy', './documents', 'docs']);
      fail('Expected command to throw an error');
    } catch (error) {
      // 预期会抛出异常
      expect(error).toBeDefined();
    }
  });

  // New test cases for interactive and detailed output features
  it('displays detailed file information', async () => {
    mockCopy.mockImplementation((source, targetOrOptions, maybeOptions) => {
      // 检查是否传递了 detailed 选项
      if (typeof targetOrOptions === 'string' && maybeOptions) {
        expect(maybeOptions.detailed).toBe(true);
      }

      return Promise.resolve({
        success: true,
        targetPath: '/icloud/docs',
        copiedFiles: ['file1.txt'],
        failedFiles: [],
        errors: [],
      });
    });

    await runCommand(['copy', './documents', 'docs', '--detailed']);
    expect(mockCopy).toHaveBeenCalled();
    // 验证传递给 copy 方法的参数中包含 detailed 选项
    expect(mockCopy.mock.calls[0][2]).toHaveProperty('detailed', true);
  });

  // 继续其他测试...
});
