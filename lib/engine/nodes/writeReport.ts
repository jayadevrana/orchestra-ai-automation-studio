import { MODEL_FAST, textOf } from "../../anthropic";
import type { NodeContext, NodeExecutor, WorkflowNode } from "../types";

function findBriefing(inputs: Record<string, unknown>): any | undefined {
  return Object.values(inputs).find((o: any) => o && typeof o.briefing === "string");
}

/**
 * writeReport node. Turns prior research (or, absent any, the goal) into a
 * polished markdown report.
 */
export const writeReport: NodeExecutor = {
  type: "writeReport",
  title: "Write report",
  icon: "📝", // 📝
  provider: "anthropic-api",
  requiredCredentials: [],

  async run(node: WorkflowNode, ctx: NodeContext) {
    const research = findBriefing(ctx.inputs);
    const instructions = node.instructions || "Write a clear, well-structured report.";
    const basis = research
      ? `Research briefing:\n${research.briefing}\n\nSources:\n${(research.sources || [])
          .map((s: any, i: number) => `[${i + 1}] ${s.title} — ${s.url}`)
          .join("\n")}`
      : `Topic: ${ctx.goal}`;

    ctx.emit("Writing the report...");
    const msg = await ctx.anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 8000,
      system:
        "You are an expert report writer. Produce a polished report in Markdown with a title (#), a short executive summary, sections with headings, and a brief conclusion. Preserve any [n] citations.",
      messages: [{ role: "user", content: `${instructions}\n\n${basis}` }],
    });

    return { report: textOf(msg) };
  },
};
