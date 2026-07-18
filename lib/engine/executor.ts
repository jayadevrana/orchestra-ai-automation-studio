import { getAnthropic, type LLMClient } from "../anthropic";
import { registry } from "./nodes/registry";
import type { Emit, WorkflowPlan } from "./types";

/**
 * Runs a workflow node-by-node in order. Each node's output is accumulated and
 * passed to later nodes via ctx.inputs. Progress is streamed through `emit`.
 *
 * `client` is injectable so tests can run the whole engine offline with a mock
 * (production callers omit it and get the real Anthropic client).
 */
export async function runWorkflow(
  plan: WorkflowPlan,
  emit: Emit,
  client?: LLMClient,
): Promise<Record<string, unknown>> {
  // Lazy: only resolve the real Anthropic client when a node actually calls it,
  // so CLI-subscription workflows (Claude/ChatGPT/Grok CLIs) run with no API key.
  const anthropic: LLMClient =
    client ?? { messages: { create: (params: any) => getAnthropic().messages.create(params) } };
  const outputs: Record<string, unknown> = {};

  emit({ kind: "run_start", total: plan.nodes.length, title: plan.title });

  for (const node of plan.nodes) {
    const exec = registry[node.type];
    emit({ kind: "node_start", id: node.id, type: node.type, title: node.title });

    if (!exec) {
      emit({ kind: "node_error", id: node.id, message: `Unknown node type: ${node.type}` });
      continue;
    }

    try {
      const output = await exec.run(node, {
        goal: plan.summary || plan.title,
        inputs: outputs,
        anthropic,
        emit: (message: string) => emit({ kind: "node_log", id: node.id, message }),
      });
      outputs[node.id] = output;
      emit({ kind: "node_output", id: node.id, output });
    } catch (err: any) {
      emit({
        kind: "node_error",
        id: node.id,
        message: err?.message ?? String(err),
      });
    }
  }

  emit({ kind: "run_done", outputs });
  return outputs;
}
