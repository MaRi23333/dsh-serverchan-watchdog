/**
 * Settings-nav icon decoration for this plugin's own row (Server酱推送小助手).
 *
 * The official settings shell's navIcon(id) table is closed — official ids
 * get drawn icons and everything else falls back to a generic gear. This
 * replaces that fallback <svg> inside OUR nav button (matched by our own
 * registered label text, zh and en) with the drawn bell icon. A
 * MutationObserver re-applies the icon when the panel re-renders; gated on
 * the settings dialog being present so idle chat streams never pay the
 * query cost.
 */

const NAV_ICON_INNER =
  '<path d="M8 2.25a3.75 3.75 0 0 0-3.75 3.75v2.5L3.25 11h9.5L11.75 8.5V6A3.75 3.75 0 0 0 8 2.25z"/>'
  + '<path d="M6.75 13.25a1.25 1.25 0 0 0 2.5 0"/>'

const NAV_LABELS = new Set(['Server酱推送小助手', 'ServerChan mobile alerts'])

interface EffectCapableContext {
  // Loose on purpose: cordis effect signatures vary across harness builds and
  // the decoration only forwards its own (fn, label) pair.
  effect: (...args: any[]) => unknown
}

export function decorateSettingsNavIcon(ctx: EffectCapableContext): void {
  ctx.effect(() => {
    const decorate = (): void => {
      if (document.querySelector('[role="dialog"]') === null) return
      for (const button of Array.from(document.querySelectorAll('button'))) {
        const label = button.querySelector(':scope > span')
        if (label === null || !NAV_LABELS.has(label.textContent ?? '')) continue
        const existing = button.firstElementChild
        if (existing instanceof SVGElement) {
          if (existing.dataset.navIcon === '1') continue
          const template = document.createElement('template')
          template.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-nav-icon="1">${NAV_ICON_INNER}</svg>`
          existing.replaceWith(template.content.firstElementChild as SVGElement)
        }
      }
    }
    const observer = new MutationObserver(() => decorate())
    observer.observe(document.body, { childList: true, subtree: true })
    decorate()
    return () => observer.disconnect()
  }, 'serverchan-watchdog: nav icon decoration')
}
