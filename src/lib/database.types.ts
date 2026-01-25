export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      code_edges: {
        Row: {
          created_at: string | null
          edge_type: Database["public"]["Enums"]["edge_type"]
          id: string
          metadata: Json | null
          source_node_id: string
          target_node_id: string
          version_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          edge_type: Database["public"]["Enums"]["edge_type"]
          id?: string
          metadata?: Json | null
          source_node_id: string
          target_node_id: string
          version_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          edge_type?: Database["public"]["Enums"]["edge_type"]
          id?: string
          metadata?: Json | null
          source_node_id?: string
          target_node_id?: string
          version_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "code_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "code_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "code_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_edges_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "repo_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      code_nodes: {
        Row: {
          created_at: string | null
          end_column: number | null
          end_line: number
          file_path: string
          github_link: string | null
          id: string
          language: string | null
          metadata: Json | null
          name: string
          node_type: Database["public"]["Enums"]["node_type"]
          qualified_name: string | null
          signature: string | null
          snippet: string | null
          stable_id: string
          start_column: number | null
          start_line: number
          version_id: string
        }
        Insert: {
          created_at?: string | null
          end_column?: number | null
          end_line: number
          file_path: string
          github_link?: string | null
          id?: string
          language?: string | null
          metadata?: Json | null
          name: string
          node_type: Database["public"]["Enums"]["node_type"]
          qualified_name?: string | null
          signature?: string | null
          snippet?: string | null
          stable_id: string
          start_column?: number | null
          start_line: number
          version_id: string
        }
        Update: {
          created_at?: string | null
          end_column?: number | null
          end_line?: number
          file_path?: string
          github_link?: string | null
          id?: string
          language?: string | null
          metadata?: Json | null
          name?: string
          node_type?: Database["public"]["Enums"]["node_type"]
          qualified_name?: string | null
          signature?: string | null
          snippet?: string | null
          stable_id?: string
          start_column?: number | null
          start_line?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_nodes_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "repo_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      repo_versions: {
        Row: {
          branch: string | null
          commit_sha: string
          committed_at: string | null
          edge_count: number | null
          id: string
          ingested_at: string | null
          node_count: number | null
          repo_id: string
        }
        Insert: {
          branch?: string | null
          commit_sha: string
          committed_at?: string | null
          edge_count?: number | null
          id?: string
          ingested_at?: string | null
          node_count?: number | null
          repo_id: string
        }
        Update: {
          branch?: string | null
          commit_sha?: string
          committed_at?: string | null
          edge_count?: number | null
          id?: string
          ingested_at?: string | null
          node_count?: number | null
          repo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repo_versions_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repos"
            referencedColumns: ["id"]
          },
        ]
      }
      repos: {
        Row: {
          created_at: string | null
          default_branch: string | null
          id: string
          name: string
          owner: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          default_branch?: string | null
          id?: string
          name: string
          owner: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          default_branch?: string | null
          id?: string
          name?: string
          owner?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      test_coverage_edges: {
        Row: {
          code_node_id: string
          coverage_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          test_node_id: string
          version_id: string
        }
        Insert: {
          code_node_id: string
          coverage_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          test_node_id: string
          version_id: string
        }
        Update: {
          code_node_id?: string
          coverage_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          test_node_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_coverage_edges_code_node_id_fkey"
            columns: ["code_node_id"]
            isOneToOne: false
            referencedRelation: "code_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_coverage_edges_test_node_id_fkey"
            columns: ["test_node_id"]
            isOneToOne: false
            referencedRelation: "test_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_coverage_edges_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "repo_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_nodes: {
        Row: {
          command: string | null
          created_at: string | null
          description: string | null
          end_line: number | null
          file_path: string | null
          github_link: string | null
          id: string
          last_duration_ms: number | null
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
          metadata: Json | null
          name: string
          runner: string | null
          source_type: string
          stable_id: string
          start_line: number | null
          test_type: Database["public"]["Enums"]["test_type"]
          version_id: string
        }
        Insert: {
          command?: string | null
          created_at?: string | null
          description?: string | null
          end_line?: number | null
          file_path?: string | null
          github_link?: string | null
          id?: string
          last_duration_ms?: number | null
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          metadata?: Json | null
          name: string
          runner?: string | null
          source_type: string
          stable_id: string
          start_line?: number | null
          test_type: Database["public"]["Enums"]["test_type"]
          version_id: string
        }
        Update: {
          command?: string | null
          created_at?: string | null
          description?: string | null
          end_line?: number | null
          file_path?: string | null
          github_link?: string | null
          id?: string
          last_duration_ms?: number | null
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          metadata?: Json | null
          name?: string
          runner?: string | null
          source_type?: string
          stable_id?: string
          start_line?: number | null
          test_type?: Database["public"]["Enums"]["test_type"]
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_nodes_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "repo_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_downstream_nodes: {
        Args: { p_max_depth?: number; p_node_id: string }
        Returns: {
          depth: number
          node_id: string
          path: string[]
        }[]
      }
      github_permalink: {
        Args: {
          p_commit_sha: string
          p_end_line?: number
          p_file_path: string
          p_name: string
          p_owner: string
          p_start_line: number
        }
        Returns: string
      }
      user_has_workspace_access: { Args: { ws_id: string }; Returns: boolean }
    }
    Enums: {
      edge_type:
        | "calls"
        | "imports"
        | "exports"
        | "extends"
        | "implements"
        | "routes_to"
        | "depends_on"
        | "uses"
        | "defines"
        | "references"
        | "other"
      node_type:
        | "function"
        | "class"
        | "method"
        | "endpoint"
        | "handler"
        | "middleware"
        | "hook"
        | "component"
        | "module"
        | "variable"
        | "type"
        | "interface"
        | "constant"
        | "test"
        | "other"
      test_type:
        | "e2e"
        | "unit"
        | "integration"
        | "security"
        | "contract"
        | "smoke"
        | "regression"
        | "performance"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      edge_type: [
        "calls",
        "imports",
        "exports",
        "extends",
        "implements",
        "routes_to",
        "depends_on",
        "uses",
        "defines",
        "references",
        "other",
      ],
      node_type: [
        "function",
        "class",
        "method",
        "endpoint",
        "handler",
        "middleware",
        "hook",
        "component",
        "module",
        "variable",
        "type",
        "interface",
        "constant",
        "test",
        "other",
      ],
      test_type: [
        "e2e",
        "unit",
        "integration",
        "security",
        "contract",
        "smoke",
        "regression",
        "performance",
        "other",
      ],
    },
  },
} as const
