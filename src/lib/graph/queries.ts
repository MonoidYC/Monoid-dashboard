import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import type {
  CodeNodeRow,
  CodeEdgeRow,
  RepoVersionRow,
  RepoRow,
  GraphNode,
  GraphEdge,
  CodeNodeData,
  CodeEdgeData,
} from "./types";
import { detectCluster } from "./types";

// Create Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

// Fetch repo version with repo details
export async function getRepoVersion(versionId: string): Promise<{
  version: RepoVersionRow;
  repo: RepoRow;
} | null> {
  const supabase = getSupabaseClient();

  const { data: version, error: versionError } = await supabase
    .from("repo_versions")
    .select("*")
    .eq("id", versionId)
    .single();

  if (versionError || !version) {
    console.error("Error fetching version:", versionError);
    return null;
  }

  const { data: repo, error: repoError } = await supabase
    .from("repos")
    .select("*")
    .eq("id", version.repo_id)
    .single();

  if (repoError || !repo) {
    console.error("Error fetching repo:", repoError);
    return null;
  }

  return { version, repo };
}

// Fetch all code nodes for a version
export async function getCodeNodes(versionId: string): Promise<CodeNodeRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("code_nodes")
    .select("*")
    .eq("version_id", versionId)
    .order("file_path", { ascending: true });

  if (error) {
    console.error("Error fetching nodes:", error);
    return [];
  }

  return data || [];
}

// Fetch all code edges for a version
export async function getCodeEdges(versionId: string): Promise<CodeEdgeRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("code_edges")
    .select("*")
    .eq("version_id", versionId);

  if (error) {
    console.error("Error fetching edges:", error);
    return [];
  }

  return data || [];
}

// Transform database nodes to React Flow nodes
export function transformNodes(
  dbNodes: CodeNodeRow[],
  edges: CodeEdgeRow[]
): GraphNode[] {
  // Calculate connection counts
  const incomingCounts = new Map<string, number>();
  const outgoingCounts = new Map<string, number>();

  for (const edge of edges) {
    incomingCounts.set(
      edge.target_node_id,
      (incomingCounts.get(edge.target_node_id) || 0) + 1
    );
    outgoingCounts.set(
      edge.source_node_id,
      (outgoingCounts.get(edge.source_node_id) || 0) + 1
    );
  }

  return dbNodes.map((node, index) => {
    const incoming = incomingCounts.get(node.id) || 0;
    const outgoing = outgoingCounts.get(node.id) || 0;

    const data: CodeNodeData = {
      id: node.id,
      name: node.name,
      qualifiedName: node.qualified_name,
      nodeType: node.node_type,
      language: node.language,
      filePath: node.file_path,
      startLine: node.start_line,
      endLine: node.end_line,
      snippet: node.snippet,
      signature: node.signature,
      stableId: node.stable_id,
      metadata: (node.metadata as Record<string, unknown>) || {},
      summary: (node as any).summary || null, // Will be populated from Supabase later
      cluster: detectCluster(node.file_path),
      connectionCount: incoming + outgoing,
      incomingCount: incoming,
      outgoingCount: outgoing,
    };

    // Initial position - will be updated by force layout
    const angle = (index / dbNodes.length) * 2 * Math.PI;
    const radius = 300;

    return {
      id: node.id,
      type: "codeNode",
      position: {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      },
      data,
    };
  });
}

// Transform database edges to React Flow edges
export function transformEdges(dbEdges: CodeEdgeRow[]): GraphEdge[] {
  return dbEdges.map((edge) => {
    const data: CodeEdgeData = {
      edgeType: edge.edge_type,
      weight: edge.weight || 1,
      metadata: (edge.metadata as Record<string, unknown>) || {},
    };

    return {
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      type: "default",
      animated: edge.edge_type === "calls",
      data,
      style: {
        stroke: getEdgeColor(edge.edge_type),
        strokeWidth: Math.min(edge.weight || 1, 3),
      },
    };
  });
}

// Get edge color based on type
function getEdgeColor(edgeType: string): string {
  const colors: Record<string, string> = {
    calls: "#3b82f6", // blue
    imports: "#6b7280", // gray
    exports: "#8b5cf6", // purple
    extends: "#ec4899", // pink
    implements: "#ec4899", // pink
    routes_to: "#10b981", // green
    depends_on: "#f59e0b", // amber
    uses: "#64748b", // slate
    defines: "#06b6d4", // cyan
    references: "#9ca3af", // gray
    other: "#9ca3af", // gray
  };
  return colors[edgeType] || "#9ca3af";
}

// Fetch complete graph data for a version
export async function getGraphData(versionId: string): Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
  version: RepoVersionRow | null;
  repo: RepoRow | null;
}> {
  const [versionData, dbNodes, dbEdges] = await Promise.all([
    getRepoVersion(versionId),
    getCodeNodes(versionId),
    getCodeEdges(versionId),
  ]);

  const nodes = transformNodes(dbNodes, dbEdges);
  const edges = transformEdges(dbEdges);

  return {
    nodes,
    edges,
    version: versionData?.version || null,
    repo: versionData?.repo || null,
  };
}

// Generate GitHub permalink
export function generateGitHubPermalink(
  owner: string,
  name: string,
  commitSha: string,
  filePath: string,
  startLine: number,
  endLine?: number
): string {
  const baseUrl = `https://github.com/${owner}/${name}/blob/${commitSha}/${filePath}`;
  if (endLine && endLine !== startLine) {
    return `${baseUrl}#L${startLine}-L${endLine}`;
  }
  return `${baseUrl}#L${startLine}`;
}

// Demo summaries for each node
const DEMO_SUMMARIES: Record<string, string> = {
  "1": "Main application entry point that renders the page layout with header and sidebar",
  "2": "Navigation header with logo, search bar, and user menu",
  "3": "Collapsible sidebar with navigation links and user settings",
  "4": "Authentication hook that manages user session and login state",
  "5": "Reusable button component with variants and loading states",
  "6": "GET endpoint that returns paginated list of users with filtering",
  "7": "POST endpoint that creates a new user with validation",
  "8": "Middleware that verifies JWT tokens and attaches user to request",
  "9": "Service class handling all user-related business logic",
  "10": "Validates user data against schema before database operations",
  "11": "TypeScript interface defining the User object shape",
  "12": "Utility function to format dates in human-readable format",
  "13": "API base URL configuration constant",
};

// Generate demo data for testing
export function generateDemoData(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const demoNodes: (Partial<CodeNodeRow> & { summary?: string })[] = [
    // Frontend components
    { id: "1", name: "App", node_type: "component", file_path: "src/app/page.tsx", start_line: 1, end_line: 50, summary: DEMO_SUMMARIES["1"] },
    { id: "2", name: "Header", node_type: "component", file_path: "src/components/Header.tsx", start_line: 1, end_line: 30, summary: DEMO_SUMMARIES["2"] },
    { id: "3", name: "Sidebar", node_type: "component", file_path: "src/components/Sidebar.tsx", start_line: 1, end_line: 45, summary: DEMO_SUMMARIES["3"] },
    { id: "4", name: "useAuth", node_type: "hook", file_path: "src/hooks/useAuth.ts", start_line: 1, end_line: 25, summary: DEMO_SUMMARIES["4"] },
    { id: "5", name: "Button", node_type: "component", file_path: "src/ui/Button.tsx", start_line: 1, end_line: 20, summary: DEMO_SUMMARIES["5"] },
    
    // Backend API
    { id: "6", name: "getUsers", node_type: "endpoint", file_path: "src/api/users/route.ts", start_line: 10, end_line: 35, summary: DEMO_SUMMARIES["6"] },
    { id: "7", name: "createUser", node_type: "endpoint", file_path: "src/api/users/route.ts", start_line: 40, end_line: 70, summary: DEMO_SUMMARIES["7"] },
    { id: "8", name: "authMiddleware", node_type: "middleware", file_path: "src/api/middleware/auth.ts", start_line: 1, end_line: 30, summary: DEMO_SUMMARIES["8"] },
    { id: "9", name: "UserService", node_type: "class", file_path: "src/services/UserService.ts", start_line: 1, end_line: 100, summary: DEMO_SUMMARIES["9"] },
    { id: "10", name: "validateUser", node_type: "function", file_path: "src/services/UserService.ts", start_line: 50, end_line: 70, summary: DEMO_SUMMARIES["10"] },
    
    // Shared
    { id: "11", name: "User", node_type: "type", file_path: "src/types/user.ts", start_line: 1, end_line: 15, summary: DEMO_SUMMARIES["11"] },
    { id: "12", name: "formatDate", node_type: "function", file_path: "src/utils/date.ts", start_line: 1, end_line: 10, summary: DEMO_SUMMARIES["12"] },
    { id: "13", name: "API_URL", node_type: "constant", file_path: "src/constants/config.ts", start_line: 1, end_line: 5, summary: DEMO_SUMMARIES["13"] },
  ];

  const demoEdges: Partial<CodeEdgeRow>[] = [
    { id: "e1", source_node_id: "1", target_node_id: "2", edge_type: "imports" },
    { id: "e2", source_node_id: "1", target_node_id: "3", edge_type: "imports" },
    { id: "e3", source_node_id: "1", target_node_id: "4", edge_type: "uses" },
    { id: "e4", source_node_id: "2", target_node_id: "5", edge_type: "imports" },
    { id: "e5", source_node_id: "3", target_node_id: "5", edge_type: "imports" },
    { id: "e6", source_node_id: "4", target_node_id: "6", edge_type: "calls" },
    { id: "e7", source_node_id: "6", target_node_id: "8", edge_type: "depends_on" },
    { id: "e8", source_node_id: "7", target_node_id: "8", edge_type: "depends_on" },
    { id: "e9", source_node_id: "6", target_node_id: "9", edge_type: "calls" },
    { id: "e10", source_node_id: "7", target_node_id: "9", edge_type: "calls" },
    { id: "e11", source_node_id: "9", target_node_id: "10", edge_type: "calls" },
    { id: "e12", source_node_id: "9", target_node_id: "11", edge_type: "uses" },
    { id: "e13", source_node_id: "6", target_node_id: "11", edge_type: "uses" },
    { id: "e14", source_node_id: "7", target_node_id: "11", edge_type: "uses" },
    { id: "e15", source_node_id: "2", target_node_id: "12", edge_type: "imports" },
    { id: "e16", source_node_id: "4", target_node_id: "13", edge_type: "imports" },
  ];

  const fullNodes = demoNodes.map((n) => ({
    ...n,
    version_id: "demo",
    stable_id: `stable-${n.id}`,
    qualified_name: n.name,
    language: "typescript",
    start_column: 0,
    end_column: 0,
    snippet: `// ${n.name} code here...`,
    signature: `${n.node_type} ${n.name}`,
    metadata: {},
    created_at: new Date().toISOString(),
  })) as CodeNodeRow[];

  const fullEdges = demoEdges.map((e) => ({
    ...e,
    version_id: "demo",
    weight: 1,
    metadata: {},
    created_at: new Date().toISOString(),
  })) as CodeEdgeRow[];

  return {
    nodes: transformNodes(fullNodes, fullEdges),
    edges: transformEdges(fullEdges),
  };
}
