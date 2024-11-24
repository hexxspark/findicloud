import {execSync} from 'child_process';
import * as fs from 'fs';
import {join} from 'path';

import {BasePathFinder} from '../base'; // 确保导入路径正确
import {PathInfo} from '../types';

export class WindowsPathFinder extends BasePathFinder {
  async findPaths(): Promise<PathInfo[]> {
    try {
      await this._findInRegistry();
      await this._findInCommonLocations();

      return Array.from(this.pathMap.values())
        .sort((a, b) => b.score - a.score)
        .filter(info => info.score > 0);
    } catch (error: any) {
      throw new Error(`Failed to find iCloud paths: ${error.message}`);
    }
  }

  private async _findInRegistry(): Promise<void> {
    const primaryRegPath =
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\SyncRootManager\\iCloudDrive';
    const fallbackRegPaths = [
      'HKEY_CURRENT_USER\\Software\\Apple Inc.\\iCloud',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\Apple Inc.\\iCloud',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Apple Inc.\\iCloud',
    ];

    await this._searchRegistry(primaryRegPath);

    if (!Array.from(this.pathMap.values()).some(p => p.score > 20)) {
      for (const regPath of fallbackRegPaths) {
        await this._searchRegistry(regPath);
      }
    }
  }

  private async _searchRegistry(regPath: string): Promise<void> {
    try {
      const output = execSync(`reg query "${regPath}" /s /f "icloud" /d`, {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10,
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      const entries = output.split('\r\n\r\n');
      for (const entry of entries) {
        const lines = entry.trim().split('\r\n');
        if (lines.length <= 1) continue;

        const keyPath = lines[0];
        for (const line of lines.slice(1)) {
          const match = line.trim().match(/([^\s]+)\s+REG_\S+\s+(.+)/);
          if (!match) continue;

          const [_, name, value] = match;
          const path = value.trim();

          if (!path.includes(':\\')) continue;

          this._addPath(path, {
            source: 'registry',
            regPath: keyPath,
            valueName: name,
          });
        }
      }
    } catch {
      // Ignore registry errors
    }
  }

  private async _findInCommonLocations(): Promise<void> {
    const userProfile = process.env.USERPROFILE;
    const driveLetters = this.getAvailableDrives();
    const commonPaths = [
      userProfile ? join(userProfile, 'iCloudDrive') : null,
      userProfile ? join(userProfile, 'iCloud Drive') : null,
      ...driveLetters.map(driver => `${driver}\\iCloudDrive`),
      ...driveLetters.map(driver => `${driver}\\iCloud\\iCloudDrive`),
    ];

    // 如果 USERPROFILE 不存在，仍然添加其他常见路径
    if (!userProfile) {
      commonPaths.push(...driveLetters.map(driver => `${driver}\\`));
      commonPaths.push(...driveLetters.map(driver => `${driver}\\iCloudDrive`));
      commonPaths.push(...driveLetters.map(driver => `${driver}\\iCloud\\iCloudDrive`));
    }

    for (const path of commonPaths) {
      if (path) {
        // 确保 path 是有效的字符串
        this._addPath(path, {source: 'commonPath'});
      }
    }
  }

  public getAvailableDrives(): string[] {
    const drives: string[] = [];
    try {
      for (let i = 65; i <= 90; i++) {
        const driver = String.fromCharCode(i) + ':';
        // ASCII codes for A-Z
        if (fs.existsSync(driver)) {
          drives.push(driver);
        }
      }
    } catch (error) {
      // Handle potential errors, such as permission issues
    }
    return drives;
  }
}
