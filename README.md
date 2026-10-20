# Layrcake starter for n8n

An importable [n8n](https://n8n.io) workflow that turns a one-sentence brief into about 10 people with verified work emails and a draft campaign, then stops at the approval link.

It uses n8n's AI Agent node with the MCP Client Tool node, connected to the Layrcake MCP server at `https://mcp.layrcake.dev/mcp`. Nothing is sent. A person approves the campaign in the Layrcake console before any email goes out.

## What it does

```text
Run -> Brief and budget -> Prospector (AI Agent)
                              |- Anthropic Chat Model
                              |- Layrcake (MCP Client Tool)
```

1. `find_leads` finds people who match your brief.
2. `enrich` gets each person's work email.
3. `verify_email` checks every address. Only `valid` and `catch_all_valid` addresses are kept.
4. `create_campaign` saves a short draft sequence for the kept people. Drafts never send.
5. `launch_campaign` returns a preview and an approval link. The agent stops there.

## Files

```text
workflows/layrcake-prospector.json             the workflow, with Anthropic as the model
workflows/layrcake-prospector-openrouter.json  the same workflow, with OpenRouter as the model
scripts/build.mjs                              the one definition both files are built from
scripts/smoke.mjs                              free check of your key against the MCP server
scripts/n8n-nodes.mjs                          the n8n node types and versions the workflow uses
test/workflow.test.mjs                         structure checks for both workflow files
```

## Prerequisites

- n8n 2.x, self-hosted or n8n Cloud, with the AI Agent and MCP Client Tool nodes (both ship with n8n).
- A Layrcake API key. Create one at [layrcake.dev/connect](https://layrcake.dev/connect). New accounts start with 300 free credits.
- An Anthropic API key from [platform.claude.com](https://platform.claude.com), or an OpenRouter key.
- Sending mailboxes in your Layrcake workspace, for the launch preview. Without them, `launch_campaign` returns an error that says what is missing.

## Setup in n8n

1. Download `workflows/layrcake-prospector.json`.
2. In n8n, create a new workflow, open the workflow menu (three dots, top right) and choose **Import from File**. Pick the file.
3. Open the **Layrcake** node (MCP Client Tool). In its credential field, create a new **Bearer Auth** credential, paste your Layrcake API key as the **Bearer Token**, name it "Layrcake API key" and save.
4. Open the **Anthropic Chat Model** node. In its credential field, create an Anthropic credential with your Anthropic API key.
5. Open the **Brief and budget** node. It holds three values:
   - `brief`: the one-sentence brief. The default is "Find 10 heads of sales at software companies in London with 20 to 200 staff and draft a short campaign about cutting time spent on lead research."
   - `budget`: the credit ceiling for the run. Default 100.
   - `dry_run`: `true` by default, so the first run is free.
6. Save the workflow.

## Run

1. Click **Execute workflow**. With `dry_run` set to `true`, every Layrcake call returns a plan with the most it could cost and finds nothing. It still uses your model key.
2. Open the **Prospector** node's output to read the agent's report: the cost estimate for 10 people.
3. Set `dry_run` to `false` in **Brief and budget**, change the brief if you like, and execute again.
4. The report ends with the approval link. Nothing has been sent. A person approves or declines there.

## How approval works

`launch_campaign` never sends on its own. Its first answer is a preview, a `confirmation_token` and an `approval_url`. The agent reports the link and stops.

A signed-in person in your workspace opens the link, reads the preview and approves or declines. The Layrcake server refuses to launch without that approval, whatever the agent sends. After approval, Layrcake starts the campaign itself when the approval says `execution: server`.

## The rules, and where they live

The Layrcake rules for agents are at [layrcake.dev/agents.md](https://layrcake.dev/agents.md). In this workflow:

- The **Layrcake** node selects only `find_leads`, `enrich`, `verify_email`, `create_campaign` and `launch_campaign`. Tools that buy sending capacity or reply to people are not available to the agent.
- Human approval before anything sends is enforced by the Layrcake server.
- Sending `budget_credits` and `dry_run` on each call, verifying before a campaign, and stopping at the approval link are in the agent's system message. n8n has no hook to enforce them in code, so they depend on the model following its instructions. For a hard ceiling, set a monthly spend cap on the API key in the [Layrcake console](https://app.layrcake.dev).

The TypeScript and Python starter kits enforce these rules in code. Use one of them if you need that.

## Cost

A run of the default brief usually costs 45 to 55 Layrcake credits. A credit is $0.01. Finding people costs 0.25 credits each, an email costs 5 credits when found, a verification costs 1.25, and lookups that find nothing are free. Drafting the campaign is free. See [pricing](https://docs.layrcake.dev/pricing.html). Model usage is billed separately by your model provider.

## Changing the model

Open the **Anthropic Chat Model** node and change **Model**. The workflow sets the ID `claude-sonnet-5-5`; pick another from the list or type an ID. To use another provider, delete the node, add that provider's chat model node and connect it to the **Chat Model** input of **Prospector**.

## Using OpenRouter

Import `workflows/layrcake-prospector-openrouter.json` instead. Its **OpenRouter Chat Model** node uses `anthropic/claude-sonnet-5.5`. Create an OpenRouter credential with your OpenRouter key on that node, then follow the same steps. Change **Model** on that node to use any other OpenRouter model.

## Check your key without n8n

```sh
npm install
cp .env.example .env   # then add LAYRCAKE_API_KEY
npm run smoke
```

`npm run smoke` connects to the MCP server the way the **Layrcake** node does, checks that the server offers every tool the workflow selects, and runs each as a dry run. It charges nothing and calls no model. It prints something like this:

```text
Connected. The server offers all 5 tools the workflow selects.
find_leads: would cost up to 3 credits
enrich: would cost up to 5 credits
verify_email: would cost up to 1.25 credits
create_campaign: would cost up to 0 credits

Charged: 0 credits. Your key and the Layrcake MCP server work.
```

If `create_campaign` says it `would trip: sending_capacity`, connect mailboxes in the [Layrcake console](https://app.layrcake.dev) before a live run.

## Development

The workflow files are built from `scripts/build.mjs`. Edit that file, then:

```sh
npm run build        # rewrite both workflow files
npm run lint
npm test             # structure checks, no network
npm run check-live   # re-check node types, versions and parameters against n8n's current source on GitHub
```

## Links

- Layrcake docs: [docs.layrcake.dev](https://docs.layrcake.dev)
- Rules for agents: [layrcake.dev/agents.md](https://layrcake.dev/agents.md)
- MCP server: `https://mcp.layrcake.dev/mcp`
- n8n MCP Client Tool node: [docs.n8n.io](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolmcp/)

## License

MIT. See [LICENSE](LICENSE).
