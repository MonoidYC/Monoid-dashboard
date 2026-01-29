import { createClient } from "../supabase/client";
import type { OrgDocRow, CreateDocInput, UpdateDocInput } from "./types";

const STORAGE_BUCKET = "docs";

// Save doc content to Supabase Storage
async function saveToStorage(
  orgId: string,
  slug: string,
  content: string
): Promise<{ path: string | null; error: Error | null }> {
  const supabase = createClient();

  // Create a path for the doc file: docs/{orgId}/{slug}.md
  const filePath = `${orgId}/${slug}.md`;

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

// Load doc content from Supabase Storage
export async function loadFromStorage(
  orgId: string,
  slug: string
): Promise<{ content: string | null; error: Error | null }> {
  const supabase = createClient();

  const filePath = `${orgId}/${slug}.md`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(filePath);

  if (error) {
    // File might not exist yet, which is okay
    if (
      error.message.includes("not found") ||
      error.message.includes("Object not found")
    ) {
      return { content: null, error: null };
    }
    console.error("Error downloading from storage:", error);
    return { content: null, error: new Error(error.message) };
  }

  const content = await data.text();
  return { content, error: null };
}

// Delete doc content from storage
async function deleteFromStorage(
  orgId: string,
  slug: string
): Promise<{ error: Error | null }> {
  const supabase = createClient();

  const filePath = `${orgId}/${slug}.md`;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);

  if (error) {
    console.error("Error deleting from storage:", error);
    return { error: new Error(error.message) };
  }

  return { error: null };
}

// Create a new doc
export async function createDoc(
  input: CreateDocInput
): Promise<{ doc: OrgDocRow | null; error: Error | null }> {
  const supabase = createClient();

  // Save content to storage first if provided
  if (input.content) {
    const { error: storageError } = await saveToStorage(
      input.organizationId,
      input.slug,
      input.content
    );
    if (storageError) {
      console.error("Storage save failed:", storageError);
      // Continue anyway - we'll still save to database as fallback
    }
  }

  // Insert into database
  const { data, error } = await supabase
    .from("org_docs")
    .insert({
      organization_id: input.organizationId,
      title: input.title,
      slug: input.slug,
      content: input.content || "",
      description: input.description,
      repo_id: input.repoId,
      is_published: input.isPublished ?? false,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating doc:", error);
    return { doc: null, error: new Error(error.message) };
  }

  return { doc: data, error: null };
}

// Update an existing doc
export async function updateDoc(
  docId: string,
  orgId: string,
  currentSlug: string,
  input: UpdateDocInput
): Promise<{ doc: OrgDocRow | null; error: Error | null }> {
  const supabase = createClient();

  // If content changed, save to storage
  if (input.content !== undefined) {
    const slug = input.slug || currentSlug;
    const { error: storageError } = await saveToStorage(orgId, slug, input.content);
    if (storageError) {
      console.error("Storage save failed:", storageError);
    }

    // If slug changed, also delete old storage file
    if (input.slug && input.slug !== currentSlug) {
      await deleteFromStorage(orgId, currentSlug);
    }
  }

  // Build update object
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.slug !== undefined) updateData.slug = input.slug;
  if (input.content !== undefined) updateData.content = input.content;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.repoId !== undefined) updateData.repo_id = input.repoId;
  if (input.isPublished !== undefined) updateData.is_published = input.isPublished;
  if (input.orderIndex !== undefined) updateData.order_index = input.orderIndex;

  const { data, error } = await supabase
    .from("org_docs")
    .update(updateData)
    .eq("id", docId)
    .select()
    .single();

  if (error) {
    console.error("Error updating doc:", error);
    return { doc: null, error: new Error(error.message) };
  }

  return { doc: data, error: null };
}

// Delete a doc
export async function deleteDoc(
  docId: string,
  orgId: string,
  slug: string
): Promise<{ success: boolean; error: Error | null }> {
  const supabase = createClient();

  // Delete from storage first
  await deleteFromStorage(orgId, slug);

  // Delete from database
  const { error } = await supabase.from("org_docs").delete().eq("id", docId);

  if (error) {
    console.error("Error deleting doc:", error);
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, error: null };
}

// Upsert doc (create or update by org + slug)
export async function upsertDoc(
  orgId: string,
  slug: string,
  title: string,
  content: string,
  options?: {
    description?: string;
    repoId?: string | null;
    isPublished?: boolean;
  }
): Promise<{ doc: OrgDocRow | null; error: Error | null }> {
  const supabase = createClient();

  // Save to storage first
  const { error: storageError } = await saveToStorage(orgId, slug, content);
  if (storageError) {
    console.error("Storage save failed:", storageError);
  }

  // Check if doc exists
  const { data: existing } = await supabase
    .from("org_docs")
    .select("id")
    .eq("organization_id", orgId)
    .eq("slug", slug)
    .single();

  if (existing) {
    // Update existing
    return updateDoc(existing.id, orgId, slug, {
      title,
      content,
      description: options?.description,
      repoId: options?.repoId,
      isPublished: options?.isPublished,
    });
  } else {
    // Create new
    return createDoc({
      organizationId: orgId,
      title,
      slug,
      content,
      description: options?.description,
      repoId: options?.repoId,
      isPublished: options?.isPublished,
    });
  }
}

// Toggle publish status
export async function togglePublishStatus(
  docId: string
): Promise<{ doc: OrgDocRow | null; error: Error | null }> {
  const supabase = createClient();

  // Get current status
  const { data: existing, error: fetchError } = await supabase
    .from("org_docs")
    .select("is_published")
    .eq("id", docId)
    .single();

  if (fetchError || !existing) {
    return { doc: null, error: new Error("Doc not found") };
  }

  // Toggle
  const { data, error } = await supabase
    .from("org_docs")
    .update({
      is_published: !existing.is_published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", docId)
    .select()
    .single();

  if (error) {
    console.error("Error toggling publish status:", error);
    return { doc: null, error: new Error(error.message) };
  }

  return { doc: data, error: null };
}

// Reorder docs
export async function reorderDocs(
  orgId: string,
  docIds: string[]
): Promise<{ success: boolean; error: Error | null }> {
  const supabase = createClient();

  // Update order_index for each doc
  const updates = docIds.map((id, index) =>
    supabase
      .from("org_docs")
      .update({ order_index: index })
      .eq("id", id)
      .eq("organization_id", orgId)
  );

  try {
    await Promise.all(updates);
    return { success: true, error: null };
  } catch (error) {
    console.error("Error reordering docs:", error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error("Failed to reorder"),
    };
  }
}
