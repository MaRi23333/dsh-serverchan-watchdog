# dsh-serverchan-watchdog

[中文](./README.md) · **English**

![dsh-serverchan-watchdog: mobile ServerChan alerts for pending DSH interactions](./assets/readme/hero.svg)

[![CI](https://github.com/MaRi23333/dsh-serverchan-watchdog/actions/workflows/ci.yml/badge.svg)](https://github.com/MaRi23333/dsh-serverchan-watchdog/actions/workflows/ci.yml)
![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-43853d)
![DeepSeek Harness plugin](https://img.shields.io/badge/DeepSeek_Harness-plugin-4d6bfe)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![Unofficial](https://img.shields.io/badge/status-unofficial-lightgrey)

When an approval, plan review, or `ask_user_question` response remains pending past the configured threshold, this plugin sends a mobile alert through ServerChan from the DeepSeek Harness (DSH) host—even with the browser closed.

> `dsh-serverchan-watchdog` is an independently developed community plugin. It is not affiliated with, sponsored by, or endorsed by ServerChan or DeepSeek Harness; their names are used only to identify compatible services.

## What it solves

Browser notifications are useful while you are at the computer. This plugin keeps the timer on the host and reaches your phone after you leave the desk or close the tab. Both types of notification can be used together.

- **Host-side monitoring** over the durable session event stream; no browser connection required.
- **Three native interaction seams**: questions, plan reviews, and tool/sandbox approvals.
- **Restart recovery** from unclosed session-log pairs while preserving their original start time.
- **Bounded failure handling**: network errors, timeouts, and HTTP 5xx responses get at most two retries; HTTP 4xx (including 429), ServerChan business errors, and malformed responses stop immediately.
- **Encrypted local storage**: the SendKey is stored as AES-256-GCM ciphertext and never returned by the API or written to logs.

## Watched interactions

| Interaction | Starts at | Ends at |
| --- | --- | --- |
| `ask_user_question` | its `tool/call` | matching `tool/result` by `callId` |
| `exit_plan_mode` plan review | its `tool/call` | matching `tool/result` by `callId` |
| Tool or sandbox approval | `approval/asked` | matching `approval/decided` by ID |

The default threshold is five minutes and one successful alert per interaction. An optional repeat interval enables later reminders. A missing credential only defers the local check: it makes no network request and consumes no retry attempt.

## Install

Pin the reviewed annotated `v0.1.0` for a reproducible install:

```sh
dsh plugin --profile web add github:MaRi23333/dsh-serverchan-watchdog#v0.1.0

# when dsh is not on PATH
npx -p @deepseek-ai/dsh dsh plugin --profile web add github:MaRi23333/dsh-serverchan-watchdog#v0.1.0
```

Use the unpinned form only when you intentionally want a rolling install that follows `main`:

```sh
dsh plugin --profile web add github:MaRi23333/dsh-serverchan-watchdog
```

For local development:

```sh
dsh plugin --profile web add /absolute/path/to/dsh-serverchan-watchdog
```

Restart `dsh web` from a normal terminal after installation.

## Configuration

Open DSH settings → Plugins → **ServerChan alerts** after the restart.

New to ServerChan? Follow the official [SendKey guide](https://sct.ftqq.com/docs/getting-started/sendkey/) and set up either [ServerChan Turbo](https://sct.ftqq.com/) (commonly delivered through WeChat) or [ServerChan³](https://sc3.ft07.com/) (the standalone app), then paste the console-provided SendKey or complete push URL below.

- **Push URL / SendKey** accepts a classic `SCT...` key, a ServerChan³ `sctp...` key, or the official complete HTTPS URL shown in the console.
  - `SCT...` is ServerChan Turbo and commonly delivers through WeChat.
  - `sctp...` is ServerChan³ and delivers through the ServerChan³ app.
- **Threshold** defaults to five minutes. Changes apply to interactions that start after the save.
- **Repeat interval** defaults to zero: one successful alert only.
- **HTTP proxy** is optional; credentials embedded in the proxy URL are rejected.
- **Harness link** defaults to `http://127.0.0.1:3080`. On a phone, `127.0.0.1` points to the phone itself. Use a protected LAN/VPN address if mobile access is required.
- **Test push** sends one message with the current settings.

Settings-page values override the bundle-patch defaults:

```yaml
- id: serverchan-watchdog
  config:
    enabled: true
    thresholdMinutes: 5
    repeatMinutes: 0
    title: DSH 等待人工确认
    webUrl: http://127.0.0.1:3080
    proxy: ''
```

`DSH_SERVERCHAN_SENDKEY` can provide the credential in environments that already have external secret management. Never write its real value to the repository or command output.

## Data flow and security

The following fields leave the machine in a ServerChan message: interaction type, session ID, question/plan/approval summary, elapsed time, and the configured Harness link. They are then subject to the retention policy of the selected ServerChan channel and account. Do not put secrets in pending prompts or links.

- The SendKey ciphertext lives in `$DSH_HOME/serverchan-watchdog/state.json`; `key.bin` in the same directory decrypts it. File permissions are tightened where possible, but a local account that can read both files can recover the key. This is not an OS credential vault.
- Only exact official ServerChan HTTPS endpoint shapes are accepted. Userinfo, query strings, fragments, wrong hosts or paths, and mismatched ServerChan³ UIDs are rejected.
- Status, configuration, and test routes are loopback-only, but local processes remain inside the trust boundary. An untrusted local process can read pending details, change settings, or trigger a test message. Do not expose DSH directly to the public internet; protect reverse-proxy, LAN, and VPN access with authentication and access controls.
- Failure logs retain only a class such as `timeout`, `network-failed`, an HTTP status, or a business-error category—never the SendKey, complete URL, response body, or raw exception.
- Quotas, failed-call accounting, and retention differ by channel and plan. See the official [SendKey guide](https://sct.ftqq.com/docs/getting-started/sendkey/) and [FAQ](https://sct.ftqq.com/docs/getting-started/faq/).

## Local routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/serverchan-watchdog/status` | GET | effective configuration and pending list, without credentials or state-directory paths |
| `/serverchan-watchdog/config` | GET | editable configuration view without credentials |
| `/serverchan-watchdog/config` | POST | save SendKey, timing, proxy, or link settings |
| `/serverchan-watchdog/test` | POST | send one test alert |

Write routes require JSON and loopback same-origin validation.

## Limitations

- If the host crashes after a human answers but before the result reaches the session log, restart recovery may send one extra reminder.
- After a DSH restart, multiple still-pending interactions that are already past the threshold are re-armed together and may send several alerts in a short period, consuming ServerChan quota.
- The plugin checks that an interaction is still pending immediately before each push, but it cannot cancel an HTTP request already in flight.
- A phone alert is only an entry point. Opening Harness on the phone depends on the configured URL and your network access controls.

## Development

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run build
pnpm run check:smoke
pnpm run check:pack
git diff --exit-code -- lib
```

CI runs equivalent gates on Node.js 22 and 24. `autoInstallPeers:false` is intentional: a clean consumer must not rely on pnpm filling undeclared runtime dependencies.

## License

[MIT](./LICENSE)
