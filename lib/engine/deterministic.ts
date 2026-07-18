import type { WorkflowPlan } from "./types";

/**
 * Deterministic routing for high-confidence intents (blog, video). The LLM
 * planner via the aerolink proxy is unreliable — it has produced incomplete
 * plans like [research, research] with no writing or publishing step. For these
 * common, well-understood requests we emit a correct, complete plan directly and
 * only fall back to the LLM for novel requests.
 */

function extractDomain(s: string): string | undefined {
  const m = s.match(/\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:in|com|net|org|io|co|dev|blog|xyz|me|info|shop|store)(?:\.[a-z]{2})?)\b/i);
  return m?.[1];
}

export function deterministicPlan(goal: string): WorkflowPlan | null {
  const g = goal.toLowerCase();
  const scheduled = /\b(daily|every day|each day|each morning|morning|weekly|schedule|cron)\b/.test(g);
  const site = extractDomain(goal);

  // Blog -> WordPress: research niche -> what's trending -> write -> publish
  const wantsBlog =
    /\bblog\b|\bwordpress\b|\barticle\b|\bpost\b/.test(g) &&
    (/publish|post|website|wordpress|site|blog/.test(g) || Boolean(site));
  if (wantsBlog) {
    const nodes: WorkflowPlan["nodes"] = [];
    if (scheduled) nodes.push({ id: "n0", type: "trigger", title: "Every day 9am", schedule: "every day 9am" });
    nodes.push({ id: "n1", type: "researchNiche", title: "Research my niche", query: site || goal });
    nodes.push({ id: "n2", type: "researchTrending", title: "What's trending" });
    nodes.push({ id: "n3", type: "writeBlog", title: "Write the blog post" });
    nodes.push({ id: "n4", type: "publishWordPress", title: "Publish to WordPress" });
    return {
      title: site ? `Daily blog -> ${site}` : "Blog -> WordPress",
      summary: `Read the niche of ${site || "your site"}, find a trending topic, write a post, and publish it live.`,
      nodes,
    };
  }

  // Faceless video: plan -> script -> image -> video (CLI subscriptions)
  if (/\bvideo\b|\breel\b|\bshort\b|\bshorts\b|\bclip\b|\banimation\b|\banimate\b/.test(g)) {
    const nodes: WorkflowPlan["nodes"] = [];
    if (scheduled) nodes.push({ id: "n0", type: "trigger", title: "Every day 9am", schedule: "every day 9am" });
    nodes.push({ id: "n1", type: "planContent", title: "Plan (Claude)", topic: goal });
    nodes.push({ id: "n2", type: "writeScript", title: "Write script (Claude)" });
    nodes.push({ id: "n3", type: "generateImage", title: "Generate image (ChatGPT)" });
    nodes.push({ id: "n4", type: "imageToVideo", title: "Image -> video (Grok)" });
    return {
      title: "Faceless video - Claude + ChatGPT + Grok",
      summary: `Create a short faceless video for: "${goal}".`,
      nodes,
    };
  }

  return null;
}
