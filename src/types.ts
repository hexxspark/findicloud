import {Stats} from 'fs';

export interface RegistrySource {
  path: string;
  valueName: string;
}

export enum PathSourceType {
  COMMON = 'common',
  REGISTRY = 'registry',
  USER_HOME = 'user_home',
  SYSTEM = 'system',
}

export interface PathSource {
  source: string;
  [key: string]: any;
}

export type PathStats = Pick<Stats, 'mode' | 'uid' | 'gid' | 'size' | 'mtime'>;

export enum PathType {
  APP = 'app',
  PHOTOS = 'photos',
  DOCS = 'docs',
  ROOT = 'root',
  OTHER = 'other',
}

export interface PathMetadata {
  contents?: string[];
  hasICloudMarkers?: boolean;
  hasStandardDirs?: boolean;
  isStandardPath?: boolean;
  permissions?: string;
  isInHome?: boolean;
  source?: PathSource;
  sources?: PathSource[];
  stats?: PathStats;
  appId?: string;
  appName?: string;
  bundleId?: string;
  vendor?: string;
  [key: string]: any;
}

export interface PathInfo {
  path: string;
  score: number;
  exists: boolean;
  isAccessible: boolean;
  type: PathType;
  metadata: PathMetadata;
}

export interface SearchOptions {
  type?: PathType;
  appName?: string;
  includeInaccessible?: boolean;
  minScore?: number;
}

export interface SearchResult {
  success: boolean;
  platform: string;
  paths: PathInfo[];
  error?: string;
}

export interface CommandOptions extends SearchOptions {
  showHelp: boolean;
  jsonOutput: boolean;
  noColor: boolean;
  silent: boolean;
  source?: string;
  target?: string;
  recursive?: boolean;
  force?: boolean;
  dryRun?: boolean;
  targetType?: PathType;
  targetApp?: string;
  pattern?: string;
  overwrite?: boolean;
  detailed?: boolean;
  tableFormat?: boolean;
}
