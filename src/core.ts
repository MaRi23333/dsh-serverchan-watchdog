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

/** Injected timing seam (tests use fake clocks; production uses real timers). */
export interface TrackerOptions {
  /** Delay from start to the first fire. A function is re-read per start, so a settings change applies to interactions watched from then on. */
  thresholdMs: number | (() => number)
  /** Delay between repeats while still pending; 0 = push once only. A function is re-read per fire. */
  repeatMs: number | (() => number)
  /** Delay before retrying after a FAILED fire while still pending (default 5 minutes). */
  retryMs?: number | (() => number)
  /**
   * Called when the threshold (or a repeat/retry interval) elapses while still
   * pending. Return `false` (or throw) to schedule a retry after
   * {@link TrackerOptions.retryMs}; retries continue until delivery succeeds or
   * the interaction is stopped, so a transient failure cannot silently burn the
   * only reminder.
   */
  onFire: (pending: PendingInteraction) => boolean | void | Promise<boolean | void>
  now?: () => number
  after?: (ms: number, fn: () => void) => unknown
  cancel?: (handle: unknown) => void
}

interface Entry {
  pending: PendingInteraction
  timer: unknown
  repeat: unknown
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
  start(entry: Omit<PendingInteraction, 'startedAt' | 'pushes'>): void {
    if (this.entries.has(entry.id)) return
    const pending: PendingInteraction = { ...entry, startedAt: this.now(), pushes: 0 }
    const timer = this.after(this.thresholdMs(), () => { void this.fire(pending) })
    this.entries.set(entry.id, { pending, timer, repeat: undefined })
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
    pending.pushes += 1
    entry.repeat = undefined
    let failed = false
    try {
      failed = await this.onFire(pending) === false
    } catch {
      failed = true
    }
    if (this.entries.get(pending.id) !== entry) return
    if (failed && this.retryMs() > 0) {
      entry.repeat = this.after(this.retryMs(), () => { void this.fire(pending) })
    } else if (this.repeatMs() > 0) {
      entry.repeat = this.after(this.repeatMs(), () => { void this.fire(pending) })
    }
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
    let host: string
    try {
      host = new URL(value).host
    } catch {
      return null
    }
    if (host === 'sctapi.ftqq.com' || /^\d+\.push\.ft07\.com$/.test(host)) return value
    return null
  }
  // Any other URL-shaped credential (http://, ftp://, …) is rejected up front
  // instead of being misused as a classic SendKey.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return null
  if (value.startsWith('sctp')) {
    const match = /^sctp(\d+)t/.exec(value)
    return match === null ? null : `https://${match[1]}.push.ft07.com/send/${value}.send`
  }
  // "SCTP..." (uppercase) is not a valid Server酱³ key; misrouting it to the
  // classic endpoint would fail with a confusing 403, so reject it up front.
  if (/^sctp/i.test(value)) return null
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
 *  - `approval/asked` without a matching `approval/decided` (paired by id).
 *
 * An unanswered ask is by definition not yet answered, so an unclosed pair
 * here is the ask still waiting — with one caveat: if the host died between
 * the human answering and the result being appended, this re-arms a watch on
 * an already-answered ask (harmless: no answer can be expected, the reminder
 * fires and the next session pass closes the pair).
 *
 * @param events - the session's events in log order.
 * @param sessionId - session identity for the seeds.
 * @returns seeds to start, in log order.
 */
export function recoverPending(
  events: readonly SessionEventView[],
  sessionId: string,
): PendingSeed[] {
  const seeds: PendingSeed[] = []
  const seenQuestions = new Set<string>()
  const seenApprovals = new Set<string>()
  for (const event of events) {
    const data = event.data
    if (event.type === 'tool/call') {
      const name = data['name']
      if (name !== 'ask_user_question' && name !== 'exit_plan_mode') continue
      const callId = data['callId']
      if (typeof callId !== 'string') continue
      if (seenQuestions.has(callId)) continue
      seeds.push({
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
      const message = data['message'] as { source?: { kind?: string; callId?: string } } | undefined
      const callId = message?.source?.kind === 'tool' ? message.source.callId : undefined
      if (callId === undefined) continue
      seenQuestions.add(callId)
    } else if (event.type === 'approval/asked') {
      const id = data['id']
      if (typeof id !== 'string') continue
      if (seenApprovals.has(id)) continue
      seeds.push({
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
      if (typeof id === 'string') seenApprovals.add(id)
    }
  }
  // Fold again, dropping every seed whose pair closed later than its opening
  // (a result/decided may appear after the call in a crash-tail or replay).
  return seeds.filter(seed => (
    seed.kind === 'approval' ? !seenApprovals.has(seed.id.slice(2)) : !seenQuestions.has(seed.id.slice(2))
  ))
}
