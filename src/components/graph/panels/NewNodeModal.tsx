"use client";

import { useState } from "react";
import { X, Sparkles, Loader2, Code, FileCode } from "lucide-react";
import type { NodeType } from "@/lib/graph/types";
import { NODE_TYPE_COLORS } from "@/lib/graph/types";

interface ExtractedNodeData {
  name: string;
  nodeType: NodeType;
  signature: string | null;
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
  summary: string;
}

interface NewNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNode: (data: ExtractedNodeData) => void;
  versionId: string;
}

export function NewNodeModal({
  isOpen,
  onClose,
  onCreateNode,
  versionId,
}: NewNodeModalProps) {
  const [codeInput, setCodeInput] = useState("");
  const [filePath, setFilePath] = useState("");
  const [startLine, setStartLine] = useState(1);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedNodeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!codeInput.trim()) {
      setError("Please paste some code first");
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const response = await fetch("/api/extract-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeInput,
          filePath: filePath || "unknown.ts",
          startLine,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to extract node information");
      }

      const data = await response.json();
      setExtractedData({
        ...data,
        filePath: filePath || "unknown.ts",
        startLine,
        endLine: startLine + codeInput.split("\n").length - 1,
        snippet: codeInput.slice(0, 500),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCreate = () => {
    if (extractedData) {
      onCreateNode(extractedData);
      handleClose();
    }
  };

  const handleClose = () => {
    setCodeInput("");
    setFilePath("");
    setStartLine(1);
    setExtractedData(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-white/40" />
            <h2 className="text-sm font-medium text-white/90">Create New Node</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-white/40" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* File path input */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1.5">
              File Path
            </label>
            <div className="relative">
              <FileCode className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="src/components/Example.tsx"
                className="w-full pl-9 pr-3 py-2 bg-[#18181c] border border-white/5 rounded-lg text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>
          </div>

          {/* Start line */}
          <div className="w-32">
            <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1.5">
              Start Line
            </label>
            <input
              type="number"
              value={startLine}
              onChange={(e) => setStartLine(parseInt(e.target.value) || 1)}
              min={1}
              className="w-full px-3 py-2 bg-[#18181c] border border-white/5 rounded-lg text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>

          {/* Code input */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/30 mb-1.5">
              Paste Code
            </label>
            <textarea
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value);
                setExtractedData(null);
              }}
              placeholder="Paste your function, class, or component code here..."
              rows={10}
              className="w-full px-3 py-2 bg-[#18181c] border border-white/5 rounded-lg text-xs text-white/70 font-mono placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
            />
          </div>

          {/* Extract button */}
          <button
            onClick={handleExtract}
            disabled={isExtracting || !codeInput.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium text-white transition-colors"
          >
            {isExtracting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isExtracting ? "Extracting..." : "Extract with AI"}
          </button>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Extracted preview */}
          {extractedData && (
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-sm"
                  style={{ backgroundColor: NODE_TYPE_COLORS[extractedData.nodeType] }}
                />
                <span
                  className="text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: NODE_TYPE_COLORS[extractedData.nodeType] }}
                >
                  {extractedData.nodeType}
                </span>
              </div>

              <div>
                <div className="text-[10px] text-white/30 mb-1">Name</div>
                <div className="text-sm font-medium text-white/90">{extractedData.name}</div>
              </div>

              {extractedData.signature && (
                <div>
                  <div className="text-[10px] text-white/30 mb-1">Signature</div>
                  <code className="text-xs text-white/60 font-mono">{extractedData.signature}</code>
                </div>
              )}

              <div>
                <div className="text-[10px] text-white/30 mb-1">Summary</div>
                <p className="text-xs text-white/60 leading-relaxed">{extractedData.summary}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/5">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-xs font-medium text-white/50 hover:text-white/70 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!extractedData}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium text-white transition-colors"
          >
            Add Node
          </button>
        </div>
      </div>
    </div>
  );
}
