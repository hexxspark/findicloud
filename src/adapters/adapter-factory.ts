/**
 * Adapter factory
 * Returns the appropriate adapter based on the current platform
 */

import * as os from 'os';

import {OSAdapter} from '../adapter';
import {MacAdapter} from './mac-adapter';
import {WindowsAdapter} from './win-adapter';

/**
 * Get the appropriate adapter for the current platform
 * @param platformOverride Override the platform detection (useful for testing)
 * @returns The appropriate adapter for the current platform
 * @throws Error if the platform is not supported
 */
export function getAdapter(platformOverride?: NodeJS.Platform): OSAdapter {
  const platform = platformOverride || os.platform();

  switch (platform) {
    case 'darwin':
      return new MacAdapter();
    case 'win32':
      return new WindowsAdapter();
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
