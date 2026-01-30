"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  addEdge,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { CodeNode } from "./nodes/CodeNode";
import { ClusterNode } from "./nodes/ClusterNode";
import { DependencyEdge } from "./edges/DependencyEdge";
import { ControlsPanel } from "./panels/ControlsPanel";
import { DetailPanel } from "./panels/DetailPanel";
import { useForceLayout } from "./hooks/useForceLayout";
import { useGraphFilters } from "./hooks/useGraphFilters";
import type { GraphNode, GraphEdge, RepoRow, RepoVersionRow } from "@/lib/graph/types";
import type { ClusterType } from "@/lib/graph/types";
import { addUserEdge } from "@/lib/graph/mutations";

const nodeTypes = { codeNode: CodeNode, clusterNode: ClusterNode } as any;
const edgeTypes = { dependency: DependencyEdge } as any;

interface GraphCanvasProps {
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
  repo?: RepoRow | null;
  version?: RepoVersionRow | null;
  highlightNodeId?: string;
}

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function GraphCanvasInner({ initialNodes, initialEdges, repo, version, highlightNodeId }: GraphCanvasProps) {
  const { setCenter, getNodes } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hasZoomedToHighlight, setHasZoomedToHighlight] = useState(false);

  // Filters (search + type filters)
  const {
    filters,
    filteredNodes,
    filteredEdges,
    setSearchQuery,
    toggleNodeType,
    toggleCluster,
    resetFilters,
    highlightedNodeIds,
  } = useGraphFilters(nodes as any, edges as any);

  // Layout (hierarchical by default)
  const { layoutNodes, isSimulating, restartSimulation } = useForceLayout(filteredNodes as any, filteredEdges as any, {
    enabled: true,
    layoutType: "hierarchical",
  });

  // Decorate nodes with highlight/fade flags (used by node renderer)
  const displayNodes = useMemo(() => {
    const highlightSet = new Set<string>(highlightedNodeIds);
    if (highlightNodeId) highlightSet.add(highlightNodeId);

    const shouldFade = filters.searchQuery.trim().length > 0;

    return (layoutNodes as GraphNode[]).map((n) => {
      const isHighlighted = highlightSet.has(n.id);
      const isFaded = shouldFade && !isHighlighted;
      return {
        ...n,
        data: {
          ...n.data,
          isHighlighted,
          isFaded,
        },
      };
    });
  }, [layoutNodes, highlightedNodeIds, highlightNodeId, filters.searchQuery]);

  // Auto-select and zoom to highlighted node from URL param
  useEffect(() => {
    if (!highlightNodeId || hasZoomedToHighlight) return;
    if (initialNodes.length === 0) return;

    const nodeToHighlight = initialNodes.find((n) => n.id === highlightNodeId);
    if (!nodeToHighlight) return;

    setSelectedNode(nodeToHighlight);
    setHasZoomedToHighlight(true);

    setTimeout(() => {
      const current = getNodes().find((n) => n.id === highlightNodeId);
      if (current?.position) {
        setCenter(current.position.x + 75, current.position.y + 30, { zoom: 1.5, duration: 800 });
      }
    }, 300);
  }, [highlightNodeId, hasZoomedToHighlight, initialNodes, getNodes, setCenter]);

  // Keep internal node state in sync when props change (e.g. refresh)
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  const handleNodeClick = useCallback((_evt: any, node: any) => {
    setSelectedNode(node as GraphNode);
  }, []);

  const connectedNodes = useMemo(() => {
    if (!selectedNode) {
      return { incoming: [] as GraphNode[], outgoing: [] as GraphNode[] };
    }

    const nodeById = new Map((nodes as GraphNode[]).map((n) => [n.id, n]));
    const incomingIds = new Set<string>();
    const outgoingIds = new Set<string>();

    for (const e of edges as GraphEdge[]) {
      if (e.target === selectedNode.id) {
        incomingIds.add(e.source);
      }
      if (e.source === selectedNode.id) {
        outgoingIds.add(e.target);
      }
    }

    const incoming = Array.from(incomingIds)
      .map((id) => nodeById.get(id))
      .filter((n): n is GraphNode => !!n);

    const outgoing = Array.from(outgoingIds)
      .map((id) => nodeById.get(id))
      .filter((n): n is GraphNode => !!n);

    return { incoming, outgoing };
  }, [selectedNode, nodes, edges]);

  const handleNodeSelect = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node);
      setTimeout(() => {
        const current = getNodes().find((n) => n.id === node.id);
        if (current?.position) {
          setCenter(current.position.x + 75, current.position.y + 30, { zoom: 1.4, duration: 500 });
        }
      }, 0);
    },
    [getNodes, setCenter]
  );

  const handleClusterChange = useCallback(
    (nodeId: string, newCluster: ClusterType) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, cluster: newCluster } } : n
        )
      );
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) =>
          prev ? { ...prev, data: { ...prev.data, cluster: newCluster } } : null
        );
      }
    },
    [setNodes, selectedNode?.id]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;

      if (!source || !target) {
        return;
      }

      const edgePayload = {
        ...connection,
        type: "dependency",
        data: {
          edgeType: "depends_on" as const,
          weight: 1,
          metadata: {},
        },
      };

      // Optimistically update local state
      setEdges((eds) => addEdge(edgePayload as any, eds));

      // Persist to Supabase for this version (if present)
      if (version?.id) {
        void addUserEdge(version.id, {
          source,
          target,
          edgeType: "depends_on",
          weight: 1,
          metadata: {},
        });
      }
    },
    [setEdges, version?.id]
  );

  return (
    <div className="w-full h-full relative">
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

      <DetailPanel
        node={selectedNode}
        repo={repo}
        version={version}
        connectedNodes={connectedNodes}
        onNodeSelect={handleNodeSelect}
        onClose={() => setSelectedNode(null)}
        onClusterChange={handleClusterChange}
      />

      <ReactFlow
        nodes={displayNodes as any}
        edges={filteredEdges as any}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable
        elementsSelectable
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.06)" />
        <MiniMap
          pannable
          zoomable
          nodeStrokeWidth={2}
          className="!bg-[#0c0c0e] !border !border-white/5"
        />
      </ReactFlow>
    </div>
  );
}

