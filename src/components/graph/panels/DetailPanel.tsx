"use client";

import { useMemo } from "react";
import {
  X,
  ExternalLink,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileCode,
  GitCommit,
} from "lucide-react";
import type { GraphNode, RepoRow, RepoVersionRow } from "@/lib/graph/types";
import { NODE_TYPE_COLORS, CLUSTER_COLORS, type ClusterType } from "@/lib/graph/types";
import { generateGitHubPermalink } from "@/lib/graph/queries";

const CLUSTER_OPTIONS: ClusterType[] = ["frontend", "backend", "shared", "unknown"];

interface DetailPanelProps {
  node: GraphNode | null;
  repo?: RepoRow | null;
  version?: RepoVersionRow | null;
  connectedNodes: {
    incoming: GraphNode[];
    outgoing: GraphNode[];
  };
  onClose: () => void;
  onNodeSelect: (node: GraphNode) => void;
  onClusterChange?: (nodeId: string, cluster: ClusterType) => void;
}

export function DetailPanel({
  node,
  repo,
  version,
  connectedNodes,
  onClose,
  onNodeSelect,
  onClusterChange,
}: DetailPanelProps) {
  // Generate GitHub permalink - prefer direct link from node, otherwise generate from repo info
  const permalink = useMemo(() => {
    if (!node) return null;
    // Prefer the direct github_link from the node if available
    if (node.data.githubLink) return node.data.githubLink;
    // Fall back to generating from repo/version info
    if (!repo || !version) return null;
    return generateGitHubPermalink(
      repo.owner,
      repo.name,
      version.commit_sha,
      node.data.filePath,
      node.data.startLine,
      node.data.endLine
    );
  }, [node, repo, version]);

  if (!node) return null;

  const { data } = node;
  const nodeColor = NODE_TYPE_COLORS[data.nodeType];
  const clusterColor = CLUSTER_COLORS[data.cluster];

  return (
    <div className="absolute top-4 right-4 bottom-4 w-80 z-10">
      <div className="h-full bg-[#0c0c0e] border border-white/5 rounded-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-white/5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: nodeColor }}
              />
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: nodeColor }}
              >
                {data.nodeType}
              </span>
              {onClusterChange ? (
                <select
                  value={data.cluster}
                  onChange={(e) => onClusterChange(node.id, e.target.value as ClusterType)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium capitalize bg-white/5 border border-white/10 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{
                    color: clusterColor,
                  }}
                  title="Change cluster"
                >
                  {CLUSTER_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium capitalize"
                  style={{
                    backgroundColor: `${clusterColor}20`,
                    color: clusterColor,
                  }}
                >
                  {data.cluster}
                </div>
              )}
            </div>
            <h3 className="font-semibold text-lg truncate">{data.name}</h3>
            {data.qualifiedName && data.qualifiedName !== data.name && (
              <p className="text-xs text-gray-500 truncate">
                {data.qualifiedName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/5 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Summary */}
          {data.summary && (
            <div>
              <div className="text-xs font-medium text-gray-400 mb-2">
                Summary
              </div>
              <p className="text-sm text-white/80 leading-relaxed font-light">
                {data.summary}
              </p>
            </div>
          )}

          {/* Location */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
              <FileCode className="w-3.5 h-3.5" />
              Location
            </div>
            <div className="bg-white/3 rounded-lg p-3">
              <div className="text-sm text-gray-300 font-mono truncate">
                {data.filePath}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Lines {data.startLine}–{data.endLine}
                {data.language && (
                  <span className="ml-2 text-gray-600">({data.language})</span>
                )}
              </div>
            </div>
          </div>

          {/* Signature */}
          {data.signature && (
            <div>
              <div className="text-xs font-medium text-gray-400 mb-2">
                Signature
              </div>
              <div className="bg-white/3 rounded-lg p-3">
                <code className="text-xs text-gray-300 font-mono break-all">
                  {data.signature}
                </code>
              </div>
            </div>
          )}

          {/* Snippet */}
          {data.snippet && (
            <div>
              <div className="text-xs font-medium text-gray-400 mb-2">
                Preview
              </div>
              <div className="bg-white/3 rounded-lg p-3 max-h-32 overflow-y-auto">
                <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap">
                  {data.snippet}
                </pre>
              </div>
            </div>
          )}

          {/* Connections */}
          <div className="space-y-3">
            {/* Incoming */}
            {connectedNodes.incoming.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
                  <ArrowDownToLine className="w-3.5 h-3.5 text-green-400" />
                  Incoming ({connectedNodes.incoming.length})
                </div>
                <div className="space-y-1">
                  {connectedNodes.incoming.slice(0, 5).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onNodeSelect(n)}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-white/3 hover:bg-white/5 rounded-lg text-left transition-colors"
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: NODE_TYPE_COLORS[n.data.nodeType] }}
                      />
                      <span className="text-sm truncate">{n.data.name}</span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {n.data.nodeType}
                      </span>
                    </button>
                  ))}
                  {connectedNodes.incoming.length > 5 && (
                    <div className="text-xs text-gray-500 px-3 py-1">
                      +{connectedNodes.incoming.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Outgoing */}
            {connectedNodes.outgoing.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
                  <ArrowUpFromLine className="w-3.5 h-3.5 text-blue-400" />
                  Outgoing ({connectedNodes.outgoing.length})
                </div>
                <div className="space-y-1">
                  {connectedNodes.outgoing.slice(0, 5).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onNodeSelect(n)}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-white/3 hover:bg-white/5 rounded-lg text-left transition-colors"
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: NODE_TYPE_COLORS[n.data.nodeType] }}
                      />
                      <span className="text-sm truncate">{n.data.name}</span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {n.data.nodeType}
                      </span>
                    </button>
                  ))}
                  {connectedNodes.outgoing.length > 5 && (
                    <div className="text-xs text-gray-500 px-3 py-1">
                      +{connectedNodes.outgoing.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5">
          {permalink ? (
            <a
              href={permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
            >
              <GitCommit className="w-4 h-4" />
              View on GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-white/3 rounded-lg text-sm text-gray-500">
              <FileCode className="w-4 h-4" />
              {data.filePath.split("/").pop()}:{data.startLine}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
