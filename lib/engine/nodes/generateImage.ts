import { callProvider } from "../../providers/cli";
import type { NodeContext, NodeExecutor, WorkflowNode } from "../types";

function findText(inputs: Record<string, unknown>, key: string): string | undefined {
  const hit = Object.values(inputs).find((o: any) => o && typeof o[key] === "string");
  return (hit as any)?.[key];
}

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5a623"/><stop offset="1" stop-color="#ff7a45"/></linearGradient></defs><rect width="400" height="225" fill="#0a0b0d"/><circle cx="300" cy="70" r="46" fill="url(#g)"/><rect x="30" y="150" width="220" height="14" rx="7" fill="#333a45"/><rect x="30" y="176" width="150" height="12" rx="6" fill="#262b33"/></svg>`;

/**
 * Image generation — driven by the ChatGPT / Codex CLI subscription. Codex is a
 * code agent, so it "generates" the image as an inline SVG sketch (a real,
 * viewable artifact) plus a photorealistic prompt — clearly a simulation of a
 * true text-to-image model.
 */
export const generateImage: NodeExecutor = {
  type: "generateImage",
  title: "Generate image (ChatGPT)",
  icon: "🎨",
  provider: "codex-cli",
  requiredCredentials: [],

  async run(node: WorkflowNode, ctx: NodeContext) {
    const script = findText(ctx.inputs, "script") || findText(ctx.inputs, "plan") || ctx.goal;
    const prompt = `You simulate an image generator. You are a code agent, so render the image as SVG. For the strongest visual moment of this script:\n\n${script}\n\nOutput ONLY, with NO prose and NO code fences:\nfirst line -> PROMPT: <one vivid photorealistic text-to-image prompt>\nthen -> a single self-contained <svg width="400" height="225" ...>...</svg> that sketches that scene with simple shapes, gradients and colors.`;

    ctx.emit("Asking the ChatGPT / Codex CLI subscription to generate the image…");
    // Codex's agent harness is slow (often >100s); fail fast to the SVG fallback
    // so the pipeline stays responsive.
    const res = await callProvider("codex", prompt, { timeoutMs: 75_000 });

    let imagePrompt = "";
    let svg = "";
    if (res.real && res.text) {
      const pm = res.text.match(/PROMPT:\s*(.+)/i);
      imagePrompt = (pm?.[1] || "").trim();
      const sm = res.text.match(/<svg[\s\S]*?<\/svg>/i);
      svg = sm?.[0] || "";
    }
    if (!svg) svg = FALLBACK_SVG;
    if (!imagePrompt) imagePrompt = `A cinematic still illustrating: ${script.slice(0, 80)}…`;

    ctx.emit(
      res.real
        ? `ChatGPT/Codex returned an SVG in ${(res.ms / 1000).toFixed(1)}s.`
        : `Codex CLI unavailable — simulated. (${res.error})`,
    );
    return {
      image: true,
      imagePrompt,
      svg,
      provider: res.provider,
      real: res.real,
      simulatedAs: "SVG sketch (Codex is a code agent, not a text-to-image model)",
      note: res.error,
    };
  },
};
