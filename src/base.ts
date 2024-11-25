import * as fs from 'fs';
import * as pathModule from 'path';

import {PathInfo, PathMetadata, PathSource, PathType} from './types';

export abstract class BasePathFinder {
  protected pathMap: Map<string, PathInfo> = new Map();

  protected _addPath(path: string, source: PathSource): void {
    const evaluation = this.evaluatePath(path);
    const type = this._classifyPath(path);
    const metadata = this._enrichMetadata(evaluation.metadata, path, source);

    if (!this.pathMap.has(path)) {
      this.pathMap.set(path, {
        ...evaluation,
        metadata,
        type,
      });
    } else {
      const existing = this.pathMap.get(path)!;
      if (evaluation.score > existing.score) {
        existing.score = evaluation.score;
        existing.metadata = {
          ...existing.metadata,
          ...metadata,
          source, // Update the source when score is better
          sources: [...(existing.metadata.sources || []), source],
        };
      }
    }
  }

  protected abstract _classifyPath(path: string): PathType;
  protected abstract _enrichMetadata(metadata: PathMetadata, path: string, source: PathSource): PathMetadata;

  evaluatePath(filePath: string): Omit<PathInfo, 'type'> {
    let score = 0;
    let exists = false;
    let isAccessible = false;
    let metadata: PathMetadata = {};

    const isWindowsPath = filePath.includes(pathModule.win32.sep);
    const isPosixPath = filePath.includes(pathModule.posix.sep);

    if (!isWindowsPath && !isPosixPath) {
      return {path: filePath, score: -100, exists, isAccessible, metadata};
    }

    try {
      exists = fs.existsSync(filePath);
      if (exists) {
        score += 8;
        const stats = fs.statSync(filePath);
        isAccessible = true;
        metadata.stats = stats;

        if (stats.isDirectory()) {
          score += 5;
          try {
            const contents = (metadata.contents = fs.readdirSync(filePath));
            if (
              contents.some(
                item =>
                  item.includes('~com~') ||
                  item.includes('desktop.ini') ||
                  item.includes('iCloud~') ||
                  item.includes('.icloud'),
              )
            ) {
              score += 15;
              metadata.hasICloudMarkers = true;
            }
          } catch {
            isAccessible = false;
          }
        }
      }
    } catch {
      score -= 100;
    }

    return {path: filePath, score, exists, isAccessible, metadata};
  }

  protected _formatAppName(name: string): string {
    return (
      name
        // .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[.-]/g, ' ')
        .replace(/\s+/g, ' ') // Remove extra spaces
        .split(' ')
        .filter(Boolean) // Remove empty strings
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    );
  }

  protected isAppStoragePath(path: string): boolean {
    const basename = path.split(pathModule.sep).pop() || '';
    return basename.includes('~');
  }

  protected parseAppName(path: string): {appId: string; appName: string; bundleId: string; vendor: string} {
    const basename = path.split(pathModule.sep).pop() || '';
    const appId = basename.includes('~') ? basename : '';
    const [_, ...parts] = basename.split('~');
    const bundleId = parts.join('.');
    const appName = this._formatAppName(parts.pop() || bundleId);
    const vendor = parts.join('.');

    return {appId, appName, bundleId, vendor};
  }
}
