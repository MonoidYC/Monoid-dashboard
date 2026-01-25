import { getSupabase } from "../supabase";
import type { RoadmapRow, RoadmapInsert, RoadmapUpdate } from "./types";

// Create a new roadmap
export async function createRoadmap(
  data: RoadmapInsert
): Promise<{ roadmap: RoadmapRow | null; error: Error | null }> {
  const supabase = getSupabase();
  
  const { data: roadmap, error } = await supabase
    .from("roadmaps")
    .insert(data)
    .select()
    .single();
  
  if (error) {
    console.error("Error creating roadmap:", error);
    return { roadmap: null, error: new Error(error.message) };
  }
  
  return { roadmap, error: null };
}

// Update an existing roadmap
export async function updateRoadmap(
  roadmapId: string,
  data: RoadmapUpdate
): Promise<{ roadmap: RoadmapRow | null; error: Error | null }> {
  const supabase = getSupabase();
  
  const { data: roadmap, error } = await supabase
    .from("roadmaps")
    .update(data)
    .eq("id", roadmapId)
    .select()
    .single();
  
  if (error) {
    console.error("Error updating roadmap:", error);
    return { roadmap: null, error: new Error(error.message) };
  }
  
  return { roadmap, error: null };
}

// Upsert roadmap (create or update)
export async function upsertRoadmap(
  repoId: string,
  title: string,
  content: string
): Promise<{ roadmap: RoadmapRow | null; error: Error | null }> {
  const supabase = getSupabase();
  
  // Check if roadmap exists for this repo
  const { data: existing } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("repo_id", repoId)
    .single();
  
  if (existing) {
    // Update existing
    return updateRoadmap(existing.id, { title, content });
  } else {
    // Create new
    return createRoadmap({ repo_id: repoId, title, content });
  }
}

// Delete a roadmap
export async function deleteRoadmap(
  roadmapId: string
): Promise<{ success: boolean; error: Error | null }> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from("roadmaps")
    .delete()
    .eq("id", roadmapId);
  
  if (error) {
    console.error("Error deleting roadmap:", error);
    return { success: false, error: new Error(error.message) };
  }
  
  return { success: true, error: null };
}

// Update roadmap content only (for autosave)
export async function updateRoadmapContent(
  roadmapId: string,
  content: string
): Promise<{ success: boolean; error: Error | null }> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from("roadmaps")
    .update({ content })
    .eq("id", roadmapId);
  
  if (error) {
    console.error("Error updating roadmap content:", error);
    return { success: false, error: new Error(error.message) };
  }
  
  return { success: true, error: null };
}

// Update GitHub sync status
export async function updateRoadmapSyncStatus(
  roadmapId: string,
  githubPath: string
): Promise<{ success: boolean; error: Error | null }> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from("roadmaps")
    .update({
      github_path: githubPath,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", roadmapId);
  
  if (error) {
    console.error("Error updating sync status:", error);
    return { success: false, error: new Error(error.message) };
  }
  
  return { success: true, error: null };
}
