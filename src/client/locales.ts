/**
 * Locale namespace declaration and bilingual dictionaries.
 * The namespace merge into LocaleNamespaceMap is what makes the slot-level
 * `locale: 'serverchan-watchdog'` seat and the typed `t` prop work.
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

export type WatchdogKey =
  | 'settings.label'
  | 'settings.title'
  | 'settings.credential'
  | 'settings.credential.hint'
  | 'settings.credential.placeholder'
  | 'settings.credential.clear'
  | 'settings.credential.ok'
  | 'settings.credential.missing'
  | 'settings.threshold'
  | 'settings.threshold.hint'
  | 'settings.repeat'
  | 'settings.repeat.hint'
  | 'settings.proxy'
  | 'settings.proxy.hint'
  | 'settings.save'
  | 'settings.saved'
  | 'settings.saveFailed'
  | 'settings.test'
  | 'settings.test.sending'
  | 'settings.test.ok'
  | 'settings.test.fail'
  | 'settings.pending'
  | 'settings.pending.empty'
  | 'settings.sourceHint'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'serverchan-watchdog': WatchdogKey
  }
}

export const zh: Record<WatchdogKey, string> = {
  'settings.label': '微信提醒 (ServerChan)',
  'settings.title': '人工确认超时微信提醒（ServerChan）',
  'settings.credential': '推送地址 / SendKey',
  'settings.credential.hint': 'ServerChan 控制台的 SendKey（经典 SCT… 或 Server酱³ sctp…），或完整推送 URL；加密存储在本机，不会回显',
  'settings.credential.placeholder': '已保存（留空保持不变）',
  'settings.credential.clear': '清除已保存的凭据',
  'settings.credential.ok': '推送凭据已配置',
  'settings.credential.missing': '未配置推送凭据（在下方输入并保存）',
  'settings.threshold': '阈值（分钟）',
  'settings.threshold.hint': '超过该时长未回复即推送；1–1440 整数，默认 5',
  'settings.repeat': '重复提醒间隔（分钟）',
  'settings.repeat.hint': '仍无人回复时每隔多久再推一次；0 = 只提醒一次',
  'settings.proxy': '网络代理（可选）',
  'settings.proxy.hint': '如 http://127.0.0.1:7890，留空为直连；不支持带用户名密码的代理地址',
  'settings.save': '保存设置',
  'settings.saved': '已保存，立即生效',
  'settings.saveFailed': '保存失败',
  'settings.test': '发送测试推送',
  'settings.test.sending': '正在发送…',
  'settings.test.ok': '测试消息已发送，请查看微信',
  'settings.test.fail': '测试推送失败',
  'settings.pending': '当前等待中的交互',
  'settings.pending.empty': '暂无等待中的人工确认',
  'settings.sourceHint': '设置保存在本机 $DSH_HOME/serverchan-watchdog/，凭据用 AES-256-GCM 加密存储（与 fish-tts 同方案）。',
}

export const en: Record<WatchdogKey, string> = {
  'settings.label': 'WeChat alerts (ServerChan)',
  'settings.title': 'Pending human-interaction WeChat alerts (ServerChan)',
  'settings.credential': 'Push URL / SendKey',
  'settings.credential.hint': 'ServerChan SendKey (SCT… or sctp…) or full push URL from the console; stored encrypted on this machine, never echoed back',
  'settings.credential.placeholder': 'Saved (leave empty to keep)',
  'settings.credential.clear': 'Clear saved credential',
  'settings.credential.ok': 'Push credential configured',
  'settings.credential.missing': 'No push credential configured (enter and save below)',
  'settings.threshold': 'Threshold (minutes)',
  'settings.threshold.hint': 'Push when unanswered past this; integer 1–1440, default 5',
  'settings.repeat': 'Repeat interval (minutes)',
  'settings.repeat.hint': 'Re-push every N minutes while still pending; 0 = once only',
  'settings.proxy': 'HTTP proxy (optional)',
  'settings.proxy.hint': 'e.g. http://127.0.0.1:7890, empty for direct; proxy URLs with username/password are not supported',
  'settings.save': 'Save settings',
  'settings.saved': 'Saved, effective immediately',
  'settings.saveFailed': 'Save failed',
  'settings.test': 'Send test push',
  'settings.test.sending': 'Sending…',
  'settings.test.ok': 'Test message sent; check WeChat',
  'settings.test.fail': 'Test push failed',
  'settings.pending': 'Pending interactions',
  'settings.pending.empty': 'No pending human confirmation right now',
  'settings.sourceHint': 'Settings live in $DSH_HOME/serverchan-watchdog/ on this machine; the credential is encrypted with AES-256-GCM (same scheme as fish-tts).',
}
