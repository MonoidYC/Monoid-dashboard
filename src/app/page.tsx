"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GitBranch, Network, Zap, FlaskConical, Loader2, Calendar, Hash, Box, ChevronDown, ChevronRight, FolderGit2, Map as MapIcon, Building2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { getRepoVersions, type VersionTestStats } from "@/lib/graph/queries";
import type { RepoVersionRow, RepoRow, OrganizationRow } from "@/lib/graph/types";

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

  useEffect(() => {
    async function loadVersions() {
      setIsLoading(true);
      try {
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
        console.error("Failed to load versions:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadVersions();
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#08080a]">
      <div className="max-w-4xl mx-auto text-center">
        {/* Logo */}
        <div className="mb-10 flex items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.08] flex items-center justify-center">
            <Network className="w-8 h-8 text-white/90" />
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-white">
            Monoid
          </h1>
        </div>

        {/* Tagline */}
        <p className="text-xl text-gray-400 mb-14 max-w-xl mx-auto font-light leading-relaxed tracking-tight">
          Visualize your codebase as an interactive dependency graph.
          Understand impact and explore your architecture.
        </p>

        {/* Feature cards */}
        <div className="grid md:grid-cols-4 gap-5 mb-14">
          <div className="p-7 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center mb-5 mx-auto">
              <GitBranch className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="font-medium text-[17px] mb-2 text-white/90 tracking-tight">AST-Derived Nodes</h3>
            <p className="text-[15px] text-gray-500 leading-relaxed font-light">
              Functions, classes, endpoints, and more — parsed directly from your code.
            </p>
          </div>

          <div className="p-7 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5 mx-auto">
              <Network className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="font-medium text-[17px] mb-2 text-white/90 tracking-tight">Dependency Graph</h3>
            <p className="text-[15px] text-gray-500 leading-relaxed font-light">
              See how your code connects — imports, calls, routes, and more.
            </p>
          </div>

          <div className="p-7 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <div className="w-11 h-11 rounded-xl bg-lime-500/10 flex items-center justify-center mb-5 mx-auto">
              <FlaskConical className="w-5 h-5 text-lime-400" />
            </div>
            <h3 className="font-medium text-[17px] mb-2 text-white/90 tracking-tight">Test Visualization</h3>
            <p className="text-[15px] text-gray-500 leading-relaxed font-light">
              E2E, unit, security tests — see what&apos;s covered and what&apos;s failing.
            </p>
          </div>

          <div className="p-7 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center mb-5 mx-auto">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="font-medium text-[17px] mb-2 text-white/90 tracking-tight">Blast Radius</h3>
            <p className="text-[15px] text-gray-500 leading-relaxed font-light">
              Understand the impact of changes before you make them.
            </p>
          </div>
        </div>

        {/* Available Repos Section - Grouped by Repository */}
        {isLoading ? (
          <div className="mb-14">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
          </div>
        ) : repoGroups.length > 0 ? (
          <div className="mb-14">
            <h2 className="text-lg font-medium text-white/80 mb-6 tracking-tight">
              Available Repositories
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
        ) : null}

        {/* CTAs */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/graph/demo"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-white/10 text-white/80 border border-white/10 font-medium text-[15px] hover:bg-white/15 transition-all tracking-tight"
          >
            <Network className="w-[18px] h-[18px]" />
            View Demo Graph
          </Link>
          
          <Link
            href="/tests/demo"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/20 font-medium text-[15px] hover:bg-lime-500/20 transition-all tracking-tight"
          >
            <FlaskConical className="w-[18px] h-[18px]" />
            View Test Graph
          </Link>
        </div>

        <p className="mt-5 text-sm text-gray-600 font-light">
          No login required
        </p>
      </div>
    </main>
  );
}
