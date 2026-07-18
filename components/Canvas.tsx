"use client";

import type { WorkflowPlan } from "@/lib/engine/types";
import NodeCard, {
  GAP_X,
  NODE_H,
  NODE_W,
  PAD_X,
  ROW_Y,
  type NodeStatus,
} from "./NodeCard";

function edgePath(i: number): string {
  const y = ROW_Y + NODE_H / 2;
  const x1 = PAD_X + i * (NODE_W + GAP_X) + NODE_W;
  const x2 = PAD_X + (i + 1) * (NODE_W + GAP_X);
  const c = GAP_X * 0.5;
  return `M ${x1} ${y} C ${x1 + c} ${y}, ${x2 - c} ${y}, ${x2} ${y}`;
}

export default function Canvas({
  plan,
  statuses,
  needsKeyIds,
  selectedId,
  onSelect,
  onKeyBadge,
}: {
  plan: WorkflowPlan;
  statuses: Record<string, NodeStatus>;
  needsKeyIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onKeyBadge: () => void;
}) {
  const n = plan.nodes.length;
  const width = PAD_X * 2 + n * NODE_W + (n - 1) * GAP_X;
  const height = ROW_Y * 2 + NODE_H;

  function edgeState(i: number): string {
    const a = statuses[plan.nodes[i].id] ?? "pending";
    const b = statuses[plan.nodes[i + 1].id] ?? "pending";
    if (b === "running") return "active";
    if (a === "done" && b === "done") return "done";
    if (a === "done") return "active";
    return "pending";
  }

  return (
    <div className="canvas" style={{ width: Math.max(width, 100), height: Math.max(height, 100) }}>
      <svg className="edges" width={width} height={height}>
        {plan.nodes.slice(0, -1).map((_, i) => {
          const state = edgeState(i);
          const d = edgePath(i);
          return (
            <g key={i}>
              <path id={`edge-${i}`} className={`edge ${state}`} d={d} />
              {state === "active" && (
                <circle className="edge-dot" r="3.5">
                  <animateMotion dur="1s" repeatCount="indefinite">
                    <mpath href={`#edge-${i}`} />
                  </animateMotion>
                </circle>
              )}
            </g>
          );
        })}
      </svg>

      {plan.nodes.map((node, i) => (
        <NodeCard
          key={node.id}
          node={node}
          index={i}
          status={statuses[node.id] ?? "pending"}
          needsKey={needsKeyIds.has(node.id)}
          selected={selectedId === node.id}
          onSelect={() => onSelect(node.id)}
          onKeyBadge={onKeyBadge}
        />
      ))}
    </div>
  );
}
