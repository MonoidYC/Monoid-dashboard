"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  FileText,
  Globe,
  Lock,
  Trash2,
  GripVertical,
  Loader2,
  AlertCircle,
  Building2,
  FolderGit2,
  ExternalLink,
  Terminal,
  Copy,
  Check,
} from "lucide-react";
import {
  getDocsByOrgId,
  getOrganizationById,
  getReposByOrgId,
  deleteDoc,
  togglePublishStatus,
  generateSlug,
  type OrgDocRow,
  type OrganizationRow,
  type RepoRow,
} from "@/lib/docs";

export default function DocsListPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  // State
  const [docs, setDocs] = useState<OrgDocRow[]>([]);
  const [organization, setOrganization] = useState<OrganizationRow | null>(null);
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New doc modal state
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocRepoId, setNewDocRepoId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // MCP info state
  const [showMcpInfo, setShowMcpInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Get MCP endpoint URL
  const mcpEndpoint = typeof window !== "undefined" 
    ? `${window.location.origin}/api/mcp`
    : "/api/mcp";
  
  const handleCopyMcp = useCallback(() => {
    navigator.clipboard.writeText(mcpEndpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [mcpEndpoint]);

  // Load data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const [org, docsList, reposList] = await Promise.all([
          getOrganizationById(orgId),
          getDocsByOrgId(orgId),
          getReposByOrgId(orgId),
        ]);

        if (!org) {
          setError("Organization not found");
          return;
        }

        setOrganization(org);
        setDocs(docsList);
        setRepos(reposList);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load documentation");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [orgId]);

  // Create new doc
  const handleCreateDoc = useCallback(async () => {
    if (!newDocTitle.trim()) return;

    setIsCreating(true);
    const slug = generateSlug(newDocTitle);

    // Navigate to editor with the new doc
    router.push(`/docs/${orgId}/${slug}?title=${encodeURIComponent(newDocTitle)}${newDocRepoId ? `&repoId=${newDocRepoId}` : ""}&new=true`);
  }, [newDocTitle, newDocRepoId, orgId, router]);

  // Toggle publish status
  const handleTogglePublish = useCallback(async (doc: OrgDocRow) => {
    const { doc: updated, error } = await togglePublishStatus(doc.id);
    if (error) {
      console.error("Error toggling publish:", error);
      return;
    }
    if (updated) {
      setDocs((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
    }
  }, []);

  // Delete doc
  const handleDelete = useCallback(async (doc: OrgDocRow) => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;

    const { error } = await deleteDoc(doc.id, orgId, doc.slug);
    if (error) {
      console.error("Error deleting doc:", error);
      return;
    }
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
  }, [orgId]);

  // Get repo name for a doc
  const getRepoName = useCallback(
    (repoId: string | null) => {
      if (!repoId) return null;
      return repos.find((r) => r.id === repoId)?.name || null;
    },
    [repos]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080a]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading documentation...</p>
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

  return (
    <div className="min-h-screen bg-[#08080a]">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0c0c0e]">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-white" />
              </Link>

              <div className="flex items-center gap-3">
                {organization?.avatar_url ? (
                  <img
                    src={organization.avatar_url}
                    alt={organization.name}
                    className="w-10 h-10 rounded-xl"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white/60" />
                  </div>
                )}
                <div>
                  <h1 className="text-lg font-semibold text-white">
                    {organization?.name} Documentation
                  </h1>
                  <p className="text-sm text-gray-500">
                    {docs.length} {docs.length === 1 ? "document" : "documents"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMcpInfo(!showMcpInfo)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showMcpInfo
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
                title="MCP Server"
              >
                <Terminal className="w-4 h-4" />
                MCP
              </button>
              <button
                onClick={() => setShowNewDocModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Document
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MCP Connection Info */}
      {showMcpInfo && (
        <div className="border-b border-white/5 bg-emerald-500/5">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Terminal className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-white mb-1">
                  MCP Server for AI Agents
                </h3>
                <p className="text-xs text-gray-400 mb-3">
                  Connect AI assistants (Claude, Cursor, etc.) to access your published documentation via the Model Context Protocol.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-black/40 rounded-lg text-xs text-emerald-300 font-mono overflow-x-auto">
                    {mcpEndpoint}
                  </code>
                  <button
                    onClick={handleCopyMcp}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  <strong className="text-gray-400">Available tools:</strong>{" "}
                  <code className="text-emerald-400/80">list_docs</code>,{" "}
                  <code className="text-emerald-400/80">get_doc</code>,{" "}
                  <code className="text-emerald-400/80">search_docs</code>
                  {organization?.slug && (
                    <span className="ml-2">
                      • Use org_slug: <code className="text-emerald-400/80">&quot;{organization.slug}&quot;</code>
                    </span>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-500">
                  <strong className="text-gray-400">Test with MCP Inspector:</strong>{" "}
                  <code className="text-white/70">npx @modelcontextprotocol/inspector</code>{" "}
                  then add the endpoint URL above
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {docs.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-white mb-2">
              No documentation yet
            </h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Create your first documentation page to help developers
              understand how to build with your APIs and components.
            </p>
            <button
              onClick={() => setShowNewDocModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Document
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => {
              const repoName = getRepoName(doc.repo_id);
              return (
                <div
                  key={doc.id}
                  className="group flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
                >
                  {/* Drag Handle */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                    <GripVertical className="w-4 h-4 text-gray-600" />
                  </div>

                  {/* Doc Icon */}
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-violet-400" />
                  </div>

                  {/* Doc Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/docs/${orgId}/${doc.slug}`}
                      className="block"
                    >
                      <h3 className="font-medium text-white truncate hover:text-violet-400 transition-colors">
                        {doc.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        {repoName && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <FolderGit2 className="w-3 h-3" />
                            {repoName}
                          </span>
                        )}
                        {doc.description && (
                          <span className="text-xs text-gray-500 truncate">
                            {doc.description}
                          </span>
                        )}
                      </div>
                    </Link>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-2">
                    {/* Publish Status */}
                    <button
                      onClick={() => handleTogglePublish(doc)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        doc.is_published
                          ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-gray-500/10 text-gray-400 hover:bg-gray-500/20"
                      }`}
                    >
                      {doc.is_published ? (
                        <>
                          <Globe className="w-3 h-3" />
                          Published
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          Draft
                        </>
                      )}
                    </button>

                    {/* View Published (if published) */}
                    {doc.is_published && organization && (
                      <a
                        href={`/api/docs/${organization.slug}/${doc.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-500 hover:text-white"
                        title="View published"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(doc)}
                      className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-gray-500 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* New Doc Modal */}
      {showNewDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 bg-[#18181b] rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-semibold text-white">
                Create New Document
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Document Title
                </label>
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="e.g., Getting Started, API Reference"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                  autoFocus
                />
              </div>

              {/* Repo Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Repository (Optional)
                </label>
                <select
                  value={newDocRepoId || ""}
                  onChange={(e) =>
                    setNewDocRepoId(e.target.value || null)
                  }
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="">General Organization Docs</option>
                  {repos.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.owner}/{repo.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-gray-500">
                  Link to a specific repo for targeted autocomplete
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewDocModal(false);
                  setNewDocTitle("");
                  setNewDocRepoId(null);
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDoc}
                disabled={!newDocTitle.trim() || isCreating}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Create"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
