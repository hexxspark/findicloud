import {OSAdapter} from '../adapter';
import {getAdapter} from '../adapters/adapter-factory';
import {PathInfo, SearchOptions} from '../types';

export class PathFinder {
  private adapter: OSAdapter;

  // Singleton implementation
  private static instance: PathFinder | null = null;
  private static platformOverride: NodeJS.Platform | undefined;

  // Obtain a singleton instance
  public static getInstance(platformOverride?: NodeJS.Platform): PathFinder {
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

  // Reset singleton (mostly used for testing)
  public static reset(): void {
    this.instance = null;
    this.platformOverride = undefined;
  }

  static async find(options?: SearchOptions, platformOverride?: NodeJS.Platform): Promise<PathInfo[]> {
    const finder = PathFinder.getInstance(platformOverride);
    return await finder.find(options);
  }

  constructor(platformOverride?: NodeJS.Platform) {
    this.adapter = getAdapter(platformOverride);
  }

  async find(options: SearchOptions = {}): Promise<PathInfo[]> {
    const paths = await this.adapter.findPaths();
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

  /**
   * Find paths that match the given app name pattern
   * @param pattern App name pattern to match
   * @param paths List of paths to filter
   * @returns Filtered and sorted list of paths that match the pattern
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
   * Calculate a match score for a path against search terms
   * @param searchTerms List of search terms to match
   * @param path Path info to score
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
