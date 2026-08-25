/**
 * Settings section: ServerChan credential (SendKey or full push URL, stored
 * encrypted on the host), threshold / repeat minutes, optional proxy, a
 * one-click test push, and the live pending list. The credential travels only
 * into the POST body and never comes back.
 */
import { useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { WatchdogKey } from './locales.ts'
import type { WatchdogConfigView, WatchdogPatch, WatchdogPendingView, WatchdogTestResult } from './api.ts'

export interface WatchdogSettingsInjected {
  t: (key: WatchdogKey) => string
  config: () => Promise<WatchdogConfigView>
  status: () => Promise<{ pending?: WatchdogPendingView[] } & WatchdogConfigView>
  saveConfig: (patch: WatchdogPatch) => Promise<WatchdogConfigView>
  test: () => Promise<WatchdogTestResult>
}

export type WatchdogSettingsProps =
  PropsRuntime<'settings.section'>
  & InjectFace<WatchdogSettingsInjected>

export function WatchdogSettings(props: WatchdogSettingsProps): React.ReactElement {
  const { t, config, status, saveConfig, test } = props

  const [credential, setCredential] = useState('')
  const [threshold, setThreshold] = useState('5')
  const [repeat, setRepeat] = useState('0')
  const [proxy, setProxy] = useState('')
  const [webUrl, setWebUrl] = useState('')
  const [keyStatus, setKeyStatus] = useState<'unknown' | 'ok' | 'missing'>('unknown')
  const [hasStoredKey, setHasStoredKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [pending, setPending] = useState<WatchdogPendingView[]>([])
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  useEffect(() => {
    void config().then((result) => {
      if (!alive.current || !result.ok) return
      setThreshold(String(result.thresholdMinutes ?? 5))
      setRepeat(String(result.repeatMinutes ?? 0))
      setProxy(result.proxy ?? '')
      setWebUrl(result.webUrl ?? '')
      setKeyStatus(result.credentialConfigured ? 'ok' : 'missing')
      setHasStoredKey(result.hasStoredKey === true)
    })
  }, [config])

  // Live pending list: short poll so the section reflects new/dismissed asks
  // instead of a snapshot from page load.
  useEffect(() => {
    let timer: number | undefined
    const refresh = (): void => {
      void status().then((result) => {
        if (alive.current && result.ok) setPending(Array.isArray(result.pending) ? result.pending : [])
      })
    }
    refresh()
    timer = window.setInterval(refresh, 10_000)
    return () => { if (timer !== undefined) window.clearInterval(timer) }
  }, [status])

  const onSave = (): void => {
    if (saving) return
    setSaving(true)
    setSaveError(null)
    setSavedAt(null)
    const patch: WatchdogPatch = {}
    if (credential.trim() !== '') patch.sendkey = credential.trim()
    const thresholdValue = Number(threshold)
    if (Number.isFinite(thresholdValue) && threshold.trim() !== '') {
      patch.thresholdMinutes = Math.round(thresholdValue)
    }
    const repeatValue = Number(repeat)
    if (Number.isFinite(repeatValue) && repeat.trim() !== '') {
      patch.repeatMinutes = Math.round(repeatValue)
    }
    // Always submitted: an empty string is how the host clears the field, so
    // the user can genuinely wipe a saved proxy / web URL.
    patch.proxy = proxy
    patch.webUrl = webUrl
    void saveConfig(patch).then((result) => {
      if (!alive.current) return
      setSaving(false)
      if (result.ok) {
        setSavedAt(Date.now())
        setCredential('')
        setThreshold(String(result.thresholdMinutes ?? 5))
        setRepeat(String(result.repeatMinutes ?? 0))
        setProxy(result.proxy ?? '')
        setWebUrl(result.webUrl ?? '')
        setKeyStatus(result.credentialConfigured ? 'ok' : 'missing')
        setHasStoredKey(result.hasStoredKey === true)
      } else {
        setSaveError(result.error ?? result.message ?? t('settings.saveFailed'))
      }
    })
  }

  const onClearKey = (): void => {
    void saveConfig({ clearKey: true }).then((result) => {
      if (alive.current && result.ok) {
        setKeyStatus(result.credentialConfigured ? 'ok' : 'missing')
        setHasStoredKey(result.hasStoredKey === true)
      }
    })
  }

  const onTest = (): void => {
    if (testing) return
    setTesting(true)
    setTestResult(null)
    void test().then((result) => {
      if (!alive.current) return
      setTestResult({
        ok: result.ok,
        message: result.ok
          ? t('settings.test.ok')
          : `${t('settings.test.fail')}：${result.error ?? result.message ?? 'unknown'}`,
      })
      setTesting(false)
    })
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '8px 0',
  } as const
  const labelStyle = { fontSize: '13px', opacity: 0.85, minWidth: '96px' } as const
  const inputStyle = {
    flex: 1,
    fontSize: '13px',
    fontFamily: 'monospace',
    padding: '4px 8px',
    border: '1px solid var(--dsh-color-border, #3a3f4b)',
    borderRadius: '4px',
    background: 'transparent',
    color: 'inherit',
  } as const
  const hintStyle = { fontSize: '11px', opacity: 0.6, marginTop: '2px' } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 4px' }}>
      <div style={{ fontSize: '15px', fontWeight: 600 }}>{t('settings.title')}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={rowStyle}>
          <span style={labelStyle}>{t('settings.credential')}</span>
          <input
            type="password"
            value={credential}
            onChange={event => setCredential(event.target.value)}
            placeholder={keyStatus === 'ok' ? t('settings.credential.placeholder') : ''}
            autoComplete="off"
            aria-label={t('settings.credential')}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', gap: '12px', marginLeft: '108px', alignItems: 'center' }}>
          <span style={{
            fontSize: '12px',
            color: keyStatus === 'ok' ? 'var(--dsh-color-success, #30a46c)' : keyStatus === 'missing' ? 'var(--dsh-color-danger, #e5484d)' : undefined,
          }}>
            {keyStatus === 'ok' ? t('settings.credential.ok') : keyStatus === 'missing' ? t('settings.credential.missing') : ''}
          </span>
          {keyStatus === 'ok' && hasStoredKey && (
            <button
              type="button"
              onClick={onClearKey}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', opacity: 0.7 }}
            >
              {t('settings.credential.clear')}
            </button>
          )}
        </div>
        <span style={{ ...hintStyle, marginLeft: '108px' }}>{t('settings.credential.hint')}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={rowStyle}>
          <span style={labelStyle}>{t('settings.threshold')}</span>
          <input
            type="number"
            min={1}
            max={1440}
            step={1}
            value={threshold}
            onChange={event => setThreshold(event.target.value)}
            aria-label={t('settings.threshold')}
            style={inputStyle}
          />
        </div>
        <span style={{ ...hintStyle, marginLeft: '108px' }}>{t('settings.threshold.hint')}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={rowStyle}>
          <span style={labelStyle}>{t('settings.repeat')}</span>
          <input
            type="number"
            min={0}
            max={1440}
            step={1}
            value={repeat}
            onChange={event => setRepeat(event.target.value)}
            aria-label={t('settings.repeat')}
            style={inputStyle}
          />
        </div>
        <span style={{ ...hintStyle, marginLeft: '108px' }}>{t('settings.repeat.hint')}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={rowStyle}>
          <span style={labelStyle}>{t('settings.proxy')}</span>
          <input
            value={proxy}
            onChange={event => setProxy(event.target.value)}
            placeholder="http://127.0.0.1:7890"
            aria-label={t('settings.proxy')}
            style={inputStyle}
          />
        </div>
        <span style={{ ...hintStyle, marginLeft: '108px' }}>{t('settings.proxy.hint')}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={rowStyle}>
          <span style={labelStyle}>{t('settings.webUrl')}</span>
          <input
            value={webUrl}
            onChange={event => setWebUrl(event.target.value)}
            placeholder="http://127.0.0.1:3080"
            aria-label={t('settings.webUrl')}
            style={inputStyle}
          />
        </div>
        <span style={{ ...hintStyle, marginLeft: '108px' }}>{t('settings.webUrl.hint')}</span>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '108px' }}>
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          style={{
            padding: '4px 14px',
            fontSize: '13px',
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.55 : 1,
          }}
        >
          {t('settings.save')}
        </button>
        {savedAt !== null && saveError === null && (
          <span style={{ fontSize: '12px', color: 'var(--dsh-color-success, #30a46c)' }}>{t('settings.saved')}</span>
        )}
        {saveError !== null && (
          <span style={{ fontSize: '12px', color: 'var(--dsh-color-danger, #e5484d)' }}>{saveError}</span>
        )}
      </div>

      <div style={rowStyle}>
        <button
          type="button"
          disabled={testing || keyStatus !== 'ok'}
          onClick={onTest}
          style={{
            padding: '4px 14px',
            fontSize: '13px',
            cursor: testing || keyStatus !== 'ok' ? 'default' : 'pointer',
            opacity: testing || keyStatus !== 'ok' ? 0.55 : 1,
          }}
        >
          {testing ? t('settings.test.sending') : t('settings.test')}
        </button>
        {testResult !== null && (
          <span style={{ fontSize: '12px', color: testResult.ok ? 'var(--dsh-color-success, #30a46c)' : 'var(--dsh-color-danger, #e5484d)' }}>
            {testResult.message}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ fontSize: '12px', opacity: 0.75 }}>{t('settings.pending')}：{pending.length}</div>
        {pending.length === 0 && (
          <div style={{ fontSize: '11px', opacity: 0.6 }}>{t('settings.pending.empty')}</div>
        )}
        {pending.slice(0, 3).map(item => (
          <div key={item.id} style={{ fontSize: '11px', opacity: 0.65, fontFamily: 'monospace' }}>
            [{item.kind}] {item.detail.length > 60 ? `${item.detail.slice(0, 59)}…` : item.detail}
          </div>
        ))}
      </div>

      <div style={{ fontSize: '11px', opacity: 0.55, paddingTop: '4px' }}>{t('settings.sourceHint')}</div>
    </div>
  )
}
