"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Monitor,
  Server,
  Share2,
  HelpCircle,
  Loader2,
} from "lucide-react";
import type { GraphFilters, NodeType, ClusterType } from "@/lib/graph/types";
import { NODE_TYPE_COLORS, CLUSTER_COLORS } from "@/lib/graph/types";

interface ControlsPanelProps {
  filters: GraphFilters;
  onSearchChange: (query: string) => void;
  onToggleNodeType: (nodeType: NodeType) => void;
  onToggleCluster: (cluster: ClusterType) => void;
  onReset: () => void;
  onRestartLayout: () => void;
  isSimulating: boolean;
  nodeCount: number;
  edgeCount: number;
}

const CLUSTER_ICONS: Record<ClusterType, React.ReactNode> = {
  frontend: <Monitor className="w-3 h-3" />,
  backend: <Server className="w-3 h-3" />,
  shared: <Share2 className="w-3 h-3" />,
  unknown: <HelpCircle className="w-3 h-3" />,
};

const NODE_TYPE_GROUPS: Record<string, NodeType[]> = {
  Functions: ["function", "method", "handler"],
  Classes: ["class", "component", "module"],
  API: ["endpoint", "middleware", "hook"],
  Types: ["type", "interface", "variable", "constant"],
  Other: ["test", "other"],
};

export function ControlsPanel({
  filters,
  onSearchChange,
  onToggleNodeType,
  onToggleCluster,
  onReset,
  onRestartLayout,
  isSimulating,
  nodeCount,
  edgeCount,
}: ControlsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showNodeTypes, setShowNodeTypes] = useState(false);

  return (
    <div className="absolute top-4 left-4 z-10 w-56">
      {/* Main panel */}
      <div className="bg-[#0c0c0e] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-white/40" />
            <span className="font-medium text-xs text-white/80">Filters</span>
            <span className="text-[10px] text-white/30">
              {nodeCount} · {edgeCount}
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>

        {isExpanded && (
          <div className="p-3 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search..."
                value={filters.searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 bg-[#18181c] border border-white/5 rounded-lg text-xs placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-transparent"
              />
            </div>

            {/* Cluster filters */}
            <div>
              <div className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-1.5">
                Clusters
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(CLUSTER_COLORS) as ClusterType[]).map((cluster) => {
                  const isActive = filters.clusters.includes(cluster);
                  return (
                    <button
                      key={cluster}
                      onClick={() => onToggleCluster(cluster)}
                      className={`
                        flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                        transition-all border
                        ${
                          isActive
                            ? "border-transparent"
                            : "border-white/5 bg-white/3 text-gray-500"
                        }
                      `}
                      style={
                        isActive
                          ? {
                              backgroundColor: `${CLUSTER_COLORS[cluster]}20`,
                              color: CLUSTER_COLORS[cluster],
                              borderColor: `${CLUSTER_COLORS[cluster]}40`,
                            }
                          : undefined
                      }
                    >
                      <span className="capitalize">{cluster}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Node type filters */}
            <div>
              <button
                onClick={() => setShowNodeTypes(!showNodeTypes)}
                className="flex items-center justify-between w-full text-xs font-medium text-gray-400 mb-2"
              >
                <span>Node Types</span>
                {showNodeTypes ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {showNodeTypes && (
                <div className="space-y-3">
                  {Object.entries(NODE_TYPE_GROUPS).map(([group, types]) => (
                    <div key={group}>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                        {group}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {types.map((nodeType) => {
                          const isActive = filters.nodeTypes.includes(nodeType);
                          return (
                            <button
                              key={nodeType}
                              onClick={() => onToggleNodeType(nodeType)}
                              className={`
                                px-2 py-1 rounded text-[10px] font-medium
                                transition-all border
                                ${
                                  isActive
                                    ? "border-transparent"
                                    : "border-white/5 bg-white/3 text-gray-600"
                                }
                              `}
                              style={
                                isActive
                                  ? {
                                      backgroundColor: `${NODE_TYPE_COLORS[nodeType]}20`,
                                      color: NODE_TYPE_COLORS[nodeType],
                                      borderColor: `${NODE_TYPE_COLORS[nodeType]}40`,
                                    }
                                  : undefined
                              }
                            >
                              {nodeType}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-1.5 pt-2 border-t border-white/5">
              <button
                onClick={onRestartLayout}
                disabled={isSimulating}
                className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/15 disabled:opacity-50 rounded text-[10px] font-medium transition-colors"
              >
                {isSimulating ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-2.5 h-2.5" />
                )}
                Re-layout
              </button>
              <button
                onClick={onReset}
                className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-medium transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
