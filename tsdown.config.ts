/**
 * Build both halves of dsh-serverchan-watchdog:
 *  - node half:   src/index.ts            -> lib/index.js   (ESM, node)
 *  - client half: src/client/index.tsx    -> lib/client.js  (CJS closure for window.__ModuleLoader__)
 *
 * Client externals mirror the loader module table
 * (packages/client/web/src/platform.ts): React, Cordis, slots, and the shared
 * ui-primitives controls the settings page composes.
 *
 * `*.module.css` is compiled here instead of by tsdown's CSS pipeline, which
 * the loader artifact does not consume: each sheet becomes its hashed class
 * map plus one `<style data-plugin=...>` tag injected when the factory runs,
 * the same mechanism ui-primitives ships.
 */
import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'lightningcss'
import { defineConfig, type Options } from 'tsdown'

/** Plugin id; also the `style[data-plugin]` marker and module-table row name. */
const PLUGIN_ID = 'dsh-serverchan-watchdog'

/** Directory of this config file; the one anchor that survives every checkout. */
const CONFIG_ROOT = dirname(fileURLToPath(import.meta.url))

/** Rolldown plugin shape accepted by tsdown's `plugins` option. */
type TsdownPlugin = Extract<Options['plugins'], readonly unknown[]>[number]

/**
 * Repo-relative, forward-slash form of a repo path. Class-name hashes and
 * style-tag ids are derived from this string, so they stay independent of
 * where the checkout lives and which working directory ran the build.
 * Exported for the client-render regression tests.
 */
export function repoRelative(fileId: string): string {
  return relative(CONFIG_ROOT, fileId).replaceAll('\\', '/')
}

const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
] as const

const CLIENT_EXTERNALS: readonly string[] = [...PLATFORM_MODULES, '@deepseek-ai/dsh-client-runtime/client']

/**
 * Virtual-id prefix keeping CSS Modules away from tsdown's own `.css` handling.
 * The suffix must not end in `.css` so the pipeline's CSS guard does not claim it.
 */
const CSS_VIRTUAL_PREFIX = '\0watchdog-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Stable, path-derived id so a rebuilt sheet keeps injecting under one tag. */
function cssTagId(repoPath: string): string {
  return `${PLUGIN_ID}/${repoPath}`
}

/**
 * Compile `*.module.css` to a hashed class map plus a one-time style injection.
 * @returns A tsdown plugin resolving CSS Modules imports in the client build.
 */
function cssModulesPlugin(): TsdownPlugin {
  return {
    name: 'watchdog-css-modules',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const base = importer === undefined ? process.cwd() : resolve(importer, '..')
      // Rolldown echoes module ids into `//#region` comments, so the virtual
      // id carries the repo-relative path; an absolute id would ship the
      // build machine's directory layout inside lib/client.js.
      return CSS_VIRTUAL_PREFIX + repoRelative(resolve(base, source)) + CSS_VIRTUAL_SUFFIX
    },
    async load(id: string) {
      if (!id.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const repoPath = id.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      const compiled = transform({
        filename: repoPath,
        code: await readFile(resolve(CONFIG_ROOT, repoPath)),
        cssModules: { pattern: '[hash]_[local]' },
      })
      const classMap: Record<string, string> = {}
      for (const [local, value] of Object.entries(compiled.exports ?? {})) classMap[local] = value.name
      return [
        `const css = ${JSON.stringify(compiled.code.toString())};`,
        `const tagId = ${JSON.stringify(cssTagId(repoPath))};`,
        'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css="\' + tagId + \'"]\') === null) {',
        '  const tag = document.createElement(\'style\');',
        `  tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};`,
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        `export default ${JSON.stringify(classMap)};`,
      ].join('\n')
    },
  }
}

export default defineConfig([
  {
    name: PLUGIN_ID,
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    clean: false,
    dts: false,
  },
  {
    name: `${PLUGIN_ID}/client`,
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    clean: false,
    dts: false,
    sourcemap: true,
    external: [...CLIENT_EXTERNALS],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    plugins: [cssModulesPlugin()],
    noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
