import fs from 'fs';
import pathModule from 'path';

import {OSAdapter} from '../adapter';
import {PathInfo, PathMetadata, PathSource} from '../types';

export abstract class BaseOSAdapter implements OSAdapter {
  protected pathMap: Map<string, PathInfo> = new Map();

  protected _addPath(path: string, source: PathSource): void {
    const evaluation = this.evaluatePath(path);
    const metadata = this._enrichMetadata(evaluation.metadata, path, source);

    if (!this.pathMap.has(path)) {
      this.pathMap.set(path, {
        ...evaluation,
        metadata,
      });
    } else {
      const existing = this.pathMap.get(path)!;
      if (evaluation.score > existing.score) {
        existing.score = evaluation.score;
        existing.metadata = {
          ...existing.metadata,
          ...metadata,
          source,
          sources: [...(existing.metadata.sources || []), source],
        };
      }
    }
  }

  protected abstract _enrichMetadata(metadata: PathMetadata, path: string, source: PathSource): PathMetadata;

  protected evaluatePath(path: string): PathInfo {
    let exists = false;
    let isAccessible = false;
    let score = 0;
    const metadata: PathMetadata = {};

    try {
      const stats = fs.statSync(path);
      exists = true;
      isAccessible = true;
      score = 50; // Base score for existing and accessible paths
      metadata.stats = {
        mode: stats.mode,
        uid: stats.uid,
        gid: stats.gid,
        size: stats.size,
        mtime: stats.mtime,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Path doesn't exist
        score = 0;
      } else if (error.code === 'EACCES') {
        // Path exists but is not accessible
        exists = true;
        score = 10;
      }
    }

    return {
      path,
      exists,
      isAccessible,
      score,
      metadata,
    };
  }

  protected isAppStoragePath(path: string): boolean {
    const basename = path.split(pathModule.sep).pop() || '';
    return basename.includes('~') || basename.startsWith('iCloud');
  }

  protected parseAppName(path: string): {appId?: string; appName?: string; bundleId?: string; vendor?: string} {
    const basename = path.split(pathModule.sep).pop() || '';
    const parts = basename.split('~');

    if (parts.length < 2) {
      return {};
    }

    // Remove any ID prefix (e.g., '4R6749AYRE' in '4R6749AYRE~com~pixelmatorteam~pixelmator')
    const cleanParts = parts[0].match(/^[A-Z0-9]+$/) ? parts.slice(1) : parts;

    // Handle 'iCloud' prefix
    const startIndex = cleanParts[0] === 'iCloud' ? 1 : 0;

    // Get the parts for bundleId
    const bundleParts = cleanParts.slice(startIndex);

    // For bundleId, we need to handle different formats:
    // 1. com~apple~notes -> com.apple.notes
    // 2. dk~simonbs~Scriptable -> dk.simonbs.Scriptable
    // 3. com~company~app~SubApp.Module -> com.company.app.SubApp.Module
    // 4. com~pixelmatorteam~pixelmator -> com.pixelmatorteam.pixelmator
    // 5. com~mindnode~MindNode -> com.mindnode.MindNode
    const appId = parts.join('~');
    const appName = this._formatAppName(bundleParts[bundleParts.length - 1] || '');

    // If the first part is a known vendor prefix (com, dk, etc.), keep it at the start
    if (bundleParts[0] === 'com' || bundleParts[0] === 'dk' || bundleParts[0] === 'md') {
      const bundleId = bundleParts.join('.');
      const vendor = bundleParts[0] === 'com' ? `${bundleParts[0]}.${bundleParts[1]}` : bundleParts[0];
      return {appId, appName, bundleId, vendor};
    }

    // Otherwise, try to find a vendor prefix in the parts
    const vendorIndex = bundleParts.findIndex(part => part === 'com' || part === 'dk' || part === 'md');
    if (vendorIndex !== -1) {
      // Reorder parts to put vendor prefix first
      const reorderedParts = [
        bundleParts[vendorIndex],
        ...bundleParts.slice(0, vendorIndex),
        ...bundleParts.slice(vendorIndex + 1),
      ];
      const bundleId = reorderedParts.join('.');
      const vendor = reorderedParts[0] === 'com' ? `${reorderedParts[0]}.${reorderedParts[1]}` : reorderedParts[0];
      return {appId, appName, bundleId, vendor};
    }

    // If no vendor prefix found, just join the parts
    const bundleId = bundleParts.join('.');
    const vendor = bundleParts[0];
    return {appId, appName, bundleId, vendor};
  }

  protected _formatAppName(name: string): string {
    // Handle cases like 'SubApp.Module' -> 'SubApp Module'
    if (name.includes('.')) {
      return name
        .split('.')
        .map(part => this._formatAppName(part))
        .join(' ');
    }

    // Handle cases where we don't want to split camelCase (like 'MindNode')
    if (/^[A-Z][a-z]+[A-Z][a-z]+$/.test(name)) {
      return name;
    }

    // Default case: split on camelCase and capitalize
    return name
      .split(/[.~]/)
      .pop()!
      .split(/(?=[A-Z])/)
      .join(' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  abstract findPaths(): Promise<PathInfo[]>;
}
