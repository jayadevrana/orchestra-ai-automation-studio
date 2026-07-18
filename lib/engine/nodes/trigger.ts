import type { NodeContext, NodeExecutor, WorkflowNode } from "../types";

/**
 * Trigger node. Represents what starts the workflow (e.g. a daily schedule).
 * In v1 scheduling is simulated — the workflow runs on demand; this node just
 * marks the entry point so the canvas reads like an n8n workflow.
 */
export const trigger: NodeExecutor = {
  type: "trigger",
  title: "Trigger",
  icon: "⏰", // ⏰
  provider: "none",
  requiredCredentials: [],

  async run(node: WorkflowNode, ctx: NodeContext) {
    const schedule = node.schedule || "on demand";
    ctx.emit(`Trigger fired (${schedule}). Scheduling is simulated in v1.`);
    return {
      trigger: true,
      schedule,
      note: "Scheduling is simulated in v1 — the workflow runs when you press Run.",
    };
  },
};
