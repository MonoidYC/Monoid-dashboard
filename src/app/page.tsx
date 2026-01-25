"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  GitBranch, 
  Network, 
  Zap, 
  FlaskConical, 
  Loader2, 
  Calendar, 
  Hash, 
  Box, 
  ChevronDown, 
  ChevronRight, 
  FolderGit2,
  Building2,
  Globe
} from "lucide-react";
import { getOrganizationsWithRepos } from "@/lib/graph/queries";
import type { OrganizationWithRepos, RepoWithVersions, RepoVersionRow } from "@/lib/graph/types";

export default function Home() {
  const [orgData, setOrgData] = useState<OrganizationWithRepos[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadData() {
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
    }
    loadData();
  }, []);

  // Toggle organization expansion
  const toggleOrg = (orgId: string) => {
    setExpandedOrgs((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  };

  // Toggle repo expansion
  const toggleRepo = (repoId: string) => {
    setExpandedRepos((prev: Set<string>) => {
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

  // Get total stats for an org
  const getOrgStats = (org: OrganizationWithRepos) => {
    const totalRepos = org.repos.length;
    const totalVersions = org.repos.reduce((sum, r) => sum + r.versions.length, 0);
    const latestVersion = org.repos
      .flatMap(r => r.versions)
      .sort((a, b) => (b.ingested_at || "").localeCompare(a.ingested_at || ""))[0];
    return { totalRepos, totalVersions, latestVersion };
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

        {/* Organizations Section */}
        {isLoading ? (
          <div className="mb-14">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
          </div>
        ) : orgData.length > 0 ? (
          <div className="mb-14 text-left">
            <h2 className="text-lg font-medium text-white/80 mb-6 tracking-tight text-center">
              Organizations & Repositories
            </h2>
            <div className="space-y-4">
              {orgData.map(({ organization, repos }: OrganizationWithRepos) => {
                const { totalRepos, totalVersions, latestVersion } = getOrgStats({ organization, repos });
                const isExpanded = expandedOrgs.has(organization.id);
                
                return (
                  <div
                    key={organization.id}
                    className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden"
                  >
                    {/* Organization Header */}
                    <button
                      onClick={() => toggleOrg(organization.id)}
                      className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center overflow-hidden">
                          {organization.avatar_url ? (
                            <img 
                              src={organization.avatar_url} 
                              alt={organization.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Building2 className="w-6 h-6 text-white/60" />
                          )}
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-white/90 text-lg">
                            {organization.name}
                          </div>
                          <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-3">
                            <span>{totalRepos} {totalRepos === 1 ? "repo" : "repos"}</span>
                            <span className="text-gray-600">·</span>
                            <span>{totalVersions} {totalVersions === 1 ? "commit" : "commits"}</span>
                            {latestVersion?.ingested_at && (
                              <>
                                <span className="text-gray-600">·</span>
                                <span className="text-gray-600">Updated {formatRelativeTime(latestVersion.ingested_at)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                    </button>

                    {/* Repos List */}
                    {isExpanded && repos.length > 0 && (
                      <div className="border-t border-white/[0.04]">
                        {repos.map((repoData: RepoWithVersions, repoIndex: number) => {
                          const { repo, versions } = repoData;
                          const isRepoExpanded = expandedRepos.has(repo.id);
                          
                          return (
                            <div key={repo.id}>
                              {/* Repo Header */}
                              <button
                                onClick={() => toggleRepo(repo.id)}
                                className={`w-full p-4 pl-8 flex items-center justify-between hover:bg-white/[0.02] transition-colors ${
                                  repoIndex !== repos.length - 1 && !isRepoExpanded ? "border-b border-white/[0.03]" : ""
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/15 to-cyan-500/15 flex items-center justify-center">
                                    <FolderGit2 className="w-4 h-4 text-white/50" />
                                  </div>
                                  <div className="text-left">
                                    <div className="font-medium text-white/80">
                                      {repo.owner}/{repo.name}
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
                                  {versions.length > 0 && (
                                    <Link
                                      href={`/graph/${versions[0].id}`}
                                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
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

                              {/* Versions List */}
                              {isRepoExpanded && versions.length > 0 && (
                                <div className="border-t border-white/[0.03] bg-white/[0.01]">
                                  {versions.map((version: RepoVersionRow, versionIndex: number) => (
                                    <Link
                                      key={version.id}
                                      href={`/graph/${version.id}`}
                                      className={`block p-3 pl-16 hover:bg-white/[0.03] transition-colors group ${
                                        versionIndex !== versions.length - 1 ? "border-b border-white/[0.02]" : ""
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500/10 to-blue-500/10 flex items-center justify-center">
                                            <Hash className="w-3.5 h-3.5 text-white/40" />
                                          </div>
                                          <div className="text-left">
                                            <div className="font-mono text-sm text-white/70 group-hover:text-white transition-colors">
                                              {version.commit_sha.slice(0, 7)}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
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
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                          <span className="flex items-center gap-1">
                                            <Box className="w-3 h-3" />
                                            {version.node_count ?? 0} nodes
                                          </span>
                                          <span className="px-2 py-1 rounded-full bg-white/[0.04] text-white/60 text-xs group-hover:bg-white/[0.08] transition-colors">
                                            View →
                                          </span>
                                        </div>
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              )}
                              
                              {/* Border after repo if not last and repo is expanded */}
                              {isRepoExpanded && repoIndex !== repos.length - 1 && (
                                <div className="border-b border-white/[0.04]" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Empty repos state */}
                    {isExpanded && repos.length === 0 && (
                      <div className="border-t border-white/[0.04] p-6 text-center">
                        <p className="text-sm text-gray-500">No repositories in this organization yet.</p>
                      </div>
                    )}
                  </div>
                );
              })}
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
      </div>
    </main>
  );
}
