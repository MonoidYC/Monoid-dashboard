"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, X } from "lucide-react";
import { NodeAutocomplete } from "./NodeAutocomplete";
import type { AutocompleteNode } from "@/lib/roadmap/types";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onCursorPositionChange?: (position: number) => void;
  repoId: string;
  placeholder?: string;
  disabled?: boolean;
}

// Case-insensitive pattern for [[node: or [[Node: etc.
const NODE_LINK_PATTERN = /\[\[[Nn][Oo][Dd][Ee]:\s*([^\]]*?)$/;

export function MarkdownEditor({
  value,
  onChange,
  onCursorPositionChange,
  repoId,
  placeholder = "Start writing your roadmap...\n\nTip: Use [[Node: ComponentName]] to link to code components.",
  disabled = false,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [autocompleteQuery, setAutocompleteQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  
  // Search bar state
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Detect [[Node: pattern (case-insensitive) and show autocomplete
  const checkForAutocomplete = useCallback(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);

    // Check if we're inside a [[node: pattern (case-insensitive)
    const match = textBeforeCursor.match(NODE_LINK_PATTERN);

    if (match) {
      // Calculate position using the textarea's bounding rect for fixed positioning
      const textareaRect = textarea.getBoundingClientRect();
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
      const lines = textBeforeCursor.split("\n");
      const currentLineNumber = lines.length - 1;
      const charWidth = 8;

      // Use fixed positioning based on viewport
      const lineTop = currentLineNumber * lineHeight;
      const charLeft = lines[currentLineNumber].length * charWidth;

      setAutocompletePosition({
        top: textareaRect.top + lineTop + lineHeight + 8 - textarea.scrollTop,
        left: Math.min(textareaRect.left + charLeft + 24, window.innerWidth - 340),
      });
      setAutocompleteQuery(match[1]);
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }
  }, [value]);

  // Handle text changes
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const newCursorPos = e.target.selectionStart;
      onChange(newValue);
      setCursorPosition(newCursorPos);
      onCursorPositionChange?.(newCursorPos);
      
      // Check for autocomplete trigger immediately with the new value (case-insensitive)
      const textBeforeCursor = newValue.slice(0, newCursorPos);
      const match = textBeforeCursor.match(NODE_LINK_PATTERN);

      if (match) {
        const textarea = e.target;
        const textareaRect = textarea.getBoundingClientRect();
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
        const lines = textBeforeCursor.split("\n");
        const currentLineNumber = lines.length - 1;
        const charWidth = 8;

        // Use fixed positioning based on viewport
        const lineTop = currentLineNumber * lineHeight;
        const charLeft = lines[currentLineNumber].length * charWidth;

        setAutocompletePosition({
          top: textareaRect.top + lineTop + lineHeight + 8 - textarea.scrollTop,
          left: Math.min(textareaRect.left + charLeft + 24, window.innerWidth - 340),
        });
        setAutocompleteQuery(match[1]);
        setShowAutocomplete(true);
      } else {
        setShowAutocomplete(false);
      }
    },
    [onChange, onCursorPositionChange]
  );

  // Handle cursor movement
  const handleSelect = useCallback(() => {
    if (!textareaRef.current) return;
    setCursorPosition(textareaRef.current.selectionStart);
    onCursorPositionChange?.(textareaRef.current.selectionStart);
    checkForAutocomplete();
  }, [checkForAutocomplete, onCursorPositionChange]);

  // Handle key events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showAutocomplete) {
        if (e.key === "Escape") {
          e.preventDefault();
          setShowAutocomplete(false);
        }
        // Let NodeAutocomplete handle arrow keys and enter
      }

      // Tab key inserts spaces
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = value.slice(0, start) + "  " + value.slice(end);
        onChange(newValue);

        // Move cursor after the inserted spaces
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    },
    [showAutocomplete, value, onChange]
  );

  // Handle node selection from autocomplete (normalizes to [[Node: ComponentName]])
  const handleSelectNode = useCallback(
    (node: AutocompleteNode) => {
      if (!textareaRef.current) return;

      const textarea = textareaRef.current;
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = value.slice(0, cursorPos);

      // Find the start of [[node: (case-insensitive) - matches [[node:, [[Node:, [[NODE:, etc.
      const pattern = /\[\[[Nn][Oo][Dd][Ee]:\s*[^\]]*$/;
      const match = textBeforeCursor.match(pattern);

      if (match) {
        const startPos = cursorPos - match[0].length;
        // Always normalize to [[Node: ComponentName]] format
        const newValue =
          value.slice(0, startPos) +
          `[[Node: ${node.name}]]` +
          value.slice(cursorPos);
        onChange(newValue);

        // Move cursor after the inserted link
        const newCursorPos = startPos + `[[Node: ${node.name}]]`.length;
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = newCursorPos;
          textarea.focus();
        }, 0);
      }

      setShowAutocomplete(false);
    },
    [value, onChange]
  );
  
  // Handle node selection from search bar
  const handleSearchSelectNode = useCallback(
    (node: AutocompleteNode) => {
      if (!textareaRef.current) return;

      const textarea = textareaRef.current;
      const cursorPos = textarea.selectionStart;
      
      // Insert [[Node: ComponentName]] at cursor position
      const linkText = `[[Node: ${node.name}]]`;
      const newValue =
        value.slice(0, cursorPos) +
        linkText +
        value.slice(cursorPos);
      onChange(newValue);

      // Move cursor after the inserted link
      const newCursorPos = cursorPos + linkText.length;
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        textarea.focus();
      }, 0);

      setShowSearchBar(false);
      setSearchQuery("");
    },
    [value, onChange]
  );
  
  // Toggle search bar with keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to toggle search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearchBar((prev) => !prev);
        if (!showSearchBar) {
          setTimeout(() => searchInputRef.current?.focus(), 0);
        }
      }
      // Escape to close search
      if (e.key === "Escape" && showSearchBar) {
        setShowSearchBar(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [showSearchBar]);

  // Update autocomplete on value change
  useEffect(() => {
    checkForAutocomplete();
  }, [value, cursorPosition, checkForAutocomplete]);

  return (
    <div className="relative h-full">
      {/* Search Bar Toggle Button */}
      <button
        onClick={() => {
          setShowSearchBar(true);
          setTimeout(() => searchInputRef.current?.focus(), 0);
        }}
        className="absolute top-3 right-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs transition-colors border border-white/5"
        title="Search components (⌘K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search</span>
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-gray-500">⌘K</kbd>
      </button>
      
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-full p-6 pt-12 bg-transparent text-white/90 placeholder-gray-600 resize-none focus:outline-none font-mono text-sm leading-relaxed"
        spellCheck={false}
      />

      {/* Inline Autocomplete (triggered by [[Node: ) */}
      {showAutocomplete && (
        <div
          className="fixed z-[100]"
          style={{
            top: autocompletePosition.top,
            left: autocompletePosition.left,
          }}
        >
          <NodeAutocomplete
            repoId={repoId}
            query={autocompleteQuery}
            onSelect={handleSelectNode}
            onClose={() => setShowAutocomplete(false)}
            onOpenSearch={() => {
              setShowSearchBar(true);
              setTimeout(() => searchInputRef.current?.focus(), 0);
            }}
          />
        </div>
      )}
      
      {/* Search Bar Modal */}
      {showSearchBar && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4">
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#18181b] rounded-t-xl border border-white/10 border-b-0">
              <Search className="w-5 h-5 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a component to link..."
                className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm"
                autoFocus
              />
              <button
                onClick={() => {
                  setShowSearchBar(false);
                  setSearchQuery("");
                }}
                className="p-1 hover:bg-white/5 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            
            {/* Search Results */}
            <div className="bg-[#18181b] rounded-b-xl border border-white/10 border-t-0 overflow-hidden">
              <NodeAutocomplete
                repoId={repoId}
                query={searchQuery}
                onSelect={handleSearchSelectNode}
                onClose={() => {
                  setShowSearchBar(false);
                  setSearchQuery("");
                }}
                embedded
              />
            </div>
            
            {/* Hint */}
            <div className="mt-2 text-center text-xs text-gray-500">
              Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-gray-400">↵</kbd> to select · <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-gray-400">esc</kbd> to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
