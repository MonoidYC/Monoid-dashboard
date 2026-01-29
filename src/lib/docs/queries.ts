// @ts-nocheck - Supabase types infer 'never' due to complex RLS policies
import { createClient } from "../supabase/client";
import type { OrgDocRow, OrganizationRow, RepoRow, OrgAutocompleteNode } from "./types";

// Fetch all docs for an organization
export async function getDocsByOrgId(orgId: string): Promise<OrgDocRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("org_docs")
    .select("*")
    .eq("organization_id", orgId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching docs:", error);
    return [];
  }

  return data || [];
}

// Fetch a single doc by org ID and slug
export async function getDocBySlug(
  orgId: string,
  slug: string
): Promise<OrgDocRow | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("org_docs")
    .select("*")
    .eq("organization_id", orgId)
    .eq("slug", slug)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    console.error("Error fetching doc:", error);
    return null;
  }

  return data;
}

// Fetch a single doc by ID
export async function getDocById(docId: string): Promise<OrgDocRow | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("org_docs")
    .select("*")
    .eq("id", docId)
    .single();

  if (error) {
    console.error("Error fetching doc:", error);
    return null;
  }

  return data;
}

// Fetch organization by ID
export async function getOrganizationById(
  orgId: string
): Promise<OrganizationRow | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (error) {
    console.error("Error fetching organization:", error);
    return null;
  }

  return data;
}

// Fetch all repos for an organization
export async function getReposByOrgId(orgId: string): Promise<RepoRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("repos")
    .select("*")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching repos:", error);
    return [];
  }

  return data || [];
}

// Fetch all nodes for an organization (aggregates from all repos)
export async function getAllNodesForOrg(
  orgId: string
): Promise<OrgAutocompleteNode[]> {
  const supabase = createClient();

  // First get all repos for the organization
  const { data: repos, error: repoError } = await supabase
    .from("repos")
    .select("id, name")
    .eq("organization_id", orgId);

  if (repoError || !repos || repos.length === 0) {
    return [];
  }

  const repoIds = repos.map((r) => r.id);
  const repoMap = new Map(repos.map((r) => [r.id, r.name]));

  // Get latest version for each repo
  const { data: versions, error: versionError } = await supabase
    .from("repo_versions")
    .select("id, repo_id")
    .in("repo_id", repoIds)
    .order("ingested_at", { ascending: false });

  if (versionError || !versions) {
    return [];
  }

  // Get only the latest version per repo
  const latestVersions = new Map<string, string>();
  for (const v of versions) {
    if (!latestVersions.has(v.repo_id)) {
      latestVersions.set(v.repo_id, v.id);
    }
  }

  const versionIds = Array.from(latestVersions.values());

  if (versionIds.length === 0) {
    return [];
  }

  // Fetch all nodes from latest versions
  const { data: nodes, error: nodesError } = await supabase
    .from("code_nodes")
    .select("id, name, node_type, file_path, version_id")
    .in("version_id", versionIds);

  if (nodesError || !nodes) {
    return [];
  }

  // Build version to repo mapping
  const versionToRepo = new Map<string, string>();
  latestVersions.forEach((versionId, repoId) => {
    versionToRepo.set(versionId, repoId);
  });

  // Map nodes to OrgAutocompleteNode format
  return nodes.map((node) => {
    const repoId = versionToRepo.get(node.version_id) || "";
    return {
      id: node.id,
      name: node.name,
      nodeType: node.node_type,
      filePath: node.file_path,
      repoId,
      repoName: repoMap.get(repoId) || "",
      matchScore: 0,
    };
  });
}

// Search nodes for autocomplete (org-wide)
export async function searchNodesForOrgAutocomplete(
  orgId: string,
  query: string,
  limit: number = 10
): Promise<OrgAutocompleteNode[]> {
  if (!query || query.length < 1) {
    return [];
  }

  const allNodes = await getAllNodesForOrg(orgId);

  // Filter and score nodes
  const queryLower = query.toLowerCase();
  const matched = allNodes
    .map((node) => {
      const nameLower = node.name.toLowerCase();
      let matchScore = 0;

      if (nameLower === queryLower) {
        matchScore = 100; // Exact match
      } else if (nameLower.startsWith(queryLower)) {
        matchScore = 80; // Starts with
      } else if (nameLower.includes(queryLower)) {
        matchScore = 60; // Contains
      } else {
        return null; // No match
      }

      return { ...node, matchScore };
    })
    .filter((node): node is OrgAutocompleteNode => node !== null)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

  return matched;
}

// Search nodes for a specific repo (for repo-specific docs)
export async function searchNodesForRepoAutocomplete(
  repoId: string,
  query: string,
  limit: number = 10
): Promise<OrgAutocompleteNode[]> {
  const supabase = createClient();

  // Get repo info
  const { data: repo, error: repoError } = await supabase
    .from("repos")
    .select("id, name")
    .eq("id", repoId)
    .single();

  if (repoError || !repo) {
    return [];
  }

  // Get latest version
  const { data: version, error: versionError } = await supabase
    .from("repo_versions")
    .select("id")
    .eq("repo_id", repoId)
    .order("ingested_at", { ascending: false })
    .limit(1)
    .single();

  if (versionError || !version) {
    return [];
  }

  // Search nodes
  const { data: nodes, error: nodesError } = await supabase
    .from("code_nodes")
    .select("id, name, node_type, file_path")
    .eq("version_id", version.id)
    .ilike("name", `%${query}%`)
    .limit(limit);

  if (nodesError || !nodes) {
    return [];
  }

  const queryLower = query.toLowerCase();
  return nodes
    .map((node) => {
      const nameLower = node.name.toLowerCase();
      let matchScore = 0;

      if (nameLower === queryLower) {
        matchScore = 100;
      } else if (nameLower.startsWith(queryLower)) {
        matchScore = 80;
      } else if (nameLower.includes(queryLower)) {
        matchScore = 60;
      } else {
        matchScore = 40;
      }

      return {
        id: node.id,
        name: node.name,
        nodeType: node.node_type,
        filePath: node.file_path,
        repoId: repo.id,
        repoName: repo.name,
        matchScore,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

// Check if slug is available for an organization
export async function isSlugAvailable(
  orgId: string,
  slug: string,
  excludeDocId?: string
): Promise<boolean> {
  const supabase = createClient();

  let query = supabase
    .from("org_docs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("slug", slug);

  if (excludeDocId) {
    query = query.neq("id", excludeDocId);
  }

  const { count, error } = await query;

  if (error) {
    console.error("Error checking slug:", error);
    return false;
  }

  return (count ?? 0) === 0;
}

// Get published docs for an organization (for MCP/public access)
export async function getPublishedDocsByOrgSlug(
  orgSlug: string
): Promise<{ docs: OrgDocRow[]; org: OrganizationRow } | null> {
  const supabase = createClient();

  // Get organization by slug
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", orgSlug)
    .single();

  if (orgError || !org) {
    return null;
  }

  // Get published docs
  const { data: docs, error: docsError } = await supabase
    .from("org_docs")
    .select("*")
    .eq("organization_id", org.id)
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  if (docsError) {
    console.error("Error fetching published docs:", docsError);
    return { docs: [], org };
  }

  return { docs: docs || [], org };
}

// Get a single published doc by org slug and doc slug
export async function getPublishedDocBySlug(
  orgSlug: string,
  docSlug: string
): Promise<{ doc: OrgDocRow; org: OrganizationRow } | null> {
  const supabase = createClient();

  // Get organization by slug
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", orgSlug)
    .single();

  if (orgError || !org) {
    return null;
  }

  // Get published doc
  const { data: doc, error: docError } = await supabase
    .from("org_docs")
    .select("*")
    .eq("organization_id", org.id)
    .eq("slug", docSlug)
    .eq("is_published", true)
    .single();

  if (docError || !doc) {
    return null;
  }

  return { doc, org };
}
