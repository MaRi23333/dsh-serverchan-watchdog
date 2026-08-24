window.__ModuleLoader__.load({ id: "dsh-serverchan-watchdog", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
let react = require("react");
react = __toESM(react);
let react_jsx_runtime = require("react/jsx-runtime");
react_jsx_runtime = __toESM(react_jsx_runtime);

//#region src/client/SettingsCard.tsx
function WatchdogSettings(props) {
	const { t, config, status, saveConfig: saveConfig$1, test } = props;
	const [credential, setCredential] = (0, react.useState)("");
	const [threshold, setThreshold] = (0, react.useState)("5");
	const [repeat, setRepeat] = (0, react.useState)("0");
	const [proxy, setProxy] = (0, react.useState)("");
	const [keyStatus, setKeyStatus] = (0, react.useState)("unknown");
	const [saving, setSaving] = (0, react.useState)(false);
	const [savedAt, setSavedAt] = (0, react.useState)(null);
	const [saveError, setSaveError] = (0, react.useState)(null);
	const [testing, setTesting] = (0, react.useState)(false);
	const [testResult, setTestResult] = (0, react.useState)(null);
	const [pending, setPending] = (0, react.useState)([]);
	const alive = (0, react.useRef)(true);
	(0, react.useEffect)(() => () => {
		alive.current = false;
	}, []);
	(0, react.useEffect)(() => {
		config().then((result) => {
			if (!alive.current || !result.ok) return;
			setThreshold(String(result.thresholdMinutes ?? 5));
			setRepeat(String(result.repeatMinutes ?? 0));
			setProxy(result.proxy ?? "");
			setKeyStatus(result.credentialConfigured ? "ok" : "missing");
		});
		status().then((result) => {
			if (alive.current && result.ok) setPending(Array.isArray(result.pending) ? result.pending : []);
		});
	}, [config, status]);
	const onSave = () => {
		if (saving) return;
		setSaving(true);
		setSaveError(null);
		setSavedAt(null);
		const patch = {};
		if (credential.trim() !== "") patch.sendkey = credential.trim();
		const thresholdValue = Number(threshold);
		if (Number.isFinite(thresholdValue) && threshold.trim() !== "") patch.thresholdMinutes = Math.round(thresholdValue);
		const repeatValue = Number(repeat);
		if (Number.isFinite(repeatValue) && repeat.trim() !== "") patch.repeatMinutes = Math.round(repeatValue);
		if (proxy !== "") patch.proxy = proxy;
		saveConfig$1(patch).then((result) => {
			if (!alive.current) return;
			setSaving(false);
			if (result.ok) {
				setSavedAt(Date.now());
				setCredential("");
				setThreshold(String(result.thresholdMinutes ?? 5));
				setRepeat(String(result.repeatMinutes ?? 0));
				setProxy(result.proxy ?? "");
				setKeyStatus(result.credentialConfigured ? "ok" : "missing");
			} else setSaveError(result.error ?? result.message ?? t("settings.saveFailed"));
		});
	};
	const onClearKey = () => {
		saveConfig$1({ clearKey: true }).then((result) => {
			if (alive.current && result.ok) setKeyStatus("missing");
		});
	};
	const onTest = () => {
		if (testing) return;
		setTesting(true);
		setTestResult(null);
		test().then((result) => {
			if (!alive.current) return;
			setTestResult({
				ok: result.ok,
				message: result.ok ? t("settings.test.ok") : `${t("settings.test.fail")}：${result.error ?? result.message ?? "unknown"}`
			});
			setTesting(false);
		});
	};
	const rowStyle = {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "12px",
		padding: "8px 0"
	};
	const labelStyle = {
		fontSize: "13px",
		opacity: .85,
		minWidth: "96px"
	};
	const inputStyle = {
		flex: 1,
		fontSize: "13px",
		fontFamily: "monospace",
		padding: "4px 8px",
		border: "1px solid var(--dsh-color-border, #3a3f4b)",
		borderRadius: "4px",
		background: "transparent",
		color: "inherit"
	};
	const hintStyle = {
		fontSize: "11px",
		opacity: .6,
		marginTop: "2px"
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			gap: "8px",
			padding: "12px 4px"
		},
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					fontSize: "15px",
					fontWeight: 600
				},
				children: t("settings.title")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: "2px"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: rowStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: labelStyle,
						children: t("settings.credential")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "password",
						value: credential,
						onChange: (event) => setCredential(event.target.value),
						placeholder: keyStatus === "ok" ? t("settings.credential.placeholder") : "",
						autoComplete: "off",
						"aria-label": t("settings.credential"),
						style: inputStyle
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						gap: "12px",
						marginLeft: "108px",
						alignItems: "center"
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							fontSize: "12px",
							color: keyStatus === "ok" ? "var(--dsh-color-success, #30a46c)" : keyStatus === "missing" ? "var(--dsh-color-danger, #e5484d)" : void 0
						},
						children: keyStatus === "ok" ? t("settings.credential.ok") : keyStatus === "missing" ? t("settings.credential.missing") : ""
					}), keyStatus === "ok" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onClearKey,
						style: {
							background: "none",
							border: "none",
							padding: 0,
							fontSize: "12px",
							cursor: "pointer",
							textDecoration: "underline",
							opacity: .7
						},
						children: t("settings.credential.clear")
					})]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: "2px"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: rowStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: labelStyle,
						children: t("settings.threshold")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "number",
						min: 1,
						max: 1440,
						step: 1,
						value: threshold,
						onChange: (event) => setThreshold(event.target.value),
						"aria-label": t("settings.threshold"),
						style: inputStyle
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: {
						...hintStyle,
						marginLeft: "108px"
					},
					children: t("settings.threshold.hint")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: "2px"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: rowStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: labelStyle,
						children: t("settings.repeat")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "number",
						min: 0,
						max: 1440,
						step: 1,
						value: repeat,
						onChange: (event) => setRepeat(event.target.value),
						"aria-label": t("settings.repeat"),
						style: inputStyle
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: {
						...hintStyle,
						marginLeft: "108px"
					},
					children: t("settings.repeat.hint")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: "2px"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: rowStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: labelStyle,
						children: t("settings.proxy")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						value: proxy,
						onChange: (event) => setProxy(event.target.value),
						placeholder: "http://127.0.0.1:7890",
						"aria-label": t("settings.proxy"),
						style: inputStyle
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: {
						...hintStyle,
						marginLeft: "108px"
					},
					children: t("settings.proxy.hint")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					gap: "10px",
					alignItems: "center",
					marginLeft: "108px"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: saving,
						onClick: onSave,
						style: {
							padding: "4px 14px",
							fontSize: "13px",
							cursor: saving ? "default" : "pointer",
							opacity: saving ? .55 : 1
						},
						children: t("settings.save")
					}),
					savedAt !== null && saveError === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							fontSize: "12px",
							color: "var(--dsh-color-success, #30a46c)"
						},
						children: t("settings.saved")
					}),
					saveError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							fontSize: "12px",
							color: "var(--dsh-color-danger, #e5484d)"
						},
						children: saveError
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: rowStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: testing || keyStatus !== "ok",
					onClick: onTest,
					style: {
						padding: "4px 14px",
						fontSize: "13px",
						cursor: testing || keyStatus !== "ok" ? "default" : "pointer",
						opacity: testing || keyStatus !== "ok" ? .55 : 1
					},
					children: testing ? t("settings.test.sending") : t("settings.test")
				}), testResult !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: {
						fontSize: "12px",
						color: testResult.ok ? "var(--dsh-color-success, #30a46c)" : "var(--dsh-color-danger, #e5484d)"
					},
					children: testResult.message
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: "2px"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							fontSize: "12px",
							opacity: .75
						},
						children: [
							t("settings.pending"),
							"：",
							pending.length
						]
					}),
					pending.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: "11px",
							opacity: .6
						},
						children: t("settings.pending.empty")
					}),
					pending.slice(0, 3).map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							fontSize: "11px",
							opacity: .65,
							fontFamily: "monospace"
						},
						children: [
							"[",
							item.kind,
							"] ",
							item.detail.length > 60 ? `${item.detail.slice(0, 59)}…` : item.detail
						]
					}, item.id))
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					fontSize: "11px",
					opacity: .55,
					paddingTop: "4px"
				},
				children: t("settings.sourceHint")
			})
		]
	});
}

//#endregion
//#region src/client/locales.ts
const zh = {
	"settings.label": "微信提醒 (ServerChan)",
	"settings.title": "人工确认超时微信提醒（ServerChan）",
	"settings.credential": "推送地址 / SendKey",
	"settings.credential.hint": "ServerChan 控制台的 SendKey（经典 SCT… 或 Server酱³ sctp…），或完整推送 URL；加密存储在本机，不会回显",
	"settings.credential.placeholder": "已保存（留空保持不变）",
	"settings.credential.clear": "清除已保存的凭据",
	"settings.credential.ok": "推送凭据已配置",
	"settings.credential.missing": "未配置推送凭据（在下方输入并保存）",
	"settings.threshold": "阈值（分钟）",
	"settings.threshold.hint": "超过该时长未回复即推送；1–1440 整数，默认 5",
	"settings.repeat": "重复提醒间隔（分钟）",
	"settings.repeat.hint": "仍无人回复时每隔多久再推一次；0 = 只提醒一次",
	"settings.proxy": "网络代理（可选）",
	"settings.proxy.hint": "如 http://127.0.0.1:7890，留空为直连；不支持带用户名密码的代理地址",
	"settings.save": "保存设置",
	"settings.saved": "已保存，立即生效",
	"settings.saveFailed": "保存失败",
	"settings.test": "发送测试推送",
	"settings.test.sending": "正在发送…",
	"settings.test.ok": "测试消息已发送，请查看微信",
	"settings.test.fail": "测试推送失败",
	"settings.pending": "当前等待中的交互",
	"settings.pending.empty": "暂无等待中的人工确认",
	"settings.sourceHint": "设置保存在本机 $DSH_HOME/serverchan-watchdog/，凭据用 AES-256-GCM 加密存储（与 fish-tts 同方案）。"
};
const en = {
	"settings.label": "WeChat alerts (ServerChan)",
	"settings.title": "Pending human-interaction WeChat alerts (ServerChan)",
	"settings.credential": "Push URL / SendKey",
	"settings.credential.hint": "ServerChan SendKey (SCT… or sctp…) or full push URL from the console; stored encrypted on this machine, never echoed back",
	"settings.credential.placeholder": "Saved (leave empty to keep)",
	"settings.credential.clear": "Clear saved credential",
	"settings.credential.ok": "Push credential configured",
	"settings.credential.missing": "No push credential configured (enter and save below)",
	"settings.threshold": "Threshold (minutes)",
	"settings.threshold.hint": "Push when unanswered past this; integer 1–1440, default 5",
	"settings.repeat": "Repeat interval (minutes)",
	"settings.repeat.hint": "Re-push every N minutes while still pending; 0 = once only",
	"settings.proxy": "HTTP proxy (optional)",
	"settings.proxy.hint": "e.g. http://127.0.0.1:7890, empty for direct; proxy URLs with username/password are not supported",
	"settings.save": "Save settings",
	"settings.saved": "Saved, effective immediately",
	"settings.saveFailed": "Save failed",
	"settings.test": "Send test push",
	"settings.test.sending": "Sending…",
	"settings.test.ok": "Test message sent; check WeChat",
	"settings.test.fail": "Test push failed",
	"settings.pending": "Pending interactions",
	"settings.pending.empty": "No pending human confirmation right now",
	"settings.sourceHint": "Settings live in $DSH_HOME/serverchan-watchdog/ on this machine; the credential is encrypted with AES-256-GCM (same scheme as fish-tts)."
};

//#endregion
//#region src/client/api.ts
async function readJson(response) {
	try {
		return await response.json();
	} catch {
		return {
			ok: false,
			error: `HTTP ${response.status}`
		};
	}
}
async function fetchStatus() {
	try {
		const response = await fetch("/serverchan-watchdog/status", { cache: "no-store" });
		if (!response.ok) return {
			ok: false,
			error: `HTTP ${response.status}`
		};
		return await readJson(response);
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "status fetch failed"
		};
	}
}
async function fetchConfig() {
	try {
		const response = await fetch("/serverchan-watchdog/config", { cache: "no-store" });
		if (!response.ok) return {
			ok: false,
			error: `HTTP ${response.status}`
		};
		return await readJson(response);
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "config fetch failed"
		};
	}
}
async function saveConfig(patch) {
	try {
		const response = await fetch("/serverchan-watchdog/config", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(patch)
		});
		const payload = await readJson(response);
		if (!response.ok || payload.ok !== true) return {
			ok: false,
			error: payload.error ?? payload.message ?? `HTTP ${response.status}`
		};
		return payload;
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "config save failed"
		};
	}
}
async function sendTest() {
	try {
		const response = await fetch("/serverchan-watchdog/test", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{}"
		});
		const payload = await readJson(response);
		if (!response.ok || payload.ok !== true) return {
			ok: false,
			error: payload.error ?? payload.message ?? `HTTP ${response.status}`
		};
		return payload;
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "test push failed"
		};
	}
}

//#endregion
//#region src/client/index.tsx
const NS = "serverchan-watchdog";
const inject = ["slots", "locale"];
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, {
		zh,
		en
	}), "serverchan-watchdog: dictionaries");
	let disposeSection = null;
	const mountSection = () => {
		if (disposeSection !== null) {
			disposeSection();
			disposeSection = null;
		}
		const t = ctx.locale.bind(NS);
		disposeSection = ctx.slots.register({
			name: "settings.section",
			id: NS,
			order: 60,
			label: () => t("settings.label"),
			inject: () => ({
				t,
				config: () => fetchConfig(),
				status: () => fetchStatus(),
				saveConfig: (patch) => saveConfig(patch),
				test: () => sendTest()
			})
		}, WatchdogSettings);
	};
	ctx.slots.inject("settings.section", () => {
		mountSection();
		const onLocale = ctx.on("locale/change", () => {
			mountSection();
		});
		return () => {
			onLocale();
			if (disposeSection !== null) {
				disposeSection();
				disposeSection = null;
			}
		};
	});
}

//#endregion
exports.apply = apply;
exports.inject = inject;
return module.exports; } });
//# sourceMappingURL=client.js.map