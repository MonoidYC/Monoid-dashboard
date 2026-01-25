import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Type-safe helpers for common operations
export type CodeNode = Database['public']['Tables']['code_nodes']['Row']
export type CodeEdge = Database['public']['Tables']['code_edges']['Row']
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type Repo = Database['public']['Tables']['repos']['Row']
export type RepoVersion = Database['public']['Tables']['repo_versions']['Row']
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row']

export type NodeType = Database['public']['Enums']['node_type']
export type EdgeType = Database['public']['Enums']['edge_type']
