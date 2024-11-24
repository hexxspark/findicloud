import * as fs from 'fs';
import * as pathModule from 'path';

import {PathInfo, PathMetadata, PathSource} from './types';

export class BasePathFinder {
  protected pathMap: Map<string, PathInfo> = new Map();

  protected _addPath(path: string, source: PathSource): void {
    const evaluation = this.evaluatePath(path);

    if (!this.pathMap.has(path)) {
      this.pathMap.set(path, {
        ...evaluation,
        metadata: {
          ...evaluation.metadata,
          source,
        },
      });
    } else {
      const existing = this.pathMap.get(path)!;
      if (evaluation.score > existing.score) {
        existing.score = evaluation.score;
        existing.metadata = {
          ...existing.metadata,
          ...evaluation.metadata,
          sources: [...(existing.metadata.sources || []), source],
        };
      }
    }
  }

  evaluatePath(filePath: string): PathInfo {
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
}
