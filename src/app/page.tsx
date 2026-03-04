"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  FolderGit2,
  Hash,
  Loader2,
  Network,
  LogOut,
  Github,
  Play,
  Plus,
  RefreshCw,
  Search,
  X,
  ExternalLink,
  Lock,
} from "lucide-react";
import { getOrganizationsWithRepos } from "@/lib/graph/queries";
import type { OrganizationWithRepos, RepoWithVersions, RepoVersionRow } from "@/lib/graph/types";
import { createClient } from "@/lib/supabase/client";

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  description: string | null;
  owner: {
    id: number;
    login: string;
    avatar_url: string | null;
  };
};

export default function Home() {
  const router = useRouter();
  const supabase = createClient();
  const [orgData, setOrgData] = useState<OrganizationWithRepos[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  const [isRepoPickerOpen, setIsRepoPickerOpen] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [githubReposLoading, setGithubReposLoading] = useState(false);
  const [githubReposError, setGithubReposError] = useState<string | null>(null);
  const [repoSearchQuery, setRepoSearchQuery] = useState("");
  const [importingRepo, setImportingRepo] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [justImportedRepos, setJustImportedRepos] = useState<Set<string>>(new Set());

  // Ingestion job tracking: repoId -> { job_id, status, repo_version_id }
  const [activeJobs, setActiveJobs] = useState<
    Map<string, { job_id: string; status: string; repo_version_id?: string | null; error?: string | null }>
  >(new Map());

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getOrganizationsWithRepos();
      setOrgData(data);

      // Auto-expand orgs and repos with versions
      const orgsToExpand = new Set<string>();
      const reposToExpand = new Set<string>();
      for (const org of data) {
        if (org.repos.length > 0) {
          orgsToExpand.add(org.organization.id);
          for (const repo of org.repos) {
            if (repo.versions.length > 0) {
              reposToExpand.add(repo.repo.id);
            }
          }
        }
      }
      setExpandedOrgs(orgsToExpand);
      setExpandedRepos(reposToExpand);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load existing active ingest jobs on mount
  type IngestJobRow = { id: string; repo_id: string; status: string; repo_version_id: string | null; error: string | null };
  const loadActiveJobs = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("ingest_jobs")
        .select("id, repo_id, status, repo_version_id, error")
        .or("status.eq.pending,status.eq.running");

      const jobs = (data ?? []) as unknown as IngestJobRow[];

      if (jobs.length > 0) {
        setActiveJobs((prev) => {
          const next = new Map(prev);
          for (const job of jobs) {
            next.set(job.repo_id, {
              job_id: job.id,
              status: job.status,
              repo_version_id: job.repo_version_id,
              error: job.error,
            });
          }
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to load active jobs:", err);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
    loadActiveJobs();
  }, [loadData, loadActiveJobs]);

  // Poll active ingestion jobs every 3 seconds
  useEffect(() => {
    const jobsToPoll = Array.from(activeJobs.entries()).filter(
      ([, job]) => job.status === "pending" || job.status === "running"
    );
    if (jobsToPoll.length === 0) return;

    const interval = setInterval(async () => {
      for (const [repoId, job] of jobsToPoll) {
        try {
          const { data: rawData, error: queryError } = await supabase
            .from("ingest_jobs")
            .select("id, status, repo_version_id, error")
            .eq("id", job.job_id)
            .single();

          if (queryError || !rawData) continue;
          const row = rawData as unknown as IngestJobRow;

          setActiveJobs((prev) => {
            const next = new Map(prev);
            next.set(repoId, {
              job_id: row.id,
              status: row.status,
              repo_version_id: row.repo_version_id,
              error: row.error,
            });
            return next;
          });

          // If succeeded, refresh data to show the new version
          if (row.status === "succeeded") {
            await loadData();
          }
        } catch (err) {
          console.error(`Error polling job ${job.job_id}:`, err);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeJobs, supabase, loadData]);

  const fetchGitHubRepos = useCallback(async () => {
    setGithubReposLoading(true);
    setGithubReposError(null);

    try {
      const response = await fetch("/api/github/repos", { cache: "no-store" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load GitHub repositories.");
      }

      const repos = Array.isArray(payload?.repos) ? (payload.repos as GitHubRepo[]) : [];
      setGithubRepos(repos);
    } catch (error: any) {
      console.error("Failed to fetch GitHub repos:", error);
      setGithubReposError(error?.message || "Failed to load GitHub repositories.");
    } finally {
      setGithubReposLoading(false);
    }
  }, []);

  const openRepoPicker = async () => {
    setIsRepoPickerOpen(true);
    setImportMessage(null);
    if (githubRepos.length === 0) {
      await fetchGitHubRepos();
    }
  };

  const handleImportRepo = async (repo: GitHubRepo) => {
    setGithubReposError(null);
    setImportMessage(null);
    setImportingRepo(repo.full_name);

    try {
      const response = await fetch("/api/github/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to import repository.");
      }

      setJustImportedRepos((prev) => {
        const next = new Set(prev);
        next.add(repo.full_name.toLowerCase());
        return next;
      });

      const base = payload?.created
        ? `Imported ${repo.full_name}.`
        : `${repo.full_name} is already linked in your dashboard.`;
      const analysisMessage =
        typeof payload?.analysis?.message === "string"
          ? payload.analysis.message
          : 'Run "Monoid: Visualize All Code" in VS Code to ingest graph data.';
      setImportMessage(`${base} ${analysisMessage}`);

      // Track ingestion job if one was created
      if (payload?.analysis?.job_id && payload?.repo?.id) {
        setActiveJobs((prev) => {
          const next = new Map(prev);
          next.set(payload.repo.id, {
            job_id: payload.analysis.job_id,
            status: payload.analysis.job_status || "pending",
          });
          return next;
        });
      }

      await loadData();
    } catch (error: any) {
      console.error("Failed to import repo:", error);
      setGithubReposError(error?.message || "Failed to import repository.");
    } finally {
      setImportingRepo(null);
    }
  };

  const handleAnalyzeRepo = async (repo: { id: string; owner: string; name: string; default_branch: string | null; organization_id: string | null; workspace_id: string }) => {
    // Check if there's already an active job
    const existing = activeJobs.get(repo.id);
    if (existing && (existing.status === "pending" || existing.status === "running")) {
      return; // Already in progress
    }

    try {
      const response = await fetch("/api/github/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: {
            id: 0, // Not used for existing repos
            name: repo.name,
            full_name: `${repo.owner}/${repo.name}`,
            default_branch: repo.default_branch || "main",
            owner: {
              id: 0,
              login: repo.owner,
              avatar_url: null,
            },
          },
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("Failed to trigger analysis:", payload?.error);
        return;
      }

      if (payload?.analysis?.job_id) {
        setActiveJobs((prev) => {
          const next = new Map(prev);
          next.set(repo.id, {
            job_id: payload.analysis.job_id,
            status: payload.analysis.job_status || "pending",
          });
          return next;
        });
      }
    } catch (error) {
      console.error("Failed to trigger analysis:", error);
    }
  };

  const toggleOrg = (orgId: string) => {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  };

  const toggleRepo = (repoId: string) => {
    setExpandedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) next.delete(repoId);
      else next.add(repoId);
      return next;
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Unknown";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  const getOrgStats = useMemo(() => {
    return (org: OrganizationWithRepos) => {
      const totalRepos = org.repos.length;
      const totalVersions = org.repos.reduce((sum, r) => sum + r.versions.length, 0);
      const latestVersion = org.repos
        .flatMap((r) => r.versions)
        .sort((a, b) => (b.ingested_at || "").localeCompare(a.ingested_at || ""))[0];
      return { totalRepos, totalVersions, latestVersion };
    };
  }, []);

  const existingRepoKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const org of orgData) {
      for (const repoData of org.repos) {
        keys.add(`${repoData.repo.owner}/${repoData.repo.name}`.toLowerCase());
      }
    }
    return keys;
  }, [orgData]);

  const getJobStatusBadge = useCallback(
    (repoId: string) => {
      const job = activeJobs.get(repoId);
      if (!job) return null;

      const statusConfig: Record<string, { label: string; color: string; animate?: boolean }> = {
        pending: {
          label: "Queued",
          color: "bg-amber-500/10 border-amber-500/20 text-amber-300",
          animate: true,
        },
        running: {
          label: "Analyzing",
          color: "bg-blue-500/10 border-blue-500/20 text-blue-300",
          animate: true,
        },
        succeeded: {
          label: "Ready",
          color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
        },
        failed: {
          label: "Failed",
          color: "bg-red-500/10 border-red-500/20 text-red-300",
        },
      };

      const config = statusConfig[job.status] || statusConfig.pending;

      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-wide font-medium ${config.color}`}
        >
          {config.animate && <Loader2 className="w-3 h-3 animate-spin" />}
          {config.label}
          {job.status === "succeeded" && job.repo_version_id && (
            <Link
              href={`/graph/${job.repo_version_id}`}
              onClick={(e) => e.stopPropagation()}
              className="ml-1 underline text-emerald-200 hover:text-emerald-100"
            >
              View Graph
            </Link>
          )}
        </span>
      );
    },
    [activeJobs]
  );

  const filteredGitHubRepos = useMemo(() => {
    const query = repoSearchQuery.trim().toLowerCase();
    if (!query) return githubRepos;
    return githubRepos.filter((repo) => {
      return (
        repo.full_name.toLowerCase().includes(query) ||
        repo.name.toLowerCase().includes(query) ||
        (repo.description || "").toLowerCase().includes(query)
      );
    });
  }, [githubRepos, repoSearchQuery]);

  return (
    <main className="min-h-screen bg-[#08080a] text-white">
      <header className="border-b border-white/5 bg-[#0c0c0e]">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                <Network className="w-5 h-5 text-white/80" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Monoid</h1>
                <p className="text-sm text-gray-400">Visualize your codebase as a graph.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openRepoPicker}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-sm font-medium text-violet-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Import Repo
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-white/70 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : orgData.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-8 text-center">
            <p className="text-gray-400">
              No repositories imported yet. Click{" "}
              <button onClick={openRepoPicker} className="text-violet-300 hover:text-violet-200 underline underline-offset-2">
                Import Repo
              </button>{" "}
              to add a GitHub repository and automatically analyze it.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orgData.map(({ organization, repos }: OrganizationWithRepos) => {
              const isExpanded = expandedOrgs.has(organization.id);
              const { totalRepos, totalVersions, latestVersion } = getOrgStats({ organization, repos });
              const isRealOrg = organization.id !== "unassigned";

              return (
                <div
                  key={organization.id}
                  className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden"
                >
                  <button
                    onClick={() => toggleOrg(organization.id)}
                    className="w-full p-5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {organization.avatar_url ? (
                          <img src={organization.avatar_url} alt={organization.name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-5 h-5 text-violet-300/70" />
                        )}
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="font-medium text-white/90 truncate">{organization.name}</div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                          <span>
                            {totalRepos} {totalRepos === 1 ? "repo" : "repos"}
                          </span>
                          <span className="text-gray-700">·</span>
                          <span>
                            {totalVersions} {totalVersions === 1 ? "commit" : "commits"}
                          </span>
                          {latestVersion?.ingested_at && (
                            <>
                              <span className="text-gray-700">·</span>
                              <span>Updated {formatRelativeTime(latestVersion.ingested_at)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {isRealOrg && (
                        <Link
                          href={`/docs/${organization.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-300 text-xs font-medium transition-colors"
                        >
                          Docs
                        </Link>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                  </button>

                  {isExpanded && repos.length > 0 && (
                    <div className="border-t border-white/[0.04]">
                      {repos.map((repoData: RepoWithVersions, repoIndex: number) => {
                        const { repo, versions } = repoData;
                        const isRepoExpanded = expandedRepos.has(repo.id);

                        return (
                          <div key={repo.id}>
                            <button
                              onClick={() => toggleRepo(repo.id)}
                              className={`w-full p-4 pl-8 flex items-center justify-between hover:bg-white/[0.02] transition-colors ${
                                repoIndex !== repos.length - 1 && !isRepoExpanded ? "border-b border-white/[0.03]" : ""
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                  <FolderGit2 className="w-4 h-4 text-blue-300/70" />
                                </div>
                                <div className="text-left">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-white/80">
                                      {repo.owner}/{repo.name}
                                    </span>
                                    {getJobStatusBadge(repo.id)}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {versions.length} {versions.length === 1 ? "commit" : "commits"}
                                    {versions[0]?.ingested_at && (
                                      <span className="text-gray-600"> · {formatRelativeTime(versions[0].ingested_at)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {(() => {
                                  const job = activeJobs.get(repo.id);
                                  const isActive = job && (job.status === "pending" || job.status === "running");
                                  if (!isActive) {
                                    return (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAnalyzeRepo({
                                            id: repo.id,
                                            owner: repo.owner,
                                            name: repo.name,
                                            default_branch: repo.default_branch,
                                            organization_id: repo.organization_id,
                                            workspace_id: repo.workspace_id,
                                          });
                                        }}
                                        className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors flex items-center gap-1.5"
                                      >
                                        {versions.length > 0 ? (
                                          <>
                                            <RefreshCw className="w-3 h-3" />
                                            Re-analyze
                                          </>
                                        ) : (
                                          <>
                                            <Play className="w-3 h-3" />
                                            Analyze
                                          </>
                                        )}
                                      </button>
                                    );
                                  }
                                  return null;
                                })()}
                                {versions.length > 0 && (
                                  <Link
                                    href={`/graph/${versions[0].id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="px-3 py-1.5 rounded-full bg-white/[0.05] text-white/70 text-xs font-medium hover:bg-white/[0.1] transition-colors"
                                  >
                                    Latest →
                                  </Link>
                                )}
                                {isRepoExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-500" />
                                )}
                              </div>
                            </button>

                            {isRepoExpanded && versions.length > 0 && (
                              <div className="border-t border-white/[0.03] bg-white/[0.01]">
                                {versions.map((version: RepoVersionRow, versionIndex: number) => (
                                  <div
                                    key={version.id}
                                    className={`block p-3 pl-16 hover:bg-white/[0.03] transition-colors ${
                                      versionIndex !== versions.length - 1 ? "border-b border-white/[0.02]" : ""
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                                          <Hash className="w-3.5 h-3.5 text-white/40" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="font-mono text-sm text-white/70 truncate">
                                            {version.commit_sha.slice(0, 7)}
                                          </div>
                                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                            <span className="flex items-center gap-1">
                                              <Calendar className="w-3 h-3" />
                                              {formatDate(version.ingested_at)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <Link
                                        href={`/graph/${version.id}`}
                                        className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] flex items-center gap-2 transition-colors text-xs font-medium text-white/70"
                                      >
                                        <Network className="w-3.5 h-3.5 text-white/70" />
                                        Graph
                                      </Link>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {isRepoExpanded && repoIndex !== repos.length - 1 && <div className="border-b border-white/[0.04]" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isRepoPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close repo picker"
            className="absolute inset-0 bg-black/75"
            onClick={() => setIsRepoPickerOpen(false)}
          />

          <div className="relative w-full max-w-3xl max-h-[88vh] rounded-2xl bg-[#0f0f12] border border-white/10 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Import from GitHub</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Select a repository to add it to your Monoid dashboard.
                </p>
              </div>
              <button
                onClick={() => setIsRepoPickerOpen(false)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 border-b border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search repositories..."
                    value={repoSearchQuery}
                    onChange={(e) => setRepoSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                </div>
                <button
                  onClick={fetchGitHubRepos}
                  disabled={githubReposLoading}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 disabled:opacity-50"
                >
                  {githubReposLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {githubReposError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {githubReposError}
                </div>
              )}

              {importMessage && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  {importMessage}
                </div>
              )}
            </div>

            <div className="p-3 overflow-y-auto">
              {githubReposLoading ? (
                <div className="py-16 flex items-center justify-center text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading repositories...
                </div>
              ) : filteredGitHubRepos.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">
                  No repositories found.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredGitHubRepos.map((repo) => {
                    const repoKey = repo.full_name.toLowerCase();
                    const isExisting = existingRepoKeys.has(repoKey) || justImportedRepos.has(repoKey);
                    const isImporting = importingRepo === repo.full_name;

                    return (
                      <div
                        key={repo.id}
                        className="rounded-xl bg-white/[0.02] border border-white/[0.08] p-4 flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <Github className="w-4 h-4 text-white/60 flex-shrink-0" />
                            <div className="font-medium text-white/90 truncate">{repo.full_name}</div>
                            {repo.private && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] uppercase tracking-wide flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Private
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                            <span>Default branch: {repo.default_branch || "main"}</span>
                            <span className="text-gray-700">·</span>
                            <a
                              href={repo.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                            >
                              View on GitHub
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          {repo.description && (
                            <div className="text-sm text-gray-300/80 mt-2 line-clamp-2">
                              {repo.description}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleImportRepo(repo)}
                          disabled={isExisting || isImporting}
                          className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20"
                        >
                          {isExisting ? "Added" : isImporting ? "Importing..." : "Import"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
