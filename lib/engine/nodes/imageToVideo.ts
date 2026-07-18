import { callProvider } from "../../providers/cli";
import type { NodeContext, NodeExecutor, WorkflowNode } from "../types";

function findText(inputs: Record<string, unknown>, key: string): string | undefined {
  const hit = Object.values(inputs).find((o: any) => o && typeof o[key] === "string");
  return (hit as any)?.[key];
}

/**
 * Image-to-video — driven by the Grok CLI subscription. Grok is a text agent, so
 * it "generates" the clip as a concrete shot + motion plan (a simulation of a
 * real image-to-video model like Sora/Runway).
 */
export const imageToVideo: NodeExecutor = {
  type: "imageToVideo",
  title: "Image → video (Grok)",
  icon: "🎬",
  provider: "grok-cli",
  requiredCredentials: [],

  async run(node: WorkflowNode, ctx: NodeContext) {
    const imagePrompt = findText(ctx.inputs, "imagePrompt") || findText(ctx.inputs, "script") || ctx.goal;
    const prompt = `You simulate an image-to-video generator. Given this still-image concept:\n"${imagePrompt}"\n\nOutput ONLY a production-ready shot plan for a 15-second clip: three timed camera moves (e.g. "0-5s: slow push-in"), motion/particle/lighting notes, and a one-line mood. No intro, no explanation.`;

    ctx.emit("Asking the Grok CLI subscription to animate it (image → video)…");
    const res = await callProvider("grok", prompt, {
      timeoutMs: 120_000,
      fallback: `0-5s: slow push-in on the subject.\n5-10s: parallax drift, soft particles rising.\n10-15s: pull back to reveal, warm rim light.\nMood: cinematic and hopeful.`,
    });

    ctx.emit(
      res.real
        ? `Grok returned a shot plan in ${(res.ms / 1000).toFixed(1)}s.`
        : `Grok CLI unavailable — simulated. (${res.error})`,
    );
    return {
      videoPlan: res.text,
      provider: res.provider,
      real: res.real,
      simulatedAs: "shot + motion plan (Grok is a text agent, not an image-to-video model)",
      note: res.error,
    };
  },
};
