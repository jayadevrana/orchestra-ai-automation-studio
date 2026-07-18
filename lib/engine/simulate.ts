import type { Emit, NodeType, WorkflowPlan } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Canned outputs so the canvas animation is fully demoable before any key is added.
function fakeOutput(type: NodeType): Record<string, unknown> {
  switch (type) {
    case "trigger":
      return { trigger: true, schedule: "every day 9am", note: "Simulated schedule." };
    case "research":
      return {
        query: "(simulated)",
        live: false,
        sources: [
          { title: "Example source A", url: "https://example.com/a" },
          { title: "Example source B", url: "https://example.com/b" },
        ],
        briefing:
          "• Simulated key finding one.\n• Simulated key finding two.\n\nBottom line: this is a SIMULATED run so you can see the animation. Add your Anthropic key to make it real.",
      };
    case "writeBlog":
      return {
        blog: true,
        title: "Your Blog Post Title (simulated)",
        content:
          "<h2>Introduction</h2><p>This is a simulated blog body so you can preview the flow. Add your Anthropic key to generate a real post.</p>",
      };
    case "writeReport":
      return { report: "# Report (simulated)\n\nSimulated report content. Add your key for the real thing." };
    case "draftEmail":
      return { to: "the team", draft: "Subject: (simulated)\n\nHi team — simulated draft.", note: "Draft only." };
    case "publishWordPress":
      return {
        status: "draft",
        link: "https://your-site.com/?p=123",
        title: "Your Blog Post Title (simulated)",
        note: "Simulated WordPress draft. Add your WordPress credentials for a real draft.",
      };
    default:
      return { note: "simulated" };
  }
}

const LOGS: Partial<Record<NodeType, string[]>> = {
  trigger: ["Trigger fired (simulated schedule)."],
  research: ["Searching…", "Reading sources…", "Synthesizing findings…"],
  writeBlog: ["Drafting the post…", "Polishing the HTML…"],
  writeReport: ["Structuring the report…"],
  draftEmail: ["Writing the email draft…"],
  publishWordPress: ["Connecting to WordPress…", "Creating a draft post…"],
};

/**
 * Streams a paced, fake run so the n8n-style animation plays end-to-end without
 * any API key. Clearly flagged as simulated.
 */
export async function simulateRun(plan: WorkflowPlan, emit: Emit): Promise<void> {
  emit({ kind: "run_start", total: plan.nodes.length, title: plan.title, simulated: true });
  for (const node of plan.nodes) {
    emit({ kind: "node_start", id: node.id, type: node.type, title: node.title });
    await sleep(450);
    for (const line of LOGS[node.type] || ["Working…"]) {
      emit({ kind: "node_log", id: node.id, message: line });
      await sleep(550);
    }
    emit({ kind: "node_output", id: node.id, output: fakeOutput(node.type) });
    await sleep(250);
  }
  emit({ kind: "run_done", outputs: {} });
}
