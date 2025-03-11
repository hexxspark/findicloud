import * as fs from 'fs';
import * as os from 'os';
import {join} from 'path';

import {BasePathFinder} from '../base';
import {PathInfo, PathMetadata, PathSource} from '../types';

export class MacPathFinder extends BasePathFinder {
  private readonly MOBILE_DOCUMENTS_PATH = 'Library/Mobile Documents';
  private readonly ICLOUD_ROOT_DIR = 'com.apple.CloudDocs';

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
