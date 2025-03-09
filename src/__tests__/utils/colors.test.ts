import { PathInfo, PathType } from '../../types';
import { colors, setColorEnabled } from '../../utils/colors';

describe('colors utility', () => {
    beforeEach(() => {
        setColorEnabled(true);
    });

    describe('basic color functions', () => {
        it('should apply colors when enabled', () => {
            expect(colors.success('test')).toMatch(/\u001b\[\d+mtest\u001b\[0m/);
            expect(colors.error('test')).toMatch(/\u001b\[\d+mtest\u001b\[0m/);
            expect(colors.warning('test')).toMatch(/\u001b\[\d+mtest\u001b\[0m/);
            expect(colors.info('test')).toMatch(/\u001b\[\d+mtest\u001b\[0m/);
        });

        it('should not apply colors when disabled', () => {
            setColorEnabled(false);
            expect(colors.success('test')).toBe('test');
            expect(colors.error('test')).toBe('test');
            expect(colors.warning('test')).toBe('test');
            expect(colors.info('test')).toBe('test');
        });
    });

    describe('path type colors', () => {
        it('should apply colors to all path types', () => {
            Object.values(PathType).forEach(type => {
                expect(colors.pathType[type]('test')).toMatch(/\u001b\[\d+mtest\u001b\[0m/);
            });
        });

        it('should not apply colors to path types when disabled', () => {
            setColorEnabled(false);
            Object.values(PathType).forEach(type => {
                expect(colors.pathType[type]('test')).toBe('test');
            });
        });
    });

    describe('format functions', () => {
        it('should format path info with colors', () => {
            const pathInfo: PathInfo = {
                path: '/test/path',
                type: PathType.APP,
                score: 100,
                isAccessible: true,
                exists: true,
                metadata: {
                    appName: 'TestApp',
                    bundleId: 'com.test.app'
                }
            };
            const formatted = colors.formatPath(pathInfo);
            expect(formatted).toContain('/test/path');
            expect(formatted).toContain('TestApp');
            expect(formatted).toContain('com.test.app');
        });

        it('should format path info without colors', () => {
            setColorEnabled(false);
            const pathInfo: PathInfo = {
                path: '/test/path',
                type: PathType.DOCS,
                score: 100,
                isAccessible: false,
                exists: true,
                metadata: {}
            };
            const formatted = colors.formatPath(pathInfo);
            expect(formatted).toBe('✗ /test/path [DOCS]');
        });

        it('should format help text with colors', () => {
            const helpText = `Usage: test command
  -h, --help     Show help
Commands:
  test    Test command`;
            const formatted = colors.formatHelp(helpText);
            expect(formatted).toMatch(/\u001b\[\d+m/);
        });

        it('should format help text without colors', () => {
            setColorEnabled(false);
            const helpText = `Usage: test command
  -h, --help     Show help
Commands:
  test    Test command`;
            expect(colors.formatHelp(helpText)).toBe(helpText);
        });

        it('should format error messages', () => {
            expect(colors.formatError('test error')).toMatch(/Error:/);
            setColorEnabled(false);
            expect(colors.formatError('test error')).toBe('Error: test error');
        });

        it('should format success messages', () => {
            expect(colors.formatSuccess('test success')).toMatch(/Success:/);
            setColorEnabled(false);
            expect(colors.formatSuccess('test success')).toBe('Success: test success');
        });

        it('should format warning messages', () => {
            expect(colors.formatWarning('test warning')).toMatch(/Warning:/);
            setColorEnabled(false);
            expect(colors.formatWarning('test warning')).toBe('Warning: test warning');
        });

        it('should format progress messages', () => {
            expect(colors.formatProgress(1, 10, 'test')).toMatch(/\[1\/10\]/);
            setColorEnabled(false);
            expect(colors.formatProgress(1, 10, 'test')).toBe('[1/10] test');
        });
    });
}); 