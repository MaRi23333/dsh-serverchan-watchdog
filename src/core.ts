/**
 * Pure watchdog core for dsh-serverchan-watchdog — no harness imports, so the
 * ServerChan credential/URL handling, `ask_user_question` argument parsing,
 * and the pending-interaction tracker are unit-testable in isolation.
 * @module dsh-serverchan-watchdog/core
 */

/** The human-interaction family a pending entry belongs to. */
export type PendingKind = 'question' | 'plan-review' | 'approval'

/** One pending human interaction being watched. */
export interface PendingInteraction {
  /** Registry identity: `q:<callId>` for questions, `a:<approvalId>` for approvals. */
  id: string
  kind: PendingKind
  /** Session id carrying the pending ask. */
  sessionId: string
  /** Short human text shown in the push body (question text or approval reason). */
  detail: string
  /** When the ask was first observed (epoch ms). */
  startedAt: number
  /** How many times a reminder was pushed so far. */
  pushes: number
}

/** Outcome of one reminder attempt. */
export type FireOutcome = 'delivered' | 'deferred' | 'retryable-failure' | 'terminal-failure'

/** Injected timing seam (tests use fake clocks; production uses real timers). */
export interface TrackerOptions {
  /** Delay from start to the first fire. A function is re-read per start, so a settings change applies to interactions watched from then on. */
  thresholdMs: number | (() => number)
  /** Delay between repeats while still pending; 0 = push once only. A function is re-read per fire. */
  repeatMs: number | (() => number)
  /** Delay before retrying after a retryable fire while still pending (default 5 minutes). */
  retryMs?: number | (() => number)
  /**
   * Called when the threshold (or a repeat/retry interval) elapses while still
   * pending. `deferred` does not consume the bounded retry budget; a
   * `retryable-failure` consumes one of at most two retries; terminal failures
   * stop tracking. The legacy boolean return is accepted for compatibility.
   */
  onFire: (pending: PendingInteraction) => FireOutcome | boolean | void | Promise<FireOutcome | boolean | void>
  now?: () => number
  after?: (ms: number, fn: () => void) => unknown
  cancel?: (handle: unknown) => void
}

interface Entry {
  pending: PendingInteraction
  timer: unknown
  repeat: unknown
  retries: number
}

/**
 * Tracks pending human interactions with threshold/repeat timers.
 * `stop()` cancels everything; a fire that settles after `stop()` is a no-op.
 */
export class PendingTracker {
  private readonly entries = new Map<string, Entry>()
  private readonly now: () => number
  private readonly after: (ms: number, fn: () => void) => unknown
  private readonly cancel: (handle: unknown) => void
  private readonly thresholdMs: () => number
  private readonly repeatMs: () => number
  private readonly retryMs: () => number
  private readonly onFire: TrackerOptions['onFire']

  constructor(options: TrackerOptions) {
    this.now = options.now ?? (() => Date.now())
    this.after = options.after ?? ((ms, fn) => setTimeout(fn, ms))
    this.cancel = options.cancel ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))
    const threshold = options.thresholdMs
    const repeat = options.repeatMs
    const retry = options.retryMs ?? (() => 5 * 60_000)
    this.thresholdMs = typeof threshold === 'function' ? threshold : () => threshold
    this.repeatMs = typeof repeat === 'function' ? repeat : () => repeat
    this.retryMs = typeof retry === 'function' ? retry : () => retry
    this.onFire = options.onFire
  }

  /** Number of interactions currently watched. */
  get size(): number {
    return this.entries.size
  }

  /**
   * Begin watching one interaction. A repeat start for the same id is a no-op.
   * @param entry - identity, kind, session, and display text; startedAt/pushes are filled here.
   */
  start(entry: Omit<PendingInteraction, 'startedAt' | 'pushes'> & Partial<Pick<PendingInteraction, 'startedAt'>>): void {
    if (this.entries.has(entry.id)) return
    const now = this.now()
    const startedAt = entry.startedAt ?? now
    const pending: PendingInteraction = { ...entry, detail: truncate(entry.detail, 500), startedAt, pushes: 0 }
    const elapsed = Math.max(0, now - startedAt)
    const delay = Math.max(0, this.thresholdMs() - elapsed)
    const timer = this.after(delay, () => { void this.fire(pending) })
    this.entries.set(entry.id, { pending, timer, repeat: undefined, retries: 0 })
  }

  /**
   * Stop watching one interaction and cancel any scheduled repeat.
   * @param id - the exact identity passed to {@link start}.
   */
  stop(id: string): void {
    const entry = this.entries.get(id)
    if (entry === undefined) return
    this.cancel(entry.timer)
    if (entry.repeat !== undefined) this.cancel(entry.repeat)
    this.entries.delete(id)
  }

  /**
   * Whether one interaction is still being watched. A fire callback should
   * re-check this right before publishing, so a `stop()` that lands while the
   * callback awaits (e.g. an HTTP push in flight) cannot send a stale notice.
   * @param id - the identity passed to {@link start}.
   */
  has(id: string): boolean {
    return this.entries.has(id)
  }

  /** Snapshot of the active interactions. */
  list(): PendingInteraction[] {
    return [...this.entries.values()].map(entry => ({ ...entry.pending }))
  }

  /**
   * Stop every interaction matching a predicate (e.g. all of one session).
   * @param match - predicate over the pending entry.
   */
  stopWhere(match: (pending: PendingInteraction) => boolean): void {
    for (const id of [...this.entries.keys()]) {
      const entry = this.entries.get(id)
      if (entry !== undefined && match(entry.pending)) this.stop(id)
    }
  }

  /** Stop every watched interaction (plugin teardown). */
  dispose(): void {
    for (const id of [...this.entries.keys()]) this.stop(id)
  }

  private async fire(pending: PendingInteraction): Promise<void> {
    const entry = this.entries.get(pending.id)
    if (entry === undefined) return
    entry.repeat = undefined
    let outcome: FireOutcome = 'delivered'
    try {
      // Give the callback an immutable-looking attempt snapshot so titles,
      // bodies and logs can describe this delivery as #1/#2 before the
      // committed successful-delivery counter is updated below.
      const attempt = { ...pending, pushes: pending.pushes + 1 }
      const result = await this.onFire(attempt)
      if (result === false) outcome = 'retryable-failure'
      else if (result === true || result === undefined) outcome = 'delivered'
      else outcome = typeof result === 'string' ? result : 'delivered'
    } catch {
      outcome = 'retryable-failure'
    }
    if (this.entries.get(pending.id) !== entry) return
    if (outcome === 'delivered') {
      pending.pushes += 1
      entry.retries = 0
      if (this.repeatMs() > 0) {
        entry.repeat = this.after(this.repeatMs(), () => { void this.fire(pending) })
      }
      return
    }
    if (outcome === 'deferred') {
      if (this.retryMs() > 0) entry.repeat = this.after(this.retryMs(), () => { void this.fire(pending) })
      return
    }
    if (outcome === 'retryable-failure') {
      if (entry.retries < 2 && this.retryMs() > 0) {
        entry.retries += 1
        entry.repeat = this.after(this.retryMs(), () => { void this.fire(pending) })
      } else {
        this.entries.delete(pending.id)
      }
      return
    }
    // A terminal upstream response must not cause another quota-consuming call.
    this.entries.delete(pending.id)
  }
}

/**
 * Validate one settings-page minute value as an integer within range.
 * @param value - raw value from a settings patch.
 * @param min - inclusive minimum.
 * @param max - inclusive maximum.
 * @returns the integer, or null when out of range / not a finite integer.
 */
export function minutesValue(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) return null
  if (value < min || value > max) return null
  return value
}

/**
 * Resolve a ServerChan delivery URL from a credential that is either a full
 * https push URL (ServerChan's own hosts only), an sctp SendKey
 * ("sctp<uid>t<rest>"), or a classic SendKey.
 * @returns the delivery URL, or null for an empty/malformed credential. A
 *   full URL on any other host, an http:// URL, or an uppercase "SCTP" key is
 *   rejected — an arbitrary host would turn the config endpoint into a
 *   form-POST proxy and leak the key; the official hosts are fixed.
 */
export function buildPushUrl(credential: string): string | null {
  const value = credential.trim()
  if (value === '') return null
  if (/^https:\/\//i.test(value)) {
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      return null
    }
    if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '' || parsed.port !== '' || parsed.search !== '' || parsed.hash !== '') return null
    const classic = /^\/(SCT[A-Za-z0-9_-]+)\.send\/?$/.exec(parsed.pathname)
    if (parsed.hostname === 'sctapi.ftqq.com' && classic !== null && !/^SCTP/i.test(classic[1])) {
      return `https://sctapi.ftqq.com/${classic[1]}.send`
    }
    const sc3 = /^\/send\/(sctp(\d+)t[A-Za-z0-9_-]+)\.send\/?$/.exec(parsed.pathname)
    if (sc3 !== null && parsed.hostname === `${sc3[2]}.push.ft07.com`) {
      return `https://${sc3[2]}.push.ft07.com/send/${sc3[1]}.send`
    }
    return null
  }
  // Any other URL-shaped credential (http://, ftp://, …) is rejected up front
  // instead of being misused as a classic SendKey.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return null
  if (value.startsWith('sctp')) {
    const match = /^sctp(\d+)t[A-Za-z0-9_-]+$/.exec(value)
    return match === null ? null : `https://${match[1]}.push.ft07.com/send/${value}.send`
  }
  // "SCTP..." (uppercase) is not a valid Server酱³ key; misrouting it to the
  // classic endpoint would fail with a confusing 403, so reject it up front.
  if (/^sctp/i.test(value)) return null
  if (!/^SCT[A-Za-z0-9_-]+$/.test(value)) return null
  return `https://sctapi.ftqq.com/${value}.send`
}

/**
 * Summarize one raw `ask_user_question` tool-call arguments JSON string: the
 * first question's text and whether it is a plan review (intent plan-review).
 * @returns the kind and display detail, or null when the payload is not a
 *   question list (malformed JSON, missing/empty questions).
 */
export function describeQuestionCall(rawArguments: string): { kind: PendingKind; detail: string } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawArguments)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const questions = (parsed as { questions?: unknown }).questions
  if (!Array.isArray(questions) || questions.length === 0) return null
  const first = questions[0] as { question?: unknown; intent?: { kind?: unknown } } | null
  if (first === null || typeof first !== 'object') return null
  const question = typeof first.question === 'string' ? first.question : ''
  return {
    kind: first.intent?.kind === 'plan-review' ? 'plan-review' : 'question',
    detail: question === '' ? '(无问题文本)' : question,
  }
}

/**
 * Collapse whitespace and clip one line for display.
 * @param text - source text.
 * @param max - maximum output length; overflow appends an ellipsis.
 */
export function truncate(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, Math.max(max - 1, 0))}…`
}

/**
 * Summarize one raw `exit_plan_mode` tool-call arguments JSON string (plan
 * mode's plan review: the tool calls `ctx.userQuestions.ask` directly, so the
 * only session-log signal is this tool's call/result pair).
 * @returns display detail (plan heading/first words), never null — a bad
 *   payload still has to be watched, or a review would silently go unnoticed.
 */
export function describeExitPlanCall(rawArguments: string): string {
  let plan = ''
  try {
    const parsed = JSON.parse(rawArguments) as { plan?: unknown }
    plan = typeof parsed?.plan === 'string' ? parsed.plan : ''
  } catch {
    // fall through to the generic label
  }
  const snippet = truncate(plan, 120)
  return snippet === '' ? '计划审查（无计划文本）' : `计划审查：${snippet}`
}

/** Minimal view of one session-log event, enough to fold pending pairs. */
export interface SessionEventView {
  type: string
  data: Record<string, unknown>
  time?: number
}

/**
 * Read a session's durable log in a way that works on both current DSH
 * (`snapshotEvents()`, 0.1.2+) and the older `session.events` array.
 * Constructor-seeded history is never published on `session/event`, so
 * recovery has to read the log — this is that read.
 * @param session - a live Session-like object, or anything else (returns []).
 */
export function readSessionLog(session: unknown): readonly SessionEventView[] {
  if (session === null || typeof session !== 'object') return []
  const candidate = session as { snapshotEvents?: unknown; events?: unknown }
  if (typeof candidate.snapshotEvents === 'function') {
    try {
      const snap = (candidate.snapshotEvents as () => unknown)()
      if (Array.isArray(snap)) return snap as SessionEventView[]
    } catch {
      return []
    }
  }
  if (Array.isArray(candidate.events)) return candidate.events as SessionEventView[]
  return []
}

/** One interaction to re-watch. */
export interface PendingSeed {
  id: string
  kind: PendingKind
  sessionId: string
  detail: string
  startedAt: number
}

/**
 * Fold a session log and recover interactions still awaiting a human answer —
 * used at plugin startup so a `dsh web` restart does not silently drop the
 * watch on asks that were already pending (the timers are in-memory).
 *
 * Includes:
 *  - `tool/call` of `ask_user_question` / `exit_plan_mode` without a matching
 *    `tool/result` (paired by `message.source.callId`);
 *  - the same calls consumed by a `tool/result` that carries no call id,
 *    in FIFO order, matching the live session handler;
 *  - `approval/asked` without a matching `approval/decided` (paired by id).
 *
 * An unanswered ask is by definition not yet answered, so an unclosed pair
 * here is the ask still waiting — with one caveat: if the host died between
 * the human answering and the result being appended, the pair is still open
 * even though the human already answered. Callers that re-arm these seeds
 * should honor a durable ignore list so a stuck row can be dismissed.
 * A callId-less result already in the log is not that caveat: it closed the
 * oldest open question, and that question must not come back as a seed.
 * A replayed `tool/call` with the same callId is one open ask, not two: the
 * first copy is kept, and closing that id drops every copy.
 *
 * @param events - the session's events in log order.
 * @param sessionId - session identity for the seeds.
 * @returns seeds to start, in log order.
 */
/**
 * Call id on a `tool/result`, or undefined when the live handler falls through
 * to the question FIFO. A non-string call id is treated as missing so recovery
 * and the live path agree on which results are anonymous.
 */
function toolResultCallId(data: Record<string, unknown>): string | undefined {
  const message = data['message'] as { source?: { kind?: unknown; callId?: unknown } } | undefined
  const source = message?.source
  if (source?.kind !== 'tool') return undefined
  return typeof source.callId === 'string' ? source.callId : undefined
}

export function recoverPending(
  events: readonly SessionEventView[],
  sessionId: string,
): PendingSeed[] {
  /** Still-open seeds in log order. Question calls are the FIFO; approvals sit among them and are never shifted by an anonymous result. */
  const open: PendingSeed[] = []
  const closedQuestions = new Set<string>()
  const closedApprovals = new Set<string>()

  const closeQuestion = (callId: string): void => {
    closedQuestions.add(callId)
    // A replay may have appended the same call more than once. Closing it
    // drops every copy; leaving one would look still pending.
    for (let index = open.length - 1; index >= 0; index -= 1) {
      const seed = open[index]
      if (seed !== undefined && seed.kind !== 'approval' && seed.id === `q:${callId}`) open.splice(index, 1)
    }
  }

  for (const event of events) {
    const data = event.data
    if (event.type === 'tool/call') {
      const name = data['name']
      if (name !== 'ask_user_question' && name !== 'exit_plan_mode') continue
      const callId = data['callId']
      if (typeof callId !== 'string') continue
      if (closedQuestions.has(callId)) continue
      // Same call replayed before its result is still one open ask. Keep the
      // first copy so a single result cannot leave a duplicate seed behind.
      if (open.some(seed => seed.id === `q:${callId}`)) continue
      open.push({
        id: `q:${callId}`,
        kind: name === 'exit_plan_mode' ? 'plan-review' : 'question',
        sessionId,
        detail: name === 'exit_plan_mode'
          ? describeExitPlanCall(typeof data['arguments'] === 'string' ? data['arguments'] : '')
          : (describeQuestionCall(typeof data['arguments'] === 'string' ? data['arguments'] : '')?.detail
            ?? '问答（请打开界面查看）'),
        startedAt: event.time ?? Date.now(),
      })
    } else if (event.type === 'tool/result') {
      const callId = toolResultCallId(data)
      if (callId !== undefined) {
        // Same as the live path: an identified result closes that call even
        // when it is not the FIFO head, and a result seen before its call
        // keeps the later call from being re-opened.
        closeQuestion(callId)
        continue
      }
      // No call id. The live handler shifts the oldest open question,
      // including an ignored placeholder. Do that here so recovery does not
      // rebuild a tombstone for a question this result already answered.
      const index = open.findIndex(seed => seed.kind !== 'approval')
      const consumed = index >= 0 ? open[index] : undefined
      if (consumed !== undefined) closeQuestion(consumed.id.slice(2))
    } else if (event.type === 'approval/asked') {
      const id = data['id']
      if (typeof id !== 'string') continue
      if (closedApprovals.has(id)) continue
      if (open.some(seed => seed.id === `a:${id}`)) continue
      open.push({
        id: `a:${id}`,
        kind: 'approval',
        sessionId,
        detail: typeof data['reason'] === 'string'
          ? data['reason']
          : `工具 ${String(data['toolName'] ?? '?')} 请求审批`,
        startedAt: event.time ?? Date.now(),
      })
    } else if (event.type === 'approval/decided') {
      const id = data['id']
      if (typeof id !== 'string') continue
      closedApprovals.add(id)
      for (let index = open.length - 1; index >= 0; index -= 1) {
        if (open[index]?.id === `a:${id}`) open.splice(index, 1)
      }
    }
  }
  return open
}
