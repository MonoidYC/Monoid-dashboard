import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Lazily initialized Supabase client
let _supabase: SupabaseClient<Database> | null = null

// Check if we're in a VS Code webview
function isVSCodeWebview(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as any).__isVSCodeWebview === true || 
         window.self !== window.top ||
         window.location.protocol === 'vscode-webview:';
}

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

/**
 * Sign in with OAuth provider (GitHub, Google, etc.)
 * Handles VS Code webview context automatically by opening auth in external browser
 */
export async function signInWithOAuth(provider: 'github' | 'google' | 'gitlab' | 'bitbucket') {
  const supabase = getSupabase();
  
  if (typeof window !== 'undefined' && isVSCodeWebview()) {
    // In VS Code webview - get OAuth URL and open externally
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: true, // Don't auto-redirect
      }
    });
    
    if (error) {
      console.error('[Monoid Auth] OAuth error:', error);
      throw error;
    }
    
    if (data.url) {
      // Send message to parent webview to open in external browser
      window.parent.postMessage({ type: 'openAuthUrl', url: data.url }, '*');
      console.log('[Monoid Auth] Opening OAuth URL in external browser');
      
      // Return a message for the UI
      return { 
        data: { url: data.url, provider },
        error: null,
        message: 'Authentication opened in external browser. Please complete sign-in and then reload this page.'
      };
    }
    
    return { data, error };
  }
  
  // Normal browser - standard OAuth flow
  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window?.location?.origin,
    }
  });
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
