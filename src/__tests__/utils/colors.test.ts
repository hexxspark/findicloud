import chalk from 'chalk';

import {PathInfo} from '../../types';
import colors from '../../utils/colors';

// Use Jest's spy functionality
jest.mock('chalk', () => {
  const originalChalk = jest.requireActual('chalk');
  return {
    ...originalChalk,
    green: jest.fn(text => `green:${text}`),
    red: jest.fn(text => `red:${text}`),
    yellow: jest.fn(text => `yellow:${text}`),
    blue: jest.fn(text => `blue:${text}`),
    dim: jest.fn(text => `dim:${text}`),
    bold: jest.fn(text => `bold:${text}`),
    cyan: jest.fn(text => `cyan:${text}`),
    magenta: jest.fn(text => `magenta:${text}`),
    gray: jest.fn(text => `gray:${text}`),
  };
});

describe('colors', () => {
  beforeEach(() => {
    // Clear all mock call records
    jest.clearAllMocks();
  });

  describe('basic colors', () => {
    it('should apply ANSI color codes in color mode', () => {
      colors.setColorMode(true);

      colors.success('test');
      expect(chalk.green).toHaveBeenCalledWith('test');

      colors.error('test');
      expect(chalk.red).toHaveBeenCalledWith('test');

      colors.warning('test');
      expect(chalk.yellow).toHaveBeenCalledWith('test');

      colors.info('test');
      expect(chalk.blue).toHaveBeenCalledWith('test');

      colors.dim('test');
      expect(chalk.dim).toHaveBeenCalledWith('test');

      colors.bold('test');
      expect(chalk.bold).toHaveBeenCalledWith('test');
    });

    it('should not apply ANSI color codes in no-color mode', () => {
      colors.setColorMode(false);

      expect(colors.success('test')).toBe('test');
      expect(chalk.green).not.toHaveBeenCalled();

      expect(colors.error('test')).toBe('test');
      expect(chalk.red).not.toHaveBeenCalled();

      expect(colors.warning('test')).toBe('test');
      expect(chalk.yellow).not.toHaveBeenCalled();

      expect(colors.info('test')).toBe('test');
      expect(chalk.blue).not.toHaveBeenCalled();

      expect(colors.dim('test')).toBe('test');
      expect(chalk.dim).not.toHaveBeenCalled();

      expect(colors.bold('test')).toBe('test');
      expect(chalk.bold).not.toHaveBeenCalled();
    });
  });

  describe('path formatting', () => {
    it('should format path info correctly in color mode', () => {
      colors.setColorMode(true);
      const pathInfo: PathInfo = {
        path: '/test/path',
        exists: true,
        isAccessible: true,
        score: 50,
        metadata: {
          appId: 'test.app',
          appName: 'Test App',
          bundleId: 'com.test.app',
          vendor: 'com.test',
        },
      };

      colors.formatPath(pathInfo);

      // Verify chalk methods were called
      expect(chalk.green).toHaveBeenCalled();
      expect(chalk.blue).toHaveBeenCalledWith('/test/path');
      expect(chalk.gray).toHaveBeenCalledWith('Test App');
    });

    it('should format path info correctly in no-color mode', () => {
      colors.setColorMode(false);
      const pathInfo: PathInfo = {
        path: '/test/path',
        exists: true,
        isAccessible: true,
        score: 50,
        metadata: {
          appId: 'test.app',
          appName: 'Test App',
          bundleId: 'com.test.app',
          vendor: 'com.test',
        },
      };

      const formatted = colors.formatPath(pathInfo);

      // In no-color mode, chalk methods should not be called
      expect(chalk.green).not.toHaveBeenCalled();
      expect(chalk.blue).not.toHaveBeenCalled();
      expect(chalk.gray).not.toHaveBeenCalled();

      // Verify output format
      expect(formatted).toBe(`${pathInfo.path} [${pathInfo.metadata.appName}]`);
    });
  });

  describe('progress formatting', () => {
    it('should format progress correctly in color mode', () => {
      colors.setColorMode(true);

      colors.formatProgress(5, 10, 'Processing');

      // Verify chalk methods were called
      expect(chalk.cyan).toHaveBeenCalled();
    });

    it('should format progress correctly in no-color mode', () => {
      colors.setColorMode(false);

      const formatted = colors.formatProgress(5, 10, 'Processing');

      // In no-color mode, chalk methods should not be called
      expect(chalk.cyan).not.toHaveBeenCalled();

      // Verify output format
      expect(formatted).toBe('[5/10] 50% Processing');
    });
  });
});
