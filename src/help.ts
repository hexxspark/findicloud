import chalk from 'chalk';
import {PathType} from './types';

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
  locate [options]    Locate iCloud Drive paths
  copy [options]    Copy files to iCloud Drive

Examples:
  icloudy locate                  # Locate all paths
  icloudy locate -t app -a Word  # Locate Word app paths
  icloudy locate -t photos       # Locate photos library
  icloudy locate -t docs        # Locate documents library
  
For more details, use --help with any command:
  icloudy locate --help
  icloudy copy --help
`;
} 