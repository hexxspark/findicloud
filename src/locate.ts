import os from 'os';

import {MacPathFinder} from './platforms/mac';
import {WindowsPathFinder} from './platforms/win';
import {PathInfo, SearchOptions} from './types';

export class DriveLocator {
  private finder: MacPathFinder | WindowsPathFinder;
  private currentPlatform: NodeJS.Platform;

  // Singleton implementation
  private static instance: DriveLocator | null = null;
  private static platformOverride: NodeJS.Platform | undefined;

  // Obtain a singleton instance
  public static getInstance(platformOverride?: NodeJS.Platform): DriveLocator {
    // If a new platform override is provided and is different from the current one, reset the instance
    if (platformOverride !== undefined && platformOverride !== this.platformOverride) {
      this.reset();
      this.platformOverride = platformOverride;
    }

    if (!this.instance) {
      this.instance = new DriveLocator(this.platformOverride);
    }

    return this.instance;
  }

  // Reset singleton (mostly used for testing)
  public static reset(): void {
    this.instance = null;
    this.platformOverride = undefined;
  }

  constructor(platformOverride?: NodeJS.Platform) {
    this.currentPlatform = platformOverride || os.platform();

    if (this.currentPlatform === 'darwin') {
      this.finder = new MacPathFinder();
    } else if (this.currentPlatform === 'win32') {
      this.finder = new WindowsPathFinder();
    } else {
      throw new Error('Unsupported platform: ' + this.currentPlatform);
    }
  }

  async locate(options: SearchOptions = {}): Promise<PathInfo[]> {
    const paths = await this.finder.findPaths();
    return this._filterPaths(paths, options);
  }

  private _filterPaths(paths: PathInfo[], options: SearchOptions): PathInfo[] {
    let filtered = paths.filter(path => {
      if (!options.includeInaccessible && !path.isAccessible) {
        return false;
      }

      if (options.minScore && path.score < options.minScore) {
        return false;
      }

      return true;
    });

    if (options.appName) {
      filtered = this._findMatchingApps(options.appName, filtered);
    }

    return filtered;
  }

  private _findMatchingApps(pattern: string, paths: PathInfo[]): PathInfo[] {
    const searchTerms = pattern.toLowerCase().split(/\s+/);

    return paths
      .map(path => ({
        path,
        score: this._calculateMatchScore(searchTerms, path),
      }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(result => result.path);
  }

  private _calculateMatchScore(searchTerms: string[], path: PathInfo): number {
    let score = 0;
    const {appName, appId, bundleId} = path.metadata;
    const nameLower = appName?.toLowerCase() || '';
    const idLower = appId?.toLowerCase() || '';
    const bundleLower = bundleId?.toLowerCase() || '';

    for (const term of searchTerms) {
      if (nameLower === term) score += 100;
      else if (nameLower.includes(term)) score += 50;
      if (bundleLower.includes(term)) score += 30;
      if (idLower.includes(term)) score += 20;
    }

    return score;
  }
}

// Update the factory function
export function createDriveLocator(platformOverride?: NodeJS.Platform): DriveLocator {
  return DriveLocator.getInstance(platformOverride);
}

export async function findDrivePaths(options?: SearchOptions, platformOverride?: NodeJS.Platform): Promise<PathInfo[]> {
  if (process.platform !== 'darwin' && process.platform !== 'win32' && !platformOverride) {
    throw new Error('Unsupported platform: ' + process.platform);
  }
  const locator = createDriveLocator(platformOverride);
  return await locator.locate(options);
}
