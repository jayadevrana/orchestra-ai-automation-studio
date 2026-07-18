import { getAnthropic, MODEL_PLANNER } from "../anthropic";
import { PLAN_TOOL_SCHEMA, WorkflowPlanSchema, type WorkflowPlan } from "./types";

const PLANNER_SYSTEM = `You are Orchestra's workflow planner. Convert the user's plain-English automation request into a runnable workflow of connected nodes (like n8n, but described in words).

CRITICAL ROUTING (decide this FIRST):
- If the request mentions a VIDEO, reel, short, clip, or animation -> you MUST output exactly these four nodes in order: planContent, writeScript, generateImage, imageToVideo. Do NOT use a research node for video requests.
- If the request mentions a BLOG or publishing to a website/WordPress -> research, writeBlog, publishWordPress (add a trigger first if a schedule is mentioned).
- Otherwise compose from the node types below.

Available node types:
- "trigger": what starts the workflow. Use it as the FIRST node when the user mentions a schedule ("daily", "every morning", "weekly"). Put the cadence in "schedule".
- "research": gathers information (live web search when a key is available, else model knowledge). Put what to research in "query".
- "writeBlog": writes a publish-ready blog post (title + HTML body) from prior research or a topic. Put the topic in "topic" and any guidance in "instructions".
- "writeReport": turns prior findings into a structured written report. Put guidance in "instructions".
- "draftEmail": drafts an email (only ever a DRAFT — never sent). Put guidance in "instructions", recipient in "to", subject hint in "subject".
- "publishWordPress": creates a DRAFT post on a WordPress site from a prior blog/report. No fields needed (credentials are collected separately).
- "planContent": plans a short faceless video / creative piece. Runs on the Claude CLI subscription. Put the idea in "topic".
- "writeScript": writes a short voiceover script from the plan. Runs on the Claude CLI subscription.
- "generateImage": generates a key image for the piece. Runs on the ChatGPT / Codex CLI subscription.
- "imageToVideo": turns the generated image into a short video. Runs on the Grok CLI subscription.

Rules:
- Order nodes in execution order. Later nodes automatically receive earlier nodes' outputs.
- Give each node a unique id: n1, n2, n3, ...
- Keep it to the smallest workflow that satisfies the request (usually 2-4 nodes).
- Map the request literally. "Daily blog to my website" => trigger(daily) -> research -> writeBlog -> publishWordPress. "Research X and email my team" => research -> writeReport -> draftEmail (or research -> draftEmail).
- For creating a VIDEO / faceless video / reel / visual content: planContent -> writeScript -> generateImage -> imageToVideo. Add a trigger first only if the user mentions a schedule.
- Only add publishWordPress if the user wants it published to a website/WordPress. Only add draftEmail if they want an email.
- Write a short title and a one-sentence summary for the whole workflow.`;

/**
 * Turns a natural-language goal into a validated WorkflowPlan using Anthropic
 * forced tool-use (a strict schema guarantees well-formed JSON).
 */
export async function planWorkflow(goal: string): Promise<WorkflowPlan> {
  const anthropic = getAnthropic();

  const msg = await anthropic.messages.create({
    model: MODEL_PLANNER,
    max_tokens: 2000,
    system: PLANNER_SYSTEM,
    tools: [
      {
        name: "build_workflow",
        description: "Emit the workflow that accomplishes the user's goal.",
        input_schema: PLAN_TOOL_SCHEMA,
        strict: true,
      },
    ],
    tool_choice: { type: "tool", name: "build_workflow" },
    messages: [{ role: "user", content: goal }],
  } as any);

  const toolUse = (msg.content as any[]).find((b) => b?.type === "tool_use");
  if (!toolUse) throw new Error("Planner did not return a workflow.");

  const plan = WorkflowPlanSchema.parse(toolUse.input);
  // Normalize ids to n1..nN so duplicates from the model can't collide.
  plan.nodes = plan.nodes.map((n, i) => ({ ...n, id: `n${i + 1}` }));
  return plan;
}
