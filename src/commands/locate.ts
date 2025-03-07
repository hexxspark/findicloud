import {findDrivePaths} from '../locate';
import {CommandOptions, PathType} from '../types';
import {colors} from '../utils/colors';
import {BaseCommand} from './base';

export class LocateCommand extends BaseCommand {
  name = 'locate';
  aliases = ['loc'];
  description = 'Locate iCloud Drive paths';

  async execute(args: string[]): Promise<void> {
    // Analyze parameters
    const options = this.parseArgs(args);
    
    try {
      if (!options.silent && options.detailed) {
        console.log(colors.info('Locating iCloud Drive paths...'));
      }

      const paths = await findDrivePaths(options);
      const accessiblePaths = paths.filter(p => p.isAccessible);

      if (paths.length === 0) {
        if (!options.silent && options.detailed) {
          console.log(colors.warning('No iCloud Drive paths found.'));
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
              minScore: options.minScore
            }
          },
          summary: {
            total: paths.length,
            accessible: accessiblePaths.length,
            inaccessible: paths.length - accessiblePaths.length
          },
          paths
        };
        console.log(JSON.stringify(result, null, 2));
      } 
      else if (options.detailed) {
        // Detailed output
        if (options.tableFormat) {
          // Table format output using custom table formatter
          console.log(colors.bold(`\niCloud Drive Paths${options.type ? ` (Type: ${options.type})` : ''}${options.appName ? ` (Name: ${options.appName})` : ''}`));
          
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
            colors.bold('Details')
          ];
          
          // Print table header
          console.log(separator);
          console.log(this.formatTableRow(headerCells, colWidths));
          console.log(separator);
          
          // Create rows
          paths.forEach((path, index) => {
            // Truncate path if too long
            const pathStr = path.path.length > colWidths[2] - 5 ? 
              path.path.substring(0, colWidths[2] - 8) + '...' : 
              path.path;
            
            const status = path.isAccessible ? 
              colors.success('✓ Accessible') : 
              colors.error('✗ Inaccessible');
            
            const type = colors.pathType[path.type](path.type);
            
            // Format details
            let details = '';
            if (path.metadata.appName) {
              details += path.metadata.appName;
              if (path.metadata.bundleId) {
                // Truncate bundle ID if too long
                const bundleId = path.metadata.bundleId;
                const maxBundleLength = colWidths[4] - path.metadata.appName.length - 4;
                const displayBundleId = bundleId.length > maxBundleLength && maxBundleLength > 5 ? 
                  bundleId.substring(0, maxBundleLength - 3) + '...' : 
                  bundleId;
                details += ` (${displayBundleId})`;
              }
            }
            
            // Format and print row
            const row = this.formatTableRow(
              [
                colors.progress(String(index + 1)),
                status,
                pathStr,
                type,
                details
              ],
              colWidths
            );
            
            console.log(row);
          });
          
          console.log(separator);
        } else {
          // Detailed but non-tabular format
          paths.forEach((path, index) => {
            console.log(colors.bold(`\niCloud Drive Path #${index + 1}:`));
            console.log(`  Path: ${path.path}`);
            console.log(`  Type: ${colors.pathType[path.type](path.type)}`);
            console.log(`  Status: ${path.isAccessible ? 
              colors.success('Accessible (✓)') : 
              colors.error('Inaccessible (✗)')}`);
            console.log(`  Score: ${path.score}`);
            
            if (path.metadata.appName) {
              console.log(`  Application: ${path.metadata.appName}`);
            }
            if (path.metadata.bundleId) {
              console.log(`  Bundle ID: ${path.metadata.bundleId}`);
            }
            // Display more metadata...
          });
        }
        
        if (!options.silent) {
          console.log(colors.formatSuccess(
            `Found ${paths.length} paths (${accessiblePaths.length} accessible, ${paths.length - accessiblePaths.length} inaccessible)`
          ));
        }
      }
      else {
        // Default simple output, just show paths
        paths.forEach(path => {
          console.log(path.path);
        });
      }
    } catch (error) {
      if (!options.silent) {
        console.error(colors.formatError(error instanceof Error ? error.message : String(error)));
      }
      process.exit(1);
    }
  }

  /**
   * Format a row for the table
   * @param cells The cells to format
   * @param colWidths The widths of each column
   * @returns The formatted row
   */
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
          if (truncatedWidth + charWidth + 3 > width) { // +3 for '...'
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

  /**
   * Get the display width of a single character
   * @param char The character to measure
   * @returns The display width (1 or 2)
   */
  private getCharWidth(char: string): number {
    const code = char.codePointAt(0) || 0;
    
    if (
      // East Asian Wide
      (code >= 0x1100 && code <= 0x115F) || // Hangul Jamo
      (code >= 0x2E80 && code <= 0x9FFF) || // CJK Unified Ideographs
      (code >= 0xAC00 && code <= 0xD7A3) || // Hangul Syllables
      (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility Ideographs
      (code >= 0xFF01 && code <= 0xFF60) || // Fullwidth Forms
      (code >= 0xFFE0 && code <= 0xFFE6) || // Fullwidth Forms
      // Emojis and symbols
      (code >= 0x1F300 && code <= 0x1F6FF) || // Miscellaneous Symbols and Pictographs
      (code >= 0x1F900 && code <= 0x1F9FF) || // Supplemental Symbols and Pictographs
      (code >= 0x2600 && code <= 0x26FF)    // Miscellaneous Symbols
    ) {
      return 2;
    }
    
    return 1;
  }

  /**
   * Get the display width of a string, accounting for wide characters
   * @param str The string to measure
   * @returns The display width
   */
  private getStringWidth(str: string): number {
    let width = 0;
    
    for (const char of str) {
      width += this.getCharWidth(char);
    }
    
    return width;
  }

  /**
   * Extract color prefix from a string with ANSI color codes
   * @param str The string with color codes
   * @returns The color prefix
   */
  private extractColorPrefix(str: string): string {
    const match = str.match(/^(\u001b\[\d+m)+/);
    return match ? match[0] : '';
  }

  /**
   * Extract color suffix from a string with ANSI color codes
   * @param str The string with color codes
   * @returns The color suffix
   */
  private extractColorSuffix(str: string): string {
    const match = str.match(/(\u001b\[\d+m)+$/);
    return match ? match[0] : '';
  }

  /**
   * Strip ANSI color codes from a string
   * @param str The string to strip
   * @returns The string without ANSI color codes
   */
  private stripAnsi(str: string): string {
    // This regex matches all ANSI color codes
    return str.replace(/\u001b\[\d+m/g, '');
  }

  protected parseArgs(args: string[]): CommandOptions {
    const options: CommandOptions = {
      showHelp: false,
      jsonOutput: false,
      noColor: false,
      silent: false,
      includeInaccessible: false,
      minScore: 0,
      detailed: false,
      tableFormat: false,
      type: PathType.ROOT // Default to ROOT type
    };

    // Handle main parameters (type and app name)
    if (args.length > 0) {
      const typeArg = args[0].toLowerCase();
      
      // Special handling for 'all' type
      if (typeArg === 'all') {
        // For 'all', we don't set a specific type, which means all types will be included
        delete options.type;
      } else {
        const type = typeArg.toUpperCase();
        if (type in PathType) {
          options.type = PathType[type as keyof typeof PathType];
          
          // If the type is app, the second parameter is app name
          if (options.type === PathType.APP && args.length > 1) {
            options.appName = args[1];
          }
        }
      }
    }

    // Handle other options
    for (let i = 0; i < args.length; i++) {
      const arg = args[i].toLowerCase();
      switch (arg) {
        case '--json':
        case '-j':
          options.jsonOutput = true;
          break;
        case '--no-color':
        case '-n':
          options.noColor = true;
          break;
        case '--silent':
        case '-s':
          options.silent = true;
          break;
        case '--help':
        case '-h':
          options.showHelp = true;
          break;
        case '--min-score':
        case '-m':
          options.minScore = parseInt(args[++i], 10) || 0;
          break;
        case '--include-inaccessible':
        case '-i':
          options.includeInaccessible = true;
          break;
        case '--detailed':
        case '--detail':
        case '-d':
          options.detailed = true;
          break;
        case '--table':
        case '-t':
          options.detailed = true;
          options.tableFormat = true;
          break;
      }
    }

    return options;
  }

  getHelp(): string {
    return `
Usage: icloudy locate [type] [app-name] [options]

Types:
  app <name>    Locate specific application data
  photos        Locate photos library
  docs          Locate documents library
  root          Locate root directory (default)
  all           Locate all paths (no type filtering)

Options:
  -m, --min-score <score>      Minimum path score (default: 0)
  -i, --include-inaccessible   Include inaccessible paths
  -j, --json                   Output in JSON format
  -d, --detailed               Show detailed information
  -t, --table                  Show detailed information in table format
  -n, --no-color               Disable colorized output
  -s, --silent                 Suppress all output except errors
  -h, --help                   Display help information

Examples:
  icloudy locate                    # Locate root directory (simple output)
  icloudy locate -d                 # Locate root directory (detailed output)
  icloudy locate -t                 # Locate root directory (table output)
  icloudy locate all                # Locate all paths (all types)
  icloudy locate app Word           # Locate Word app data
  icloudy locate photos             # Locate photos library
  icloudy locate docs               # Locate documents library
  icloudy locate app "Microsoft Word"  # Locate Microsoft Word app data
    `;
  }
} 