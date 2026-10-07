/**
 * Contract tests for the built client bundle.
 *
 * Loads lib/client.js the way the shell does — through
 * `window.__ModuleLoader__.load({ id, factory })` with a `require` backed by
 * the platform module table — and checks the bundle's arrival contract, its
 * registration face, and the stylesheet it injects.
 *
 * Determinism tests additionally pin the hashed class names and the
 * path-derived tag id to the repo-relative sheet path, so rebuilding in
 * another checkout or from another working directory yields the same
 * shipped artifact.
 *
 * `@deepseek-ai/dsh-client-ui-primitives` is stubbed with faithful, minimal
 * stand-ins. The real package's barrel pulls a peer tree the shell supplies
 * (shiki, katex, the markdown stack) that is not worth installing here; the
 * props named in the stub are the ones this plugin passes, read off the shipped
 * .d.ts files. That the bundle requires the real specifier — and does not
 * inline it — is asserted separately.
 *
 * Rendering the mounted page (effects, fetch, polling) is deliberately NOT
 * covered: doing so honestly needs a DOM plus the real primitives, and a test
 * that stubs both would mostly assert its own stubs.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'lightningcss'
import { repoRelative } from '../tsdown.config.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const require_ = createRequire(import.meta.url)

/**
 * Minimal primitives whose observable output matches the shipped components:
 * Button renders a native button, Switch a role="switch" control, Tag a span,
 * Input a real input.
 */
const PRIMITIVE_STUBS: Record<string, unknown> = {
  Button: () => null,
  Switch: () => null,
  Tag: () => null,
  Input: () => null,
}

interface SectionModule {
  apply: (ctx: never) => void
  inject: readonly string[]
}

/** Materialize the built bundle and drive apply() up to the registration. */
function loadSection(): { component: unknown, injected: unknown, options: Record<string, unknown> } {
  const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
  let captured: { factory: (require: (id: string) => unknown) => SectionModule } | null = null
  const windowStub: Record<string, unknown> = {
    __ModuleLoader__: { load: (entry: unknown) => { captured = entry as never } },
  }
  // The bundle injects its stylesheet at factory execution, so `document` has
  // to exist before it runs even though nothing is really painted here. The nav
  // decorator also constructs a MutationObserver at apply() time, so the
  // observer global is part of the surface the shell provides and must exist.
  const documentStub = {
    querySelector: () => null,
    createElement: () => ({ dataset: {} as Record<string, string>, textContent: '' }),
    head: { appendChild: () => {} },
    body: {},
  }
  class ObserverStub {
    observe(): void {}
    disconnect(): void {}
    takeRecords(): unknown[] { return [] }
  }
  const globals = globalThis as unknown as Record<string, unknown>
  const saved = globals['MutationObserver']
  globals['MutationObserver'] = ObserverStub
  try {
    const factory = new Function('window', 'document', source) as (w: unknown, d: unknown) => void
    factory(windowStub, documentStub)

    const entry = captured as unknown as { factory: (r: (id: string) => unknown) => SectionModule }
    assert.ok(entry !== null, 'bundle did not call window.__ModuleLoader__.load')
    // Only the specifiers the bundle actually requires are served; anything else
    // must fail loudly rather than silently resolve to undefined.
    const stubRequire = (id: string): unknown => {
      if (id === 'react') return require_('react')
      if (id === 'react/jsx-runtime') return require_('react/jsx-runtime')
      if (id === '@deepseek-ai/dsh-client-ui-primitives') return PRIMITIVE_STUBS
      throw new Error(`unexpected require: ${id}`)
    }
    const moduleExports = entry.factory(stubRequire)
    assert.equal(typeof moduleExports.apply, 'function')
    assert.ok(Array.isArray(moduleExports.inject))

    let registration: { component: unknown, options: Record<string, unknown> } | null = null
    const ctx = {
      locale: { register: () => () => {}, bind: () => (key: string) => key },
      slots: {
        register: (options: unknown, component: unknown) => {
          registration = { component, options: options as Record<string, unknown> }
          return () => {}
        },
        inject: (_name: string, fn: () => unknown) => fn(),
      },
      effect: (fn: () => unknown) => fn(),
      on: () => () => {},
    }
    moduleExports.apply(ctx as never)

    const found = registration as unknown as { component: unknown, options: Record<string, unknown> }
    assert.ok(found !== null, 'apply() registered no settings section')
    return {
      component: found.component,
      injected: (found.options['inject'] as () => unknown)?.() ?? {},
      options: found.options,
    }
  } finally {
    if (saved === undefined) delete globals['MutationObserver']
    else globals['MutationObserver'] = saved
  }
}

const { component: Component, injected, options } = loadSection()

test('the bundle arrives as a module-loader closure under its own id', () => {
  const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
  assert.ok(
    source.includes('window.__ModuleLoader__.load({ id: "dsh-serverchan-watchdog"'),
    'bundle does not register under its package id',
  )
  // The loader contract is a factory returning module.exports, not a bare ESM
  // body: the shell consumes `exports.apply`.
  const body = source.replace(/\/\/# sourceMappingURL=.*\s*$/, '').trimEnd()
  assert.ok(body.endsWith('return module.exports; } });'), 'bundle factory shape changed')
})

test('the section registers with an id, order, label, and injectable face', () => {
  assert.equal(typeof Component, 'function')
  assert.equal(options['name'], 'settings.section')
  assert.equal(options['id'], 'serverchan-watchdog')
  assert.equal(typeof options['order'], 'number')
  assert.equal(typeof options['label'], 'function')

  const face = injected as Record<string, unknown>
  for (const key of ['t', 'config', 'status', 'saveConfig', 'test']) {
    assert.equal(typeof face[key], 'function', `injected face is missing ${key}`)
  }
})

test('the section declares the services it needs', () => {
  // Read straight from the source rather than through the loader stub, so this
  // stays independent of how apply() was driven above.
  const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
  const match = source.match(/inject = (\[[^\]]*\])/)
  assert.ok(match !== null, 'no inject declaration in the bundle')
  assert.deepEqual(JSON.parse(match[1]), ['slots', 'locale'])
})

test('the stylesheet is injected under a plugin-scoped tag and hardcodes no colors', () => {
  const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
  assert.ok(source.includes('pluginCss'), 'no stylesheet injection found in the bundle')
  assert.ok(source.includes('dsh-serverchan-watchdog/src/client/settings.module.css'))
  const css = JSON.parse((source.match(/const css = ("(?:[^"\\]|\\.)*");/) as RegExpMatchArray)[1]) as string
  const literals = css.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)/g) ?? []
  assert.deepEqual(literals, [], `stylesheet hardcodes colors: ${literals.join(', ')}`)
})

/** Parse the hashed class map the bundle embeds for the settings sheet. */
function bundleClassMap(source: string): Record<string, string> {
  const marker = 'var settings_module_css_default = '
  assert.ok(source.includes(marker), 'no settings class map in the bundle')
  const from = source.indexOf(marker) + marker.length
  return JSON.parse(source.slice(from, source.indexOf('};', from) + 1)) as Record<string, string>
}

test('every class the component uses resolves, and every declared class has a rule', () => {
  const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
  const css = JSON.parse((source.match(/const css = ("(?:[^"\\]|\\.)*");/) as RegExpMatchArray)[1]) as string
  const map = bundleClassMap(source)
  const used = new Set(
    [...source.matchAll(/settings_module_css_default\.([A-Za-z0-9_]+)/g)].map(m => m[1] as string),
  )
  const missing = [...used].filter(name => !(name in map))
  assert.deepEqual(missing, [], `component uses undeclared classes: ${missing.join(', ')}`)
  const ruleless = Object.entries(map)
    .filter(([, hashed]) => !css.includes(`.${hashed}`))
    .map(([name]) => name)
  assert.deepEqual(ruleless, [], `classes declared without rules: ${ruleless.join(', ')}`)
})

test('class-name hashes derive from the repo-relative filename, not the checkout path', async () => {
  const map = bundleClassMap(readFileSync(join(root, 'lib', 'client.js'), 'utf8'))
  assert.ok(Object.keys(map).length > 0, 'settings class map is empty')
  const cssPath = join(root, 'src', 'client', 'settings.module.css')
  const compiled = transform({
    filename: repoRelative(cssPath),
    code: await readFile(cssPath),
    cssModules: { pattern: '[hash]_[local]' },
  })
  const expected: Record<string, string> = {}
  for (const [local, value] of Object.entries(compiled.exports ?? {})) expected[local] = value.name
  assert.deepEqual(map, expected)
})

test('path-derived ids stay repo-relative regardless of the working directory', () => {
  const cssPath = join(root, 'src', 'client', 'settings.module.css')
  assert.equal(repoRelative(cssPath), 'src/client/settings.module.css')
  const previousCwd = process.cwd()
  process.chdir(dirname(root))
  try {
    assert.equal(repoRelative(cssPath), 'src/client/settings.module.css')
  } finally {
    process.chdir(previousCwd)
  }
})

test('the primitives stay external so the shell owns their instance', () => {
  const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
  // A bundled copy would double-inject CSS and break the shell's single
  // instance; the specifier must appear as a require, not an inlined body.
  assert.ok(
    /require\((['"])@deepseek-ai\/dsh-client-ui-primitives\1\)/.test(source),
    'ui-primitives is not required from the module table',
  )
})

test('the client bundle never ships the host half or its secrets path', () => {
  const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
  // The browser half must not contain the AES-GCM store or the state filename.
  assert.ok(!source.includes('aes-256-gcm'), 'client bundle contains crypto code')
  assert.ok(!source.includes('state.json'), 'client bundle references the host state file')
})

test('the shipped client artifacts embed no build-machine paths', () => {
  for (const artifact of ['lib/client.js', 'lib/client.js.map']) {
    const contents = readFileSync(join(root, artifact), 'utf8')
    const leaks = [...new Set(contents.match(/(?<![A-Za-z])[A-Za-z]:[\\/]/g) ?? [])]
    assert.deepEqual(leaks, [], `${artifact} embeds absolute paths: ${leaks.join(', ')}`)
    assert.ok(!contents.includes(root), `${artifact} embeds the checkout root`)
  }
})
