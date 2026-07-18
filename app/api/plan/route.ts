import { NextRequest, NextResponse } from "next/server";
import { hasAnthropicKey } from "@/lib/anthropic";
import { credentialStatus } from "@/lib/credentials";
import { detectCredentials } from "@/lib/credential-detect";
import { setCredential } from "@/lib/credentials-store";
import { deterministicPlan } from "@/lib/engine/deterministic";
import { planWorkflow } from "@/lib/engine/planner";
import { WorkflowPlanSchema, type WorkflowPlan } from "@/lib/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A believable example plan so the canvas is fully visible before any key is added. */
function mockPlan(goal: string): WorkflowPlan {
  // Creative video pipeline runs on CLI subscriptions (no API key needed).
  if (/video|reel|faceless|shorts?|clip|image to video|animate/i.test(goal)) {
    const daily = /daily|every day|each day|morning|weekly|schedule/i.test(goal);
    const nodes: WorkflowPlan["nodes"] = [];
    if (daily) nodes.push({ id: "n0", type: "trigger", title: "Every day", schedule: "every day 9am" });
    nodes.push({ id: "n1", type: "planContent", title: "Plan (Claude)", topic: goal });
    nodes.push({ id: "n2", type: "writeScript", title: "Write script (Claude)" });
    nodes.push({ id: "n3", type: "generateImage", title: "Generate image (ChatGPT)" });
    nodes.push({ id: "n4", type: "imageToVideo", title: "Image → video (Grok)" });
    return {
      title: "Faceless video · Claude + ChatGPT + Grok",
      summary: `Create a short video for: "${goal}", using your logged-in CLI subscriptions.`,
      nodes,
    };
  }

  const wantsBlog = /blog|wordpress|website|publish|post/i.test(goal);
  const wantsEmail = /email|mail|team/i.test(goal);
  const daily = /daily|every day|each day|morning|weekly|schedule/i.test(goal);

  const nodes: WorkflowPlan["nodes"] = [];
  if (daily) nodes.push({ id: "n1", type: "trigger", title: "Every day 9am", schedule: "every day 9am" });
  nodes.push({ id: "n2", type: "research", title: "Research the topic", query: goal });
  if (wantsBlog) {
    nodes.push({ id: "n3", type: "writeBlog", title: "Write the blog post", topic: goal });
    nodes.push({ id: "n4", type: "publishWordPress", title: "Publish draft to WordPress" });
  } else {
    nodes.push({ id: "n3", type: "writeReport", title: "Write a report", instructions: "Summarize the findings." });
    if (wantsEmail) nodes.push({ id: "n4", type: "draftEmail", title: "Draft an email", to: "the team" });
  }

  return {
    title: wantsBlog ? "Daily blog → WordPress" : "Research → Report",
    summary: `Example workflow for: "${goal}". This is a MOCK — add your Anthropic key to generate real plans.`,
    nodes,
  };
}

export async function POST(req: NextRequest) {
  let goal = "";
  try {
    const body = await req.json();
    goal = String(body?.goal ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!goal) {
    return NextResponse.json({ error: "Describe what you want to automate." }, { status: 400 });
  }

  // Auto-detect any credentials typed into the message (runs here on the user's
  // machine), save them to the local store, and continue with a REDACTED goal so
  // the secret never reaches the (third-party) planner model.
  const detection = detectCredentials(goal);
  for (const c of detection.found) setCredential(c.name, c.value);
  goal = detection.redacted;
  const captured = detection.found.map((c) => c.name);
  const warnings = detection.warnings;

  // High-confidence intents (blog, video) use a reliable, complete plan instead
  // of the flaky proxy planner (which has produced broken plans like [research,
  // research]). Novel requests still fall through to the LLM planner / mock.
  const deterministic = deterministicPlan(goal);
  if (deterministic) {
    return NextResponse.json({
      plan: deterministic,
      credentials: credentialStatus(deterministic),
      mock: false,
      captured,
      warnings,
    });
  }

  if (!hasAnthropicKey()) {
    const plan = mockPlan(goal);
    return NextResponse.json({ plan, credentials: credentialStatus(plan), mock: true, captured, warnings });
  }

  try {
    const plan = WorkflowPlanSchema.parse(await planWorkflow(goal));
    return NextResponse.json({ plan, credentials: credentialStatus(plan), mock: false, captured, warnings });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to plan." }, { status: 500 });
  }
}
