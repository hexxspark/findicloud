import {Stats} from 'fs';

export interface RegistrySource {
  path: string;
  valueName: string;
}

export interface PathSource {
  source: string;
  [key: string]: any;
}

export type PathStats = Pick<Stats, 'mode' | 'uid' | 'gid' | 'size' | 'mtime'>;

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
  [key: string]: any;
}

export interface PathInfo {
  path: string;
  score: number;
  exists: boolean;
  isAccessible: boolean;
  metadata: PathMetadata;
}

export interface SearchResult {
  success: boolean;
  platform: string;
  paths: PathInfo[];
  error?: string;
}
