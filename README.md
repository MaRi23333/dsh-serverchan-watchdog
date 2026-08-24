# dsh-serverchan-watchdog

**中文** | [English](./README.en.md)

**Server酱推送小助手**（英文包名 `dsh-serverchan-watchdog`）——DeepSeek Harness（DSH）插件：当人工确认（审批 / 计划评审 / `ask_user_question` 问答）**超过阈值（默认 5 分钟）没有回复**时，通过 [ServerChan（Server酱）](https://sct.ftqq.com/) 推送消息到你的微信。

适合"偶尔路过电脑才看一眼，人不在电脑前就错过审批问答"的场景：检测在 DSH **主机端**进行（基于会话事件流），浏览器关着、人不在电脑前也能推送。

## 特性

- 监听三种原生人工交互，任一超过阈值未答复即推送（`thresholdMinutes` 默认 **5 分钟**）：
  - `ask_user_question` 问答（`tool/call` → `tool/result` 配对）
  - `exit_plan_mode` 计划评审（计划模式下的审核，同样以工具调用/结果配对）
  - 工具审批 / 沙箱升级（`approval/asked` → `approval/decided` 配对，与 `dsh-smart-approval` 等审批器共存：快速自动答复不会推送）
- 一次交互默认只推一次（`repeatMinutes > 0` 可开启重复提醒）；**推送失败会自动按 5 分钟间隔重试**，直到送达或交互被答复——网络闪断/未配凭据不会烧掉唯一一次提醒
- **`dsh web` 重启后自动恢复监控**：启动时从会话日志折叠"未闭合"的问答/审批对，人不在时重启也不会丢提醒
- 推送内容：类型（问答/计划评审/审批）、会话 ID、问题文本或审批原因、已等待时长、打开 Harness 的链接
- SendKey 用 AES-256-GCM 加密存本机（`$DSH_HOME/serverchan-watchdog/state.json` + 本机 `key.bin`，两者都收紧 ACL），不进仓库、不进日志、不在接口响应中出现
- 完整推送 URL 只接受 ServerChan 官方主机（`sctapi.ftqq.com` / `<uid>.push.ft07.com`，仅 https）；大写 `SCTP…` 之类非规范 key 会在保存时直接拒绝，避免静默打到错误端点
- 推送失败只记录类别（HTTP 状态 / 服务端 code / timeout / network-failed），不回显原始错误（避免把 URL 里的 key 打进日志）
- 支持代理（`proxy` 配置，http/https、不接受带账号密码的 URL）
- 本机回环专用的状态/配置/测试接口（带 CSRF 防护）

> 注：另一个插件 `@ltao0829/dsh-task-notify` 已经做了浏览器内 toast / 系统通知 / 声音提醒，但那是**浏览器侧**的——标签页关着就收不到。本插件补的是"人不在电脑前"的**微信推送**通道；两者可共存。

## 安装

```powershell
# 从 git 仓库（推荐，仓库地址发布时定稿）
dsh plugin --profile web add git+https://github.com/<your-name>/dsh-serverchan-watchdog.git

# 或本地路径（开发时）
dsh plugin --profile web add <本仓库的绝对路径>
```

安装后在**普通终端**重启 `dsh web`（不要在 dsh web 会话里执行重启）。

## 配置

### 1. 设置页（推荐）

重启后在 DSH 设置页 → 插件 → **Server酱推送小助手**：

- **推送地址 / SendKey**：填 ServerChan 控制台的 SendKey（经典版 `SCT...` 或 Server酱³ `sctp...`）或完整推送 URL；加密（AES-256-GCM）存本机 `$DSH_HOME/serverchan-watchdog/state.json`，永不回显
- **阈值（分钟）**：默认 5；**重复提醒间隔（分钟）**：默认 0（只提醒一次）
- **网络代理（可选）**：如 `http://127.0.0.1:7897`
- **打开 Harness 的链接**：推送正文的跳转地址（默认 `http://127.0.0.1:3080`；手机打开 127.0.0.1 是手机自己，如需手机可访问请填局域网地址并从 LAN 访问 dsh web）
- **发送测试推送**：一键验证配置
- 页面还会显示当前等待中的人工交互列表（每 10 秒刷新）；阈值修改对**新开始**的等待生效，其余项目即时生效

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
| `/serverchan-watchdog/config` | POST | `{"sendkey?","clearKey?","thresholdMinutes?","repeatMinutes?","proxy?","webUrl?"}`（应用/json + 回环 Origin 校验） |
| `/serverchan-watchdog/test` | POST | 用当前配置发一条测试推送 |

## 工作原理（概要）

1. 插件监听 host 端 `session/event` 事件流——和 UI 无关，浏览器不开也在跑。
2. `tool/call`（`ask_user_question` 或 `exit_plan_mode`）出现 → 开始计时；对应 `tool/result`（按 `source.callId` 精确配对）或 `approval/decided` 到达 → 结束计时，不推送。
3. 超过 `thresholdMinutes` 仍未结束 → 推送到微信；正文含问题/计划摘要、会话 ID、已等待分钟数和 Harness 链接。回到电脑前点开链接即可答复（手机上的链接只是"闹铃"入口）。

## 已知限制

- **重启恢复**：`dsh web` 重启后插件从会话日志重新挂起未闭合的交互；若主机恰在"人工已答复但日志未写入"之间崩溃，可能对已答复的交互多推一次（无害，下次会话边界会闭合该对）。
- 只监听本插件加载后**新产生**的人工交互（重启恢复覆盖重启前业已挂起的）。
- 本插件与 `dsh-smart-approval` 的合作方式：审查器自动批复的审批会在几秒内打出 `approval/decided`，不会触发推送；只有真的悬而未决的交互才会提醒。
- 加密存储是"readable by anyone who can read the plugin state dir"：`key.bin` 与密文同在 `$DSH_HOME/serverchan-watchdog/`，ACL 收紧到当前用户；能读取该目录的账号即可解出 SendKey（本机 AES 密钥方案，非 DPAPI 系统凭据库）。
- 推送请求在发送前会复查该交互是否仍在等待（避免"刚回答完还推一条"），但不支持取消已发出的 HTTP 请求。
- `/test` 与写接口仅供本机回环：同机的任意进程（含本地网页/脚本）都可以触发测试推送或修改配置，请勿在运行不可信本机程序时使用。
- 推送只在手机上作为"闹铃"：正文链接指向你配置的 Harness 地址（默认本机 127.0.0.1），手机上的 127.0.0.1 是手机本身——处理还是要回到跑 dsh 的机器。

## 开发

```powershell
pnpm install                 # 必须成功完成：client 类型包（@deepseek-ai/dsh-client-*、react 等）是 devDependencies，
                             # 未安装时 typecheck 无法解析 src/client/*
pnpm test                    # 核心逻辑 + host 侧单测（tsx + node:test）
pnpm run typecheck && pnpm run build
```

CI（`.github/workflows/ci.yml`）：Node 22/24 矩阵上跑 typecheck + 单测 + 构建，并校验 `lib/` 产物与提交一致。
