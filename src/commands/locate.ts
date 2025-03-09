import { Args, Flags } from '@oclif/core';

import { findDrivePaths } from '../locate';
import { CommandOptions, PathInfo, PathType } from '../types';
import { colors } from '../utils/colors';
import { BaseCommand } from './base';

export default class LocateCommand extends BaseCommand {
  static id = 'locate';
  static description = 'Locate iCloud Drive paths and files';

  static aliases = ['loc'];

  static examples = [
    '$ icloudy locate                    # Locate iCloud Drive root directory (simple output)',
    '$ icloudy locate -d                 # Locate root directory with detailed information',
    '$ icloudy locate -t                 # Locate root directory in table format',
    '$ icloudy locate all                # Locate paths of all types',
    '$ icloudy locate app Word           # Locate Word app data location',
    '$ icloudy locate photos             # Locate photos library location',
    '$ icloudy locate docs               # Locate documents library location',
  ];

  static flags = {
    ...BaseCommand.flags,
    detailed: Flags.boolean({
      char: 'd',
      description: 'Show detailed information for each path',
    }),
    table: Flags.boolean({
      char: 't',
      description: 'Show results in table format',
      dependsOn: ['detailed'],
    }),
    'include-inaccessible': Flags.boolean({
      char: 'i',
      description: 'Include inaccessible paths in results',
    }),
    'min-score': Flags.integer({
      char: 'm',
      description: 'Minimum score threshold for paths',
      default: 0,
    }),
  };

  static args = {
    type: Args.string({
      description: 'Path type to locate (root|app|photos|docs|all)',
      default: 'root',
    }),
    appName: Args.string({
      description: 'App name (required for app type)',
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(LocateCommand);
    const options = this.getCommandOptions(flags);

    try {
      // Convert type argument to PathType
      if (args.type && args.type.toLowerCase() !== 'all') {
        const type = args.type.toUpperCase();
        if (type in PathType) {
          options.type = PathType[type as keyof typeof PathType];
        }
      }

      // Set app name if provided
      if (args.appName) {
        options.appName = args.appName;
      }

      // Set additional options
      options.detailed = flags.detailed || false;
      options.tableFormat = flags.table || false;
      options.includeInaccessible = flags['include-inaccessible'] || false;
      options.minScore = flags['min-score'];

      if (!options.silent && options.detailed) {
        this.log(colors.info('Locating iCloud Drive paths...'));
      }

      const paths = await findDrivePaths(options);
      const accessiblePaths = paths.filter(p => p.isAccessible);

      if (paths.length === 0) {
        if (!options.silent && options.detailed) {
          this.log(colors.warning('No iCloud Drive paths found.'));
        }
        return;
      }

      // Choose output format based on options
      if (options.jsonOutput) {
        // Enhanced JSON output
        const result = {
          status: 'success',
          timestamp: new Date().toISOString(),
          query: {
            type: options.type,
            appName: options.appName,
            options: {
              includeInaccessible: options.includeInaccessible,
              minScore: options.minScore,
            },
          },
          summary: {
            total: paths.length,
            accessible: accessiblePaths.length,
            inaccessible: paths.length - accessiblePaths.length,
          },
          paths,
        };
        this.log(JSON.stringify(result, null, 2));
      } else if (options.detailed) {
        if (options.tableFormat) {
          this.displayTableOutput(paths, options);
        } else {
          this.displayDetailedOutput(paths);
        }

        if (!options.silent) {
          this.log(
            colors.formatSuccess(
              `Found ${paths.length} paths (${accessiblePaths.length} accessible, ${paths.length - accessiblePaths.length} inaccessible)`,
            ),
          );
        }
      } else {
        // Default simple output, just show paths
        paths.forEach(path => {
          this.log(path.path);
        });
      }
    } catch (error) {
      this.handleError(error, options.silent, 1);
    }
  }

  private displayTableOutput(paths: PathInfo[], options: CommandOptions): void {
    // Table format output using custom table formatter
    this.log(
      colors.bold(
        `\niCloud Drive Paths${options.type ? ` (Type: ${options.type})` : ''}${options.appName ? ` (Name: ${options.appName})` : ''}`,
      ),
    );

    // Define column widths - adjust based on content
    const colWidths = [4, 15, 45, 10, 30];
    const totalWidth = colWidths.reduce((sum, width) => sum + width, 0) + colWidths.length + 1;

    // Create separator line
    const separator = colors.dim('─'.repeat(totalWidth));

    // Create header row with consistent separators
    const headerCells = [
      colors.bold('#'),
      colors.bold('Status'),
      colors.bold('Path'),
      colors.bold('Type'),
      colors.bold('Details'),
    ];

    // Print table header
    this.log(separator);
    this.log(this.formatTableRow(headerCells, colWidths));
    this.log(separator);

    // Create rows
    paths.forEach((path, index) => {
      // Truncate path if too long
      const pathStr =
        path.path.length > colWidths[2] - 5 ? path.path.substring(0, colWidths[2] - 8) + '...' : path.path;

      const status = path.isAccessible ? colors.success('✓ Accessible') : colors.error('✗ Inaccessible');

      const type = colors.pathType[path.type as PathType](path.type);

      // Format details
      let details = '';
      if (path.metadata.appName) {
        details += path.metadata.appName;
        if (path.metadata.bundleId) {
          // Truncate bundle ID if too long
          const bundleId = path.metadata.bundleId;
          const maxBundleLength = colWidths[4] - path.metadata.appName.length - 4;
          const displayBundleId =
            bundleId.length > maxBundleLength && maxBundleLength > 5
              ? bundleId.substring(0, maxBundleLength - 3) + '...'
              : bundleId;
          details += ` (${displayBundleId})`;
        }
      }

      // Format and print row
      const row = this.formatTableRow([colors.progress(String(index + 1)), status, pathStr, type, details], colWidths);

      this.log(row);
    });

    this.log(separator);
  }

  private displayDetailedOutput(paths: PathInfo[]): void {
    paths.forEach((path, index) => {
      this.log(colors.bold(`\niCloud Drive Path #${index + 1}:`));
      this.log(`  Path: ${path.path}`);
      this.log(`  Type: ${colors.pathType[path.type as PathType](path.type)}`);
      this.log(`  Status: ${path.isAccessible ? colors.success('Accessible (✓)') : colors.error('Inaccessible (✗)')}`);
      this.log(`  Score: ${path.score}`);

      if (path.metadata.appName) {
        this.log(`  Application: ${path.metadata.appName}`);
      }
      if (path.metadata.bundleId) {
        this.log(`  Bundle ID: ${path.metadata.bundleId}`);
      }
    });
  }

  private formatTableRow(cells: string[], colWidths: number[]): string {
    let row = '│';

    cells.forEach((cell, index) => {
      // Remove ANSI color codes for width calculation
      const visibleText = this.stripAnsi(cell);

      // Calculate display width (accounting for wide characters)
      const displayWidth = this.getStringWidth(visibleText);

      // Calculate padding
      const width = colWidths[index];
      let padding = Math.max(0, width - displayWidth);

      // Ensure we don't exceed column width
      let displayCell = cell;
      if (displayWidth > width) {
        // Truncate the visible text
        let truncatedText = '';
        let truncatedWidth = 0;
        for (const char of visibleText) {
          const charWidth = this.getCharWidth(char);
          if (truncatedWidth + charWidth + 3 > width) {
            // +3 for '...'
            break;
          }
          truncatedText += char;
          truncatedWidth += charWidth;
        }

        // Replace the original text with truncated version + ellipsis
        // We need to preserve the color codes
        const colorPrefix = this.extractColorPrefix(cell);
        const colorSuffix = this.extractColorSuffix(cell);
        displayCell = `${colorPrefix}${truncatedText}...${colorSuffix}`;

        // Recalculate padding
        const newDisplayWidth = this.getStringWidth(truncatedText) + 3; // +3 for '...'
        padding = Math.max(0, width - newDisplayWidth);
      }

      // Add cell with padding
      row += ` ${displayCell}${' '.repeat(padding)} │`;
    });

    return row;
  }

  private getCharWidth(char: string): number {
    const code = char.codePointAt(0) || 0;

    if (
      // East Asian Wide
      (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
      (code >= 0x2e80 && code <= 0x9fff) || // CJK Unified Ideographs
      (code >= 0xac00 && code <= 0xd7a3) || // Hangul Syllables
      (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
      (code >= 0xff01 && code <= 0xff60) || // Fullwidth Forms
      (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth Forms
      // Emojis and symbols
      (code >= 0x1f300 && code <= 0x1f6ff) || // Miscellaneous Symbols and Pictographs
      (code >= 0x1f900 && code <= 0x1f9ff) || // Supplemental Symbols and Pictographs
      (code >= 0x2600 && code <= 0x26ff) // Miscellaneous Symbols
    ) {
      return 2;
    }

    return 1;
  }

  private getStringWidth(str: string): number {
    return Array.from(str).reduce((width, char) => width + this.getCharWidth(char), 0);
  }

  private extractColorPrefix(str: string): string {
    const match = str.match(/^\u001b\[\d+m/);
    return match ? match[0] : '';
  }

  private extractColorSuffix(str: string): string {
    const match = str.match(/\u001b\[0m$/);
    return match ? match[0] : '';
  }

  private stripAnsi(str: string): string {
    return str.replace(/\u001b\[\d+m/g, '');
  }
}
