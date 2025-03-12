/**
 * Common utilities
 * Helper functions used across the codebase
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Ensure a directory exists
 * @param dirPath Directory path to ensure exists
 * @returns Promise that resolves when the directory exists
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(dirPath, {recursive: true});
  } catch (err: any) {
    // Ignore if directory already exists
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
}

/**
 * Normalize a path to use forward slashes
 * @param filePath Path to normalize
 * @returns Normalized path
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Format a file size in a human-readable format
 * @param bytes Size in bytes
 * @param decimals Number of decimal places
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Check if a path is a subdirectory of another path
 * @param parent Parent directory path
 * @param child Child path to check
 * @returns True if child is a subdirectory of parent
 */
export function isSubdirectory(parent: string, child: string): boolean {
  const normalizedParent = normalizePath(path.resolve(parent));
  const normalizedChild = normalizePath(path.resolve(child));
  const relativePath = path.relative(normalizedParent, normalizedChild);
  return !!relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

/**
 * Safely copy a file from source to destination using streams
 * @param source Source file path
 * @param destination Destination file path
 * @param overwrite Whether to overwrite if destination exists
 * @returns Promise that resolves when the copy is complete
 */
export async function copyFileWithStreams(source: string, destination: string, overwrite = false): Promise<void> {
  try {
    // Ensure destination directory exists
    const destinationDir = path.dirname(destination);
    await ensureDirectoryExists(destinationDir);

    // Check if destination exists and overwrite is false
    if (!overwrite && fs.existsSync(destination)) {
      throw new Error(`Target file already exists: ${destination}`);
    }

    // 实现实际的文件复制逻辑
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(source);
      const writeStream = fs.createWriteStream(destination);

      readStream.on('error', err => {
        reject(new Error(`Failed to read ${source}: ${err.message}`));
      });

      writeStream.on('error', err => {
        reject(new Error(`Failed to write to ${destination}: ${err.message}`));
      });

      writeStream.on('finish', () => {
        resolve();
      });

      readStream.pipe(writeStream);
    });
  } catch (error: any) {
    // 直接抛出原始错误，避免嵌套错误消息
    if (
      error.message.includes('Target file already exists') ||
      error.message.includes('Failed to read') ||
      error.message.includes('Failed to write to')
    ) {
      throw error;
    }
    throw new Error(`Failed to copy ${source} to ${destination}: ${error.message}`);
  }
}

/**
 * Calculate total size of files
 * @param filePaths Array of file paths
 * @returns Promise resolving to total size in bytes
 */
export async function calculateTotalSize(filePaths: string[]): Promise<number> {
  let totalSize = 0;

  for (const filePath of filePaths) {
    try {
      const stats = await fs.promises.stat(filePath);
      // 检查stats对象是否有isFile方法，如果没有但有size属性，则直接使用size
      if (typeof stats.isFile === 'function' && stats.isFile()) {
        totalSize += stats.size;
      } else if (stats.size !== undefined) {
        // 如果没有isFile方法但有size属性，直接使用size
        totalSize += stats.size;
      }
    } catch (error) {
      console.warn(`Could not get size of ${filePath}:`, error);
    }
  }

  return totalSize;
}

/**
 * Check if a file exists and is accessible
 * @param filePath Path to check
 * @returns Promise resolving to boolean indicating if file exists and is accessible
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file extension from path
 * @param filePath File path
 * @returns File extension (without the dot) or empty string if no extension
 */
export function getFileExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext ? ext.slice(1) : '';
}
