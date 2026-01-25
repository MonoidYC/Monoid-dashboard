import { NextRequest, NextResponse } from "next/server";
import { getRoadmapById, getRepoWithOrganization } from "@/lib/roadmap/queries";
import { updateRoadmapSyncStatus } from "@/lib/roadmap/mutations";

// GitHub API helper
async function createOrUpdateFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  token: string,
  existingSha?: string
): Promise<{ sha: string; success: boolean }> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content).toString("base64"),
  };

  if (existingSha) {
    body.sha = existingSha;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to update file");
  }

  const data = await response.json();
  return { sha: data.content.sha, success: true };
}

// Get existing file SHA if it exists
async function getFileSha(
  owner: string,
  repo: string,
  path: string,
  token: string
): Promise<string | undefined> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (response.ok) {
    const data = await response.json();
    return data.sha;
  }

  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const { roadmapId, githubToken } = await request.json();

    if (!roadmapId) {
      return NextResponse.json(
        { error: "Missing roadmapId" },
        { status: 400 }
      );
    }

    // Use provided token or server-side token
    const token = githubToken || process.env.GITHUB_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "GitHub token not provided" },
        { status: 401 }
      );
    }

    // Get roadmap
    const roadmap = await getRoadmapById(roadmapId);
    if (!roadmap) {
      return NextResponse.json(
        { error: "Roadmap not found" },
        { status: 404 }
      );
    }

    // Get repo info
    const repoData = await getRepoWithOrganization(roadmap.repo_id);
    if (!repoData) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    const { repo, organization } = repoData;

    // Determine target repo and path
    // If org exists, prefer org-level roadmap repo, otherwise use the repo itself
    const targetOwner = organization ? organization.slug : repo.owner;
    const targetRepo = organization ? ".github" : repo.name;
    const filePath = organization
      ? `roadmaps/${repo.name}.md`
      : "ROADMAP.md";

    // Build markdown content
    const fullContent = `# ${roadmap.title}\n\n${roadmap.content}\n\n---\n*Last synced from Monoid Dashboard*\n`;

    try {
      // Check if file exists
      const existingSha = await getFileSha(targetOwner, targetRepo, filePath, token);

      // Create or update file
      const result = await createOrUpdateFile(
        targetOwner,
        targetRepo,
        filePath,
        fullContent,
        `Update roadmap: ${roadmap.title}`,
        token,
        existingSha
      );

      // Update sync status in database
      await updateRoadmapSyncStatus(roadmapId, filePath);

      return NextResponse.json({
        success: true,
        filePath,
        commitSha: result.sha,
        targetRepo: `${targetOwner}/${targetRepo}`,
      });
    } catch (gitError: any) {
      // If org .github repo doesn't exist, fall back to main repo
      if (organization && gitError.message.includes("Not Found")) {
        const fallbackPath = "ROADMAP.md";
        const existingSha = await getFileSha(repo.owner, repo.name, fallbackPath, token);

        const result = await createOrUpdateFile(
          repo.owner,
          repo.name,
          fallbackPath,
          fullContent,
          `Update roadmap: ${roadmap.title}`,
          token,
          existingSha
        );

        await updateRoadmapSyncStatus(roadmapId, fallbackPath);

        return NextResponse.json({
          success: true,
          filePath: fallbackPath,
          commitSha: result.sha,
          targetRepo: `${repo.owner}/${repo.name}`,
        });
      }

      throw gitError;
    }
  } catch (error: any) {
    console.error("Error syncing to GitHub:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync to GitHub" },
      { status: 500 }
    );
  }
}
