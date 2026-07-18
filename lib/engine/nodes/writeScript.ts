import { callProvider } from "../../providers/cli";
import type { NodeContext, NodeExecutor, WorkflowNode } from "../types";

function findPlan(inputs: Record<string, unknown>): string | undefined {
  const hit = Object.values(inputs).find((o: any) => o && typeof o.plan === "string");
  return (hit as any)?.plan;
}

/** Writing — driven by the Claude CLI subscription. */
export const writeScript: NodeExecutor = {
  type: "writeScript",
  title: "Write script (Claude)",
  icon: "🖋️",
  provider: "claude-cli",
  requiredCredentials: [],

  async run(node: WorkflowNode, ctx: NodeContext) {
    const plan = findPlan(ctx.inputs) || node.instructions || ctx.goal;
    const prompt = `Write a punchy voiceover script for a ~15 second faceless video. Target ~40 words, first line is a strong hook. Base it on this plan:\n\n${plan}\n\nOutput ONLY the spoken script, no scene directions.`;

    ctx.emit("Asking the Claude CLI subscription to write the script…");
    const res = await callProvider("claude", prompt, {
      timeoutMs: 90_000,
      fallback: `Ever wondered how this actually works? In fifteen seconds, here's the version nobody tells you — and by the end, you'll never see it the same way again.`,
    });

    ctx.emit(
      res.real
        ? `Claude wrote the script in ${(res.ms / 1000).toFixed(1)}s.`
        : `Claude CLI unavailable — simulated. (${res.error})`,
    );
    return { script: res.text, provider: res.provider, real: res.real, note: res.error };
  },
};
