import { MODEL_FAST, textOf } from "../../anthropic";
import { getCredential } from "../../credentials-store";
import type { NodeContext, NodeExecutor, WorkflowNode } from "../types";

interface Source {
  title: string;
  url: string;
  snippet?: string;
}

/**
 * Research node. Uses Tavily for live web search when TAVILY_API_KEY is set;
 * otherwise falls back to the model's own knowledge (clearly flagged). Findings
 * are synthesized into a briefing by the LLM.
 */
export const research: NodeExecutor = {
  type: "research",
  title: "Research",
  icon: "🔎", // 🔎
  provider: "anthropic-api",
  requiredCredentials: [
    { name: "TAVILY_API_KEY", where: "tavily.com -> API keys (free tier)", optional: true, secret: true },
  ],

  async run(node: WorkflowNode, ctx: NodeContext) {
    const query = (node.query || ctx.goal).trim();
    const tavilyKey = getCredential("TAVILY_API_KEY");

    let sources: Source[] = [];
    let live = false;

    if (tavilyKey) {
      ctx.emit(`Searching the web for: "${query}"`);
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query,
            max_results: 6,
            search_depth: "advanced",
            include_answer: false,
          }),
        });
        if (!res.ok) throw new Error(`Tavily returned HTTP ${res.status}`);
        const data: any = await res.json();
        sources = (data.results || []).map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
        }));
        live = true;
        ctx.emit(`Found ${sources.length} live sources.`);
      } catch (e: any) {
        ctx.emit(`Live search failed (${e.message}); using model knowledge.`);
      }
    } else {
      ctx.emit("No search key — using model knowledge (add TAVILY_API_KEY for live search).");
    }

    const sourceText = sources.length
      ? sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.url}\n${s.snippet ?? ""}`).join("\n\n")
      : "(no live sources — answer from general knowledge)";

    ctx.emit("Synthesizing findings...");
    const msg = await ctx.anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 4000,
      system:
        "You are a sharp research analyst. Produce a tight, factual briefing. When sources are provided, ground every claim in them and cite as [n]. When none are provided, answer from general knowledge and note it is not live. Output a few bulleted key findings then a 2-sentence bottom line.",
      messages: [{ role: "user", content: `Research goal: ${query}\n\nSources:\n${sourceText}` }],
    });

    return { query, live, sources, briefing: textOf(msg) };
  },
};
