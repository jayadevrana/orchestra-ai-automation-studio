import { MODEL_FAST, textOf } from "../../anthropic";
import type { NodeContext, NodeExecutor, WorkflowNode } from "../types";

function findReport(inputs: Record<string, unknown>): any | undefined {
  return Object.values(inputs).find((o: any) => o && typeof o.report === "string");
}
function findBriefing(inputs: Record<string, unknown>): any | undefined {
  return Object.values(inputs).find((o: any) => o && typeof o.briefing === "string");
}

/**
 * draftEmail node. Writes an email DRAFT from prior report/research. It NEVER
 * sends — sending is a guarded, out-of-scope action for v1 (safety).
 */
export const draftEmail: NodeExecutor = {
  type: "draftEmail",
  title: "Draft email",
  icon: "✉️", // ✉️
  provider: "anthropic-api",
  requiredCredentials: [],

  async run(node: WorkflowNode, ctx: NodeContext) {
    const report = findReport(ctx.inputs);
    const research = findBriefing(ctx.inputs);
    const basis: string = report?.report || research?.briefing || ctx.goal;
    const to = node.to || "the team";

    ctx.emit(`Drafting an email to ${to} (draft only — never auto-sent)...`);
    const msg = await ctx.anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 2000,
      system:
        "You write concise, professional emails. Output ONLY the email: a `Subject:` line, then the body. No preamble.",
      messages: [
        {
          role: "user",
          content: `Draft an email to ${to}.\nGuidance: ${node.instructions || "Summarize the material clearly."}\nSubject hint: ${node.subject || "(you choose)"}\n\nSource material:\n${basis}`,
        },
      ],
    });

    return { to, draft: textOf(msg), note: "Draft only — Orchestra never sends email automatically." };
  },
};
