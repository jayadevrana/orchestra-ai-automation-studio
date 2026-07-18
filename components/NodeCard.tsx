"use client";

import type { WorkflowNode } from "@/lib/engine/types";

export type NodeStatus = "pending" | "running" | "done" | "error";

export const NODE_W = 210;
export const NODE_H = 66;
export const GAP_X = 92;
export const PAD_X = 40;
export const ROW_Y = 56;

const ICONS: Record<string, string> = {
  trigger: "⏰",
  research: "🔎",
  researchNiche: "🧭",
  researchTrending: "📈",
  writeBlog: "✍️",
  writeReport: "📝",
  draftEmail: "✉️",
  publishWordPress: "🌐",
  planContent: "🧠",
  writeScript: "🖋️",
  generateImage: "🎨",
  imageToVideo: "🎬",
};

const SUB: Record<string, string> = {
  researchNiche: "reads your site",
  researchTrending: "trending angle",
  writeBlog: "Claude subscription",
  planContent: "Claude subscription",
  writeScript: "Claude subscription",
  generateImage: "ChatGPT subscription",
  imageToVideo: "Grok subscription",
};

function subtitle(node: WorkflowNode): string {
  if (node.type === "trigger") return node.schedule || "on demand";
  if (node.type === "research") return node.query || "research";
  if (node.type === "writeBlog") return node.topic || "blog post";
  if (node.type === "draftEmail") return node.to ? `to ${node.to}` : "email";
  return SUB[node.type] || node.type;
}

export default function NodeCard({
  node,
  index,
  status,
  needsKey,
  selected,
  onSelect,
  onKeyBadge,
}: {
  node: WorkflowNode;
  index: number;
  status: NodeStatus;
  needsKey: boolean;
  selected: boolean;
  onSelect: () => void;
  onKeyBadge: () => void;
}) {
  const x = PAD_X + index * (NODE_W + GAP_X);
  const clickable = status === "done" || status === "error";

  return (
    <div
      className={`node ${clickable ? "clickable" : ""} ${selected ? "selected" : ""}`}
      data-status={status}
      style={{
        left: x,
        top: ROW_Y,
        width: NODE_W,
        height: NODE_H,
        animationDelay: `${index * 70}ms`,
      }}
      onClick={clickable ? onSelect : undefined}
    >
      {index > 0 && <span className="port in" />}
      <span className="port out" />
      {needsKey && (
        <span
          className="keybadge"
          onClick={(e) => {
            e.stopPropagation();
            onKeyBadge();
          }}
        >
          🔑 key
        </span>
      )}
      <div className="ico">{ICONS[node.type] || "⚙️"}</div>
      <div className="txt">
        <div className="name">{node.title}</div>
        <div className="kind">{subtitle(node)}</div>
      </div>
      <div className="status-ico">
        {status === "running" && <span className="spinner" />}
        {status === "done" && <span className="check">✓</span>}
        {status === "error" && <span className="err">✕</span>}
      </div>
    </div>
  );
}
