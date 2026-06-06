/**
 * No-Autowrite Hook — 自动写代码拦截器，双模式
 *
 * education 模式（原教育模式）:
 *   拦截 write/edit，引导用户手写代码，适合学习场景
 *
 * supervisor 模式（监督者模式）:
 *   拦截 write/edit，指示主 agent 委托给后台子 agent
 *   （Agent tool + run_in_background），
 *   主 agent 只做监督+协调，context 保持干净
 *
 * 命令：
 *   /no-autowrite               — 切换开关（当前模式）
 *   /no-autowrite mode <name>   — 切换模式（education|supervisor），自动启用
 *   /no-autowrite on            — 启用当前模式
 *   /no-autowrite off           — 关闭
 *   /no-autowrite status        — 查看状态
 *   /no-autowrite show          — 查看当前拦截规则详情
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

const STATE_ENTRY_TYPE = "no-autowrite-state";

type Mode = "education" | "supervisor";
const ALL_MODES: Mode[] = ["education", "supervisor"];

export default function (pi: ExtensionAPI) {
	// ── 状态 ──────────────────────────────────────────────
	let currentMode: Mode = "education";
	let enabled = false;

	// 从 session 恢复
	function restoreState(ctx: any) {
		currentMode = "education";
		enabled = false;
		const entries = ctx.sessionManager.getEntries();
		for (let i = entries.length - 1; i >= 0; i--) {
			const entry = entries[i];
			if (entry.type === "custom" && entry.customType === STATE_ENTRY_TYPE) {
				const d = entry.data as { mode?: Mode; enabled?: boolean } | undefined;
				if (d) {
					if (d.mode && ALL_MODES.includes(d.mode)) currentMode = d.mode;
					enabled = d.enabled ?? false;
				}
				break;
			}
		}
		updateStatus(ctx);
	}

	function persistState(ctx: any) {
		pi.appendEntry(STATE_ENTRY_TYPE, { mode: currentMode, enabled });
		updateStatus(ctx);
	}

	function updateStatus(ctx: any) {
		if (enabled) {
			const label = currentMode === "education" ? "⛔教育" : "🤖监督";
			ctx.ui.setStatus("no-autowrite", `${label} ON`);
		} else {
			ctx.ui.setStatus("no-autowrite", undefined);
		}
	}

	// 恢复 session 状态
	pi.on("session_start", async (_event, ctx) => {
		restoreState(ctx);
	});

	// ── 命令 ──────────────────────────────────────────────
pi.registerCommand("no-autowrite", {
		description:
			"管理自动写代码拦截。用法: /no-autowrite [mode|on|off|status|show]",
		getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
			// `value` 替换整个 prefix，子命令 value 要带上前缀
			const trimmed = prefix.trimStart();

			// mode 子命令: /no-autowrite mode <education|supervisor>
			if (trimmed === "mode" || trimmed.startsWith("mode ")) {
				const afterMode = trimmed.startsWith("mode ") ? trimmed.slice(5) : "";
				return ["education", "supervisor"]
					.filter(v => v.startsWith(afterMode))
					.map(v => ({ value: "mode " + v, label: v }));
			}

			// 已知子命令：不再补后续
			if (["on", "off", "status", "show"].some(c => trimmed === c || trimmed.startsWith(c + " "))) {
				return null;
			}

			// 未到空格 — 补根命令
			if (!trimmed.includes(" ")) {
				const cmds = ["mode", "on", "off", "status", "show"];
				return cmds
					.filter(c => c.startsWith(trimmed))
					.map(c => ({ value: c, label: c }));
			}

			return null;
		},
		handler: async (args, ctx) => {
			const parts = (args ?? "").trim().split(/\s+/);
			const cmd = parts[0]?.toLowerCase();

			if (cmd === "mode") {
				const modeArg = parts[1]?.toLowerCase();
				if (modeArg === "education" || modeArg === "supervisor") {
					currentMode = modeArg;
					enabled = true;
					persistState(ctx);
					const label =
						currentMode === "education" ? "教育模式" : "监督者模式";
					ctx.ui.notify(`✅ 已切换到 ${label}，已启用`, "info");
				} else {
					ctx.ui.notify(
						`当前模式: ${currentMode}\n可用: education, supervisor`,
						"info"
					);
				}
				return;
			}

			if (cmd === "on") {
				enabled = true;
				persistState(ctx);
				ctx.ui.notify(`✅ no-autowrite 已启用 (${currentMode})`, "info");
				return;
			}

			if (cmd === "off") {
				enabled = false;
				persistState(ctx);
				ctx.ui.notify("✅ no-autowrite 已关闭", "info");
				return;
			}

			if (cmd === "status") {
				const label =
					currentMode === "education" ? "教育模式" : "监督者模式";
				ctx.ui.notify(
					`状态: ${enabled ? "🟢 已启用" : "⚪ 已关闭"}\n模式: ${label}`,
					"info"
				);
				return;
			}

			if (cmd === "show") {
				if (!enabled) {
					ctx.ui.notify("no-autowrite 未启用", "info");
					return;
				}
				if (currentMode === "education") {
					ctx.ui.notify(
						"⛔ 教育模式：拦截 write/edit，引导用户手写。\n" +
							"你应解释要写什么、在哪写、注意事项，提供代码片段供用户手动输入。",
						"info"
					);
				} else {
					ctx.ui.notify(
						"🤖 监督者模式：你（主 agent）是 supervisor。\n" +
							"不要自己 write/edit，用 Agent tool + run_in_background: true 委托给后台子 agent。\n" +
							"你保持与用户对话，用 get_subagent_result 检查结果后汇报。",
						"info"
					);
				}
				return;
			}

			// 默认 toggle
			enabled = !enabled;
			persistState(ctx);
			if (enabled) {
				ctx.ui.notify(`⛔ no-autowrite 已启用 (${currentMode})`, "warning");
			} else {
				ctx.ui.notify("✅ no-autowrite 已关闭", "info");
			}
		},
	});

	// ── 系统提示注入（supervisor 模式用）────────────────────
	pi.on("before_agent_start", async (event, ctx) => {
		if (!enabled || currentMode !== "supervisor") return;

		// 在 system prompt 尾部附加 supervisor 行为指引
		return {
			systemPrompt:
				event.systemPrompt +
				"\n\n" +
				[
				"## 🤖 Supervisor 模式（你当前处于监督者模式）",
				"",
				"你的角色是 supervisor（监督者），不是 implementer。",
				"",
				"**规则：**",
				"- 繁重编码 → 用 `Agent` tool + `run_in_background: true` 委托给后台子 agent。",
				"  - 设置 `description` 简短描述任务，必要时 `inherit_context: true`。",
				"- 小东西（TODO、plan、注释、配置、简短片段）→ 直接 write/edit 没问题。",
				"- 子 agent 执行期间，你继续与用户讨论、审查计划、分析需求。",
				"- 用 `get_subagent_result` 取回结果，审查后汇报给用户。",
				"- 用户始终与你对话，子 agent 对你不可见。",
				"",
				"**为什么这样好：**",
				"- 主 agent context 保持干净，不会被大段代码输出冲散。",
				"- 用户得到即时响应，不用干等编码完成。",
				"- 子 agent 可以在后台并行执行多个独立任务。",
			].join("\n"),
		};
	});

	// ── 工具调用拦截 ──────────────────────────────────────
	pi.on("tool_call", async (event, ctx) => {
		if (!enabled) return undefined;
		if (event.toolName !== "write" && event.toolName !== "edit") {
			return undefined;
		}

		// 通知用户
		if (ctx.hasUI) {
			const label = currentMode === "education" ? "教育" : "监督";
			ctx.ui.notify(
				`⛔ no-autowrite (${label}) 已拦截 ${event.toolName}`,
				"warning"
			);
		}

		if (currentMode === "education") {
			return {
				block: true,
				reason: [
					`## ⛔ 禁止自动写入代码（教育模式已启用）`,
					``,
					`你对 \`${event.toolName}\` 的调用已被 no-autowrite hook 拦截。`,
					``,
					`**规则：不要直接帮用户写代码。**`,
					`- 你应当引导用户自己手写代码，而不是用 \`write\`/\`edit\` 代劳。`,
					`- 向用户解释需要写什么、写在哪里、需要注意什么。`,
					`- 提供清晰的指导、代码片段示例（供用户手动输入）、架构建议。`,
					`- 如果用户明确要求你写，你应提醒用户手动完成。`,
					``,
					`**请立即停止本次 tool call，转而指导用户。**`,
					``,
					`---`,
					`提示：用户可输入 \`/no-autowrite off\` 关闭，或 \`/no-autowrite mode supervisor\` 切换到监督者模式。`,
				].join("\n"),
			};
		}

		// supervisor 模式 — 软提示，不硬拦截
		// 只是提醒，小东西让主 agent 自己写
		ctx.ui.notify(
			`🤖 supervisor 提示: ${event.toolName} 较大? 考虑用 Agent tool 委托给后台子 agent`,
		);
		return undefined; // 放行
	});
}
