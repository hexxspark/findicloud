import {execSync} from 'child_process';
import * as fs from 'fs';
import {homedir} from 'os';
import {join} from 'path';

import {BasePathFinder} from '../base';
import {PathInfo, PathMetadata, PathSource, PathType} from '../types';

export class MacPathFinder extends BasePathFinder {
  private readonly MOBILE_DOCUMENTS_PATH = 'Library/Mobile Documents';
  private readonly ICLOUD_ROOT_DIR = 'com~apple~CloudDocs';

  async findPaths(): Promise<PathInfo[]> {
    try {
      await this._findUserPaths();
      await this._checkContainerPaths();

      return Array.from(this.pathMap.values())
        .sort((a, b) => b.score - a.score)
        .filter(info => info.score > 0);
    } catch (error) {
      throw new Error(`Failed to find iCloud paths: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  protected _classifyPath(path: string): PathType {
    const basename = path.split('/').pop() || '';

    if (basename === this.ICLOUD_ROOT_DIR) {
      return PathType.ROOT;
    }

    if (this.isAppPath(path)) {
      return PathType.APP;
    }

    if (basename.toLowerCase().includes('photos')) {
      return PathType.PHOTOS;
    }

    if (basename.toLowerCase().includes('documents')) {
      return PathType.DOCS;
    }

    return PathType.OTHER;
  }

  private isAppPath(path: string): boolean {
    return this.isAppStoragePath(path);
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

  private async _findUserPaths(): Promise<void> {
    try {
      const currentHome = homedir();
      if (currentHome) {
        await this._checkUserPath(currentHome);
      }

      const users = await this._getSystemUsers();
      for (const user of users) {
        const userHome = `/Users/${user}`;
        if (userHome !== currentHome && fs.existsSync(userHome)) {
          // Check if user home exists
          const mobileDocsPath = join(userHome, this.MOBILE_DOCUMENTS_PATH);
          if (fs.existsSync(mobileDocsPath)) {
            // Check if Mobile Documents path exists
            await this._checkUserPath(userHome);
          }
        }
      }

      const sharedPath = '/Users/Shared/CloudDocs';
      if (fs.existsSync(sharedPath)) {
        this._addPath(sharedPath, {
          source: 'shared',
          directoryType: 'shared',
        });
      }
    } catch (error) {
      console.debug('Error finding user paths:', error);
    }
  }

  private async _getSystemUsers(): Promise<string[]> {
    try {
      const cmd = 'dscl . -list /Users | grep -v "^_"';
      const output = execSync(cmd, {encoding: 'utf8'});
      return (output || '').trim().split('\n').filter(Boolean);
    } catch (error) {
      console.debug('Error getting system users:', error);
      return [];
    }
  }

  private async _checkUserPath(userHome: string): Promise<void> {
    try {
      const mobileDocs: string = join(userHome, this.MOBILE_DOCUMENTS_PATH);
      const entries: fs.Dirent[] = await fs.promises.readdir(mobileDocs, {withFileTypes: true});
      const username: string = userHome.split('/').pop() || '';

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const fullPath: string = join(mobileDocs, entry.name);

        if (entry.name === this.ICLOUD_ROOT_DIR) {
          this._addPath(fullPath, {
            source: 'userDirectory',
            user: username,
            directoryType: 'root',
          });

          // Check for standard directories
          const standardDirs = ['Documents', 'Photos'];
          for (const dir of standardDirs) {
            const dirPath = join(fullPath, dir);
            if (fs.existsSync(dirPath)) {
              this._addPath(dirPath, {
                source: 'userDirectory',
                user: username,
                directoryType: dir.toLowerCase(),
              });
            }
          }
        } else if (this.isAppPath(entry.name)) {
          this._addPath(fullPath, {
            source: 'userDirectory',
            user: username,
            directoryType: 'appStorage',
          });
        }
      }
    } catch (error) {
      console.debug(`Error checking user path ${userHome}:`, error);
    }
  }

  private async _checkContainerPaths(): Promise<void> {
    const containersPath = join(homedir(), 'Library/Containers');

    try {
      const containers = await fs.promises.readdir(containersPath, {withFileTypes: true});

      for (const container of containers) {
        if (container.isDirectory() && (container.name.includes('iCloud') || container.name.includes('CloudDocs'))) {
          const dataPath = join(containersPath, container.name, 'Data/Library/Mobile Documents');
          this._addPath(dataPath, {
            source: 'container',
            container: container.name,
            type: 'application',
          });
        }
      }
    } catch {}
  }
}
