/**
 * Offline verification harness (Mechanic 3). Runs the whole engine WITHOUT any
 * API key by injecting a mock Anthropic client. Verifies:
 *   1. A hand-built plan validates against the zod schema.
 *   2. The executor runs every node in order and emits the expected events.
 *   3. Each node produces non-empty output.
 *
 * Run:  npm run smoke
 */
import { runWorkflow } from "../lib/engine/executor";
import { WorkflowPlanSchema, type RunEvent } from "../lib/engine/types";
import type { LLMClient } from "../lib/anthropic";

// A mock LLM: echoes a deterministic text block so nodes produce real output.
const mockClient: LLMClient = {
  messages: {
    async create(params: any) {
      const userMsg = params?.messages?.[0]?.content ?? "";
      const preview = String(userMsg).slice(0, 60).replace(/\s+/g, " ");
      return { content: [{ type: "text", text: `MOCK OUTPUT for: ${preview}` }] };
    },
  },
};

function assert(cond: unknown, message: string) {
  if (!cond) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

async function main() {
  const plan = WorkflowPlanSchema.parse({
    title: "Smoke: research -> report -> email",
    summary: "Verify the engine runs end to end offline.",
    nodes: [
      { id: "n1", type: "research", title: "Research", query: "test topic" },
      { id: "n2", type: "writeReport", title: "Write report", instructions: "Summarize." },
      { id: "n3", type: "draftEmail", title: "Draft email", to: "team@example.com" },
    ],
  });

  const events: RunEvent[] = [];
  const outputs = await runWorkflow(plan, (e) => events.push(e), mockClient);

  const kinds = events.map((e) => e.kind);
  assert(kinds[0] === "run_start", "first event should be run_start");
  assert(kinds[kinds.length - 1] === "run_done", "last event should be run_done");
  assert(kinds.filter((k) => k === "node_start").length === 3, "should start 3 nodes");
  assert(kinds.filter((k) => k === "node_output").length === 3, "should output 3 nodes");
  assert(!kinds.includes("node_error"), "no node should error");

  assert((outputs.n1 as any)?.briefing, "research node should produce a briefing");
  assert((outputs.n2 as any)?.report, "writeReport node should produce a report");
  assert((outputs.n3 as any)?.draft, "draftEmail node should produce a draft");

  console.log(`✅ PASS — ${events.length} events, 3 nodes ran, all outputs non-empty.`);
  console.log(`   research.briefing: ${String((outputs.n1 as any).briefing).slice(0, 70)}...`);
  console.log(`   writeReport.report: ${String((outputs.n2 as any).report).slice(0, 70)}...`);
  console.log(`   draftEmail.draft:  ${String((outputs.n3 as any).draft).slice(0, 70)}...`);
}

main().catch((err) => {
  console.error("❌ smoke crashed:", err);
  process.exit(1);
});
