import * as fs from 'fs';
import {minimatch} from 'minimatch';
import * as path from 'path';

import {findDrivePaths} from './list';
import {PathInfo, PathType, SearchOptions} from './types';

export interface CopyOptions {
  source: string;
  targetType: PathType;
  targetApp?: string;
  pattern?: string;
  recursive?: boolean;
  overwrite?: boolean;
  dryRun?: boolean;
}

export interface CopyResult {
  success: boolean;
  copiedFiles: string[];
  failedFiles: string[];
  targetPath: string;
  errors: Error[];
}

export class FileCopier {
  async copy(options: CopyOptions): Promise<CopyResult> {
    // 1. Find target paths
    const targetPaths = await this.findTargetPaths(options);

    // 2. Validate source paths
    const sourceFiles = await this.getSourceFiles(options);

    // 3. Execute copy operation
    return this.executeCopy(sourceFiles, targetPaths, options);
  }

  private async findTargetPaths(options: CopyOptions): Promise<PathInfo[]> {
    const searchOptions: SearchOptions = {
      type: options.targetType,
      appName: options.targetApp,
      minScore: 10, // Ensure path reliability
    };

    return findDrivePaths(searchOptions);
  }

  private async getSourceFiles(options: CopyOptions): Promise<string[]> {
    const source = options.source;
    const pattern = options.pattern || '*';

    if (fs.statSync(source).isFile()) {
      // If it's a file, check if it matches the pattern
      return minimatch(path.basename(source), pattern) ? [source] : [];
    }

    const files: string[] = [];
    const entries = fs.readdirSync(source);

    for (const entry of entries) {
      const fullPath = path.join(source, entry);
      const stats = fs.statSync(fullPath);

      if (stats.isFile() && minimatch(entry, pattern)) {
        files.push(fullPath);
      } else if (stats.isDirectory() && options.recursive) {
        // Recursively get files from subdirectory
        const subFiles = await this.getSourceFiles({
          ...options,
          source: fullPath,
        });
        files.push(...subFiles);
      }
    }

    return files;
  }

  private async executeCopy(sourceFiles: string[], targetPaths: PathInfo[], options: CopyOptions): Promise<CopyResult> {
    const result: CopyResult = {
      success: true,
      copiedFiles: [],
      failedFiles: [],
      targetPath: '',
      errors: [],
    };

    if (targetPaths.length === 0) {
      result.success = false;
      result.errors.push(new Error('No valid target path found'));
      return result;
    }

    // Select the best target path
    const targetPath = this.selectBestTargetPath(targetPaths);
    result.targetPath = targetPath.path;

    for (const sourceFile of sourceFiles) {
      try {
        const relativePath = path.relative(options.source, sourceFile);
        const targetFile = path.join(targetPath.path, relativePath);

        if (options.dryRun) {
          result.copiedFiles.push(sourceFile);
          continue;
        }

        await fs.promises.mkdir(path.dirname(targetFile), {recursive: true});
        await fs.promises.copyFile(sourceFile, targetFile);
        result.copiedFiles.push(sourceFile);
      } catch (error) {
        result.failedFiles.push(sourceFile);
        result.errors.push(error as Error);
      }
    }

    result.success = result.failedFiles.length === 0;
    return result;
  }

  private selectBestTargetPath(paths: PathInfo[]): PathInfo {
    // Select the best path based on accessibility and score
    return paths.reduce((best, current) => {
      if (!best.isAccessible && current.isAccessible) return current;
      if (best.isAccessible && !current.isAccessible) return best;
      return current.score > best.score ? current : best;
    });
  }
}
