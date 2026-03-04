// @ts-nocheck - Supabase session/provider fields are not fully represented in generated types
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  description: string | null;
  updated_at?: string;
  owner: {
    id: number;
    login: string;
    avatar_url: string | null;
  };
};

type GitHubOrg = {
  id: number;
  login: string;
};

function getGitHubErrorMessage(status: number, path?: string): string {
  if (status === 401) return "GitHub token expired. Sign out and sign in with GitHub again.";
  if (status === 403) return "GitHub API rate limit reached. Try again in a few minutes.";
  return `GitHub API request failed (${status})${path ? ` for ${path}` : ""}.`;
}

async function githubFetchJson<T>(providerToken: string, path: string): Promise<T> {
  const githubUrl = new URL(`https://api.github.com${path}`);
  const githubResponse = await fetch(githubUrl.toString(), {
    headers: {
      Authorization: `Bearer ${providerToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (!githubResponse.ok) {
    throw new Error(getGitHubErrorMessage(githubResponse.status, path));
  }

  return (await githubResponse.json()) as T;
}

async function fetchPaginatedReposFromPath(
  providerToken: string,
  pathFactory: (page: number) => string,
  maxPages = 5
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const path = pathFactory(page);
    const pageRepos = await githubFetchJson<GitHubRepo[]>(providerToken, path);
    repos.push(...pageRepos);

    if (!Array.isArray(pageRepos) || pageRepos.length < 100) {
      break;
    }
  }

  return repos;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    let providerToken = (session as any)?.provider_token as string | undefined;

    // Some sessions may need a refresh before provider_token is available.
    if (!providerToken) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      providerToken = (refreshed?.session as any)?.provider_token as string | undefined;
    }

    if (!providerToken) {
      return NextResponse.json(
        {
          error:
            "No GitHub OAuth token found in your session. Sign out and sign in with GitHub to enable repo import.",
        },
        { status: 400 }
      );
    }

    const requestUrl = new URL(request.url);
    const q = requestUrl.searchParams.get("q")?.trim().toLowerCase() || "";

    // Pull repos accessible to the user (owner + collaborator + org repos).
    // We paginate to avoid losing org repos when accounts have many repos.
    const userRepos = await fetchPaginatedReposFromPath(
      providerToken,
      (page) =>
        `/user/repos?sort=updated&direction=desc&per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`,
      10
    );

    // Also query org repos explicitly; this helps in setups where /user/repos misses some org repos.
    const orgs = await githubFetchJson<GitHubOrg[]>(
      providerToken,
      "/user/orgs?per_page=100&page=1"
    ).catch(() => []);

    const orgRepos: GitHubRepo[] = [];
    for (const org of orgs) {
      try {
        const reposForOrg = await fetchPaginatedReposFromPath(
          providerToken,
          (page) => `/orgs/${encodeURIComponent(org.login)}/repos?type=all&per_page=100&page=${page}`,
          5
        );
        orgRepos.push(...reposForOrg);
      } catch {
        // Ignore org-specific failures (SSO restrictions, app restrictions, etc.) and keep partial results.
      }
    }

    const deduped = new Map<number, GitHubRepo>();
    [...userRepos, ...orgRepos].forEach((repo) => deduped.set(repo.id, repo));
    const repos = Array.from(deduped.values()).sort((a, b) =>
      (b.updated_at || "").localeCompare(a.updated_at || "")
    );

    const filtered = q
      ? repos.filter(
          (repo) =>
            repo.full_name.toLowerCase().includes(q) ||
            repo.name.toLowerCase().includes(q) ||
            (repo.description || "").toLowerCase().includes(q)
        )
      : repos;

    return NextResponse.json({
      repos: filtered.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        default_branch: repo.default_branch,
        html_url: repo.html_url,
        description: repo.description,
        owner: {
          id: repo.owner.id,
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url,
        },
      })),
    });
  } catch (error: any) {
    console.error("[GitHub Repos API] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load GitHub repositories." },
      { status: 500 }
    );
  }
}
