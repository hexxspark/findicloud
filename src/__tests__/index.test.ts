import {findICloudDrivePaths} from '../index';
import {PathType} from '../types';

describe('Index Exports', () => {
  it('should export findICloudDrivePaths function', () => {
    expect(typeof findICloudDrivePaths).toBe('function');
  });

  it('should handle unsupported platforms', async () => {
    // Mock platform as Linux
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true,
    });

    try {
      await expect(findICloudDrivePaths()).rejects.toThrow('Unsupported platform');
    } finally {
      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    }
  });

  it('should handle search options', async () => {
    // Mock platform as Windows for testing
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });

    try {
      const result = await findICloudDrivePaths({
        types: [PathType.ROOT],
        includeInaccessible: false,
        minScore: 10,
        appNamePattern: 'test',
      });

      expect(Array.isArray(result)).toBeTruthy();
    } finally {
      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    }
  });
});
