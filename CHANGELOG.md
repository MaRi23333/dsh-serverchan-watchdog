# 更新记录 / Changelog

## 0.2.0（2026-10-07）

### 设置页面重做 / Settings page rebuilt

- 设置页改为「推送通道 / 提醒时机 / 提醒文案 / 跳转链接 / 网络 / 等待队列」六块卡片，全部使用官方设计令牌（`--dsw-alias-*`）与 CSS Modules，自动跟随深浅色主题，不再使用内联样式与硬编码颜色。 / The page is now six cards (channel, timing, message, link, network, pending) built on the official `--dsw-alias-*` design tokens and CSS Modules, so it follows the active theme; inline styles and hardcoded colors are gone.
- 控件改用官方 UI primitives（`Button` / `Switch` / `Tag` / `Input`），键盘操作、焦点环与无障碍标签与 DSH 其余设置页一致。 / Controls now use the official UI primitives (`Button`, `Switch`, `Tag`, `Input`), matching the keyboard behavior, focus ring, and accessible labels of the rest of DSH's settings.
- 保存前先在本地暂存修改，只有点击「保存设置」才写入主机；SendKey 输入框永远不会回显已保存的密钥。 / Edits are staged locally and only written by "保存设置"; the stored SendKey is never echoed back into the field.
- 等待队列显示每项的类型、内容、已等待时长（每秒刷新）与已提醒次数，每 10 秒自动轮询。 / The pending queue shows each item's kind, detail, live wait time, and push count, polling every 10 s.

### 功能 / Behavior

- 新增总开关：保存后暂停或恢复提醒，无需重启。关闭时已跟踪的等待项保留在队列中，已到期的等待每 5 分钟重新检查，恢复后在下一次检查继续推送。 / Added a master switch to pause or resume alerts after saving, without a restart. Tracked items stay in the queue; overdue items are checked every five minutes and resume on the next check after re-enabling.
- 新增「推送标题」设置（可保存最多 32 字符，实时计数），留空使用默认标题；发送时沿用前 20 个字符，为重复提醒后缀保留空间。 / Added a push-title setting (up to 32 saved characters, live counter); blank restores the default. Delivery retains the first 20 characters to reserve room for repeat-count suffixes.
- 设置页底部说明本机加密存储，不向配置或状态接口暴露本机绝对目录。 / The footer explains encrypted local storage without exposing absolute state-directory paths in configuration or status responses.
- 中英文文案补充了错误提示（密钥/代理/分钟数/链接/标题非法）与保存、测试状态。 / Added localized error copy (invalid key, proxy, minutes, URL, title) and save/test states.

### 工程 / Internals

- 客户端构建支持 CSS Modules（稳定哈希类名 + 按插件作用域注入 `<style>`），类名不依赖安装目录。 / The client build now supports CSS Modules (stable hashed class names plus a plugin-scoped `<style>` injection), independent of checkout location.
- 补充客户端加载、样式、依赖外部化、接口白名单和暂停后恢复提醒的回归测试。 / Added regression coverage for client loading, styles, externals, response allowlists and reminders resuming after a pause.

## 0.1.6（2026-10-04）

- 插件列表和详情页新增随 DeepSeek Harness 界面语言切换的中英文名称与简介，明确说明触发条件是人工确认超时。
- Added localized English and Chinese names and descriptions for the plugin list and detail page, clarifying that alerts are triggered by overdue human input.
- 仅修改展示元数据；计时、恢复、推送和 SendKey 存储逻辑未变。 / Display metadata only; timing, recovery, push delivery, and SendKey storage are unchanged.
