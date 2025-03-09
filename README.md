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
import { findICloudPaths } from 'icloudy';

// Find all iCloud paths
const paths = await findICloudPaths();

// Find specific app paths
const notesPaths = await findICloudPaths({
  type: 'app',  // NOT 'app_storage'
  app: 'Notes'
});

// Find with detailed information
const detailedPaths = await findICloudPaths({
  verbose: true
});

// Find specific path types
const rootPaths = await findICloudPaths({ type: 'root' });
const docPaths = await findICloudPaths({ type: 'docs' });
const photoPaths = await findICloudPaths({ type: 'photos' });
const otherPaths = await findICloudPaths({ type: 'other' });
```

### Path Information Structure

```typescript
interface PathInfo {
  path: string;          // Absolute path
  type: PathType;        // 'root' | 'app' | 'photos' | 'docs' | 'other'
  exists: boolean;       // Whether path exists
  isAccessible: boolean; // Whether path is accessible
  score: number;         // Confidence score (0-100)
  metadata: {
    appId?: string;      // App identifier (e.g., 'com.apple.notes')
    appName?: string;    // Human-readable app name (e.g., 'Notes')
    bundleId?: string;   // App bundle ID
    contents?: string[]; // Directory contents
    stats?: Stats;      // File system stats
    hasICloudMarkers?: boolean; // Whether directory contains iCloud markers
    source?: {          // Information about how the path was found
      source: string;   // 'common' | 'registry' | 'user_home' | 'system'
      [key: string]: any;
    }
  }
}

// All possible path types
enum PathType {
  ROOT = 'root',       // Main iCloud Drive directory
  APP = 'app',         // App-specific storage
  PHOTOS = 'photos',   // Photos library location
  DOCS = 'docs',       // Documents library location
  OTHER = 'other'      // Other iCloud paths
}
```

### Platform-Specific Examples

#### macOS
```typescript
// Common iCloud paths on macOS
const paths = await findICloudPaths();
// Results:
// - ~/Library/Mobile Documents/com~apple~CloudDocs (type: 'root')
// - ~/Library/Mobile Documents/com~apple~Notes (type: 'app')
// - ~/Library/Mobile Documents/com~apple~Pages (type: 'app')
// - ~/Library/Mobile Documents/com~apple~CloudDocs/Documents (type: 'docs')
// - ~/Library/Mobile Documents/com~apple~CloudDocs/Photos (type: 'photos')
// - ~/Library/Mobile Documents/com~apple~CloudDocs/Other (type: 'other')

// Find app-specific paths
const appPaths = await findICloudPaths({ type: 'app' });
// Results:
// - ~/Library/Mobile Documents/com~apple~Notes
// - ~/Library/Mobile Documents/com~apple~Pages
// etc.
```

#### Windows
```typescript
// Common iCloud paths on Windows
const paths = await findICloudPaths();
// Results:
// - C:\\Users\\{username}\\iCloudDrive (type: 'root')
// - C:\\Users\\{username}\\iCloudDrive\\Documents (type: 'docs')
// - C:\\Users\\{username}\\iCloudDrive\\Photos (type: 'photos')
// - C:\\Users\\{username}\\iCloudDrive\\Other (type: 'other')

// Find app-specific paths
const appPaths = await findICloudPaths({ type: 'app' });
// Results:
// - C:\\Users\\{username}\\iCloudDrive\\iCloud~com~apple~Notes
// - C:\\Users\\{username}\\iCloudDrive\\iCloud~com~apple~Pages
// etc.
```

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
Usage: icloudy locate [type] [appName] [options]

Arguments:
  type     Path type to locate: 'root' | 'app' | 'photos' | 'docs' | 'other' | 'all' (default: "root")
  appName  App name (required when type is 'app')

Options:
  -d, --detailed            Show detailed information for each path
  -t, --table              Show results in table format (requires -d)
  -i, --include-inaccessible  Include inaccessible paths
  -m, --min-score <n>      Minimum score threshold for paths (default: 0)
  -j, --json               Output in JSON format
  --no-color               Disable colored output
  -s, --silent             Show errors only

Examples:
  # Find all iCloud paths
  icloudy locate all

  # Find app-specific paths
  icloudy locate app Notes
  icloudy locate app "Apple Pages"

  # Find specific path types
  icloudy locate root     # Find root iCloud Drive directory
  icloudy locate docs     # Find documents directory
  icloudy locate photos   # Find photos directory
  icloudy locate other    # Find other iCloud paths

  # Show detailed information
  icloudy locate -d
  icloudy locate -d -t    # Show in table format
  icloudy locate all -j   # Show all paths in JSON format
```

### copy - Copy Files to iCloud

Copy files and directories to iCloud Drive locations.

```bash
Usage: icloudy copy <source> <type> [appName] [options]

Arguments:
  source   Source path to copy from
  type     Target path type: 'root' | 'app' | 'photos' | 'docs' | 'other'
  appName  App name (required when type is 'app')

Options:
  -p, --pattern <pattern>   File pattern to match (default: *)
  -r, --recursive          Copy directories recursively
  -f, --force             Overwrite existing files
  -d, --dry-run           Show what would be copied without actually copying
  -i, --interactive       Enable interactive confirmation
  -y, --yes              Skip all confirmations
  -D, --detailed         Show detailed copy information
  -t, --table           Show results in table format (requires -D)
  -j, --json            Output results in JSON format
  --no-color           Disable colored output
  -s, --silent         Suppress all output except errors

Examples:
  # Basic copying
  icloudy copy ./localfile root              # Copy to iCloud Drive root
  icloudy copy ./notes app Notes             # Copy to Notes app storage
  icloudy copy ./documents docs              # Copy to Documents folder
  icloudy copy ./images photos               # Copy to Photos folder
  icloudy copy ./misc other                  # Copy to other iCloud location

  # Advanced usage
  icloudy copy ./folder root -r              # Recursive copy
  icloudy copy ./docs docs -p "*.md"         # Copy only markdown files
  icloudy copy ./data app Pages -i           # Interactive mode
  icloudy copy ./backup docs -f              # Force overwrite
  icloudy copy ./project root -d             # Dry run
  icloudy copy ./files docs -D -t            # Show detailed table output
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
- Root Directory:
  Path: /Users/username/Library/Mobile Documents/com~apple~CloudDocs
  Type: root
  Accessible: Yes
  Score: 95
  Contains: Documents, Photos, ...

- App Storage (Notes):
  Path: /Users/username/Library/Mobile Documents/com~apple~Notes
  Type: app
  Accessible: Yes
  Score: 85
  App Name: Notes
  Bundle ID: com.apple.notes
```

#### JSON Output (-j)
```json
{
  "status": "success",
  "timestamp": "2024-01-20T12:00:00Z",
  "paths": [
    {
      "path": "/Users/username/Library/Mobile Documents/com~apple~CloudDocs",
      "type": "root",
      "exists": true,
      "isAccessible": true,
      "score": 95,
      "metadata": {
        "hasICloudMarkers": true,
        "contents": ["Documents", "Photos"],
        "source": {
          "source": "common"
        }
      }
    }
  ]
}
```

## API Reference

### findICloudPaths(options?)

```typescript
interface FindOptions {
  type?: 'root' | 'app' | 'photos' | 'docs' | 'other';  // Filter by path type
  app?: string;    // Filter by app name (only valid with type: 'app')
  verbose?: boolean;  // Include detailed metadata
  includeInaccessible?: boolean;  // Include inaccessible paths
  minScore?: number;  // Minimum confidence score (0-100)
}

// Returns Promise<PathInfo[]>
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