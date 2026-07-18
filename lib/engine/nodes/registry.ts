import type { NodeExecutor, NodeType } from "../types";
import { draftEmail } from "./draftEmail";
import { generateImage } from "./generateImage";
import { imageToVideo } from "./imageToVideo";
import { planContent } from "./planContent";
import { publishWordPress } from "./publishWordPress";
import { research } from "./research";
import { researchNiche } from "./researchNiche";
import { researchTrending } from "./researchTrending";
import { trigger } from "./trigger";
import { writeBlog } from "./writeBlog";
import { writeReport } from "./writeReport";
import { writeScript } from "./writeScript";

/**
 * The registry is Orchestra's extensibility spine: adding a new integration =
 * adding one node file and registering it here. The planner schema, executor,
 * credential inspection, and canvas icons all flow from this map.
 */
export const registry: Record<NodeType, NodeExecutor> = {
  trigger,
  research,
  researchNiche,
  researchTrending,
  writeBlog,
  writeReport,
  draftEmail,
  publishWordPress,
  planContent,
  writeScript,
  generateImage,
  imageToVideo,
};

/** Emoji per node type, for the canvas. */
export const nodeIcon = Object.fromEntries(
  (Object.keys(registry) as NodeType[]).map((t) => [t, registry[t].icon]),
) as Record<NodeType, string>;
