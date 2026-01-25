import { getSupabase } from "../supabase";
import type { RoadmapRow, OrganizationRow, AutocompleteNode } from "./types";

// Fetch roadmap for a repository
export async function getRoadmapByRepoId(repoId: string): Promise<RoadmapRow | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("repo_id", repoId)
    .single();
  
  if (error) {
    if (error.code === "PGRST116") {
      // No rows found
      return null;
    }
    console.error("Error fetching roadmap:", error);
    return null;
  }
  
  return data;
}

// Fetch roadmap by ID
export async function getRoadmapById(roadmapId: string): Promise<RoadmapRow | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("id", roadmapId)
    .single();
  
  if (error) {
    console.error("Error fetching roadmap:", error);
    return null;
  }
  
  return data;
}

// Check if a roadmap exists for a repo
export async function hasRoadmap(repoId: string): Promise<boolean> {
  const supabase = getSupabase();
  
  const { count, error } = await supabase
    .from("roadmaps")
    .select("id", { count: "exact", head: true })
    .eq("repo_id", repoId);
  
  if (error) {
    console.error("Error checking roadmap:", error);
    return false;
  }
  
  return (count ?? 0) > 0;
}

// Fetch organization by ID
export async function getOrganizationById(orgId: string): Promise<OrganizationRow | null> {
  const supabase = getSupabase();
  
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

// Fetch repo with its organization
export async function getRepoWithOrganization(repoId: string): Promise<{
  repo: {
    id: string;
    name: string;
    owner: string;
    organization_id: string | null;
    workspace_id: string;
  };
  organization: OrganizationRow | null;
} | null> {
  const supabase = getSupabase();
  
  const { data: repo, error: repoError } = await supabase
    .from("repos")
    .select("id, name, owner, organization_id, workspace_id")
    .eq("id", repoId)
    .single();
  
  if (repoError || !repo) {
    console.error("Error fetching repo:", repoError);
    return null;
  }
  
  let organization: OrganizationRow | null = null;
  
  if (repo.organization_id) {
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", repo.organization_id)
      .single();
    
    if (!orgError && org) {
      organization = org;
    }
  }
  
  return { repo, organization };
}

// Search code nodes for autocomplete
export async function searchNodesForAutocomplete(
  repoId: string,
  query: string,
  limit: number = 10
): Promise<AutocompleteNode[]> {
  const supabase = getSupabase();
  
  // First get the latest version for this repo
  const { data: version, error: versionError } = await supabase
    .from("repo_versions")
    .select("id")
    .eq("repo_id", repoId)
    .order("ingested_at", { ascending: false })
    .limit(1)
    .single();
  
  if (versionError || !version) {
    console.error("Error fetching version:", versionError);
    return [];
  }
  
  // Search nodes by name (case-insensitive)
  const { data: nodes, error: nodesError } = await supabase
    .from("code_nodes")
    .select("id, name, node_type, file_path")
    .eq("version_id", version.id)
    .ilike("name", `%${query}%`)
    .limit(limit);
  
  if (nodesError) {
    console.error("Error searching nodes:", nodesError);
    return [];
  }
  
  // Calculate match score based on how well the query matches
  return (nodes || []).map((node) => {
    const name = node.name.toLowerCase();
    const q = query.toLowerCase();
    let matchScore = 0;
    
    if (name === q) {
      matchScore = 100; // Exact match
    } else if (name.startsWith(q)) {
      matchScore = 80; // Starts with
    } else if (name.includes(q)) {
      matchScore = 60; // Contains
    } else {
      matchScore = 40; // Partial
    }
    
    return {
      id: node.id,
      name: node.name,
      nodeType: node.node_type,
      filePath: node.file_path,
      matchScore,
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}

// Get node by name for a repo (used when clicking node links)
export async function getNodeByName(
  repoId: string,
  nodeName: string
): Promise<{ nodeId: string; versionId: string } | null> {
  const supabase = getSupabase();
  
  // Get the latest version for this repo
  const { data: version, error: versionError } = await supabase
    .from("repo_versions")
    .select("id")
    .eq("repo_id", repoId)
    .order("ingested_at", { ascending: false })
    .limit(1)
    .single();
  
  if (versionError || !version) {
    console.error("Error fetching version:", versionError);
    return null;
  }
  
  // Find node by exact name match
  const { data: node, error: nodeError } = await supabase
    .from("code_nodes")
    .select("id")
    .eq("version_id", version.id)
    .eq("name", nodeName)
    .limit(1)
    .single();
  
  if (nodeError || !node) {
    // Try case-insensitive match
    const { data: nodeCI, error: nodeCIError } = await supabase
      .from("code_nodes")
      .select("id")
      .eq("version_id", version.id)
      .ilike("name", nodeName)
      .limit(1)
      .single();
    
    if (nodeCIError || !nodeCI) {
      return null;
    }
    
    return { nodeId: nodeCI.id, versionId: version.id };
  }
  
  return { nodeId: node.id, versionId: version.id };
}

// Get all nodes for a repo (for LLM context)
export async function getAllNodesForRepo(
  repoId: string
): Promise<{ id: string; name: string; nodeType: string; filePath: string }[]> {
  const supabase = getSupabase();
  
  // Get the latest version for this repo
  const { data: version, error: versionError } = await supabase
    .from("repo_versions")
    .select("id")
    .eq("repo_id", repoId)
    .order("ingested_at", { ascending: false })
    .limit(1)
    .single();
  
  if (versionError || !version) {
    console.error("Error fetching version:", versionError);
    return [];
  }
  
  // Get all nodes
  const { data: nodes, error: nodesError } = await supabase
    .from("code_nodes")
    .select("id, name, node_type, file_path")
    .eq("version_id", version.id);
  
  if (nodesError) {
    console.error("Error fetching nodes:", nodesError);
    return [];
  }
  
  return (nodes || []).map((node) => ({
    id: node.id,
    name: node.name,
    nodeType: node.node_type,
    filePath: node.file_path,
  }));
}

// Get latest version ID for a repo
export async function getLatestVersionId(repoId: string): Promise<string | null> {
  const supabase = getSupabase();
  
  const { data: version, error } = await supabase
    .from("repo_versions")
    .select("id")
    .eq("repo_id", repoId)
    .order("ingested_at", { ascending: false })
    .limit(1)
    .single();
  
  if (error || !version) {
    return null;
  }
  
  return version.id;
}
