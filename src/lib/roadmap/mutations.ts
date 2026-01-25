import { getSupabase } from "../supabase";
import type { RoadmapRow, RoadmapInsert, RoadmapUpdate } from "./types";

const STORAGE_BUCKET = "roadmaps";

// Save roadmap content to Supabase Storage
async function saveToStorage(
  repoId: string,
  content: string
): Promise<{ path: string | null; error: Error | null }> {
  const supabase = getSupabase();
  
  // Create a path for the roadmap file: roadmaps/{repoId}/roadmap.md
  const filePath = `${repoId}/roadmap.md`;
  
  // Convert content to a Blob
  const blob = new Blob([content], { type: "text/markdown" });
  
  // Upload to storage (upsert - will overwrite if exists)
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, blob, {
      contentType: "text/markdown",
      upsert: true,
    });
  
  if (error) {
    console.error("Error uploading to storage:", error);
    return { path: null, error: new Error(error.message) };
  }
  
  return { path: filePath, error: null };
}

// Load roadmap content from Supabase Storage
export async function loadFromStorage(
  repoId: string
): Promise<{ content: string | null; error: Error | null }> {
  const supabase = getSupabase();
  
  const filePath = `${repoId}/roadmap.md`;
  
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(filePath);
  
  if (error) {
    // File might not exist yet, which is okay
    if (error.message.includes("not found") || error.message.includes("Object not found")) {
      return { content: null, error: null };
    }
    console.error("Error downloading from storage:", error);
    return { content: null, error: new Error(error.message) };
  }
  
  const content = await data.text();
  return { content, error: null };
}

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

// Upsert roadmap (create or update) - saves to both storage and database
export async function upsertRoadmap(
  repoId: string,
  title: string,
  content: string
): Promise<{ roadmap: RoadmapRow | null; error: Error | null }> {
  const supabase = getSupabase();
  
  // First, save content to storage bucket
  const { path: storagePath, error: storageError } = await saveToStorage(repoId, content);
  if (storageError) {
    console.error("Storage save failed:", storageError);
    // Continue anyway - we'll still save to database as fallback
  }
  
  // Check if roadmap exists for this repo
  const { data: existing } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("repo_id", repoId)
    .single();
  
  // Update the data to include storage path reference
  const updateData: RoadmapUpdate = { 
    title, 
    content,
    updated_at: new Date().toISOString(),
  };
  
  if (existing) {
    // Update existing
    return updateRoadmap(existing.id, updateData);
  } else {
    // Create new
    return createRoadmap({ 
      repo_id: repoId, 
      title, 
      content,
    });
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
