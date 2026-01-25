"use client";

import { useState } from "react";
import {
  Filter,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  MinusCircle,
  Clock,
} from "lucide-react";
import type { TestType, TestStatus } from "@/lib/test/types";
import { TEST_TYPE_COLORS, TEST_TYPE_LABELS, TEST_STATUS_COLORS } from "@/lib/test/types";

interface TestStats {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;
}

interface TestControlsPanelProps {
  stats: TestStats;
  availableTypes: TestType[];
  activeTypeFilter: TestType | null;
  activeStatusFilter: TestStatus | null;
  onTypeFilterChange: (type: TestType | null) => void;
  onStatusFilterChange: (status: TestStatus | null) => void;
}

const STATUS_ICONS: Record<TestStatus, React.ComponentType<{ className?: string }>> = {
  passed: CheckCircle,
  failed: XCircle,
  skipped: MinusCircle,
  pending: Clock,
};

const STATUS_LABELS: Record<TestStatus, string> = {
  passed: "Passed",
  failed: "Failed",
  skipped: "Skipped",
  pending: "Pending",
};

export function TestControlsPanel({
  stats,
  availableTypes,
  activeTypeFilter,
  activeStatusFilter,
  onTypeFilterChange,
  onStatusFilterChange,
}: TestControlsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="absolute top-4 left-4 z-10 w-52">
      <div className="bg-[#0c0c0e] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-white/40" />
            <span className="font-medium text-xs text-white/80">Tests</span>
            <span className="text-[10px] text-white/30">{stats.total}</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-white/40" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-white/40" />
          )}
        </div>

        {isExpanded && (
          <div className="p-3 space-y-3">
            {/* Status Summary */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">
                Status
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["passed", "failed", "pending", "skipped"] as TestStatus[]).map((status) => {
                  const StatusIcon = STATUS_ICONS[status];
                  const count = stats[status as keyof TestStats] || 0;
                  const isActive = activeStatusFilter === status;
                  
                  return (
                    <button
                      key={status}
                      onClick={() => onStatusFilterChange(isActive ? null : status)}
                      className={`
                        flex items-center gap-1.5 px-2 py-1.5 rounded text-left
                        transition-all border
                        ${isActive 
                          ? "border-transparent" 
                          : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                        }
                      `}
                      style={isActive ? {
                        backgroundColor: `${TEST_STATUS_COLORS[status]}15`,
                        borderColor: `${TEST_STATUS_COLORS[status]}30`,
                      } : undefined}
                    >
                      <span style={{ color: TEST_STATUS_COLORS[status] }}>
                        <StatusIcon className="w-3 h-3" />
                      </span>
                      <div className="flex-1">
                        <div 
                          className="text-[10px] font-medium"
                          style={{ color: isActive ? TEST_STATUS_COLORS[status] : "rgba(255,255,255,0.6)" }}
                        >
                          {count} {STATUS_LABELS[status]}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Test Types */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">
                Type
              </div>
              <div className="flex flex-wrap gap-1">
                {/* All button */}
                <button
                  onClick={() => onTypeFilterChange(null)}
                  className={`
                    flex items-center gap-1.5 px-2 py-1 rounded text-left
                    transition-all border text-[10px] font-medium
                    ${activeTypeFilter === null 
                      ? "bg-white/10 border-white/10 text-white" 
                      : "border-white/5 bg-white/[0.02] text-white/50 hover:bg-white/[0.04]"
                    }
                  `}
                >
                  All
                </button>

                {/* Type buttons */}
                {availableTypes.map((type) => {
                  const isActive = activeTypeFilter === type;
                  const color = TEST_TYPE_COLORS[type];
                  
                  return (
                    <button
                      key={type}
                      onClick={() => onTypeFilterChange(isActive ? null : type)}
                      className={`
                        flex items-center gap-1 px-2 py-1 rounded text-left
                        transition-all border text-[10px] font-medium
                        ${isActive 
                          ? "border-transparent" 
                          : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                        }
                      `}
                      style={isActive ? {
                        backgroundColor: `${color}15`,
                        borderColor: `${color}30`,
                        color: color,
                      } : { color: "rgba(255,255,255,0.5)" }}
                    >
                      <div 
                        className="w-1.5 h-1.5 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                      {TEST_TYPE_LABELS[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clear Filters */}
            {(activeTypeFilter || activeStatusFilter) && (
              <button
                onClick={() => {
                  onTypeFilterChange(null);
                  onStatusFilterChange(null);
                }}
                className="w-full py-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
