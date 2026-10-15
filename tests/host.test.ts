/**
 * Host-side unit coverage: encrypted settings store (round-trip, atomic patch
 * validation, clear semantics), loopback/CSRF guards, and the ServerChan
 * pusher (form-urlencoded request, success/code checks, failure redaction).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import './env-isolation.ts'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { apply, StoreError, SettingsStore, guardLoopback, guardWrite, pushDesp, sendPush, type Config, type EffectiveSettings } from '../src/index.ts'

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'scw-test-'))
}

test('registered status and config handlers expose only safe fields, never storage paths', async () => {
  const dir = tempDir()
  assert.equal(isAbsolute(dir), true)
  type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>
  const routes = new Map<string, Handler>()
  const cleanups: Array<() => void> = []
  const ctx = {
    logger: () => ({ info() {}, warn() {} }),
    on() {},
    get() { return undefined },
    effect(callback: () => void | (() => void)) {
      const cleanup = callback()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
    },
    inject(_services: string[], callback: (context: unknown) => void) { callback(ctx) },
    webServer: {
      register(route: { path: string; handler: Handler }) {
        routes.set(route.path, route.handler)
        return () => { routes.delete(route.path) }
      },
    },
  }
  try {
    apply(ctx as unknown as Parameters<typeof apply>[0], { enabled: false, stateDir: dir })
    const configKeys = [
      'ok', 'enabled', 'thresholdMinutes', 'repeatMinutes', 'title', 'webUrl',
      'proxy', 'credentialConfigured', 'hasStoredKey',
    ]
    for (const [path, method] of [
      ['/serverchan-watchdog/status', 'GET'],
      ['/serverchan-watchdog/config', 'GET'],
      ['/serverchan-watchdog/config', 'POST'],
    ]) {
      const handler = routes.get(path)
      assert.ok(handler, `apply registered ${path}`)
      const req = Readable.from(method === 'POST' ? [Buffer.from('{"thresholdMinutes":7}')] : [])
      Object.assign(req, {
        method,
        socket: { remoteAddress: '127.0.0.1' },
        headers: { host: '127.0.0.1:3080', 'content-type': 'application/json' },
      })
      let status = 0
      let raw = ''
      const res = {
        writeHead(code: number) { status = code },
        end(body: string) { raw = body },
      } as unknown as ServerResponse
      await handler(req as unknown as IncomingMessage, res)
      assert.equal(status, 200, `${method} ${path}`)
      const body = JSON.parse(raw) as Record<string, unknown>
      const expectedKeys = path.endsWith('/status') ? [...configKeys, 'pending', 'ignored'] : configKeys
      assert.deepEqual(Object.keys(body).sort(), [...expectedKeys].sort(), `${method} ${path} whitelist`)
      assert.equal(Object.hasOwn(body, 'stateDir'), false)
      assert.equal(raw.includes(JSON.stringify(dir).slice(1, -1)), false)
      assert.equal(raw.includes(basename(dir)), false)
      assert.equal(body['thresholdMinutes'], method === 'POST' ? 7 : 5)
      assert.equal(body['credentialConfigured'], false)
    }
    // The custom host directory still holds the saved settings internally.
    assert.equal(new SettingsStore(dir).thresholdMinutes, 7)
  } finally {
    for (const cleanup of cleanups.reverse()) cleanup()
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()))
    assert.ok(basename(dir).startsWith('scw-test-'))
    rmSync(dir, { recursive: true, force: true })
  }
})

test('SettingsStore round-trips the encrypted sendkey and numeric fields', () => {
  const dir = tempDir()
  try {
    const store = new SettingsStore(dir)
    assert.equal(store.hasStoredKey, false)
    store.update({
      sendkey: 'SCTabc123',
      thresholdMinutes: 7,
      repeatMinutes: 3,
      proxy: 'http://127.0.0.1:7897',
    })
    const again = new SettingsStore(dir)
    assert.equal(again.sendkey, 'SCTabc123')
    assert.equal(again.hasStoredKey, true)
    assert.equal(again.thresholdMinutes, 7)
    assert.equal(again.repeatMinutes, 3)
    assert.equal(again.proxy, 'http://127.0.0.1:7897')
    // The SendKey never lands in plaintext on disk.
    const raw = readFileSync(join(dir, 'state.json'), 'utf8')
    assert.ok(!raw.includes('SCTabc123'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('SettingsStore rejects invalid patches atomically', () => {
  const dir = tempDir()
  try {
    const store = new SettingsStore(dir)
    store.update({ thresholdMinutes: 5 })
    assert.throws(() => store.update({ thresholdMinutes: 9999 }), StoreError)
    assert.throws(() => store.update({ repeatMinutes: -1 }), StoreError)
    assert.throws(() => store.update({ proxy: 'ftp://x' }), StoreError)
    assert.throws(() => store.update({ proxy: 'http://u:p@x' }), StoreError)
    assert.throws(() => store.update({ proxy: 'http://proxy.local/path' }), StoreError)
    assert.throws(() => store.update({ proxy: 'http://proxy.local/?token=secret' }), StoreError)
    assert.throws(() => store.update({ proxy: 'http://proxy.local/#fragment' }), StoreError)
    assert.throws(() => store.update({ sendkey: 'https://evil.example.com/k' }), StoreError)
    // The accepted value survived every rejected patch.
    assert.equal(store.thresholdMinutes, 5)
    // Empty-string clears; undefined keeps.
    store.update({ proxy: '' })
    assert.equal(store.proxy, '')
    store.update({ webUrl: 'http://192.168.1.10:3080' })
    assert.equal(store.webUrl, 'http://192.168.1.10:3080')
    // Any dsh:// URL collapses to the one URL the desktop client reacts to.
    store.update({ webUrl: 'dsh://open/' })
    assert.equal(store.webUrl, 'dsh://open')
    store.update({ webUrl: 'DSH://some/route?x=1' })
    assert.equal(store.webUrl, 'dsh://open')
    // Empty webUrl now persists "push without a link" instead of falling back.
    store.update({ webUrl: '' })
    assert.equal(store.webUrl, '')
    assert.equal(store.noLink, true)
    assert.throws(() => store.update({ webUrl: 'ftp://x' }), StoreError)
    assert.throws(() => store.update({ webUrl: 'javascript:alert(1)' }), StoreError)
    assert.throws(() => store.update({ webUrl: 'file:///C:/Windows' }), StoreError)
    // The accepted no-link choice survived every rejected patch.
    assert.equal(store.noLink, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('webUrl: no-link choice persists, and a concrete value clears it', () => {
  const dir = tempDir()
  try {
    const store = new SettingsStore(dir)
    store.update({ webUrl: '' })
    const again = new SettingsStore(dir)
    assert.equal(again.webUrl, '')
    assert.equal(again.noLink, true)
    again.update({ webUrl: 'http://192.168.1.10:3080' })
    const third = new SettingsStore(dir)
    assert.equal(third.webUrl, 'http://192.168.1.10:3080')
    assert.equal(third.noLink, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('SettingsStore keeps the master switch unset until the page writes it', () => {
  const dir = tempDir()
  try {
    const store = new SettingsStore(dir)
    // Unset (not false) so the bundle-patch Config still wins until the user
    // touches the switch; `store.enabled ?? config.enabled` relies on it.
    assert.equal(store.enabled, undefined)
    store.update({ enabled: false })
    const again = new SettingsStore(dir)
    assert.equal(again.enabled, false)
    again.update({ enabled: true })
    const third = new SettingsStore(dir)
    assert.equal(third.enabled, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('SettingsStore bounds the push title and clears it back to the default', () => {
  const dir = tempDir()
  try {
    const store = new SettingsStore(dir)
    assert.equal(store.title, '')
    store.update({ title: '  需要确认  ' })
    assert.equal(store.title, '需要确认')
    // Exactly at the cap is kept; one character over is rejected.
    const max = '字'.repeat(32)
    store.update({ title: max })
    assert.equal(store.title, max)
    assert.throws(() => store.update({ title: '字'.repeat(33) }), StoreError)
    assert.equal(store.title, max)
    // Trimming to empty removes the override rather than storing ''.
    store.update({ title: '   ' })
    assert.equal(store.title, '')
    const again = new SettingsStore(dir)
    assert.equal(again.title, '')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

const despPending = {
  id: 'q:call-1',
  kind: 'question' as const,
  sessionId: 'sess-1',
  detail: '需要确认',
  startedAt: Date.now() - 6 * 60_000,
  pushes: 1,
}

const despEff: EffectiveSettings = {
  enabled: true,
  thresholdMinutes: 5,
  repeatMinutes: 0,
  title: 'DSH 等待人工确认',
  webUrl: '',
  proxy: '',
}

const despConfig: Config = {}

test('pushDesp labels the link by scheme and omits it when no link is set', () => {
  const desktop = pushDesp(despPending, despConfig, { ...despEff, webUrl: 'dsh://open' })
  assert.ok(desktop.includes('[打开 Harness 桌面端](dsh://open)'))
  const web = pushDesp(despPending, despConfig, { ...despEff, webUrl: 'http://192.168.1.10:3080' })
  assert.ok(web.includes('[打开 Harness (Web)](http://192.168.1.10:3080)'))
  const none = pushDesp(despPending, despConfig, { ...despEff, webUrl: '' })
  assert.ok(!none.includes('👉'))
  assert.ok(!none.includes('打开 Harness'))
})

function fakeReq(remoteAddress: string | undefined, headers: Record<string, string>): IncomingMessage {
  return { socket: { remoteAddress }, headers } as unknown as IncomingMessage
}

const fakeRes = { writeHead: () => {}, end: () => {} } as unknown as ServerResponse

/** sendPush's fetch implementation parameter, so stubs match exactly. */
type FetchImpl = NonNullable<Parameters<typeof sendPush>[4]>
const asFetch = (stub: (url: string, init?: RequestInit) => Promise<Response>): FetchImpl => stub as unknown as FetchImpl

test('guardLoopback normalizes IPv4-mapped IPv6 and rejects LAN peers', () => {
  assert.equal(guardLoopback(fakeReq('127.0.0.1', { host: '127.0.0.1:3080' }), fakeRes), true)
  assert.equal(guardLoopback(fakeReq('::1', { host: '[::1]:3080' }), fakeRes), true)
  assert.equal(guardLoopback(fakeReq('::ffff:127.0.0.1', { host: 'localhost:3080' }), fakeRes), true)
  assert.equal(guardLoopback(fakeReq('::FFFF:127.0.0.1', { host: '127.0.0.1' }), fakeRes), true)
  assert.equal(guardLoopback(fakeReq('192.168.1.5', {}), fakeRes), false)
  assert.equal(guardLoopback(fakeReq(undefined, {}), fakeRes), false)
  assert.equal(guardLoopback(fakeReq('127.0.0.1', { host: 'evil.example' }), fakeRes), false)
  assert.equal(guardLoopback(fakeReq('127.0.0.1', {}), fakeRes), false)
})

test('guardWrite requires loopback + JSON + same-origin Host match', () => {
  assert.equal(guardWrite(
    fakeReq('127.0.0.1', { 'content-type': 'application/json', origin: 'http://127.0.0.1:3080', host: '127.0.0.1:3080' }),
    fakeRes,
  ), true)
  // Same Host/Origin on a rebinding domain is still refused.
  assert.equal(guardWrite(
    fakeReq('127.0.0.1', { 'content-type': 'application/json', origin: 'http://evil.example', host: 'evil.example' }),
    fakeRes,
  ), false)
  // Mismatched Origin (local page on another port) is refused.
  assert.equal(guardWrite(
    fakeReq('127.0.0.1', { 'content-type': 'application/json', origin: 'http://localhost:9999', host: '127.0.0.1:3080' }),
    fakeRes,
  ), false)
  // Empty Origin is allowed for CLI tooling.
  assert.equal(guardWrite(
    fakeReq('127.0.0.1', { 'content-type': 'application/json', host: '127.0.0.1:3080' }),
    fakeRes,
  ), true)
  // Non-loopback peer refused even with JSON body.
  assert.equal(guardWrite(fakeReq('192.168.1.5', { 'content-type': 'application/json' }), fakeRes), false)
  // Wrong content type refused.
  assert.equal(guardWrite(fakeReq('127.0.0.1', { 'content-type': 'text/plain', host: '127.0.0.1:3080' }), fakeRes), false)
})

test('sendPush posts form-urlencoded and accepts code 0', async () => {
  const holder: { current: { url: string; init: RequestInit } | null } = { current: null }
  const fetchStub = asFetch(async (url: string, init?: RequestInit) => {
    holder.current = { url, init: init ?? {} }
    return new Response(JSON.stringify({ code: 0, message: 'ok' }), { status: 200 })
  })
  const result = await sendPush(
    'https://sctapi.ftqq.com/K.send', '', '标题', '正文', fetchStub,
  )
  assert.equal(result.ok, true)
  assert.equal(result.outcome, 'delivered')
  assert.equal(holder.current?.url, 'https://sctapi.ftqq.com/K.send')
  assert.equal(holder.current?.init.method, 'POST')
  assert.equal(holder.current?.init.redirect, 'manual')
  assert.equal(
    (holder.current?.init.headers as Record<string, string>)['content-type'],
    'application/x-www-form-urlencoded',
  )
  const body = new URLSearchParams(String(holder.current?.init.body))
  assert.equal(body.get('title'), '标题')
  assert.equal(body.get('desp'), '正文')
})

test('sendPush reports failures without leaking the URL/key', async () => {
  const throwing = asFetch(async () => {
    throw new Error('https://sctapi.ftqq.com/SECRET.send boom')
  })
  const result = await sendPush('https://sctapi.ftqq.com/SECRET.send', '', 't', 'd', throwing)
  assert.equal(result.ok, false)
  assert.equal(result.message, 'network-failed')
  assert.equal(result.outcome, 'retryable-failure')
  assert.ok(!result.message.includes('SECRET'))
})

test('sendPush recognizes both Node timeout error names', async () => {
  for (const name of ['AbortError', 'TimeoutError']) {
    const throwing = asFetch(async () => { const error = new Error('secret'); error.name = name; throw error })
    const result = await sendPush('https://sctapi.ftqq.com/K.send', '', 't', 'd', throwing)
    assert.equal(result.message, 'timeout')
    assert.equal(result.outcome, 'retryable-failure')
  }
})

test('sendPush treats non-zero server code and non-200 status as failure', async () => {
  const badCode = asFetch(async () => new Response(JSON.stringify({ code: 40001 }), { status: 200 }))
  const codeResult = await sendPush('https://sctapi.ftqq.com/K.send', '', 't', 'd', badCode)
  assert.equal(codeResult.ok, false)
  assert.equal(codeResult.message, 'server code indicates failure')
  assert.equal(codeResult.outcome, 'terminal-failure')

  const badStatus = asFetch(async () => new Response('forbidden', { status: 403 }))
  const statusResult = await sendPush('https://sctapi.ftqq.com/K.send', '', 't', 'd', badStatus)
  assert.equal(statusResult.ok, false)
  assert.equal(statusResult.message, 'HTTP 403')
  assert.equal(statusResult.outcome, 'terminal-failure')
})

test('SettingsStore persists dismissals across restarts without touching the credential', () => {
  const dir = tempDir()
  try {
    const store = new SettingsStore(dir)
    store.update({ sendkey: 'SCTabc123', thresholdMinutes: 8 })
    store.ignore({
      id: 'q:stuck',
      kind: 'question',
      sessionId: 'sess-1',
      detail: '  继续吗？  ',
      startedAt: 10,
      ignoredAt: 20,
    })
    const again = new SettingsStore(dir)
    assert.equal(again.sendkey, 'SCTabc123')
    assert.equal(again.thresholdMinutes, 8)
    assert.equal(again.isIgnored('q:stuck'), true)
    assert.equal(again.ignored()[0]?.detail, '继续吗？')
    again.update({ thresholdMinutes: 9 })
    assert.equal(again.thresholdMinutes, 9)
    assert.equal(again.isIgnored('q:stuck'), true)
    const restored = again.restore('q:stuck')
    assert.equal(restored?.id, 'q:stuck')
    assert.equal(again.isIgnored('q:stuck'), false)
    assert.deepEqual(again.ignored(), [])
    const raw = JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')) as { ignored?: unknown, thresholdMinutes?: number }
    assert.equal(raw.ignored, undefined)
    assert.equal(raw.thresholdMinutes, 9)
    assert.equal(again.restore('q:stuck'), undefined)
    assert.throws(() => again.ignore({
      id: 'not-an-id',
      kind: 'question',
      sessionId: 'sess-1',
      detail: 'x',
      startedAt: 1,
      ignoredAt: 2,
    }), StoreError)
    assert.equal(again.thresholdMinutes, 9)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('SettingsStore drops malformed dismissals, refuses a 51st, and prunes closed sessions', () => {
  const dir = tempDir()
  try {
    const store = new SettingsStore(dir)
    writeFileSync(join(dir, 'state.json'), JSON.stringify({
      version: 1,
      thresholdMinutes: 6,
      ignored: [
        { id: 'q:ok', kind: 'question', sessionId: 's1', detail: 'hi', startedAt: 1, ignoredAt: 2 },
        { id: 'q:ok', kind: 'question', sessionId: 's1', detail: 'newer', startedAt: 1, ignoredAt: 9 },
        { id: 'a:bad-kind', kind: 'question', sessionId: 's1', detail: 'x', startedAt: 1, ignoredAt: 3 },
        { id: 'nope', kind: 'approval', sessionId: 's1', detail: 'x', startedAt: 1, ignoredAt: 4 },
        null,
      ],
    }))
    const loaded = new SettingsStore(dir)
    assert.equal(loaded.thresholdMinutes, 6)
    assert.deepEqual(loaded.ignored().map(item => item.detail), ['newer'])
    loaded.update({ repeatMinutes: 2 })
    const cleaned = JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')) as { ignored?: Array<{ id: string }> }
    assert.deepEqual(cleaned.ignored?.map(item => item.id), ['q:ok'])
    assert.equal(loaded.restore('q:ok')?.detail, 'newer')

    for (let index = 0; index < 50; index += 1) {
      loaded.ignore({
        id: `q:id-${index}`,
        kind: 'question',
        sessionId: 's1',
        detail: 'd',
        startedAt: index,
        ignoredAt: index,
      })
    }
    assert.equal(loaded.ignored().length, 50)
    const beforeOverflow = readFileSync(join(dir, 'state.json'), 'utf8')
    assert.throws(() => loaded.ignore({
      id: 'q:overflow',
      kind: 'question',
      sessionId: 's1',
      detail: 'overflow',
      startedAt: 1,
      ignoredAt: 10_000,
    }), (error: unknown) => {
      assert.ok(error instanceof StoreError)
      assert.equal(error.code, 'ignored-full')
      return true
    })
    assert.equal(readFileSync(join(dir, 'state.json'), 'utf8'), beforeOverflow)
    assert.equal(loaded.isIgnored('q:id-0'), true)
    assert.equal(loaded.isIgnored('q:overflow'), false)
    // Replacing an existing id does not grow the list and is still allowed.
    loaded.ignore({
      id: 'q:id-0',
      kind: 'question',
      sessionId: 's1',
      detail: 'refreshed',
      startedAt: 1,
      ignoredAt: 10_000,
    })
    assert.equal(loaded.ignored().length, 50)
    assert.equal(loaded.ignored().find(item => item.id === 'q:id-0')?.detail, 'refreshed')
    loaded.retainOpen('s1', new Set())
    assert.deepEqual(loaded.ignored(), [])

    loaded.ignore({ id: 'q:keep', kind: 'question', sessionId: 's1', detail: 'keep', startedAt: 1, ignoredAt: 100 })
    loaded.ignore({ id: 'q:drop', kind: 'plan-review', sessionId: 's1', detail: 'drop', startedAt: 1, ignoredAt: 101 })
    loaded.ignore({ id: 'a:other', kind: 'approval', sessionId: 's2', detail: 'other', startedAt: 1, ignoredAt: 102 })
    loaded.retainOpen('s1', new Set(['q:keep']))
    assert.deepEqual(loaded.ignored().map(item => item.id).sort(), ['a:other', 'q:keep'])
    loaded.forget('a:missing')
    assert.equal(loaded.isIgnored('a:other'), true)
    loaded.forget('a:other')
    assert.deepEqual(loaded.ignored().map(item => item.id), ['q:keep'])
    // An empty dismissal set must not rewrite the file just to prune.
    const before = readFileSync(join(dir, 'state.json'), 'utf8')
    loaded.retainOpen('s9', new Set())
    loaded.forget('q:absent')
    assert.equal(readFileSync(join(dir, 'state.json'), 'utf8'), before)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('SettingsStore keeps every stored dismissal when the file is already over the cap', () => {
  const dir = tempDir()
  try {
    new SettingsStore(dir)
    const ignored = Array.from({ length: 51 }, (_, index) => ({
      id: `q:kept-${index}`,
      kind: 'question',
      sessionId: 's1',
      detail: 'd',
      startedAt: index,
      ignoredAt: index,
    }))
    writeFileSync(join(dir, 'state.json'), JSON.stringify({ version: 1, ignored }))
    const loaded = new SettingsStore(dir)
    assert.equal(loaded.ignored().length, 51)
    assert.equal(loaded.isIgnored('q:kept-0'), true)
    assert.equal(loaded.isIgnored('q:kept-50'), true)
    assert.throws(() => loaded.ignore({
      id: 'q:one-more',
      kind: 'question',
      sessionId: 's1',
      detail: 'd',
      startedAt: 1,
      ignoredAt: 99,
    }), (error: unknown) => {
      assert.ok(error instanceof StoreError)
      assert.equal(error.code, 'ignored-full')
      return true
    })
    assert.equal(loaded.ignored().length, 51)
    assert.equal(loaded.isIgnored('q:kept-0'), true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('sendPush classifies upstream 5xx as retryable but rate limits as terminal', async () => {
  const serverError = asFetch(async () => new Response('temporarily unavailable', { status: 503 }))
  const serverResult = await sendPush('https://sctapi.ftqq.com/K.send', '', 't', 'd', serverError)
  assert.equal(serverResult.outcome, 'retryable-failure')

  const rateLimited = asFetch(async () => new Response('too many requests', { status: 429 }))
  const rateResult = await sendPush('https://sctapi.ftqq.com/K.send', '', 't', 'd', rateLimited)
  assert.equal(rateResult.outcome, 'terminal-failure')

  const redirect = asFetch(async () => new Response('', { status: 302, headers: { location: 'https://evil.example/' } }))
  const redirectResult = await sendPush('https://sctapi.ftqq.com/K.send', '', 't', 'd', redirect)
  assert.equal(redirectResult.outcome, 'terminal-failure')
})

type RouteHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>

interface HostMount {
  routes: Map<string, RouteHandler>
  emit: (name: string, ...args: unknown[]) => void
  cleanup: () => void
}

function mountHost(stateDir: string): HostMount {
  const routes = new Map<string, RouteHandler>()
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  const cleanups: Array<() => void> = []
  const ctx = {
    logger: () => ({ info() {}, warn() {} }),
    on(name: string, fn: (...args: unknown[]) => void) {
      const list = listeners.get(name) ?? []
      list.push(fn)
      listeners.set(name, list)
    },
    get() { return undefined },
    effect(callback: () => void | (() => void)) {
      const cleanup = callback()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
    },
    inject(_services: string[], callback: (context: unknown) => void) { callback(ctx) },
    webServer: {
      register(route: { path: string, handler: RouteHandler }) {
        routes.set(route.path, route.handler)
        return () => { routes.delete(route.path) }
      },
    },
  }
  apply(ctx as unknown as Parameters<typeof apply>[0], { stateDir })
  return {
    routes,
    emit(name, ...args) {
      for (const fn of listeners.get(name) ?? []) fn(...args)
    },
    cleanup() {
      for (const fn of cleanups.splice(0).reverse()) fn()
    },
  }
}

async function callRoute(
  routes: Map<string, RouteHandler>,
  path: string,
  method: string,
  body?: string,
  remoteAddress = '127.0.0.1',
): Promise<{ status: number, json: Record<string, unknown> }> {
  const handler = routes.get(path)
  assert.ok(handler, path)
  const req = Readable.from(body === undefined ? [] : [Buffer.from(body)])
  Object.assign(req, {
    method,
    socket: { remoteAddress },
    headers: {
      host: '127.0.0.1:3080',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
  })
  let status = 0
  let raw = ''
  const res = {
    writeHead(code: number) { status = code },
    end(payload?: string) { raw = payload ?? '' },
  } as unknown as ServerResponse
  await handler(req as unknown as IncomingMessage, res)
  return { status, json: raw === '' ? {} : JSON.parse(raw) as Record<string, unknown> }
}

function idsOf(value: unknown): string[] {
  assert.ok(Array.isArray(value))
  return value.map(item => {
    assert.equal(typeof item, 'object')
    assert.ok(item !== null)
    const id = (item as { id?: unknown }).id
    assert.equal(typeof id, 'string')
    return id as string
  })
}

const flushTimers = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, 0) })

test('an ignored confirmation is not re-armed after restart and can be restored', async () => {
  const dir = tempDir()
  const mounts: HostMount[] = []
  const startedAt = Date.now() - 100 * 60 * 60 * 1000
  const openCall = {
    type: 'tool/call',
    time: startedAt,
    data: {
      callId: 'stuck-call',
      name: 'ask_user_question',
      arguments: JSON.stringify({ questions: [{ question: '还在等我吗？' }] }),
    },
  }
  let events: Array<Record<string, unknown>> = [openCall]
  const session = { id: 'sess-stuck', snapshotEvents: () => events }
  try {
    const first = mountHost(dir)
    mounts.push(first)
    first.emit('session/created', session)
    let status = await callRoute(first.routes, '/serverchan-watchdog/status', 'GET')
    assert.equal(status.status, 200)
    assert.deepEqual(idsOf(status.json['pending']), ['q:stuck-call'])
    assert.deepEqual(idsOf(status.json['ignored']), [])

    const ignored = await callRoute(
      first.routes,
      '/serverchan-watchdog/ignore',
      'POST',
      JSON.stringify({ id: 'q:stuck-call' }),
    )
    assert.equal(ignored.status, 200)
    assert.deepEqual(idsOf(ignored.json['pending']), [])
    assert.deepEqual(idsOf(ignored.json['ignored']), ['q:stuck-call'])
    const ignoredRow = (ignored.json['ignored'] as Array<{ detail?: unknown, startedAt?: unknown }>)[0]
    assert.equal(ignoredRow?.detail, '还在等我吗？')
    assert.equal(ignoredRow?.startedAt, startedAt)
    assert.equal(JSON.stringify(ignored.json).includes(dir), false)

    const saved = await callRoute(
      first.routes,
      '/serverchan-watchdog/config',
      'POST',
      JSON.stringify({ thresholdMinutes: 9 }),
    )
    assert.equal(saved.status, 200)
    assert.equal(saved.json['thresholdMinutes'], 9)
    assert.equal(Object.hasOwn(saved.json, 'ignored'), false)
    assert.equal(new SettingsStore(dir).isIgnored('q:stuck-call'), true)
    assert.ok(readFileSync(join(dir, 'state.json'), 'utf8').includes('q:stuck-call'))

    await flushTimers()
    status = await callRoute(first.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), [])

    // Shutdown disposes the session but must keep the dismissal on disk.
    first.emit('session/disposed', session)
    assert.equal(new SettingsStore(dir).isIgnored('q:stuck-call'), true)
    first.cleanup()

    const second = mountHost(dir)
    mounts.push(second)
    second.emit('session/created', session)
    status = await callRoute(second.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), [])
    assert.deepEqual(idsOf(status.json['ignored']), ['q:stuck-call'])
    assert.equal((status.json['ignored'] as Array<{ startedAt?: unknown }>)[0]?.startedAt, startedAt)

    // A failed or empty log read must not wipe the dismissal.
    events = []
    second.emit('session/created', session)
    second.emit('session/created', { id: 'sess-stuck', snapshotEvents: () => { throw new Error('boom') } })
    assert.equal(new SettingsStore(dir).isIgnored('q:stuck-call'), true)

    const restored = await callRoute(
      second.routes,
      '/serverchan-watchdog/ignore',
      'POST',
      JSON.stringify({ id: 'q:stuck-call', restore: true }),
    )
    assert.equal(restored.status, 200)
    assert.deepEqual(idsOf(restored.json['ignored']), [])
    assert.deepEqual(idsOf(restored.json['pending']), ['q:stuck-call'])
    assert.equal((restored.json['pending'] as Array<{ startedAt?: unknown }>)[0]?.startedAt, startedAt)

    second.emit('session/event', session, {
      type: 'tool/result',
      data: { message: { source: { kind: 'tool', callId: 'stuck-call' } } },
    })
    status = await callRoute(second.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), [])
    assert.deepEqual(idsOf(status.json['ignored']), [])

    // The pair can be dismissed again, then a later boot whose log shows it
    // closed drops the record instead of reminding.
    second.emit('session/event', session, openCall)
    const dismissedAgain = await callRoute(
      second.routes,
      '/serverchan-watchdog/ignore',
      'POST',
      JSON.stringify({ id: 'q:stuck-call' }),
    )
    assert.equal(dismissedAgain.status, 200)
    second.cleanup()

    events = [
      openCall,
      {
        type: 'tool/result',
        time: startedAt + 1,
        data: { message: { source: { kind: 'tool', callId: 'stuck-call' } } },
      },
    ]
    const third = mountHost(dir)
    mounts.push(third)
    third.emit('session/created', session)
    status = await callRoute(third.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), [])
    assert.deepEqual(idsOf(status.json['ignored']), [])
    await flushTimers()
  } finally {
    for (const mount of mounts.reverse()) mount.cleanup()
    await flushTimers()
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()))
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a callId-less result consumes an ignored question and leaves the next one alerting', async () => {
  const dir = tempDir()
  const mount = mountHost(dir)
  const session = { id: 'sess-live', snapshotEvents: () => [] as unknown[] }
  const ask = (callId: string, question: string): void => {
    mount.emit('session/event', session, {
      type: 'tool/call',
      data: {
        callId,
        name: 'ask_user_question',
        arguments: JSON.stringify({ questions: [{ question }] }),
      },
    })
  }
  const anonymousResult = (): void => {
    mount.emit('session/event', session, { type: 'tool/result', data: { message: {} } })
  }
  try {
    mount.emit('session/created', session)
    ask('A', '先回答这个')
    ask('B', '再回答这个')
    let status = await callRoute(mount.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), ['q:A', 'q:B'])

    const ignored = await callRoute(mount.routes, '/serverchan-watchdog/ignore', 'POST', JSON.stringify({ id: 'q:A' }))
    assert.equal(ignored.status, 200)
    assert.deepEqual(idsOf(ignored.json['pending']), ['q:B'])
    assert.deepEqual(idsOf(ignored.json['ignored']), ['q:A'])

    // Replays of the dismissed call must not stack extra placeholders.
    ask('A', '先回答这个')
    ask('A', '先回答这个')
    anonymousResult()
    status = await callRoute(mount.routes, '/serverchan-watchdog/status', 'GET')
    // B is still watched, so its threshold timer is still armed.
    assert.deepEqual(idsOf(status.json['pending']), ['q:B'])
    assert.deepEqual(idsOf(status.json['ignored']), [])
    assert.equal(new SettingsStore(dir).isIgnored('q:A'), false)

    anonymousResult()
    status = await callRoute(mount.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), [])
    await flushTimers()
  } finally {
    mount.cleanup()
    await flushTimers()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('restoring an ignored question keeps its FIFO place ahead of the next question', async () => {
  const dir = tempDir()
  const mount = mountHost(dir)
  const session = { id: 'sess-restore-fifo', snapshotEvents: () => [] as unknown[] }
  const ask = (callId: string): void => {
    mount.emit('session/event', session, {
      type: 'tool/call',
      data: {
        callId,
        name: 'ask_user_question',
        arguments: JSON.stringify({ questions: [{ question: callId }] }),
      },
    })
  }
  try {
    mount.emit('session/created', session)
    ask('A')
    ask('B')
    const ignored = await callRoute(mount.routes, '/serverchan-watchdog/ignore', 'POST', JSON.stringify({ id: 'q:A' }))
    assert.deepEqual(idsOf(ignored.json['pending']), ['q:B'])
    const restored = await callRoute(
      mount.routes,
      '/serverchan-watchdog/ignore',
      'POST',
      JSON.stringify({ id: 'q:A', restore: true }),
    )
    assert.deepEqual(idsOf(restored.json['pending']).sort(), ['q:A', 'q:B'])
    mount.emit('session/event', session, { type: 'tool/result', data: { message: {} } })
    const status = await callRoute(mount.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), ['q:B'])
    assert.deepEqual(idsOf(status.json['ignored']), [])
    await flushTimers()
  } finally {
    mount.cleanup()
    await flushTimers()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('recovery folds anonymous results already in the log before keeping ignores', async () => {
  const dir = tempDir()
  const mounts: HostMount[] = []
  const ask = (callId: string, time: number) => ({
    type: 'tool/call',
    time,
    data: {
      callId,
      name: 'ask_user_question',
      arguments: JSON.stringify({ questions: [{ question: callId }] }),
    },
  })
  const anonymous = (time: number) => ({ type: 'tool/result', time, data: { message: {} } })
  let events: Array<Record<string, unknown>> = [ask('A', 1), ask('B', 2), ask('C', 3)]
  const session = { id: 'sess-anon-recover', snapshotEvents: () => events }
  try {
    const first = mountHost(dir)
    mounts.push(first)
    first.emit('session/created', session)
    for (const id of ['q:A', 'q:C']) {
      const ignored = await callRoute(first.routes, '/serverchan-watchdog/ignore', 'POST', JSON.stringify({ id }))
      assert.equal(ignored.status, 200, id)
    }
    let status = await callRoute(first.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), ['q:B'])
    assert.deepEqual(idsOf(status.json['ignored']).sort(), ['q:A', 'q:C'])
    first.cleanup()

    // The anonymous result was persisted before this process saw it. It
    // answers A, the ignored FIFO head, so A must not come back as a tombstone.
    events = [ask('A', 1), ask('B', 2), ask('C', 3), anonymous(4)]
    const second = mountHost(dir)
    mounts.push(second)
    second.emit('session/created', session)
    status = await callRoute(second.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), ['q:B'])
    assert.deepEqual(idsOf(status.json['ignored']), ['q:C'])
    assert.equal(new SettingsStore(dir).isIgnored('q:A'), false)

    // The next anonymous result belongs to B. A stale tombstone for A would
    // swallow it and leave B alerting.
    second.emit('session/event', session, anonymous(5))
    status = await callRoute(second.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), [])
    assert.deepEqual(idsOf(status.json['ignored']), ['q:C'])

    second.emit('session/event', session, anonymous(6))
    status = await callRoute(second.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), [])
    assert.deepEqual(idsOf(status.json['ignored']), [])
    await flushTimers()
  } finally {
    for (const mount of mounts.reverse()) mount.cleanup()
    await flushTimers()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('recovery does not re-arm a question an anonymous log result already closed', async () => {
  const dir = tempDir()
  const mounts: HostMount[] = []
  const ask = (callId: string, time: number) => ({
    type: 'tool/call',
    time,
    data: {
      callId,
      name: 'ask_user_question',
      arguments: JSON.stringify({ questions: [{ question: callId }] }),
    },
  })
  const anonymous = (time: number) => ({ type: 'tool/result', time, data: { message: {} } })
  let events: Array<Record<string, unknown>> = [ask('A', 1), ask('B', 2)]
  const session = { id: 'sess-anon-live', snapshotEvents: () => events }
  try {
    const first = mountHost(dir)
    mounts.push(first)
    first.emit('session/created', session)
    const ignored = await callRoute(first.routes, '/serverchan-watchdog/ignore', 'POST', JSON.stringify({ id: 'q:B' }))
    assert.equal(ignored.status, 200)
    assert.deepEqual(idsOf(ignored.json['pending']), ['q:A'])
    first.cleanup()

    // A was not ignored and the log's anonymous result already answered it.
    // B stays ignored. A must not be pending, and the next live anonymous
    // result must clear B rather than a phantom copy of A.
    events = [ask('A', 1), ask('B', 2), anonymous(3)]
    const second = mountHost(dir)
    mounts.push(second)
    second.emit('session/created', session)
    let status = await callRoute(second.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), [])
    assert.deepEqual(idsOf(status.json['ignored']), ['q:B'])

    second.emit('session/event', session, anonymous(4))
    status = await callRoute(second.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), [])
    assert.deepEqual(idsOf(status.json['ignored']), [])
    await flushTimers()
  } finally {
    for (const mount of mounts.reverse()) mount.cleanup()
    await flushTimers()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a replayed call is one ask on the live FIFO, ignored or not', async () => {
  const dir = tempDir()
  const mount = mountHost(dir)
  const session = { id: 'sess-replay', snapshotEvents: () => [] as unknown[] }
  const ask = (callId: string): void => {
    mount.emit('session/event', session, {
      type: 'tool/call',
      data: {
        callId,
        name: 'ask_user_question',
        arguments: JSON.stringify({ questions: [{ question: callId }] }),
      },
    })
  }
  const anonymous = (): void => {
    mount.emit('session/event', session, { type: 'tool/result', data: { message: {} } })
  }
  try {
    mount.emit('session/created', session)
    ask('A')
    ask('A')
    ask('B')
    let status = await callRoute(mount.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), ['q:A', 'q:B'])

    mount.emit('session/event', session, {
      type: 'tool/result',
      data: { message: { source: { kind: 'tool', callId: 'A' } } },
    })
    status = await callRoute(mount.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), ['q:B'])
    // A leftover copy of A would swallow this and leave B alerting.
    anonymous()
    status = await callRoute(mount.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), [])

    ask('C')
    ask('C')
    const ignored = await callRoute(mount.routes, '/serverchan-watchdog/ignore', 'POST', JSON.stringify({ id: 'q:C' }))
    assert.equal(ignored.status, 200)
    assert.deepEqual(idsOf(ignored.json['pending']), [])
    assert.deepEqual(idsOf(ignored.json['ignored']), ['q:C'])
    ask('C')
    ask('D')
    anonymous()
    status = await callRoute(mount.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), ['q:D'])
    assert.deepEqual(idsOf(status.json['ignored']), [])
    await flushTimers()
  } finally {
    mount.cleanup()
    await flushTimers()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('recovery closes every copy of a replayed call, including an ignored one', async () => {
  const dir = tempDir()
  const mounts: HostMount[] = []
  const ask = (callId: string, time: number) => ({
    type: 'tool/call',
    time,
    data: {
      callId,
      name: 'ask_user_question',
      arguments: JSON.stringify({ questions: [{ question: callId }] }),
    },
  })
  const identified = (callId: string, time: number) => ({
    type: 'tool/result',
    time,
    data: { message: { source: { kind: 'tool', callId } } },
  })
  let events: Array<Record<string, unknown>> = [ask('A', 1), ask('A', 2), ask('B', 3)]
  const session = { id: 'sess-replay-recover', snapshotEvents: () => events }
  try {
    const first = mountHost(dir)
    mounts.push(first)
    first.emit('session/created', session)
    let status = await callRoute(first.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), ['q:A', 'q:B'])
    const ignored = await callRoute(first.routes, '/serverchan-watchdog/ignore', 'POST', JSON.stringify({ id: 'q:A' }))
    assert.equal(ignored.status, 200)
    assert.deepEqual(idsOf(ignored.json['pending']), ['q:B'])
    first.cleanup()

    events = [ask('A', 1), ask('A', 2), identified('A', 3), ask('B', 4)]
    const second = mountHost(dir)
    mounts.push(second)
    second.emit('session/created', session)
    status = await callRoute(second.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), ['q:B'])
    assert.deepEqual(idsOf(status.json['ignored']), [])
    assert.equal(new SettingsStore(dir).isIgnored('q:A'), false)
    second.emit('session/event', session, { type: 'tool/result', data: { message: {} } })
    status = await callRoute(second.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), [])
    assert.deepEqual(idsOf(status.json['ignored']), [])
    await flushTimers()
  } finally {
    for (const mount of mounts.reverse()) mount.cleanup()
    await flushTimers()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('recovery keeps an ignored question ahead of the next one in the FIFO', async () => {
  const dir = tempDir()
  const mounts: HostMount[] = []
  const events = [
    {
      type: 'tool/call',
      time: 1_000,
      data: {
        callId: 'A',
        name: 'ask_user_question',
        arguments: JSON.stringify({ questions: [{ question: '先回答这个' }] }),
      },
    },
    {
      type: 'tool/call',
      time: 2_000,
      data: {
        callId: 'B',
        name: 'ask_user_question',
        arguments: JSON.stringify({ questions: [{ question: '再回答这个' }] }),
      },
    },
  ]
  const session = { id: 'sess-recover-fifo', snapshotEvents: () => events }
  try {
    const first = mountHost(dir)
    mounts.push(first)
    first.emit('session/created', session)
    const ignored = await callRoute(first.routes, '/serverchan-watchdog/ignore', 'POST', JSON.stringify({ id: 'q:A' }))
    assert.deepEqual(idsOf(ignored.json['pending']), ['q:B'])
    first.cleanup()

    const second = mountHost(dir)
    mounts.push(second)
    second.emit('session/created', session)
    let status = await callRoute(second.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), ['q:B'])
    assert.deepEqual(idsOf(status.json['ignored']), ['q:A'])
    second.emit('session/event', session, { type: 'tool/result', data: { message: {} } })
    status = await callRoute(second.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), ['q:B'])
    assert.deepEqual(idsOf(status.json['ignored']), [])
    assert.equal(new SettingsStore(dir).isIgnored('q:A'), false)
    await flushTimers()
  } finally {
    for (const mount of mounts.reverse()) mount.cleanup()
    await flushTimers()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('an ignored approval stays dismissed across restart until it is decided', async () => {
  const dir = tempDir()
  const mounts: HostMount[] = []
  const startedAt = 1_700_000_000_000
  const session = {
    id: 'sess-ap',
    snapshotEvents: () => [{
      type: 'approval/asked',
      time: startedAt,
      data: { id: 'ap-1', toolName: 'bash', reason: '跑一下命令' },
    }],
  }
  try {
    const first = mountHost(dir)
    mounts.push(first)
    first.emit('session/created', session)
    let status = await callRoute(first.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), ['a:ap-1'])
    const ignored = await callRoute(first.routes, '/serverchan-watchdog/ignore', 'POST', JSON.stringify({ id: 'a:ap-1' }))
    assert.equal(ignored.status, 200)
    assert.deepEqual(idsOf(ignored.json['pending']), [])
    assert.equal((ignored.json['ignored'] as Array<{ kind?: unknown }>)[0]?.kind, 'approval')
    first.cleanup()

    const second = mountHost(dir)
    mounts.push(second)
    second.emit('session/created', session)
    status = await callRoute(second.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), [])
    assert.deepEqual(idsOf(status.json['ignored']), ['a:ap-1'])

    const restored = await callRoute(
      second.routes,
      '/serverchan-watchdog/ignore',
      'POST',
      JSON.stringify({ id: 'a:ap-1', restore: true }),
    )
    assert.deepEqual(idsOf(restored.json['pending']), ['a:ap-1'])
    assert.deepEqual(idsOf(restored.json['ignored']), [])
    second.emit('session/event', session, { type: 'approval/decided', data: { id: 'ap-1' } })
    status = await callRoute(second.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), [])
    assert.deepEqual(idsOf(status.json['ignored']), [])
    await flushTimers()
  } finally {
    for (const mount of mounts.reverse()) mount.cleanup()
    await flushTimers()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('restoring after the session is gone drops the dismissal without starting a reminder', async () => {
  const dir = tempDir()
  const mount = mountHost(dir)
  const startedAt = Date.now() - 60 * 60 * 1000
  const session = {
    id: 'sess-gone',
    snapshotEvents: () => [{
      type: 'tool/call',
      time: startedAt,
      data: {
        callId: 'gone',
        name: 'ask_user_question',
        arguments: JSON.stringify({ questions: [{ question: '已经结束了' }] }),
      },
    }],
  }
  try {
    mount.emit('session/created', session)
    const ignored = await callRoute(mount.routes, '/serverchan-watchdog/ignore', 'POST', JSON.stringify({ id: 'q:gone' }))
    assert.equal(ignored.status, 200)
    mount.emit('session/disposed', session)
    assert.equal(new SettingsStore(dir).isIgnored('q:gone'), true)
    const restored = await callRoute(
      mount.routes,
      '/serverchan-watchdog/ignore',
      'POST',
      JSON.stringify({ id: 'q:gone', restore: true }),
    )
    assert.equal(restored.status, 200)
    assert.deepEqual(idsOf(restored.json['pending']), [])
    assert.deepEqual(idsOf(restored.json['ignored']), [])
    await flushTimers()
    const status = await callRoute(mount.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), [])
    assert.equal(new SettingsStore(dir).isIgnored('q:gone'), false)
  } finally {
    mount.cleanup()
    await flushTimers()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a full ignore list refuses the next dismissal and still watches it after restart', async () => {
  const dir = tempDir()
  const mounts: HostMount[] = []
  const startedAt = Date.now()
  const events = Array.from({ length: 51 }, (_, index) => ({
    type: 'tool/call',
    time: startedAt + index,
    data: {
      callId: `c${index}`,
      name: 'ask_user_question',
      arguments: JSON.stringify({ questions: [{ question: `问题 ${index}` }] }),
    },
  }))
  const session = { id: 'sess-cap', snapshotEvents: () => events }
  try {
    const first = mountHost(dir)
    mounts.push(first)
    first.emit('session/created', session)
    let status = await callRoute(first.routes, '/serverchan-watchdog/status', 'GET')
    assert.equal(idsOf(status.json['pending']).length, 51)

    for (let index = 0; index < 50; index += 1) {
      const ignored = await callRoute(
        first.routes,
        '/serverchan-watchdog/ignore',
        'POST',
        JSON.stringify({ id: `q:c${index}` }),
      )
      assert.equal(ignored.status, 200, `ignore q:c${index}`)
    }
    status = await callRoute(first.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), ['q:c50'])
    assert.equal(idsOf(status.json['ignored']).length, 50)
    assert.equal(idsOf(status.json['ignored']).includes('q:c0'), true)

    const rejected = await callRoute(
      first.routes,
      '/serverchan-watchdog/ignore',
      'POST',
      JSON.stringify({ id: 'q:c50' }),
    )
    assert.equal(rejected.status, 400)
    assert.equal(rejected.json['error'], 'ignored-full')
    status = await callRoute(first.routes, '/serverchan-watchdog/status', 'GET')
    // The refused row is still tracked, so its reminder timer is still armed.
    assert.deepEqual(idsOf(status.json['pending']), ['q:c50'])
    assert.equal(idsOf(status.json['ignored']).length, 50)
    assert.equal(idsOf(status.json['ignored']).includes('q:c50'), false)
    assert.equal(idsOf(status.json['ignored']).includes('q:c0'), true)
    first.cleanup()

    const second = mountHost(dir)
    mounts.push(second)
    second.emit('session/created', session)
    status = await callRoute(second.routes, '/serverchan-watchdog/status', 'GET')
    assert.deepEqual(idsOf(status.json['pending']), ['q:c50'])
    assert.equal(idsOf(status.json['ignored']).length, 50)
    assert.equal(idsOf(status.json['ignored']).includes('q:c0'), true)
    assert.equal(idsOf(status.json['ignored']).includes('q:c50'), false)
    assert.equal(new SettingsStore(dir).isIgnored('q:c50'), false)
    await flushTimers()
  } finally {
    for (const mount of mounts.reverse()) mount.cleanup()
    await flushTimers()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the ignore route rejects bad ids, unknown rows, and non-loopback peers', async () => {
  const dir = tempDir()
  const mount = mountHost(dir)
  try {
    const missing = await callRoute(mount.routes, '/serverchan-watchdog/ignore', 'POST', JSON.stringify({ id: 'q:missing' }))
    assert.equal(missing.status, 404)
    assert.equal(missing.json['error'], 'not-pending')

    const bad = await callRoute(mount.routes, '/serverchan-watchdog/ignore', 'POST', JSON.stringify({ id: 'q:bad\nid' }))
    assert.equal(bad.status, 400)
    assert.equal(bad.json['error'], 'invalid-id')

    const restore = await callRoute(
      mount.routes,
      '/serverchan-watchdog/ignore',
      'POST',
      JSON.stringify({ id: 'q:missing', restore: true }),
    )
    assert.equal(restore.status, 404)
    assert.equal(restore.json['error'], 'not-ignored')

    const remote = await callRoute(
      mount.routes,
      '/serverchan-watchdog/ignore',
      'POST',
      JSON.stringify({ id: 'q:missing' }),
      '192.168.1.5',
    )
    assert.equal(remote.status, 403)

    const method = await callRoute(mount.routes, '/serverchan-watchdog/ignore', 'GET')
    assert.equal(method.status, 405)
  } finally {
    mount.cleanup()
    rmSync(dir, { recursive: true, force: true })
  }
})
