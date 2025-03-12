/**
 * Windows adapter implementation
 * Handles Windows-specific file operations and path finding
 */

import {execSync} from 'child_process';
import * as fs from 'fs';
import {join} from 'path';

import {PathInfo, PathMetadata, PathSource} from '../types';
import {BaseOSAdapter} from './base-adapter';

export class WindowsAdapter extends BaseOSAdapter {
  async findPaths(): Promise<PathInfo[]> {
    try {
      // First try to find paths in common locations
      await this._findInCommonLocations();

      // Only try registry if no paths found
      await this._findInRegistry();

      // Then discover app storage paths in found root directories
      await this._discoverAppStoragePaths();

      return Array.from(this.pathMap.values())
        .sort((a, b) => b.score - a.score)
        .filter(info => info.score > 0);
    } catch (error: any) {
      console.debug('Error finding paths:', error);
      return [];
    }
  }

  private async _findInCommonLocations(): Promise<void> {
    const userProfile = process.env.USERPROFILE;
    if (!userProfile) {
      console.debug('USERPROFILE environment variable not found');
      return;
    }

    // Common locations to check
    const pathsToCheck = [
      // User profile locations
      join(userProfile, 'iCloudDrive'),
      join(userProfile, 'iCloud Drive'),

      // Root locations
      'C:\\iCloudDrive',
      'C:\\iCloud Drive',
      'C:\\iCloud\\iCloudDrive',

      // Other common locations
      ...this._getAvailableDrives().flatMap(drive => [
        `${drive}\\iCloudDrive`,
        `${drive}\\iCloud Drive`,
        `${drive}\\iCloud\\iCloudDrive`,
      ]),
    ];

    for (const path of pathsToCheck) {
      if (await this._isValidICloudPath(path)) {
        this._addPath(path, {source: 'commonPath'});
      }
    }
  }

  private async _isValidICloudPath(path: string): Promise<boolean> {
    try {
      if (!fs.existsSync(path)) return false;

      // Check if it's a directory
      const stats = fs.statSync(path);
      if (!stats.isDirectory()) return false;

      // Check for iCloud markers
      const contents = fs.readdirSync(path);
      return contents.some(item => item === '.icloud' || item === 'desktop.ini' || this.isAppStoragePath(item));
    } catch {
      return false;
    }
  }

  private async _findInRegistry(): Promise<void> {
    const regPaths = [
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\SyncRootManager',
      'HKEY_CURRENT_USER\\Software\\Apple Inc.\\iCloud',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\Apple Inc.\\iCloud',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Apple Inc.\\iCloud',
    ];

    for (const regPath of regPaths) {
      try {
        const cmd = `reg query "${regPath}" /ve 2>nul`;
        execSync(cmd, {stdio: 'ignore'});

        const output = execSync(`reg query "${regPath}" /s`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'],
        });

        this._parseRegistryOutput(output);
      } catch {
        // Silently skip if registry key doesn't exist
      }
    }
  }

  private _parseRegistryOutput(output: string): void {
    const lines = output.split('\r\n');
    for (const line of lines) {
      const match = line.trim().match(/REG_\w+\s+([A-Z]:\\[^"]+)/i);
      if (!match) continue;

      const path = match[1];
      if (path.toLowerCase().includes('icloud') && fs.existsSync(path)) {
        this._addPath(path, {source: 'registry'});
      }
    }
  }

  private isAppPath(path: string): boolean {
    return this.isAppStoragePath(path);
  }

  private async _discoverAppStoragePaths(): Promise<void> {
    const rootPaths = Array.from(this.pathMap.values()).filter(info => info.exists && info.isAccessible);

    for (const rootPath of rootPaths) {
      try {
        const entries = await fs.promises.readdir(rootPath.path, {withFileTypes: true});

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          if (this.isAppStoragePath(entry.name)) {
            const appPath = join(rootPath.path, entry.name);
            this._addPath(appPath, {
              source: 'appStorage',
              rootPath: rootPath.path,
            });
          }
        }
      } catch (error) {
        console.debug(`Error scanning root path ${rootPath.path}:`, error);
      }
    }
  }

  private _getAvailableDrives(): string[] {
    const drives: string[] = [];
    try {
      for (let i = 67; i <= 90; i++) {
        // C to Z
        const drive = String.fromCharCode(i) + ':';
        if (fs.existsSync(drive)) {
          drives.push(drive);
        }
      }
    } catch (error) {
      console.debug('Error getting available drives:', error);
    }
    return drives;
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
