"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  FunctionSquare,
  Workflow,
  Box,
  Component,
  Globe,
  Zap,
  Layers,
  Anchor,
  Package,
  Variable,
  Type,
  FileType,
  Hash,
  FlaskConical,
  Code,
} from "lucide-react";
import type { CodeNodeData, NodeType } from "@/lib/graph/types";
import { NODE_TYPE_COLORS } from "@/lib/graph/types";

// Icon mapping
const ICONS: Record<NodeType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  function: FunctionSquare,
  method: Workflow,
  class: Box,
  component: Component,
  endpoint: Globe,
  handler: Zap,
  middleware: Layers,
  hook: Anchor,
  module: Package,
  variable: Variable,
  type: Type,
  interface: FileType,
  constant: Hash,
  test: FlaskConical,
  other: Code,
};

interface CodeNodeProps {
  data: CodeNodeData;
  selected?: boolean;
}

function CodeNodeComponent({ data, selected }: CodeNodeProps) {
  const Icon = ICONS[data.nodeType] || Code;
  const nodeColor = NODE_TYPE_COLORS[data.nodeType];

  const isHighlighted = data.isHighlighted;
  const isFaded = data.isFaded;

  return (
    <>
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-white/30 !border-none"
      />

      {/* Node content */}
      <div
        className={`
          relative px-3.5 py-2.5 rounded-xl border
          transition-all duration-200 min-w-[200px] max-w-[280px]
          ${selected ? "ring-2 ring-white/40 scale-[1.02]" : ""}
          ${isHighlighted ? "ring-2 ring-white/30 scale-[1.02]" : ""}
          ${isFaded ? "opacity-20" : "opacity-100"}
        `}
        style={{
          backgroundColor: `${nodeColor}10`,
          borderColor: `${nodeColor}30`,
          boxShadow: selected || isHighlighted
            ? `0 0 24px ${nodeColor}25`
            : `0 2px 12px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Summary - primary content, shown first */}
        {data.summary && (
          <p className="text-[12px] text-white/80 leading-relaxed mb-2.5 font-light">
            {data.summary}
          </p>
        )}

        {/* Divider */}
        {data.summary && (
          <div className="border-t border-white/5 mb-2" />
        )}

        {/* Header with icon, name, and type badge */}
        <div className="flex items-center gap-2">
          <div
            className="p-1 rounded"
            style={{ backgroundColor: `${nodeColor}20` }}
          >
            <Icon className="w-3 h-3" style={{ color: nodeColor }} />
          </div>
          <span className="font-medium text-[11px] text-white/70 truncate flex-1">
            {data.name}
          </span>
          <span 
            className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ 
              color: nodeColor,
              backgroundColor: `${nodeColor}15`,
            }}
          >
            {data.nodeType}
          </span>
        </div>

        {/* File path */}
        <div className="text-[10px] text-gray-600 truncate mt-1 pl-7">
          {data.filePath.split("/").pop()}:{data.startLine}
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-white/30 !border-none"
      />
    </>
  );
}

export const CodeNode = memo(CodeNodeComponent);
