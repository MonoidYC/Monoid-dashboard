"use client";

import { useState, useMemo, useCallback } from "react";
import type { GraphNode, GraphEdge, GraphFilters, NodeType, EdgeType, ClusterType } from "@/lib/graph/types";

const ALL_NODE_TYPES: NodeType[] = [
  "function", "class", "method", "endpoint", "handler",
  "middleware", "hook", "component", "module", "variable",
  "type", "interface", "constant", "test", "other"
];

const ALL_EDGE_TYPES: EdgeType[] = [
  "calls", "imports", "exports", "extends", "implements",
  "routes_to", "depends_on", "uses", "defines", "references", "other"
];

const ALL_CLUSTERS: ClusterType[] = ["frontend", "backend", "shared", "unknown"];

interface UseGraphFiltersResult {
  filters: GraphFilters;
  filteredNodes: GraphNode[];
  filteredEdges: GraphEdge[];
  setSearchQuery: (query: string) => void;
  toggleNodeType: (nodeType: NodeType) => void;
  toggleEdgeType: (edgeType: EdgeType) => void;
  toggleCluster: (cluster: ClusterType) => void;
  setFilePath: (path: string | null) => void;
  resetFilters: () => void;
  highlightedNodeIds: Set<string>;
}

export function useGraphFilters(
  nodes: GraphNode[],
  edges: GraphEdge[]
): UseGraphFiltersResult {
  const [filters, setFilters] = useState<GraphFilters>({
    nodeTypes: ALL_NODE_TYPES,
    edgeTypes: ALL_EDGE_TYPES,
    clusters: ALL_CLUSTERS,
    searchQuery: "",
    filePath: null,
  });

  // Filter nodes based on current filters
  const { filteredNodes, highlightedNodeIds } = useMemo(() => {
    const highlighted = new Set<string>();

    const filtered = nodes.filter((node) => {
      const data = node.data;

      // Filter by node type
      if (!filters.nodeTypes.includes(data.nodeType)) {
        return false;
      }

      // Filter by cluster
      if (!filters.clusters.includes(data.cluster)) {
        return false;
      }

      // Filter by file path
      if (filters.filePath && !data.filePath.includes(filters.filePath)) {
        return false;
      }

      return true;
    });

    // Highlight nodes matching search query
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      for (const node of filtered) {
        if (
          node.data.name.toLowerCase().includes(query) ||
          node.data.qualifiedName?.toLowerCase().includes(query) ||
          node.data.filePath.toLowerCase().includes(query)
        ) {
          highlighted.add(node.id);
        }
      }
    }

    return { filteredNodes: filtered, highlightedNodeIds: highlighted };
  }, [nodes, filters]);

  // Filter edges - only include edges between visible nodes
  const filteredEdges = useMemo(() => {
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));

    return edges.filter((edge) => {
      // Both source and target must be visible
      if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
        return false;
      }

      // Filter by edge type
      if (edge.data && !filters.edgeTypes.includes(edge.data.edgeType)) {
        return false;
      }

      return true;
    });
  }, [edges, filteredNodes, filters.edgeTypes]);

  // Update search query
  const setSearchQuery = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  // Toggle node type filter
  const toggleNodeType = useCallback((nodeType: NodeType) => {
    setFilters((prev) => {
      const types = prev.nodeTypes.includes(nodeType)
        ? prev.nodeTypes.filter((t) => t !== nodeType)
        : [...prev.nodeTypes, nodeType];
      return { ...prev, nodeTypes: types };
    });
  }, []);

  // Toggle edge type filter
  const toggleEdgeType = useCallback((edgeType: EdgeType) => {
    setFilters((prev) => {
      const types = prev.edgeTypes.includes(edgeType)
        ? prev.edgeTypes.filter((t) => t !== edgeType)
        : [...prev.edgeTypes, edgeType];
      return { ...prev, edgeTypes: types };
    });
  }, []);

  // Toggle cluster filter
  const toggleCluster = useCallback((cluster: ClusterType) => {
    setFilters((prev) => {
      const clusters = prev.clusters.includes(cluster)
        ? prev.clusters.filter((c) => c !== cluster)
        : [...prev.clusters, cluster];
      return { ...prev, clusters: clusters };
    });
  }, []);

  // Set file path filter
  const setFilePath = useCallback((path: string | null) => {
    setFilters((prev) => ({ ...prev, filePath: path }));
  }, []);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters({
      nodeTypes: ALL_NODE_TYPES,
      edgeTypes: ALL_EDGE_TYPES,
      clusters: ALL_CLUSTERS,
      searchQuery: "",
      filePath: null,
    });
  }, []);

  return {
    filters,
    filteredNodes,
    filteredEdges,
    setSearchQuery,
    toggleNodeType,
    toggleEdgeType,
    toggleCluster,
    setFilePath,
    resetFilters,
    highlightedNodeIds,
  };
}
