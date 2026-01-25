"use client";

import { useState } from "react";
import { Save, Plus, Loader2, Check } from "lucide-react";

interface EditToolbarProps {
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onSave: () => void;
  onNewNode: () => void;
  pendingEdgesCount: number;
  pendingNodesCount: number;
}

export function EditToolbar({
  hasUnsavedChanges,
  isSaving,
  onSave,
  onNewNode,
  pendingEdgesCount,
  pendingNodesCount,
}: EditToolbarProps) {
  const [showSaved, setShowSaved] = useState(false);

  const handleSave = async () => {
    await onSave();
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
      {/* New Node Button */}
      <button
        onClick={onNewNode}
        className="flex items-center gap-1.5 px-3 py-2 bg-[#1c1c22] hover:bg-[#252530] border border-white/10 rounded-lg text-xs font-medium text-white/80 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        New Node
      </button>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={!hasUnsavedChanges || isSaving}
        className={`
          flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all
          ${hasUnsavedChanges
            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
            : "bg-[#1c1c22] text-white/40 border border-white/5"
          }
          ${isSaving ? "opacity-70 cursor-wait" : ""}
          ${!hasUnsavedChanges && !isSaving ? "cursor-default" : ""}
        `}
      >
        {isSaving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : showSaved ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        {isSaving ? "Saving..." : showSaved ? "Saved!" : "Save"}
        {hasUnsavedChanges && !isSaving && !showSaved && (
          <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[9px]">
            {pendingEdgesCount + pendingNodesCount}
          </span>
        )}
      </button>
    </div>
  );
}
