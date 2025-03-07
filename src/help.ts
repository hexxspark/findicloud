import {PathType} from './types';
import chalk from 'chalk';

export function getHelpText(): string {
  return `
iCloudy - iCloud Drive Path Finder

Available path types:
  ${chalk.green(PathType.ROOT)}          Root iCloud Drive directory
  ${chalk.green(PathType.APP)}           Application data
  ${chalk.green(PathType.PHOTOS)}        Photos library
  ${chalk.green(PathType.DOCS)}          Documents library
  ${chalk.green(PathType.OTHER)}         Other paths

Commands:
  list [options]    List iCloud Drive paths
  copy [options]    Copy files to iCloud Drive

Examples:
  icloudy list                  # List all paths
  icloudy list -t app -a Word  # List Word app paths
  icloudy list -t photos       # List photos library
  icloudy list -t docs        # List documents library
  
For more details, use --help with any command:
  icloudy list --help
  icloudy copy --help
`;
} 