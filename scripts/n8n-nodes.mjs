// The n8n node types the workflows use, with the versions and parameter names they accept.
// Checked against n8n-io/n8n master at 7a334e3 (2026-10-20). `npm run check-live` re-checks against today's master.
export const N8N_COMMIT = "7a334e3b1545c236bebd5c878da5a62444aecc72";

const LANGCHAIN = "packages/@n8n/nodes-langchain/nodes";
export const NODES = {
  "n8n-nodes-base.manualTrigger": { versions: [1], source: "packages/nodes-base/nodes/ManualTrigger/ManualTrigger.node.ts", params: [] },
  "n8n-nodes-base.set": { versions: [3.3, 3.4, 3.5], source: "packages/nodes-base/nodes/Set/Set.node.ts", params: [] },
  "@n8n/n8n-nodes-langchain.agent": { versions: [3, 3.1], source: `${LANGCHAIN}/agents/Agent/Agent.node.ts`, params: [], extra: { source: "packages/@n8n/nodes-langchain/utils/descriptions.ts", params: ["promptType", "text"] } },
  "@n8n/n8n-nodes-langchain.lmChatAnthropic": { versions: [1.6], source: `${LANGCHAIN}/llms/LMChatAnthropic/LmChatAnthropic.node.ts`, params: ["model"], credential: "anthropicApi" },
  "@n8n/n8n-nodes-langchain.lmChatOpenRouter": { versions: [1], source: `${LANGCHAIN}/llms/LmChatOpenRouter/LmChatOpenRouter.node.ts`, params: ["model"], credential: "openRouterApi" },
  "@n8n/n8n-nodes-langchain.mcpClientTool": {
    versions: [1.2, 1.3, 1.4],
    source: `${LANGCHAIN}/mcp/McpClientTool/McpClientTool.node.ts`,
    params: ["endpointUrl", "authentication", "include", "includeTools", "timeout"],
    extra: { source: `${LANGCHAIN}/mcp/shared/descriptions.ts`, params: ["serverTransport", "httpBearerAuth"] },
  },
};

/** Agent options, defined in a shared file rather than the node file. */
export const AGENT_OPTIONS = { source: `${LANGCHAIN}/agents/Agent/agents/ToolsAgent/options.ts`, params: ["systemMessage", "maxIterations"] };
/** Connection types the workflows use. */
export const CONNECTION_TYPES = ["main", "ai_languageModel", "ai_tool"];
