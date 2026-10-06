/**
 * Settings-nav icon decoration for this plugin's own row.
 *
 * The official settings shell's `navIcon(id)` table is closed: official ids get
 * drawn icons and every other id falls back to a generic gear, and
 * `settings.section` registrants cannot supply an icon of their own. This
 * replaces that fallback `<svg>` inside our own nav button with a drawn bell.
 *
 * The row is identified by its label text, so the label set is derived from the
 * shipped dictionaries rather than duplicated here — renaming
 * `settings.label` cannot silently break the icon again. Ordering is unchanged
 * on purpose: the shell renders our label inside the button's own `<span>`.
 *
 * A MutationObserver re-applies the icon when the panel re-renders, gated on
 * the settings dialog being mounted so an idle chat stream never pays for it.
 * Re-application is skipped once our marked `<svg>` is already in place, which
 * is what keeps the observer from reacting to its own edit.
 */

import { en, zh } from './locales.ts'

/** Every localized spelling of this section's nav label. */
const NAV_LABELS: ReadonlySet<string> = new Set([
  zh['settings.label'],
  en['settings.label'],
])

/** Panel root that only exists while the settings dialog is open. */
const DIALOG_SELECTOR = '[role="dialog"]'

const NAV_ICON_INNER =
  '<path d="M8 2.25a3.75 3.75 0 0 0-3.75 3.75v2.5L3.25 11h9.5L11.75 8.5V6A3.75 3.75 0 0 0 8 2.25z"/>'
  + '<path d="M6.75 13.25a1.25 1.25 0 0 0 2.5 0"/>'

interface EffectCapableContext {
  // Loose on purpose: cordis effect signatures vary across harness builds and
  // the decoration only forwards its own (fn, label) pair.
  effect: (...args: any[]) => unknown
}

export function decorateSettingsNavIcon(ctx: EffectCapableContext): void {
  ctx.effect(() => {
    const decorate = (): void => {
      const dialog = document.querySelector(DIALOG_SELECTOR)
      if (dialog === null) return
      for (const button of Array.from(dialog.querySelectorAll('button'))) {
        const label = button.querySelector(':scope > span')
        if (label === null || !NAV_LABELS.has(label.textContent ?? '')) continue
        const existing = button.firstElementChild
        if (!(existing instanceof SVGElement) || existing.dataset['navIcon'] === '1') continue
        const template = document.createElement('template')
        template.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-nav-icon="1">${NAV_ICON_INNER}</svg>`
        existing.replaceWith(template.content.firstElementChild as SVGElement)
      }
    }
    const observer = new MutationObserver(() => decorate())
    observer.observe(document.body, { childList: true, subtree: true })
    decorate()
    return () => observer.disconnect()
  }, 'serverchan-watchdog: nav icon decoration')
}
