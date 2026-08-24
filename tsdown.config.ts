/**
 * Build both halves of dsh-serverchan-watchdog:
 *  - node half:   src/index.ts          -> lib/index.js   (ESM, node)
 *  - client half: src/client/index.ts   -> lib/client.js  (CJS closure for window.__ModuleLoader__)
 * The client half imports nothing at runtime (type-only cordis import is erased),
 * so no externals are needed.
 */
import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    name: 'dsh-serverchan-watchdog',
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    clean: false,
    dts: false,
  },
  {
    name: 'dsh-serverchan-watchdog/client',
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    clean: false,
    dts: false,
    sourcemap: true,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-serverchan-watchdog", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
