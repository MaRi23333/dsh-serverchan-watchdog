import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import s from "@deepseek-ai/schemastery";
import { ProxyAgent, fetch } from "undici";

//#region src/core.ts
/**
* Tracks pending human interactions with threshold/repeat timers.
* `stop()` cancels everything; a fire that settles after `stop()` is a no-op.
*/
var PendingTracker = class {
	entries = /* @__PURE__ */ new Map();
	now;
	after;
	cancel;
	thresholdMs;
	repeatMs;
	retryMs;
	onFire;
	constructor(options) {
		this.now = options.now ?? (() => Date.now());
		this.after = options.after ?? ((ms, fn) => setTimeout(fn, ms));
		this.cancel = options.cancel ?? ((handle) => clearTimeout(handle));
		const threshold = options.thresholdMs;
		const repeat = options.repeatMs;
		const retry = options.retryMs ?? (() => 5 * 6e4);
		this.thresholdMs = typeof threshold === "function" ? threshold : () => threshold;
		this.repeatMs = typeof repeat === "function" ? repeat : () => repeat;
		this.retryMs = typeof retry === "function" ? retry : () => retry;
		this.onFire = options.onFire;
	}
	/** Number of interactions currently watched. */
	get size() {
		return this.entries.size;
	}
	/**
	* Begin watching one interaction. A repeat start for the same id is a no-op.
	* @param entry - identity, kind, session, and display text; startedAt/pushes are filled here.
	*/
	start(entry) {
		if (this.entries.has(entry.id)) return;
		const pending = {
			...entry,
			startedAt: this.now(),
			pushes: 0
		};
		const timer = this.after(this.thresholdMs(), () => {
			this.fire(pending);
		});
		this.entries.set(entry.id, {
			pending,
			timer,
			repeat: void 0
		});
	}
	/**
	* Stop watching one interaction and cancel any scheduled repeat.
	* @param id - the exact identity passed to {@link start}.
	*/
	stop(id) {
		const entry = this.entries.get(id);
		if (entry === void 0) return;
		this.cancel(entry.timer);
		if (entry.repeat !== void 0) this.cancel(entry.repeat);
		this.entries.delete(id);
	}
	/**
	* Whether one interaction is still being watched. A fire callback should
	* re-check this right before publishing, so a `stop()` that lands while the
	* callback awaits (e.g. an HTTP push in flight) cannot send a stale notice.
	* @param id - the identity passed to {@link start}.
	*/
	has(id) {
		return this.entries.has(id);
	}
	/** Snapshot of the active interactions. */
	list() {
		return [...this.entries.values()].map((entry) => ({ ...entry.pending }));
	}
	/**
	* Stop every interaction matching a predicate (e.g. all of one session).
	* @param match - predicate over the pending entry.
	*/
	stopWhere(match) {
		for (const id of [...this.entries.keys()]) {
			const entry = this.entries.get(id);
			if (entry !== void 0 && match(entry.pending)) this.stop(id);
		}
	}
	/** Stop every watched interaction (plugin teardown). */
	dispose() {
		for (const id of [...this.entries.keys()]) this.stop(id);
	}
	async fire(pending) {
		const entry = this.entries.get(pending.id);
		if (entry === void 0) return;
		pending.pushes += 1;
		entry.repeat = void 0;
		let failed = false;
		try {
			failed = await this.onFire(pending) === false;
		} catch {
			failed = true;
		}
		if (this.entries.get(pending.id) !== entry) return;
		if (failed && this.retryMs() > 0) entry.repeat = this.after(this.retryMs(), () => {
			this.fire(pending);
		});
		else if (this.repeatMs() > 0) entry.repeat = this.after(this.repeatMs(), () => {
			this.fire(pending);
		});
	}
};
/**
* Validate one settings-page minute value as an integer within range.
* @param value - raw value from a settings patch.
* @param min - inclusive minimum.
* @param max - inclusive maximum.
* @returns the integer, or null when out of range / not a finite integer.
*/
function minutesValue(value, min, max) {
	if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) return null;
	if (value < min || value > max) return null;
	return value;
}
/**
* Resolve a ServerChan delivery URL from a credential that is either a full
* https push URL (ServerChan's own hosts only), an sctp SendKey
* ("sctp<uid>t<rest>"), or a classic SendKey.
* @returns the delivery URL, or null for an empty/malformed credential. A
*   full URL on any other host, an http:// URL, or an uppercase "SCTP" key is
*   rejected — an arbitrary host would turn the config endpoint into a
*   form-POST proxy and leak the key; the official hosts are fixed.
*/
function buildPushUrl(credential) {
	const value = credential.trim();
	if (value === "") return null;
	if (/^https:\/\//i.test(value)) {
		let host;
		try {
			host = new URL(value).host;
		} catch {
			return null;
		}
		if (host === "sctapi.ftqq.com" || /^\d+\.push\.ft07\.com$/.test(host)) return value;
		return null;
	}
	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return null;
	if (value.startsWith("sctp")) {
		const match = /^sctp(\d+)t/.exec(value);
		return match === null ? null : `https://${match[1]}.push.ft07.com/send/${value}.send`;
	}
	if (/^sctp/i.test(value)) return null;
	return `https://sctapi.ftqq.com/${value}.send`;
}
/**
* Summarize one raw `ask_user_question` tool-call arguments JSON string: the
* first question's text and whether it is a plan review (intent plan-review).
* @returns the kind and display detail, or null when the payload is not a
*   question list (malformed JSON, missing/empty questions).
*/
function describeQuestionCall(rawArguments) {
	let parsed;
	try {
		parsed = JSON.parse(rawArguments);
	} catch {
		return null;
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
	const questions = parsed.questions;
	if (!Array.isArray(questions) || questions.length === 0) return null;
	const first = questions[0];
	if (first === null || typeof first !== "object") return null;
	const question = typeof first.question === "string" ? first.question : "";
	return {
		kind: first.intent?.kind === "plan-review" ? "plan-review" : "question",
		detail: question === "" ? "(无问题文本)" : question
	};
}
/**
* Collapse whitespace and clip one line for display.
* @param text - source text.
* @param max - maximum output length; overflow appends an ellipsis.
*/
function truncate(text, max) {
	const trimmed = text.replace(/\s+/g, " ").trim();
	if (trimmed.length <= max) return trimmed;
	return `${trimmed.slice(0, Math.max(max - 1, 0))}…`;
}
/**
* Summarize one raw `exit_plan_mode` tool-call arguments JSON string (plan
* mode's plan review: the tool calls `ctx.userQuestions.ask` directly, so the
* only session-log signal is this tool's call/result pair).
* @returns display detail (plan heading/first words), never null — a bad
*   payload still has to be watched, or a review would silently go unnoticed.
*/
function describeExitPlanCall(rawArguments) {
	let plan = "";
	try {
		const parsed = JSON.parse(rawArguments);
		plan = typeof parsed?.plan === "string" ? parsed.plan : "";
	} catch {}
	const snippet = truncate(plan, 120);
	return snippet === "" ? "计划审查（无计划文本）" : `计划审查：${snippet}`;
}
/**
* Fold a session log and recover interactions still awaiting a human answer —
* used at plugin startup so a `dsh web` restart does not silently drop the
* watch on asks that were already pending (the timers are in-memory).
*
* Includes:
*  - `tool/call` of `ask_user_question` / `exit_plan_mode` without a matching
*    `tool/result` (paired by `message.source.callId`);
*  - `approval/asked` without a matching `approval/decided` (paired by id).
*
* An unanswered ask is by definition not yet answered, so an unclosed pair
* here is the ask still waiting — with one caveat: if the host died between
* the human answering and the result being appended, this re-arms a watch on
* an already-answered ask (harmless: no answer can be expected, the reminder
* fires and the next session pass closes the pair).
*
* @param events - the session's events in log order.
* @param sessionId - session identity for the seeds.
* @returns seeds to start, in log order.
*/
function recoverPending(events, sessionId) {
	const seeds = [];
	const seenQuestions = /* @__PURE__ */ new Set();
	const seenApprovals = /* @__PURE__ */ new Set();
	for (const event of events) {
		const data = event.data;
		if (event.type === "tool/call") {
			const name$1 = data["name"];
			if (name$1 !== "ask_user_question" && name$1 !== "exit_plan_mode") continue;
			const callId = data["callId"];
			if (typeof callId !== "string") continue;
			if (seenQuestions.has(callId)) continue;
			seeds.push({
				id: `q:${callId}`,
				kind: name$1 === "exit_plan_mode" ? "plan-review" : "question",
				sessionId,
				detail: name$1 === "exit_plan_mode" ? describeExitPlanCall(typeof data["arguments"] === "string" ? data["arguments"] : "") : describeQuestionCall(typeof data["arguments"] === "string" ? data["arguments"] : "")?.detail ?? "问答（请打开界面查看）",
				startedAt: event.time ?? Date.now()
			});
		} else if (event.type === "tool/result") {
			const message = data["message"];
			const callId = message?.source?.kind === "tool" ? message.source.callId : void 0;
			if (callId === void 0) continue;
			seenQuestions.add(callId);
		} else if (event.type === "approval/asked") {
			const id = data["id"];
			if (typeof id !== "string") continue;
			if (seenApprovals.has(id)) continue;
			seeds.push({
				id: `a:${id}`,
				kind: "approval",
				sessionId,
				detail: typeof data["reason"] === "string" ? data["reason"] : `工具 ${String(data["toolName"] ?? "?")} 请求审批`,
				startedAt: event.time ?? Date.now()
			});
		} else if (event.type === "approval/decided") {
			const id = data["id"];
			if (typeof id === "string") seenApprovals.add(id);
		}
	}
	return seeds.filter((seed) => seed.kind === "approval" ? !seenApprovals.has(seed.id.slice(2)) : !seenQuestions.has(seed.id.slice(2)));
}

//#endregion
//#region src/index.ts
const name = "serverchan-watchdog";
const Config = s.object({
	enabled: s.boolean().default(true),
	thresholdMinutes: s.number().min(1).max(1440).default(5),
	repeatMinutes: s.number().min(0).max(1440).default(0),
	title: s.string().default("DSH 等待人工确认"),
	webUrl: s.string().default("http://127.0.0.1:3080"),
	proxy: s.string().default(""),
	stateDir: s.string().default(""),
	sendkey: s.string().default("")
});
const KIND_LABELS = {
	question: "问答",
	"plan-review": "计划评审",
	approval: "审批"
};
/** Rejected settings patch; `code` maps directly to the API error. */
var StoreError = class extends Error {
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "StoreError";
	}
};
/** Best-effort Windows ACL tightening: current user only, inheritance removed. */
function tightenAcl(filePath) {
	if (process.platform !== "win32") return;
	const user = process.env.USERNAME;
	if (user === void 0) return;
	try {
		spawnSync("icacls", [
			filePath,
			"/inheritance:r",
			"/grant:r",
			`${user}:F`
		], {
			stdio: "ignore",
			timeout: 5e3
		});
	} catch {}
}
function stateDirOf(config) {
	const configured = (config.stateDir ?? "").trim();
	if (configured !== "") return configured;
	const home = process.env.DSH_HOME?.trim();
	return join(home !== void 0 && home !== "" ? home : join(homedir(), ".dsh"), "serverchan-watchdog");
}
function loadOrCreateKey(dir) {
	const path = join(dir, "key.bin");
	try {
		const existing = readFileSync(path);
		if (existing.length === 32) {
			try {
				chmodSync(path, 384);
			} catch {}
			tightenAcl(path);
			return existing;
		}
	} catch {}
	mkdirSync(dir, { recursive: true });
	const key = randomBytes(32);
	try {
		writeFileSync(path, key, {
			flag: "wx",
			mode: 384
		});
		tightenAcl(path);
	} catch {}
	const created = readFileSync(path);
	return created.length === 32 ? created : key;
}
function encrypt(secret, key) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
	return {
		iv: iv.toString("base64"),
		tag: cipher.getAuthTag().toString("base64"),
		data: data.toString("base64")
	};
}
function decrypt(box, key) {
	try {
		const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(box.iv, "base64"));
		decipher.setAuthTag(Buffer.from(box.tag, "base64"));
		return Buffer.concat([decipher.update(Buffer.from(box.data, "base64")), decipher.final()]).toString("utf8");
	} catch {
		return "";
	}
}
/** Encrypted on-disk settings store (AES-256-GCM under per-machine key.bin). */
var SettingsStore = class {
	filePath;
	key;
	constructor(dir) {
		mkdirSync(dir, { recursive: true });
		this.filePath = join(dir, "state.json");
		this.key = loadOrCreateKey(dir);
	}
	/** Decrypted stored SendKey / push URL, or '' when none. */
	get sendkey() {
		const file = this.read();
		return file.sendkeyCipher === void 0 ? "" : decrypt(file.sendkeyCipher, this.key);
	}
	get hasStoredKey() {
		return this.read().sendkeyCipher !== void 0;
	}
	get thresholdMinutes() {
		return this.read().thresholdMinutes;
	}
	get repeatMinutes() {
		return this.read().repeatMinutes;
	}
	/** Stored proxy (sanitized, '' when none). */
	get proxy() {
		return this.read().proxy ?? "";
	}
	/** Stored web URL (sanitized, '' when none). */
	get webUrl() {
		return this.read().webUrl ?? "";
	}
	/**
	* Apply one validated patch. Everything is validated before anything is
	* written, so a rejected field cannot leave a partially-applied store.
	* @param patch - settings-page edit; undefined keeps, '' clears.
	* @throws {StoreError} when any provided value is rejected.
	*/
	update(patch) {
		const next = this.read();
		if (patch.sendkey !== void 0 && patch.sendkey.trim() !== "") {
			if (buildPushUrl(patch.sendkey) === null) throw new StoreError("invalid-sendkey", "SendKey/URL 不是合法的 ServerChan 凭据");
			if (patch.clearKey !== true) next.sendkeyCipher = encrypt(patch.sendkey.trim(), this.key);
		}
		if (patch.clearKey === true) delete next.sendkeyCipher;
		if (patch.thresholdMinutes !== void 0) {
			const value = minutesValue(patch.thresholdMinutes, 1, 1440);
			if (value === null) throw new StoreError("invalid-minutes", "阈值必须为 1–1440 的整数分钟");
			next.thresholdMinutes = value;
		}
		if (patch.repeatMinutes !== void 0) {
			const value = minutesValue(patch.repeatMinutes, 0, 1440);
			if (value === null) throw new StoreError("invalid-minutes", "重复间隔必须为 0–1440 的整数分钟");
			next.repeatMinutes = value;
		}
		if (patch.proxy !== void 0) {
			const trimmed = patch.proxy.trim();
			if (trimmed === "") delete next.proxy;
			else {
				const normalized = proxyOf(trimmed);
				if (normalized === null) throw new StoreError("invalid-proxy", "代理必须是 http(s):// 且不含用户名密码");
				next.proxy = normalized;
			}
		}
		if (patch.webUrl !== void 0) {
			const trimmed = patch.webUrl.trim();
			if (trimmed === "") delete next.webUrl;
			else {
				const normalized = webUrlOf(trimmed);
				if (normalized === null) throw new StoreError("invalid-weburl", "打开链接必须是 http(s):// 地址");
				next.webUrl = normalized;
			}
		}
		next.version = 1;
		this.write(next);
	}
	/** BOM/whitespace-tolerant parse; malformed or invalid fields are dropped. */
	read() {
		try {
			const raw = readFileSync(this.filePath).toString("utf8").replace(/^\uFEFF/, "").trim();
			if (raw === "") return { version: 1 };
			const parsed = JSON.parse(raw);
			if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { version: 1 };
			const file = { version: 1 };
			if (parsed.sendkeyCipher !== void 0 && parsed.sendkeyCipher !== null) file.sendkeyCipher = parsed.sendkeyCipher;
			const threshold = minutesValue(parsed.thresholdMinutes, 1, 1440);
			if (threshold !== null) file.thresholdMinutes = threshold;
			const repeat = minutesValue(parsed.repeatMinutes, 0, 1440);
			if (repeat !== null) file.repeatMinutes = repeat;
			if (typeof parsed.proxy === "string") {
				const normalized = proxyOf(parsed.proxy);
				if (normalized !== null) file.proxy = normalized;
			}
			if (typeof parsed.webUrl === "string") {
				const normalized = webUrlOf(parsed.webUrl);
				if (normalized !== null) file.webUrl = normalized;
			}
			return file;
		} catch {
			return { version: 1 };
		}
	}
	write(file) {
		const temp = `${this.filePath}.tmp-${process.pid}`;
		writeFileSync(temp, JSON.stringify(file, null, 2), { mode: 384 });
		renameSync(temp, this.filePath);
		tightenAcl(this.filePath);
	}
};
/** Merge settings-store overrides over the bundle-patch Config. */
function effectiveOf(config, store) {
	return {
		enabled: config.enabled ?? true,
		thresholdMinutes: store.thresholdMinutes ?? config.thresholdMinutes ?? 5,
		repeatMinutes: store.repeatMinutes ?? config.repeatMinutes ?? 0,
		title: (config.title ?? "").trim() || "DSH 等待人工确认",
		webUrl: store.webUrl !== "" ? store.webUrl : (config.webUrl ?? "").trim() || "http://127.0.0.1:3080",
		proxy: store.proxy !== "" ? store.proxy : proxyOf(config.proxy ?? "") ?? ""
	};
}
/** Nothing that a response may expose: credentials stay encrypted on disk. */
function editableView(config, store) {
	const eff = effectiveOf(config, store);
	return {
		enabled: eff.enabled,
		thresholdMinutes: eff.thresholdMinutes,
		repeatMinutes: eff.repeatMinutes,
		title: eff.title,
		webUrl: eff.webUrl,
		proxy: redactProxy(eff.proxy),
		credentialConfigured: resolveCredential(config, store) !== "",
		hasStoredKey: store.hasStoredKey,
		stateDir: stateDirOf(config)
	};
}
/** Normalize a user-configured proxy URL; http/https without userinfo, else ''. */
function proxyOf(url) {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
		if (parsed.username !== "" || parsed.password !== "") return null;
		return parsed.href.replace(/\/$/, "");
	} catch {
		return null;
	}
}
/** Normalize the "open Harness" link; http(s) only (credentials removed). */
function webUrlOf(url) {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
		parsed.username = "";
		parsed.password = "";
		return parsed.href.replace(/\/$/, "");
	} catch {
		return null;
	}
}
function redactProxy(url) {
	try {
		const parsed = new URL(url);
		if (parsed.username !== "" || parsed.password !== "") {
			parsed.username = "";
			parsed.password = "";
			return parsed.href.replace(/\/$/, "");
		}
		return url;
	} catch {
		return "";
	}
}
/** POST one ServerChan message (form-urlencoded; success = HTTP 200 + JSON code 0). */
async function sendPush(url, proxy, title, desp, fetchImpl = fetch) {
	const body = new URLSearchParams();
	body.set("title", title);
	body.set("desp", desp);
	const dispatcher = proxy !== "" ? new ProxyAgent(proxy) : void 0;
	try {
		const response = await fetchImpl(url, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: body.toString(),
			signal: AbortSignal.timeout(2e4),
			...dispatcher === void 0 ? {} : { dispatcher }
		});
		const text = await response.text();
		if (response.status !== 200) return {
			ok: false,
			message: `HTTP ${response.status}`
		};
		let code;
		try {
			code = JSON.parse(text).code;
		} catch {
			return {
				ok: false,
				message: "unexpected response body"
			};
		}
		if (code !== 0) return {
			ok: false,
			message: `server code ${String(code)}`
		};
		return {
			ok: true,
			message: "pushed"
		};
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error && error.name === "AbortError" ? "timeout" : "network-failed"
		};
	} finally {
		if (dispatcher !== void 0) dispatcher.close();
	}
}
function resolveCredential(config, store) {
	const fromFile = store.sendkey;
	if (fromFile !== "") return fromFile;
	const fromConfig = (config.sendkey ?? "").trim();
	if (fromConfig !== "") return fromConfig;
	return (process.env.DSH_SERVERCHAN_SENDKEY ?? "").trim();
}
function pushTitle(config, pending) {
	const base = truncate((config.title ?? "").trim() || "DSH 等待人工确认", 20);
	return pending.pushes > 1 ? `${base}（第 ${pending.pushes} 次）` : base;
}
function pushDesp(pending, config, eff) {
	const elapsedMinutes = Math.max(0, Math.floor((Date.now() - pending.startedAt) / 6e4));
	return [
		`**类型**：${KIND_LABELS[pending.kind]}`,
		`**会话**：\`${pending.sessionId}\``,
		`**内容**：${truncate(pending.detail, 300)}`,
		`**已等待**：${elapsedMinutes} 分钟（阈值 ${eff.thresholdMinutes} 分钟）`,
		`**状态**：${pending.pushes > 1 ? `已提醒 ${pending.pushes} 次，仍未处理` : "超过阈值未处理"}`,
		"",
		`👉 [打开 DeepSeek Harness](${eff.webUrl})`
	].join("\n");
}
function isLoopback(address) {
	if (address === void 0) return false;
	const normalized = address.toLowerCase().replace(/^::ffff:/, "");
	return normalized === "127.0.0.1" || normalized === "::1";
}
function sendJson(res, status, payload) {
	const body = JSON.stringify(payload);
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(body);
}
function guardLoopback(req, res) {
	if (!isLoopback(req.socket.remoteAddress)) {
		sendJson(res, 403, {
			ok: false,
			error: "forbidden"
		});
		return false;
	}
	return true;
}
/** Loopback + JSON body + same-origin (Origin must match Host when present; absent Origin is allowed for CLI tooling). */
function guardWrite(req, res) {
	if (!guardLoopback(req, res)) return false;
	if (((req.headers["content-type"] ?? "").split(";")[0]?.trim() ?? "") !== "application/json") {
		sendJson(res, 415, {
			ok: false,
			error: "content-type must be application/json"
		});
		return false;
	}
	const origin = req.headers.origin ?? "";
	if (origin !== "") {
		let originHost;
		try {
			originHost = new URL(origin).host.toLowerCase();
		} catch {
			sendJson(res, 403, {
				ok: false,
				error: "forbidden-origin"
			});
			return false;
		}
		if (originHost !== (req.headers.host ?? "").toLowerCase()) {
			sendJson(res, 403, {
				ok: false,
				error: "forbidden-origin"
			});
			return false;
		}
	}
	return true;
}
async function readJsonBody(req, maxBytes = 64 * 1024) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
		size += buffer.length;
		if (size > maxBytes) throw new Error("body too large");
		chunks.push(buffer);
	}
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		return null;
	}
}
function apply(ctx, config) {
	const log = ctx.logger("serverchan-watchdog");
	const store = new SettingsStore(stateDirOf(config));
	const settings = () => effectiveOf(config, store);
	const pushNow = async (credential, title, desp) => {
		const url = buildPushUrl(credential);
		if (url === null) return {
			ok: false,
			message: "SendKey/URL 无效或未配置"
		};
		return sendPush(url, settings().proxy, title, desp);
	};
	const tracker = new PendingTracker({
		thresholdMs: () => settings().thresholdMinutes * 6e4,
		repeatMs: () => settings().repeatMinutes * 6e4,
		onFire: async (pending) => {
			if (!tracker.has(pending.id)) return true;
			const credential = resolveCredential(config, store);
			if (credential === "") {
				log.warn(`pending ${pending.id} not pushed: no ServerChan credential configured`);
				return false;
			}
			const result = await pushNow(credential, pushTitle(config, pending), pushDesp(pending, config, settings()));
			if (result.ok) log.info(`pushed ${pending.kind} reminder (${pending.id}, push #${pending.pushes})`);
			else log.warn(`push failed for ${pending.id}: ${result.message}`);
			return result.ok;
		}
	});
	const questionQueues = /* @__PURE__ */ new Map();
	ctx.effect(() => () => {
		tracker.dispose();
		questionQueues.clear();
	}, "serverchan-watchdog: teardown");
	const sessions = ctx.get("sessions");
	if (sessions !== void 0 && settings().enabled && settings().thresholdMinutes > 0) for (const session of sessions.list()) for (const seed of recoverPending(session.events, session.id)) tracker.start(seed);
	ctx.on("session/disposed", (session) => {
		tracker.stopWhere((pending) => pending.sessionId === session.id);
		questionQueues.delete(session.id);
	});
	const boot = settings();
	if (boot.enabled && boot.thresholdMinutes > 0) ctx.on("session/event", (session, event) => {
		if (event.type === "tool/call") {
			const callId = event.data.callId;
			if (event.data.name === "ask_user_question") {
				const described = describeQuestionCall(event.data.arguments);
				const queue = questionQueues.get(session.id);
				if (queue === void 0) questionQueues.set(session.id, [callId]);
				else queue.push(callId);
				tracker.start({
					id: `q:${callId}`,
					kind: described?.kind ?? "question",
					sessionId: session.id,
					detail: described?.detail ?? "问答（请打开界面查看）"
				});
				return;
			}
			if (event.data.name === "exit_plan_mode") {
				const queue = questionQueues.get(session.id);
				if (queue === void 0) questionQueues.set(session.id, [callId]);
				else queue.push(callId);
				tracker.start({
					id: `q:${callId}`,
					kind: "plan-review",
					sessionId: session.id,
					detail: describeExitPlanCall(event.data.arguments)
				});
				return;
			}
			return;
		}
		if (event.type === "tool/result") {
			const source = event.data.message?.source;
			const callId = source?.kind === "tool" ? source.callId : void 0;
			if (callId !== void 0) {
				tracker.stop(`q:${callId}`);
				const queue$1 = questionQueues.get(session.id);
				if (queue$1 !== void 0) {
					const index = queue$1.indexOf(callId);
					if (index >= 0) queue$1.splice(index, 1);
					if (queue$1.length === 0) questionQueues.delete(session.id);
				}
				return;
			}
			const queue = questionQueues.get(session.id);
			const head = queue?.shift();
			if (head !== void 0) {
				tracker.stop(`q:${head}`);
				if (queue.length === 0) questionQueues.delete(session.id);
			}
			return;
		}
		if (event.type === "approval/asked") {
			tracker.start({
				id: `a:${event.data.id}`,
				kind: "approval",
				sessionId: session.id,
				detail: event.data.reason ?? `工具 ${event.data.toolName} 请求审批`
			});
			return;
		}
		if (event.type === "approval/decided") tracker.stop(`a:${event.data.id}`);
	});
	ctx.inject(["webServer"], (wctx) => {
		const web = wctx.webServer;
		wctx.effect(() => web.register({
			kind: "exact",
			path: "/serverchan-watchdog/status",
			handler: async (req, res) => {
				if (req.method !== "GET") {
					sendJson(res, 405, {
						ok: false,
						error: "method-not-allowed"
					});
					return;
				}
				if (!guardLoopback(req, res)) return;
				sendJson(res, 200, {
					ok: true,
					...editableView(config, store),
					pending: tracker.list()
				});
			}
		}), "serverchan-watchdog: status route");
		wctx.effect(() => web.register({
			kind: "exact",
			path: "/serverchan-watchdog/config",
			handler: async (req, res) => {
				if (req.method === "GET") {
					if (!guardLoopback(req, res)) return;
					sendJson(res, 200, {
						ok: true,
						...editableView(config, store)
					});
					return;
				}
				if (req.method !== "POST") {
					sendJson(res, 405, {
						ok: false,
						error: "method-not-allowed"
					});
					return;
				}
				if (!guardWrite(req, res)) return;
				let body;
				try {
					body = await readJsonBody(req);
				} catch {
					sendJson(res, 400, {
						ok: false,
						error: "body-too-large"
					});
					return;
				}
				if (body === null || typeof body !== "object" || Array.isArray(body)) {
					sendJson(res, 400, {
						ok: false,
						error: "invalid-json"
					});
					return;
				}
				const record = body;
				const patch = {};
				if (record["clearKey"] === true) patch.clearKey = true;
				if (typeof record["sendkey"] === "string") patch.sendkey = record["sendkey"];
				if (typeof record["thresholdMinutes"] === "number") patch.thresholdMinutes = record["thresholdMinutes"];
				if (typeof record["repeatMinutes"] === "number") patch.repeatMinutes = record["repeatMinutes"];
				if (typeof record["proxy"] === "string") patch.proxy = record["proxy"];
				if (typeof record["webUrl"] === "string") patch.webUrl = record["webUrl"];
				if (Object.keys(patch).length === 0) {
					sendJson(res, 400, {
						ok: false,
						error: "nothing-to-save"
					});
					return;
				}
				try {
					store.update(patch);
				} catch (error) {
					if (error instanceof StoreError) sendJson(res, 400, {
						ok: false,
						error: error.code,
						message: error.message
					});
					else {
						log.warn(`config save failed: ${error instanceof Error ? error.message : String(error)}`);
						sendJson(res, 500, {
							ok: false,
							error: "save-failed"
						});
					}
					return;
				}
				log.info("settings saved (sendkey encrypted)");
				sendJson(res, 200, {
					ok: true,
					...editableView(config, store)
				});
			}
		}), "serverchan-watchdog: config route");
		wctx.effect(() => web.register({
			kind: "exact",
			path: "/serverchan-watchdog/test",
			handler: async (req, res) => {
				if (req.method !== "POST") {
					sendJson(res, 405, {
						ok: false,
						error: "method-not-allowed"
					});
					return;
				}
				if (!guardWrite(req, res)) return;
				const result = await pushNow(resolveCredential(config, store), "DSH ServerChan 配置测试", "这条消息说明推送配置可用。");
				sendJson(res, 200, {
					ok: result.ok,
					message: result.message
				});
			}
		}), "serverchan-watchdog: test route");
	});
}

//#endregion
export { Config, SettingsStore, StoreError, apply, guardLoopback, guardWrite, name, sendPush };