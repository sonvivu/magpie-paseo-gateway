import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { agent, connect } from "../paseo.agent.js"

describe("package.json display fields", () => {
  // Agent files run in moejs inside Magpie's process, not Node/Bun:
  // the runtime has no URL, fetch, process, Buffer or require — only
  // ES builtins plus the console Magpie injects. v0.2.0 used the URL
  // constructor in validateGateway, which threw in moejs and made
  // every enable fail; guard the source against any host-only global
  // coming back.
  it("uses no global outside moejs (no URL/fetch/process/Buffer/require)", () => {
    const src = readFileSync(
      new URL("../paseo.agent.js", import.meta.url),
      "utf-8",
    )
    for (const banned of [
      "new URL(",
      "fetch(",
      "process.",
      "Buffer.",
      "require(",
    ]) {
      assert.ok(!src.includes(banned), `source must not use ${banned}`)
    }
  })

  // Magpie's Plugins row takes its title from the registry listing, else
  // package.json's magpie.name, else the package name; v0.2.0 had no
  // magpie.name, so the row showed "magpie-paseo-gateway".
  it("declares magpie.name, magpie.summary and an https magpie.icon", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
    )
    assert.equal(pkg.magpie.name, "Paseo")
    assert.match(pkg.magpie.icon, /^https:\/\//)
    assert.equal(typeof pkg.magpie.summary.en, "string")
    assert.ok(pkg.magpie.summary.en.length > 0)
    assert.ok(pkg.magpie.summary.en.length <= 300)
    assert.ok(pkg.magpie.summary.zh.length <= 300)
  })
})

describe("agent descriptor", () => {
  it("exports the Magpie agent shape", () => {
    assert.equal(agent.id, "paseo")
    assert.equal(agent.bin, "paseo")
    assert.equal(agent.config, "~/.paseo/config.json")
    assert.equal(agent.format, "json")
    // Magpie only accepts an https URL or a data:image URI for an agent
    // icon; a URL keeps the icon out of the code.
    assert.match(agent.icon, /^https:\/\//)
  })
})

const GATEWAY = {
  url: "http://127.0.0.1:3425",
  v1: "http://127.0.0.1:3425/v1",
  key: "test-key",
}
const MODELS = [
  { id: "group/claude-coding", name: "Claude Coding" },
  { id: "group/openai-coding", name: "OpenAI Coding" },
  { id: "openai/gpt-5", name: "GPT-5", context: 400000, output: 32000 },
  { id: "deepseek/deepseek-chat", name: "DeepSeek Chat" },
]

describe("connect() happy path (claude + codex only, groups only)", () => {
  it("writes leaf keys for claude and codex — never whole provider objects", () => {
    const result = connect({ gateway: GATEWAY, models: MODELS })
    // Leaf keys only: a whole-provider object would wipe the user's
    // `command` and other settings while the plugin is enabled.
    assert.deepEqual(Object.keys(result).sort(), [
      "agents.providers.claude.env.ANTHROPIC_API_KEY",
      "agents.providers.claude.env.ANTHROPIC_BASE_URL",
      "agents.providers.claude.models",
      "agents.providers.codex.env.OPENAI_API_KEY",
      "agents.providers.codex.env.OPENAI_BASE_URL",
      "agents.providers.codex.models",
    ])
    assert.ok(!("agents.providers.claude" in result))
    assert.ok(!("agents.providers.magpie-opencode" in result))
  })

  it("writes nothing for opencode", () => {
    // v0.3.0 wired OpenCode via OPENCODE_CONFIG_CONTENT, but Paseo
    // rejects per-agent process env overrides on its reused OpenCode
    // v2 shared service, so that key made every OpenCode start fail.
    // The plugin leaves OpenCode alone instead of shipping a broken
    // provider; see docs/custom-providers.md in Paseo.
    const result = connect({ gateway: GATEWAY, models: MODELS })
    assert.ok(
      Object.keys(result).every(
        (k) => !k.startsWith("agents.providers.opencode"),
      ),
    )
    assert.ok(!JSON.stringify(result).includes("OPENCODE_CONFIG_CONTENT"))
  })

  it("points claude at the bare gateway URL and codex at the /v1 URL", () => {
    const result = connect({ gateway: GATEWAY, models: MODELS })
    assert.equal(
      result["agents.providers.claude.env.ANTHROPIC_BASE_URL"],
      "http://127.0.0.1:3425",
    )
    assert.equal(
      result["agents.providers.claude.env.ANTHROPIC_API_KEY"],
      "test-key",
    )
    assert.equal(
      result["agents.providers.codex.env.OPENAI_BASE_URL"],
      "http://127.0.0.1:3425/v1",
    )
    assert.equal(
      result["agents.providers.codex.env.OPENAI_API_KEY"],
      "test-key",
    )
  })

  it("publishes only routing groups, first group default everywhere", () => {
    const result = connect({ gateway: GATEWAY, models: MODELS })
    const want = [
      { id: "group/claude-coding", label: "Claude Coding", isDefault: true },
      { id: "group/openai-coding", label: "OpenAI Coding", isDefault: false },
    ]
    assert.deepEqual(result["agents.providers.claude.models"], want)
    assert.deepEqual(result["agents.providers.codex.models"], want)
  })

  it("strips Magpie's ' · routing group' suffix from group labels", () => {
    // Magpie hands connect a group's name as "<name> · routing group"
    // (provider.Labels, to tell it apart from a model of the same name).
    // Every entry in Paseo is a group, so the suffix is noise.
    const result = connect({
      gateway: GATEWAY,
      models: [
        { id: "group/flagship-model", name: "flagship-model · routing group" },
        { id: "group/plain", name: "Plain Name" },
        { id: "group/bare", name: " · routing group" },
        { id: "group/noname" },
      ],
    })
    assert.deepEqual(result["agents.providers.claude.models"], [
      { id: "group/flagship-model", label: "flagship-model", isDefault: true },
      { id: "group/plain", label: "Plain Name", isDefault: false },
      { id: "group/bare", label: "group/bare", isDefault: false },
      { id: "group/noname", label: "group/noname", isDefault: false },
    ])
  })

  it("accepts models as an object map and drops duplicate groups", () => {
    const result = connect({
      gateway: GATEWAY,
      models: {
        a: MODELS[0],
        b: MODELS[0],
        c: { name: "No id" },
        d: MODELS[1],
      },
    })
    assert.equal(result["agents.providers.claude.models"].length, 2)
    assert.equal(
      result["agents.providers.claude.models"][0].id,
      "group/claude-coding",
    )
  })

  it("writes env keys but no models keys when Magpie has no groups", () => {
    const result = connect({
      gateway: GATEWAY,
      models: [MODELS[2], MODELS[3]],
    })
    assert.equal(
      result["agents.providers.claude.env.ANTHROPIC_BASE_URL"],
      GATEWAY.url,
    )
    assert.ok(!("agents.providers.claude.models" in result))
    assert.ok(!("agents.providers.codex.models" in result))
  })
})

describe("connect() gateway validation", () => {
  it("throws a named error when the gateway is missing or incomplete", () => {
    assert.throws(() => connect({}), /gateway is missing/)
    assert.throws(() => connect(), /gateway is missing/)
    assert.throws(
      () => connect({ gateway: { v1: GATEWAY.v1, key: "k" } }),
      /gateway\.url/,
    )
    assert.throws(
      () => connect({ gateway: { url: GATEWAY.url, key: "k" } }),
      /gateway\.v1/,
    )
    assert.throws(
      () =>
        connect({
          gateway: { url: GATEWAY.url, v1: GATEWAY.v1, key: "" },
        }),
      /gateway\.key/,
    )
    assert.throws(
      () =>
        connect({
          gateway: { url: "ftp://x", v1: GATEWAY.v1, key: "k" },
        }),
      /gateway\.url/,
    )
    assert.throws(
      () =>
        connect({
          gateway: { url: GATEWAY.url, v1: "not-a-url", key: "k" },
        }),
      /gateway\.v1/,
    )
  })
})
