/**
 * Windows adapter implementation
 * Handles Windows-specific file operations and path finding
 */

import {execSync} from 'child_process';
import * as fs from 'fs';
import * as pathModule from 'path';
import {join} from 'path';

import {PathInfo, PathMetadata, PathSource} from '../types';
import {BaseOSAdapter} from './base-adapter';

/**
 * Windows-specific adapter for finding iCloud paths
 */
export class WindowsAdapter extends BaseOSAdapter {
  /**
   * Find iCloud paths on Windows
   *
   * @returns Promise resolving to array of path info objects
   */
  async findPaths(): Promise<PathInfo[]> {
    try {
      // First try to find paths in common locations
      await this._findInCommonLocations();

      // Then try registry
      await this._findInRegistry();

      // Then discover app storage paths in found root directories
      await this._discoverAppStoragePaths();

      // Add any found paths to the map
      const paths = Array.from(this.pathMap.values())
        .sort((a, b) => b.score - a.score)
        .filter(info => info.score > 0);

      // If no paths found, try to use the default path
      if (paths.length === 0) {
        const userProfile = process.env.USERPROFILE;
        if (userProfile) {
          const defaultPath = join(userProfile, 'iCloudDrive');
          this._addPath(defaultPath, {source: 'default'});
          return Array.from(this.pathMap.values());
        }
      }

      return paths;
    } catch (error: any) {
      console.debug('Error finding paths:', error);
      return [];
    }
  }

  /**
   * Find iCloud paths in common file system locations
   */
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
      join(userProfile, 'iCloud'),

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
      const normalizedPath = pathModule.normalize(path);
      if (await this._isValidICloudPath(normalizedPath)) {
        this._addPath(normalizedPath, {source: 'commonPath'});
      }
    }
  }

  /**
   * Check if a path is a valid iCloud directory
   */
  private async _isValidICloudPath(path: string): Promise<boolean> {
    try {
      if (!fs.existsSync(path)) return false;

      const stats = fs.statSync(path);
      if (!stats.isDirectory()) return false;

      const contents = fs.readdirSync(path);

      // Consider a directory valid if it:
      // 1. Has iCloud markers
      // 2. Has common iCloud directories
      // 3. Has app storage paths
      const hasICloudMarkers = contents.some(item => item === '.icloud' || item === 'desktop.ini');

      const hasCommonDirs = contents.some(item => item === 'Documents' || item === 'Photos');

      const hasAppStorage = contents.some(item => this.isAppStoragePath(item));

      return hasICloudMarkers || hasCommonDirs || hasAppStorage;
    } catch {
      return false;
    }
  }

  /**
   * Find iCloud paths in Windows registry
   */
  private async _findInRegistry(): Promise<void> {
    try {
      const regPaths = [
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\SyncRootManager',
        'HKEY_CURRENT_USER\\Software\\Apple Inc.\\iCloud',
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Apple Inc.\\iCloud',
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Apple Inc.\\iCloud',
      ];

      for (const regPath of regPaths) {
        try {
          const output = execSync(`reg query "${regPath}" /s`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
          }).toString();

          const lines = output.split('\r\n');
          for (const line of lines) {
            const match = line.trim().match(/REG_\w+\s+([A-Z]:\\[^"]+)/i);
            if (!match) continue;

            const path = pathModule.normalize(match[1]);
            if (path.toLowerCase().includes('icloud') && fs.existsSync(path)) {
              this._addPath(path, {source: 'registry', score: 60});
            }
          }
        } catch {
          // Silently skip if registry key doesn't exist
        }
      }
    } catch (error) {
      console.debug('Error querying registry:', error);
    }
  }

  /**
   * Discover app-specific storage paths in found iCloud root directories
   */
  private async _discoverAppStoragePaths(): Promise<void> {
    const rootPaths = Array.from(this.pathMap.values())
      .filter(info => info.exists && info.isAccessible)
      .map(info => info.path);

    for (const rootPath of rootPaths) {
      try {
        const entries = await fs.promises.readdir(rootPath, {withFileTypes: true});

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const fullPath = pathModule.normalize(pathModule.join(rootPath, entry.name));

          if (this.isAppStoragePath(entry.name)) {
            const metadata = this._enrichMetadata({}, fullPath, {
              source: 'appStorage',
              rootPath: rootPath,
              score: 70,
            });

            this._addPath(fullPath, {
              source: 'appStorage',
              rootPath: rootPath,
              score: 70,
              metadata,
            });
          } else if (entry.name === 'Documents' || entry.name === 'Photos') {
            const metadata = this._enrichMetadata({}, fullPath, {
              source: 'commonPath',
              rootPath: rootPath,
              score: 65,
            });

            this._addPath(fullPath, {
              source: 'commonPath',
              rootPath: rootPath,
              score: 65,
              metadata,
            });
          }
        }
      } catch (error) {
        console.debug(`Error scanning root path ${rootPath}:`, error);
      }
    }
  }

  /**
   * Get list of available drives on Windows
   */
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

  /**
   * Enrich path metadata with Windows-specific information
   */
  protected _enrichMetadata(metadata: PathMetadata, path: string, source: PathSource): PathMetadata {
    const enriched: PathMetadata = {
      ...metadata,
      source,
    };

    const basename = path.split(pathModule.sep).pop() || '';

    // Handle special directories
    if (basename === 'Documents' || basename === 'Photos') {
      enriched.type = basename.toLowerCase();
      enriched.score = source.score || 65;
      return enriched;
    }

    // Handle app storage paths
    if (this.isAppStoragePath(basename)) {
      const {appId, appName, bundleId, vendor} = this.parseAppName(basename);
      if (appId || appName || bundleId || vendor) {
        Object.assign(enriched, {appId, appName, bundleId, vendor});
        enriched.score = source.score || 70;
      }
    }

    return enriched;
  }
}
