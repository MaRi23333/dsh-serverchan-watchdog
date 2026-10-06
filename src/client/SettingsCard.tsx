/**
 * Settings page for dsh-serverchan-watchdog.
 *
 * Five cards, each owning one concern: push channel (credential), alert timing
 * (threshold + repeat), alert content (title prefix), tap-through (jump link),
 * and the live pending list. The master switch lives in the header because it
 * governs all of them.
 *
 * Behavior contract:
 *  - Edits are staged locally and only written by "保存设置", so a half-typed
 *    SendKey never reaches the host; leaving the page drops the draft.
 *  - The credential is never read back: the field shows a placeholder once one
 *    is stored, and an empty field means "keep the stored key".
 *  - The pending list polls the host every 10 s and keeps its own timers so the
 *    wait times stay live between polls.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import clsx from 'clsx'
import { Button, Input, Switch, Tag, type TagTone } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './settings.module.css'
import type {
  WatchdogConfigView,
  WatchdogPatch,
  WatchdogPendingView,
  WatchdogStatus,
  WatchdogTestResult,
} from './api.ts'
import type { WatchdogKey } from './locales.ts'

/** Interval the pending list refreshes at, matching the host's 10 s cadence. */
const POLL_MS = 10_000
/** Host-side cap on the push title; mirrors TITLE_MAX in src/index.ts. */
const TITLE_MAX = 32

/** Injected share handed to the component by the slot registration. */
export interface WatchdogSettingsInjected {
  t: (key: WatchdogKey, params?: Record<string, string | number>) => string
  config: () => Promise<WatchdogConfigView>
  status: () => Promise<WatchdogStatus>
  saveConfig: (patch: WatchdogPatch) => Promise<WatchdogConfigView>
  test: () => Promise<WatchdogTestResult>
}

/** Everything the page keeps in the draft. */
interface Draft {
  enabled: boolean
  thresholdMinutes: string
  repeatMinutes: string
  title: string
  webUrl: string
  proxy: string
}

type LinkMode = 'none' | 'desktop' | 'custom'

const KINDS: Record<WatchdogPendingView['kind'], WatchdogKey> = {
  question: 'settings.kind.question',
  'plan-review': 'settings.kind.plan-review',
  approval: 'settings.kind.approval',
}

/** Error codes the host returns map to localized copy; anything else is generic. */
const ERROR_KEYS: Record<string, WatchdogKey> = {
  'invalid-sendkey': 'settings.error.invalid-sendkey',
  'invalid-proxy': 'settings.error.invalid-proxy',
  'invalid-minutes': 'settings.error.invalid-minutes',
  'invalid-weburl': 'settings.error.invalid-weburl',
  'invalid-title': 'settings.error.invalid-title',
}

function draftOf(view: WatchdogConfigView): Draft {
  return {
    enabled: view.enabled !== false,
    thresholdMinutes: String(view.thresholdMinutes ?? 5),
    repeatMinutes: String(view.repeatMinutes ?? 0),
    title: view.title ?? '',
    webUrl: view.webUrl ?? '',
    proxy: view.proxy ?? '',
  }
}

/** Link mode implied by a stored URL: the desktop scheme wins when present. */
function modeOf(webUrl: string): LinkMode {
  if (webUrl === '') return 'none'
  return /^dsh:/i.test(webUrl) ? 'desktop' : 'custom'
}

/** Whole minutes in a stored field, or null when it is not a usable number. */
function minutesOf(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return null
  return Math.round(value)
}

/** Compact elapsed label, switching unit at the minute and hour marks. */
function formatElapsed(ms: number, t: WatchdogSettingsInjected['t']): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  if (totalSeconds < 60) return t('settings.elapsed.seconds', { n: totalSeconds })
  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 60) return t('settings.elapsed.minutes', { n: totalMinutes })
  const hours = Math.floor(totalMinutes / 60)
  return t('settings.elapsed.hours', { h: hours, m: totalMinutes % 60 })
}

export function WatchdogSettings(props: {
  t: WatchdogSettingsInjected['t']
  config: WatchdogSettingsInjected['config']
  status: WatchdogSettingsInjected['status']
  saveConfig: WatchdogSettingsInjected['saveConfig']
  test: WatchdogSettingsInjected['test']
}) {
  const { t, config, status, saveConfig, test } = props

  const [loaded, setLoaded] = useState<WatchdogConfigView | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [credential, setCredential] = useState('')
  const [hasStoredKey, setHasStoredKey] = useState(false)
  const [credentialConfigured, setCredentialConfigured] = useState(false)
  const [stateDir, setStateDir] = useState('')
  const [pending, setPending] = useState<readonly WatchdogPendingView[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<WatchdogTestResult | null>(null)
  /** Counter bumped once a second so pending wait times tick between polls. */
  const [tick, bumpTick] = useReducer((value: number) => value + 1, 0)
  void tick

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const adopt = useCallback((view: WatchdogConfigView) => {
    setLoaded(view)
    setDraft(draftOf(view))
    setHasStoredKey(view.hasStoredKey === true)
    setCredentialConfigured(view.credentialConfigured === true)
    if (view.stateDir !== undefined) setStateDir(view.stateDir)
  }, [])

  // Initial load: settings and status together, so the header never renders a
  // stale "checking" state over real values.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const view = await config()
      if (cancelled || !alive.current) return
      if (!view.ok) {
        setLoadError(view.error ?? t('settings.error.unknown'))
        return
      }
      setLoadError(null)
      adopt(view)
    })()
    return () => { cancelled = true }
  }, [config, adopt, t])

  // Pending poll. Kept separate from the config load so a slow status call can
  // never block the form, and vice versa.
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const refresh = (): void => {
      void status().then((result) => {
        if (cancelled || !alive.current) return
        // Only the pending list is taken from the poll: the form keeps its own
        // draft, which a background refresh must never overwrite.
        if (result.ok) setPending(Array.isArray(result.pending) ? result.pending : [])
      })
    }
    refresh()
    timer = window.setInterval(refresh, POLL_MS)
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [status])

  // Live wait-time ticker for the pending rows.
  useEffect(() => {
    if (pending.length === 0) return
    const timer = window.setInterval(() => { bumpTick() }, 1000)
    return () => { window.clearInterval(timer) }
  }, [pending.length])

  const dirty = useMemo(() => {
    if (loaded === null || draft === null) return false
    const base = draftOf(loaded)
    return credential.trim() !== ''
      || draft.enabled !== base.enabled
      || draft.thresholdMinutes !== base.thresholdMinutes
      || draft.repeatMinutes !== base.repeatMinutes
      || draft.title !== base.title
      || draft.webUrl !== base.webUrl
      || draft.proxy !== base.proxy
  }, [loaded, draft, credential])

  const thresholdValue = draft === null ? null : minutesOf(draft.thresholdMinutes)
  const repeatValue = draft === null ? null : minutesOf(draft.repeatMinutes)
  const thresholdInvalid = thresholdValue === null || thresholdValue < 1 || thresholdValue > 1440
  const repeatInvalid = repeatValue === null || repeatValue < 0 || repeatValue > 1440
  const titleInvalid = draft !== null && draft.title.trim().length > TITLE_MAX
  const invalid = thresholdInvalid || repeatInvalid || titleInvalid

  const onSave = (): void => {
    if (saving || draft === null || invalid) return
    setSaving(true)
    setSaveError(null)
    setSavedAt(null)
    const patch: WatchdogPatch = {
      enabled: draft.enabled,
      thresholdMinutes: thresholdValue ?? 5,
      repeatMinutes: repeatValue ?? 0,
      title: draft.title.trim(),
      webUrl: draft.webUrl.trim(),
      proxy: draft.proxy.trim(),
    }
    const typed = credential.trim()
    if (typed !== '') patch.sendkey = typed
    void saveConfig(patch).then((view) => {
      if (!alive.current) return
      setSaving(false)
      if (!view.ok) {
        const code = view.error ?? ''
        setSaveError(t(ERROR_KEYS[code] ?? 'settings.error.unknown'))
        return
      }
      adopt(view)
      setCredential('')
      setSavedAt(Date.now())
    })
  }

  const onClearKey = (): void => {
    if (saving) return
    setSaving(true)
    setSaveError(null)
    setSavedAt(null)
    void saveConfig({ clearKey: true }).then((view) => {
      if (!alive.current) return
      setSaving(false)
      if (!view.ok) {
        setSaveError(t('settings.error.unknown'))
        return
      }
      adopt(view)
      setCredential('')
      setSavedAt(Date.now())
    })
  }

  const onTest = (): void => {
    if (testing) return
    setTesting(true)
    setTestResult(null)
    void test().then((result) => {
      if (!alive.current) return
      setTesting(false)
      setTestResult(result)
    })
  }

  const onReset = (): void => {
    if (loaded === null) return
    setDraft(draftOf(loaded))
    setCredential('')
    setSaveError(null)
    setSavedAt(null)
  }

  if (loadError !== null) {
    return (
      <div className={css.page}>
        <p className={css.summary}>{t('settings.status.unreachable')}</p>
        <p className={clsx(css.feedback, css.feedbackError)} role="alert">{loadError}</p>
      </div>
    )
  }

  if (draft === null) {
    return (
      <div className={css.page}>
        <p className={css.summary}>{t('settings.status.checking')}</p>
      </div>
    )
  }

  const linkMode = modeOf(draft.webUrl)
  const enabledNow = draft.enabled
  const statusTone: TagTone = enabledNow
    ? (credentialConfigured ? 'success' : 'warning')
    : 'neutral'

  return (
    <div className={css.page}>
      <header className={css.header}>
        <div className={css.headerText}>
          <h2 className={css.title}>{t('settings.title')}</h2>
          <p className={css.summary}>{t('settings.summary')}</p>
        </div>
        <div className={css.headerControl}>
          <span className={css.switchLabel} aria-hidden="true">
            {enabledNow ? t('settings.on') : t('settings.off')}
          </span>
          <Switch
            checked={enabledNow}
            disabled={saving}
            label={enabledNow ? t('settings.switch.off') : t('settings.switch.on')}
            onChange={next => { setDraft({ ...draft, enabled: next }) }}
          />
        </div>
      </header>

      <div className={css.status}>
        <Tag tone={statusTone}>
          <span className={css.badgeStrong}>
            {enabledNow ? t('settings.status.ready') : t('settings.status.disabled')}
          </span>
        </Tag>
        <Tag tone={credentialConfigured ? 'quiet' : 'danger'}>
          {credentialConfigured ? t('settings.credential.ok') : t('settings.status.noCredential')}
        </Tag>
        {pending.length > 0 && (
          <Tag tone="info">{t('settings.status.pendingCount', { count: pending.length })}</Tag>
        )}
      </div>

      <section className={css.card}>
        <div className={css.cardHead}>
          <h3 className={css.cardTitle}>{t('settings.card.channel')}</h3>
        </div>
        <div className={css.field}>
          <label className={css.label} htmlFor="watchdog-credential">{t('settings.credential')}</label>
          <Input
            id="watchdog-credential"
            className={css.mono}
            type="password"
            autoComplete="off"
            spellCheck={false}
            disabled={saving}
            value={credential}
            placeholder={hasStoredKey ? t('settings.credential.placeholder') : 'SCT…'}
            onChange={event => { setCredential(event.currentTarget.value) }}
          />
          <p className={css.hint}>
            {hasStoredKey ? t('settings.credential.replace') : t('settings.credential.hint')}
          </p>
          {hasStoredKey && (
            <div className={css.actions}>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={onClearKey}
              >
                {t('settings.credential.clear')}
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className={css.card}>
        <div className={css.cardHead}>
          <h3 className={css.cardTitle}>{t('settings.card.timing')}</h3>
        </div>
        <div className={css.fieldRow}>
          <div className={css.field}>
            <label className={css.label} htmlFor="watchdog-threshold">{t('settings.threshold')}</label>
            <div className={css.actions}>
              <Input
                id="watchdog-threshold"
                className={clsx(css.inputNarrow)}
                inputMode="numeric"
                disabled={saving}
                aria-invalid={thresholdInvalid}
                value={draft.thresholdMinutes}
                onChange={event => { setDraft({ ...draft, thresholdMinutes: event.currentTarget.value }) }}
              />
              {[1, 5, 15].map(value => (
                <Button
                  key={value}
                  size="sm"
                  variant={thresholdValue === value ? 'primary' : 'outline'}
                  disabled={saving}
                  onClick={() => { setDraft({ ...draft, thresholdMinutes: String(value) }) }}
                >
                  {t(`settings.preset.${value}` as WatchdogKey)}
                </Button>
              ))}
            </div>
            <p className={css.hint}>{t('settings.threshold.hint')}</p>
          </div>
          <div className={css.field}>
            <label className={css.label} htmlFor="watchdog-repeat">{t('settings.repeat')}</label>
            <Input
              id="watchdog-repeat"
              className={clsx(css.inputNarrow)}
              inputMode="numeric"
              disabled={saving}
              aria-invalid={repeatInvalid}
              value={draft.repeatMinutes}
              onChange={event => { setDraft({ ...draft, repeatMinutes: event.currentTarget.value }) }}
            />
            <p className={css.hint}>{t('settings.repeat.hint')}</p>
          </div>
        </div>
      </section>

      <section className={css.card}>
        <div className={css.cardHead}>
          <h3 className={css.cardTitle}>{t('settings.card.message')}</h3>
          <span className={css.cardNote}>
            {t('settings.pushTitle.counter', { n: draft.title.trim().length })}
          </span>
        </div>
        <div className={css.field}>
          <label className={css.label} htmlFor="watchdog-title">{t('settings.pushTitle')}</label>
          <Input
            id="watchdog-title"
            disabled={saving}
            aria-invalid={titleInvalid}
            value={draft.title}
            placeholder={t('settings.pushTitle.placeholder')}
            onChange={event => { setDraft({ ...draft, title: event.currentTarget.value }) }}
          />
          <p className={css.hint}>{t('settings.pushTitle.hint')}</p>
        </div>
      </section>

      <section className={css.card}>
        <div className={css.cardHead}>
          <h3 className={css.cardTitle}>{t('settings.card.link')}</h3>
        </div>
        <div className={css.field}>
          <span className={css.label}>{t('settings.webUrl')}</span>
          <div className={css.actions}>
            {([
              ['none', 'settings.webUrl.mode.none'],
              ['desktop', 'settings.webUrl.mode.desktop'],
              ['custom', 'settings.webUrl.mode.custom'],
            ] as const).map(([mode, key]) => (
              <Button
                key={mode}
                size="sm"
                variant={linkMode === mode ? 'primary' : 'outline'}
                disabled={saving}
                onClick={() => {
                  if (mode === 'none') setDraft({ ...draft, webUrl: '' })
                  else if (mode === 'desktop') setDraft({ ...draft, webUrl: 'dsh://open' })
                  else setDraft({ ...draft, webUrl: linkMode === 'custom' ? draft.webUrl : '' })
                }}
              >
                {t(key)}
              </Button>
            ))}
          </div>
          {linkMode === 'custom' && (
            <Input
              className={css.mono}
              disabled={saving}
              spellCheck={false}
              value={draft.webUrl}
              placeholder="https://…"
              aria-label={t('settings.webUrl.custom')}
              onChange={event => { setDraft({ ...draft, webUrl: event.currentTarget.value }) }}
            />
          )}
          <p className={css.hint}>{t('settings.webUrl.hint')}</p>
        </div>
      </section>

      <section className={css.card}>
        <div className={css.cardHead}>
          <h3 className={css.cardTitle}>{t('settings.card.network')}</h3>
        </div>
        <div className={css.field}>
          <label className={css.label} htmlFor="watchdog-proxy">{t('settings.proxy')}</label>
          <Input
            id="watchdog-proxy"
            className={css.mono}
            disabled={saving}
            spellCheck={false}
            value={draft.proxy}
            placeholder="http://127.0.0.1:7890"
            onChange={event => { setDraft({ ...draft, proxy: event.currentTarget.value }) }}
          />
          <p className={css.hint}>{t('settings.proxy.hint')}</p>
        </div>
      </section>

      <section className={css.card}>
        <div className={css.cardHead}>
          <h3 className={css.cardTitle}>{t('settings.card.pending')}</h3>
          <span className={css.cardNote}>{t('settings.card.pending.note')}</span>
        </div>
        {pending.length === 0
          ? <div className={css.pendingEmpty}>{t('settings.pending.empty')}</div>
          : (
            <ul className={css.pendingList}>
              {pending.map(item => (
                <li key={item.id} className={css.pendingItem}>
                  <span className={css.kind}>{t(KINDS[item.kind] ?? 'settings.kind.question')}</span>
                  <div className={css.pendingBody}>
                    <span className={css.pendingDetail}>{item.detail}</span>
                    <span className={css.pendingMeta}>
                      {t('settings.pending.waiting', { wait: formatElapsed(Date.now() - item.startedAt, t) })}
                      {item.pushes > 0
                        ? ` · ${t('settings.pending.pushes', { count: item.pushes })}`
                        : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </section>

      <div className={clsx(css.actions, css.actionsEnd)}>
        {saveError !== null && (
          <span className={clsx(css.feedback, css.feedbackError)} role="alert">{saveError}</span>
        )}
        {saveError === null && savedAt !== null && !dirty && (
          <span className={clsx(css.feedback, css.feedbackOk)} role="status">{t('settings.saved')}</span>
        )}
        {saveError === null && dirty && (
          <span className={clsx(css.feedback, css.feedbackMuted)}>{t('settings.dirty')}</span>
        )}
        {testResult !== null && (
          <span
            className={clsx(css.feedback, testResult.ok ? css.feedbackOk : css.feedbackError)}
            role="status"
          >
            {testResult.ok ? t('settings.test.ok') : `${t('settings.test.fail')}：${testResult.error ?? ''}`}
          </span>
        )}
        <span className={css.spacer} />
        <Button
          size="sm"
          variant="outline"
          disabled={testing || saving || !credentialConfigured}
          title={credentialConfigured ? undefined : t('settings.test.needKey')}
          onClick={onTest}
        >
          {testing ? t('settings.test.sending') : t('settings.test')}
        </Button>
        <Button size="sm" variant="ghost" disabled={!dirty || saving} onClick={onReset}>
          {t('settings.reset')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty || invalid || saving}
          onClick={onSave}
        >
          {saving ? t('settings.saving') : t('settings.save')}
        </Button>
      </div>

      {stateDir !== '' && (
        <p className={css.footer}>{t('settings.sourceHint', { dir: stateDir })}</p>
      )}
    </div>
  )
}
