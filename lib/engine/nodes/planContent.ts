import { callProvider } from "../../providers/cli";
import type { NodeContext, NodeExecutor, WorkflowNode } from "../types";

/** Planning — driven by the Claude CLI subscription. */
export const planContent: NodeExecutor = {
  type: "planContent",
  title: "Plan (Claude)",
  icon: "🧠",
  provider: "claude-cli",
  requiredCredentials: [],

  async run(node: WorkflowNode, ctx: NodeContext) {
    const idea = node.topic || node.instructions || ctx.goal;
    const prompt = `You are a creative director. In under 120 words, plan a short faceless video about: "${idea}". Give exactly: a one-line CONCEPT, a VIBE (3-4 adjectives), and 3 BEATS (hook / core / payoff). Plain text only, no preamble.`;

    ctx.emit("Asking the Claude CLI subscription to plan it…");
    const res = await callProvider("claude", prompt, {
      timeoutMs: 90_000,
      fallback: `CONCEPT: A crisp 15s explainer on "${idea}".\nVIBE: cinematic, curious, punchy.\nBEATS: 1) Hook question  2) The core idea  3) A memorable payoff.`,
    });

    ctx.emit(
      res.real
        ? `Claude planned it in ${(res.ms / 1000).toFixed(1)}s.`
        : `Claude CLI unavailable — simulated. (${res.error})`,
    );
    return { plan: res.text, provider: res.provider, real: res.real, note: res.error };
  },
};
