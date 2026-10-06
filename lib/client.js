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
let __deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
__deepseek_ai_dsh_client_ui_primitives = __toESM(__deepseek_ai_dsh_client_ui_primitives);
let react_jsx_runtime = require("react/jsx-runtime");
react_jsx_runtime = __toESM(react_jsx_runtime);

//#region node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
function r(e) {
	var t, f, n = "";
	if ("string" == typeof e || "number" == typeof e) n += e;
	else if ("object" == typeof e) if (Array.isArray(e)) {
		var o = e.length;
		for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
	} else for (f in e) e[f] && (n && (n += " "), n += f);
	return n;
}
function clsx() {
	for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
	return n;
}
var clsx_default = clsx;

//#endregion
//#region \0watchdog-css:src/client/settings.module.css.mjs
const css = "._77qlBq_page {\n  width: 100%;\n  min-width: 0;\n  color: var(--dsw-alias-label-primary);\n  flex-direction: column;\n  gap: 16px;\n  padding-bottom: 8px;\n  font-size: 14px;\n  line-height: 22px;\n  display: flex;\n}\n\n._77qlBq_header {\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: 16px;\n  min-width: 0;\n  display: flex;\n}\n\n._77qlBq_headerText {\n  flex-direction: column;\n  gap: 4px;\n  min-width: 0;\n  display: flex;\n}\n\n._77qlBq_title {\n  margin: 0;\n  font-size: 16px;\n  font-weight: 600;\n  line-height: 24px;\n}\n\n._77qlBq_summary {\n  color: var(--dsw-alias-label-secondary);\n  margin: 0;\n  font-size: 12px;\n  line-height: 18px;\n}\n\n._77qlBq_headerControl {\n  flex: none;\n  align-items: center;\n  gap: 8px;\n  padding-top: 2px;\n  display: flex;\n}\n\n._77qlBq_switchLabel {\n  color: var(--dsw-alias-label-secondary);\n  white-space: nowrap;\n  font-size: 12px;\n  line-height: 18px;\n}\n\n._77qlBq_status {\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  display: flex;\n}\n\n._77qlBq_badgeStrong {\n  color: var(--dsw-alias-label-primary);\n}\n\n._77qlBq_card {\n  box-sizing: border-box;\n  border: .5px solid var(--dsw-alias-settings-card-stroke);\n  border-radius: var(--dsw-radius-xl);\n  background: var(--dsw-alias-settings-card-fill);\n  flex-direction: column;\n  gap: 14px;\n  min-width: 0;\n  padding: 16px;\n  display: flex;\n}\n\n._77qlBq_cardHead {\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 12px;\n  min-width: 0;\n  display: flex;\n}\n\n._77qlBq_cardTitle {\n  margin: 0;\n  font-size: 14px;\n  font-weight: 600;\n  line-height: 20px;\n}\n\n._77qlBq_cardNote {\n  color: var(--dsw-alias-label-tertiary);\n  overflow-wrap: anywhere;\n  margin: 0;\n  font-size: 12px;\n  line-height: 18px;\n}\n\n._77qlBq_field {\n  flex-direction: column;\n  gap: 6px;\n  min-width: 0;\n  display: flex;\n}\n\n._77qlBq_fieldRow {\n  flex-wrap: wrap;\n  align-items: flex-end;\n  gap: 12px;\n  min-width: 0;\n  display: flex;\n}\n\n._77qlBq_label {\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  line-height: 20px;\n}\n\n._77qlBq_hint {\n  color: var(--dsw-alias-label-tertiary);\n  overflow-wrap: anywhere;\n  margin: 0;\n  font-size: 12px;\n  line-height: 18px;\n}\n\n._77qlBq_inputNarrow {\n  flex: none;\n  width: 110px;\n}\n\n._77qlBq_mono {\n  font-family: var(--ds-font-family-code, Consolas, Menlo, Monaco, monospace);\n}\n\n._77qlBq_actions {\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  display: flex;\n}\n\n._77qlBq_actionsEnd {\n  justify-content: flex-end;\n}\n\n._77qlBq_spacer {\n  flex: 1;\n}\n\n._77qlBq_feedback {\n  overflow-wrap: anywhere;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n  font-size: 12px;\n  line-height: 18px;\n  display: flex;\n}\n\n._77qlBq_feedbackOk {\n  color: var(--dsw-alias-state-success-primary);\n}\n\n._77qlBq_feedbackError {\n  color: var(--dsw-alias-state-error-primary);\n}\n\n._77qlBq_feedbackMuted {\n  color: var(--dsw-alias-label-tertiary);\n}\n\n._77qlBq_pendingEmpty {\n  border: .5px dashed var(--dsw-alias-border-l3);\n  border-radius: var(--dsw-radius-md);\n  color: var(--dsw-alias-label-tertiary);\n  align-items: center;\n  gap: 8px;\n  padding: 12px;\n  font-size: 12px;\n  line-height: 18px;\n  display: flex;\n}\n\n._77qlBq_pendingList {\n  flex-direction: column;\n  gap: 8px;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n  display: flex;\n}\n\n._77qlBq_pendingItem {\n  box-sizing: border-box;\n  border: .5px solid var(--dsw-alias-border-l2);\n  border-radius: var(--dsw-radius-md);\n  background: var(--dsw-alias-bg-layer-2);\n  align-items: flex-start;\n  gap: 10px;\n  min-width: 0;\n  padding: 10px 12px;\n  display: flex;\n}\n\n._77qlBq_pendingBody {\n  flex-direction: column;\n  flex: 1;\n  gap: 2px;\n  min-width: 0;\n  display: flex;\n}\n\n._77qlBq_pendingDetail {\n  color: var(--dsw-alias-label-primary);\n  overflow-wrap: anywhere;\n  font-size: 13px;\n  line-height: 20px;\n}\n\n._77qlBq_pendingMeta {\n  color: var(--dsw-alias-label-tertiary);\n  overflow-wrap: anywhere;\n  font-size: 12px;\n  line-height: 18px;\n}\n\n._77qlBq_kind {\n  box-sizing: border-box;\n  border-radius: var(--dsw-radius-xs);\n  background: var(--dsw-alias-bg-layer-3);\n  height: 20px;\n  color: var(--dsw-alias-label-secondary);\n  white-space: nowrap;\n  flex: none;\n  padding: 0 8px;\n  font-size: 11px;\n  line-height: 20px;\n}\n\n._77qlBq_footer {\n  color: var(--dsw-alias-label-tertiary);\n  overflow-wrap: anywhere;\n  margin: 0;\n  font-size: 12px;\n  line-height: 18px;\n}\n";
const tagId = "dsh-serverchan-watchdog/src/client/settings.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=\"" + tagId + "\"]") === null) {
	const tag = document.createElement("style");
	tag.dataset.plugin = "dsh-serverchan-watchdog";
	tag.dataset.pluginCss = tagId;
	tag.textContent = css;
	document.head.appendChild(tag);
}
var settings_module_css_default = {
	"headerControl": "_77qlBq_headerControl",
	"summary": "_77qlBq_summary",
	"field": "_77qlBq_field",
	"label": "_77qlBq_label",
	"mono": "_77qlBq_mono",
	"header": "_77qlBq_header",
	"card": "_77qlBq_card",
	"actions": "_77qlBq_actions",
	"pendingDetail": "_77qlBq_pendingDetail",
	"spacer": "_77qlBq_spacer",
	"actionsEnd": "_77qlBq_actionsEnd",
	"footer": "_77qlBq_footer",
	"inputNarrow": "_77qlBq_inputNarrow",
	"fieldRow": "_77qlBq_fieldRow",
	"feedbackError": "_77qlBq_feedbackError",
	"page": "_77qlBq_page",
	"feedbackMuted": "_77qlBq_feedbackMuted",
	"status": "_77qlBq_status",
	"badgeStrong": "_77qlBq_badgeStrong",
	"switchLabel": "_77qlBq_switchLabel",
	"pendingList": "_77qlBq_pendingList",
	"pendingMeta": "_77qlBq_pendingMeta",
	"cardHead": "_77qlBq_cardHead",
	"cardNote": "_77qlBq_cardNote",
	"pendingEmpty": "_77qlBq_pendingEmpty",
	"feedbackOk": "_77qlBq_feedbackOk",
	"headerText": "_77qlBq_headerText",
	"title": "_77qlBq_title",
	"hint": "_77qlBq_hint",
	"pendingItem": "_77qlBq_pendingItem",
	"pendingBody": "_77qlBq_pendingBody",
	"kind": "_77qlBq_kind",
	"cardTitle": "_77qlBq_cardTitle",
	"feedback": "_77qlBq_feedback"
};

//#endregion
//#region src/client/SettingsCard.tsx
/** Interval the pending list refreshes at, matching the host's 10 s cadence. */
const POLL_MS = 1e4;
/** Host-side cap on the push title; mirrors TITLE_MAX in src/index.ts. */
const TITLE_MAX = 32;
const KINDS = {
	question: "settings.kind.question",
	"plan-review": "settings.kind.plan-review",
	approval: "settings.kind.approval"
};
/** Error codes the host returns map to localized copy; anything else is generic. */
const ERROR_KEYS = {
	"invalid-sendkey": "settings.error.invalid-sendkey",
	"invalid-proxy": "settings.error.invalid-proxy",
	"invalid-minutes": "settings.error.invalid-minutes",
	"invalid-weburl": "settings.error.invalid-weburl",
	"invalid-title": "settings.error.invalid-title"
};
function draftOf(view) {
	return {
		enabled: view.enabled !== false,
		thresholdMinutes: String(view.thresholdMinutes ?? 5),
		repeatMinutes: String(view.repeatMinutes ?? 0),
		title: view.title ?? "",
		webUrl: view.webUrl ?? "",
		proxy: view.proxy ?? ""
	};
}
/** Link mode implied by a stored URL: the desktop scheme wins when present. */
function modeOf(webUrl) {
	if (webUrl === "") return "none";
	return /^dsh:/i.test(webUrl) ? "desktop" : "custom";
}
/** Whole minutes in a stored field, or null when it is not a usable number. */
function minutesOf(raw) {
	const trimmed = raw.trim();
	if (trimmed === "") return null;
	const value = Number(trimmed);
	if (!Number.isFinite(value)) return null;
	return Math.round(value);
}
/** Compact elapsed label, switching unit at the minute and hour marks. */
function formatElapsed(ms, t) {
	const totalSeconds = Math.max(0, Math.floor(ms / 1e3));
	if (totalSeconds < 60) return t("settings.elapsed.seconds", { n: totalSeconds });
	const totalMinutes = Math.floor(totalSeconds / 60);
	if (totalMinutes < 60) return t("settings.elapsed.minutes", { n: totalMinutes });
	return t("settings.elapsed.hours", {
		h: Math.floor(totalMinutes / 60),
		m: totalMinutes % 60
	});
}
function WatchdogSettings(props) {
	const { t, config, status, saveConfig: saveConfig$1, test } = props;
	const [loaded, setLoaded] = (0, react.useState)(null);
	const [draft, setDraft] = (0, react.useState)(null);
	const [credential, setCredential] = (0, react.useState)("");
	const [hasStoredKey, setHasStoredKey] = (0, react.useState)(false);
	const [credentialConfigured, setCredentialConfigured] = (0, react.useState)(false);
	const [stateDir, setStateDir] = (0, react.useState)("");
	const [pending, setPending] = (0, react.useState)([]);
	const [loadError, setLoadError] = (0, react.useState)(null);
	const [saving, setSaving] = (0, react.useState)(false);
	const [saveError, setSaveError] = (0, react.useState)(null);
	const [savedAt, setSavedAt] = (0, react.useState)(null);
	const [testing, setTesting] = (0, react.useState)(false);
	const [testResult, setTestResult] = (0, react.useState)(null);
	/** Counter bumped once a second so pending wait times tick between polls. */
	const [tick, bumpTick] = (0, react.useReducer)((value) => value + 1, 0);
	const alive = (0, react.useRef)(true);
	(0, react.useEffect)(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);
	const adopt = (0, react.useCallback)((view) => {
		setLoaded(view);
		setDraft(draftOf(view));
		setHasStoredKey(view.hasStoredKey === true);
		setCredentialConfigured(view.credentialConfigured === true);
		if (view.stateDir !== void 0) setStateDir(view.stateDir);
	}, []);
	(0, react.useEffect)(() => {
		let cancelled = false;
		(async () => {
			const view = await config();
			if (cancelled || !alive.current) return;
			if (!view.ok) {
				setLoadError(view.error ?? t("settings.error.unknown"));
				return;
			}
			setLoadError(null);
			adopt(view);
		})();
		return () => {
			cancelled = true;
		};
	}, [
		config,
		adopt,
		t
	]);
	(0, react.useEffect)(() => {
		let cancelled = false;
		let timer;
		const refresh = () => {
			status().then((result) => {
				if (cancelled || !alive.current) return;
				if (result.ok) setPending(Array.isArray(result.pending) ? result.pending : []);
			});
		};
		refresh();
		timer = window.setInterval(refresh, POLL_MS);
		return () => {
			cancelled = true;
			if (timer !== void 0) window.clearInterval(timer);
		};
	}, [status]);
	(0, react.useEffect)(() => {
		if (pending.length === 0) return;
		const timer = window.setInterval(() => {
			bumpTick();
		}, 1e3);
		return () => {
			window.clearInterval(timer);
		};
	}, [pending.length]);
	const dirty = (0, react.useMemo)(() => {
		if (loaded === null || draft === null) return false;
		const base = draftOf(loaded);
		return credential.trim() !== "" || draft.enabled !== base.enabled || draft.thresholdMinutes !== base.thresholdMinutes || draft.repeatMinutes !== base.repeatMinutes || draft.title !== base.title || draft.webUrl !== base.webUrl || draft.proxy !== base.proxy;
	}, [
		loaded,
		draft,
		credential
	]);
	const thresholdValue = draft === null ? null : minutesOf(draft.thresholdMinutes);
	const repeatValue = draft === null ? null : minutesOf(draft.repeatMinutes);
	const thresholdInvalid = thresholdValue === null || thresholdValue < 1 || thresholdValue > 1440;
	const repeatInvalid = repeatValue === null || repeatValue < 0 || repeatValue > 1440;
	const titleInvalid = draft !== null && draft.title.trim().length > TITLE_MAX;
	const invalid = thresholdInvalid || repeatInvalid || titleInvalid;
	const onSave = () => {
		if (saving || draft === null || invalid) return;
		setSaving(true);
		setSaveError(null);
		setSavedAt(null);
		const patch = {
			enabled: draft.enabled,
			thresholdMinutes: thresholdValue ?? 5,
			repeatMinutes: repeatValue ?? 0,
			title: draft.title.trim(),
			webUrl: draft.webUrl.trim(),
			proxy: draft.proxy.trim()
		};
		const typed = credential.trim();
		if (typed !== "") patch.sendkey = typed;
		saveConfig$1(patch).then((view) => {
			if (!alive.current) return;
			setSaving(false);
			if (!view.ok) {
				setSaveError(t(ERROR_KEYS[view.error ?? ""] ?? "settings.error.unknown"));
				return;
			}
			adopt(view);
			setCredential("");
			setSavedAt(Date.now());
		});
	};
	const onClearKey = () => {
		if (saving) return;
		setSaving(true);
		setSaveError(null);
		setSavedAt(null);
		saveConfig$1({ clearKey: true }).then((view) => {
			if (!alive.current) return;
			setSaving(false);
			if (!view.ok) {
				setSaveError(t("settings.error.unknown"));
				return;
			}
			adopt(view);
			setCredential("");
			setSavedAt(Date.now());
		});
	};
	const onTest = () => {
		if (testing) return;
		setTesting(true);
		setTestResult(null);
		test().then((result) => {
			if (!alive.current) return;
			setTesting(false);
			setTestResult(result);
		});
	};
	const onReset = () => {
		if (loaded === null) return;
		setDraft(draftOf(loaded));
		setCredential("");
		setSaveError(null);
		setSavedAt(null);
	};
	if (loadError !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: settings_module_css_default.page,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: settings_module_css_default.summary,
			children: t("settings.status.unreachable")
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: clsx_default(settings_module_css_default.feedback, settings_module_css_default.feedbackError),
			role: "alert",
			children: loadError
		})]
	});
	if (draft === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: settings_module_css_default.page,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: settings_module_css_default.summary,
			children: t("settings.status.checking")
		})
	});
	const linkMode = modeOf(draft.webUrl);
	const enabledNow = draft.enabled;
	const statusTone = enabledNow ? credentialConfigured ? "success" : "warning" : "neutral";
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: settings_module_css_default.page,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
				className: settings_module_css_default.header,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_module_css_default.headerText,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: settings_module_css_default.title,
						children: t("settings.title")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_module_css_default.summary,
						children: t("settings.summary")
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_module_css_default.headerControl,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_module_css_default.switchLabel,
						"aria-hidden": "true",
						children: enabledNow ? t("settings.on") : t("settings.off")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Switch, {
						checked: enabledNow,
						disabled: saving,
						label: enabledNow ? t("settings.switch.off") : t("settings.switch.on"),
						onChange: (next) => {
							setDraft({
								...draft,
								enabled: next
							});
						}
					})]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_module_css_default.status,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Tag, {
						tone: statusTone,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_module_css_default.badgeStrong,
							children: enabledNow ? t("settings.status.ready") : t("settings.status.disabled")
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Tag, {
						tone: credentialConfigured ? "quiet" : "danger",
						children: credentialConfigured ? t("settings.credential.ok") : t("settings.status.noCredential")
					}),
					pending.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Tag, {
						tone: "info",
						children: t("settings.status.pendingCount", { count: pending.length })
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: settings_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_module_css_default.cardHead,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: settings_module_css_default.cardTitle,
						children: t("settings.card.channel")
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_module_css_default.field,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_module_css_default.label,
							htmlFor: "watchdog-credential",
							children: t("settings.credential")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Input, {
							id: "watchdog-credential",
							className: settings_module_css_default.mono,
							type: "password",
							autoComplete: "off",
							spellCheck: false,
							disabled: saving,
							value: credential,
							placeholder: hasStoredKey ? t("settings.credential.placeholder") : "SCT…",
							onChange: (event) => {
								setCredential(event.currentTarget.value);
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_module_css_default.hint,
							children: hasStoredKey ? t("settings.credential.replace") : t("settings.credential.hint")
						}),
						hasStoredKey && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_module_css_default.actions,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								variant: "outline",
								disabled: saving,
								onClick: onClearKey,
								children: t("settings.credential.clear")
							})
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: settings_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_module_css_default.cardHead,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: settings_module_css_default.cardTitle,
						children: t("settings.card.timing")
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_module_css_default.fieldRow,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_module_css_default.field,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: settings_module_css_default.label,
								htmlFor: "watchdog-threshold",
								children: t("settings.threshold")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_module_css_default.actions,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Input, {
									id: "watchdog-threshold",
									className: clsx_default(settings_module_css_default.inputNarrow),
									inputMode: "numeric",
									disabled: saving,
									"aria-invalid": thresholdInvalid,
									value: draft.thresholdMinutes,
									onChange: (event) => {
										setDraft({
											...draft,
											thresholdMinutes: event.currentTarget.value
										});
									}
								}), [
									1,
									5,
									15
								].map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Button, {
									size: "sm",
									variant: thresholdValue === value ? "primary" : "outline",
									disabled: saving,
									onClick: () => {
										setDraft({
											...draft,
											thresholdMinutes: String(value)
										});
									},
									children: t(`settings.preset.${value}`)
								}, value))]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: settings_module_css_default.hint,
								children: t("settings.threshold.hint")
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_module_css_default.field,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: settings_module_css_default.label,
								htmlFor: "watchdog-repeat",
								children: t("settings.repeat")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Input, {
								id: "watchdog-repeat",
								className: clsx_default(settings_module_css_default.inputNarrow),
								inputMode: "numeric",
								disabled: saving,
								"aria-invalid": repeatInvalid,
								value: draft.repeatMinutes,
								onChange: (event) => {
									setDraft({
										...draft,
										repeatMinutes: event.currentTarget.value
									});
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: settings_module_css_default.hint,
								children: t("settings.repeat.hint")
							})
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: settings_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_module_css_default.cardHead,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: settings_module_css_default.cardTitle,
						children: t("settings.card.message")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_module_css_default.cardNote,
						children: t("settings.pushTitle.counter", { n: draft.title.trim().length })
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_module_css_default.field,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_module_css_default.label,
							htmlFor: "watchdog-title",
							children: t("settings.pushTitle")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Input, {
							id: "watchdog-title",
							disabled: saving,
							"aria-invalid": titleInvalid,
							value: draft.title,
							placeholder: t("settings.pushTitle.placeholder"),
							onChange: (event) => {
								setDraft({
									...draft,
									title: event.currentTarget.value
								});
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_module_css_default.hint,
							children: t("settings.pushTitle.hint")
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: settings_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_module_css_default.cardHead,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: settings_module_css_default.cardTitle,
						children: t("settings.card.link")
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_module_css_default.field,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_module_css_default.label,
							children: t("settings.webUrl")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_module_css_default.actions,
							children: [
								["none", "settings.webUrl.mode.none"],
								["desktop", "settings.webUrl.mode.desktop"],
								["custom", "settings.webUrl.mode.custom"]
							].map(([mode, key]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								variant: linkMode === mode ? "primary" : "outline",
								disabled: saving,
								onClick: () => {
									if (mode === "none") setDraft({
										...draft,
										webUrl: ""
									});
									else if (mode === "desktop") setDraft({
										...draft,
										webUrl: "dsh://open"
									});
									else setDraft({
										...draft,
										webUrl: linkMode === "custom" ? draft.webUrl : ""
									});
								},
								children: t(key)
							}, mode))
						}),
						linkMode === "custom" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Input, {
							className: settings_module_css_default.mono,
							disabled: saving,
							spellCheck: false,
							value: draft.webUrl,
							placeholder: "https://…",
							"aria-label": t("settings.webUrl.custom"),
							onChange: (event) => {
								setDraft({
									...draft,
									webUrl: event.currentTarget.value
								});
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_module_css_default.hint,
							children: t("settings.webUrl.hint")
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: settings_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_module_css_default.cardHead,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: settings_module_css_default.cardTitle,
						children: t("settings.card.network")
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_module_css_default.field,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_module_css_default.label,
							htmlFor: "watchdog-proxy",
							children: t("settings.proxy")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Input, {
							id: "watchdog-proxy",
							className: settings_module_css_default.mono,
							disabled: saving,
							spellCheck: false,
							value: draft.proxy,
							placeholder: "http://127.0.0.1:7890",
							onChange: (event) => {
								setDraft({
									...draft,
									proxy: event.currentTarget.value
								});
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_module_css_default.hint,
							children: t("settings.proxy.hint")
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: settings_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_module_css_default.cardHead,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: settings_module_css_default.cardTitle,
						children: t("settings.card.pending")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_module_css_default.cardNote,
						children: t("settings.card.pending.note")
					})]
				}), pending.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_module_css_default.pendingEmpty,
					children: t("settings.pending.empty")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
					className: settings_module_css_default.pendingList,
					children: pending.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: settings_module_css_default.pendingItem,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_module_css_default.kind,
							children: t(KINDS[item.kind] ?? "settings.kind.question")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_module_css_default.pendingBody,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_module_css_default.pendingDetail,
								children: item.detail
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: settings_module_css_default.pendingMeta,
								children: [t("settings.pending.waiting", { wait: formatElapsed(Date.now() - item.startedAt, t) }), item.pushes > 0 ? ` · ${t("settings.pending.pushes", { count: item.pushes })}` : ""]
							})]
						})]
					}, item.id))
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: clsx_default(settings_module_css_default.actions, settings_module_css_default.actionsEnd),
				children: [
					saveError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: clsx_default(settings_module_css_default.feedback, settings_module_css_default.feedbackError),
						role: "alert",
						children: saveError
					}),
					saveError === null && savedAt !== null && !dirty && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: clsx_default(settings_module_css_default.feedback, settings_module_css_default.feedbackOk),
						role: "status",
						children: t("settings.saved")
					}),
					saveError === null && dirty && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: clsx_default(settings_module_css_default.feedback, settings_module_css_default.feedbackMuted),
						children: t("settings.dirty")
					}),
					testResult !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: clsx_default(settings_module_css_default.feedback, testResult.ok ? settings_module_css_default.feedbackOk : settings_module_css_default.feedbackError),
						role: "status",
						children: testResult.ok ? t("settings.test.ok") : `${t("settings.test.fail")}：${testResult.error ?? ""}`
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: settings_module_css_default.spacer }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "outline",
						disabled: testing || saving || !credentialConfigured,
						title: credentialConfigured ? void 0 : t("settings.test.needKey"),
						onClick: onTest,
						children: testing ? t("settings.test.sending") : t("settings.test")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "ghost",
						disabled: !dirty || saving,
						onClick: onReset,
						children: t("settings.reset")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						size: "sm",
						disabled: !dirty || invalid || saving,
						onClick: onSave,
						children: saving ? t("settings.saving") : t("settings.save")
					})
				]
			}),
			stateDir !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: settings_module_css_default.footer,
				children: t("settings.sourceHint", { dir: stateDir })
			})
		]
	});
}

//#endregion
//#region src/client/locales.ts
const zh = {
	"settings.label": "Server酱推送小助手",
	"settings.title": "Server酱推送小助手",
	"settings.summary": "审批、计划评审或提问长时间无人答复时，把提醒推送到手机。检测在 DSH 主机端持续运行，关掉浏览器也不影响。",
	"settings.on": "已开启",
	"settings.off": "已暂停",
	"settings.switch.on": "开启超时提醒",
	"settings.switch.off": "暂停超时提醒",
	"settings.card.channel": "推送通道",
	"settings.card.channel.note": "凭据加密保存在本机，保存后不再回显。",
	"settings.credential": "推送地址 / SendKey",
	"settings.credential.hint": "Server酱控制台的 SendKey（经典 SCT… 或 Server酱³ sctp…），也可直接填完整推送 URL。",
	"settings.credential.placeholder": "已保存（留空保持不变）",
	"settings.credential.replace": "输入新的 SendKey 可覆盖已保存的凭据",
	"settings.credential.clear": "清除凭据",
	"settings.credential.ok": "凭据已配置",
	"settings.credential.missing": "尚未配置凭据",
	"settings.card.timing": "提醒时机",
	"settings.card.timing.note": "阈值对新开始的等待生效；重复间隔立即生效。",
	"settings.threshold": "多久没回复就提醒",
	"settings.threshold.hint": "1–1440 分钟，默认 5 分钟。",
	"settings.repeat": "仍无回复时重复提醒",
	"settings.repeat.hint": "0 = 只提醒一次；超过 1440 分钟按 1440 计。",
	"settings.preset.1": "1 分钟",
	"settings.preset.5": "5 分钟",
	"settings.preset.15": "15 分钟",
	"settings.minutes": "分钟",
	"settings.card.message": "提醒内容",
	"settings.card.message.note": "推送标题前缀；重复提醒会自动追加「第 N 次」。",
	"settings.pushTitle": "推送标题",
	"settings.pushTitle.hint": "留空使用默认标题「DSH 等待人工确认」。",
	"settings.pushTitle.placeholder": "DSH 等待人工确认",
	"settings.pushTitle.counter": "{n}/32",
	"settings.card.link": "点击跳转",
	"settings.card.link.note": "手机点开推送后跳到哪里。",
	"settings.webUrl": "跳转方式",
	"settings.webUrl.hint": "dsh://open 会唤起桌面客户端；自定义地址需手机能访问（127.0.0.1 指向手机自己）。",
	"settings.webUrl.mode.none": "不带链接",
	"settings.webUrl.mode.desktop": "唤起桌面端",
	"settings.webUrl.mode.custom": "自定义地址",
	"settings.webUrl.custom": "自定义跳转地址",
	"settings.card.network": "网络",
	"settings.card.network.note": "推送请求经过的代理；留空为直连。",
	"settings.proxy": "网络代理",
	"settings.proxy.hint": "例如 http://127.0.0.1:7890；不支持带用户名密码的代理。",
	"settings.card.pending": "等待中的确认",
	"settings.card.pending.note": "实时来自主机端；此页每 10 秒自动刷新。",
	"settings.pending": "当前等待中的交互",
	"settings.pending.empty": "暂无等待中的人工确认",
	"settings.pending.waiting": "已等待 {wait}",
	"settings.pending.pushes": "已提醒 {count} 次",
	"settings.pending.next": "将于约 {mins} 分钟后提醒",
	"settings.pending.next.none": "等待时长已超过阈值",
	"settings.pending.refresh": "刷新",
	"settings.elapsed.seconds": "{n} 秒",
	"settings.elapsed.minutes": "{n} 分钟",
	"settings.elapsed.hours": "{h} 小时 {m} 分钟",
	"settings.kind.question": "提问",
	"settings.kind.plan-review": "计划评审",
	"settings.kind.approval": "审批",
	"settings.save": "保存设置",
	"settings.saving": "正在保存…",
	"settings.saved": "已保存",
	"settings.dirty": "有未保存的修改",
	"settings.saveFailed": "保存失败",
	"settings.reset": "放弃修改",
	"settings.test": "发送测试推送",
	"settings.test.sending": "正在发送…",
	"settings.test.ok": "测试消息已发出，请查看微信",
	"settings.test.fail": "测试推送失败",
	"settings.test.needKey": "请先保存 SendKey 再发送测试",
	"settings.status.checking": "正在读取状态…",
	"settings.status.disabled": "提醒已暂停",
	"settings.status.ready": "监控运行中",
	"settings.status.noCredential": "缺少推送凭据",
	"settings.status.unreachable": "无法连接主机端",
	"settings.status.pendingCount": "{count} 项等待中",
	"settings.sourceHint": "状态保存在本机 {dir}，凭据用 AES-256-GCM（本机密钥）加密，永不回显。",
	"settings.error.invalid-sendkey": "SendKey 格式无法识别，请检查是否复制完整",
	"settings.error.invalid-proxy": "代理地址无效：仅支持不带用户名密码的 http(s) 地址",
	"settings.error.invalid-minutes": "请输入 0–1440 的整数分钟",
	"settings.error.invalid-weburl": "跳转地址无效：仅支持 http(s) 或 dsh://",
	"settings.error.invalid-title": "推送标题最多 32 个字符",
	"settings.error.unknown": "保存失败，请查看主机端日志"
};
const en = {
	"settings.label": "ServerChan mobile alerts",
	"settings.title": "ServerChan mobile alerts",
	"settings.summary": "Push a phone alert when an approval, plan review, or question stays unanswered. Detection runs on the DSH host, so closing the browser changes nothing.",
	"settings.on": "On",
	"settings.off": "Paused",
	"settings.switch.on": "Enable timeout alerts",
	"settings.switch.off": "Pause timeout alerts",
	"settings.card.channel": "Push channel",
	"settings.card.channel.note": "The credential is stored encrypted on this machine and is never echoed back.",
	"settings.credential": "Push URL / SendKey",
	"settings.credential.hint": "ServerChan SendKey (SCT… or sctp…) from the console, or a full push URL.",
	"settings.credential.placeholder": "Saved (leave empty to keep)",
	"settings.credential.replace": "Enter a new SendKey to replace the stored credential",
	"settings.credential.clear": "Clear credential",
	"settings.credential.ok": "Credential configured",
	"settings.credential.missing": "No credential configured",
	"settings.card.timing": "When to alert",
	"settings.card.timing.note": "The threshold applies to new waits; the repeat interval applies immediately.",
	"settings.threshold": "Alert after no reply for",
	"settings.threshold.hint": "1–1440 minutes; default 5.",
	"settings.repeat": "Repeat while still unanswered",
	"settings.repeat.hint": "0 = alert once; values above 1440 are treated as 1440.",
	"settings.preset.1": "1 min",
	"settings.preset.5": "5 min",
	"settings.preset.15": "15 min",
	"settings.minutes": "min",
	"settings.card.message": "Alert content",
	"settings.card.message.note": "Title prefix for the push; repeats append “第 N 次” automatically.",
	"settings.pushTitle": "Push title",
	"settings.pushTitle.hint": "Leave empty for the default title “DSH 等待人工确认”.",
	"settings.pushTitle.placeholder": "DSH 等待人工确认",
	"settings.pushTitle.counter": "{n}/32",
	"settings.card.link": "Tap-through",
	"settings.card.link.note": "Where the phone lands after tapping the push.",
	"settings.webUrl": "Link type",
	"settings.webUrl.hint": "dsh://open raises the desktop client; a custom address must be reachable from the phone (127.0.0.1 is the phone itself).",
	"settings.webUrl.mode.none": "No link",
	"settings.webUrl.mode.desktop": "Open desktop app",
	"settings.webUrl.mode.custom": "Custom address",
	"settings.webUrl.custom": "Custom jump address",
	"settings.card.network": "Network",
	"settings.card.network.note": "Proxy used for the push request; empty means direct.",
	"settings.proxy": "HTTP proxy",
	"settings.proxy.hint": "For example http://127.0.0.1:7890; proxy URLs with username/password are not supported.",
	"settings.card.pending": "Pending confirmations",
	"settings.card.pending.note": "Read live from the host; this page refreshes every 10 seconds.",
	"settings.pending": "Pending interactions",
	"settings.pending.empty": "No pending human confirmation right now",
	"settings.pending.waiting": "Waiting {wait}",
	"settings.pending.pushes": "Alerted {count} times",
	"settings.pending.next": "Alerts in about {mins} min",
	"settings.pending.next.none": "Past the threshold",
	"settings.pending.refresh": "Refresh",
	"settings.elapsed.seconds": "{n}s",
	"settings.elapsed.minutes": "{n} min",
	"settings.elapsed.hours": "{h} h {m} min",
	"settings.kind.question": "Question",
	"settings.kind.plan-review": "Plan review",
	"settings.kind.approval": "Approval",
	"settings.save": "Save settings",
	"settings.saving": "Saving…",
	"settings.saved": "Saved",
	"settings.dirty": "Unsaved changes",
	"settings.saveFailed": "Save failed",
	"settings.reset": "Discard changes",
	"settings.test": "Send test push",
	"settings.test.sending": "Sending…",
	"settings.test.ok": "Test message sent; check your phone",
	"settings.test.fail": "Test push failed",
	"settings.test.needKey": "Save a SendKey before sending a test",
	"settings.status.checking": "Reading status…",
	"settings.status.disabled": "Alerts paused",
	"settings.status.ready": "Watching for replies",
	"settings.status.noCredential": "No push credential",
	"settings.status.unreachable": "Cannot reach the host",
	"settings.status.pendingCount": "{count} waiting",
	"settings.sourceHint": "State lives in {dir} on this machine; the credential is encrypted with AES-256-GCM under a per-machine key and is never echoed back.",
	"settings.error.invalid-sendkey": "That SendKey could not be recognized; check that it was copied completely",
	"settings.error.invalid-proxy": "Invalid proxy: only http(s) addresses without username/password are supported",
	"settings.error.invalid-minutes": "Enter a whole number of minutes between 0 and 1440",
	"settings.error.invalid-weburl": "Invalid link: only http(s) or dsh:// is supported",
	"settings.error.invalid-title": "The push title may be at most 32 characters",
	"settings.error.unknown": "Save failed; check the host log"
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
function failureOf(payload, response) {
	return payload.error ?? payload.message ?? `HTTP ${response.status}`;
}
async function getJson(path) {
	try {
		const response = await fetch(path, { cache: "no-store" });
		const payload = await readJson(response);
		if (!response.ok) return {
			...payload,
			ok: false,
			error: failureOf(payload, response)
		};
		return payload;
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "request failed"
		};
	}
}
/** Read the live status: effective settings plus the pending list. */
function fetchStatus() {
	return getJson("/serverchan-watchdog/status");
}
/** Read the editable settings; never returns the credential. */
function fetchConfig() {
	return getJson("/serverchan-watchdog/config");
}
/** Write a settings patch and read back the effective values. */
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
			error: failureOf(payload, response)
		};
		return payload;
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "config save failed"
		};
	}
}
/** Send one test push with the settings currently stored on the host. */
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
			error: failureOf(payload, response)
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
//#region src/client/nav-icon.ts
/** Every localized spelling of this section's nav label. */
const NAV_LABELS = new Set([zh["settings.label"], en["settings.label"]]);
/** Panel root that only exists while the settings dialog is open. */
const DIALOG_SELECTOR = "[role=\"dialog\"]";
const NAV_ICON_INNER = "<path d=\"M8 2.25a3.75 3.75 0 0 0-3.75 3.75v2.5L3.25 11h9.5L11.75 8.5V6A3.75 3.75 0 0 0 8 2.25z\"/><path d=\"M6.75 13.25a1.25 1.25 0 0 0 2.5 0\"/>";
function decorateSettingsNavIcon(ctx) {
	ctx.effect(() => {
		const decorate = () => {
			const dialog = document.querySelector(DIALOG_SELECTOR);
			if (dialog === null) return;
			for (const button of Array.from(dialog.querySelectorAll("button"))) {
				const label = button.querySelector(":scope > span");
				if (label === null || !NAV_LABELS.has(label.textContent ?? "")) continue;
				const existing = button.firstElementChild;
				if (!(existing instanceof SVGElement) || existing.dataset["navIcon"] === "1") continue;
				const template = document.createElement("template");
				template.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-nav-icon="1">${NAV_ICON_INNER}</svg>`;
				existing.replaceWith(template.content.firstElementChild);
			}
		};
		const observer = new MutationObserver(() => decorate());
		observer.observe(document.body, {
			childList: true,
			subtree: true
		});
		decorate();
		return () => observer.disconnect();
	}, "serverchan-watchdog: nav icon decoration");
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
	decorateSettingsNavIcon(ctx);
}

//#endregion
exports.apply = apply;
exports.inject = inject;
return module.exports; } });
//# sourceMappingURL=client.js.map