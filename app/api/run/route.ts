import { NextRequest } from "next/server";
import { hasAnthropicKey } from "@/lib/anthropic";
import { runWorkflow } from "@/lib/engine/executor";
import { registry } from "@/lib/engine/nodes/registry";
import { simulateRun } from "@/lib/engine/simulate";
import { WorkflowPlanSchema, type RunEvent } from "@/lib/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Executes a workflow and streams RunEvents as Server-Sent Events so the browser
 * can animate each node. Falls back to a simulated run when there is no Anthropic
 * key (or when the client explicitly requests a simulation), so the animation is
 * always demoable.
 */
export async function POST(req: NextRequest) {
  let planInput: unknown;
  let forceSimulate = false;
  try {
    const body = await req.json();
    planInput = body?.plan;
    forceSimulate = Boolean(body?.simulate);
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }

  const parsed = WorkflowPlanSchema.safeParse(planInput);
  if (!parsed.success) {
    return new Response("Invalid or missing workflow plan.", { status: 400 });
  }

  // Only fall back to the fake simulation when the workflow needs the Anthropic
  // API but has no key AND uses no CLI subscription. CLI-based workflows
  // (Claude/ChatGPT/Grok CLIs) always run for real.
  const CLI = new Set(["claude-cli", "codex-cli", "grok-cli"]);
  const hasCli = parsed.data.nodes.some((n) => CLI.has(registry[n.type]?.provider));
  const needsApi = parsed.data.nodes.some((n) => registry[n.type]?.provider === "anthropic-api");
  const simulate = forceSimulate || (needsApi && !hasCli && !hasAnthropicKey());
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: RunEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        if (simulate) await simulateRun(parsed.data, send);
        else await runWorkflow(parsed.data, send);
      } catch (err: any) {
        send({ kind: "run_error", message: err?.message ?? String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
