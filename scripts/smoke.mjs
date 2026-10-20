// Free setup check. Connects to the Layrcake MCP server the way the workflow's MCP Client Tool
// node does (HTTP Streamable, Bearer key), checks that every tool the workflow selects exists,
// and runs each one as a dry run. Every call returns a plan and charges nothing. No model is called.
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MCP_URL, TOOLS } from "./build.mjs";

const key = process.env.LAYRCAKE_API_KEY;
if (!key) throw new Error("Set LAYRCAKE_API_KEY. Get a key at https://layrcake.dev/connect");

const client = new Client({ name: "starter-n8n-smoke", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL), { requestInit: { headers: { Authorization: `Bearer ${key}` } } }));

const { tools } = await client.listTools();
const names = new Set(tools.map((t) => t.name));
const missing = TOOLS.filter((name) => !names.has(name));
if (missing.length) throw new Error(`The server has no tool named: ${missing.join(", ")}`);
console.log(`Connected. The server offers all ${TOOLS.length} tools the workflow selects.`);

const run = randomUUID();
const sample = { email: "sample.person@example.com", first_name: "Sample" };
const calls = [
  ["find_leads", { audience: "Heads of sales at London software companies with 20 to 200 staff", titles: ["Head of Sales"], locations: ["London, United Kingdom"], industries: ["Software Development"], company_headcount: { min: 20, max: 200 }, limit: 10, budget_credits: 100 }],
  ["enrich", { person: { full_name: "Sample Person", company_domain: "example.com" }, want: ["work_email"], budget_credits: 100 }],
  ["verify_email", { email: sample.email, budget_credits: 100 }],
  ["create_campaign", { name: "Smoke test", leads: [sample], steps: [{ subject: "Hello", body: "Hi {{first_name}}" }] }],
];
let charged = 0;
for (const [name, args] of calls) {
  const response = await client.callTool({ name, arguments: { ...args, dry_run: true, idempotency_key: `${run}-${name}` } });
  const text = response.content?.map((block) => block.text ?? "").join("") ?? "";
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${name} failed: ${text.slice(0, 300)}`);
  }
  const plan = body.result?.plan;
  if (response.isError || !plan) throw new Error(`${name}: expected a plan, got ${text.slice(0, 300)}`);
  charged += Number(body.layrcake?.credits_charged ?? 0);
  const trips = plan.would_exceed?.length ? `, would trip: ${plan.would_exceed.join(", ")}` : "";
  console.log(`${name}: would cost up to ${plan.credits_estimate} credits${trips}`);
}
await client.close();
console.log(`\nCharged: ${charged} credits. Your key and the Layrcake MCP server work.`);
