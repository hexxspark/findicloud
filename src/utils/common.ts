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
  const relativePath = path.relative(parent, child);
  return !!relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}
