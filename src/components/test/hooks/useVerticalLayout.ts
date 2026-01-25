"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import dagre from "dagre";
import type { TestGraphNode, TestGraphEdge, TestType } from "@/lib/test/types";
import { TEST_TYPE_COLORS } from "@/lib/test/types";

interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  rankSep: number;
  nodeSep: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  nodeWidth: 320,
  nodeHeight: 140,
  rankSep: 100,
  nodeSep: 60,
};

// Apply hierarchical layout using dagre
function applyHierarchicalLayout(
  nodes: TestGraphNode[],
  edges: TestGraphEdge[],
  config: LayoutConfig
): TestGraphNode[] {
  if (nodes.length === 0) return [];

  // Create a new dagre graph
  const g = new dagre.graphlib.Graph();

  // Set graph properties for top-to-bottom layout
  g.setGraph({
    rankdir: "TB",
    ranksep: config.rankSep,
    nodesep: config.nodeSep,
    marginx: 50,
    marginy: 50,
  });

  // Default edge label
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to the graph
  nodes.forEach((node) => {
    g.setNode(node.id, { width: config.nodeWidth, height: config.nodeHeight });
  });

  // Add edges to the graph
  edges.forEach((edge) => {
    // Only add edge if both source and target exist in nodes
    if (nodes.some((n) => n.id === edge.source) && nodes.some((n) => n.id === edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  });

  // Run the layout algorithm
  dagre.layout(g);

  // Map the dagre positions back to our nodes
  return nodes.map((node) => {
    const dagreNode = g.node(node.id);
    if (!dagreNode) return node;
    
    return {
      ...node,
      position: {
        x: dagreNode.x - config.nodeWidth / 2,
        y: dagreNode.y - config.nodeHeight / 2,
      },
    };
  });
}

// Group nodes by test type for stats/legend
function groupNodesByType(nodes: TestGraphNode[]): Map<TestType, TestGraphNode[]> {
  const groups = new Map<TestType, TestGraphNode[]>();
  
  // Define the order of test types
  const typeOrder: TestType[] = [
    "smoke",
    "unit",
    "integration",
    "e2e",
    "contract",
    "security",
    "regression",
    "performance",
    "other",
  ];
  
  // Initialize groups in order
  typeOrder.forEach((type) => {
    groups.set(type, []);
  });
  
  // Distribute nodes to groups
  nodes.forEach((node) => {
    const type = node.data.testType;
    const group = groups.get(type) || [];
    group.push(node);
    groups.set(type, group);
  });
  
  // Remove empty groups
  typeOrder.forEach((type) => {
    if (groups.get(type)?.length === 0) {
      groups.delete(type);
    }
  });
  
  return groups;
}

interface UseVerticalLayoutOptions {
  enabled?: boolean;
  config?: Partial<LayoutConfig>;
}

interface UseVerticalLayoutResult {
  layoutNodes: TestGraphNode[];
  isLayouting: boolean;
  recalculateLayout: () => void;
  groups: Map<TestType, TestGraphNode[]>;
}

export function useVerticalLayout(
  nodes: TestGraphNode[],
  edges: TestGraphEdge[],
  options: UseVerticalLayoutOptions = {}
): UseVerticalLayoutResult {
  const { enabled = true, config: configOverrides } = options;
  
  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...configOverrides }),
    [configOverrides]
  );
  
  const [layoutNodes, setLayoutNodes] = useState<TestGraphNode[]>([]);
  const [isLayouting, setIsLayouting] = useState(false);
  
  const groups = useMemo(() => groupNodesByType(nodes), [nodes]);
  
  const recalculateLayout = useCallback(() => {
    if (!enabled || nodes.length === 0) {
      setLayoutNodes(nodes);
      return;
    }
    
    setIsLayouting(true);
    
    // Use dagre for hierarchical layout based on edges
    const positioned = applyHierarchicalLayout(nodes, edges, config);
    setLayoutNodes(positioned);
    setIsLayouting(false);
  }, [nodes, edges, config, enabled]);
  
  // Recalculate layout when nodes or edges change
  useEffect(() => {
    recalculateLayout();
  }, [recalculateLayout]);
  
  return {
    layoutNodes,
    isLayouting,
    recalculateLayout,
    groups,
  };
}

// Export group boundary calculations for visual grouping
export function getGroupBoundaries(
  nodes: TestGraphNode[],
  groups: Map<TestType, TestGraphNode[]>
): Array<{
  type: TestType;
  color: string;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}> {
  const boundaries: Array<{
    type: TestType;
    color: string;
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
  }> = [];
  
  groups.forEach((groupNodes, type) => {
    if (groupNodes.length === 0) return;
    
    const nodePositions = nodes.filter((n) => n.data.testType === type);
    if (nodePositions.length === 0) return;
    
    const xs = nodePositions.map((n) => n.position.x);
    const ys = nodePositions.map((n) => n.position.y);
    
    boundaries.push({
      type,
      color: TEST_TYPE_COLORS[type],
      bounds: {
        minX: Math.min(...xs) - 20,
        maxX: Math.max(...xs) + 340,
        minY: Math.min(...ys) - 20,
        maxY: Math.max(...ys) + 160,
      },
    });
  });
  
  return boundaries;
}
