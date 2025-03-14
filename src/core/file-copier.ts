import * as fs from 'fs';
import {minimatch} from 'minimatch';
import * as path from 'path';

import {PathInfo, SearchOptions} from '../types';
import {calculateTotalSize, copyFileWithStreams, fileExists} from '../utils/common';
import {PathFinder} from './path-finder';

// Types specific to copy functionality
export interface CopyOptions {
  source: string;
  app?: string;
  pattern?: string;
  recursive?: boolean;
  overwrite?: boolean;
  dryRun?: boolean;
  detailed?: boolean;
  table?: boolean;
  force?: boolean;
  interactive?: boolean;
}

export interface CopyResult {
  success: boolean;
  targetPath: string;
  copiedFiles: string[];
  failedFiles: string[];
  errors: Error[];
}

export interface FileAnalysis {
  source: string;
  targetPaths: PathInfo[];
  filesToCopy: string[];
  totalFiles: number;
  totalSize: number;
}

export class FileCopier {
  /**
   * Copy files to iCloud Drive
   *
   * @param source Source file or directory path
   * @param options Copy options
   * @returns Copy result
   *
   * @example
   * ```typescript
   * // Simple copy to iCloud Drive root
   * const result = await FileCopier.copy('./localfile.txt');
   *
   * // Copy to specific app with options
   * const result = await FileCopier.copy('./documents', 'Notes', {
   *   pattern: '*.md',
   *   recursive: true,
   *   overwrite: true
   * });
   * ```
   */
  static async copy(source: string, options?: Omit<CopyOptions, 'source' | 'app'>): Promise<CopyResult>;
  static async copy(source: string, target: string, options?: Omit<CopyOptions, 'source' | 'app'>): Promise<CopyResult>;
  static async copy(
    source: string,
    targetOrOptions?: string | Omit<CopyOptions, 'source' | 'app'>,
    maybeOptions?: Omit<CopyOptions, 'source' | 'app'>,
  ): Promise<CopyResult> {
    const copier = new FileCopier();

    // Processing parameters
    let target: string | undefined;
    let options: Omit<CopyOptions, 'source'> = {};

    if (typeof targetOrOptions === 'string') {
      // Call form: copy(source, target, options)
      target = targetOrOptions;
      options = maybeOptions || {};
    } else {
      // Call form: copy(source, options)
      options = targetOrOptions || {};
    }

    return copier.copy({
      source,
      app: target,
      ...options,
    });
  }

  /**
   * Analyze source path and determine files to copy
   *
   * @param options Copy options excluding dryRun and overwrite
   * @returns Analysis result with files to copy and target paths
   */
  async analyze(options: Omit<CopyOptions, 'dryRun' | 'overwrite'>): Promise<FileAnalysis> {
    const sourcePath = path.resolve(options.source);
    const exists = await fileExists(sourcePath);
    if (!exists) {
      throw new Error(`Source path does not exist: ${sourcePath}`);
    }

    const targetPaths = await this.findTargetPaths(options);
    if (targetPaths.length === 0) {
      throw new Error('No valid target paths found');
    }

    const filesToCopy = await this.findFilesToCopy(sourcePath, options);
    if (filesToCopy.length === 0) {
      throw new Error('No files to copy');
    }

    const totalSize = await calculateTotalSize(filesToCopy);

    return {
      source: sourcePath,
      targetPaths,
      filesToCopy,
      totalFiles: filesToCopy.length,
      totalSize,
    };
  }

  /**
   * Copy files to iCloud Drive
   *
   * @param options Copy options
   * @returns Copy result
   */
  async copy(options: CopyOptions): Promise<CopyResult>;
  /**
   * Copy files to iCloud Drive
   *
   * @param source Source file or directory path
   * @param target Target app name (optional, if not provided files will be copied to iCloud Drive root)
   * @param options Copy options
   * @returns Copy result
   */
  async copy(source: string, target?: string, options?: Omit<CopyOptions, 'source' | 'app'>): Promise<CopyResult>;
  async copy(
    sourceOrOptions: string | CopyOptions,
    targetOrOptions?: string | Omit<CopyOptions, 'source' | 'app'>,
    maybeOptions?: Omit<CopyOptions, 'source' | 'app'>,
  ): Promise<CopyResult> {
    let options: CopyOptions;

    if (typeof sourceOrOptions === 'string') {
      // Call form: copy(source, target, options)
      options = {
        source: sourceOrOptions,
        app: typeof targetOrOptions === 'string' ? targetOrOptions : undefined,
        ...(typeof targetOrOptions === 'string' ? maybeOptions || {} : targetOrOptions || {}),
      };
    } else {
      // Call form: copy(options)
      options = sourceOrOptions;
    }

    const analysis = await this.analyze(options);
    const result: CopyResult = {
      success: true,
      targetPath: analysis.targetPaths[0].path,
      copiedFiles: [],
      failedFiles: [],
      errors: [],
    };

    for (const targetPath of analysis.targetPaths) {
      for (const sourceFile of analysis.filesToCopy) {
        const relativePath = path.relative(
          fs.statSync(analysis.source).isFile() ? path.dirname(analysis.source) : analysis.source,
          sourceFile,
        );

        const targetFile = path.join(targetPath.path, relativePath);

        if (!options.dryRun) {
          try {
            await this.copyFile(sourceFile, targetFile, options);
            result.copiedFiles.push(sourceFile);
          } catch (error: any) {
            result.success = false;
            result.failedFiles.push(sourceFile);
            result.errors.push(error);
          }
        } else {
          result.copiedFiles.push(sourceFile);
        }
      }
    }

    return result;
  }

  /**
   * Find target paths based on app name
   *
   * @param options Copy options
   * @returns Array of path info objects
   */
  private async findTargetPaths(options: CopyOptions): Promise<PathInfo[]> {
    const searchOptions: SearchOptions = {
      appName: options.app,
      minScore: 10, // Ensure path reliability
    };

    return PathFinder.find(searchOptions);
  }

  /**
   * Find files to copy based on source path and options
   *
   * @param sourcePath Source path
   * @param options Copy options
   * @returns Array of file paths to copy
   */
  private async findFilesToCopy(sourcePath: string, options: CopyOptions): Promise<string[]> {
    const files: string[] = [];
    const pattern = options.pattern || '**/*';

    if (!options.recursive && !fs.statSync(sourcePath).isFile()) {
      throw new Error('Source must be a file when recursive is false');
    }

    if (fs.statSync(sourcePath).isFile()) {
      files.push(sourcePath);
    } else {
      await this.walkDirectory(sourcePath, pattern, files);
    }

    return files;
  }

  /**
   * Recursively walk directory and collect files matching pattern
   *
   * @param dir Directory to walk
   * @param pattern File pattern to match
   * @param files Array to collect matching files
   */
  private async walkDirectory(dir: string, pattern: string, files: string[]): Promise<void> {
    const entries = await fs.promises.readdir(dir, {withFileTypes: true});

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, pattern, files);
      } else if (entry.isFile() && minimatch(entry.name, pattern)) {
        files.push(fullPath);
      }
    }
  }

  /**
   * Copy a single file from source to target
   *
   * @param source Source file path
   * @param target Target file path
   * @param options Copy options
   */
  private async copyFile(source: string, target: string, options: CopyOptions): Promise<void> {
    try {
      // Use the copyFileWithStreams utility from common.ts
      await copyFileWithStreams(source, target, options.overwrite);
    } catch (error: any) {
      throw new Error(`Failed to copy ${source} to ${target}: ${error.message}`);
    }
  }

  /**
   * Calculate total size of files to copy
   *
   * @param files Array of file paths
   * @returns Total size in bytes
   */
  private async calculateTotalSize(files: string[]): Promise<number> {
    // Use the calculateTotalSize utility from common.ts
    return calculateTotalSize(files);
  }
}
