import {Args, Flags} from '@oclif/core';

import {findiCloudPaths} from '../find';
import {CommandOptions, PathInfo} from '../types';
import {colors} from '../utils/colors';
import {BaseCommand} from './base';

export default class FindCommand extends BaseCommand {
  static id = 'find';
  static description = 'Find iCloud Drive paths and files';

  static aliases = ['f'];

  static examples = [
    '$ icloudy find                    # Find all iCloud Drive paths',
    '$ icloudy find -d                 # Show detailed information',
    '$ icloudy find -t                 # Show results in table format',
    '$ icloudy find Word               # Find Word app data location',
  ];

  static flags = {
    ...BaseCommand.flags,
    detailed: Flags.boolean({
      char: 'd',
      description: 'Show detailed information for each path',
    }),
    table: Flags.boolean({
      char: 't',
      description: 'Show results in table format (will automatically enable detailed view)',
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
    appName: Args.string({
      description: 'App name to search for',
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FindCommand);
    const options = this.getCommandOptions(flags);

    try {
      // Set app name if provided
      if (args.appName) {
        options.appName = args.appName;
      }

      // Set additional options
      options.detailed = flags.detailed || flags.table || false;
      options.tableFormat = flags.table || false;
      options.includeInaccessible = flags['include-inaccessible'] || false;
      options.minScore = flags['min-score'];

      if (!options.silent && options.detailed) {
        this.log(colors.info('Finding iCloud Drive paths...'));
      }

      const paths = await findiCloudPaths(options);
      const accessiblePaths = paths.filter(p => p.isAccessible);

      if (paths.length === 0) {
        if (!options.silent && options.detailed) {
          this.log(colors.warning('No iCloud Drive paths found.'));
        }
        return;
      }

      if (options.jsonOutput) {
        // Enhanced JSON output
        const result = {
          status: 'success',
          timestamp: new Date().toISOString(),
          query: {
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
    } catch (error: any) {
      this.error(error, {exit: 1});
    }
  }

  private displayDetailedOutput(paths: PathInfo[]): void {
    paths.forEach((path, index) => {
      this.log(colors.bold(`\niCloud Drive Path #${index + 1}:`));
      this.log(`  Path: ${path.path}`);
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

  private displayTableOutput(paths: PathInfo[], options: CommandOptions): void {
    // Table format output using custom table formatter
    this.log(colors.bold(`\niCloud Drive Paths${options.appName ? ` (Name: ${options.appName})` : ''}`));

    // Define column widths - adjust based on content
    const colWidths = [4, 15, 45, 30];

    // 创建一个示例行来确定实际宽度
    const sampleRow = this.formatTableRow(['1', 'Status', 'Path', 'Details'], colWidths);
    const actualWidth = this.stripAnsi(sampleRow).length;

    // 使用实际宽度创建分隔线
    const separator = colors.dim('─'.repeat(actualWidth));

    // Create header row with consistent separators
    const headerCells = [colors.bold('#'), colors.bold('Status'), colors.bold('Path'), colors.bold('Details')];

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

      // Format details
      let details = '';
      if (path.metadata.appName) {
        details += path.metadata.appName;
        if (path.metadata.bundleId) {
          // Truncate bundle ID if too long
          const bundleId = path.metadata.bundleId;
          const maxBundleLength = colWidths[3] - path.metadata.appName.length - 4;
          const displayBundleId =
            bundleId.length > maxBundleLength && maxBundleLength > 5
              ? bundleId.substring(0, maxBundleLength - 3) + '...'
              : bundleId;
          details += ` (${displayBundleId})`;
        }
      }

      // Format and print row
      const row = this.formatTableRow([colors.progress(String(index + 1)), status, pathStr, details], colWidths);

      this.log(row);
    });

    this.log(separator);
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
      (code >= 0xffe0 && code <= 0xffe6) // Fullwidth Forms
    ) {
      return 2;
    }

    return 1;
  }

  private getStringWidth(str: string): number {
    let width = 0;
    for (const char of str) {
      width += this.getCharWidth(char);
    }
    return width;
  }

  private stripAnsi(str: string): string {
    // Simple ANSI escape code stripper
    return str.replace(/\x1B\[\d+m/g, '');
  }

  private extractColorPrefix(str: string): string {
    // Extract color prefix from a string with ANSI codes
    const match = str.match(/^(\x1B\[\d+m)+/);
    return match ? match[0] : '';
  }

  private extractColorSuffix(str: string): string {
    // Extract color suffix from a string with ANSI codes
    const match = str.match(/(\x1B\[\d+m)+$/);
    return match ? match[0] : '';
  }
}
