# FindiCloud

FindiCloud is a Node.js library that helps you locate the local path of iCloud Drive on macOS, Windows, and Linux. It automatically detects the operating system and utilizes the appropriate path finder for each platform.

## Features

- **Cross-Platform Support**: Automatically detects whether the operating system is macOS, Windows, or Linux and uses the corresponding path finder.
- **Path Information**: Provides detailed information about the found paths, including accessibility, metadata, and existence.
- **Easy to Use**: Simple API to find iCloud Drive paths.

## Installation

To install the package, use `pnpm`, `npm`, or `yarn`:

```bash
pnpm install findicloud
```

or

```bash
npm install findicloud
```

or

```bash
yarn add findicloud
```

## Usage

Here is a simple example of how to use FindiCloud:

```javascript
import { findICloudPaths } from 'findicloud';

async function main() {
  try {
    const paths = await findICloudPaths();
    console.log('Found iCloud Drive paths:', paths);
  } catch (error) {
    console.error('Error finding iCloud paths:', error);
  }
}

main();
```

## API

### `findICloudPaths()`

- **Returns**: `Promise<PathInfo[]>` - A promise that resolves to an array of `PathInfo` objects, each containing details about the found paths.

### `PathInfo`

The `PathInfo` interface contains the following properties:

- `path`: The path of the found item.
- `score`: A score indicating the relevance of the path.
- `exists`: A boolean indicating whether the path exists.
- `isAccessible`: A boolean indicating whether the path is accessible.
- `metadata`: Additional metadata about the path, including permissions and standard directory markers.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the Apache-2.0 License. See the LICENSE file for more details.
