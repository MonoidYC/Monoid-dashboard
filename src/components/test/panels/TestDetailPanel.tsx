"use client";

import { useEffect, useState } from "react";
import {
  X,
  ExternalLink,
  Clock,
  Play,
  FileCode,
  Sparkles,
  Globe,
  AlertCircle,
  CheckCircle,
  XCircle,
  MinusCircle,
  Code,
} from "lucide-react";
import type {
  TestGraphNode,
  RepoRow,
  RepoVersionRow,
  CodeNodeRow,
  SourceType,
} from "@/lib/test/types";
import {
  TEST_TYPE_COLORS,
  TEST_TYPE_LABELS,
  TEST_STATUS_COLORS,
  formatDuration,
  formatRelativeTime,
  getRunnerDisplayName,
} from "@/lib/test/types";
import { fetchCoveredCodeNodes } from "@/lib/test/queries";

// Source type icons
const SOURCE_ICONS: Record<SourceType, React.ComponentType<{ className?: string }>> = {
  file: FileCode,
  generated: Sparkles,
  external: Globe,
};

// Status icons
const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  passed: CheckCircle,
  failed: XCircle,
  skipped: MinusCircle,
  pending: Clock,
};

interface TestDetailPanelProps {
  node: TestGraphNode | null;
  repo?: RepoRow | null;
  version?: RepoVersionRow | null;
  onClose: () => void;
}

export function TestDetailPanel({
  node,
  repo,
  version,
  onClose,
}: TestDetailPanelProps) {
  const [coveredNodes, setCoveredNodes] = useState<CodeNodeRow[]>([]);
  const [isLoadingCoverage, setIsLoadingCoverage] = useState(false);

  // Fetch covered code nodes when selected node changes
  useEffect(() => {
    if (!node) {
      setCoveredNodes([]);
      return;
    }

    setIsLoadingCoverage(true);
    fetchCoveredCodeNodes(node.id).then(({ codeNodes }) => {
      setCoveredNodes(codeNodes);
      setIsLoadingCoverage(false);
    });
  }, [node?.id]);

  if (!node) return null;

  const { data } = node;
  const typeColor = TEST_TYPE_COLORS[data.testType];
  const statusColor = data.lastStatus ? TEST_STATUS_COLORS[data.lastStatus] : "#6b7280";
  const SourceIcon = SOURCE_ICONS[data.sourceType];
  const StatusIcon = data.lastStatus ? STATUS_ICONS[data.lastStatus] : Clock;

  // Build GitHub link - prefer direct link from node, otherwise generate from repo info
  const githubLink = data.githubLink
    ? data.githubLink
    : repo && version && data.filePath
      ? `https://github.com/${repo.owner}/${repo.name}/blob/${version.commit_sha}/${data.filePath}${
          data.startLine ? `#L${data.startLine}` : ""
        }`
      : null;

  return (
    <div className="absolute top-0 right-0 h-full w-[380px] bg-[#0c0c0e] border-l border-white/5 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-[#0c0c0e] border-b border-white/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Status and type */}
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: statusColor }}>
                <StatusIcon className="w-4 h-4" />
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                style={{
                  color: typeColor,
                  backgroundColor: `${typeColor}20`,
                }}
              >
                {TEST_TYPE_LABELS[data.testType]}
              </span>
            </div>

            {/* Test name */}
            <h3 className="text-[15px] font-medium text-white/90 leading-snug">
              {data.name}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-white/40" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-5">
        {/* Description */}
        {data.description && (
          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-white/30 mb-2">
              Description
            </h4>
            <p className="text-sm text-white/60 leading-relaxed">
              {data.description}
            </p>
          </div>
        )}

        {/* Last Run Info */}
        <div>
          <h4 className="text-[11px] uppercase tracking-wider text-white/30 mb-2">
            Last Run
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="text-[10px] text-white/30 mb-1">Status</div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: statusColor }}
                />
                <span className="text-sm text-white/70 capitalize">
                  {data.lastStatus || "Unknown"}
                </span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="text-[10px] text-white/30 mb-1">Duration</div>
              <div className="text-sm text-white/70">
                {formatDuration(data.lastDurationMs)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] col-span-2">
              <div className="text-[10px] text-white/30 mb-1">Last Run At</div>
              <div className="text-sm text-white/70">
                {formatRelativeTime(data.lastRunAt)}
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {data.lastError && (
          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-red-400/60 mb-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Error
            </h4>
            <pre className="text-xs text-red-400/80 bg-red-500/5 border border-red-500/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
              {data.lastError}
            </pre>
          </div>
        )}

        {/* Execution Details */}
        <div>
          <h4 className="text-[11px] uppercase tracking-wider text-white/30 mb-2">
            Execution
          </h4>
          <div className="space-y-2">
            {/* Runner */}
            <div className="flex items-center gap-2 text-sm">
              <Play className="w-3.5 h-3.5 text-white/30" />
              <span className="text-white/50">Runner:</span>
              <span className="text-white/70">
                {getRunnerDisplayName(data.runner)}
              </span>
            </div>

            {/* Source */}
            <div className="flex items-center gap-2 text-sm">
              <SourceIcon className="w-3.5 h-3.5 text-white/30" />
              <span className="text-white/50">Source:</span>
              <span className="text-white/70 capitalize">{data.sourceType}</span>
            </div>

            {/* Command */}
            {data.command && (
              <div className="mt-2">
                <div className="text-[10px] text-white/30 mb-1">Command</div>
                <code className="text-xs text-white/60 bg-white/[0.03] px-2 py-1 rounded block overflow-x-auto">
                  {data.command}
                </code>
              </div>
            )}
          </div>
        </div>

        {/* File Location */}
        {data.filePath && (
          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-white/30 mb-2">
              Location
            </h4>
            <div className="flex items-start gap-2">
              <FileCode className="w-3.5 h-3.5 text-white/30 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white/60 truncate font-mono">
                  {data.filePath}
                </div>
                {data.startLine && (
                  <div className="text-xs text-white/40 mt-0.5">
                    Lines {data.startLine}
                    {data.endLine && data.endLine !== data.startLine
                      ? `-${data.endLine}`
                      : ""}
                  </div>
                )}
              </div>
              {githubLink && (
                <a
                  href={githubLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:bg-white/5 rounded transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-white/30" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Covered Code Nodes */}
        <div>
          <h4 className="text-[11px] uppercase tracking-wider text-white/30 mb-2 flex items-center gap-1">
            <Code className="w-3 h-3" />
            Covered Code ({coveredNodes.length})
          </h4>
          {isLoadingCoverage ? (
            <div className="text-xs text-white/40">Loading...</div>
          ) : coveredNodes.length === 0 ? (
            <div className="text-xs text-white/30 italic">
              No code coverage data
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {coveredNodes.map((codeNode) => (
                <div
                  key={codeNode.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/70 truncate font-medium">
                      {codeNode.name}
                    </div>
                    <div className="text-[10px] text-white/40 truncate">
                      {codeNode.file_path.split("/").pop()}:{codeNode.start_line}
                    </div>
                  </div>
                  <span className="text-[9px] text-white/30 uppercase">
                    {codeNode.node_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metadata */}
        {Object.keys(data.metadata || {}).length > 0 && (
          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-white/30 mb-2">
              Metadata
            </h4>
            <pre className="text-xs text-white/50 bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 overflow-x-auto">
              {JSON.stringify(data.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
