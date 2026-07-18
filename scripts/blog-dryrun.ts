/**
 * Read-only proof that the fixed blog pipeline works: research niche (from the
 * real site) -> trending angle -> write the post. STOPS before publishing — it
 * never touches the user's WordPress. Run: npx tsx scripts/blog-dryrun.ts <site>
 */
import { runWorkflow } from "../lib/engine/executor";
import type { RunEvent, WorkflowPlan } from "../lib/engine/types";

const site = process.argv[2] || "jayadevrana.in";
const plan: WorkflowPlan = {
  title: "Blog dry-run (no publish)",
  summary: `Research the niche of ${site}, find a trending angle, and write a post.`,
  nodes: [
    { id: "n1", type: "researchNiche", title: "Research my niche", query: site },
    { id: "n2", type: "researchTrending", title: "What's trending" },
    { id: "n3", type: "writeBlog", title: "Write the blog post" },
  ],
};

const out: Record<string, any> = {};
function emit(e: RunEvent) {
  if (e.kind === "node_start") console.log(`\n▶ ${e.title}`);
  else if (e.kind === "node_log") console.log(`   … ${e.message}`);
  else if (e.kind === "node_output") out[e.id] = e.output;
  else if (e.kind === "node_error") console.log(`   ✕ ${e.message}`);
}

async function main() {
  await runWorkflow(plan, emit);
  console.log("\n=================== NICHE ===================");
  console.log(String(out.n1?.niche || "(none)").slice(0, 500));
  console.log("\n================ TRENDING ANGLE =============");
  console.log(String(out.n2?.angle || "(none)").slice(0, 500));
  console.log("\n=================== BLOG ====================");
  console.log("TITLE: " + String(out.n3?.title || "(none)"));
  console.log(String(out.n3?.content || "").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").slice(0, 500));
  const real = [out.n1, out.n2, out.n3].filter((o) => o?.real).length;
  console.log(`\n${real}/3 content steps ran on the real Claude CLI. (No publish — dry run.)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
