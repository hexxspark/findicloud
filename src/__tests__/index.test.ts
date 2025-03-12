import {PathFinder} from '../core/path-finder';

describe('Index Exports', () => {
  it('should export PathFinder.find function', () => {
    expect(typeof PathFinder.find).toBe('function');
  });

  it('should handle unsupported platforms', async () => {
    // Save original platform
    const originalPlatform = process.platform;

    try {
      // Test with unsupported platform
      await expect(PathFinder.find({}, 'linux' as NodeJS.Platform)).rejects.toThrow('Unsupported platform');
    } finally {
      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    }
  });

  it('should handle search options', async () => {
    // Reset PathFinder instance to ensure clean state
    PathFinder.reset();

    // Mock platform as Windows for testing
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });

    try {
      const result = await PathFinder.find(
        {
          includeInaccessible: false,
          minScore: 10,
          appName: 'test',
        },
        'win32',
      ); // Explicitly pass platform override

      expect(Array.isArray(result)).toBeTruthy();
    } finally {
      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
      // Reset PathFinder instance after test
      PathFinder.reset();
    }
  });
});
