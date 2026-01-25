"use client";

import { memo } from "react";
import { Monitor, Server, Share2, HelpCircle } from "lucide-react";
import type { ClusterType } from "@/lib/graph/types";
import { CLUSTER_COLORS } from "@/lib/graph/types";

interface ClusterNodeData {
  cluster: ClusterType;
  label: string;
  nodeCount: number;
  isExpanded: boolean;
}

interface ClusterNodeProps {
  data: ClusterNodeData;
}

const CLUSTER_ICONS: Record<ClusterType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  frontend: Monitor,
  backend: Server,
  shared: Share2,
  unknown: HelpCircle,
};

const CLUSTER_LABELS: Record<ClusterType, string> = {
  frontend: "Frontend",
  backend: "Backend",
  shared: "Shared",
  unknown: "Other",
};

function ClusterNodeComponent({ data }: ClusterNodeProps) {
  const Icon = CLUSTER_ICONS[data.cluster];
  const color = CLUSTER_COLORS[data.cluster];
  const label = data.label || CLUSTER_LABELS[data.cluster];

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 border-dashed
        flex items-center gap-3 min-w-[150px]
        transition-all duration-200 hover:scale-105
      `}
      style={{
        backgroundColor: `${color}08`,
        borderColor: `${color}30`,
      }}
    >
      <div
        className="p-2 rounded-lg"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <div className="font-semibold text-sm" style={{ color }}>
          {label}
        </div>
        <div className="text-xs text-gray-500">
          {data.nodeCount} nodes
        </div>
      </div>
    </div>
  );
}

export const ClusterNode = memo(ClusterNodeComponent);
