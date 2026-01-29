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
  Code,
  Github,
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
  test: Code,
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
        className="!w-2 !h-2 !border-none !bg-white/30 transition-all"
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
          boxShadow:
            selected || isHighlighted ? `0 0 24px ${nodeColor}25` : `0 2px 12px rgba(0,0,0,0.5)`,
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

        {/* Footer: File path, connect button, and GitHub link */}
        <div className="flex items-center justify-between mt-1 pl-7">
          <div className="text-[10px] text-gray-600 truncate flex-1">
            {data.filePath.split("/").pop()}:{data.startLine}
          </div>
          <div className="flex items-center gap-0.5">
            {data.githubLink && (
              <a
                href={data.githubLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="View on GitHub"
              >
                <Github className="w-3 h-3 text-white/40 hover:text-white/70" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !border-none !bg-white/30 transition-all"
      />
    </>
  );
}

export const CodeNode = memo(CodeNodeComponent);
