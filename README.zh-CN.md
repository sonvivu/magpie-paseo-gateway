<p align="center">
  <img src="icon.svg" width="72" height="72" alt="Paseo Logo" />
</p>

<h1 align="center">Magpie for Paseo</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/sonvivu/magpie-paseo-gateway/blob/main/LICENSE"><img src="https://img.shields.io/github/license/sonvivu/magpie-paseo-gateway.svg?style=flat-square" alt="license" /></a>
</p>

这是一个 Magpie Agent 插件，把 Paseo 的 Claude Code 与 Codex 提供商指向本地 Magpie 网关，并把 Magpie 路由组发布为它们的模型。

仅此而已：两个提供商，只发布路由组，不创建自己的提供商。OpenCode 故意不接（见下），Antigravity 需要手工配置（见下），Copilot 与 Pi 不动。

## 特性亮点

- **只发布路由组**：把 Magpie 的路由组（`group/...`）发布到 Claude、Codex 的模型选择器中，不发布单个模型，配置文件保持简短。两个提供商共用同一份列表，默认第一个组。
- **两个提供商，共用一个网关**：Claude、Codex 都指向本地 Magpie 网关，与手写配置一致，不再创建额外的提供商。
- **无破坏还原**：只写叶子键（`env` 变量和 `models` 列表），各提供商的 `command` 等其他设置不受影响；关闭 Agent 时，Magpie 恢复这些键原来的值。没有路由组时不写 `models` 键。
- **专属凭据**：使用 Magpie 为 Paseo 分配的独立网关密钥，便于在 Magpie 用量面板单独追踪。

---

## 环境要求

- 本地已安装并启动 [Magpie](https://usemagpie.ai)
- 运行环境已安装并配置好 [Paseo](https://paseo.sh)
- Paseo 守护进程（daemon）与 Magpie 运行在同一个操作系统用户下**且在同一台机器上**——插件把提供商指向 `http://127.0.0.1:3425`
- `paseo` 命令位于当前用户的 `PATH` 环境变量中

---

## 安装到 Magpie

### 1. 安装插件

从 npm 安装：

```sh
magpie plugin add magpie-paseo-gateway
```

或从 GitHub 安装：

```sh
magpie plugin add github:sonvivu/magpie-paseo-gateway
```

或从本地 checkout 安装：

```sh
magpie plugin add .
```

### 2. 启用 Agent

在 Magpie 的 **Agents**（智能体）页面中找到 **Paseo** 并打开开关。

### 3. 重载配置并在 Paseo 中使用

在终端中重载 Paseo 配置：

```sh
paseo reload
```

随后在 Paseo 启动会话时，用 Claude 或 Codex 提供商，并选择一个 Magpie 路由组。

---

## 运作机制说明

- **配置文件管理**：该插件更新 `~/.paseo/config.json` 中的提供商配置项（由 Magpie 写入键，插件本身不写文件）。若配置了 `PASEO_HOME` 环境变量，Magpie 会自动解析对应的目标路径。
- **Claude**：`ANTHROPIC_BASE_URL` 设为网关地址（`http://127.0.0.1:3425`，不带 `/v1`——Claude 自己会加 `/v1/messages`），`ANTHROPIC_API_KEY` 设为网关密钥。
- **Codex**：`OPENAI_BASE_URL` 设为网关 `/v1` 地址，`OPENAI_API_KEY` 设为网关密钥。
- **模型映射**：只发布路由组，两个提供商共用同一份列表，每家默认第一个组。路由组不带思考档位。
- **只写叶子键**：插件只写 `env` 变量和 `models` 列表，不写整个提供商对象，因此提供商的 `command` 等设置不受影响。OpenCode、Copilot、Pi、Antigravity 不动。

## 为什么不接 OpenCode

早期版本曾用 `OPENCODE_CONFIG_CONTENT` 接 OpenCode，但 OpenCode 2.0 每个用户只跑一个共享后台服务，Paseo 会复用它——而 Paseo 明确拒绝在复用的服务上用每个 agent 的进程环境覆盖（"Custom OpenCode MCP servers or process environment require an isolated server and cannot be used with a shared OpenCode service"，见 Paseo `docs/custom-providers.md` "OpenCode with an existing v2 server"）。Paseo 自己的 helper 倒是接受这种覆盖，但只有在没有健康已注册服务时才会选用，也就是要全机器禁用共享服务（`opencode service set disabled true`），会影响 Paseo 之外的 OpenCode 使用。所以插件不碰 OpenCode；想在 Paseo 里用 Magpie 就用 Claude 或 Codex，或者手工把 `magpie-gateway` 加进共享 OpenCode 服务自己的 `opencode.json`。

## 为什么不接 Antigravity

Antigravity 确实走网关——`GEMINI_API_KEY` 加 `GOOGLE_GEMINI_BASE_URL`——但光设环境变量不够。Paseo 用 `agy models` 探测该提供商，而 daemon 跑的 `agy` 只有带上 Magpie 的 `--settings` 文件才能通过认证，那个文件在每台机器上的路径都不一样，插件发现不了（agent 文件跑在 moejs 里，没有文件系统访问权限）。所以 Antigravity 需要在 `~/.paseo/config.json` 里手工加这一段——路径按自己机器改：

```json
"antigravity": {
  "enabled": true,
  "command": ["/home/dev/.local/bin/agy", "--settings", "/home/dev/.gemini/antigravity-cli/magpie-settings.json"],
  "env": {
    "GEMINI_API_KEY": "magpie-agy",
    "GOOGLE_GEMINI_BASE_URL": "http://127.0.0.1:3425"
  }
}
```

然后 `paseo reload`。2026-11-11 已实测可用：选择器里既有原生模型（包括 `gemini-4-argon-high/medium/low`），也有 `magpie/...` 模型。

## 安全说明

Magpie 为 Paseo 分配的网关密钥会以明文写进 Paseo 的本地配置（`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`）——agent 需要密钥才能访问本地网关，这是设计使然，不是泄露给第三方。这是 Paseo 专用的密钥（可在 Magpie 里吊销），从不离开本机。

## 开发

零依赖。测试需要 Node >= 20（插件本身跑在 Magpie 的 moejs 环境里，不是 Node——只能用 ES 内置对象加 `console`）。

```sh
npm test    # node --test，11 个测试
npm run check  # node --check + 测试
```

## 未验证

插件层面已无未验证项：Claude 和 Codex 走 Magpie 已实测聊天可用。OpenCode 按设计不在范围内——见上文"为什么不接 OpenCode"。Antigravity 按上文手工配置也已实测可用。
