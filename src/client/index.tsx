/**
 * dsh-serverchan-watchdog — browser half.
 *
 * One settings section (`settings.section`): ServerChan credential
 * (SendKey or full push URL, encrypted on the host), threshold / repeat
 * minutes, optional proxy, a one-click test push, and the live pending list.
 * All detection and pushing stays on the host; the browser only reads and
 * edits the host-managed settings.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { WatchdogSettings, type WatchdogSettingsInjected } from './SettingsCard.tsx'
import { en, zh } from './locales.ts'
import { fetchConfig, fetchStatus, saveConfig, sendTest } from './api.ts'

const NS = 'serverchan-watchdog'

export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'serverchan-watchdog: dictionaries')

  // Re-registered on locale change so the nav label picks up the new language.
  let disposeSection: (() => void) | null = null
  const mountSection = (): void => {
    if (disposeSection !== null) {
      disposeSection()
      disposeSection = null
    }
    const t = ctx.locale.bind(NS)
    disposeSection = ctx.slots.register({
      name: 'settings.section',
      id: NS,
      order: 60,
      label: () => t('settings.label'),
      inject: (): WatchdogSettingsInjected => ({
        t,
        config: () => fetchConfig(),
        status: () => fetchStatus(),
        saveConfig: patch => saveConfig(patch),
        test: () => sendTest(),
      }),
    }, WatchdogSettings)
  }

  ctx.slots.inject('settings.section', () => {
    mountSection()
    const onLocale = ctx.on('locale/change', () => { mountSection() })
    return () => {
      onLocale()
      if (disposeSection !== null) {
        disposeSection()
        disposeSection = null
      }
    }
  })
}
