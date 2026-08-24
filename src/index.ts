/**
 * dsh-serverchan-watchdog — host half.
 *
 * Watches the live session-event stream for the two human-interaction seams
 * and pushes a ServerChan (Server酱) WeChat message when one stays unanswered
 * past a configurable threshold (default 5 minutes):
 *
 *   - `tool/call` of `ask_user_question` → `tool/result`    (问答)
 *   - `tool/call` of `exit_plan_mode`     → `tool/result`    (计划评审)
 *   - `approval/asked`                    → `approval/decided` (工具审批)
 *
 * Detection is host-side over the durable session stream, so it works with no
 * browser connected at all: pending asks are held by the host (api-proxy)
 * regardless of mux subscribers, and approval/decided answers end the watch.
 *
 * Routes (loopback-only; write routes also require JSON + loopback Origin):
 *   GET  /serverchan-watchdog/status  effective config summary + active pending list
 *   GET  /serverchan-watchdog/config  editable settings view (never the key)
 *   POST /serverchan-watchdog/config  { sendkey?, clearKey?, thresholdMinutes?, repeatMinutes?, proxy? }
 *   POST /serverchan-watchdog/test    send one test push with current settings
 *
 * The SendKey is encrypted with AES-256-GCM under a per-machine key file in
 * the plugin state dir (same scheme as dsh-fish-tts); it never appears in
 * responses, logs, or the repository. Everything else (threshold, repeat,
 * title, proxy, web URL) is bundle-patch `Config`.
 *
 * @module dsh-serverchan-watchdog
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import { fetch as undiciFetch, ProxyAgent } from 'undici'
// Type-only: brings the ctx.webServer merge, the approval/question session
// event members, and the session/event signature into this build.
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-user-approval'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import { PendingTracker, buildPushUrl, describeExitPlanCall, describeQuestionCall, minutesValue, truncate, type PendingInteraction, type PendingKind } from './core.ts'

export const name = 'serverchan-watchdog'

export interface Config {
  /** Master switch; when false the session stream is not watched. */
  enabled?: boolean
  /** Minutes an ask may stay unanswered before the first push. */
  thresholdMinutes?: number
  /** Minutes between repeat pushes while still pending; 0 = push once only. */
  repeatMinutes?: number
  /** Push title (single line, ≤32 chars per ServerChan). */
  title?: string
  /** Link opened from the push body. */
  webUrl?: string
  /** Optional http(s) proxy for the push request (no userinfo). */
  proxy?: string
  /** Plugin state dir; defaults to $DSH_HOME/serverchan-watchdog. */
  stateDir?: string
  /** SendKey or full push URL fallback (prefer the encrypted file / env). */
  sendkey?: string
}

export const Config: s<Config> = s.object({
  enabled: s.boolean().default(true),
  thresholdMinutes: s.number().min(1).max(1440).default(5),
  repeatMinutes: s.number().min(0).max(1440).default(0),
  title: s.string().default('DSH 等待人工确认'),
  webUrl: s.string().default('http://127.0.0.1:3080'),
  proxy: s.string().default(''),
  stateDir: s.string().default(''),
  sendkey: s.string().default(''),
})

const KIND_LABELS: Record<PendingKind, string> = {
  question: '问答',
  'plan-review': '计划评审',
  approval: '审批',
}

interface CipherBox {
  iv: string
  tag: string
  data: string
}

interface StateFile {
  version: 1
  sendkeyCipher?: CipherBox
  /** Settings-page overrides; everything here beats the bundle-patch Config. */
  thresholdMinutes?: number
  repeatMinutes?: number
  proxy?: string
}

/** Rejected settings patch; `code` maps directly to the API error. */
class StoreError extends Error {
  constructor(
    readonly code: 'invalid-sendkey' | 'invalid-proxy' | 'invalid-minutes',
    message: string,
  ) {
    super(message)
    this.name = 'StoreError'
  }
}

/** One settings-page edit patch (undefined keeps, '' clears the field). */
interface StorePatch {
  sendkey?: string
  clearKey?: boolean
  thresholdMinutes?: number
  repeatMinutes?: number
  proxy?: string
}

/** Effective runtime values: settings-store overrides merged over patch Config. */
interface EffectiveSettings {
  enabled: boolean
  thresholdMinutes: number
  repeatMinutes: number
  title: string
  webUrl: string
  proxy: string
}

/** Best-effort Windows ACL tightening: current user only, inheritance removed. */
function tightenAcl(filePath: string): void {
  if (process.platform !== 'win32') return
  const user = process.env.USERNAME
  if (user === undefined) return
  try {
    spawnSync('icacls', [filePath, '/inheritance:r', '/grant:r', `${user}:F`], { stdio: 'ignore', timeout: 5000 })
  } catch {
    // non-fatal
  }
}

function stateDirOf(config: Config): string {
  const configured = (config.stateDir ?? '').trim()
  if (configured !== '') return configured
  const home = process.env.DSH_HOME?.trim()
  return join(home !== undefined && home !== '' ? home : join(homedir(), '.dsh'), 'serverchan-watchdog')
}

function loadOrCreateKey(dir: string): Buffer {
  const path = join(dir, 'key.bin')
  try {
    const existing = readFileSync(path)
    if (existing.length === 32) {
      try { chmodSync(path, 0o600) } catch { /* non-fatal on win32 */ }
      tightenAcl(path)
      return existing
    }
  } catch {
    // not present — create below
  }
  mkdirSync(dir, { recursive: true })
  const key = randomBytes(32)
  try {
    writeFileSync(path, key, { flag: 'wx', mode: 0o600 })
    tightenAcl(path)
  } catch {
    // raced creation or permissions — fall back to reading whatever won
  }
  const created = readFileSync(path)
  return created.length === 32 ? created : key
}

function encrypt(secret: string, key: Buffer): CipherBox {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  }
}

function decrypt(box: CipherBox, key: Buffer): string {
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(box.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(box.tag, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(box.data, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return ''
  }
}

/** Encrypted on-disk settings store (AES-256-GCM under per-machine key.bin). */
class SettingsStore {
  private readonly filePath: string
  private readonly key: Buffer

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true })
    this.filePath = join(dir, 'state.json')
    this.key = loadOrCreateKey(dir)
  }

  /** Decrypted stored SendKey / push URL, or '' when none. */
  get sendkey(): string {
    const file = this.read()
    return file.sendkeyCipher === undefined ? '' : decrypt(file.sendkeyCipher, this.key)
  }

  get hasStoredKey(): boolean {
    return this.read().sendkeyCipher !== undefined
  }

  get thresholdMinutes(): number | undefined {
    return this.read().thresholdMinutes
  }

  get repeatMinutes(): number | undefined {
    return this.read().repeatMinutes
  }

  /** Stored proxy (sanitized, '' when none). */
  get proxy(): string {
    return this.read().proxy ?? ''
  }

  /**
   * Apply one validated patch. Everything is validated before anything is
   * written, so a rejected field cannot leave a partially-applied store.
   * @param patch - settings-page edit; undefined keeps, '' clears.
   * @throws {StoreError} when any provided value is rejected.
   */
  update(patch: StorePatch): void {
    const next = this.read()
    if (patch.sendkey !== undefined && patch.sendkey.trim() !== '') {
      if (buildPushUrl(patch.sendkey) === null) {
        throw new StoreError('invalid-sendkey', 'SendKey/URL 不是合法的 ServerChan 凭据')
      }
      if (patch.clearKey !== true) next.sendkeyCipher = encrypt(patch.sendkey.trim(), this.key)
    }
    if (patch.clearKey === true) delete next.sendkeyCipher
    if (patch.thresholdMinutes !== undefined) {
      const value = minutesValue(patch.thresholdMinutes, 1, 1440)
      if (value === null) throw new StoreError('invalid-minutes', '阈值必须为 1–1440 的整数分钟')
      next.thresholdMinutes = value
    }
    if (patch.repeatMinutes !== undefined) {
      const value = minutesValue(patch.repeatMinutes, 0, 1440)
      if (value === null) throw new StoreError('invalid-minutes', '重复间隔必须为 0–1440 的整数分钟')
      next.repeatMinutes = value
    }
    if (patch.proxy !== undefined) {
      const trimmed = patch.proxy.trim()
      if (trimmed === '') {
        delete next.proxy
      } else {
        const normalized = proxyOf(trimmed)
        if (normalized === null) {
          throw new StoreError('invalid-proxy', '代理必须是 http(s):// 且不含用户名密码')
        }
        next.proxy = normalized
      }
    }
    next.version = 1
    this.write(next)
  }

  /** BOM/whitespace-tolerant parse; malformed or invalid fields are dropped. */
  private read(): StateFile {
    try {
      const raw = readFileSync(this.filePath).toString('utf8').replace(/^\uFEFF/, '').trim()
      if (raw === '') return { version: 1 }
      const parsed = JSON.parse(raw) as Partial<StateFile>
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { version: 1 }
      const file: StateFile = { version: 1 }
      if (parsed.sendkeyCipher !== undefined && parsed.sendkeyCipher !== null) {
        file.sendkeyCipher = parsed.sendkeyCipher as CipherBox
      }
      const threshold = minutesValue(parsed.thresholdMinutes, 1, 1440)
      if (threshold !== null) file.thresholdMinutes = threshold
      const repeat = minutesValue(parsed.repeatMinutes, 0, 1440)
      if (repeat !== null) file.repeatMinutes = repeat
      if (typeof parsed.proxy === 'string') {
        const normalized = proxyOf(parsed.proxy)
        if (normalized !== null) file.proxy = normalized
      }
      return file
    } catch {
      return { version: 1 }
    }
  }

  private write(file: StateFile): void {
    const temp = `${this.filePath}.tmp-${process.pid}`
    writeFileSync(temp, JSON.stringify(file, null, 2), { mode: 0o600 })
    renameSync(temp, this.filePath)
    // The ciphertext is only as safe as the directory the key lives in:
    // tighten the same way key.bin is tightened.
    tightenAcl(this.filePath)
  }
}

/** Merge settings-store overrides over the bundle-patch Config. */
function effectiveOf(config: Config, store: SettingsStore): EffectiveSettings {
  return {
    enabled: config.enabled ?? true,
    thresholdMinutes: store.thresholdMinutes ?? config.thresholdMinutes ?? 5,
    repeatMinutes: store.repeatMinutes ?? config.repeatMinutes ?? 0,
    title: (config.title ?? '').trim() || 'DSH 等待人工确认',
    webUrl: (config.webUrl ?? '').trim() || 'http://127.0.0.1:3080',
    proxy: store.proxy !== '' ? store.proxy : (proxyOf(config.proxy ?? '') ?? ''),
  }
}

/** Nothing that a response may expose: credentials stay encrypted on disk. */
function editableView(config: Config, store: SettingsStore): {
  enabled: boolean
  thresholdMinutes: number
  repeatMinutes: number
  title: string
  webUrl: string
  proxy: string
  credentialConfigured: boolean
  hasStoredKey: boolean
  stateDir: string
} {
  const eff = effectiveOf(config, store)
  return {
    enabled: eff.enabled,
    thresholdMinutes: eff.thresholdMinutes,
    repeatMinutes: eff.repeatMinutes,
    title: eff.title,
    webUrl: eff.webUrl,
    proxy: redactProxy(eff.proxy),
    credentialConfigured: resolveCredential(config, store) !== '',
    hasStoredKey: store.hasStoredKey,
    stateDir: stateDirOf(config),
  }
}

/** Normalize a user-configured proxy URL; http/https without userinfo, else ''. */
function proxyOf(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (parsed.username !== '' || parsed.password !== '') return null
    return parsed.href.replace(/\/$/, '')
  } catch {
    return null
  }
}

function redactProxy(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.username !== '' || parsed.password !== '') {
      parsed.username = ''
      parsed.password = ''
      return parsed.href.replace(/\/$/, '')
    }
    return url
  } catch {
    return ''
  }
}

interface PushResult {
  ok: boolean
  message: string
}

/** POST one ServerChan message (form-urlencoded; success = HTTP 200 + JSON code 0). */
async function sendPush(url: string, proxy: string, title: string, desp: string): Promise<PushResult> {
  const body = new URLSearchParams()
  body.set('title', title)
  body.set('desp', desp)
  const dispatcher = proxy !== '' ? new ProxyAgent(proxy) : undefined
  try {
    const response = await undiciFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(20_000),
      ...(dispatcher === undefined ? {} : { dispatcher }),
    })
    const text = await response.text()
    if (response.status !== 200) return { ok: false, message: `HTTP ${response.status}` }
    let code: unknown
    try {
      code = (JSON.parse(text) as { code?: unknown }).code
    } catch {
      return { ok: false, message: 'unexpected response body' }
    }
    if (code !== 0) return { ok: false, message: `server code ${String(code)}` }
    return { ok: true, message: 'pushed' }
  } catch (error) {
    // Never echo raw error text: undici/node may include the request URL
    // (and thus the SendKey) in the message, so responses and logs stay
    // class-only.
    const detail = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network-failed'
    return { ok: false, message: detail }
  } finally {
    if (dispatcher !== undefined) void dispatcher.close()
  }
}

function resolveCredential(config: Config, store: SettingsStore): string {
  const fromFile = store.sendkey
  if (fromFile !== '') return fromFile
  const fromConfig = (config.sendkey ?? '').trim()
  if (fromConfig !== '') return fromConfig
  return (process.env.DSH_SERVERCHAN_SENDKEY ?? '').trim()
}

function pushTitle(config: Config, pending: PendingInteraction): string {
  const base = truncate((config.title ?? '').trim() || 'DSH 等待人工确认', 20)
  return pending.pushes > 1 ? `${base}（第 ${pending.pushes} 次）` : base
}

function pushDesp(pending: PendingInteraction, config: Config, eff: EffectiveSettings): string {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - pending.startedAt) / 60_000))
  return [
    `**类型**：${KIND_LABELS[pending.kind]}`,
    `**会话**：\`${pending.sessionId}\``,
    `**内容**：${truncate(pending.detail, 300)}`,
    `**已等待**：${elapsedMinutes} 分钟（阈值 ${eff.thresholdMinutes} 分钟）`,
    `**状态**：${pending.pushes > 1 ? `已提醒 ${pending.pushes} 次，仍未处理` : '超过阈值未处理'}`,
    '',
    `👉 [打开 DeepSeek Harness](${eff.webUrl})`,
  ].join('\n')
}

function isLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(body)
}

function guardLoopback(req: IncomingMessage, res: ServerResponse): boolean {
  if (!isLoopback(req.socket.remoteAddress)) {
    sendJson(res, 403, { ok: false, error: 'forbidden' })
    return false
  }
  return true
}

/** Loopback + JSON body + loopback/same-origin Origin (CSRF posture). */
function guardWrite(req: IncomingMessage, res: ServerResponse): boolean {
  if (!guardLoopback(req, res)) return false
  const contentType = (req.headers['content-type'] ?? '').split(';')[0]?.trim() ?? ''
  if (contentType !== 'application/json') {
    sendJson(res, 415, { ok: false, error: 'content-type must be application/json' })
    return false
  }
  const origin = req.headers.origin ?? ''
  if (origin !== '' && !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(origin)) {
    sendJson(res, 403, { ok: false, error: 'forbidden-origin' })
    return false
  }
  return true
}

async function readJsonBody(req: IncomingMessage, maxBytes = 64 * 1024): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    size += buffer.length
    if (size > maxBytes) throw new Error('body too large')
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  }
}

export function apply(ctx: Context, config: Config): void {
  const log = ctx.logger('serverchan-watchdog')
  const store = new SettingsStore(stateDirOf(config))

  // Live effective settings: the settings page edits the store, so threshold /
  // repeat / proxy are re-read per event instead of frozen at boot.
  const settings = (): EffectiveSettings => effectiveOf(config, store)

  const pushNow = async (credential: string, title: string, desp: string): Promise<PushResult> => {
    const url = buildPushUrl(credential)
    if (url === null) return { ok: false, message: 'SendKey/URL 无效或未配置' }
    return sendPush(url, settings().proxy, title, desp)
  }

  const tracker = new PendingTracker({
    thresholdMs: () => settings().thresholdMinutes * 60_000,
    repeatMs: () => settings().repeatMinutes * 60_000,
    onFire: async (pending) => {
      // Re-check right before publishing: a stop() that landed while a
      // previous push (or the threshold tick) was in flight must not send a
      // stale notice for an already-answered interaction.
      if (!tracker.has(pending.id)) return
      const credential = resolveCredential(config, store)
      if (credential === '') {
        log.warn(`pending ${pending.id} not pushed: no ServerChan credential configured`)
        return
      }
      const result = await pushNow(credential, pushTitle(config, pending), pushDesp(pending, config, settings()))
      if (result.ok) {
        log.info(`pushed ${pending.kind} reminder (${pending.id}, push #${pending.pushes})`)
      } else {
        log.warn(`push failed for ${pending.id}: ${result.message}`)
      }
    },
  })

  // Per-session FIFO of open question/plan-review callIds, for the rare
  // fallback where a tool/result carries no call identity on its source.
  const questionQueues = new Map<string, string[]>()

  ctx.effect(() => () => {
    tracker.dispose()
    questionQueues.clear()
  }, 'serverchan-watchdog: teardown')

  const boot = settings()
  if (boot.enabled && boot.thresholdMinutes > 0) {
    ctx.on('session/event', (session: Session, event: SessionEvent) => {
      if (event.type === 'tool/call') {
        const callId = event.data.callId
        if (event.data.name === 'ask_user_question') {
          const described = describeQuestionCall(event.data.arguments)
          if (described === null) return
          const queue = questionQueues.get(session.id)
          if (queue === undefined) questionQueues.set(session.id, [callId])
          else queue.push(callId)
          tracker.start({
            id: `q:${callId}`,
            kind: described.kind,
            sessionId: session.id,
            detail: described.detail,
          })
          return
        }
        if (event.data.name === 'exit_plan_mode') {
          // Plan review: the tool asks `ctx.userQuestions` directly; the only
          // session-log signal is this tool's call/result pair.
          const queue = questionQueues.get(session.id)
          if (queue === undefined) questionQueues.set(session.id, [callId])
          else queue.push(callId)
          tracker.start({
            id: `q:${callId}`,
            kind: 'plan-review',
            sessionId: session.id,
            detail: describeExitPlanCall(event.data.arguments),
          })
          return
        }
        return
      }
      if (event.type === 'tool/result') {
        const source = event.data.message?.source
        const callId = source?.kind === 'tool' ? source.callId : undefined
        if (callId !== undefined) {
          tracker.stop(`q:${callId}`)
          const queue = questionQueues.get(session.id)
          if (queue !== undefined) {
            const index = queue.indexOf(callId)
            if (index >= 0) queue.splice(index, 1)
            if (queue.length === 0) questionQueues.delete(session.id)
          }
          return
        }
        // Fallback: no call identity on the result; assume FIFO completion order.
        const queue = questionQueues.get(session.id)
        const head = queue?.shift()
        if (head !== undefined) {
          tracker.stop(`q:${head}`)
          if ((queue as string[]).length === 0) questionQueues.delete(session.id)
        }
        return
      }
      if (event.type === 'approval/asked') {
        tracker.start({
          id: `a:${event.data.id}`,
          kind: 'approval',
          sessionId: session.id,
          detail: event.data.reason ?? `工具 ${event.data.toolName} 请求审批`,
        })
        return
      }
      if (event.type === 'approval/decided') {
        tracker.stop(`a:${event.data.id}`)
      }
    })
  }

  // The webserver row belongs to another bundle layer and may activate after
  // this row: ctx.inject waits for it (the subagent-library pattern) instead
  // of touching ctx.webServer as a property, which throws on an undeclared
  // service before the webserver exists.
  ctx.inject(['webServer'], (wctx: Context) => {
    const web = wctx.webServer

    wctx.effect(() => web.register({
      kind: 'exact',
      path: '/serverchan-watchdog/status',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        if (!guardLoopback(req, res)) return
        sendJson(res, 200, {
          ok: true,
          ...editableView(config, store),
          pending: tracker.list(),
        })
      },
    }), 'serverchan-watchdog: status route')

    wctx.effect(() => web.register({
      kind: 'exact',
      path: '/serverchan-watchdog/config',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          if (!guardLoopback(req, res)) return
          sendJson(res, 200, { ok: true, ...editableView(config, store) })
          return
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        if (!guardWrite(req, res)) return
        let body: unknown
        try {
          body = await readJsonBody(req)
        } catch {
          sendJson(res, 400, { ok: false, error: 'body-too-large' })
          return
        }
        if (body === null || typeof body !== 'object' || Array.isArray(body)) {
          sendJson(res, 400, { ok: false, error: 'invalid-json' })
          return
        }
        const record = body as Record<string, unknown>
        const patch: StorePatch = {}
        if (record['clearKey'] === true) patch.clearKey = true
        if (typeof record['sendkey'] === 'string') patch.sendkey = record['sendkey']
        if (typeof record['thresholdMinutes'] === 'number') patch.thresholdMinutes = record['thresholdMinutes']
        if (typeof record['repeatMinutes'] === 'number') patch.repeatMinutes = record['repeatMinutes']
        if (typeof record['proxy'] === 'string') patch.proxy = record['proxy']
        if (Object.keys(patch).length === 0) {
          sendJson(res, 400, { ok: false, error: 'nothing-to-save' })
          return
        }
        try {
          store.update(patch)
        } catch (error) {
          if (error instanceof StoreError) {
            sendJson(res, 400, { ok: false, error: error.code, message: error.message })
          } else {
            log.warn(`config save failed: ${error instanceof Error ? error.message : String(error)}`)
            sendJson(res, 500, { ok: false, error: 'save-failed' })
          }
          return
        }
        log.info('settings saved (sendkey encrypted)')
        sendJson(res, 200, { ok: true, ...editableView(config, store) })
      },
    }), 'serverchan-watchdog: config route')

    wctx.effect(() => web.register({
      kind: 'exact',
      path: '/serverchan-watchdog/test',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        if (!guardWrite(req, res)) return
        const result = await pushNow(
          resolveCredential(config, store),
          'DSH ServerChan 配置测试',
          '这条消息说明推送配置可用。',
        )
        sendJson(res, 200, { ok: result.ok, message: result.message })
      },
    }), 'serverchan-watchdog: test route')
  })
}
