/**
 * Host-side unit coverage: encrypted settings store (round-trip, atomic patch
 * validation, clear semantics), loopback/CSRF guards, and the ServerChan
 * pusher (form-urlencoded request, success/code checks, failure redaction).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import './env-isolation.ts'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
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
      const expectedKeys = path.endsWith('/status') ? [...configKeys, 'pending'] : configKeys
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
