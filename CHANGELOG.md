# Changelog

## 1.0.1 (2026-11-11)

- **Agent id renamed `paseo` → `paseo-gateway`.** Magpie now ships its
  own Paseo agent (id `paseo`, alias `getpaseo`), and Magpie drops any
  plugin agent whose id is a built-in's — 1.0.0 failed to load with
  `agent id "paseo" is magpie's own agent's`. The plugin now shows on
  the Agents page as "Paseo Gateway"; behaviour is unchanged. A test
  guards the id against Magpie's built-in `paseo` / `getpaseo`.
- **Magpie's own Paseo agent, documented.** It only appends Magpie's
  individual models to Claude's `additionalModels` — no base URL, no
  Codex, no routing groups (verified from Magpie main
  `internal/agent/paseo.go`). It writes different keys than this plugin
  (`additionalModels` vs `env` + `models`), so both can stay enabled;
  disable Magpie's own Paseo for a groups-only picker. See README.

## 1.0.0 (2026-11-11)

- **Renamed to magpie-paseo-gateway.** New name, new repository
  (`sonvivu/magpie-paseo-gateway`), first npm release. Behaviour is
  unchanged from the 0.3.2 line: Claude + Codex through the Magpie
  gateway, routing groups only, first group default, leaf keys, restore
  on disable.
- **Description rewritten.** The README, package description, plugin
  summary and agent header now say what the plugin does and does not
  do: only the claude and codex providers, only routing groups; OpenCode
  deliberately unwired (shared service), Antigravity left to a
  hand-written config (it needs Magpie's `--settings` file, which the
  plugin cannot discover), Copilot and Pi untouched.
- **Earlier history.** Releases 0.2.0–0.3.2 were developed under the
  old name; their history stays in that repository.
