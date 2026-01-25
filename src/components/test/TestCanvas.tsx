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

import { TestNode } from "./nodes/TestNode";
import { TestDetailPanel } from "./panels/TestDetailPanel";
import { TestControlsPanel } from "./panels/TestControlsPanel";
import { useVerticalLayout } from "./hooks/useVerticalLayout";
import type {
  TestGraphNode,
  TestGraphEdge,
  TestNodeData,
  RepoRow,
  RepoVersionRow,
  TestType,
  TestStatus,
} from "@/lib/test/types";
import { TEST_TYPE_COLORS } from "@/lib/test/types";

// Custom node types
const nodeTypes = {
  testNode: TestNode,
} as any;

interface TestCanvasProps {
  initialNodes: TestGraphNode[];
  initialEdges: TestGraphEdge[];
  repo?: RepoRow | null;
  version?: RepoVersionRow | null;
}

export function TestCanvas({
  initialNodes,
  initialEdges,
  repo,
  version,
}: TestCanvasProps) {
  // Selected node for detail panel
  const [selectedNode, setSelectedNode] = useState<TestGraphNode | null>(null);
  
  // Filter by test type
  const [activeTypeFilter, setActiveTypeFilter] = useState<TestType | null>(null);
  
  // Filter by status
  const [activeStatusFilter, setActiveStatusFilter] = useState<TestStatus | null>(null);

  // Apply filters to nodes
  const filteredNodes = useMemo(() => {
    return initialNodes.filter((node) => {
      if (activeTypeFilter && node.data.testType !== activeTypeFilter) {
        return false;
      }
      if (activeStatusFilter && node.data.lastStatus !== activeStatusFilter) {
        return false;
      }
      return true;
    });
  }, [initialNodes, activeTypeFilter, activeStatusFilter]);

  // Filter edges to only include those between visible nodes
  const filteredEdges = useMemo(() => {
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    return initialEdges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [initialEdges, filteredNodes]);

  // Layout
  const { layoutNodes } = useVerticalLayout(
    filteredNodes,
    filteredEdges,
    { enabled: true }
  );

  // Apply selection state to nodes
  const nodesWithState = useMemo(() => {
    return layoutNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isSelected: selectedNode?.id === node.id,
      },
    }));
  }, [layoutNodes, selectedNode]);

  // Apply arrow markers to edges
  const edgesWithArrows = useMemo(() => {
    return filteredEdges.map((edge) => {
      const isHighlighted = selectedNode?.id === edge.source || selectedNode?.id === edge.target;
      return {
        ...edge,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: isHighlighted
            ? "rgba(255, 255, 255, 0.9)"
            : "rgba(255, 255, 255, 0.4)",
        },
        style: {
          stroke: isHighlighted
            ? "rgba(255, 255, 255, 0.8)"
            : "rgba(255, 255, 255, 0.25)",
          strokeWidth: isHighlighted ? 2 : 1,
        },
      };
    });
  }, [filteredEdges, selectedNode]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithState);
  const [edges, setEdges, onEdgesChange] = useEdgesState(edgesWithArrows);

  // Sync nodes and edges when layout changes
  useMemo(() => {
    setNodes(nodesWithState);
    setEdges(edgesWithArrows);
  }, [nodesWithState, edgesWithArrows, setNodes, setEdges]);

  // Handle node click
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node as TestGraphNode);
    },
    []
  );

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Minimap node color
  const minimapNodeColor = useCallback((node: any) => {
    const data = node.data as TestNodeData;
    return TEST_TYPE_COLORS[data.testType] || "#6b7280";
  }, []);

  // Get unique test types for filter
  const availableTypes = useMemo(() => {
    const types = new Set<TestType>();
    initialNodes.forEach((n) => types.add(n.data.testType));
    return Array.from(types);
  }, [initialNodes]);

  // Get test statistics
  const stats = useMemo(() => {
    const total = initialNodes.length;
    const passed = initialNodes.filter((n) => n.data.lastStatus === "passed").length;
    const failed = initialNodes.filter((n) => n.data.lastStatus === "failed").length;
    const pending = initialNodes.filter(
      (n) => n.data.lastStatus === "pending" || n.data.lastStatus === null
    ).length;
    const skipped = initialNodes.filter((n) => n.data.lastStatus === "skipped").length;
    return { total, passed, failed, pending, skipped };
  }, [initialNodes]);

  return (
    <div className="relative w-full h-full bg-[#08080a]">
      {/* Controls Panel (left side) */}
      <TestControlsPanel
        stats={stats}
        availableTypes={availableTypes}
        activeTypeFilter={activeTypeFilter}
        activeStatusFilter={activeStatusFilter}
        onTypeFilterChange={setActiveTypeFilter}
        onStatusFilterChange={setActiveStatusFilter}
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
        defaultViewport={{ x: 250, y: 50, zoom: 0.85 }}
        minZoom={0.1}
        maxZoom={2}
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
          className="!flex-row"
        />
        <MiniMap
          position="bottom-right"
          nodeColor={minimapNodeColor}
          maskColor="rgba(0, 0, 0, 0.85)"
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Detail Panel (right side) */}
      <TestDetailPanel
        node={selectedNode}
        repo={repo}
        version={version}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
