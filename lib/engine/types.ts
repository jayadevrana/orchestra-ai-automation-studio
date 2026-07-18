import { z } from "zod";
import type { LLMClient } from "../anthropic";

// ---------------------------------------------------------------------------
// Workflow plan
// ---------------------------------------------------------------------------

export const NODE_TYPES = [
  "trigger",
  "research",
  "researchNiche",
  "researchTrending",
  "writeBlog",
  "writeReport",
  "draftEmail",
  "publishWordPress",
  // Multi-model creative pipeline (uses logged-in CLI subscriptions, not API keys)
  "planContent",
  "writeScript",
  "generateImage",
  "imageToVideo",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

// Which engine backs a node: the Anthropic API, one of the logged-in CLI
// subscriptions, or nothing (pure integration).
export type ProviderTag =
  | "anthropic-api"
  | "claude-cli"
  | "codex-cli"
  | "grok-cli"
  | "none";

// A single node. Fields are a flat superset across node types so the planner can
// emit a strict JSON schema. Each node reads only the fields it needs.
export const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(NODE_TYPES),
  title: z.string(),
  schedule: z.string().optional(), // trigger (e.g. "every day 9am")
  query: z.string().optional(), // research
  topic: z.string().optional(), // writeBlog headline/topic
  instructions: z.string().optional(), // writeBlog / writeReport / draftEmail
  to: z.string().optional(), // draftEmail
  subject: z.string().optional(), // draftEmail
});
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

export const WorkflowPlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  nodes: z.array(WorkflowNodeSchema),
});
export type WorkflowPlan = z.infer<typeof WorkflowPlanSchema>;

// Raw JSON Schema handed to the Anthropic planner as a strict tool. MUST stay in
// sync with WorkflowNodeSchema above. Strict-schema rules: every object needs
// additionalProperties:false + a `required` array; no min/max/length keywords.
export const PLAN_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "nodes"],
  properties: {
    title: { type: "string", description: "Short title for the whole automation." },
    summary: { type: "string", description: "One sentence restating what this workflow does." },
    nodes: {
      type: "array",
      description: "Steps in execution order.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "type", "title"],
        properties: {
          id: { type: "string", description: "Unique id: n1, n2, n3..." },
          type: { type: "string", enum: [...NODE_TYPES] },
          title: { type: "string", description: "Short human label for this step." },
          schedule: {
            type: "string",
            description: "For trigger nodes: when it fires, e.g. 'every day 9am'.",
          },
          query: { type: "string", description: "For research: what to research." },
          topic: { type: "string", description: "For writeBlog: the blog topic/headline." },
          instructions: {
            type: "string",
            description: "For writeBlog / writeReport / draftEmail: what to produce.",
          },
          to: { type: "string", description: "For draftEmail: the recipient." },
          subject: { type: "string", description: "For draftEmail: subject hint." },
        },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export interface CredentialRequirement {
  name: string; // env var name, e.g. WORDPRESS_APP_PASSWORD
  where: string; // where to get it
  optional: boolean;
  secret?: boolean; // true = masked input (keys/passwords); false = plain (e.g. a URL)
}

export interface CredentialStatus extends CredentialRequirement {
  present: boolean;
  usedBy: string[]; // node titles that need it
}

// ---------------------------------------------------------------------------
// Node executor contract (the extensibility spine)
// ---------------------------------------------------------------------------

export interface NodeContext {
  goal: string;
  inputs: Record<string, unknown>; // outputs of previously-run nodes, keyed by node id
  anthropic: LLMClient;
  emit: (message: string) => void; // node-level progress log
}

export interface NodeExecutor {
  type: NodeType;
  title: string;
  icon: string; // emoji shown on the canvas node
  provider: ProviderTag; // which engine runs this node
  requiredCredentials: CredentialRequirement[];
  run(node: WorkflowNode, ctx: NodeContext): Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Run events (streamed to the browser as SSE)
// ---------------------------------------------------------------------------

export type RunEvent =
  | { kind: "run_start"; total: number; title: string; simulated?: boolean }
  | { kind: "node_start"; id: string; type: NodeType; title: string }
  | { kind: "node_log"; id: string; message: string }
  | { kind: "node_output"; id: string; output: Record<string, unknown> }
  | { kind: "node_error"; id: string; message: string }
  | { kind: "run_done"; outputs: Record<string, unknown> }
  | { kind: "run_error"; message: string };

export type Emit = (event: RunEvent) => void;
