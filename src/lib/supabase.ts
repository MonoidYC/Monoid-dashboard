import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Lazily initialized Supabase client
let _supabase: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> {
  if (_supabase) return _supabase
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
    )
  }
  
  _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
  return _supabase
}

// Legacy export for backwards compatibility (will throw if env vars not set)
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop) {
    return (getSupabase() as any)[prop]
  }
})

// Type-safe helpers for common operations
export type CodeNode = Database['public']['Tables']['code_nodes']['Row']
export type CodeEdge = Database['public']['Tables']['code_edges']['Row']
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type Repo = Database['public']['Tables']['repos']['Row']
export type RepoVersion = Database['public']['Tables']['repo_versions']['Row']
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row']

export type NodeType = Database['public']['Enums']['node_type']
export type EdgeType = Database['public']['Enums']['edge_type']
