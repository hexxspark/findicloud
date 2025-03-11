import chalk from 'chalk';

import {PathInfo} from '../types';

// Make sure the chalk works in the test environment
chalk.level = 1;

class Colors {
  private colorEnabled = true;

  setColorMode(enabled: boolean): void {
    this.colorEnabled = enabled;
  }

  success(text: string): string {
    return this.colorEnabled ? chalk.green(text) : text;
  }

  error(text: string): string {
    return this.colorEnabled ? chalk.red(text) : text;
  }

  warning(text: string): string {
    return this.colorEnabled ? chalk.yellow(text) : text;
  }

  info(text: string): string {
    return this.colorEnabled ? chalk.blue(text) : text;
  }

  dim(text: string): string {
    return this.colorEnabled ? chalk.dim(text) : text;
  }

  bold(text: string): string {
    return this.colorEnabled ? chalk.bold(text) : text;
  }

  progress(text: string): string {
    return this.colorEnabled ? chalk.cyan(text) : text;
  }

  highlight(text: string): string {
    return this.colorEnabled ? chalk.magenta(text) : text;
  }

  formatSuccess(message: string): string {
    return this.colorEnabled ? `${this.success('Success:')} ${message}` : `Success: ${message}`;
  }

  formatError(error: string): string {
    return this.colorEnabled ? `${this.error('Error:')} ${error}` : `Error: ${error}`;
  }

  formatWarning(message: string): string {
    return this.colorEnabled ? `${this.warning('Warning:')} ${message}` : `Warning: ${message}`;
  }

  formatPath(pathInfo: PathInfo): string {
    if (!this.colorEnabled) {
      return `${pathInfo.path} [${pathInfo.metadata.appName || ''}]`;
    }

    const accessIcon = pathInfo.isAccessible ? '✓' : '✗';
    const accessColor = pathInfo.isAccessible ? chalk.green : chalk.red;
    const pathColor = chalk.blue;
    const metaColor = chalk.gray;

    return `${accessColor(accessIcon)} ${pathColor(pathInfo.path)} ${metaColor(pathInfo.metadata.appName || '')}`;
  }

  formatProgress(current: number, total: number, message: string): string {
    const percentage = Math.round((current / total) * 100);
    const progressText = `[${current}/${total}] ${percentage}% ${message}`;

    if (!this.colorEnabled) {
      return progressText;
    }

    return chalk.cyan(progressText);
  }
}

export const colors = new Colors();
export default colors;
