# pi-no-autowrite

Pi extension: intercepts `write`/`edit` tool calls with two modes.

> ⚠️ **Personal-use plugin.** Published solely for multi-device sync and npm publishing experimentation. No guarantees of generality.

[English](#english) | [中文](#中文)

---

<a name="english"></a>
## 🇬🇧 English

### Installation

```bash
pi install npm:pi-no-autowrite
```

### Two Modes

| | education | supervisor |
|---|---|---|
| write/edit | **Hard block**, returns guidance for AI to teach you to hand-write | **Allows**, only shows a hint suggesting delegation to sub-agent |
| system prompt | Unchanged | **Injects supervisor instructions**, telling AI it's a supervisor not an implementer |
| mindset | You want to write code yourself, AI as teacher | You want AI to do the work but don't want context polluted by large code output |

Core difference: **whether tool calls are actually blocked**. Education blocks. Supervisor always allows — it only shifts AI behavior through system prompt injection.

### Commands

```
/no-autowrite                  Toggle on/off
/no-autowrite mode <name>      Switch mode (education|supervisor), auto-enables
/no-autowrite on               Enable
/no-autowrite off              Disable
/no-autowrite status           Show status
/no-autowrite show             Show interception rules for current mode
```

### Technical Implementation

Three core mechanisms:

#### 1. `tool_call` hook — intercept write/edit

Registers `pi.on("tool_call")`, matching `toolName === "write" || "edit"`.

- **education**: returns `{ block: true, reason: "..." }`, blocking the call and instructing AI to guide the user instead
- **supervisor**: shows a `notify` hint then returns `undefined`, allowing the call

#### 2. `before_agent_start` hook — inject system prompt

Active only in supervisor mode. Before AI starts, appends supervisor role definition to `event.systemPrompt`:

- Role: **supervisor**, not implementer
- Rules: heavy coding → delegate via `Agent` tool + `run_in_background: true`
- Light tasks (TODOs, comments, config, short snippets) → write/edit directly
- Use `get_subagent_result` to retrieve results and report back

This nudges AI toward delegation rather than direct implementation — but it's **non-enforcing**, just a soft prompt-level steer.

#### 3. session entry — state persistence

Toggle state and mode are persisted via `pi.appendEntry("no-autowrite-state", { mode, enabled })` into the session file, restored from the most recent entry on next startup. State survives project switches.

### Motivation

Two conflicting needs when using pi daily:
- Sometimes you want to write code yourself — AI should only explain, not touch files
- Sometimes you want AI to go all out — but don't want the main session context flooded with code output

This plugin is the quick toggle between those two modes.

### License

MIT

---

<a name="中文"></a>
## 🇨🇳 中文

### 安装

```bash
pi install npm:pi-no-autowrite
```

### 两种模式

| | education | supervisor |
|---|---|---|
| write/edit | **硬拦截**，返回引导信息让 AI 教你手写 | **放行**，仅弹提示建议委托子 agent |
| system prompt | 不改 | **注入 supervisor 行为指引**，告诉 AI 它是监督者不是执行者 |
| 适用心态 | 想自己写代码，AI 当老师 | 想让 AI 干活但不想 context 被大段代码污染 |

两者本质区别：**是否真的阻止工具调用**。education 直接 block，supervisor 永远放行——只是通过 system prompt 改变 AI 的行为倾向。

### 命令

```
/no-autowrite                  切换开关
/no-autowrite mode <name>      切换模式（education|supervisor），自动启用
/no-autowrite on               启用
/no-autowrite off              关闭
/no-autowrite status           查看状态
/no-autowrite show             查看当前拦截规则
```

### 技术实现

三个核心机制：

#### 1. `tool_call` hook — 拦截 write/edit

注册 `pi.on("tool_call")`，匹配 `toolName === "write" || "edit"`。

- **education**：返回 `{ block: true, reason: "..." }`，阻止本次调用，并提示 AI 改为指导用户
- **supervisor**：弹出 `notify` 提醒后返回 `undefined`，放行

#### 2. `before_agent_start` hook — 注入 system prompt

仅 supervisor 模式生效。在 AI 启动前，向 `event.systemPrompt` 尾部追加 supervisor 角色定义：

- 角色：supervisor（监督者），不是 implementer
- 规则：繁重编码用 `Agent` tool + `run_in_background: true` 委托给后台子 agent
- 小东西（TODO、注释、配置、简短片段）可直接 write/edit
- 用 `get_subagent_result` 取回结果后汇报

这让 AI 在行为上更倾向委托而非亲自写——但**不强制**，只是一个 prompt 层面的软引导。

#### 3. session entry — 状态持久化

开关状态和当前模式通过 `pi.appendEntry("no-autowrite-state", { mode, enabled })` 写入 session，下次启动时从最近的 entry 恢复。切换项目后状态不丢失。

### 开发动机

日常使用 pi 时有两种矛盾需求：
- 有时想自己动手写代码，希望 AI 只解释思路不动文件
- 有时想让 AI 放开了干，但又不想主会话被代码输出撑爆 context

这个插件就是在这两种需求间切换的快捷键。

### License

MIT
