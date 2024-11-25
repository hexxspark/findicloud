import * as fs from 'fs';
import {vol} from 'memfs';
import path from 'path';

import {WindowsPathFinder} from '../../platforms/win';
import {PathType} from '../../types';

const mockExecSync = jest.fn();

jest.mock('child_process', () => ({
  execSync: (...args: string[]) => mockExecSync(...args),
}));

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

describe('WindowsPathFinder', () => {
  let finder: WindowsPathFinder;
  let originalUserProfile: string | undefined;

  beforeAll(() => {
    originalUserProfile = process.env.USERPROFILE;
  });

  afterAll(() => {
    if (originalUserProfile) {
      process.env.USERPROFILE = originalUserProfile;
    } else {
      delete process.env.USERPROFILE;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();
    process.env.USERPROFILE = 'C:\\Users\\TestUser';

    // Setup directory structure
    const testDirs = [
      'C:\\Users\\TestUser\\iCloudDrive',
      'C:\\Users\\TestUser\\iCloudDrive\\iCloud~dk~simonbs~Scriptable',
      'C:\\Users\\TestUser\\iCloudDrive\\iCloud~is~workflow~my~workflows',
      'C:\\Users\\TestUser\\iCloudDrive\\4R6749AYRE~com~pixelmatorteam~pixelmator',
      'C:\\Users\\TestUser\\iCloudDrive\\W6L39UYL6Z~com~mindnode~MindNode',
      'C:\\Users\\TestUser\\iCloudDrive\\iCloud~com~apple~numbers~Numbers',
      'C:\\Users\\TestUser\\iCloudDrive\\XYZ123ABCD~com~company~app~SubApp.Module',
      'C:\\Users\\TestUser\\iCloudDrive\\iCloud~com~apple~pages~Pages',
    ];

    // Create directories
    for (const dir of testDirs) {
      vol.mkdirSync(dir, {recursive: true});
    }

    // Setup test files
    const testFiles = {
      'C:\\Users\\TestUser\\iCloudDrive\\desktop.ini': 'iCloud config',
      'C:\\Users\\TestUser\\iCloudDrive\\.icloud': '',
      'C:\\Users\\TestUser\\iCloudDrive\\iCloud~dk~simonbs~Scriptable\\script.js': 'script content',
      'C:\\Users\\TestUser\\iCloudDrive\\iCloud~is~workflow~my~workflows\\workflow.conf': 'workflow content',
      'C:\\Users\\TestUser\\iCloudDrive\\4R6749AYRE~com~pixelmatorteam~pixelmator\\image.pxd': 'image content',
      'C:\\Users\\TestUser\\iCloudDrive\\W6L39UYL6Z~com~mindnode~MindNode\\mindmap.mindnode': 'mindmap content',
      'C:\\Users\\TestUser\\iCloudDrive\\iCloud~com~apple~numbers~Numbers\\spreadsheet.numbers': 'numbers content',
      'C:\\Users\\TestUser\\iCloudDrive\\XYZ123ABCD~com~company~app~SubApp.Module\\data.dat': 'module content',
      'C:\\Users\\TestUser\\iCloudDrive\\iCloud~com~apple~pages~Pages\\document.pages': 'pages content',
    };

    vol.fromJSON(testFiles);

    // Mock registry response
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('reg query')) {
        return `
HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\SyncRootManager\\iCloudDrive
    UserSyncRootPath    REG_SZ    C:\\Users\\TestUser\\iCloudDrive
`;
      }
      return '';
    });

    finder = new WindowsPathFinder();
  });

  describe('Path Discovery', () => {
    it('should find root iCloud path', async () => {
      const paths = await finder.findPaths();
      expect(paths.some(p => p.path === 'C:\\Users\\TestUser\\iCloudDrive' && p.type === PathType.ROOT)).toBeTruthy();
    });

    it('should find all app storage paths with different formats', async () => {
      const paths = await finder.findPaths();
      const appPaths = paths.filter(p => p.type === PathType.APP_STORAGE);

      expect(appPaths.length).toBe(7);
      expect(appPaths.some(p => p.metadata.appId?.includes('simonbs~Scriptable'))).toBeTruthy();
      expect(appPaths.some(p => p.metadata.appId?.includes('workflow~my~workflows'))).toBeTruthy();
      expect(appPaths.some(p => p.metadata.appId?.includes('pixelmatorteam~pixelmator'))).toBeTruthy();
      expect(appPaths.some(p => p.metadata.appId?.includes('mindnode~MindNode'))).toBeTruthy();
      expect(appPaths.some(p => p.metadata.appId?.includes('apple~numbers~Numbers'))).toBeTruthy();
      expect(appPaths.some(p => p.metadata.appId?.includes('company~app~SubApp.Module'))).toBeTruthy();
      expect(appPaths.some(p => p.metadata.appId?.includes('apple~pages~Pages'))).toBeTruthy();
    });

    it('should correctly identify app paths starting with ID', async () => {
      const paths = await finder.findPaths();
      const pixelmatorApp = paths.find(p => p.metadata.appId?.includes('pixelmator'));
      const mindnodeApp = paths.find(p => p.metadata.appId?.includes('mindnode'));

      expect(pixelmatorApp?.type).toBe(PathType.APP_STORAGE);
      expect(mindnodeApp?.type).toBe(PathType.APP_STORAGE);

      expect(pixelmatorApp?.metadata.bundleId).toBe('com.pixelmatorteam.pixelmator');
      expect(mindnodeApp?.metadata.bundleId).toBe('com.mindnode.MindNode');
    });

    it('should handle complex app names with dots and multiple segments', async () => {
      const paths = await finder.findPaths();
      const complexApp = paths.find(p => p.metadata.appId?.includes('SubApp.Module'));

      expect(complexApp).toBeDefined();
      expect(complexApp?.type).toBe(PathType.APP_STORAGE);
      expect(complexApp?.metadata.bundleId).toBe('com.company.app.SubApp.Module');
      expect(complexApp?.metadata.appName).toBe('SubApp Module');
    });
  });

  describe('Registry Handling', () => {
    it('should handle registry access errors', async () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('Registry access denied');
      });

      const paths = await finder.findPaths();
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should handle missing registry keys', async () => {
      mockExecSync.mockReturnValue('');

      const paths = await finder.findPaths();
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  describe('Path Metadata', () => {
    it('should correctly parse iCloud~ format app metadata', async () => {
      const paths = await finder.findPaths();
      const scriptableApp = paths.find(p => p.metadata.appId?.includes('Scriptable'));
      const numbersApp = paths.find(p => p.metadata.appId?.includes('Numbers'));

      expect(scriptableApp).toBeDefined();
      expect(scriptableApp?.metadata.bundleId).toBe('dk.simonbs.Scriptable');
      expect(scriptableApp?.metadata.appName).toBe('Scriptable');

      expect(numbersApp).toBeDefined();
      expect(numbersApp?.metadata.bundleId).toBe('com.apple.numbers.Numbers');
      expect(numbersApp?.metadata.appName).toBe('Numbers');
    });

    it('should correctly parse ID~ format app metadata', async () => {
      const paths = await finder.findPaths();
      const mindnodeApp = paths.find(p => p.metadata.appId?.includes('mindnode'));
      const pixelmatorApp = paths.find(p => p.metadata.appId?.includes('pixelmator'));

      expect(mindnodeApp).toBeDefined();
      expect(mindnodeApp?.metadata.bundleId).toBe('com.mindnode.MindNode');
      expect(mindnodeApp?.metadata.appName).toBe('MindNode');

      expect(pixelmatorApp).toBeDefined();
      expect(pixelmatorApp?.metadata.bundleId).toBe('com.pixelmatorteam.pixelmator');
      expect(pixelmatorApp?.metadata.appName).toBe('Pixelmator');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing USERPROFILE', async () => {
      delete process.env.USERPROFILE;
      const paths = await finder.findPaths();
      expect(Array.isArray(paths)).toBeTruthy();
    });

    it('should handle inaccessible directories', async () => {
      jest.spyOn(vol.promises, 'readdir').mockRejectedValueOnce(new Error('EACCES: permission denied'));

      const paths = await finder.findPaths();
      expect(Array.isArray(paths)).toBeTruthy();
    });

    // it('should handle invalid directory entries', async () => {
    //   jest.spyOn(vol.promises, 'readdir').mockResolvedValueOnce([
    //     {isDirectory: () => true, name: 'iCloud~dk~simonbs~Scriptable'},
    //     {isDirectory: () => false, name: 'desktop.ini'},
    //     {isDirectory: () => true, name: 'invalid~format~path'},
    //     {isDirectory: () => true, name: '4R6749AYRE~invalid~path'},
    //   ] as any);

    //   const paths = await finder.findPaths();
    //   expect(Array.isArray(paths)).toBeTruthy();
    //   expect(paths.every(p => p.metadata.bundleId !== undefined)).toBeTruthy();
    // });
  });
});
