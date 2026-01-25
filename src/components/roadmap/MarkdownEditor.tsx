"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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

  // Detect [[Node: pattern and show autocomplete
  const checkForAutocomplete = useCallback(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);

    // Check if we're inside a [[Node: pattern
    const pattern = /\[\[Node:\s*([^\]]*?)$/;
    const match = textBeforeCursor.match(pattern);

    if (match) {
      // Get cursor position for dropdown
      const textareaRect = textarea.getBoundingClientRect();
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
      const lines = textBeforeCursor.split("\n");
      const currentLineNumber = lines.length - 1;
      const charWidth = 8; // Approximate character width

      setAutocompletePosition({
        top: lineHeight * (currentLineNumber + 1) + 8,
        left: Math.min(lines[currentLineNumber].length * charWidth, textareaRect.width - 300),
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
      onChange(newValue);
      setCursorPosition(e.target.selectionStart);
      onCursorPositionChange?.(e.target.selectionStart);
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

  // Handle node selection from autocomplete
  const handleSelectNode = useCallback(
    (node: AutocompleteNode) => {
      if (!textareaRef.current) return;

      const textarea = textareaRef.current;
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = value.slice(0, cursorPos);

      // Find the start of [[Node:
      const pattern = /\[\[Node:\s*[^\]]*$/;
      const match = textBeforeCursor.match(pattern);

      if (match) {
        const startPos = cursorPos - match[0].length;
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

  // Update autocomplete on value change
  useEffect(() => {
    checkForAutocomplete();
  }, [value, cursorPosition, checkForAutocomplete]);

  return (
    <div className="relative h-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-full p-6 bg-transparent text-white/90 placeholder-gray-600 resize-none focus:outline-none font-mono text-sm leading-relaxed"
        spellCheck={false}
      />

      {showAutocomplete && (
        <div
          className="absolute z-50"
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
          />
        </div>
      )}
    </div>
  );
}
