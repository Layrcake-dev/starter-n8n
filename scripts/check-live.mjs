// Re-checks the node types, versions and parameter names in scripts/n8n-nodes.mjs against n8n's
// current master on GitHub. Needs network access, so CI does not run it.
import { AGENT_OPTIONS, NODES } from "./n8n-nodes.mjs";

const raw = (path) => fetch(`https://raw.githubusercontent.com/n8n-io/n8n/master/${path}`).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status} ${path}`))));
let failed = 0;
const fail = (message) => {
  failed += 1;
  console.log(`FAIL ${message}`);
};

for (const [type, spec] of Object.entries(NODES)) {
  const source = await raw(spec.source);
  const name = type.split(".").pop();
  if (!source.includes(`name: '${name}'`)) fail(`${type}: no node named ${name} in ${spec.source}`);
  const latest = Math.max(...spec.versions);
  if (!new RegExp(`(defaultVersion: ${latest}\\b|version: \\[[^\\]]*\\b${latest}\\b|version: ${latest}\\b|\\b${latest}: new)`).test(source)) fail(`${type}: version ${latest} not found`);
  for (const param of spec.params) if (!source.includes(`name: '${param}'`)) fail(`${type}: no parameter ${param}`);
  if (spec.credential && !source.includes(`name: '${spec.credential}'`)) fail(`${type}: no credential ${spec.credential}`);
  if (spec.extra) {
    const extra = await raw(spec.extra.source);
    for (const param of spec.extra.params) if (!extra.includes(`name: '${param}'`)) fail(`${type}: no ${param} in ${spec.extra.source}`);
  }
  if (!failed) console.log(`ok   ${type} (v${spec.versions.join(", v")})`);
}
const options = await raw(AGENT_OPTIONS.source);
for (const param of AGENT_OPTIONS.params) if (!options.includes(`name: '${param}'`)) fail(`agent options: no ${param}`);
if (failed) process.exit(1);
console.log("ok   agent options: systemMessage, maxIterations\n\nThe workflows match n8n master.");
