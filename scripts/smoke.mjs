import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const host = await import('../lib/index.js')

assert.equal(host.name, 'serverchan-watchdog')
assert.equal(typeof host.apply, 'function')
assert.ok(host.Config !== null && (typeof host.Config === 'object' || typeof host.Config === 'function'))

const factories = new Map()
globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      factories.set(id, factory)
    },
  },
}

require('../lib/client.js')
assert.ok(factories.has('dsh-serverchan-watchdog'), 'client bundle did not register its plugin id')

const exported = factories.get('dsh-serverchan-watchdog')((id) => {
  if (id === 'react') return { createElement: () => null, Fragment: () => null }
  if (id === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: () => null }
  if (id === 'react-dom' || id === 'react-dom/client') return { createRoot: () => ({ render: () => {} }) }
  return {}
})
assert.ok(exported !== null && typeof exported === 'object', 'client factory must return module exports')

console.log('host + client smoke OK')
