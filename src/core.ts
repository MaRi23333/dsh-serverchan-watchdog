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
  /** Delay from start to the first fire. */
  thresholdMs: number
  /** Delay between repeats while still pending; 0 = push once only. */
  repeatMs: number
  /** Called when the threshold (or a repeat interval) elapses while still pending. */
  onFire: (pending: PendingInteraction) => Promise<void> | void
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
  private readonly thresholdMs: number
  private readonly repeatMs: number
  private readonly onFire: TrackerOptions['onFire']

  constructor(options: TrackerOptions) {
    this.now = options.now ?? (() => Date.now())
    this.after = options.after ?? ((ms, fn) => setTimeout(fn, ms))
    this.cancel = options.cancel ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))
    this.thresholdMs = options.thresholdMs
    this.repeatMs = options.repeatMs
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
    const timer = this.after(this.thresholdMs, () => { void this.fire(pending) })
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

  /** Stop every watched interaction (plugin teardown). */
  dispose(): void {
    for (const id of [...this.entries.keys()]) this.stop(id)
  }

  private async fire(pending: PendingInteraction): Promise<void> {
    const entry = this.entries.get(pending.id)
    if (entry === undefined) return
    pending.pushes += 1
    entry.repeat = undefined
    try {
      await this.onFire(pending)
    } catch {
      // Contained: a throwing pusher must not kill the next repeat.
    }
    if (this.repeatMs > 0 && this.entries.get(pending.id) === entry) {
      entry.repeat = this.after(this.repeatMs, () => { void this.fire(pending) })
    }
  }
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
