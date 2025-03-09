import chalk from 'chalk';

import { PathInfo, PathType } from '../types';

// Global color control
let colorEnabled = true;

// ANSI color codes
const ansiCodes = {
  reset: '\u001b[0m',
  // Basic colors
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m',
  gray: '\u001b[90m',
  // Bright colors
  brightRed: '\u001b[91m',
  brightGreen: '\u001b[92m',
  brightYellow: '\u001b[93m',
  brightBlue: '\u001b[94m',
  brightMagenta: '\u001b[95m',
  brightCyan: '\u001b[96m',
  // Styles
  bold: '\u001b[1m',
  dim: '\u001b[2m',
};

// Color theme configuration
const colorTheme = {
  // Command and options colors
  command: (text: string) => `${ansiCodes.cyan}${text}${ansiCodes.reset}`,
  option: (text: string) => `${ansiCodes.green}${text}${ansiCodes.reset}`,
  param: (text: string) => `${ansiCodes.yellow}${text}${ansiCodes.reset}`,

  // Path type colors
  pathType: {
    [PathType.APP]: (text: string) => `${ansiCodes.magenta}${text}${ansiCodes.reset}`,
    [PathType.PHOTOS]: (text: string) => `${ansiCodes.blue}${text}${ansiCodes.reset}`,
    [PathType.DOCS]: (text: string) => `${ansiCodes.yellow}${text}${ansiCodes.reset}`,
    [PathType.ROOT]: (text: string) => `${ansiCodes.green}${text}${ansiCodes.reset}`,
    [PathType.OTHER]: (text: string) => `${ansiCodes.gray}${text}${ansiCodes.reset}`,
  },

  // Status colors
  success: (text: string) => `${ansiCodes.green}${text}${ansiCodes.reset}`,
  error: (text: string) => `${ansiCodes.red}${text}${ansiCodes.reset}`,
  warning: (text: string) => `${ansiCodes.yellow}${text}${ansiCodes.reset}`,
  info: (text: string) => `${ansiCodes.blue}${text}${ansiCodes.reset}`,

  // Helper colors
  dim: (text: string) => `${ansiCodes.dim}${text}${ansiCodes.reset}`,
  bold: (text: string) => `${ansiCodes.bold}${text}${ansiCodes.reset}`,

  // Progress colors
  progress: (text: string) => `${ansiCodes.cyan}${text}${ansiCodes.reset}`,
  highlight: (text: string) => `${ansiCodes.magenta}${text}${ansiCodes.reset}`,

  // Additional semantic colors
  modified: (text: string) => `${ansiCodes.yellow}${text}${ansiCodes.reset}`,
  added: (text: string) => `${ansiCodes.green}${text}${ansiCodes.reset}`,
  deleted: (text: string) => `${ansiCodes.red}${text}${ansiCodes.reset}`,
  unchanged: (text: string) => `${ansiCodes.gray}${text}${ansiCodes.reset}`,
};

export const setColorEnabled = (enabled: boolean) => {
  colorEnabled = enabled;
  chalk.level = enabled ? 3 : 0;
};

// Color wrapper function
const withColor = (colorFn: (text: string) => string, text: string): string => {
  if (!colorEnabled) return text;
  try {
    return colorFn(text);
  } catch {
    return text;
  }
};

export const colors = {
  // Re-export theme colors with control wrapper
  command: (text: string) => withColor(colorTheme.command, text),
  option: (text: string) => withColor(colorTheme.option, text),
  param: (text: string) => withColor(colorTheme.param, text),

  pathType: Object.entries(colorTheme.pathType).reduce(
    (acc, [key, colorFn]) => {
      acc[key as PathType] = (text: string) => withColor(colorFn, text);
      return acc;
    },
    {} as Record<PathType, (text: string) => string>,
  ),

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

    const typeColor = useColor ? colors.pathType[pathInfo.type] || colors.dim : (text: string) => text;
    const accessibility = useColor
      ? pathInfo.isAccessible
        ? colors.success('✓')
        : colors.error('✗')
      : pathInfo.isAccessible
        ? '✓'
        : '✗';

    let details = '';
    if (pathInfo.type === PathType.APP && pathInfo.metadata.appName) {
      details = useColor ? colors.dim(` (${pathInfo.metadata.appName})`) : ` (${pathInfo.metadata.appName})`;
      if (pathInfo.metadata.bundleId) {
        details += useColor ? colors.dim(` [${pathInfo.metadata.bundleId}]`) : ` [${pathInfo.metadata.bundleId}]`;
      }
    }

    // Convert path type to uppercase for display
    const displayType = pathInfo.type.toUpperCase();
    return `${accessibility} ${pathInfo.path} ${typeColor(`[${displayType}]`)}${details}`;
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
  },
};
