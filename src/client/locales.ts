/**
 * Locale namespace declaration and bilingual dictionaries.
 *
 * The namespace merge into LocaleNamespaceMap is what makes the slot-level
 * `locale: 'serverchan-watchdog'` seat and the typed `t` prop work; a key
 * missing from a dictionary is a compile error rather than a blank label.
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

export type WatchdogKey =
  | 'settings.label'
  | 'settings.title'
  | 'settings.summary'
  | 'settings.on'
  | 'settings.off'
  | 'settings.switch.on'
  | 'settings.switch.off'
  | 'settings.card.channel'
  | 'settings.card.channel.note'
  | 'settings.credential'
  | 'settings.credential.hint'
  | 'settings.credential.placeholder'
  | 'settings.credential.replace'
  | 'settings.credential.clear'
  | 'settings.credential.ok'
  | 'settings.credential.missing'
  | 'settings.card.timing'
  | 'settings.card.timing.note'
  | 'settings.threshold'
  | 'settings.threshold.hint'
  | 'settings.repeat'
  | 'settings.repeat.hint'
  | 'settings.preset.1'
  | 'settings.preset.5'
  | 'settings.preset.15'
  | 'settings.minutes'
  | 'settings.card.message'
  | 'settings.card.message.note'
  | 'settings.pushTitle'
  | 'settings.pushTitle.hint'
  | 'settings.pushTitle.placeholder'
  | 'settings.pushTitle.counter'
  | 'settings.card.link'
  | 'settings.card.link.note'
  | 'settings.webUrl'
  | 'settings.webUrl.hint'
  | 'settings.webUrl.mode.none'
  | 'settings.webUrl.mode.desktop'
  | 'settings.webUrl.mode.custom'
  | 'settings.webUrl.custom'
  | 'settings.card.network'
  | 'settings.card.network.note'
  | 'settings.proxy'
  | 'settings.proxy.hint'
  | 'settings.card.pending'
  | 'settings.card.pending.note'
  | 'settings.pending'
  | 'settings.pending.empty'
  | 'settings.pending.waiting'
  | 'settings.pending.pushes'
  | 'settings.pending.next'
  | 'settings.pending.next.none'
  | 'settings.pending.refresh'
  | 'settings.elapsed.seconds'
  | 'settings.elapsed.minutes'
  | 'settings.elapsed.hours'
  | 'settings.kind.question'
  | 'settings.kind.plan-review'
  | 'settings.kind.approval'
  | 'settings.save'
  | 'settings.saving'
  | 'settings.saved'
  | 'settings.dirty'
  | 'settings.saveFailed'
  | 'settings.reset'
  | 'settings.test'
  | 'settings.test.sending'
  | 'settings.test.ok'
  | 'settings.test.fail'
  | 'settings.test.needKey'
  | 'settings.status.checking'
  | 'settings.status.disabled'
  | 'settings.status.ready'
  | 'settings.status.noCredential'
  | 'settings.status.unreachable'
  | 'settings.status.pendingCount'
  | 'settings.sourceHint'
  | 'settings.error.invalid-sendkey'
  | 'settings.error.invalid-proxy'
  | 'settings.error.invalid-minutes'
  | 'settings.error.invalid-weburl'
  | 'settings.error.invalid-title'
  | 'settings.error.unknown'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'serverchan-watchdog': WatchdogKey
  }
}

export const zh: Record<WatchdogKey, string> = {
  'settings.label': 'Server酱推送小助手',
  'settings.title': 'Server酱推送小助手',
  'settings.summary': '审批、计划评审或提问长时间无人答复时，把提醒推送到手机。检测在 DSH 主机端持续运行，关掉浏览器也不影响。',
  'settings.on': '已开启',
  'settings.off': '已暂停',
  'settings.switch.on': '开启超时提醒',
  'settings.switch.off': '暂停超时提醒',
  'settings.card.channel': '推送通道',
  'settings.card.channel.note': '凭据加密保存在本机，保存后不再回显。',
  'settings.credential': '推送地址 / SendKey',
  'settings.credential.hint': 'Server酱控制台的 SendKey（经典 SCT… 或 Server酱³ sctp…），也可直接填完整推送 URL。',
  'settings.credential.placeholder': '已保存（留空保持不变）',
  'settings.credential.replace': '输入新的 SendKey 可覆盖已保存的凭据',
  'settings.credential.clear': '清除凭据',
  'settings.credential.ok': '凭据已配置',
  'settings.credential.missing': '尚未配置凭据',
  'settings.card.timing': '提醒时机',
  'settings.card.timing.note': '阈值对新开始的等待生效；重复间隔立即生效。',
  'settings.threshold': '多久没回复就提醒',
  'settings.threshold.hint': '1–1440 分钟，默认 5 分钟。',
  'settings.repeat': '仍无回复时重复提醒',
  'settings.repeat.hint': '0 = 只提醒一次；超过 1440 分钟按 1440 计。',
  'settings.preset.1': '1 分钟',
  'settings.preset.5': '5 分钟',
  'settings.preset.15': '15 分钟',
  'settings.minutes': '分钟',
  'settings.card.message': '提醒内容',
  'settings.card.message.note': '推送标题前缀；重复提醒会自动追加「第 N 次」。',
  'settings.pushTitle': '推送标题',
  'settings.pushTitle.hint': '留空使用默认标题「DSH 等待人工确认」。',
  'settings.pushTitle.placeholder': 'DSH 等待人工确认',
  'settings.pushTitle.counter': '{n}/32',
  'settings.card.link': '点击跳转',
  'settings.card.link.note': '手机点开推送后跳到哪里。',
  'settings.webUrl': '跳转方式',
  'settings.webUrl.hint': 'dsh://open 会唤起桌面客户端；自定义地址需手机能访问（127.0.0.1 指向手机自己）。',
  'settings.webUrl.mode.none': '不带链接',
  'settings.webUrl.mode.desktop': '唤起桌面端',
  'settings.webUrl.mode.custom': '自定义地址',
  'settings.webUrl.custom': '自定义跳转地址',
  'settings.card.network': '网络',
  'settings.card.network.note': '推送请求经过的代理；留空为直连。',
  'settings.proxy': '网络代理',
  'settings.proxy.hint': '例如 http://127.0.0.1:7890；不支持带用户名密码的代理。',
  'settings.card.pending': '等待中的确认',
  'settings.card.pending.note': '实时来自主机端；此页每 10 秒自动刷新。',
  'settings.pending': '当前等待中的交互',
  'settings.pending.empty': '暂无等待中的人工确认',
  'settings.pending.waiting': '已等待 {wait}',
  'settings.pending.pushes': '已提醒 {count} 次',
  'settings.pending.next': '将于约 {mins} 分钟后提醒',
  'settings.pending.next.none': '等待时长已超过阈值',
  'settings.pending.refresh': '刷新',
  'settings.elapsed.seconds': '{n} 秒',
  'settings.elapsed.minutes': '{n} 分钟',
  'settings.elapsed.hours': '{h} 小时 {m} 分钟',
  'settings.kind.question': '提问',
  'settings.kind.plan-review': '计划评审',
  'settings.kind.approval': '审批',
  'settings.save': '保存设置',
  'settings.saving': '正在保存…',
  'settings.saved': '已保存',
  'settings.dirty': '有未保存的修改',
  'settings.saveFailed': '保存失败',
  'settings.reset': '放弃修改',
  'settings.test': '发送测试推送',
  'settings.test.sending': '正在发送…',
  'settings.test.ok': '测试消息已发出，请查看微信',
  'settings.test.fail': '测试推送失败',
  'settings.test.needKey': '请先保存 SendKey 再发送测试',
  'settings.status.checking': '正在读取状态…',
  'settings.status.disabled': '提醒已暂停',
  'settings.status.ready': '监控运行中',
  'settings.status.noCredential': '缺少推送凭据',
  'settings.status.unreachable': '无法连接主机端',
  'settings.status.pendingCount': '{count} 项等待中',
  'settings.sourceHint': '设置保存在本机，推送凭据由本机密钥加密，保存后不会回显。',
  'settings.error.invalid-sendkey': 'SendKey 格式无法识别，请检查是否复制完整',
  'settings.error.invalid-proxy': '代理地址无效：仅支持不带用户名密码的 http(s) 地址',
  'settings.error.invalid-minutes': '请输入 0–1440 的整数分钟',
  'settings.error.invalid-weburl': '跳转地址无效：仅支持 http(s) 或 dsh://',
  'settings.error.invalid-title': '推送标题最多 32 个字符',
  'settings.error.unknown': '保存失败，请查看主机端日志',
}

export const en: Record<WatchdogKey, string> = {
  'settings.label': 'ServerChan mobile alerts',
  'settings.title': 'ServerChan mobile alerts',
  'settings.summary': 'Push a phone alert when an approval, plan review, or question stays unanswered. Detection runs on the DSH host, so closing the browser changes nothing.',
  'settings.on': 'On',
  'settings.off': 'Paused',
  'settings.switch.on': 'Enable timeout alerts',
  'settings.switch.off': 'Pause timeout alerts',
  'settings.card.channel': 'Push channel',
  'settings.card.channel.note': 'The credential is stored encrypted on this machine and is never echoed back.',
  'settings.credential': 'Push URL / SendKey',
  'settings.credential.hint': 'ServerChan SendKey (SCT… or sctp…) from the console, or a full push URL.',
  'settings.credential.placeholder': 'Saved (leave empty to keep)',
  'settings.credential.replace': 'Enter a new SendKey to replace the stored credential',
  'settings.credential.clear': 'Clear credential',
  'settings.credential.ok': 'Credential configured',
  'settings.credential.missing': 'No credential configured',
  'settings.card.timing': 'When to alert',
  'settings.card.timing.note': 'The threshold applies to new waits; the repeat interval applies immediately.',
  'settings.threshold': 'Alert after no reply for',
  'settings.threshold.hint': '1–1440 minutes; default 5.',
  'settings.repeat': 'Repeat while still unanswered',
  'settings.repeat.hint': '0 = alert once; values above 1440 are treated as 1440.',
  'settings.preset.1': '1 min',
  'settings.preset.5': '5 min',
  'settings.preset.15': '15 min',
  'settings.minutes': 'min',
  'settings.card.message': 'Alert content',
  'settings.card.message.note': 'Title prefix for the push; repeats append “第 N 次” automatically.',
  'settings.pushTitle': 'Push title',
  'settings.pushTitle.hint': 'Leave empty for the default title “DSH 等待人工确认”.',
  'settings.pushTitle.placeholder': 'DSH 等待人工确认',
  'settings.pushTitle.counter': '{n}/32',
  'settings.card.link': 'Tap-through',
  'settings.card.link.note': 'Where the phone lands after tapping the push.',
  'settings.webUrl': 'Link type',
  'settings.webUrl.hint': 'dsh://open raises the desktop client; a custom address must be reachable from the phone (127.0.0.1 is the phone itself).',
  'settings.webUrl.mode.none': 'No link',
  'settings.webUrl.mode.desktop': 'Open desktop app',
  'settings.webUrl.mode.custom': 'Custom address',
  'settings.webUrl.custom': 'Custom jump address',
  'settings.card.network': 'Network',
  'settings.card.network.note': 'Proxy used for the push request; empty means direct.',
  'settings.proxy': 'HTTP proxy',
  'settings.proxy.hint': 'For example http://127.0.0.1:7890; proxy URLs with username/password are not supported.',
  'settings.card.pending': 'Pending confirmations',
  'settings.card.pending.note': 'Read live from the host; this page refreshes every 10 seconds.',
  'settings.pending': 'Pending interactions',
  'settings.pending.empty': 'No pending human confirmation right now',
  'settings.pending.waiting': 'Waiting {wait}',
  'settings.pending.pushes': 'Alerted {count} times',
  'settings.pending.next': 'Alerts in about {mins} min',
  'settings.pending.next.none': 'Past the threshold',
  'settings.pending.refresh': 'Refresh',
  'settings.elapsed.seconds': '{n}s',
  'settings.elapsed.minutes': '{n} min',
  'settings.elapsed.hours': '{h} h {m} min',
  'settings.kind.question': 'Question',
  'settings.kind.plan-review': 'Plan review',
  'settings.kind.approval': 'Approval',
  'settings.save': 'Save settings',
  'settings.saving': 'Saving…',
  'settings.saved': 'Saved',
  'settings.dirty': 'Unsaved changes',
  'settings.saveFailed': 'Save failed',
  'settings.reset': 'Discard changes',
  'settings.test': 'Send test push',
  'settings.test.sending': 'Sending…',
  'settings.test.ok': 'Test message sent; check your phone',
  'settings.test.fail': 'Test push failed',
  'settings.test.needKey': 'Save a SendKey before sending a test',
  'settings.status.checking': 'Reading status…',
  'settings.status.disabled': 'Alerts paused',
  'settings.status.ready': 'Watching for replies',
  'settings.status.noCredential': 'No push credential',
  'settings.status.unreachable': 'Cannot reach the host',
  'settings.status.pendingCount': '{count} waiting',
  'settings.sourceHint': 'Settings are stored on this machine. The push credential is encrypted with a local key and is never echoed back.',
  'settings.error.invalid-sendkey': 'That SendKey could not be recognized; check that it was copied completely',
  'settings.error.invalid-proxy': 'Invalid proxy: only http(s) addresses without username/password are supported',
  'settings.error.invalid-minutes': 'Enter a whole number of minutes between 0 and 1440',
  'settings.error.invalid-weburl': 'Invalid link: only http(s) or dsh:// is supported',
  'settings.error.invalid-title': 'The push title may be at most 32 characters',
  'settings.error.unknown': 'Save failed; check the host log',
}
