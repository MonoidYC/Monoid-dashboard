"use client";

import { X, Sparkles, Link } from "lucide-react";
import type { NodeLinkSuggestion } from "@/lib/roadmap/types";
import { NODE_TYPE_COLORS } from "@/lib/graph/types";

interface SuggestionBannerProps {
  suggestion: NodeLinkSuggestion | null;
  nodeType?: string;
  onAccept: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

export function SuggestionBanner({
  suggestion,
  nodeType,
  onAccept,
  onDismiss,
  isLoading = false,
}: SuggestionBannerProps) {
  if (!suggestion && !isLoading) return null;

  const nodeColor = nodeType
    ? NODE_TYPE_COLORS[nodeType as keyof typeof NODE_TYPE_COLORS] || "#6b7280"
    : "#8b5cf6";

  return (
    <div className="absolute bottom-4 left-4 right-4 z-40">
      <div className="bg-[#1a1a1d] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400">Analyzing your text for component references...</p>
            </div>
          </div>
        ) : suggestion ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${nodeColor}15` }}
            >
              <Sparkles className="w-4 h-4" style={{ color: nodeColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/80">
                Did you mean to link to{" "}
                <span
                  className="font-semibold px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${nodeColor}15`,
                    color: nodeColor,
                  }}
                >
                  {suggestion.suggestedNodeName}
                </span>
                ?
              </p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {suggestion.reason}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onAccept}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-white/80 transition-colors"
              >
                <Link className="w-3.5 h-3.5" />
                Insert Link
              </button>
              <button
                onClick={onDismiss}
                className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Confidence indicator */}
        {suggestion && suggestion.confidence > 0 && (
          <div className="h-0.5 bg-white/5">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${suggestion.confidence * 100}%`,
                backgroundColor: nodeColor,
                opacity: 0.5,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
