"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GitBranch, Network, FlaskConical, Loader2, Calendar, Hash, Box, ChevronDown, ChevronRight, FolderGit2, Map as MapIcon, Building2, CheckCircle2, XCircle, Clock, FileText, LogOut, Github } from "lucide-react";
import { getRepoVersions, type VersionTestStats } from "@/lib/graph/queries";
import type { RepoVersionRow, RepoRow, OrganizationRow } from "@/lib/graph/types";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface VersionWithTestStats {
  version: RepoVersionRow;
  testStats: VersionTestStats;
}

interface RepoGroup {
  repo: RepoRow;
  organization: OrganizationRow | null;
  versions: VersionWithTestStats[];
}

export default function Home() {
  const [repoGroups, setRepoGroups] = useState<RepoGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // Get user info
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        // Load repo versions
        const data = await getRepoVersions();
        
        // Group versions by repo
        const groupMap = new Map<string, RepoGroup>();
        
        for (const { version, repo, organization, testStats } of data) {
          const existing = groupMap.get(repo.id);
          if (existing) {
            existing.versions.push({ version, testStats });
          } else {
            groupMap.set(repo.id, { repo, organization, versions: [{ version, testStats }] });
          }
        }
        
        // Convert to array and sort by most recent version
        const groups = Array.from(groupMap.values()).sort((a, b) => {
          const aLatest = a.versions[0]?.version.ingested_at || "";
          const bLatest = b.versions[0]?.version.ingested_at || "";
          return bLatest.localeCompare(aLatest);
        });
        
        setRepoGroups(groups);
        
        // Auto-expand repos with versions
        setExpandedRepos(new Set(groups.map(g => g.repo.id)));
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Toggle repo expansion
  const toggleRepo = (repoId: string) => {
    setExpandedRepos(prev => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  // Format date
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

  // Format relative time
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

  // Get user display info
  const userAvatarUrl = user?.user_metadata?.avatar_url;
  const userName = user?.user_metadata?.user_name || user?.email || "User";

  return (
    <main className="min-h-screen flex flex-col bg-[#08080a]">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.08] flex items-center justify-center">
              <Network className="w-5 h-5 text-white/90" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-white">
              Monoid
            </span>
          </div>

          {/* User info + Sign out */}
          <div className="flex items-center gap-4">
            {user && (
              <>
                <div className="flex items-center gap-3">
                  {userAvatarUrl ? (
                    <img
                      src={userAvatarUrl}
                      alt={userName}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 text-sm font-medium">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-white/70">{userName}</span>
                </div>
                <a
                  href="/auth/signout"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Available Repos Section */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : repoGroups.length > 0 ? (
            <div>
              <h2 className="text-lg font-medium text-white/80 mb-6 tracking-tight">
                Your Repositories
              </h2>
              <div className="space-y-3">
                {repoGroups.map(({ repo, organization, versions }) => (
                  <div
                    key={repo.id}
                    className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden"
                  >
                    {/* Repo Header - Clickable to expand/collapse */}
                    <button
                      onClick={() => toggleRepo(repo.id)}
                      className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {/* Organization Avatar or Default Icon */}
                        {organization?.avatar_url ? (
                          <img
                            src={organization.avatar_url}
                            alt={organization.name}
                            className="w-10 h-10 rounded-xl"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                            <FolderGit2 className="w-5 h-5 text-white/60" />
                          </div>
                        )}
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            {/* Organization Badge */}
                            {organization && (
                              <a
                                href={`https://github.com/${organization.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-xs font-medium hover:bg-violet-500/20 transition-colors"
                              >
                                <Building2 className="w-3 h-3" />
                                {organization.name}
                              </a>
                            )}
                            <span className="font-medium text-white/90">
                              {repo.owner}/{repo.name}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 mt-0.5">
                            {versions.length} {versions.length === 1 ? "commit" : "commits"}
                            {versions[0]?.version.ingested_at && (
                              <span className="text-gray-600"> · Last updated {formatRelativeTime(versions[0].version.ingested_at)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Docs Link - Only show if organization exists */}
                        {organization && (
                          <Link
                            href={`/docs/${organization.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 text-xs font-medium hover:bg-cyan-500/25 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Docs
                          </Link>
                        )}
                        {/* Roadmap Link */}
                        <Link
                          href={`/roadmap/${repo.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 text-xs font-medium hover:bg-violet-500/20 transition-colors"
                        >
                          <MapIcon className="w-3.5 h-3.5" />
                          Roadmap
                        </Link>
                        {expandedRepos.has(repo.id) ? (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                    </button>

                    {/* Versions List - Expanded */}
                    {expandedRepos.has(repo.id) && (
                      <div className="border-t border-white/[0.04]">
                        {versions.map(({ version, testStats }, index) => (
                          <div
                            key={version.id}
                            className={`p-4 pl-[4.5rem] ${
                              index !== versions.length - 1 ? "border-b border-white/[0.03]" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/15 to-blue-500/15 flex items-center justify-center">
                                  <Hash className="w-4 h-4 text-white/50" />
                                </div>
                                <div className="text-left">
                                  <div className="font-mono text-sm text-white/80">
                                    {version.commit_sha.slice(0, 7)}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                    {version.branch && (
                                      <span className="flex items-center gap-1">
                                        <GitBranch className="w-3 h-3" />
                                        {version.branch}
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {formatDate(version.ingested_at)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {/* Stats */}
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Box className="w-3.5 h-3.5" />
                                    {version.node_count ?? 0} nodes
                                  </span>
                                  {testStats.testCount > 0 && (
                                    <span className={`flex items-center gap-1 ${
                                      testStats.failedCount > 0
                                        ? "text-red-400"
                                        : testStats.passedCount === testStats.testCount
                                        ? "text-emerald-400"
                                        : "text-gray-400"
                                    }`}>
                                      {testStats.failedCount > 0 ? (
                                        <XCircle className="w-3.5 h-3.5" />
                                      ) : testStats.passedCount === testStats.testCount ? (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      ) : (
                                        <Clock className="w-3.5 h-3.5" />
                                      )}
                                      {testStats.testCount} tests
                                    </span>
                                  )}
                                </div>
                                {/* Action Links */}
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/graph/${version.id}`}
                                    className="px-3 py-1.5 rounded-lg bg-white/[0.05] text-white/70 text-xs font-medium hover:bg-white/[0.1] transition-colors flex items-center gap-1.5"
                                  >
                                    <Network className="w-3.5 h-3.5" />
                                    Graph
                                  </Link>
                                  {testStats.testCount > 0 && (
                                    <Link
                                      href={`/tests/${version.id}`}
                                      className="px-3 py-1.5 rounded-lg bg-lime-500/10 text-lime-400 text-xs font-medium hover:bg-lime-500/20 transition-colors flex items-center gap-1.5"
                                    >
                                      <FlaskConical className="w-3.5 h-3.5" />
                                      Tests
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-6">
                <FolderGit2 className="w-8 h-8 text-white/30" />
              </div>
              <h2 className="text-xl font-medium text-white/80 mb-2">No repositories yet</h2>
              <p className="text-gray-500 max-w-md">
                Connect your GitHub repositories to get started with code graph visualization.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-center">
          <a
            href="https://github.com/MonoidYC"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-400 transition-colors"
          >
            <Github className="w-4 h-4" />
            Monoid 2026
          </a>
        </div>
      </footer>
    </main>
  );
}
