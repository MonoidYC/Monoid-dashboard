"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  Chrome,
  FlaskConical,
  Shield,
  Terminal,
  Send,
  Activity,
  Play,
  FileCode,
  Sparkles,
  Globe,
  Github,
} from "lucide-react";
import type { TestNodeData, TestType, SourceType } from "@/lib/test/types";
import {
  TEST_TYPE_COLORS,
  TEST_TYPE_LABELS,
  TEST_STATUS_COLORS,
  formatDuration,
  formatRelativeTime,
} from "@/lib/test/types";

// Runner icon mapping
const RUNNER_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  playwright: Chrome,
  cypress: Chrome,
  jest: FlaskConical,
  vitest: FlaskConical,
  zap: Shield,
  curl: Terminal,
  postman: Send,
  k6: Activity,
  artillery: Activity,
  default: Play,
};

// Source type icons
const SOURCE_ICONS: Record<SourceType, React.ComponentType<{ className?: string }>> = {
  file: FileCode,
  generated: Sparkles,
  external: Globe,
};

interface TestNodeProps {
  data: TestNodeData;
  selected?: boolean;
}

function TestNodeComponent({ data, selected }: TestNodeProps) {
  const typeColor = TEST_TYPE_COLORS[data.testType];
  const statusColor = data.lastStatus ? TEST_STATUS_COLORS[data.lastStatus] : "#6b7280";
  const RunnerIcon = RUNNER_ICONS[data.runner || "default"] || RUNNER_ICONS.default;
  const SourceIcon = SOURCE_ICONS[data.sourceType];

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
          relative px-4 py-3 rounded-xl border
          transition-all duration-200 min-w-[260px] max-w-[320px]
          ${selected ? "ring-2 ring-white/40 scale-[1.02]" : ""}
          ${isHighlighted ? "ring-2 ring-white/30 scale-[1.02]" : ""}
          ${isFaded ? "opacity-20" : "opacity-100"}
        `}
        style={{
          backgroundColor: `${typeColor}10`,
          borderColor: `${typeColor}30`,
          boxShadow: selected || isHighlighted
            ? `0 0 24px ${typeColor}25`
            : `0 2px 12px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Status indicator dot */}
        <div
          className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: statusColor }}
          title={data.lastStatus || "No status"}
        />

        {/* Test name (primary content) */}
        <p className="text-[13px] text-white/90 leading-relaxed pr-6 font-medium mb-2">
          {data.name}
        </p>

        {/* Divider */}
        <div className="border-t border-white/5 mb-2" />

        {/* Meta row: type badge, runner, source */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type badge */}
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{
              color: typeColor,
              backgroundColor: `${typeColor}20`,
            }}
          >
            {TEST_TYPE_LABELS[data.testType]}
          </span>

          {/* Runner */}
          {data.runner && (
            <div
              className="flex items-center gap-1 text-[10px] text-white/50"
              title={`Runner: ${data.runner}`}
            >
              <RunnerIcon className="w-3 h-3" />
              <span className="capitalize">{data.runner}</span>
            </div>
          )}

          {/* Source type */}
          <div
            className="flex items-center gap-1 text-[10px] text-white/40"
            title={`Source: ${data.sourceType}`}
          >
            <SourceIcon className="w-3 h-3" />
          </div>
        </div>

        {/* Duration and last run */}
        <div className="flex items-center gap-3 mt-2 text-[10px] text-white/40">
          {data.lastDurationMs !== null && (
            <span>{formatDuration(data.lastDurationMs)}</span>
          )}
          {data.lastRunAt && (
            <span>{formatRelativeTime(data.lastRunAt)}</span>
          )}
          {data.coveredCodeCount > 0 && (
            <span className="ml-auto text-white/30">
              {data.coveredCodeCount} code node{data.coveredCodeCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* File path (if file-based) and GitHub link */}
        {(data.filePath || data.githubLink) && (
          <div className="flex items-center justify-between mt-1.5">
            <div className="text-[9px] text-gray-600 truncate flex-1">
        {data.filePath && (
                <>
            {data.filePath.split("/").slice(-2).join("/")}
            {data.startLine && `:${data.startLine}`}
                </>
              )}
            </div>
            {data.githubLink && (
              <a
                href={data.githubLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:bg-white/10 rounded transition-colors ml-1"
                title="View on GitHub"
              >
                <Github className="w-3 h-3 text-white/40 hover:text-white/70" />
              </a>
            )}
          </div>
        )}
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

export const TestNode = memo(TestNodeComponent);
