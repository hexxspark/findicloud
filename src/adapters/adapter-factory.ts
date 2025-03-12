/**
 * Adapter factory
 * Returns the appropriate adapter based on the current platform
 */

import * as os from 'os';

import {OSAdapter} from '../adapter';
import {MacAdapter} from './mac-adapter';
import {MockAdapter} from './mock-adapter';
import {WindowsAdapter} from './win-adapter';

// 导入扩展的平台类型
type PlatformWithMock = NodeJS.Platform | 'mock';

/**
 * Get the appropriate adapter for the current platform
 * @param platformOverride Override the platform detection (useful for testing)
 * @returns The appropriate adapter for the current platform
 * @throws Error if the platform is not supported
 */
export function getAdapter(platformOverride?: PlatformWithMock): OSAdapter {
  const platform = platformOverride || os.platform();

  switch (platform) {
    case 'darwin':
      return new MacAdapter();
    case 'win32':
      return new WindowsAdapter();
    case 'mock':
      return new MockAdapter();
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
