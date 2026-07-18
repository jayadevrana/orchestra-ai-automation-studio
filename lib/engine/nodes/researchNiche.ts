import { callProvider } from "../../providers/cli";
import type { NodeContext, NodeExecutor, WorkflowNode } from "../types";

/** Pull a bare domain out of free text, e.g. "my site jayadevrana.in" -> jayadevrana.in */
function extractDomain(s: string): string | undefined {
  const m = s.match(/\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:in|com|net|org|io|co|dev|blog|xyz|me|info|shop|store)(?:\.[a-z]{2})?)\b/i);
  return m?.[1];
}

function root(site: string): string {
  return `https://${site.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`;
}

/**
 * researchNiche — grounds "research my niche" in the user's ACTUAL site by
 * reading its published posts + categories via the public WordPress REST API
 * (no auth needed), then having Claude (CLI subscription) name the niche.
 */
export const researchNiche: NodeExecutor = {
  type: "researchNiche",
  title: "Research my niche",
  icon: "🧭",
  provider: "claude-cli",
  requiredCredentials: [],

  async run(node: WorkflowNode, ctx: NodeContext) {
    const domain = extractDomain(node.query || "") || extractDomain(ctx.goal) || undefined;
    const site = domain ? root(domain) : undefined;

    let titles: string[] = [];
    let cats: string[] = [];
    if (site) {
      ctx.emit(`Reading your site ${site} to learn its niche…`);
      try {
        const rp = await fetch(`${site}/wp-json/wp/v2/posts?per_page=12&_fields=title`);
        if (rp.ok) {
          const d: any = await rp.json();
          titles = d.map((p: any) => p?.title?.rendered).filter(Boolean);
        }
        const rc = await fetch(`${site}/wp-json/wp/v2/categories?per_page=20&_fields=name,count`);
        if (rc.ok) {
          const d: any = await rc.json();
          cats = d.filter((c: any) => c.count > 0).map((c: any) => c.name);
        }
        ctx.emit(`Read ${titles.length} posts and ${cats.length} categories.`);
      } catch (e: any) {
        ctx.emit(`Couldn't read the site (${e.message}); inferring from your request instead.`);
      }
    } else {
      ctx.emit("No site URL found in the request — inferring the niche from your words.");
    }

    const context =
      titles.length || cats.length
        ? `Existing post titles from ${site}:\n${titles.slice(0, 12).map((t) => "- " + t).join("\n")}\n\nCategories: ${cats.join(", ") || "(none)"}`
        : `No site data. Request: ${ctx.goal}`;

    const prompt = `Read this blog's own content and identify its NICHE. Respond as:\nNICHE: <one specific sentence>\nSUBTOPICS: 5 comma-separated subtopics it clearly covers\n\n${context}`;

    const res = await callProvider("claude", prompt, {
      timeoutMs: 90_000,
      fallback: `NICHE: (couldn't reach Claude) general topics implied by "${ctx.goal}".\nSUBTOPICS: to be determined.`,
    });

    ctx.emit(
      res.real
        ? `Niche identified (${(res.ms / 1000).toFixed(1)}s).`
        : `Claude unavailable — ${res.error}`,
    );
    return {
      site,
      niche: res.text,
      sampleTitles: titles.slice(0, 12),
      provider: res.provider,
      real: res.real,
      note: res.error,
    };
  },
};
