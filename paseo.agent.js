// Magpie Agent plugin for Paseo (v1.0.0).
//
// Paseo is an orchestrator, not a coding agent: it launches Claude Code,
// Codex, OpenCode and friends, each speaking its own protocol. This
// plugin points Paseo's Claude Code and Codex providers at Magpie's
// local gateway, the way a user would by hand in ~/.paseo/config.json:
// - claude: ANTHROPIC_BASE_URL = gateway.url, ANTHROPIC_API_KEY = key
// - codex: OPENAI_BASE_URL = gateway.v1, OPENAI_API_KEY = key
//
// Only Magpie routing groups (model ids starting with "group/") are
// published as models. Groups are the curated routing units, and
// publishing every individual model would bloat Paseo's config and its
// picker. The same group list is used for both providers, and the
// first group is the default for each — the simplest rule that matches
// how the groups are ordered.
//
// What the plugin does NOT touch:
// - OpenCode is deliberately not wired: OpenCode 2.0 runs one shared
//   background service per user, and Paseo reuses that service — and
//   Paseo rejects per-agent process environment overrides on a reused
//   server, by design ("Custom OpenCode MCP servers or process
//   environment require an isolated server and cannot be used with a
//   shared OpenCode service"). Wiring it would break every OpenCode
//   start, so use Claude or Codex in Paseo for Magpie instead.
// - Antigravity is left to a hand-written config: it does route through
//   the gateway (GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL), but env vars
//   alone are not enough — the daemon's `agy models` still fails auth
//   unless agy starts with Magpie's --settings file, and that path is
//   per-machine, so the plugin cannot supply it. See README.
// - Copilot and Pi are untouched.
//
// Only Magpie routing groups (model ids starting with "group/") are
// published as models. Groups are the curated routing units, and
// publishing every individual model would bloat Paseo's config and its
// picker. The same group list is used for both providers, and the
// first group is the default for each — the simplest rule that matches
// how the groups are ordered.
//
// Keys are written as leaves (…env.ANTHROPIC_BASE_URL, …models), never
// as whole provider objects, so Magpie leaves the rest of each provider
// alone: a user's custom `command`, extra env vars and other settings
// survive enabling the plugin, and Magpie restores the previous values
// of exactly the keys it wrote when the plugin is switched off. If
// Magpie has no routing groups, the models keys are not written at all
// instead of wiping the user's existing model lists with empty arrays.
//
// Agent files run in moejs inside Magpie's own process, which has no
// URL, fetch or Node/Bun globals — only ES builtins plus the console
// Magpie injects. Keep this file to those.

const GROUP_PREFIX = "group/"

// Magpie names a routing group "<name> · routing group" in the models
// it hands to connect (provider.Labels: a group is told apart by that
// suffix, so a model it shares a name with stays plain). In Paseo every
// entry here is a group, so the suffix is noise in the picker — strip
// it and keep the group's own name.
const ROUTING_GROUP_SUFFIX = " · routing group"

function groupLabel(group) {
  const name = group.name || group.id
  if (name.endsWith(ROUTING_GROUP_SUFFIX)) {
    const stripped = name.slice(0, -ROUTING_GROUP_SUFFIX.length).trim()
    return stripped.length > 0 ? stripped : group.id
  }
  return name
}

// Magpie accepts an agent icon as an https URL or a data:image URI
// (internal/provider/plugin_icon.go: PluginOwnIcon). A URL keeps this
// file small and matches the Kilo/PiG agents; Magpie fetches and caches
// it, and falls back to its generic glyph while it is unavailable.
const PASEO_ICON =
  "https://raw.githubusercontent.com/sonvivu/magpie-paseo-gateway/main/icon.svg"

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0
}

function isHttpUrl(value) {
  return (
    isNonEmptyString(value) &&
    (value.startsWith("http://") || value.startsWith("https://"))
  )
}

// Routing groups only: the models Magpie passes in include every
// individual model as well as the groups, and only the groups are
// published. First entry wins on a duplicate id; anything without a
// string id is dropped.
function getGroups(models) {
  const list = Array.isArray(models) ? models : Object.values(models || {})
  const seen = new Set()
  return list.filter((model) => {
    if (!model || !isNonEmptyString(model.id)) return false
    if (!model.id.startsWith(GROUP_PREFIX)) return false
    if (seen.has(model.id)) return false
    seen.add(model.id)
    return true
  })
}

// The Paseo-side picker entries: just id, label and default, the same
// shape a hand-written config uses. No thinking options: a routing
// group fans out to several models, so per-model effort levels do not
// belong on the group.
function toPaseoGroupModels(groups) {
  return groups.map((group, index) => ({
    id: group.id,
    label: groupLabel(group),
    isDefault: index === 0,
  }))
}

export const agent = {
  id: "paseo",
  name: "Paseo",
  icon: PASEO_ICON,
  bin: "paseo",
  config: "~/.paseo/config.json",
  format: "json",
  notice:
    "Magpie pointed Paseo's Claude and Codex providers at the Magpie gateway (routing groups only). Run `paseo reload`, then pick a group when starting an agent.",
}

function validateGateway(gateway) {
  if (!gateway || typeof gateway !== "object") {
    throw new Error(
      "magpie-paseo-gateway: Magpie gateway is missing (expected { url, v1, key })",
    )
  }
  if (!isHttpUrl(gateway.url)) {
    throw new Error(
      "magpie-paseo-gateway: Magpie gateway.url is missing or not an http(s) URL (expected the gateway address, e.g. http://127.0.0.1:3425)",
    )
  }
  if (!isHttpUrl(gateway.v1)) {
    throw new Error(
      "magpie-paseo-gateway: Magpie gateway.v1 is missing or not an http(s) URL (expected the gateway /v1 URL)",
    )
  }
  if (!isNonEmptyString(gateway.key)) {
    throw new Error(
      "magpie-paseo-gateway: Magpie gateway.key is missing or empty (expected the gateway key Magpie issues for Paseo)",
    )
  }
}

export function connect({ gateway, models } = {}) {
  validateGateway(gateway)
  const groups = getGroups(models)

  const out = {
    // Claude Code appends /v1/messages itself, so its base URL is the
    // gateway address without /v1; Codex/OpenAI takes the /v1 URL.
    "agents.providers.claude.env.ANTHROPIC_BASE_URL": gateway.url,
    "agents.providers.claude.env.ANTHROPIC_API_KEY": gateway.key,
    "agents.providers.codex.env.OPENAI_BASE_URL": gateway.v1,
    "agents.providers.codex.env.OPENAI_API_KEY": gateway.key,
  }
  // No groups, no models keys: writing empty arrays would wipe the
  // user's existing model lists.
  if (groups.length > 0) {
    const picker = toPaseoGroupModels(groups)
    out["agents.providers.claude.models"] = picker
    out["agents.providers.codex.models"] = picker
  }
  return out
}
