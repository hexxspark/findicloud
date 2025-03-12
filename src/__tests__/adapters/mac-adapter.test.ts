import {vol} from 'memfs';

import {MacAdapter} from '../../adapters/mac-adapter';

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Mock fs methods
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  const memfs = require('memfs');
  return {
    ...actual,
    existsSync: (path: string) => memfs.vol.existsSync(path),
    readdirSync: (path: string) => memfs.vol.readdirSync(path),
    statSync: (path: string) => memfs.vol.statSync(path),
    promises: {
      ...actual.promises,
      readdir: (path: string, options: any) => memfs.vol.promises.readdir(path, options),
    },
  };
});

// Mock os module
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  platform: jest.fn().mockReturnValue('darwin'),
  homedir: jest.fn().mockReturnValue('/Users/testuser'),
}));

// Mock path module
jest.mock('path', () => {
  const actualPath = jest.requireActual('path');
  return {
    ...actualPath,
    sep: '/',
    posix: actualPath.posix,
    win32: actualPath.win32,
    join: (...args: string[]) => args.join('/'),
  };
});

// Only run these tests on Mac, or on any platform if the environment variable is set
const runTests = process.platform === 'darwin' || process.env.RUN_ALL_TESTS === 'true';
const testFn = runTests ? describe : describe.skip;

testFn('MacAdapter', () => {
  let adapter: MacAdapter;

  beforeEach(() => {
    vol.reset();

    // Set up Mac test file system
    const testFiles = {
      '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/.icloud': '',
      '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Documents/test.txt': 'test content',
      '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Photos/photo1.jpg': 'photo data',
      '/Users/testuser/Library/Mobile Documents/iCloud~com~apple~notes/notes.txt': 'notes content',
      '/Users/testuser/Library/Mobile Documents/iCloud~com~testapp~TestApp/data.json': 'testapp content',
    };

    vol.fromJSON(testFiles);

    // Create directories
    const dirs = [
      '/Users/testuser/Library/Mobile Documents',
      '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs',
      '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Documents',
      '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs/Photos',
      '/Users/testuser/Library/Mobile Documents/iCloud~com~apple~notes',
      '/Users/testuser/Library/Mobile Documents/iCloud~com~testapp~TestApp',
    ];

    for (const dir of dirs) {
      vol.mkdirSync(dir, {recursive: true});
    }

    adapter = new MacAdapter();
  });

  afterEach(() => {
    vol.reset();
    jest.clearAllMocks();
  });

  it('should find iCloud root path', async () => {
    const paths = await adapter.findPaths();
    const rootPath = paths.find(p => p.path.includes('com~apple~CloudDocs'));

    expect(rootPath).toBeDefined();
    expect(rootPath?.isAccessible).toBe(true);
    expect(rootPath?.score).toBeGreaterThan(0);
  });

  it('should find app storage paths', async () => {
    const paths = await adapter.findPaths();
    const appPaths = paths.filter(p => p.metadata.appId);

    expect(appPaths.length).toBeGreaterThan(0);
    expect(appPaths.some(p => p.metadata.appId?.includes('apple~notes'))).toBe(true);
    expect(appPaths.some(p => p.metadata.appId?.includes('testapp~TestApp'))).toBe(true);
  });

  it('should handle file system errors', async () => {
    // Mock file system error
    jest.spyOn(vol.promises, 'readdir').mockRejectedValueOnce(new Error('Permission denied'));

    // Should be able to handle errors gracefully
    const paths = await adapter.findPaths();
    expect(Array.isArray(paths)).toBe(true);
  });
});
