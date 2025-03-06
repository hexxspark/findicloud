import os from 'os';

import {MacPathFinder} from './platforms/mac';
import {WindowsPathFinder} from './platforms/win';
import {PathInfo, PathType, SearchOptions} from './types';

export class DriveLister {
  private finder: MacPathFinder | WindowsPathFinder;
  private currentPlatform: string;

  constructor() {
    this.currentPlatform = os.platform();

    if (this.currentPlatform === 'darwin') {
      this.finder = new MacPathFinder();
    } else if (this.currentPlatform === 'win32') {
      this.finder = new WindowsPathFinder();
    } else {
      throw new Error('Unsupported platform: ' + this.currentPlatform);
    }
  }

  async findPaths(options?: SearchOptions): Promise<PathInfo[]> {
    const defaultOptions: SearchOptions = {
      types: Object.values(PathType),
      includeInaccessible: false,
      minScore: 0,
    };

    const finalOptions = {...defaultOptions, ...options};
    const paths = await this.finder.findPaths();

    return this._filterPaths(paths, finalOptions);
  }

  private _filterPaths(paths: PathInfo[], options: SearchOptions): PathInfo[] {
    let filtered = paths.filter(path => {
      if (!options.includeInaccessible && !path.isAccessible) {
        return false;
      }

      if (options.minScore && path.score < options.minScore) {
        return false;
      }

      if (options.types && !options.types.includes(path.type)) {
        return false;
      }

      return true;
    });

    if (options.appNamePattern) {
      filtered = this._findMatchingApps(options.appNamePattern, filtered);
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

export const iCloudDriveLister = new DriveLister();

export async function findDrivePaths(options?: SearchOptions): Promise<PathInfo[]> {
  if (process.platform !== 'darwin' && process.platform !== 'win32') {
    throw new Error('Unsupported platform: ' + process.platform);
  }
  return await iCloudDriveLister.findPaths(options);
}
