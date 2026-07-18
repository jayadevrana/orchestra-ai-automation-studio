import { callProvider } from "../../providers/cli";
import type { NodeContext, NodeExecutor, WorkflowNode } from "../types";

function fromInputs(inputs: Record<string, unknown>, key: string): string | undefined {
  const hit = Object.values(inputs).find((o: any) => o && typeof o[key] === "string");
  return (hit as any)?.[key];
}

/**
 * writeBlog — writes a publish-ready post (title + HTML body) grounded in the
 * niche and trending angle from prior steps. Runs on the Claude CLI subscription
 * so it does not depend on the (flaky) proxy SDK path.
 */
export const writeBlog: NodeExecutor = {
  type: "writeBlog",
  title: "Write blog post",
  icon: "✍️", // ✍️
  provider: "claude-cli",
  requiredCredentials: [],

  async run(node: WorkflowNode, ctx: NodeContext) {
    const niche = fromInputs(ctx.inputs, "niche");
    const angle = fromInputs(ctx.inputs, "angle");
    const briefing = fromInputs(ctx.inputs, "briefing");
    const basis =
      [
        niche && `Niche:\n${niche}`,
        angle && `Trending topic + outline to write about:\n${angle}`,
        briefing && `Research:\n${briefing}`,
      ]
        .filter(Boolean)
        .join("\n\n") || `Topic: ${node.topic || node.title || ctx.goal}`;

    const prompt = `You are a professional blog writer. Write a complete, engaging, SEO-aware blog post (600-900 words). Respond in EXACTLY this format: first line \`TITLE: <the title>\`, then a blank line, then the post BODY as clean HTML (use <h2>, <p>, <ul>, <strong>). No <html>/<body> wrapper, no markdown, no code fences.\n\n${node.instructions || ""}\n\n${basis}`;

    ctx.emit("Writing the blog post with Claude…");
    const res = await callProvider("claude", prompt, {
      timeoutMs: 120_000,
      fallback: `TITLE: Draft post\n\n<p>Content unavailable — the Claude CLI wasn't reachable.</p>`,
    });

    const raw = res.text;
    const m = raw.match(/^TITLE:\s*(.+)$/im);
    const title = (m?.[1] || node.topic || "Untitled post").trim();
    const content = raw
      .replace(/^TITLE:\s*.+$/im, "")
      .replace(/```html?/gi, "")
      .replace(/```/g, "")
      .trim();

    ctx.emit(
      res.real ? `Post written (${(res.ms / 1000).toFixed(1)}s).` : `Claude unavailable — ${res.error}`,
    );
    return { blog: true, title, content, provider: res.provider, real: res.real, note: res.error };
  },
};
