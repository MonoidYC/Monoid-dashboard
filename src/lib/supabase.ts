import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { createClient as createBrowserClient } from "./supabase/client";

// Use the singleton browser client with proper cookie auth
export function getSupabase() {
  return createBrowserClient();
}

// Legacy export for backwards compatibility
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop) {
    return (getSupabase() as any)[prop];
  },
});

// Type-safe helpers for common operations
export type CodeNode = Database["public"]["Tables"]["code_nodes"]["Row"];
export type CodeEdge = Database["public"]["Tables"]["code_edges"]["Row"];
export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type Repo = Database["public"]["Tables"]["repos"]["Row"];
export type RepoVersion = Database["public"]["Tables"]["repo_versions"]["Row"];

export type NodeType = Database["public"]["Enums"]["node_type"];
export type EdgeType = Database["public"]["Enums"]["edge_type"];

