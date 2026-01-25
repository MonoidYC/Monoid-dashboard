"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type MarkerType,
} from "@xyflow/react";
import type { EdgeType } from "@/lib/graph/types";

const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  calls: "calls",
  imports: "imports",
  exports: "exports",
  extends: "extends",
  implements: "implements",
  routes_to: "routes to",
  depends_on: "depends on",
  uses: "uses",
  defines: "defines",
  references: "refs",
  other: "",
};

interface DependencyEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: any;
  targetPosition: any;
  data?: {
    edgeType?: EdgeType;
    isHighlighted?: boolean;
  };
  style?: React.CSSProperties;
  selected?: boolean;
  markerEnd?: MarkerType | string;
}

function DependencyEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  selected,
  markerEnd,
}: DependencyEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isHighlighted = data?.isHighlighted;
  const label = data?.edgeType ? EDGE_TYPE_LABELS[data.edgeType] : "";

  // Determine edge color based on state
  const edgeColor = isHighlighted || selected 
    ? "rgba(255, 255, 255, 0.8)" 
    : "rgba(255, 255, 255, 0.25)";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: selected || isHighlighted ? 2 : 1,
          opacity: 1,
        }}
      />
      {(selected || isHighlighted) && label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className="px-2 py-0.5 rounded bg-[#1c1c22] border border-white/10 text-[10px] text-gray-300 shadow-lg"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const DependencyEdge = memo(DependencyEdgeComponent);
