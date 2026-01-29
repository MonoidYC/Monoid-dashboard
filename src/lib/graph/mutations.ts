import { createClient } from "../supabase/client";
import type { EdgeType } from "./types";
import type { Database } from "../database.types";

type Json = Database["public"]["Tables"]["code_edges"]["Row"]["metadata"];

interface NewEdgeInput {
  source: string;
  target: string;
  edgeType: EdgeType;
  weight?: number;
  metadata?: Json;
}

/**
 * Persist a newly created edge into Supabase for a given version.
 * This is intentionally simple for the POC: it just inserts a new row.
 */
export async function addUserEdge(versionId: string, edge: NewEdgeInput): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("code_edges")
    .insert({
      version_id: versionId,
      source_node_id: edge.source,
      target_node_id: edge.target,
      edge_type: edge.edgeType,
      weight: edge.weight ?? 1,
      metadata: edge.metadata ?? {},
    } satisfies Database["public"]["Tables"]["code_edges"]["Insert"]);

  if (error) {
    // Log to console only; UI remains optimistic
    console.error("[Monoid] Failed to save edge to Supabase:", error);
  }
}

