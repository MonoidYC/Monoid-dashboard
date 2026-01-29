"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  FolderGit2,
  Hash,
  Loader2,
  Network,
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

  return (
    <main className="min-h-screen bg-[#08080a] text-white">
      <header className="border-b border-white/5 bg-[#0c0c0e]">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
              <Network className="w-5 h-5 text-white/80" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Monoid</h1>
              <p className="text-sm text-gray-400">Visualize your codebase as a graph.</p>
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
              No graphs ingested yet. Run the VS Code extension command{" "}
              <span className="font-mono text-gray-300">Monoid: Visualize All Code</span>.
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
    </main>
  );
}

