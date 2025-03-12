import {OSAdapter} from '../adapter';
import {getAdapter} from '../adapters/adapter-factory';
import {PathInfo, SearchOptions} from '../types';

// 导入扩展的平台类型
type PlatformWithMock = NodeJS.Platform | 'mock';

/**
 * PathFinder class for locating iCloud paths on different platforms
 */
export class PathFinder {
  private adapter: OSAdapter;

  // Singleton implementation
  private static instance: PathFinder | null = null;
  private static platformOverride: PlatformWithMock | undefined;

  /**
   * Get a singleton instance of PathFinder
   *
   * @param platformOverride Override the platform detection (useful for testing)
   * @returns PathFinder instance
   */
  public static getInstance(platformOverride?: PlatformWithMock): PathFinder {
    // If a new platform override is provided and is different from the current one, reset the instance
    if (platformOverride !== undefined && platformOverride !== this.platformOverride) {
      this.reset();
      this.platformOverride = platformOverride;
    }

    if (!this.instance) {
      this.instance = new PathFinder(this.platformOverride);
    }

    return this.instance;
  }

  /**
   * Reset the singleton instance
   * Primarily used for testing
   */
  public static reset(): void {
    this.instance = null;
    this.platformOverride = undefined;
  }

  /**
   * Find iCloud paths based on search options
   *
   * @param options Search options to filter paths
   * @param platformOverride Override the platform detection (useful for testing)
   * @returns Promise resolving to array of path info objects
   */
  static async find(options?: SearchOptions, platformOverride?: PlatformWithMock): Promise<PathInfo[]> {
    const finder = PathFinder.getInstance(platformOverride);
    return await finder.find(options);
  }

  /**
   * Create a new PathFinder instance
   *
   * @param platformOverride Override the platform detection (useful for testing)
   */
  constructor(platformOverride?: PlatformWithMock) {
    this.adapter = getAdapter(platformOverride);
  }

  /**
   * Find iCloud paths based on search options
   *
   * @param options Search options to filter paths
   * @returns Promise resolving to array of path info objects
   */
  async find(options: SearchOptions = {}): Promise<PathInfo[]> {
    const paths = await this.adapter.findPaths();
    return this._filterPaths(paths, options);
  }

  /**
   * Filter paths based on search options
   *
   * @param paths Array of path info objects
   * @param options Search options to filter paths
   * @returns Filtered array of path info objects
   */
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

  /**
   * Find paths matching the app name pattern
   *
   * @param pattern App name pattern to match
   * @param paths Array of path info objects
   * @returns Filtered and sorted array of path info objects
   */
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

  /**
   * Calculate match score for a path against search terms
   *
   * @param searchTerms Array of search terms
   * @param path Path info object
   * @returns Match score (higher is better)
   */
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
