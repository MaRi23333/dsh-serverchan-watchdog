# dsh-serverchan-watchdog

**[中文](./README.md) | English**

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugin that
pushes a **WeChat message via [ServerChan](https://sct.ftqq.com/)** when a human
confirmation — approval, plan review, or an `ask_user_question` answer — stays
**unanswered past the threshold (default 5 minutes)**.

Built for the "I keep missing approval prompts because I'm away from the
computer" scenario: detection runs **on the DSH host** (over the session-event
stream), so it keeps working with the browser closed and you away from the desk.

## Features

- Watches all three native human-interaction seams; delays the push until the
  ask has been unanswered past `thresholdMinutes` (default **5**):
  - `ask_user_question` Q&A (`tool/call` → `tool/result` pairing)
  - `exit_plan_mode` plan review (plan-mode's approval review, same pairing)
  - tool approval / sandbox escalation (`approval/asked` → `approval/decided`
    pairing; coexists with reviewers such as `dsh-smart-approval` — fast
    auto-approvals never trigger a push)
- One push per interaction by default (`repeatMinutes > 0` enables re-reminders)
- Push body: kind (Q&A / plan review / approval), session id, question text or
  approval reason, elapsed time, and a link back to the Harness GUI
- SendKey **encrypted with AES-256-GCM** under a per-machine key file
  (`$DSH_HOME/serverchan-watchdog/state.json` + `key.bin`, ACL-tightened);
  never in the repo, logs, or API responses
- Full push URLs are limited to ServerChan's official hosts over https only;
  malformed keys (e.g. uppercase `SCTP…`) are rejected at save time instead of
  silently hitting the wrong endpoint
- Push failures log only the failure class (HTTP status / server code /
  timeout / network-failed) — raw errors (which may embed the URL and thus
  the key) are never echoed
- Optional HTTP(S) proxy (no credentials in the URL); loopback-only
  status/config/test routes with CSRF protection

> Note: `@ltao0829/dsh-task-notify` already provides **browser-side** toasts /
> desktop notifications / sounds — but those stop with the browser tab. This
> plugin adds the **WeChat push** channel for when you're away; both can run
> side by side.

## Install

```sh
# from git (repository URL finalized at release)
dsh plugin --profile web add git+https://github.com/<your-name>/dsh-serverchan-watchdog.git

# or from a local path during development
dsh plugin --profile web add <absolute path of this repo>
```

Restart `dsh web` from a **normal terminal** (not from inside a dsh web session).

## Configuration

### 1. Settings page (recommended)

After the restart: DSH settings → Plugins → **WeChat alerts (ServerChan)**:

- **Push URL / SendKey**: the SendKey from the ServerChan console (classic
  `SCT...` or Server酱³ `sctp...`) or the full push URL; stored encrypted
  (AES-256-GCM) in `$DSH_HOME/serverchan-watchdog/state.json`, never echoed back
- **Threshold (minutes)**: default 5; **Repeat interval (minutes)**: default 0
  (single reminder)
- **HTTP proxy (optional)**: e.g. `http://127.0.0.1:7897`
- **Send test push**: one-click configuration check
- The page also shows the live list of pending interactions

### 2. Command-line credential save (fallback)

```powershell
Invoke-WebRequest -Method Post -Uri http://127.0.0.1:3080/serverchan-watchdog/config `
  -ContentType 'application/json' -Body '{"sendkey":"SCTyourKey"}'
```

### 3. Bundle-patch defaults

Values saved in the settings page take precedence; the bundle patch provides
the defaults (used when the page has not overridden them):

```yaml
- id: serverchan-watchdog
  config:
    thresholdMinutes: 5      # push after 5 unanswered minutes (default)
    repeatMinutes: 30        # re-push every 30 minutes; 0 = once only (default)
    title: DSH 等待人工确认   # push title (single line, ≤32 chars)
    webUrl: http://127.0.0.1:3080   # "open Harness" link in the push body
    proxy: http://127.0.0.1:7897    # optional proxy (leave empty for direct)
    enabled: true            # master switch
```

## Routes (loopback only)

| Route | Method | Purpose |
| --- | --- | --- |
| `/serverchan-watchdog/status` | GET | effective config summary + pending list (no credentials) |
| `/serverchan-watchdog/config` | GET | editable settings view (no credentials) |
| `/serverchan-watchdog/config` | POST | `{"sendkey?","clearKey?","thresholdMinutes?","repeatMinutes?","proxy?"}` (JSON + loopback Origin) |
| `/serverchan-watchdog/test` | POST | send one test push with the current settings |

## How it works (summary)

1. The plugin listens to the host-side `session/event` stream — independent of
   the UI, running even with no browser connected.
2. A `tool/call` of `ask_user_question` / `exit_plan_mode` starts a timer; the
   matching `tool/result` (paired by `source.callId`) or `approval/decided`
   stops it without pushing.
3. Past `thresholdMinutes` the push goes out, carrying the question/plan
   snippet, session id, elapsed minutes, and a Harness link.

## Known limitations

- Timers live in memory: after a `dsh web` restart, interactions still waiting
  are not re-reminded (they still end normally when answered later).
- Only interactions that begin after the plugin loads are watched.
- With `dsh-smart-approval`, approvals auto-approved by the reviewer emit
  `approval/decided` within seconds and never trigger a push; only genuinely
  pending interactions are reminded.
- Encryption is "readable by anyone who can read the plugin state dir":
  `key.bin` lives beside the ciphertext in `$DSH_HOME/serverchan-watchdog/`,
  ACL-tightened to the current user; an account that can read that directory
  can recover the SendKey (local AES-key scheme, not the OS credential store).
- The push re-checks that the interaction is still pending right before
  sending (no stale notice right after an answer), but an already-issued HTTP
  request cannot be cancelled.

## Development

```sh
pnpm install
pnpm test                 # core unit tests (tsx + node:test)
pnpm run typecheck && pnpm run build
```

CI (`.github/workflows/ci.yml`): Node 22/24 matrix running typecheck + unit
tests + build, and verifies the committed `lib/` artifacts match.
