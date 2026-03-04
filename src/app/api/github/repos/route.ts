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
  owner: {
    id: number;
    login: string;
    avatar_url: string | null;
  };
};

function getGitHubErrorMessage(status: number): string {
  if (status === 401) return "GitHub token expired. Sign out and sign in with GitHub again.";
  if (status === 403) return "GitHub API rate limit reached. Try again in a few minutes.";
  return `GitHub API request failed (${status}).`;
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
    const perPage = 100;
    const page = 1;

    const githubUrl = new URL("https://api.github.com/user/repos");
    githubUrl.searchParams.set("sort", "updated");
    githubUrl.searchParams.set("direction", "desc");
    githubUrl.searchParams.set("per_page", String(perPage));
    githubUrl.searchParams.set("page", String(page));
    githubUrl.searchParams.set("visibility", "all");
    githubUrl.searchParams.set("affiliation", "owner,collaborator,organization_member");

    const githubResponse = await fetch(githubUrl.toString(), {
      headers: {
        Authorization: `Bearer ${providerToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });

    if (!githubResponse.ok) {
      return NextResponse.json(
        { error: getGitHubErrorMessage(githubResponse.status) },
        { status: githubResponse.status }
      );
    }

    const repos = (await githubResponse.json()) as GitHubRepo[];
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
