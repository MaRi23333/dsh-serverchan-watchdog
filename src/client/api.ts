/**
 * Browser-side API surface for the watchdog settings page. The credential
 * travels only into the POST body and is never part of any GET response.
 */

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

async function readJson<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T
  } catch {
    return { ok: false, error: `HTTP ${response.status}` } as unknown as T
  }
}

export async function fetchStatus(): Promise<WatchdogStatus> {
  try {
    const response = await fetch('/serverchan-watchdog/status', { cache: 'no-store' })
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` }
    return await readJson<WatchdogStatus>(response)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'status fetch failed' }
  }
}

export async function fetchConfig(): Promise<WatchdogConfigView> {
  try {
    const response = await fetch('/serverchan-watchdog/config', { cache: 'no-store' })
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` }
    return await readJson<WatchdogConfigView>(response)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'config fetch failed' }
  }
}

export interface WatchdogPatch {
  sendkey?: string
  clearKey?: boolean
  thresholdMinutes?: number
  repeatMinutes?: number
  proxy?: string
  webUrl?: string
}

export async function saveConfig(patch: WatchdogPatch): Promise<WatchdogConfigView> {
  try {
    const response = await fetch('/serverchan-watchdog/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const payload = await readJson<WatchdogConfigView>(response)
    if (!response.ok || payload.ok !== true) {
      return { ok: false, error: payload.error ?? payload.message ?? `HTTP ${response.status}` }
    }
    return payload
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'config save failed' }
  }
}

export async function sendTest(): Promise<WatchdogTestResult> {
  try {
    const response = await fetch('/serverchan-watchdog/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const payload = await readJson<WatchdogTestResult>(response)
    if (!response.ok || payload.ok !== true) {
      return { ok: false, error: payload.error ?? payload.message ?? `HTTP ${response.status}` }
    }
    return payload
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'test push failed' }
  }
}
