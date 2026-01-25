"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { CodeNode } from "./nodes/CodeNode";
import { ClusterNode } from "./nodes/ClusterNode";
import { DependencyEdge } from "./edges/DependencyEdge";
import { ControlsPanel } from "./panels/ControlsPanel";
import { DetailPanel } from "./panels/DetailPanel";
import { useForceLayout } from "./hooks/useForceLayout";
import { useGraphFilters } from "./hooks/useGraphFilters";
import type { GraphNode, GraphEdge, CodeNodeData, RepoRow, RepoVersionRow } from "@/lib/graph/types";
import { NODE_TYPE_COLORS, CLUSTER_COLORS } from "@/lib/graph/types";

// Custom node types - cast to any to avoid React Flow strict typing issues
const nodeTypes = {
  codeNode: CodeNode,
  clusterNode: ClusterNode,
} as any;

// Custom edge types
const edgeTypes = {
  dependency: DependencyEdge,
} as any;

interface GraphCanvasProps {
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
  repo?: RepoRow | null;
  version?: RepoVersionRow | null;
}

export function GraphCanvas({
  initialNodes,
  initialEdges,
  repo,
  version,
}: GraphCanvasProps) {
  // Selected node for detail panel
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Filtering
  const {
    filters,
    filteredNodes,
    filteredEdges,
    setSearchQuery,
    toggleNodeType,
    toggleCluster,
    resetFilters,
    highlightedNodeIds,
  } = useGraphFilters(initialNodes, initialEdges);

  // Force layout
  const { layoutNodes, isSimulating, restartSimulation } = useForceLayout(
    filteredNodes,
    filteredEdges,
    { enabled: true, animateOnChange: false }
  );

  // Apply highlighting and selection state to nodes
  const nodesWithState = useMemo(() => {
    return layoutNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isHighlighted: highlightedNodeIds.has(node.id),
        isSelected: selectedNode?.id === node.id,
        isFaded: highlightedNodeIds.size > 0 && !highlightedNodeIds.has(node.id),
      },
    }));
  }, [layoutNodes, highlightedNodeIds, selectedNode]);

  // Apply highlighting to edges with arrow markers
  const edgesWithState = useMemo(() => {
    return filteredEdges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        isHighlighted:
          selectedNode?.id === edge.source || selectedNode?.id === edge.target,
      },
      // Add arrow marker to show direction
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: selectedNode?.id === edge.source || selectedNode?.id === edge.target
          ? "rgba(255, 255, 255, 0.9)"
          : "rgba(255, 255, 255, 0.4)",
      },
    }));
  }, [filteredEdges, selectedNode]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithState);
  const [edges, setEdges, onEdgesChange] = useEdgesState(edgesWithState);

  // Sync nodes and edges when layout changes
  useMemo(() => {
    setNodes(nodesWithState);
    setEdges(edgesWithState);
  }, [nodesWithState, edgesWithState, setNodes, setEdges]);

  // Handle node click
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node as GraphNode);
    },
    []
  );

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Minimap node color
  const minimapNodeColor = useCallback((node: any) => {
    const data = node.data as CodeNodeData;
    return NODE_TYPE_COLORS[data.nodeType] || "#6b7280";
  }, []);

  // Get connected nodes for selected node
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return { incoming: [], outgoing: [] };

    const incoming: GraphNode[] = [];
    const outgoing: GraphNode[] = [];

    for (const edge of initialEdges) {
      if (edge.target === selectedNode.id) {
        const sourceNode = initialNodes.find((n) => n.id === edge.source);
        if (sourceNode) incoming.push(sourceNode);
      }
      if (edge.source === selectedNode.id) {
        const targetNode = initialNodes.find((n) => n.id === edge.target);
        if (targetNode) outgoing.push(targetNode);
      }
    }

    return { incoming, outgoing };
  }, [selectedNode, initialNodes, initialEdges]);

  return (
    <div className="relative w-full h-full bg-[#08080a]">
      {/* Controls Panel */}
      <ControlsPanel
        filters={filters}
        onSearchChange={setSearchQuery}
        onToggleNodeType={toggleNodeType}
        onToggleCluster={toggleCluster}
        onReset={resetFilters}
        onRestartLayout={restartSimulation}
        isSimulating={isSimulating}
        nodeCount={filteredNodes.length}
        edgeCount={filteredEdges.length}
      />

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "dependency",
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={40}
          size={0}
          color="transparent"
        />
        <Controls
          position="bottom-left"
          showZoom
          showFitView
          showInteractive={false}
        />
        <MiniMap
          position="bottom-right"
          nodeColor={minimapNodeColor}
          maskColor="rgba(0, 0, 0, 0.85)"
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Detail Panel */}
      <DetailPanel
        node={selectedNode}
        repo={repo}
        version={version}
        connectedNodes={connectedNodes}
        onClose={() => setSelectedNode(null)}
        onNodeSelect={(node) => setSelectedNode(node)}
      />
    </div>
  );
}
