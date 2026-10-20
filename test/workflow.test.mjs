import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { DEFAULT_BRIEF, FILES, MCP_URL, render, SYSTEM_MESSAGE, TOOLS } from "../scripts/build.mjs";
import { CONNECTION_TYPES, NODES } from "../scripts/n8n-nodes.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

for (const [path, make] of Object.entries(FILES)) {
  describe(path, () => {
    const text = read(path);
    const wf = JSON.parse(text);
    const byName = new Map(wf.nodes.map((node) => [node.name, node]));
    const byType = (type) => wf.nodes.filter((node) => node.type === type);
    const agent = byType("@n8n/n8n-nodes-langchain.agent")[0];
    const mcp = byType("@n8n/n8n-nodes-langchain.mcpClientTool")[0];

    it("matches scripts/build.mjs (run npm run build after editing it)", () => {
      assert.equal(text, render(make()));
    });

    it("has the shape n8n imports", () => {
      assert.equal(typeof wf.name, "string");
      assert.ok(Array.isArray(wf.nodes) && wf.nodes.length > 0);
      assert.equal(typeof wf.connections, "object");
      for (const node of wf.nodes) {
        assert.match(node.id, /^[0-9a-f-]{36}$/, `${node.name}: id`);
        assert.equal(typeof node.name, "string");
        assert.ok(Array.isArray(node.position) && node.position.length === 2, `${node.name}: position`);
        assert.equal(typeof node.parameters, "object", `${node.name}: parameters`);
      }
      assert.equal(byName.size, wf.nodes.length, "node names are unique");
      assert.equal(new Set(wf.nodes.map((n) => n.id)).size, wf.nodes.length, "node ids are unique");
    });

    it("uses only current n8n node types and versions", () => {
      for (const node of wf.nodes) {
        const spec = NODES[node.type];
        assert.ok(spec, `${node.name}: unknown node type ${node.type}`);
        assert.ok(spec.versions.includes(node.typeVersion), `${node.name}: ${node.type} has no version ${node.typeVersion}`);
      }
    });

    it("wires every connection to a real node with a known type", () => {
      for (const [from, outputs] of Object.entries(wf.connections)) {
        assert.ok(byName.has(from), `connection from unknown node ${from}`);
        for (const [type, groups] of Object.entries(outputs)) {
          assert.ok(CONNECTION_TYPES.includes(type), `unknown connection type ${type}`);
          for (const target of groups.flat()) {
            assert.ok(byName.has(target.node), `connection to unknown node ${target.node}`);
            assert.equal(target.type, type);
          }
        }
      }
      const into = (type) => Object.values(wf.connections).flatMap((o) => (o[type] ?? []).flat()).filter((t) => t.node === agent.name);
      assert.equal(into("ai_languageModel").length, 1, "the agent has one model");
      assert.equal(into("ai_tool").length, 1, "the agent has the Layrcake tool");
      assert.equal(into("main").length, 1, "the agent runs after the settings node");
    });

    it("connects to the Layrcake MCP server with a bearer key and only the five tools", () => {
      assert.deepEqual(mcp.parameters, {
        endpointUrl: MCP_URL,
        serverTransport: "httpStreamable",
        authentication: "bearerAuth",
        include: "selected",
        includeTools: TOOLS,
        options: { timeout: 120000 },
      });
      for (const hidden of ["setup_sending", "reply_to_thread", "add_leads"]) assert.ok(!TOOLS.includes(hidden));
    });

    it("never ships a credential or a key", () => {
      for (const node of wf.nodes) assert.equal(node.credentials, undefined, `${node.name}: credentials are set after import`);
      assert.doesNotMatch(text, /lc_(live|test)_|Bearer [A-Za-z0-9]/);
    });

    it("starts as a dry run with the default brief and a budget", () => {
      const values = Object.fromEntries(byName.get("Brief and budget").parameters.assignments.assignments.map((a) => [a.name, a.value]));
      assert.deepEqual(values, { brief: DEFAULT_BRIEF, budget: 100, dry_run: true });
      assert.match(agent.parameters.text, /^=\{\{ \$json\.brief \}\}/);
      assert.match(agent.parameters.text, /Dry run: \{\{ \$json\.dry_run \}\}/);
    });

    it("keeps the system message out of n8n expression mode, so {{first_name}} stays literal", () => {
      const message = agent.parameters.options.systemMessage;
      assert.equal(message, SYSTEM_MESSAGE);
      assert.ok(!message.startsWith("="));
      assert.match(message, /\{\{first_name\}\}/);
      assert.match(message, /Never send confirmation_token/);
      assert.match(message, /budget_credits/);
      assert.ok(agent.parameters.options.maxIterations >= 30);
    });
  });
}
