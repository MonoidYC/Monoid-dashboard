"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Code, Loader2 } from "lucide-react";
import {
  searchNodesForOrgAutocomplete,
  searchNodesForRepoAutocomplete,
  type OrgAutocompleteNode,
} from "@/lib/docs";
import { NODE_TYPE_COLORS } from "@/lib/graph/types";

interface OrgNodeAutocompleteProps {
  orgId: string;
  repoId?: string | null; // If provided, restrict search to this repo
  query: string;
  onSelect: (node: OrgAutocompleteNode) => void;
  onClose: () => void;
  onOpenSearch?: () => void;
  embedded?: boolean;
}

export function OrgNodeAutocomplete({
  orgId,
  repoId,
  query,
  onSelect,
  onClose,
  onOpenSearch,
  embedded = false,
}: OrgNodeAutocompleteProps) {
  const [nodes, setNodes] = useState<OrgAutocompleteNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch nodes when query changes
  useEffect(() => {
    const fetchNodes = async () => {
      setIsLoading(true);
      try {
        let results: OrgAutocompleteNode[];

        if (repoId) {
          // Search within specific repo
          results = await searchNodesForRepoAutocomplete(repoId, query || "", 10);
        } else {
          // Search across all repos in org
          results = await searchNodesForOrgAutocomplete(orgId, query || "", 10);
        }

        setNodes(results);
        setSelectedIndex(0);
      } catch (error) {
        console.error("Error searching nodes:", error);
        setNodes([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchNodes, 150);
    return () => clearTimeout(debounce);
  }, [orgId, repoId, query]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, nodes.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (nodes[selectedIndex]) {
            onSelect(nodes[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [nodes, selectedIndex, onSelect, onClose]
  );

  // Add keyboard listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Get node type color
  const getNodeColor = (nodeType: string) => {
    return (
      NODE_TYPE_COLORS[nodeType as keyof typeof NODE_TYPE_COLORS] || "#6b7280"
    );
  };

  // Wrapper classes depend on embedded mode
  const containerClasses = embedded
    ? "w-full max-h-72 overflow-hidden"
    : "w-96 max-h-72 overflow-hidden rounded-xl bg-[#18181b] border border-white/10 shadow-2xl";

  return (
    <div ref={containerRef} className={containerClasses}>
      {/* Header - only show when not embedded */}
      {!embedded && (
        <button
          onClick={() => {
            if (onOpenSearch) {
              onClose();
              onOpenSearch();
            }
          }}
          className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors text-left"
        >
          <Search className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-400 flex-1">
            {query ? `Searching "${query}"...` : "Search components..."}
          </span>
          {onOpenSearch && (
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-gray-500">
              ⌘K
            </kbd>
          )}
        </button>
      )}

      {/* Results */}
      <div
        className={embedded ? "max-h-64 overflow-y-auto" : "max-h-56 overflow-y-auto"}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <Code className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-sm">
              {query ? "No components found" : "Type to search..."}
            </span>
          </div>
        ) : (
          <div className="py-1">
            {nodes.map((node, index) => (
              <button
                key={node.id}
                onClick={() => onSelect(node)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  index === selectedIndex ? "bg-white/5" : "hover:bg-white/3"
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getNodeColor(node.nodeType) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white/90 truncate">
                      {node.name}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
                      style={{
                        backgroundColor: `${getNodeColor(node.nodeType)}20`,
                        color: getNodeColor(node.nodeType),
                      }}
                    >
                      {node.nodeType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                    {node.repoName && (
                      <span className="text-violet-400/70">{node.repoName}</span>
                    )}
                    <span className="truncate">{node.filePath}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint - only show when not embedded */}
      {!embedded && (
        <div className="px-3 py-2 border-t border-white/5 text-[10px] text-gray-500">
          <span className="text-gray-600">↑↓</span> navigate{" "}
          <span className="text-gray-600 ml-2">↵</span> select{" "}
          <span className="text-gray-600 ml-2">esc</span> close
        </div>
      )}
    </div>
  );
}
