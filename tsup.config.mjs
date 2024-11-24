import {defineConfig} from 'tsup';

export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/__tests__/**'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  treeshake: true,
  outExtension({format}) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    };
  },
});
