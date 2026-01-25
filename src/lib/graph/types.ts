import type { Node, Edge } from "@xyflow/react";
import type { Database } from "../database.types";

// Database row types
export type CodeNodeRow = Database["public"]["Tables"]["code_nodes"]["Row"];
export type CodeEdgeRow = Database["public"]["Tables"]["code_edges"]["Row"];
export type RepoVersionRow = Database["public"]["Tables"]["repo_versions"]["Row"];
export type RepoRow = Database["public"]["Tables"]["repos"]["Row"];
export type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
export type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

// Organization type (until database types are regenerated)
export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  github_id: string | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Organization with its repos
export interface OrganizationWithRepos {
  organization: OrganizationRow;
  repos: RepoWithVersions[];
}

// Repo with its versions
export interface RepoWithVersions {
  repo: RepoRow;
  versions: RepoVersionRow[];
}

// Enum types
export type NodeType = Database["public"]["Enums"]["node_type"];
export type EdgeType = Database["public"]["Enums"]["edge_type"];

// Cluster types for frontend/backend grouping
export type ClusterType = "frontend" | "backend" | "shared" | "unknown";

// Extended node data for React Flow
export interface CodeNodeData extends Record<string, unknown> {
  // From database
  id: string;
  name: string;
  qualifiedName: string | null;
  nodeType: NodeType;
  language: string | null;
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string | null;
  signature: string | null;
  stableId: string;
  metadata: Record<string, unknown>;
  summary: string | null; // Natural language summary of what this node does
  githubLink: string | null; // Direct GitHub permalink to the code file/lines

  // Computed
  cluster: ClusterType;
  connectionCount: number;
  incomingCount: number;
  outgoingCount: number;

  // UI state
  isHighlighted?: boolean;
  isSelected?: boolean;
  isFaded?: boolean;
}

// React Flow node with our custom data
export type GraphNode = Node<CodeNodeData, "codeNode">;

// Extended edge data for React Flow
export interface CodeEdgeData extends Record<string, unknown> {
  edgeType: EdgeType;
  weight: number;
  metadata: Record<string, unknown>;
  isHighlighted?: boolean;
}

// React Flow edge with our custom data
export type GraphEdge = Edge<CodeEdgeData>;

// Graph filter state
export interface GraphFilters {
  nodeTypes: NodeType[];
  edgeTypes: EdgeType[];
  clusters: ClusterType[];
  searchQuery: string;
  filePath: string | null;
}

// Graph layout configuration
export interface LayoutConfig {
  clusterStrength: number;
  linkDistance: number;
  chargeStrength: number;
  centerStrength: number;
  collisionRadius: number;
}

// Default layout config - increased spacing for better clarity
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  clusterStrength: 0.4,
  linkDistance: 180,
  chargeStrength: -500,
  centerStrength: 0.08,
  collisionRadius: 80,
};

// Node type styling
export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  function: "#3b82f6", // blue
  method: "#3b82f6", // blue
  class: "#8b5cf6", // purple
  component: "#ec4899", // pink
  endpoint: "#10b981", // green
  handler: "#f59e0b", // amber
  middleware: "#f59e0b", // amber
  hook: "#06b6d4", // cyan
  module: "#6366f1", // indigo
  variable: "#64748b", // slate
  type: "#6b7280", // gray
  interface: "#6b7280", // gray
  constant: "#64748b", // slate
  test: "#84cc16", // lime
  other: "#9ca3af", // gray
};

// Cluster styling
export const CLUSTER_COLORS: Record<ClusterType, string> = {
  frontend: "#ec4899", // pink
  backend: "#10b981", // green
  shared: "#8b5cf6", // purple
  unknown: "#6b7280", // gray
};

// Cluster positions (for force layout targets)
export const CLUSTER_POSITIONS: Record<ClusterType, { x: number; y: number }> = {
  frontend: { x: -200, y: 0 },
  backend: { x: 200, y: 0 },
  shared: { x: 0, y: -150 },
  unknown: { x: 0, y: 150 },
};

// Detect cluster from file path
export function detectCluster(filePath: string): ClusterType {
  // Normalize path: lowercase and ensure it starts with / for consistent matching
  const path = "/" + filePath.toLowerCase().replace(/^\/+/, "");

  // Frontend patterns
  if (
    path.includes("/components/") ||
    path.includes("/pages/") ||
    path.includes("/hooks/") ||
    path.includes("/ui/") ||
    path.includes("/views/") ||
    path.endsWith(".tsx") ||
    path.endsWith(".jsx")
  ) {
    // But not if it's an API route
    if (path.includes("/api/")) {
      return "backend";
    }
    return "frontend";
  }

  // Check for /app/ paths - could be frontend pages or backend API routes
  if (path.includes("/app/")) {
    // API routes are backend
    if (path.includes("/api/")) {
      return "backend";
    }
    // Otherwise it's a frontend page/component
    return "frontend";
  }

  // Backend patterns
  if (
    path.includes("/api/") ||
    path.includes("/server/") ||
    path.includes("/services/") ||
    path.includes("/controllers/") ||
    path.includes("/routes/") ||
    path.includes("/middleware/") ||
    path.includes("/db/") ||
    path.includes("/database/")
  ) {
    return "backend";
  }

  // Shared patterns
  if (
    path.includes("/types/") ||
    path.includes("/schemas/") ||
    path.includes("/constants/") ||
    path.includes("/utils/") ||
    path.includes("/lib/") ||
    path.includes("/shared/") ||
    path.includes("/common/")
  ) {
    return "shared";
  }

  return "unknown";
}

// Node type icons (Lucide icon names)
export const NODE_TYPE_ICONS: Record<NodeType, string> = {
  function: "Function",
  method: "Workflow",
  class: "Box",
  component: "Component",
  endpoint: "Globe",
  handler: "Zap",
  middleware: "Layers",
  hook: "Anchor",
  module: "Package",
  variable: "Variable",
  type: "Type",
  interface: "FileType",
  constant: "Hash",
  test: "FlaskConical",
  other: "Code",
};
