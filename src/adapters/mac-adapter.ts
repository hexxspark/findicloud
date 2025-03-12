/**
 * Mac adapter implementation
 * Handles Mac-specific file operations and path finding
 */

import * as fs from 'fs';
import * as os from 'os';
import {join} from 'path';

import {PathInfo, PathMetadata, PathSource} from '../types';
import {BaseOSAdapter} from './base-adapter';

/**
 * Mac-specific adapter for finding iCloud paths
 */
export class MacAdapter extends BaseOSAdapter {
  private readonly MOBILE_DOCUMENTS_PATH = 'Library/Mobile Documents';
  private readonly ICLOUD_ROOT_DIR = 'com.apple.CloudDocs';

  /**
   * Find iCloud paths on macOS
   *
   * @returns Promise resolving to array of path info objects
   */
  async findPaths(): Promise<PathInfo[]> {
    try {
      const homePath = os.homedir();
      const mobileDocsPath = join(homePath, this.MOBILE_DOCUMENTS_PATH);
      const iCloudPath = join(mobileDocsPath, this.ICLOUD_ROOT_DIR);

      this._addPath(iCloudPath, {source: 'common'});

      // Discover app storage paths
      await this._discoverAppStoragePaths(mobileDocsPath);

      return Array.from(this.pathMap.values())
        .sort((a, b) => b.score - a.score)
        .filter(info => info.score > 0);
    } catch (error: any) {
      console.debug('Error finding paths:', error);
      return [];
    }
  }

  /**
   * Discover app-specific storage paths in the Mobile Documents directory
   *
   * @param mobileDocsPath Path to the Mobile Documents directory
   */
  private async _discoverAppStoragePaths(mobileDocsPath: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(mobileDocsPath, {withFileTypes: true});

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        if (this.isAppStoragePath(entry.name)) {
          const appPath = join(mobileDocsPath, entry.name);
          this._addPath(appPath, {source: 'appStorage'});
        }
      }
    } catch (error) {
      console.debug(`Error scanning mobile docs path ${mobileDocsPath}:`, error);
    }
  }

  /**
   * Enrich path metadata with Mac-specific information
   *
   * @param metadata Base metadata
   * @param path Path to enrich metadata for
   * @param source Source information
   * @returns Enriched metadata
   */
  protected _enrichMetadata(metadata: PathMetadata, path: string, source: PathSource): PathMetadata {
    const enriched: PathMetadata = {
      ...metadata,
      source,
    };

    const {appId, appName, bundleId, vendor} = this.parseAppName(path);
    Object.assign(enriched, {appId, appName, bundleId, vendor});

    return enriched;
  }
}
