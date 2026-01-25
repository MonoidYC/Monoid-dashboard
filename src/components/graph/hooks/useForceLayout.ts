"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Simulation } from "d3-force";
import type { GraphNode, GraphEdge, LayoutConfig } from "@/lib/graph/types";
import { DEFAULT_LAYOUT_CONFIG } from "@/lib/graph/types";
import { applyForceLayout, applyHierarchicalLayout } from "@/lib/graph/layout";

interface UseForceLayoutOptions {
  enabled?: boolean;
  config?: LayoutConfig;
  animateOnChange?: boolean;
  layoutType?: "hierarchical" | "force";
}

interface UseForceLayoutResult {
  layoutNodes: GraphNode[];
  isSimulating: boolean;
  restartSimulation: () => void;
  stopSimulation: () => void;
  updateConfig: (config: Partial<LayoutConfig>) => void;
}

export function useForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: UseForceLayoutOptions = {}
): UseForceLayoutResult {
  const {
    enabled = true,
    config: initialConfig = DEFAULT_LAYOUT_CONFIG,
    animateOnChange = true,
    layoutType = "hierarchical", // Default to hierarchical for clear structure
  } = options;

  const [layoutNodes, setLayoutNodes] = useState<GraphNode[]>(nodes);
  const [isSimulating, setIsSimulating] = useState(false);
  const [config, setConfig] = useState<LayoutConfig>(initialConfig);

  const simulationRef = useRef<Simulation<any, any> | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  // Update refs when inputs change
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // Stop current simulation
  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }
    setIsSimulating(false);
  }, []);

  // Start or restart simulation
  const restartSimulation = useCallback(() => {
    stopSimulation();

    if (!enabled || nodesRef.current.length === 0) {
      return;
    }

    setIsSimulating(true);

    if (layoutType === "hierarchical") {
      // Use hierarchical layout (dagre) - parents above children
      const computedNodes = applyHierarchicalLayout(
        nodesRef.current,
        edgesRef.current,
        {
          direction: "TB",
          nodeWidth: 300,
          nodeHeight: 120,
          rankSep: 180,
          nodeSep: 100,
        }
      );
      setLayoutNodes(computedNodes);
      setIsSimulating(false);
    } else if (animateOnChange) {
      // Animated force simulation
      simulationRef.current = applyForceLayout(
        nodesRef.current,
        edgesRef.current,
        config,
        // onTick
        (updatedNodes) => {
          setLayoutNodes(updatedNodes);
        },
        // onEnd
        (updatedNodes) => {
          setLayoutNodes(updatedNodes);
          setIsSimulating(false);
        }
      );
    } else {
      // Compute force layout synchronously
      const computedNodes = applyHierarchicalLayout(
        nodesRef.current,
        edgesRef.current
      );
      setLayoutNodes(computedNodes);
      setIsSimulating(false);
    }
  }, [enabled, config, animateOnChange, layoutType, stopSimulation]);

  // Update config
  const updateConfig = useCallback((partialConfig: Partial<LayoutConfig>) => {
    setConfig((prev) => ({ ...prev, ...partialConfig }));
  }, []);

  // Initial layout and layout on data change
  useEffect(() => {
    if (nodes.length > 0 && enabled) {
      if (layoutType === "hierarchical") {
        // Use hierarchical layout for clear parent-child structure
        const computedNodes = applyHierarchicalLayout(nodes, edges, {
          direction: "TB",
          nodeWidth: 300,
          nodeHeight: 120,
          rankSep: 180,
          nodeSep: 100,
        });
        setLayoutNodes(computedNodes);
      } else {
        // Use hierarchical as fallback for initial render
        const computedNodes = applyHierarchicalLayout(nodes, edges);
      setLayoutNodes(computedNodes);
      }
    } else {
      setLayoutNodes(nodes);
    }
  }, [nodes, edges, enabled, layoutType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSimulation();
    };
  }, [stopSimulation]);

  return {
    layoutNodes,
    isSimulating,
    restartSimulation,
    stopSimulation,
    updateConfig,
  };
}
