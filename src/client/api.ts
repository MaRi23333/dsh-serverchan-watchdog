/**
 * Browser-side API surface for the watchdog settings page.
 *
 * The credential travels only into the POST body and is never part of any GET
 * response: `fetchConfig` reports whether one is stored, never its value.
 */

/** Editable settings as the host renders them (no credential value or host paths). */
export interface WatchdogConfigView {
  ok: boolean
  enabled?: boolean
  thresholdMinutes?: number
  repeatMinutes?: number
  title?: string
  webUrl?: string
  proxy?: string
  credentialConfigured?: boolean
  hasStoredKey?: boolean
  error?: string
  message?: string
}

/** One human interaction the host is currently watching for an answer. */
export interface WatchdogPendingView {
  id: string
  kind: 'question' | 'plan-review' | 'approval'
  sessionId: string
  detail: string
  startedAt: number
  pushes: number
}

export interface WatchdogStatus extends WatchdogConfigView {
  pending?: WatchdogPendingView[]
}

export interface WatchdogTestResult {
  ok: boolean
  message?: string
  error?: string
}

/**
 * One settings edit. Field values are whole values, not deltas: the page
 * stages the user's edits and writes them in one POST.
 */
export interface WatchdogPatch {
  sendkey?: string
  clearKey?: boolean
  enabled?: boolean
  thresholdMinutes?: number
  repeatMinutes?: number
  title?: string
  proxy?: string
  webUrl?: string
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T
  } catch {
    // A non-JSON body (proxy error page, truncated response) still has to
    // report its status rather than throw out of the caller's promise chain.
    return { ok: false, error: `HTTP ${response.status}` } as unknown as T
  }
}

function failureOf(payload: { error?: string; message?: string }, response: Response): string {
  return payload.error ?? payload.message ?? `HTTP ${response.status}`
}

async function getJson<T extends { ok: boolean; error?: string }>(path: string): Promise<T> {
  try {
    const response = await fetch(path, { cache: 'no-store' })
    const payload = await readJson<T>(response)
    if (!response.ok) return { ...payload, ok: false, error: failureOf(payload, response) }
    return payload
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'request failed' } as T
  }
}

/** Read the live status: effective settings plus the pending list. */
export function fetchStatus(): Promise<WatchdogStatus> {
  return getJson<WatchdogStatus>('/serverchan-watchdog/status')
}

/** Read the editable settings; never returns the credential. */
export function fetchConfig(): Promise<WatchdogConfigView> {
  return getJson<WatchdogConfigView>('/serverchan-watchdog/config')
}

/** Write a settings patch and read back the effective values. */
export async function saveConfig(patch: WatchdogPatch): Promise<WatchdogConfigView> {
  try {
    const response = await fetch('/serverchan-watchdog/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const payload = await readJson<WatchdogConfigView>(response)
    if (!response.ok || payload.ok !== true) {
      return { ok: false, error: failureOf(payload, response) }
    }
    return payload
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'config save failed' }
  }
}

/** Send one test push with the settings currently stored on the host. */
export async function sendTest(): Promise<WatchdogTestResult> {
  try {
    const response = await fetch('/serverchan-watchdog/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const payload = await readJson<WatchdogTestResult>(response)
    if (!response.ok || payload.ok !== true) {
      return { ok: false, error: failureOf(payload, response) }
    }
    return payload
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'test push failed' }
  }
}
