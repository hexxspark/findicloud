import {platform} from 'os';

import {MacPathFinder} from './platforms/mac';
import {WindowsPathFinder} from './platforms/win';
import {PathInfo} from './types';

export class ICloudDriveFinder {
  private finder: MacPathFinder | WindowsPathFinder;

  constructor() {
    const osPlatform = platform();

    if (osPlatform === 'darwin') {
      this.finder = new MacPathFinder();
    } else if (osPlatform === 'win32') {
      this.finder = new WindowsPathFinder();
    } else {
      throw new Error('Unsupported platform: ' + osPlatform);
    }
  }

  async findPaths(): Promise<PathInfo[]> {
    return await this.finder.findPaths();
  }
}

export const iCloudDriveFinder = new ICloudDriveFinder();

/**
 * Find iCloud Drive paths.
 */
export async function findICloudPaths(): Promise<PathInfo[]> {
  return await iCloudDriveFinder.findPaths();
}
