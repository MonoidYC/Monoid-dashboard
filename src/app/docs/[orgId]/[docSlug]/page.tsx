"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Globe,
  Lock,
  Loader2,
  AlertCircle,
  Trash2,
  FileText,
  Building2,
  FolderGit2,
  Eye,
  EyeOff,
  Pencil,
  Share2,
  Check,
  ChevronDown,
} from "lucide-react";
import { DocMarkdownEditor } from "@/components/docs";
import {
  getDocBySlug,
  getOrganizationById,
  getReposByOrgId,
  createDoc,
  updateDoc,
  deleteDoc,
  togglePublishStatus,
  loadFromStorage,
  searchNodesForOrgAutocomplete,
  searchNodesForRepoAutocomplete,
  type OrgDocRow,
  type OrganizationRow,
  type RepoRow,
} from "@/lib/docs";
import { getSupabase } from "@/lib/supabase";

export default function DocEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;
  const docSlug = params.docSlug as string;

  // Check if this is a new doc
  const isNew = searchParams.get("new") === "true";
  const initialTitle = searchParams.get("title") || "";
  const initialRepoId = searchParams.get("repoId") || null;

  // State
  const [doc, setDoc] = useState<OrgDocRow | null>(null);
  const [organization, setOrganization] = useState<OrganizationRow | null>(null);
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [repoId, setRepoId] = useState<string | null>(initialRepoId);
  const [isPublished, setIsPublished] = useState(false);

  // Track if there are unsaved changes
  const [originalContent, setOriginalContent] = useState("");
  const hasChanges = useMemo(() => {
    if (isNew) return content.trim().length > 0;
    return content !== originalContent;
  }, [isNew, content, originalContent]);

  // Show preview panel (split view in edit mode)
  const [showPreview, setShowPreview] = useState(false);
  
  // View mode: published docs open in read-only mode by default
  const [isViewMode, setIsViewMode] = useState(false);
  
  // Share link copied state
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  
  // Repo dropdown state
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);
  const repoDropdownRef = useRef<HTMLDivElement>(null);
  
  // Preview container ref for handling node link clicks
  const previewRef = useRef<HTMLDivElement>(null);

  // Handle clicking on node links in preview
  const handlePreviewClick = useCallback(async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const nodeLink = target.closest('[data-node-name]') as HTMLElement;
    
    if (!nodeLink) return;
    
    e.preventDefault();
    const nodeName = nodeLink.getAttribute('data-node-name');
    if (!nodeName) return;

    // Search for the node
    let nodes;
    if (repoId) {
      nodes = await searchNodesForRepoAutocomplete(repoId, nodeName, 1);
    } else {
      nodes = await searchNodesForOrgAutocomplete(orgId, nodeName, 1);
    }

    if (nodes.length === 0) {
      alert(`Node "${nodeName}" not found. Make sure the component exists in the codebase.`);
      return;
    }

    const node = nodes[0];
    
    // If doc has a specific repo, we can go directly to the graph
    // Otherwise, we need to find the version for this node's repo
    if (node.repoId) {
      // Get the latest version for this repo
      const supabase = getSupabase();
      
      const { data: version } = await supabase
        .from("repo_versions")
        .select("id")
        .eq("repo_id", node.repoId)
        .order("ingested_at", { ascending: false })
        .limit(1)
        .single() as { data: { id: string } | null };
      
      if (version) {
        router.push(`/graph/${version.id}?highlight=${node.id}`);
      } else {
        alert(`No version found for repository containing "${nodeName}"`);
      }
    }
  }, [repoId, orgId, router]);

  // Load data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        // Load organization
        const org = await getOrganizationById(orgId);
        if (!org) {
          setError("Organization not found");
          setIsLoading(false);
          return;
        }
        setOrganization(org);

        // Load repos
        const reposList = await getReposByOrgId(orgId);
        setRepos(reposList);

        // If new doc, we're done
        if (isNew) {
          setIsLoading(false);
          return;
        }

        // Load existing doc
        const existingDoc = await getDocBySlug(orgId, docSlug);
        if (!existingDoc) {
          setError("Document not found");
          setIsLoading(false);
          return;
        }

        setDoc(existingDoc);
        setTitle(existingDoc.title);
        setDescription(existingDoc.description || "");
        setRepoId(existingDoc.repo_id);
        setIsPublished(existingDoc.is_published);
        
        // Published docs open in read-only view mode by default
        setIsViewMode(existingDoc.is_published);

        // Try to load content from storage first, fall back to database
        const { content: storageContent } = await loadFromStorage(
          orgId,
          existingDoc.slug
        );
        const docContent = storageContent || existingDoc.content;
        setContent(docContent);
        setOriginalContent(docContent);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load document");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [orgId, docSlug, isNew]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }

    setIsSaving(true);

    try {
      if (isNew) {
        // Create new doc
        const { doc: newDoc, error: createError } = await createDoc({
          organizationId: orgId,
          title,
          slug: docSlug,
          content,
          description: description || undefined,
          repoId,
          isPublished,
        });

        if (createError) {
          console.error("Error creating doc:", createError);
          alert("Failed to create document: " + createError.message);
          return;
        }

        if (newDoc) {
          setDoc(newDoc);
          setOriginalContent(content);
          // Remove the ?new=true from URL
          router.replace(`/docs/${orgId}/${docSlug}`);
        }
      } else if (doc) {
        // Update existing doc
        const { doc: updatedDoc, error: updateError } = await updateDoc(
          doc.id,
          orgId,
          doc.slug,
          {
            title,
            content,
            description: description || undefined,
            repoId,
            isPublished,
          }
        );

        if (updateError) {
          console.error("Error updating doc:", updateError);
          alert("Failed to update document: " + updateError.message);
          return;
        }

        if (updatedDoc) {
          setDoc(updatedDoc);
          setOriginalContent(content);
        }
      }
    } finally {
      setIsSaving(false);
    }
  }, [isNew, doc, orgId, docSlug, title, content, description, repoId, isPublished, router]);

  // Handle toggle publish
  const handleTogglePublish = useCallback(async () => {
    if (isNew) {
      setIsPublished(!isPublished);
      return;
    }

    if (!doc) return;

    const { doc: updated, error } = await togglePublishStatus(doc.id);
    if (error) {
      console.error("Error toggling publish:", error);
      return;
    }
    if (updated) {
      setDoc(updated);
      setIsPublished(updated.is_published);
    }
  }, [isNew, isPublished, doc]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!doc) return;
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;

    const { error } = await deleteDoc(doc.id, orgId, doc.slug);
    if (error) {
      console.error("Error deleting doc:", error);
      return;
    }
    router.push(`/docs/${orgId}`);
  }, [doc, orgId, router]);

  // Get repo name
  const repoName = useMemo(() => {
    if (!repoId) return null;
    return repos.find((r) => r.id === repoId);
  }, [repoId, repos]);

  // Handle copy share link
  const handleCopyShareLink = useCallback(() => {
    if (!organization) return;
    const shareUrl = `${window.location.origin}/share/${organization.slug}/${docSlug}`;
    navigator.clipboard.writeText(shareUrl);
    setShareLinkCopied(true);
    setTimeout(() => setShareLinkCopied(false), 2000);
  }, [organization, docSlug]);

  // Close repo dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        repoDropdownRef.current &&
        !repoDropdownRef.current.contains(event.target as Node)
      ) {
        setIsRepoDropdownOpen(false);
      }
    };

    if (isRepoDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isRepoDropdownOpen]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080a]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading document...</p>
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
            href={`/docs/${orgId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Docs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080a] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0c0c0e] flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back + Doc Info */}
            <div className="flex items-center gap-4 min-w-0">
              <Link
                href={`/docs/${orgId}`}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 text-white" />
              </Link>

              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-violet-400" />
                </div>
                <div className="min-w-0">
                  {isViewMode ? (
                    <h1 className="block w-full text-white font-semibold truncate text-base">
                      {title || "Untitled Document"}
                    </h1>
                  ) : (
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Document Title"
                      className="block w-full bg-transparent text-white font-semibold focus:outline-none truncate text-base"
                    />
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {organization && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {organization.name}
                      </span>
                    )}
                    {repoName && (
                      <span className="flex items-center gap-1">
                        <FolderGit2 className="w-3 h-3" />
                        {repoName.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* View Mode: Show Edit button */}
              {isViewMode ? (
                <button
                  onClick={() => setIsViewMode(false)}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              ) : (
                <>
                  {/* Repo Selector - Custom Dropdown */}
                  <div className="relative" ref={repoDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsRepoDropdownOpen(!isRepoDropdownOpen)}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm hover:bg-white/10 focus:outline-none focus:border-violet-500 transition-colors max-w-[180px] w-full"
                    >
                      <span className="truncate">
                        {repoId
                          ? repos.find((r) => r.id === repoId)?.name || "Select Repo"
                          : "All Repos"}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 flex-shrink-0 transition-transform ${
                          isRepoDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {isRepoDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-[#0c0c0e] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                        <div className="max-h-60 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setRepoId(null);
                              setIsRepoDropdownOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                              !repoId
                                ? "bg-violet-500/20 text-violet-300"
                                : "text-white hover:bg-white/5"
                            }`}
                          >
                            <FolderGit2 className="w-4 h-4 flex-shrink-0" />
                            <span>All Repos</span>
                          </button>
                          {repos.map((repo) => (
                            <button
                              key={repo.id}
                              type="button"
                              onClick={() => {
                                setRepoId(repo.id);
                                setIsRepoDropdownOpen(false);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                repoId === repo.id
                                  ? "bg-violet-500/20 text-violet-300"
                                  : "text-white hover:bg-white/5"
                              }`}
                            >
                              <FolderGit2 className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{repo.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Preview Toggle */}
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      showPreview
                        ? "bg-violet-500/20 text-violet-400"
                        : "bg-white/5 text-gray-400 hover:text-white"
                    }`}
                  >
                    {showPreview ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Preview</span>
                  </button>
                </>
              )}

              {/* Show status badge in view mode, full controls in edit mode */}
              {isViewMode ? (
                <>
                  {/* Share button - only show when published */}
                  {isPublished && (
                    <button
                      onClick={handleCopyShareLink}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                    >
                      {shareLinkCopied ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4" />
                          <span>Share</span>
                        </>
                      )}
                    </button>
                  )}
                  {/* Publish status badge */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                      isPublished
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-gray-500/10 text-gray-400"
                    }`}
                  >
                    {isPublished ? (
                      <>
                        <Globe className="w-4 h-4" />
                        <span>Published</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Draft</span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Share button - only show when published and not new */}
                  {isPublished && !isNew && (
                    <button
                      onClick={handleCopyShareLink}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                    >
                      {shareLinkCopied ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span className="hidden sm:inline">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Share</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Publish Toggle */}
                  <button
                    onClick={handleTogglePublish}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isPublished
                        ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        : "bg-gray-500/10 text-gray-400 hover:bg-gray-500/20"
                    }`}
                  >
                    {isPublished ? (
                      <>
                        <Globe className="w-4 h-4" />
                        <span className="hidden sm:inline">Published</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span className="hidden sm:inline">Draft</span>
                      </>
                    )}
                  </button>

                  {/* Delete */}
                  {!isNew && (
                    <button
                      onClick={handleDelete}
                      className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-gray-500 hover:text-red-400"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Save Button */}
                  <button
                    onClick={handleSave}
                    disabled={isSaving || (!hasChanges && !isNew)}
                    className="flex items-center gap-2 px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Save</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex">
        {isViewMode ? (
          /* View Mode: Full-width read-only preview */
          <div 
            ref={previewRef}
            className="w-full overflow-y-auto p-8 max-w-4xl mx-auto"
            onClick={handlePreviewClick}
          >
            <div className="prose prose-invert max-w-none">
              {content ? (
                <div
                  className="markdown-preview"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(content),
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-lg">This document is empty</p>
                  <button
                    onClick={() => setIsViewMode(false)}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Start Writing
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Edit Mode: Editor with optional preview panel */
          <>
            {/* Editor Panel */}
            <div
              className={`${
                showPreview ? "w-1/2" : "w-full"
              } border-r border-white/5 transition-all`}
            >
              <DocMarkdownEditor
                value={content}
                onChange={setContent}
                orgId={orgId}
                repoId={repoId}
                placeholder={`Start writing documentation...\n\nTip: Use [[Node: ComponentName]] to link to code components.${
                  repoId
                    ? "\n\nAutocomplete is filtered to the selected repository."
                    : "\n\nAutocomplete searches across all repositories in this organization."
                }`}
              />
            </div>

            {/* Preview Panel */}
            {showPreview && (
              <div 
                ref={previewRef}
                className="w-1/2 overflow-y-auto p-6"
                onClick={handlePreviewClick}
              >
                <div className="prose prose-invert max-w-none">
                  {content ? (
                    <div
                      className="markdown-preview"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(content),
                      }}
                    />
                  ) : (
                    <p className="text-gray-500 italic">
                      Start writing to see preview...
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// Simple markdown renderer (basic implementation)
function renderMarkdown(content: string): string {
  let html = content
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-8 mb-3">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
    // Bold and Italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-white/5 rounded-lg p-4 overflow-x-auto my-4"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-sm">$1</code>')
    // Node links - make them clickable
    .replace(
      /\[\[Node:\s*([^\]]+)\]\]/g,
      '<a href="#" data-node-name="$1" class="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 hover:text-violet-200 rounded text-sm font-medium cursor-pointer transition-colors no-underline">$1 →</a>'
    )
    // Lists
    .replace(/^\s*[-*]\s+(.*)$/gm, '<li class="ml-4 my-1">$1</li>')
    // Paragraphs
    .replace(/\n\n/g, "</p><p class='my-4'>")
    .replace(/\n/g, "<br>");

  // Wrap list items
  html = html.replace(
    /(<li.*?<\/li>)+/g,
    '<ul class="list-disc ml-4 my-4">$&</ul>'
  );

  return `<p class="my-4">${html}</p>`;
}
