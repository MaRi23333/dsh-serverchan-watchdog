# dsh-serverchan-watchdog

DeepSeek Harness（DSH）插件：当人工确认（审批 / 计划评审 / `ask_user_question` 问答）**超过阈值（默认 5 分钟）没有回复**时，通过 [ServerChan（Server酱）](https://sct.ftqq.com/) 推送消息到你的微信。

适合"偶尔路过电脑才看一眼，人不在电脑前就错过审批问答"的场景：检测在 DSH **主机端**进行（基于会话事件流），浏览器关着、人不在电脑前也能推送。

## 特性

- 监听三种原生人工交互，任一超过阈值未答复即推送（`thresholdMinutes` 默认 **5 分钟**）：
  - `ask_user_question` 问答（`tool/call` → `tool/result` 配对）
  - `exit_plan_mode` 计划评审（计划模式下的审核，同样以工具调用/结果配对）
  - 工具审批 / 沙箱升级（`approval/asked` → `approval/decided` 配对，与 `dsh-smart-approval` 等审批器共存：快速自动答复不会推送）
- 一次交互只推一次（`repeatMinutes > 0` 可开启重复提醒，默认关闭）
- 推送内容：类型（问答/计划评审/审批）、会话 ID、问题文本或审批原因、已等待时长、打开 Harness 的链接
- SendKey 用 AES-256-GCM 加密存本机（`$DSH_HOME/serverchan-watchdog/state.json` + 本机 `key.bin`，两者都收紧 ACL），不进仓库、不进日志、不在接口响应中出现
- 完整推送 URL 只接受 ServerChan 官方主机（`sctapi.ftqq.com` / `<uid>.push.ft07.com`，仅 https）；大写 `SCTP…` 之类非规范 key 会在保存时直接拒绝，避免静默打到错误端点
- 推送失败只记录类别（HTTP 状态 / 服务端 code / timeout / network-failed），不回显原始错误（避免把 URL 里的 key 打进日志）
- 支持代理（`proxy` 配置，http/https、不接受带账号密码的 URL）
- 本机回环专用的状态/配置/测试接口（带 CSRF 防护）

> 注：另一个插件 `@ltao0829/dsh-task-notify` 已经做了浏览器内 toast / 系统通知 / 声音提醒，但那是**浏览器侧**的——标签页关着就收不到。本插件补的是"人不在电脑前"的**微信推送**通道；两者可共存。

## 安装

```powershell
# 本地开发目录（或 git 地址 / npm 包名）
dsh plugin --profile web add E:\E盘项目区\dsh-plugin-dev\plugins\dsh-serverchan-watchdog
```

重启 `dsh web`（在 dsh-plugin-dev 根目录的普通终端执行 `.\tools\restart-web.ps1`，不要在 dsh web 会话里执行）。

## 配置

### 1. 设置页（推荐）

重启后在 DSH 设置页 → 插件 → **微信提醒 (ServerChan)**：

- **推送地址 / SendKey**：填 ServerChan 控制台的 SendKey（经典版 `SCT...` 或 Server酱³ `sctp...`）或完整推送 URL；加密（AES-256-GCM）存本机 `$DSH_HOME/serverchan-watchdog/state.json`，永不回显
- **阈值（分钟）**：默认 5；**重复提醒间隔（分钟）**：默认 0（只提醒一次）
- **网络代理（可选）**：如 `http://127.0.0.1:7897`
- **发送测试推送**：一键验证配置
- 页面还会显示当前等待中的人工交互列表

### 2. 命令行保存凭据（备用）

```powershell
Invoke-WebRequest -Method Post -Uri http://127.0.0.1:3080/serverchan-watchdog/config `
  -ContentType 'application/json' -Body '{"sendkey":"SCT你的Key"}'
```

### 3. 阈值等参数（bundle patch 默认值）

设置页保存的值优先；以下 bundle patch 值作为默认（设置页未覆盖时生效）：

```yaml
- id: serverchan-watchdog
  config:
    thresholdMinutes: 5      # 超过 5 分钟没回复就推送（默认）
    repeatMinutes: 30        # 之后每 30 分钟重复提醒一次；0 表示只推一次（默认）
    title: DSH 等待人工确认   # 推送标题（单行，≤32 字符）
    webUrl: http://127.0.0.1:3080   # 推送里"打开 Harness"的链接
    proxy: http://127.0.0.1:7897    # 可选代理（直连网络可留空）
    enabled: true            # 总开关
```

## 接口（仅本机回环可访问）

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/serverchan-watchdog/status` | GET | 生效配置摘要 + 当前等待中的交互列表（不含凭据） |
| `/serverchan-watchdog/config` | GET | 可编辑的设置视图（不含凭据） |
| `/serverchan-watchdog/config` | POST | `{"sendkey?","clearKey?","thresholdMinutes?","repeatMinutes?","proxy?"}`（应用/json + 回环 Origin 校验） |
| `/serverchan-watchdog/test` | POST | 用当前配置发一条测试推送 |

## 工作原理（概要）

1. 插件监听 host 端 `session/event` 事件流——和 UI 无关，浏览器不开也在跑。
2. `tool/call`（`ask_user_question` 或 `exit_plan_mode`）出现 → 开始计时；对应 `tool/result`（按 `source.callId` 精确配对）或 `approval/decided` 到达 → 结束计时，不推送。
3. 超过 `thresholdMinutes` 仍未结束 → 推送到微信；正文含问题/计划摘要、会话 ID、已等待分钟数和 Harness 链接。人点开链接即可答复。

## 已知限制

- 提醒计时在内存中：`dsh web` 重启后，仍在等待的交互不再提醒（但会自动被下次的人工答复正常终结）。
- 只监听本插件加载后**新产生**的人工交互。
- 本插件与 `dsh-smart-approval` 的合作方式：审查器自动批复的审批会在几秒内打出 `approval/decided`，不会触发推送；只有真的悬而未决的交互才会提醒。
- 加密存储是"readable by anyone who can read the plugin state dir"：`key.bin` 与密文同在 `$DSH_HOME/serverchan-watchdog/`，ACL 收紧到当前用户；能读取该目录的账号即可解出 SendKey（与 dsh-fish-tts 同一方案，非 DPAPI）。
- 推送请求在发送前会复查该交互是否仍在等待（避免"刚回答完还推一条"），但不支持取消已发出的 HTTP 请求。
- 设置页保存的阈值/重复间隔/代理即时生效：新开始的等待用新阈值；重复间隔在每次推送前重新读取。

## 开发

```powershell
pnpm install
pnpm test                 # 核心逻辑单测（tsx + node:test）
.\..\..\tools\build.ps1 dsh-serverchan-watchdog   # 或 pnpm run typecheck && pnpm run build
```
