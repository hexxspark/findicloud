import {vol} from 'memfs';
import {homedir, platform} from 'os';

import {ICloudDriveFinder} from '../../finder';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('os', () => ({
  homedir: jest.fn(),
  platform: jest.fn().mockImplementation(() => jest.requireActual('os').platform()),
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
  };
});

// Mock path module
jest.mock('path', () => {
  const actualPath = jest.requireActual('path');
  return {
    ...actualPath,
    sep: '\\',
    win32: actualPath.win32,
    posix: actualPath.posix,
    join: (...args: string[]) => (platform() === 'win32' ? actualPath.win32 : actualPath.posix).join(...args),
  };
});

const {execSync} = require('child_process');

describe('ICloudPathFinder', () => {
  let finder: ICloudDriveFinder;

  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();
  });

  it('should find paths on macOS', async () => {
    execSync.mockReturnValueOnce('testuser\notheruser');
    (platform as jest.Mock).mockReturnValue('darwin');
    (homedir as jest.Mock).mockReturnValue('/Users/testuser');
    const testFiles = {
      '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs': null,
    };
    vol.fromJSON(testFiles);

    finder = new ICloudDriveFinder();
    const paths = await finder.findPaths();

    expect(paths).toContainEqual(
      expect.objectContaining({
        path: '/Users/testuser/Library/Mobile Documents/com~apple~CloudDocs',
      }),
    );
  });

  it('should find paths on Windows', async () => {
    process.env.USERPROFILE = 'C:\\Users\\TestUser';
    (platform as jest.Mock).mockReturnValue('win32');
    (homedir as jest.Mock).mockReturnValue('C:\\Users\\TestUser');
    const testFiles = {
      'C:\\Users\\TestUser\\iCloudDrive': null,
    };
    vol.fromJSON(testFiles);

    finder = new ICloudDriveFinder();
    const paths = await finder.findPaths();

    expect(paths).toContainEqual(
      expect.objectContaining({
        path: 'C:\\Users\\TestUser\\iCloudDrive',
      }),
    );
  });

  it('should throw an error for unsupported platforms', () => {
    (platform as jest.Mock).mockReturnValue('linux');

    expect(() => new ICloudDriveFinder()).toThrow('Unsupported platform: linux');
  });
});
