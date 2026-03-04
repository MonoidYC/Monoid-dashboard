// @ts-nocheck - Supabase generated types infer never for inserts with complex RLS
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ImportRequestBody = {
  repo?: {
    id: number;
    name: string;
    full_name: string;
    default_branch?: string;
    owner: {
      id: number;
      login: string;
      avatar_url?: string | null;
    };
  };
};

type ImportedRepo = {
  id: string;
  owner: string;
  name: string;
  default_branch: string | null;
  organization_id: string | null;
  workspace_id: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function appendSlugSuffix(base: string, attempt: number): string {
  if (attempt === 0) return base;
  const suffix = `-${attempt + 1}`;
  const maxBaseLength = 48 - suffix.length;
  const sliced = base.slice(0, Math.max(8, maxBaseLength));
  return `${sliced}${suffix}`;
}

async function triggerIngestionWebhook(repo: ImportedRepo, userId: string): Promise<{
  triggered: boolean;
  message: string;
}> {
  const webhookUrl = process.env.MONOID_INGEST_WEBHOOK_URL;
  const webhookSecret = process.env.MONOID_INGEST_WEBHOOK_SECRET;

  if (!webhookUrl) {
    return {
      triggered: false,
      message:
        "Repository imported, but no ingestion worker is configured. Set MONOID_INGEST_WEBHOOK_URL to auto-analyze on import.",
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret ? { "x-monoid-signature": webhookSecret } : {}),
      },
      body: JSON.stringify({
        event: "repo.imported",
        repo,
        user_id: userId,
        requested_at: new Date().toISOString(),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = await response.text().catch(() => "");
      return {
        triggered: false,
        message: `Repository imported, but ingestion webhook failed (${response.status})${payload ? `: ${payload}` : "."}`,
      };
    }

    return {
      triggered: true,
      message: "Repository imported and ingestion was triggered automatically.",
    };
  } catch (error: any) {
    return {
      triggered: false,
      message: `Repository imported, but ingestion webhook failed: ${error?.message || "Unknown error."}`,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ImportRequestBody;
    const repo = body.repo;
    if (!repo?.name || !repo?.owner?.login || !repo?.owner?.id) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const ownerLogin = repo.owner.login;
    const ownerGitHubId = String(repo.owner.id);
    const repoName = repo.name;
    const defaultBranch = repo.default_branch || "main";

    let organization: any = null;

    const { data: byGitHubId } = await supabase
      .from("organizations")
      .select("*")
      .eq("github_id", ownerGitHubId)
      .maybeSingle();

    if (byGitHubId) {
      organization = byGitHubId;
    } else {
      const orgSlug = slugify(ownerLogin);
      const { data: bySlug } = await supabase
        .from("organizations")
        .select("*")
        .eq("slug", orgSlug)
        .maybeSingle();

      if (bySlug) {
        organization = bySlug;
      } else {
        const { data: createdOrg, error: createOrgError } = await supabase
          .from("organizations")
          .insert({
            name: ownerLogin,
            slug: orgSlug,
            avatar_url: repo.owner.avatar_url || null,
            github_id: ownerGitHubId,
            created_by: user.id,
          })
          .select("*")
          .single();

        if (createOrgError) {
          return NextResponse.json(
            { error: `Failed to create organization: ${createOrgError.message}` },
            { status: 400 }
          );
        }
        organization = createdOrg;
      }
    }

    const { data: existingOrgMember } = await supabase
      .from("org_members")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingOrgMember) {
      await supabase.from("org_members").insert({
        organization_id: organization.id,
        user_id: user.id,
        role: "owner",
      });
    }

    const { data: existingRepo } = await supabase
      .from("repos")
      .select("*")
      .eq("owner", ownerLogin)
      .eq("name", repoName)
      .maybeSingle();

    if (existingRepo) {
      if (!(existingRepo as any).organization_id) {
        await supabase
          .from("repos")
          .update({ organization_id: organization.id })
          .eq("id", existingRepo.id);
      }

      const analysis = await triggerIngestionWebhook(
        {
          id: existingRepo.id,
          owner: existingRepo.owner,
          name: existingRepo.name,
          default_branch: existingRepo.default_branch || null,
          organization_id: organization.id,
          workspace_id: existingRepo.workspace_id,
        },
        user.id
      );

      return NextResponse.json({
        created: false,
        repo: existingRepo,
        analysis,
      });
    }

    const workspaceName = `${ownerLogin}/${repoName}`;
    const baseWorkspaceSlug = slugify(`${ownerLogin}-${repoName}`);

    let workspace: any = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidateSlug = appendSlugSuffix(baseWorkspaceSlug, attempt);
      const { data: createdWorkspace, error: workspaceError } = await supabase
        .from("workspaces")
        .insert({
          name: workspaceName,
          slug: candidateSlug,
          user_id: user.id,
        })
        .select("*")
        .single();

      if (!workspaceError && createdWorkspace) {
        workspace = createdWorkspace;
        break;
      }

      if (workspaceError && workspaceError.code !== "23505") {
        return NextResponse.json(
          { error: `Failed to create workspace: ${workspaceError.message}` },
          { status: 400 }
        );
      }
    }

    if (!workspace) {
      return NextResponse.json(
        { error: "Unable to allocate a unique workspace slug for this repository." },
        { status: 400 }
      );
    }

    const { data: existingWorkspaceMember } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingWorkspaceMember) {
      await supabase.from("workspace_members").insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: "owner",
      });
    }

    const { data: newRepo, error: createRepoError } = await supabase
      .from("repos")
      .insert({
        owner: ownerLogin,
        name: repoName,
        default_branch: defaultBranch,
        organization_id: organization.id,
        workspace_id: workspace.id,
      })
      .select("*")
      .single();

    if (createRepoError) {
      return NextResponse.json(
        { error: `Failed to create repo: ${createRepoError.message}` },
        { status: 400 }
      );
    }

    const analysis = await triggerIngestionWebhook(
      {
        id: newRepo.id,
        owner: newRepo.owner,
        name: newRepo.name,
        default_branch: newRepo.default_branch || null,
        organization_id: newRepo.organization_id || null,
        workspace_id: newRepo.workspace_id,
      },
      user.id
    );

    return NextResponse.json({
      created: true,
      repo: newRepo,
      analysis,
    });
  } catch (error: any) {
    console.error("[GitHub Import API] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to import repository." },
      { status: 500 }
    );
  }
}
