import { callProvider } from "../../providers/cli";
import { getCredential } from "../../credentials-store";
import type { NodeContext, NodeExecutor, WorkflowNode } from "../types";

function fromInputs(inputs: Record<string, unknown>, key: string): string | undefined {
  const hit = Object.values(inputs).find((o: any) => o && typeof o[key] === "string");
  return (hit as any)?.[key];
}

/**
 * researchTrending — given the niche, pick ONE specific, timely blog topic and
 * an outline. Uses live web search (Tavily) when a key is present, otherwise the
 * Claude CLI subscription's own knowledge (clearly flagged as not live).
 */
export const researchTrending: NodeExecutor = {
  type: "researchTrending",
  title: "What's trending",
  icon: "📈",
  provider: "claude-cli",
  requiredCredentials: [
    { name: "TAVILY_API_KEY", where: "tavily.com -> API keys (free) — enables LIVE trends", optional: true, secret: true },
  ],

  async run(node: WorkflowNode, ctx: NodeContext) {
    const niche = fromInputs(ctx.inputs, "niche") || ctx.goal;
    const tavily = getCredential("TAVILY_API_KEY");

    let live = "";
    if (tavily) {
      ctx.emit("Searching live web trends for your niche…");
      try {
        const r = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavily,
            query: `latest trending topics and news in ${niche.slice(0, 120)}`,
            max_results: 6,
            search_depth: "advanced",
          }),
        });
        if (r.ok) {
          const d: any = await r.json();
          live = (d.results || [])
            .map((x: any, i: number) => `[${i + 1}] ${x.title} — ${x.url}\n${x.content?.slice(0, 200) ?? ""}`)
            .join("\n\n");
        }
      } catch (e: any) {
        ctx.emit(`Live search failed (${e.message}); using model knowledge.`);
      }
    } else {
      ctx.emit("No TAVILY_API_KEY — picking a timely angle from model knowledge (not live).");
    }

    const prompt = `You are a content strategist. For the niche below, choose ONE specific blog post to write right now. Respond as:\nTITLE: <working title>\nWHY_NOW: <one line>\nOUTLINE: 5 bullet points to cover\n\nNiche:\n${niche}\n\n${live ? `Live web results:\n${live}` : "(no live results — use your own knowledge and note it is not live)"}`;

    const res = await callProvider("claude", prompt, {
      timeoutMs: 90_000,
      fallback: `TITLE: A timely piece in your niche\nWHY_NOW: evergreen interest\nOUTLINE: intro; context; key points; example; takeaway.`,
    });

    ctx.emit(
      res.real ? `Angle chosen (${(res.ms / 1000).toFixed(1)}s).` : `Claude unavailable — ${res.error}`,
    );
    return {
      angle: res.text,
      live: Boolean(live),
      provider: res.provider,
      real: res.real,
      note: live ? undefined : "Not live web trends (add TAVILY_API_KEY for that).",
    };
  },
};
