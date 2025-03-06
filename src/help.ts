import {PathType} from './types';
import chalk from 'chalk';

export function printHelp(): void {
  const help = `
${chalk.bold('iCloudy - iCloud Drive Path Finder')}
Find and manage files and directories in iCloud Drive

${chalk.bold('Path Types Description:')}
  ${chalk.green(PathType.ROOT)}
    • Root directory of iCloud Drive
    • Parent directory containing all other types
    • Example: /Users/<username>/Library/Mobile Documents/

  ${chalk.green(PathType.APP_STORAGE)}
    • Application data storage directory
    • Stores iCloud sync data for various applications
    • Usually in the format '~Library/Mobile Documents/app-identifier'
    • Example: com.apple.Keynote/Documents/

  ${chalk.green(PathType.PHOTOS)}
    • Photos and images storage directory
    • Contains iCloud Photo Library synced content
    • Supported formats: JPG, PNG, HEIC, etc.
    • Example: Photos Library.photoslibrary/

  ${chalk.green(PathType.DOCUMENTS)}
    • Document storage directory
    • User-created documents, spreadsheets, presentations, etc.
    • Typically located in iCloud Drive root
    • Example: Documents/, Desktop/

  ${chalk.green(PathType.OTHER)}
    • Other directory types
    • All other content not falling into above categories
    • Includes backups, downloads, and miscellaneous content

${chalk.bold('Usage Options:')}
  --type <type>     Specify path type to search (multiple types separated by commas)
  --score <number>  Set minimum matching score (0-100)
  --accessible      Show only paths accessible to current user
  --pattern <text>  Pattern to search by application name

${chalk.bold('Examples:')}
  # Find all document directories
  icloudy list --type documents

  # Find photo directories with high match score
  icloudy list --type photos --score 80

  # Find storage for specific application
  icloudy list --type app_storage --pattern "Keynote"

  # Find multiple types of paths
  icloudy list --type documents,photos --accessible

${chalk.bold('Important Notes:')}
  • All path types are case-sensitive
  • Match scores range from 0-100, higher means better match
  • Use --accessible option to avoid permission issues
  • Path pattern matching supports partial matches and multiple keywords
`;

  console.log(help);
} 