import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import type { GraphNode, GraphEdge, NodeType, EdgeType } from "./types";
import { detectCluster } from "./types";

// Create Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

// Generate a stable ID from node properties
function generateStableId(filePath: string, name: string, startLine: number): string {
  return `${filePath}:${name}:${startLine}`;
}

// Create a new code node
export async function createCodeNode(
  versionId: string,
  nodeData: {
    name: string;
    nodeType: NodeType;
    filePath: string;
    startLine: number;
    endLine: number;
    signature?: string | null;
    snippet?: string | null;
    summary?: string | null;
    language?: string;
  }
): Promise<{ node: GraphNode | null; error: Error | null }> {
  try {
    const supabase = getSupabaseClient();
    const stableId = generateStableId(nodeData.filePath, nodeData.name, nodeData.startLine);

    const { data, error } = await supabase
      .from("code_nodes")
      .insert({
        version_id: versionId,
        name: nodeData.name,
        qualified_name: nodeData.name,
        node_type: nodeData.nodeType,
        file_path: nodeData.filePath,
        start_line: nodeData.startLine,
        end_line: nodeData.endLine,
        start_column: 0,
        end_column: 0,
        signature: nodeData.signature || null,
        snippet: nodeData.snippet || null,
        language: nodeData.language || "typescript",
        stable_id: stableId,
        metadata: nodeData.summary ? { summary: nodeData.summary } : {},
      })
      .select()
      .single();

    if (error) throw error;

    // Transform to GraphNode format
    const graphNode: GraphNode = {
      id: data.id,
      type: "codeNode",
      position: { x: 0, y: 0 },
      data: {
        id: data.id,
        name: data.name,
        qualifiedName: data.qualified_name,
        nodeType: data.node_type,
        language: data.language,
        filePath: data.file_path,
        startLine: data.start_line,
        endLine: data.end_line,
        snippet: data.snippet,
        signature: data.signature,
        stableId: data.stable_id,
        metadata: (data.metadata as Record<string, unknown>) || {},
        summary: (data.metadata as any)?.summary || nodeData.summary || null,
        cluster: detectCluster(data.file_path),
        connectionCount: 0,
        incomingCount: 0,
        outgoingCount: 0,
      },
    };

    return { node: graphNode, error: null };
  } catch (error) {
    console.error("Error creating node:", error);
    return { node: null, error: error as Error };
  }
}

// Create a new code edge
export async function createCodeEdge(
  versionId: string,
  sourceNodeId: string,
  targetNodeId: string,
  edgeType: EdgeType = "depends_on"
): Promise<{ edge: GraphEdge | null; error: Error | null }> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("code_edges")
      .insert({
        version_id: versionId,
        source_node_id: sourceNodeId,
        target_node_id: targetNodeId,
        edge_type: edgeType,
        weight: 1,
        metadata: {},
      })
      .select()
      .single();

    if (error) throw error;

    // Transform to GraphEdge format
    const graphEdge: GraphEdge = {
      id: data.id,
      source: data.source_node_id,
      target: data.target_node_id,
      type: "dependency",
      data: {
        edgeType: data.edge_type,
        weight: data.weight || 1,
        metadata: (data.metadata as Record<string, unknown>) || {},
      },
    };

    return { edge: graphEdge, error: null };
  } catch (error) {
    console.error("Error creating edge:", error);
    return { edge: null, error: error as Error };
  }
}

// Batch save multiple edges
export async function saveEdges(
  versionId: string,
  edges: Array<{ source: string; target: string; edgeType?: EdgeType }>
): Promise<{ savedCount: number; error: Error | null }> {
  try {
    const supabase = getSupabaseClient();

    const edgesToInsert = edges.map((edge) => ({
      version_id: versionId,
      source_node_id: edge.source,
      target_node_id: edge.target,
      edge_type: edge.edgeType || ("depends_on" as EdgeType),
      weight: 1,
      metadata: {},
    }));

    const { data, error } = await supabase
      .from("code_edges")
      .insert(edgesToInsert)
      .select();

    if (error) throw error;

    return { savedCount: data?.length || 0, error: null };
  } catch (error) {
    console.error("Error saving edges:", error);
    return { savedCount: 0, error: error as Error };
  }
}

// Batch save multiple nodes
export async function saveNodes(
  versionId: string,
  nodes: Array<{
    name: string;
    nodeType: NodeType;
    filePath: string;
    startLine: number;
    endLine: number;
    signature?: string | null;
    snippet?: string | null;
    summary?: string | null;
  }>
): Promise<{ savedNodes: GraphNode[]; error: Error | null }> {
  try {
    const supabase = getSupabaseClient();

    const nodesToInsert = nodes.map((node) => ({
      version_id: versionId,
      name: node.name,
      qualified_name: node.name,
      node_type: node.nodeType,
      file_path: node.filePath,
      start_line: node.startLine,
      end_line: node.endLine,
      start_column: 0,
      end_column: 0,
      signature: node.signature || null,
      snippet: node.snippet || null,
      language: "typescript",
      stable_id: generateStableId(node.filePath, node.name, node.startLine),
      metadata: node.summary ? { summary: node.summary } : {},
    }));

    const { data, error } = await supabase
      .from("code_nodes")
      .insert(nodesToInsert)
      .select();

    if (error) throw error;

    // Transform to GraphNode format
    const graphNodes: GraphNode[] = (data || []).map((dbNode) => ({
      id: dbNode.id,
      type: "codeNode" as const,
      position: { x: 0, y: 0 },
      data: {
        id: dbNode.id,
        name: dbNode.name,
        qualifiedName: dbNode.qualified_name,
        nodeType: dbNode.node_type,
        language: dbNode.language,
        filePath: dbNode.file_path,
        startLine: dbNode.start_line,
        endLine: dbNode.end_line,
        snippet: dbNode.snippet,
        signature: dbNode.signature,
        stableId: dbNode.stable_id,
        metadata: (dbNode.metadata as Record<string, unknown>) || {},
        summary: (dbNode.metadata as any)?.summary || null,
        cluster: detectCluster(dbNode.file_path),
        connectionCount: 0,
        incomingCount: 0,
        outgoingCount: 0,
      },
    }));

    return { savedNodes: graphNodes, error: null };
  } catch (error) {
    console.error("Error saving nodes:", error);
    return { savedNodes: [], error: error as Error };
  }
}
