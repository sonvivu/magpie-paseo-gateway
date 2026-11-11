# Changelog

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
