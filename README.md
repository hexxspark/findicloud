# iCloudy

A modern CLI tool for managing your iCloud Drive files and directories. Currently supports locating iCloud paths on
macOS and Windows.

## Features

- **Cross-Platform Support**: Automatically detects whether the operating system is macOS, Windows, or Linux and uses
  the corresponding path finder.
- **Path Information**: Provides detailed information about the local iCloud paths, including accessibility, metadata,
  and existence.
- **Easy to Use**: Simple API to locate iCloud Drive paths.

## Installation

```bash
npm install -g icloudy
```

## Usage

```bash
# Show all local iCloud paths
icloudy path

# Show specific app storage location
icloudy path -a "notes"

# Show only root paths
icloudy path -t root

# Output in JSON format
icloudy path --json
```

Here is a simple example of how to use iCloudy in your code:

```javascript
import {findICloudPaths} from 'icloudy';

async function main() {
  try {
    const paths = await findICloudPaths();
    console.log('Local iCloud Drive paths:', paths);
  } catch (error) {
    console.error('Error locating iCloud paths:', error);
  }
}

main();
```

### Example for Different Platforms

You can also handle different platforms by checking the operating system:

```javascript
import {findICloudPaths} from 'icloudy';
import os from 'os';

async function main() {
  try {
    const paths = await findICloudPaths();
    console.log('Found iCloud Drive paths:', paths);

    if (os.platform() === 'win32') {
      console.log('This is a Windows system.');
    } else if (os.platform() === 'darwin') {
      console.log('This is a macOS system.');
    } else {
      console.log('This is a Linux system.');
    }
  } catch (error) {
    console.error('Error finding iCloud paths:', error);
  }
}

main();
```

## API

### `findICloudPaths()`

- **Returns**: `Promise<PathInfo[]>` - A promise that resolves to an array of `PathInfo` objects, each containing
  details about the found paths.

### `PathInfo`

The `PathInfo` interface contains the following properties:

- `path`: The path of the found item.
- `score`: A score indicating the relevance of the path.
- `exists`: A boolean indicating whether the path exists.
- `isAccessible`: A boolean indicating whether the path is accessible.
- `type`: The type of the path (e.g., root, app storage).
- `metadata`: Additional metadata about the path, including permissions and standard directory markers.

#### `metadata` properties

The `metadata` property is defined by the `PathMetadata` interface, which includes the following fields:

- `stats`: An object containing statistics about the path.
- `contents`: An array of strings representing the contents of the directory.
- `hasICloudMarkers`: A boolean indicating if the path has iCloud markers.
- `source`: An object representing the source of the path.
- `appId`: A string representing the application ID.
- `appName`: A string representing the application name.
- `bundleId`: A string representing the bundle ID.
- `vendor`: A string representing the vendor.
- `[key: string]: any`: Additional properties.

#### `metadata` example

```json
{
  "path": "C:\\Users\\User\\iCloudDrive\\ExamplePath",
  "score": 28,
  "exists": true,
  "isAccessible": true,
  "metadata": {
    "stats": {
      "dev": 1234567890,
      "mode": 16676,
      "nlink": 1,
      "uid": 0,
      "gid": 0,
      "rdev": 0,
      "blksize": 4096,
      "ino": 123456789012345,
      "size": 0,
      "blocks": 0,
      "atimeMs": 1732551810060.3833,
      "mtimeMs": 1730961453144.7986,
      "ctimeMs": 1730961453144.7986,
      "birthtimeMs": 1730961449000
    },
    "contents": ["file1.txt", "file2.txt"],
    "hasICloudMarkers": true,
    "source": {
      "source": "appStorage",
      "rootPath": "C:\\Users\\User\\iCloudDrive"
    },
    "appId": "ExampleAppID",
    "appName": "ExampleApp",
    "bundleId": "com.example.ExampleApp",
    "vendor": "com.example"
  },
  "type": "app_storage"
}
```

## Frequently Asked Questions (FAQ)

### 1. What should I do if the paths are not found?

If the paths are not found, ensure that iCloud Drive is installed and properly configured on your system. You may also
want to check your permissions.

### 2. Is this library compatible with all versions of Node.js?

This library is compatible with Node.js version 12 and above. Please ensure you are using a supported version.

### 3. How can I contribute to this project?

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the Apache-2.0 License. See the LICENSE file for more details.
