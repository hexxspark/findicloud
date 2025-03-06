import chalk from 'chalk';
import {PathInfo, PathType} from '../types';

// Global color control
let colorEnabled = true;

export const setColorEnabled = (enabled: boolean) => {
  colorEnabled = enabled;
  // Force chalk to respect our color setting
  chalk.level = enabled ? 3 : 0;
};

// Color theme configuration
export const colorTheme = {
  // Command and options colors
  command: chalk.cyan,
  option: chalk.green,
  param: chalk.yellow,
  
  // Path type colors
  pathType: {
    [PathType.ROOT]: chalk.blue,
    [PathType.APP_STORAGE]: chalk.magenta,
    [PathType.PHOTOS]: chalk.cyan,
    [PathType.DOCUMENTS]: chalk.green,
    [PathType.OTHER]: chalk.gray,
  },
  
  // Status colors
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  
  // Helper colors
  dim: chalk.dim,
  bold: chalk.bold,
  
  // Progress colors
  progress: chalk.cyan,
  highlight: chalk.magenta,
  
  // Additional semantic colors
  modified: chalk.yellow,
  added: chalk.green,
  deleted: chalk.red,
  unchanged: chalk.gray,
};

// Color wrapper function
const withColor = (colorFn: (text: string) => string, text: string): string => {
  return colorEnabled ? colorFn(text) : text;
};

export const colors = {
  // Re-export theme colors with control wrapper
  command: (text: string) => withColor(colorTheme.command, text),
  option: (text: string) => withColor(colorTheme.option, text),
  param: (text: string) => withColor(colorTheme.param, text),
  
  pathType: Object.entries(colorTheme.pathType).reduce((acc, [key, colorFn]) => {
    acc[key as PathType] = (text: string) => withColor(colorFn, text);
    return acc;
  }, {} as Record<PathType, (text: string) => string>),
  
  success: (text: string) => withColor(colorTheme.success, text),
  error: (text: string) => withColor(colorTheme.error, text),
  warning: (text: string) => withColor(colorTheme.warning, text),
  info: (text: string) => withColor(colorTheme.info, text),
  
  dim: (text: string) => withColor(colorTheme.dim, text),
  bold: (text: string) => withColor(colorTheme.bold, text),
  
  progress: (text: string) => withColor(colorTheme.progress, text),
  highlight: (text: string) => withColor(colorTheme.highlight, text),
  
  // Format functions
  formatPath: (pathInfo: PathInfo, noColor = false): string => {
    const useColor = colorEnabled && !noColor;
    
    const typeColor = useColor ? (colors.pathType[pathInfo.type] || colors.dim) : ((text: string) => text);
    const accessibility = useColor
      ? (pathInfo.isAccessible ? colors.success('✓') : colors.error('✗'))
      : (pathInfo.isAccessible ? '✓' : '✗');
    
    let details = '';
    if (pathInfo.type === PathType.APP_STORAGE && pathInfo.metadata.appName) {
      details = useColor ? colors.dim(` (${pathInfo.metadata.appName})`) : ` (${pathInfo.metadata.appName})`;
      if (pathInfo.metadata.bundleId) {
        details += useColor ? colors.dim(` [${pathInfo.metadata.bundleId}]`) : ` [${pathInfo.metadata.bundleId}]`;
      }
    }

    return `${accessibility} ${pathInfo.path} ${typeColor(`[${pathInfo.type}]`)}${details}`;
  },

  formatHelp: (text: string): string => {
    if (!colorEnabled) return text;
    
    return text
      .replace(/^Usage:.+/gm, m => colors.bold(m))
      .replace(/\s+(-[a-z],\s)?--[a-z-]+/g, m => colors.option(m))
      .replace(/<[^>]+>/g, m => colors.param(m))
      .replace(/^Commands:/gm, m => colors.bold(m))
      .replace(/^\s+[a-z]+(?=\s)/gm, m => colors.command(m));
  },

  formatError: (error: string): string => {
    return colorEnabled ? `${colors.error('Error:')} ${error}` : `Error: ${error}`;
  },

  formatSuccess: (message: string): string => {
    return colorEnabled ? `${colors.success('Success:')} ${message}` : `Success: ${message}`;
  },

  formatWarning: (message: string): string => {
    return colorEnabled ? `${colors.warning('Warning:')} ${message}` : `Warning: ${message}`;
  },
  
  formatProgress: (current: number, total: number, message: string): string => {
    if (!colorEnabled) {
      return `[${current}/${total}] ${message}`;
    }
    return `${colors.progress(`[${current}/${total}]`)} ${message}`;
  }
}; 