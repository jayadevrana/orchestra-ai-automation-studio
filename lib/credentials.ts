import { hasCredential } from "./credentials-store";
import { registry } from "./engine/nodes/registry";
import { hasAerolink } from "./providers/aerolink";
import type { CredentialStatus, WorkflowPlan } from "./engine/types";

/**
 * Inspects a plan against the node registry and reports which credentials the
 * workflow needs and whether each is present. Only ever reports variable NAMES
 * and presence — never values.
 */
export function credentialStatus(plan: WorkflowPlan): CredentialStatus[] {
  const byName = new Map<string, CredentialStatus>();

  // ANTHROPIC_API_KEY is only required if a node actually uses the Anthropic API.
  // CLI-subscription workflows (Claude/ChatGPT/Grok CLIs) need no API key.
  // Claude access is satisfied by the aerolink login when present — no key nag then.
  const usesApi = plan.nodes.some((node) => registry[node.type]?.provider === "anthropic-api");
  if (usesApi && !hasAerolink()) {
    byName.set("ANTHROPIC_API_KEY", {
      name: "ANTHROPIC_API_KEY",
      where: "platform.claude.com -> API keys",
      optional: false,
      secret: true,
      present: hasCredential("ANTHROPIC_API_KEY"),
      usedBy: ["The AI engine (API steps)"],
    });
  }

  for (const node of plan.nodes) {
    const exec = registry[node.type];
    if (!exec) continue;
    for (const req of exec.requiredCredentials) {
      const existing = byName.get(req.name);
      if (existing) {
        existing.usedBy.push(node.title);
      } else {
        byName.set(req.name, {
          ...req,
          present: hasCredential(req.name),
          usedBy: [node.title],
        });
      }
    }
  }

  return Array.from(byName.values());
}
