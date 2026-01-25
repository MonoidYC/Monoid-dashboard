"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Loader2,
  Network,
  Github,
  Map,
  ExternalLink,
  Check,
  AlertCircle,
} from "lucide-react";
import { MarkdownEditor, SuggestionBanner } from "@/components/roadmap";
import {
  getRoadmapByRepoId,
  getRepoWithOrganization,
  getAllNodesForRepo,
  getNodeByName,
  getLatestVersionId,
} from "@/lib/roadmap/queries";
import { upsertRoadmap } from "@/lib/roadmap/mutations";
import { suggestNodeLinks } from "@/lib/roadmap/gemini";
import { parseNodeLinks, type RoadmapRow, type NodeLinkSuggestion } from "@/lib/roadmap/types";
import { NODE_TYPE_COLORS } from "@/lib/graph/types";

interface RepoInfo {
  id: string;
  name: string;
  owner: string;
  organization_id: string | null;
}

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
}

export default function RoadmapPage() {
  const params = useParams();
  const repoId = params.repoId as string;

  // State
  const [roadmap, setRoadmap] = useState<RoadmapRow | null>(null);
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [organization, setOrganization] = useState<OrgInfo | null>(null);
  const [latestVersionId, setLatestVersionId] = useState<string | null>(null);
  const [availableNodes, setAvailableNodes] = useState<
    { id: string; name: string; nodeType: string; filePath: string }[]
  >([]);

  // Editor state
  const [title, setTitle] = useState("Roadmap");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [hasChanges, setHasChanges] = useState(false);

  // LLM suggestion state
  const [suggestion, setSuggestion] = useState<NodeLinkSuggestion | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [lastAnalyzedText, setLastAnalyzedText] = useState("");

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        // Load repo and organization
        const repoData = await getRepoWithOrganization(repoId);
        if (!repoData) {
          setError("Repository not found");
          return;
        }
        setRepo(repoData.repo);
        setOrganization(repoData.organization);

        // Load latest version ID
        const versionId = await getLatestVersionId(repoId);
        setLatestVersionId(versionId);

        // Load roadmap
        const existingRoadmap = await getRoadmapByRepoId(repoId);
        if (existingRoadmap) {
          setRoadmap(existingRoadmap);
          setTitle(existingRoadmap.title);
          setContent(existingRoadmap.content);
        }

        // Load nodes for autocomplete and LLM
        const nodes = await getAllNodesForRepo(repoId);
        setAvailableNodes(nodes);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load roadmap data");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [repoId]);

  // Handle content changes
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      setHasChanges(true);
      setSaveStatus("idle");
    },
    []
  );

  // Save roadmap
  const handleSave = useCallback(async () => {
    if (!repoId) return;

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      const { roadmap: savedRoadmap, error } = await upsertRoadmap(repoId, title, content);
      if (error) throw error;

      setRoadmap(savedRoadmap);
      setHasChanges(false);
      setSaveStatus("saved");

      // Reset saved status after a delay
      setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    } catch (err) {
      console.error("Error saving roadmap:", err);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  }, [repoId, title, content]);

  // Analyze text for LLM suggestions (debounced)
  useEffect(() => {
    const analyzeText = async () => {
      // Get the current paragraph/sentence around cursor
      const lines = content.split("\n");
      const currentText = lines[lines.length - 1] || "";

      // Skip if no meaningful text or already analyzed
      if (currentText.length < 10 || currentText === lastAnalyzedText) {
        return;
      }

      // Skip if text already has a node link
      if (currentText.includes("[[Node:")) {
        return;
      }

      setLastAnalyzedText(currentText);

      // Get API key from environment
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey || availableNodes.length === 0) {
        return;
      }

      setIsLoadingSuggestion(true);
      try {
        const result = await suggestNodeLinks(currentText, availableNodes, apiKey);
        setSuggestion(result);
      } catch (err) {
        console.error("Error getting suggestion:", err);
      } finally {
        setIsLoadingSuggestion(false);
      }
    };

    const debounce = setTimeout(analyzeText, 1500);
    return () => clearTimeout(debounce);
  }, [content, availableNodes, lastAnalyzedText]);

  // Accept LLM suggestion
  const handleAcceptSuggestion = useCallback(() => {
    if (!suggestion) return;

    // Find the last line and append the link
    const lines = content.split("\n");
    const lastLineIndex = lines.length - 1;
    lines[lastLineIndex] = `${lines[lastLineIndex]} [[Node: ${suggestion.suggestedNodeName}]]`;

    setContent(lines.join("\n"));
    setSuggestion(null);
    setHasChanges(true);
  }, [suggestion, content]);

  // Dismiss suggestion
  const handleDismissSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);

  // Render markdown preview with node links
  const renderedPreview = useMemo(() => {
    const nodeLinks = parseNodeLinks(content);
    let html = content;

    // Escape HTML
    html = html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Convert markdown headers
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white/90 mt-6 mb-2">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-white/90 mt-8 mb-3">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-8 mb-4">$1</h1>');

    // Convert bold and italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');

    // Convert bullet points
    html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
    html = html.replace(/(<li.*<\/li>\n?)+/g, '<ul class="my-2">$&</ul>');

    // Convert code blocks
    html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-white/5 text-violet-400 font-mono text-sm">$1</code>');

    // Convert node links to clickable links
    for (const link of nodeLinks) {
      const escapedMatch = link.fullMatch
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]");

      html = html.replace(
        new RegExp(escapedMatch),
        `<node-link data-name="${link.nodeName}">${link.nodeName}</node-link>`
      );
    }

    // Convert newlines to breaks
    html = html.replace(/\n/g, "<br>");

    return html;
  }, [content]);

  // Handle clicking node links in preview
  const handlePreviewClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === "node-link") {
        const nodeName = target.getAttribute("data-name");
        if (nodeName && latestVersionId) {
          const result = await getNodeByName(repoId, nodeName);
          if (result) {
            // Navigate to graph with highlighted node
            window.location.href = `/graph/${result.versionId}?highlight=${result.nodeId}`;
          }
        }
      }
    },
    [repoId, latestVersionId]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080a]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading roadmap...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080a]">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-white">{error}</h2>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Get node type for suggestion
  const suggestionNodeType = suggestion
    ? availableNodes.find((n) => n.id === suggestion.nodeId)?.nodeType
    : undefined;

  return (
    <div className="h-screen flex flex-col bg-[#08080a]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0c0c0e]">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </Link>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            {organization && (
              <>
                <a
                  href={`https://github.com/${organization.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  {organization.avatar_url ? (
                    <img
                      src={organization.avatar_url}
                      alt={organization.name}
                      className="w-5 h-5 rounded-full"
                    />
                  ) : (
                    <Github className="w-4 h-4" />
                  )}
                  {organization.name}
                </a>
                <span className="text-gray-600">/</span>
              </>
            )}
            {repo && (
              <>
                <span className="text-white/80">{repo.name}</span>
                <span className="text-gray-600">/</span>
              </>
            )}
            <div className="flex items-center gap-1.5 text-violet-400">
              <Map className="w-4 h-4" />
              Roadmap
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View Graph Button */}
          {latestVersionId && (
            <Link
              href={`/graph/${latestVersionId}`}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Network className="w-4 h-4" />
              View Graph
            </Link>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              hasChanges
                ? "bg-violet-600 hover:bg-violet-500 text-white"
                : "bg-white/5 text-gray-500"
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveStatus === "saved" ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saveStatus === "saved" ? "Saved" : "Save"}
          </button>
        </div>
      </header>

      {/* Main Content - Split View */}
      <main className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className="w-1/2 flex flex-col border-r border-white/5 relative">
          {/* Title Input */}
          <div className="px-6 py-4 border-b border-white/5">
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Roadmap Title"
              className="w-full text-2xl font-bold bg-transparent text-white placeholder-gray-600 focus:outline-none"
            />
          </div>

          {/* Markdown Editor */}
          <div className="flex-1 overflow-auto">
            <MarkdownEditor
              value={content}
              onChange={handleContentChange}
              repoId={repoId}
            />
          </div>

          {/* LLM Suggestion Banner */}
          <SuggestionBanner
            suggestion={suggestion}
            nodeType={suggestionNodeType}
            onAccept={handleAcceptSuggestion}
            onDismiss={handleDismissSuggestion}
            isLoading={isLoadingSuggestion}
          />
        </div>

        {/* Preview Panel */}
        <div className="w-1/2 flex flex-col">
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-sm font-medium text-gray-400">Preview</h2>
          </div>

          <div
            className="flex-1 overflow-auto p-6"
            onClick={handlePreviewClick}
          >
            <div
              className="prose prose-invert max-w-none text-gray-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderedPreview }}
              style={{
                // Custom styles for node links
              }}
            />
            <style jsx global>{`
              node-link {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                background: rgba(139, 92, 246, 0.15);
                color: rgb(167, 139, 250);
                border-radius: 4px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s;
              }
              node-link:hover {
                background: rgba(139, 92, 246, 0.25);
                color: rgb(196, 181, 253);
              }
              node-link::before {
                content: "→";
                font-size: 12px;
                opacity: 0.7;
              }
            `}</style>
          </div>
        </div>
      </main>
    </div>
  );
}
