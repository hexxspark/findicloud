import {PathInfo} from '../types';

/**
 * 创建模拟的 iCloud 根路径
 */
export function createMockICloudRoot(): PathInfo {
  return {
    path: '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs',
    isAccessible: true,
    score: 100,
    exists: true,
    metadata: {
      source: {source: 'common'},
    },
  };
}

/**
 * 创建模拟的应用存储路径
 */
export function createMockAppPath(appName: string, appId: string): PathInfo {
  return {
    path: `/Users/testuser/Library/Mobile Documents/${appId}`,
    isAccessible: true,
    score: 80,
    exists: true,
    metadata: {
      appId,
      appName,
      source: {source: 'appStorage'},
    },
  };
}

/**
 * 创建一组标准的测试路径
 */
export function createStandardTestPaths(): PathInfo[] {
  return [
    createMockICloudRoot(),
    createMockAppPath('Notes', 'com~apple~Notes'),
    createMockAppPath('TestApp', 'com~testapp~TestApp'),
    {
      path: '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Documents',
      isAccessible: true,
      score: 90,
      exists: true,
      metadata: {
        source: {source: 'common'},
        type: 'directory',
      },
    },
    {
      path: '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Photos',
      isAccessible: true,
      score: 90,
      exists: true,
      metadata: {
        source: {source: 'common'},
        type: 'directory',
      },
    },
    {
      path: '/Users/testuser/Library/Mobile Documents/inaccessible',
      isAccessible: false,
      score: 50,
      exists: false,
      metadata: {
        source: {source: 'common'},
      },
    },
  ];
}
