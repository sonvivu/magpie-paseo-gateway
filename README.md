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

A Magpie Agent plugin that points Paseo's Claude Code and Codex providers at the local Magpie gateway, publishing Magpie's routing groups as their models.

That is all it does: two providers, groups only, no provider of its own. OpenCode is deliberately left alone (see below), Antigravity needs a hand-written config (see below), and Copilot and Pi are untouched.

## Features

- **Routing Groups, Not Every Model**: Publishes Magpie's routing groups (`group/...`) into Paseo's model picker for Claude and Codex — the curated units, so Paseo's config stays short. The same list goes to both providers, first group as the default.
- **Two Providers, One Gateway**: Claude and Codex both point at the local Magpie gateway, the way a hand-written config does. No extra provider is created.
- **Safe & Non-Destructive**: Writes only leaf keys (`env` vars and `models` lists), so each provider's `command` and other settings survive; turning the agent off restores the previous values of exactly the keys it wrote. If Magpie has no routing groups, no `models` keys are written at all.
- **Isolated Credentials**: Uses the dedicated gateway key Magpie issues for Paseo, making tracking in Magpie's usage panel effortless.

---

## Requirements

- Local [Magpie](https://usemagpie.ai) installed and running
- [Paseo](https://paseo.sh) installed and configured on the machine
- Paseo daemon and Magpie running under the same user account **and on the same machine** — the plugin points providers at `http://127.0.0.1:3425`
- `paseo` CLI command available on `PATH`

---

## Install into Magpie

### 1. Install Plugin

From npm:

```sh
magpie plugin add magpie-paseo-gateway
```

Or from GitHub:

```sh
magpie plugin add github:sonvivu/magpie-paseo-gateway
```

Or install from a local checkout:

```sh
magpie plugin add .
```

### 2. Enable in Magpie

Turn on **Paseo** on Magpie's **Agents** page.

### 3. Reload and Use in Paseo

Apply the provider configuration in Paseo:

```sh
paseo reload
```

Then start a session in Paseo with the Claude or Codex provider and pick one of your Magpie routing groups.

---

## How It Works

- **Configuration Management**: The plugin updates provider settings in `~/.paseo/config.json` (Magpie writes the keys; the plugin itself writes no files). If `PASEO_HOME` is set in the environment, Magpie expands it accordingly.
- **Claude**: `ANTHROPIC_BASE_URL` is set to the gateway address (`http://127.0.0.1:3425`, no `/v1` — Claude appends `/v1/messages` itself) and `ANTHROPIC_API_KEY` to the gateway key.
- **Codex**: `OPENAI_BASE_URL` is set to the gateway `/v1` URL and `OPENAI_API_KEY` to the gateway key.
- **Model Mapping**: Only routing groups are published, the same list for both providers, first group as the default. Groups carry no thinking options — a group fans out to several models.
- **Leaf Keys Only**: The plugin writes `env` vars and `models` lists, never whole provider objects, so a provider's `command` and other settings are untouched. OpenCode, Copilot, Pi and Antigravity are left alone.

## Why OpenCode is not wired

An earlier version tried to wire OpenCode via `OPENCODE_CONFIG_CONTENT`, but OpenCode 2.0 runs one shared background service per user and Paseo reuses it — and Paseo rejects per-agent process environment overrides on a reused server, by design: *"Custom OpenCode MCP servers or process environment require an isolated server and cannot be used with a shared OpenCode service"* (Paseo's `docs/custom-providers.md`, "OpenCode with an existing v2 server"). A Paseo-owned helper would accept the override, but it is only selected when there is no healthy registered service, i.e. only by disabling the shared service machine-wide (`opencode service set disabled true`), which would change how OpenCode behaves outside Paseo too. So the plugin does not touch OpenCode; use Claude or Codex in Paseo for Magpie, or add `magpie-gateway` to the shared OpenCode server's own `opencode.json` by hand.

## Why Antigravity is not wired

Antigravity does route through the gateway — `GEMINI_API_KEY` plus `GOOGLE_GEMINI_BASE_URL` — but env vars alone are not enough. Paseo probes the provider by running `agy models`, and the daemon's `agy` fails authentication unless it starts with Magpie's settings file, which lives at a per-machine path the plugin cannot discover (agent files run in moejs with no filesystem access). So Antigravity needs this block in `~/.paseo/config.json` by hand — adjust the paths to your machine:

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

Then `paseo reload`. Verified working 2026-11-11: the picker lists the native models (including `gemini-4-argon-high/medium/low`) alongside the `magpie/...` models.

## Security note

The gateway key Magpie issues for Paseo is written in plaintext into Paseo's local config (as `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) — the agents need the key to reach the local gateway, so this is inherent to the design, not a leak to any third party. It is a dedicated key for Paseo (revocable in Magpie) and never leaves the local machine.

## Development

Zero dependencies. Node >= 20 for the tests (the plugin itself runs in Magpie's moejs host, not Node — it must use only ES builtins plus `console`).

```sh
npm test    # node --test, 11 tests
npm run check  # node --check + tests
```

## Unverified

Nothing is left unverified at the plugin level: Claude and Codex through Magpie are live-tested (chat works). OpenCode is out of scope by design — see "Why OpenCode is not wired" above. Antigravity via the hand-written config above is live-tested too.
