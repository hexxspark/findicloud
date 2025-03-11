# iCloudy 🌥️

[![npm version](https://badge.fury.io/js/icloudy.svg)](https://badge.fury.io/js/icloudy)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

A Node.js library and CLI tool for managing iCloud Drive files and directories, with support for macOS and Windows.

## Prerequisites

- Node.js 16 or later
- Operating System:
  - macOS: Any version with iCloud Drive enabled
  - Windows: Windows 10 or later with iCloud for Windows installed
  - Linux: Not supported
- iCloud Drive enabled and configured
- Sufficient permissions to access iCloud directories

## Dependencies

This tool relies on the following key dependencies:

- [@oclif/core](https://www.npmjs.com/package/@oclif/core): Command line interface framework
- [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts): Interactive command line user interface
- [minimatch](https://www.npmjs.com/package/minimatch): File pattern matching

## Installation

Using npm:

```bash
# Install globally
npm install -g icloudy

# Install as a dependency
npm install icloudy
```

Using yarn:

```bash
# Install globally
yarn global add icloudy

# Install as a dependency
yarn add icloudy
```

Using pnpm:

```bash
# Install globally
pnpm add -g icloudy

# Install as a dependency
pnpm add icloudy
```

## Library Usage

### Finding iCloud Paths

```typescript
import {findICloudPaths} from 'icloudy';

// Find all iCloud paths
const paths = await findICloudPaths();

// Find specific app paths
const notesPaths = await findICloudPaths({
  type: 'app', // NOT 'app_storage'
  app: 'Notes',
});

// Find with detailed information
const detailedPaths = await findICloudPaths({
  verbose: true,
});

// Find specific path types
const rootPaths = await findICloudPaths({type: 'root'});
const docPaths = await findICloudPaths({type: 'docs'});
const photoPaths = await findICloudPaths({type: 'photos'});
const otherPaths = await findICloudPaths({type: 'other'});
```

### Path Information Structure

```typescript
interface PathInfo {
  path: string; // Absolute path to the iCloud location
  exists: boolean; // Whether the path exists on the file system
  isAccessible: boolean; // Whether the path is accessible by the current user
  score: number; // Confidence score (0-100) indicating how likely this is a valid iCloud path
  metadata: {
    appName?: string; // Human-readable app name (e.g., 'Notes', 'Pages')
    bundleId?: string; // App bundle ID (e.g., 'com.apple.notes')
    contents?: string[]; // Directory contents if available
    stats?: Stats; // File system stats
    source?: {
      source: string; // How the path was found: 'common', 'registry', 'user_home', etc.
      [key: string]: any;
    };
  };
}
```

### Finding Different Types of iCloud Paths

iCloudy can locate different types of iCloud paths:

```typescript
import {findICloudPaths} from 'icloudy';

// Find all iCloud paths
const allPaths = await findICloudPaths();

// Find app-specific paths
const appPaths = await findICloudPaths({
  appName: 'Notes', // Find paths for a specific app
});

// Find paths with detailed information
const detailedPaths = await findICloudPaths({
  includeInaccessible: true, // Include paths that exist but aren't accessible
  minScore: 50, // Only include paths with confidence score >= 50
});
```

### Platform-Specific Examples

#### macOS

```typescript
// Common iCloud paths on macOS
const paths = await findICloudPaths();
// Results might include:
// - ~/Library/Mobile Documents/com~apple~CloudDocs
// - ~/Library/Mobile Documents/com~apple~Notes
// - ~/Library/Mobile Documents/com~apple~Pages
// - ~/Library/Mobile Documents/iCloud~md~obsidian

// Find paths for a specific app
const notesPaths = await findICloudPaths({appName: 'Notes'});
// Results might include:
// - ~/Library/Mobile Documents/com~apple~Notes
```

#### Windows

```typescript
// Common iCloud paths on Windows
const paths = await findICloudPaths();
// Results might include:
// - C:\Users\{username}\iCloudDrive
// - C:\Users\{username}\iCloudDrive\iCloud~com~apple~Notes
// - C:\Users\{username}\iCloudDrive\iCloud~com~apple~Pages

// Find paths for a specific app
const notesPaths = await findICloudPaths({appName: 'Notes'});
// Results might include:
// - C:\Users\{username}\iCloudDrive\iCloud~com~apple~Notes
```

## Platform-Specific Implementations

iCloudy provides support for different operating systems to locate and interact with iCloud Drive files.

### macOS Storage Paths

On macOS, iCloud Drive uses the following directory structure:

- Main iCloud Drive directory: `~/Library/Mobile Documents/com~apple~CloudDocs`
- App-specific storage paths follow these patterns:
  - Apple apps: `~/Library/Mobile Documents/com~apple~{AppName}`
    - Example: `~/Library/Mobile Documents/com~apple~Notes` for Apple Notes
  - Third-party apps: `~/Library/Mobile Documents/{BundleID}` where BundleID uses `~` instead of `.`
    - Example: `~/Library/Mobile Documents/com~readdle~CommonDocuments` for Documents by Readdle
    - Example: `~/Library/Mobile Documents/iCloud~md~obsidian` for Obsidian

### Windows Storage Paths

On Windows, iCloud Drive uses a different directory structure:

- Main iCloud Drive directory: Usually `C:\Users\{username}\iCloudDrive`
- App-specific storage paths:
  - Apple apps: `{iCloudDrive}\iCloud~com~apple~{AppName}`
    - Example: `C:\Users\{username}\iCloudDrive\iCloud~com~apple~Notes`
  - Third-party apps: `{iCloudDrive}\iCloud~{BundleID}` with `~` instead of `.`
    - Example: `C:\Users\{username}\iCloudDrive\iCloud~com~readdle~CommonDocuments`

iCloudy automatically handles these different path formats and provides a consistent interface to access them.

## CLI Commands

### Global Options

```bash
Options:
  -h, --help        Show help information
  -j, --json        Output in JSON format
  -n, --no-color    Disable colored output
  -s, --silent      Suppress all output except errors
  -v, --version     Show version information
```

### locate - Find iCloud Paths

Find and display iCloud Drive paths on your system.

```bash
Usage: icloudy locate [options] [appName]

Arguments:
  appName                  App name to search for (optional)

Options:
  -d, --detailed           Show detailed information for each path
  -t, --table              Show results in table format (requires -d)
  -i, --include-inaccessible  Include inaccessible paths
  -m, --min-score <n>      Minimum score threshold for paths (default: 0)
  -j, --json               Output in JSON format
  --no-color               Disable colored output
  -s, --silent             Show errors only

Examples:
  # Find all iCloud paths
  icloudy locate

  # Find app-specific paths
  icloudy locate Notes
  icloudy locate "Apple Pages"

  # Show detailed information
  icloudy locate -d
  icloudy locate -d -t    # Show in table format
  icloudy locate -j       # Show all paths in JSON format

  # Advanced filtering
  icloudy locate -i -m 50  # Include inaccessible paths with score >= 50
```

### copy - Copy Files to iCloud

Copy files and directories to iCloud Drive locations.

```bash
Usage: icloudy copy <source> [options] [appName]

Arguments:
  source                  Source path to copy from
  appName                 Target app name (optional)

Options:
  -p, --pattern <pattern>  File pattern to match (default: *)
  -r, --recursive          Copy directories recursively
  -f, --force              Overwrite existing files
  -d, --dry-run            Show what would be copied without actually copying
  -i, --interactive        Enable interactive confirmation
  -y, --yes                Skip all confirmations
  -D, --detailed           Show detailed copy information
  -t, --table              Show results in table format (requires -D)
  -j, --json               Output results in JSON format
  --no-color               Disable colored output
  -s, --silent             Suppress all output except errors

Examples:
  # Basic copying
  icloudy copy ./localfile                  # Copy to iCloud Drive root
  icloudy copy ./notes Notes                # Copy to Notes app storage

  # Advanced usage
  icloudy copy ./folder -r                  # Recursive copy
  icloudy copy ./docs -p "*.md"             # Copy only markdown files
  icloudy copy ./data Pages -i              # Interactive mode with specific app
  icloudy copy ./backup -f                  # Force overwrite
  icloudy copy ./project -d                 # Dry run
  icloudy copy ./files -D -t                # Show detailed table output
```

### Copy Files to iCloud

```typescript
import {FileCopier, CopyOptions} from 'icloudy';

// Basic copying
const copier = new FileCopier();
const result = await copier.copy({
  source: './localfile.txt',
  targetApp: 'Notes',
});

// Analyze files without copying
const analysis = await copier.analyze({
  source: './documents',
  targetApp: 'Pages',
  pattern: '*.md',
  recursive: true,
});

// Advanced copy options
const advancedResult = await copier.copy({
  source: './project',
  targetApp: 'Documents',
  pattern: '*.{js,ts,json}',
  recursive: true,
  overwrite: true,
  dryRun: false,
  detailed: true,
  table: true,
  skipConfirmation: false,
  interactive: true,
});
```

### Copy Options

```typescript
interface CopyOptions {
  source: string; // Source file or directory path
  targetApp?: string; // Target application name
  pattern?: string; // File matching pattern (e.g., "*.txt")
  recursive?: boolean; // Whether to copy directories recursively
  overwrite?: boolean; // Whether to overwrite existing files
  dryRun?: boolean; // Analyze only without actual copying
  detailed?: boolean; // Display detailed information
  table?: boolean; // Display results in table format
  skipConfirmation?: boolean; // Skip confirmation prompts
  interactive?: boolean; // Interactive mode
}
```

### Copy Result

```typescript
interface CopyResult {
  success: boolean; // Whether the operation was successful
  targetPath: string; // Target path
  copiedFiles: string[]; // List of copied files
  failedFiles: string[]; // List of files that failed to copy
  errors: Error[]; // Error information
}
```

### File Analysis

```typescript
interface FileAnalysis {
  source: string; // Source path
  targetPaths: PathInfo[]; // Target path information
  filesToCopy: string[]; // List of files to copy
  totalFiles: number; // Total number of files
  totalSize: number; // Total file size (bytes)
}
```

### Example Output Formats

#### Default Output

```
/Users/username/Library/Mobile Documents/com~apple~CloudDocs
/Users/username/Library/Mobile Documents/com~apple~Notes
```

#### Detailed Output (-d)

```
iCloud Drive Paths:

Path #1:
  Path: /Users/username/Library/Mobile Documents/com~apple~CloudDocs
  Status: ✓ Accessible
  Score: 95
  App Name: iCloud Drive
  Bundle ID: com.apple.CloudDocs
  Contents: Documents, Photos, Desktop, ...

Path #2:
  Path: /Users/username/Library/Mobile Documents/com~apple~Notes
  Status: ✓ Accessible
  Score: 90
  App Name: Notes
  Bundle ID: com.apple.notes

Path #3:
  Path: /Users/username/Library/Mobile Documents/iCloud~md~obsidian
  Status: ✓ Accessible
  Score: 85
  App Name: Obsidian
  Bundle ID: md.obsidian

Found 3 paths (3 accessible, 0 inaccessible)
```

#### JSON Output (-j)

```json
{
  "status": "success",
  "timestamp": "2024-01-20T12:00:00Z",
  "summary": {
    "total": 3,
    "accessible": 3,
    "inaccessible": 0
  },
  "paths": [
    {
      "path": "/Users/username/Library/Mobile Documents/com~apple~CloudDocs",
      "exists": true,
      "isAccessible": true,
      "score": 95,
      "metadata": {
        "appName": "iCloud Drive",
        "bundleId": "com.apple.CloudDocs",
        "hasICloudMarkers": true,
        "contents": ["Documents", "Photos"],
        "source": {
          "source": "common"
        }
      }
    },
    {
      "path": "/Users/username/Library/Mobile Documents/com~apple~Notes",
      "exists": true,
      "isAccessible": true,
      "score": 90,
      "metadata": {
        "appName": "Notes",
        "bundleId": "com.apple.Notes",
        "source": {
          "source": "appStorage"
        }
      }
    }
  ]
}
```

## API Reference

### findICloudPaths(options?)

Find iCloud Drive paths on the current system.

```typescript
interface SearchOptions {
  appName?: string; // Filter by app name (e.g., 'Notes', 'Pages')
  includeInaccessible?: boolean; // Include paths that exist but aren't accessible
  minScore?: number; // Minimum confidence score (0-100)
}

// Returns Promise<PathInfo[]>
```

Example usage:

```typescript
import {findICloudPaths} from 'icloudy';

// Find all iCloud paths
const allPaths = await findICloudPaths();

// Find paths for a specific app
const notesPaths = await findICloudPaths({appName: 'Notes'});

// Find all paths with a minimum confidence score
const reliablePaths = await findICloudPaths({minScore: 75});
```

## Error Handling

The library uses error codes and detailed error messages to help diagnose issues:

```typescript
try {
  const paths = await findICloudPaths();
} catch (error) {
  if (error.code === 'EACCES') {
    console.error('Permission denied accessing iCloud paths');
  } else if (error.code === 'ENOENT') {
    console.error('iCloud Drive not found or not configured');
  } else {
    console.error('Error:', error.message);
  }
}
```

## License

Apache-2.0

## Project Architecture

iCloudy adopts a modular design, primarily consisting of the following components:

### Core Components

- **DriveLocator**: Singleton class responsible for locating iCloud paths
- **BasePathFinder**: Platform-independent base class for path finding
- **MacPathFinder**: macOS platform-specific implementation
- **WindowsPathFinder**: Windows platform-specific implementation
- **FileCopier**: File copying functionality implementation

### Directory Structure

```
src/
├── commands/       # CLI command implementations
│   ├── base.ts     # Base command class
│   ├── copy.ts     # Copy command
│   └── locate.ts   # Locate command
├── platforms/      # Platform-specific implementations
│   ├── mac.ts      # macOS implementation
│   └── win.ts      # Windows implementation
├── utils/          # Utility functions
├── base.ts         # Base class definitions
├── copy.ts         # File copying functionality
├── locate.ts       # Path location functionality
├── types.ts        # Type definitions
└── index.ts        # Exported interfaces
```

### Data Flow

1. **Location Process**:

   - User calls the `findDrivePaths()` function
   - `DriveLocator` creates the appropriate `PathFinder` based on the current platform
   - `PathFinder` finds and returns iCloud paths

2. **Copy Process**:
   - User creates a `FileCopier` instance
   - Calls `analyze()` to analyze files to be copied
   - Calls `copy()` to execute the copy operation

## Contribution Guidelines

Contributions to iCloudy are welcome! Here are some ways to contribute:

### Development Environment Setup

```bash
# Clone the repository
git clone https://github.com/hexxspark/findicloud.git
cd findicloud

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test
```

### Submitting Pull Requests

1. Fork the repository and create your branch
2. Add or modify functionality
3. Ensure tests pass
4. Submit a Pull Request

### Reporting Issues

If you find a bug or have a feature request, please submit it on
[GitHub Issues](https://github.com/hexxspark/findicloud/issues).
