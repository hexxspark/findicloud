import * as fs from 'fs';
import {minimatch} from 'minimatch';
import * as path from 'path';

import {findDrivePaths} from './locate';
import {PathInfo, SearchOptions} from './types';

export interface CopyOptions {
  source: string;
  targetApp?: string;
  pattern?: string;
  recursive?: boolean;
  overwrite?: boolean;
  dryRun?: boolean;
  detailed?: boolean;
  table?: boolean;
  skipConfirmation?: boolean;
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
  async analyze(options: Omit<CopyOptions, 'dryRun' | 'overwrite'>): Promise<FileAnalysis> {
    const sourcePath = path.resolve(options.source);
    if (!fs.existsSync(sourcePath)) {
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

    const totalSize = await this.calculateTotalSize(filesToCopy);

    return {
      source: sourcePath,
      targetPaths,
      filesToCopy,
      totalFiles: filesToCopy.length,
      totalSize,
    };
  }

  async copy(options: CopyOptions): Promise<CopyResult> {
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

  private async findTargetPaths(options: CopyOptions): Promise<PathInfo[]> {
    const searchOptions: SearchOptions = {
      appName: options.targetApp,
      minScore: 10, // Ensure path reliability
    };

    return findDrivePaths(searchOptions);
  }

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

  private async copyFile(source: string, target: string, options: CopyOptions): Promise<void> {
    try {
      const targetDir = path.dirname(target);
      await fs.promises.mkdir(targetDir, {recursive: true});

      if (!options.overwrite && fs.existsSync(target)) {
        throw new Error(`Target file already exists: ${target}`);
      }

      // Use streams instead of fs.copyFile to avoid EPERM errors
      return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(source);
        const writeStream = fs.createWriteStream(target);

        readStream.on('error', err => {
          reject(new Error(`Failed to read ${source}: ${err.message}`));
        });

        writeStream.on('error', err => {
          reject(new Error(`Failed to write to ${target}: ${err.message}`));
        });

        writeStream.on('finish', () => {
          resolve();
        });

        readStream.pipe(writeStream);
      });
    } catch (error: any) {
      throw new Error(`Failed to copy ${source} to ${target}: ${error.message}`);
    }
  }

  private async calculateTotalSize(files: string[]): Promise<number> {
    let totalSize = 0;

    for (const file of files) {
      try {
        const stats = await fs.promises.stat(file);
        totalSize += stats.size;
      } catch {
        // Skip files that can't be read
      }
    }

    return totalSize;
  }
}
