import {execSync} from 'child_process';
import * as fs from 'fs'; // 导入 fs 模块
import {homedir} from 'os';
import {join} from 'path';

import {BasePathFinder} from '../base'; // 确保导入路径正确
import {PathInfo} from '../types';

export class MacPathFinder extends BasePathFinder {
  async findPaths(): Promise<PathInfo[]> {
    try {
      await this._findInDefaultLocations();
      await this._findInUserDirectories();
      await this._checkContainerPaths();

      return Array.from(this.pathMap.values())
        .sort((a, b) => b.score - a.score)
        .filter(info => info.score > 0);
    } catch (error) {
      throw new Error(`Failed to find iCloud paths: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async _findInDefaultLocations(): Promise<void> {
    const home = homedir();

    const defaultPaths = [
      join(home, 'Library/Mobile Documents/com~apple~CloudDocs'),
      join(home, 'Library/Mobile Documents/com~apple~CloudDocs/Documents'),
      '/Users/Shared/CloudDocs',
    ];

    for (const path of defaultPaths) {
      this._addPath(path, {source: 'default'});
    }
  }

  private async _findInUserDirectories(): Promise<void> {
    try {
      const usersOutput = execSync('dscl . -list /Users | grep -v "^_"', {encoding: 'utf8'}).trim().split('\n');

      for (const user of usersOutput) {
        try {
          const userPath = `/Users/${user}/Library/Mobile Documents`;
          const entries = await fs.promises.readdir(userPath, {withFileTypes: true});

          for (const entry of entries) {
            if (entry.isDirectory() && (entry.name === 'com~apple~CloudDocs' || entry.name.includes('iCloud'))) {
              this._addPath(join(userPath, entry.name), {
                source: 'userDirectory',
                user,
                directoryType: entry.name,
              });
            }
          }
        } catch {
          // Skip inaccessible user directories
        }
      }
    } catch {
      // Skip if user listing fails
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
    } catch {
      // Skip if containers directory is inaccessible
    }
  }
}
