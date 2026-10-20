// Builds the importable n8n workflows in workflows/ from one definition.
// Run: npm run build. The tests fail if the committed files differ from this output.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const MCP_URL = "https://mcp.layrcake.dev/mcp";
/** The Layrcake tools the agent may call. setup_sending, reply_to_thread and add_leads stay out. */
export const TOOLS = ["find_leads", "enrich", "verify_email", "create_campaign", "launch_campaign"];
export const DEFAULT_BRIEF =
  "Find 10 heads of sales at software companies in London with 20 to 200 staff and draft a short campaign about cutting time spent on lead research.";

// Plain text, not an n8n expression, so {{first_name}} reaches the model as written.
export const SYSTEM_MESSAGE = `You run outbound prospecting with the Layrcake tools. Work from the user's one-sentence brief. The message ends with the run budget and whether this is a dry run.

1. Call find_leads once. Send audience (the brief in your own words) plus at least one of titles, industries,
   locations or company_domains, and company_headcount when the brief gives a size. Use limit 10.
2. For each lead, call enrich with person.full_name and person.company_domain and want ["work_email"].
3. Call verify_email on every email you found. Keep valid and catch_all_valid. Drop the rest.
4. Call create_campaign with the kept leads (email, first_name, last_name, company_name, location) and two or
   three steps. Each email is under 90 words, plain text, written for this audience, uses {{first_name}},
   has no links and makes no claims you cannot back up. Set wait_days to 3 on later steps.
5. Call launch_campaign with the campaign_id only. It sends nothing. It returns a preview and an approval link
   that a person opens to approve. Stop there. Never send confirmation_token.

Rules:
- Every find_leads, enrich and verify_email call sends budget_credits: what is left of the run budget. Add up
  credits_charged from each result. When the budget is spent, stop and report what you have.
- Give every call an idempotency_key that is unique to that call, and reuse it only to retry the same call.
- Never guess an email address. Only verified addresses go into create_campaign. Never call a tool after
  launch_campaign.
- End every email with this sign-off line, exactly as written: [Your name]
  Never sign as yourself or with a role, and never invent a name, title or company for the sender.
- When the message says "Dry run: true", send dry_run: true on every call. Each call then returns a plan with
  the most it could cost and finds nothing. Call find_leads, then enrich and verify_email once each for a
  sample person (full_name "Sample Person", company_domain "example.com", email "sample.person@example.com"),
  then create_campaign with that one sample lead. Skip launch_campaign. Report the estimate for 10 people:
  find_leads once, enrich and verify_email ten times each.

Finish with a short report: people found, emails kept, how many were catch-all, credits spent, and the
approval link. If the sign-off line above is still the placeholder in square brackets, also say that every
email is signed with it and the sign-off must be filled in before the campaign is approved.`;

const ids = {
  trigger: "5c1f2f0e-6a43-4b4e-9d36-0d6b6c3f6a01",
  settings: "5c1f2f0e-6a43-4b4e-9d36-0d6b6c3f6a02",
  agent: "5c1f2f0e-6a43-4b4e-9d36-0d6b6c3f6a03",
  model: "5c1f2f0e-6a43-4b4e-9d36-0d6b6c3f6a04",
  mcp: "5c1f2f0e-6a43-4b4e-9d36-0d6b6c3f6a05",
};

const MODELS = {
  anthropic: {
    name: "Anthropic Chat Model",
    type: "@n8n/n8n-nodes-langchain.lmChatAnthropic",
    typeVersion: 1.6,
    parameters: { model: { __rl: true, mode: "id", value: "claude-sonnet-5-5" }, options: {} },
  },
  openrouter: {
    name: "OpenRouter Chat Model",
    type: "@n8n/n8n-nodes-langchain.lmChatOpenRouter",
    typeVersion: 1,
    parameters: { model: "anthropic/claude-sonnet-5.5", options: {} },
  },
};

export function workflow(provider) {
  const model = MODELS[provider];
  return {
    name: provider === "openrouter" ? "Layrcake prospector (OpenRouter)" : "Layrcake prospector",
    nodes: [
      {
        id: ids.trigger,
        name: "Run",
        type: "n8n-nodes-base.manualTrigger",
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      },
      {
        id: ids.settings,
        name: "Brief and budget",
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position: [220, 0],
        parameters: {
          assignments: {
            assignments: [
              { id: "a1", name: "brief", value: DEFAULT_BRIEF, type: "string" },
              { id: "a2", name: "budget", value: 100, type: "number" },
              { id: "a3", name: "dry_run", value: true, type: "boolean" },
            ],
          },
          options: {},
        },
      },
      {
        id: ids.agent,
        name: "Prospector",
        type: "@n8n/n8n-nodes-langchain.agent",
        typeVersion: 3.1,
        position: [460, 0],
        parameters: {
          promptType: "define",
          text: "={{ $json.brief }}\n\nRun budget: {{ $json.budget }} credits. Dry run: {{ $json.dry_run }}.",
          options: { systemMessage: SYSTEM_MESSAGE, maxIterations: 40 },
        },
      },
      { id: ids.model, position: [380, 220], ...model },
      {
        id: ids.mcp,
        name: "Layrcake",
        type: "@n8n/n8n-nodes-langchain.mcpClientTool",
        typeVersion: 1.4,
        position: [600, 220],
        parameters: {
          endpointUrl: MCP_URL,
          serverTransport: "httpStreamable",
          authentication: "bearerAuth",
          include: "selected",
          includeTools: TOOLS,
          options: { timeout: 120000 },
        },
      },
    ],
    connections: {
      Run: { main: [[{ node: "Brief and budget", type: "main", index: 0 }]] },
      "Brief and budget": { main: [[{ node: "Prospector", type: "main", index: 0 }]] },
      [model.name]: { ai_languageModel: [[{ node: "Prospector", type: "ai_languageModel", index: 0 }]] },
      Layrcake: { ai_tool: [[{ node: "Prospector", type: "ai_tool", index: 0 }]] },
    },
    pinData: {},
    settings: { executionOrder: "v1" },
    meta: { templateCredsSetupCompleted: false },
  };
}

export const FILES = {
  "workflows/layrcake-prospector.json": () => workflow("anthropic"),
  "workflows/layrcake-prospector-openrouter.json": () => workflow("openrouter"),
};

export const render = (value) => `${JSON.stringify(value, null, 2)}\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [path, make] of Object.entries(FILES)) {
    writeFileSync(new URL(`../${path}`, import.meta.url), render(make()));
    console.log(`wrote ${path}`);
  }
}
