/**
 * Base adapter interface for platform-specific implementations
 * This defines the common interface that all platform adapters must implement
 */

import {PathInfo} from './types';

/**
 * Base adapter interface that all platform-specific adapters must implement
 */
export interface OSAdapter {
  /**
   * Find paths based on the provided search options
   * @returns Array of path results
   */
  findPaths(): Promise<PathInfo[]>;

  /**
   * Copy a file from source to destination
   * @param source Source file path
   * @param destination Destination file path
   * @param overwrite Whether to overwrite existing files
   * @returns Promise that resolves when the copy is complete
   */
  // copyFile(source: string, destination: string, overwrite?: boolean): Promise<void>;
}
