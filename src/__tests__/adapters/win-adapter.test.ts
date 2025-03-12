import {execSync} from 'child_process';
import {vol} from 'memfs';

import {WindowsAdapter} from '../../adapters/win-adapter';

// Only run these tests on Windows, or on any platform if the environment variable is set
const runTests = process.platform === 'win32' || process.env.RUN_ALL_TESTS === 'true';
const testFn = runTests ? describe : describe.skip;

// Mock dependencies
jest.mock('child_process');
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  platform: jest.fn().mockReturnValue('win32'),
  homedir: jest.fn().mockReturnValue('C:\\Users\\TestUser'),
}));

// Mock file system
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const memfs = require('memfs');
  return {
    ...actualFs,
    existsSync: (path: string) => memfs.vol.existsSync(path),
    readdirSync: (path: string) => memfs.vol.readdirSync(path),
    statSync: (path: string) => memfs.vol.statSync(path),
    promises: {
      ...actualFs.promises,
      readdir: (path: string, options: any) => memfs.vol.promises.readdir(path, options),
    },
  };
});

// Mock path module
jest.mock('path', () => {
  const actualPath = jest.requireActual('path');
  return {
    ...actualPath,
    sep: '\\',
    join: (...args: string[]) => args.join('\\'),
  };
});

// Handle jest mock types
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

testFn('WindowsAdapter', () => {
  let adapter: WindowsAdapter;

  beforeEach(() => {
    vol.reset();
    process.env.USERPROFILE = 'C:\\Users\\TestUser';

    // Set up Windows test file system
    const testFiles = {
      'C:\\Users\\TestUser\\iCloudDrive\\desktop.ini': 'iCloud config',
      'C:\\Users\\TestUser\\iCloudDrive\\.icloud': '',
      'C:\\Users\\TestUser\\iCloudDrive\\Documents\\test.txt': 'test content',
      'C:\\Users\\TestUser\\iCloudDrive\\Photos\\photo1.jpg': 'photo data',
      'C:\\Users\\TestUser\\iCloudDrive\\iCloud~com~apple~notes\\notes.txt': 'notes content',
      'C:\\Users\\TestUser\\iCloudDrive\\iCloud~com~testapp~TestApp\\data.json': 'testapp content',
    };

    // Convert paths to the correct format
    const normalizedFiles = Object.entries(testFiles).reduce(
      (acc, [key, value]) => {
        const normalizedPath = key.replace(/\//g, '\\');
        acc[normalizedPath] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    vol.fromJSON(normalizedFiles);

    // Create directories
    const dirs = [
      'C:\\Users\\TestUser\\iCloudDrive',
      'C:\\Users\\TestUser\\iCloudDrive\\Documents',
      'C:\\Users\\TestUser\\iCloudDrive\\Photos',
      'C:\\Users\\TestUser\\iCloudDrive\\iCloud~com~apple~notes',
      'C:\\Users\\TestUser\\iCloudDrive\\iCloud~com~testapp~TestApp',
    ];

    for (const dir of dirs) {
      vol.mkdirSync(dir, {recursive: true});
    }

    // Mock registry query response
    mockedExecSync.mockReturnValue(
      Buffer.from(
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\SyncRootManager\\iCloudDrive\r\n' +
          '    UserSyncRootPath    REG_SZ    C:\\Users\\TestUser\\iCloudDrive\r\n',
      ),
    );

    adapter = new WindowsAdapter();
  });

  afterEach(() => {
    vol.reset();
    jest.clearAllMocks();
  });

  it('should find iCloud root path', async () => {
    const paths = await adapter.findPaths();
    const rootPath = paths.find(p => p.path === 'C:\\Users\\TestUser\\iCloudDrive');

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

  it('should handle registry access errors', async () => {
    mockedExecSync.mockImplementationOnce(() => {
      throw new Error('Registry access denied');
    });

    // Create a new adapter instance, so it will try to read from the registry
    const newAdapter = new WindowsAdapter();
    const paths = await newAdapter.findPaths();

    // Should be able to find default paths even if registry access fails
    expect(paths.length).toBeGreaterThan(0);
  });
});
