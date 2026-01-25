"use client";

import { useState, useEffect } from "react";
import type { GraphNode, GraphEdge, RepoVersionRow, RepoRow } from "@/lib/graph/types";
import { getGraphData, generateDemoData } from "@/lib/graph/queries";

interface UseGraphDataResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  version: RepoVersionRow | null;
  repo: RepoRow | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useGraphData(versionId: string): UseGraphDataResult {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [version, setVersion] = useState<RepoVersionRow | null>(null);
  const [repo, setRepo] = useState<RepoRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Special case for demo data
      if (versionId === "demo") {
        const demoData = generateDemoData();
        setNodes(demoData.nodes);
        setEdges(demoData.edges);
        setVersion(null);
        setRepo(null);
      } else {
        const data = await getGraphData(versionId);
        setNodes(data.nodes);
        setEdges(data.edges);
        setVersion(data.version);
        setRepo(data.repo);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch graph data"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [versionId]);

  return {
    nodes,
    edges,
    version,
    repo,
    isLoading,
    error,
    refetch: fetchData,
  };
}
