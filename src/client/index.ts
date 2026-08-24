/**
 * dsh-serverchan-watchdog — browser half (registered for the module roster;
 * all watchdog logic runs host-side, so the browser half is a no-op).
 * @module dsh-serverchan-watchdog/client
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'serverchan-watchdog'

export function apply(_ctx: Context): void {
  // no-op: detection and ServerChan pushes happen on the host
}
