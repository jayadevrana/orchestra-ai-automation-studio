/**
 * Multi-subscription orchestration test. Runs the creative pipeline through the
 * user's logged-in terminal CLIs — Claude (plan + write), ChatGPT/Codex (image),
 * Grok (image -> video) — and reports which steps ran on a REAL subscription vs
 * fell back to a simulation (e.g. a CLI that isn't logged in).
 *
 * Run:  npm run provider-test  ["your video topic"]
 */
import { runWorkflow } from "../lib/engine/executor";
import type { RunEvent, WorkflowPlan } from "../lib/engine/types";

const goal = process.argv.slice(2).join(" ") || "the surprising history of chai in India";

const plan: WorkflowPlan = {
  title: "Faceless video · Claude + ChatGPT + Grok",
  summary: `Create a short faceless video about: ${goal}`,
  nodes: [
    { id: "n1", type: "planContent", title: "Plan (Claude)", topic: goal },
    { id: "n2", type: "writeScript", title: "Write script (Claude)" },
    { id: "n3", type: "generateImage", title: "Generate image (ChatGPT)" },
    { id: "n4", type: "imageToVideo", title: "Image -> video (Grok)" },
  ],
};

const outputs: Record<string, any> = {};

function emit(e: RunEvent) {
  if (e.kind === "run_start") console.log(`\n🎬 ${e.title}\n   topic: ${goal}`);
  else if (e.kind === "node_start") console.log(`\n▶ ${e.title}  [${e.type}]`);
  else if (e.kind === "node_log") console.log(`   … ${e.message}`);
  else if (e.kind === "node_output") outputs[e.id] = e.output;
  else if (e.kind === "node_error") console.log(`   ✕ ${e.message}`);
}

async function main() {
  await runWorkflow(plan, emit);

  console.log("\n========================= RESULTS =========================");
  for (const n of plan.nodes) {
    const o = outputs[n.id] || {};
    console.log(`\n### ${n.title} — ${o.real ? "REAL ✓" : "simulated ○"} — ${o.provider || ""}`);
    const text = o.plan || o.script || o.imagePrompt || o.videoPlan || "";
    if (text) console.log(String(text).slice(0, 500));
    if (o.svg) console.log(`   [image SVG: ${String(o.svg).length} chars]`);
    if (!o.real && o.note) console.log(`   (fallback reason: ${o.note})`);
  }

  const real = plan.nodes.filter((n) => outputs[n.id]?.real).length;
  console.log(`\n===========================================================`);
  console.log(`${real}/${plan.nodes.length} steps ran on a REAL logged-in subscription CLI.`);
  console.log(real >= 2 ? "✅ Multi-provider orchestration works." : "⚠️  Most providers fell back to simulation.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
