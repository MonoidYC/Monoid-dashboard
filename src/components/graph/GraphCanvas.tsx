"use client";

import { useCallback, useMemo, useState, useEffect, createContext, useContext } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
  MarkerType,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { CodeNode } from "./nodes/CodeNode";
import { ClusterNode } from "./nodes/ClusterNode";
import { DependencyEdge } from "./edges/DependencyEdge";
import { ControlsPanel } from "./panels/ControlsPanel";
import { DetailPanel } from "./panels/DetailPanel";
import { EditToolbar } from "./panels/EditToolbar";
import { NewNodeModal } from "./panels/NewNodeModal";
import { useForceLayout } from "./hooks/useForceLayout";
import { useGraphFilters } from "./hooks/useGraphFilters";
import type { GraphNode, GraphEdge, CodeNodeData, RepoRow, RepoVersionRow, NodeType } from "@/lib/graph/types";
import { NODE_TYPE_COLORS, detectCluster } from "@/lib/graph/types";
import { saveEdges, saveNodes } from "@/lib/graph/mutations";

// Context for connect mode - allows nodes to trigger connection
interface ConnectModeContextType {
  connectingFromNodeId: string | null;
  startConnecting: (nodeId: string) => void;
  cancelConnecting: () => void;
}

export const ConnectModeContext = createContext<ConnectModeContextType>({
  connectingFromNodeId: null,
  startConnecting: () => {},
  cancelConnecting: () => {},
});

export const useConnectMode = () => useContext(ConnectModeContext);

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
  highlightNodeId?: string;
}

// Wrapper component that provides ReactFlowProvider
export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function GraphCanvasInner({
  initialNodes,
  initialEdges,
  repo,
  version,
  highlightNodeId,
}: GraphCanvasProps) {
  const { setCenter, getNodes } = useReactFlow();
  
  // Selected node for detail panel
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hasZoomedToHighlight, setHasZoomedToHighlight] = useState(false);
  
  // Connect mode state - for click-to-connect functionality
  const [connectingFromNodeId, setConnectingFromNodeId] = useState<string | null>(null);
  
  // Start connecting from a node (triggered by connect button on node)
  const startConnecting = useCallback((nodeId: string) => {
    setConnectingFromNodeId(nodeId);
  }, []);
  
  // Cancel connecting mode
  const cancelConnecting = useCallback(() => {
    setConnectingFromNodeId(null);
  }, []);
  
  // Auto-select and zoom to highlighted node from URL param
  useEffect(() => {
    if (highlightNodeId && initialNodes.length > 0 && !hasZoomedToHighlight) {
      const nodeToHighlight = initialNodes.find((n) => n.id === highlightNodeId);
      if (nodeToHighlight) {
        setSelectedNode(nodeToHighlight);
        
        // Wait for layout to settle, then zoom to node
        setTimeout(() => {
          const nodes = getNodes();
          const targetNode = nodes.find((n) => n.id === highlightNodeId);
          if (targetNode && targetNode.position) {
            setCenter(
              targetNode.position.x + 75, // Center on node (assuming ~150px width)
              targetNode.position.y + 30, // Center on node (assuming ~60px height)
              { zoom: 1.5, duration: 800 }
            );
          }
          setHasZoomedToHighlight(true);
        }, 1000); // Wait for force layout to settle
      }
    }
  }, [highlightNodeId, initialNodes, hasZoomedToHighlight, setCenter, getNodes]);
  
  // Handle Escape key to cancel connecting mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && connectingFromNodeId) {
        cancelConnecting();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [connectingFromNodeId, cancelConnecting]);
  
  // Modal state
  const [isNewNodeModalOpen, setIsNewNodeModalOpen] = useState(false);
  
  // Unsaved changes tracking
  const [pendingEdges, setPendingEdges] = useState<Array<{ source: string; target: string }>>([]);
  const [pendingNodes, setPendingNodes] = useState<Array<{
    name: string;
    nodeType: NodeType;
    filePath: string;
    startLine: number;
    endLine: number;
    signature?: string | null;
    snippet?: string | null;
    summary?: string | null;
  }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // All nodes including pending ones
  const [localNodes, setLocalNodes] = useState<GraphNode[]>(initialNodes);

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
  } = useGraphFilters(localNodes, initialEdges);

  // Force layout
  const { layoutNodes, isSimulating, restartSimulation } = useForceLayout(
    filteredNodes,
    filteredEdges,
    { enabled: true, animateOnChange: false }
  );

  // Apply highlighting, selection, and connecting state to nodes
  const nodesWithState = useMemo(() => {
    return layoutNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isHighlighted: highlightedNodeIds.has(node.id),
        isSelected: selectedNode?.id === node.id,
        isFaded: highlightedNodeIds.size > 0 && !highlightedNodeIds.has(node.id),
        // Connect mode states
        isConnectingSource: connectingFromNodeId === node.id,
        isConnectTarget: connectingFromNodeId !== null && connectingFromNodeId !== node.id,
      },
    }));
  }, [layoutNodes, highlightedNodeIds, selectedNode, connectingFromNodeId]);

  // Combine initial edges with pending edges for display
  const allEdges = useMemo(() => {
    const pendingEdgeObjects: GraphEdge[] = pendingEdges.map((pe, idx) => ({
      id: `pending-${idx}`,
      source: pe.source,
      target: pe.target,
      type: "dependency",
      data: {
        edgeType: "depends_on" as const,
        weight: 1,
        metadata: {},
      },
      style: {
        strokeDasharray: "5,5", // Dashed line for pending edges
      },
    }));
    return [...filteredEdges, ...pendingEdgeObjects];
  }, [filteredEdges, pendingEdges]);

  // Apply highlighting to edges with arrow markers
  const edgesWithState = useMemo(() => {
    return allEdges.map((edge) => ({
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
  }, [allEdges, selectedNode]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithState);
  const [edges, setEdges, onEdgesChange] = useEdgesState(edgesWithState);

  // Sync nodes and edges when layout changes
  useMemo(() => {
    setNodes(nodesWithState);
    setEdges(edgesWithState);
  }, [nodesWithState, edgesWithState, setNodes, setEdges]);

  // Handle new connection (edge creation)
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target && connection.source !== connection.target) {
        // Check if edge already exists
        const exists = [...initialEdges, ...pendingEdges].some(
          (e) => 
            (e.source === connection.source && e.target === connection.target) ||
            ('source' in e && 'target' in e && e.source === connection.source && e.target === connection.target)
        );
        
        if (!exists) {
          setPendingEdges((prev) => [
            ...prev,
            { source: connection.source!, target: connection.target! },
          ]);
        }
      }
    },
    [initialEdges, pendingEdges]
  );

  // Handle node click - either create connection or select node
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // If in connecting mode, create the edge
      if (connectingFromNodeId && connectingFromNodeId !== node.id) {
        // Check if edge already exists
        const exists = [...initialEdges, ...pendingEdges].some(
          (e) => e.source === connectingFromNodeId && e.target === node.id
        );
        
        if (!exists) {
          setPendingEdges((prev) => [
            ...prev,
            { source: connectingFromNodeId, target: node.id },
          ]);
        }
        
        // Exit connecting mode
        cancelConnecting();
        return;
      }
      
      // Otherwise, just select the node
      setSelectedNode(node as GraphNode);
    },
    [connectingFromNodeId, initialEdges, pendingEdges, cancelConnecting]
  );

  // Handle pane click (deselect and cancel connecting mode)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    if (connectingFromNodeId) {
      cancelConnecting();
    }
  }, [connectingFromNodeId, cancelConnecting]);

  // Handle new node creation
  const handleCreateNode = useCallback((data: {
    name: string;
    nodeType: NodeType;
    signature: string | null;
    filePath: string;
    startLine: number;
    endLine: number;
    snippet: string;
    summary: string;
  }) => {
    // Add to pending nodes
    setPendingNodes((prev) => [...prev, data]);
    
    // Create a temporary local node for display
    const tempId = `temp-${Date.now()}`;
    const newNode: GraphNode = {
      id: tempId,
      type: "codeNode",
      position: { x: 0, y: 0 },
      data: {
        id: tempId,
        name: data.name,
        qualifiedName: data.name,
        nodeType: data.nodeType,
        language: "typescript",
        filePath: data.filePath,
        startLine: data.startLine,
        endLine: data.endLine,
        snippet: data.snippet,
        signature: data.signature,
        stableId: `${data.filePath}:${data.name}:${data.startLine}`,
        metadata: {},
        summary: data.summary,
        githubLink: null,
        cluster: detectCluster(data.filePath),
        connectionCount: 0,
        incomingCount: 0,
        outgoingCount: 0,
      },
    };
    
    setLocalNodes((prev) => [...prev, newNode]);
  }, []);

  // Save all pending changes
  const handleSave = useCallback(async () => {
    if (!version?.id) return;
    
    setIsSaving(true);
    
    try {
      // Save pending nodes first
      if (pendingNodes.length > 0) {
        const { savedNodes, error: nodesError } = await saveNodes(version.id, pendingNodes);
        if (nodesError) throw nodesError;
        
        // Update local nodes with real IDs
        // For simplicity, just clear pending and refresh would be needed
        setPendingNodes([]);
      }
      
      // Save pending edges
      if (pendingEdges.length > 0) {
        const { savedCount, error: edgesError } = await saveEdges(version.id, pendingEdges);
        if (edgesError) throw edgesError;
        
        setPendingEdges([]);
      }
      
      // Note: In a real app, you'd want to refresh the data from the server
      // or update the local state with the new IDs
    } catch (error) {
      console.error("Failed to save:", error);
      // You could add a toast notification here
    } finally {
      setIsSaving(false);
    }
  }, [version?.id, pendingNodes, pendingEdges]);

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
        const sourceNode = localNodes.find((n) => n.id === edge.source);
        if (sourceNode) incoming.push(sourceNode);
      }
      if (edge.source === selectedNode.id) {
        const targetNode = localNodes.find((n) => n.id === edge.target);
        if (targetNode) outgoing.push(targetNode);
      }
    }

    return { incoming, outgoing };
  }, [selectedNode, localNodes, initialEdges]);

  const hasUnsavedChanges = pendingEdges.length > 0 || pendingNodes.length > 0;

  // Context value for connect mode
  const connectModeContextValue = useMemo(() => ({
    connectingFromNodeId,
    startConnecting,
    cancelConnecting,
  }), [connectingFromNodeId, startConnecting, cancelConnecting]);

  return (
    <ConnectModeContext.Provider value={connectModeContextValue}>
      <div className="relative w-full h-full bg-[#08080a]">
        {/* Connect Mode Banner */}
        {connectingFromNodeId && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-blue-500/90 text-white rounded-lg shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-sm font-medium">
              Click on a target node to create connection
            </span>
            <button
              onClick={cancelConnecting}
              className="ml-2 px-2 py-0.5 text-xs bg-white/20 hover:bg-white/30 rounded transition-colors"
            >
              Cancel (Esc)
            </button>
          </div>
        )}
        
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

      {/* Edit Toolbar */}
      <EditToolbar
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        onSave={handleSave}
        onNewNode={() => setIsNewNodeModalOpen(true)}
        pendingEdgesCount={pendingEdges.length}
        pendingNodesCount={pendingNodes.length}
      />

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
        connectionLineStyle={{ stroke: "rgba(255, 255, 255, 0.3)", strokeWidth: 2 }}
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

      {/* Detail Panel */}
      <DetailPanel
        node={selectedNode}
        repo={repo}
        version={version}
        connectedNodes={connectedNodes}
        onClose={() => setSelectedNode(null)}
        onNodeSelect={(node) => setSelectedNode(node)}
      />

      {/* New Node Modal */}
      <NewNodeModal
        isOpen={isNewNodeModalOpen}
        onClose={() => setIsNewNodeModalOpen(false)}
        onCreateNode={handleCreateNode}
        versionId={version?.id || "demo"}
      />
      </div>
    </ConnectModeContext.Provider>
  );
}
