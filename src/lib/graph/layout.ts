import dagre from "dagre";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import type { GraphNode, GraphEdge, ClusterType, LayoutConfig } from "./types";
import { CLUSTER_POSITIONS, DEFAULT_LAYOUT_CONFIG } from "./types";

// Simulation node with position
interface SimNode extends SimulationNodeDatum {
  id: string;
  cluster: ClusterType;
  x: number;
  y: number;
}

// Simulation link
interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
}

// Padding buffer to prevent edge-case overlaps
const NODE_PADDING = 30;

/**
 * Estimate node dimensions based on content.
 * Uses measured size if available, otherwise calculates from content.
 */
export function estimateNodeSize(node: GraphNode): { width: number; height: number } {
  // Use measured size if available (most accurate)
  if (node.data.measuredSize) {
    return {
      width: node.data.measuredSize.width + NODE_PADDING,
      height: node.data.measuredSize.height + NODE_PADDING,
    };
  }

  // Base dimensions matching CodeNode CSS: min-w-[200px] max-w-[280px]
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 280;
  
  // Base height: padding (py-2.5 = 10px * 2) + header row (~24px) + footer row (~18px)
  let height = 20 + 24 + 18;

  // Add height for summary if present
  if (node.data.summary) {
    // More accurate text wrapping calculation
    // At 12px font with ~280px max width, roughly 40 chars per line
    // Account for the px-3.5 padding (14px * 2 = 28px), leaving ~252px for text
    const charsPerLine = 38;
    const summaryLength = node.data.summary.length;
    const estimatedLines = Math.ceil(summaryLength / charsPerLine);
    // 16px line height + 2.5px margin bottom + divider (border + margin)
    height += estimatedLines * 16 + 12;
  }

  // Estimate width based on name and type badge
  // Header contains: icon (12px + padding) + name + type badge (varies)
  const nameLength = node.data.name.length;
  const typeBadgeLength = node.data.nodeType.length;
  
  // Approximate character width at 11px font is ~6px
  const nameWidth = nameLength * 6;
  const typeBadgeWidth = typeBadgeLength * 5 + 12; // 5px per char + padding
  const headerContentWidth = 24 + nameWidth + typeBadgeWidth + 16; // icon + gaps
  
  // Width is max of min-width and content width, capped at max-width
  let width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, headerContentWidth));
  
  // If summary exists and is long, content might push width
  if (node.data.summary && node.data.summary.length > 60) {
    width = MAX_WIDTH;
  }

  // Add padding buffer for layout safety
  return { 
    width: width + NODE_PADDING, 
    height: height + NODE_PADDING 
  };
}

/**
 * Apply hierarchical layout using dagre (top-down tree structure)
 * Parents appear above their children
 * Orphan nodes are placed in a compact grid
 */
export function applyHierarchicalLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: {
    direction?: "TB" | "BT" | "LR" | "RL";
    nodeWidth?: number;
    nodeHeight?: number;
    rankSep?: number;
    nodeSep?: number;
  } = {}
): GraphNode[] {
  const {
    direction = "TB", // Top to Bottom - parents above children
    rankSep = 120, // Vertical spacing between ranks/levels (increased for clarity)
    nodeSep = 60,  // Horizontal spacing between nodes (increased to prevent overlaps)
  } = options;

  // Separate connected nodes from orphan nodes
  const connectedNodeIds = new Set<string>();
  for (const edge of edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }

  const connectedNodes = nodes.filter((n) => connectedNodeIds.has(n.id));
  const orphanNodes = nodes.filter((n) => !connectedNodeIds.has(n.id));

  // Create a new dagre graph for connected nodes
  const g = new dagre.graphlib.Graph();

  // Set graph properties
  g.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
    marginx: 50,
    marginy: 50,
  });

  // Default edge label
  g.setDefaultEdgeLabel(() => ({}));

  // Add connected nodes with dynamic sizing
  const nodeSizes = new Map<string, { width: number; height: number }>();
  connectedNodes.forEach((node) => {
    const size = estimateNodeSize(node);
    nodeSizes.set(node.id, size);
    g.setNode(node.id, { width: size.width, height: size.height });
  });

  // Add edges to the graph
  edges.forEach((edge) => {
    // Only add edges where both nodes exist in connected nodes
    if (connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  });

  // Run the layout algorithm for connected nodes
  if (connectedNodes.length > 0) {
    dagre.layout(g);
  }

  // Map the dagre positions back to connected nodes
  const layoutedNodes: GraphNode[] = connectedNodes.map((node) => {
    const dagreNode = g.node(node.id);
    const size = nodeSizes.get(node.id) || { width: 200, height: 60 };
    return {
      ...node,
      position: {
        x: dagreNode.x - size.width / 2,
        y: dagreNode.y - size.height / 2,
      },
    };
  });

  // Calculate bounding box of connected graph
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  if (layoutedNodes.length > 0) {
    for (const node of layoutedNodes) {
      const size = nodeSizes.get(node.id) || { width: 200, height: 60 };
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x + size.width);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y + size.height);
    }
  } else {
    minX = 0;
    maxX = 0;
    minY = 0;
    maxY = 0;
  }

  // Place orphan nodes in clusters of 4 (2x2 grids) below the main graph
  if (orphanNodes.length > 0) {
    const clusterSize = 4; // 2x2 clusters
    const clusterCols = 2;
    const clusterRows = 2;
    
    const orphanNodeWidth = 280 + NODE_PADDING; // Max width + padding
    const orphanNodeHeight = 120 + NODE_PADDING; // Estimated average height + padding
    const nodeSpacingX = 40; // Spacing within cluster (increased)
    const nodeSpacingY = 35; // Spacing within cluster (increased)
    const clusterSpacingX = 100; // Spacing between clusters (increased)
    const clusterSpacingY = 80; // Spacing between cluster rows (increased)

    // Calculate cluster dimensions
    const clusterWidth = clusterCols * orphanNodeWidth + (clusterCols - 1) * nodeSpacingX;
    const clusterHeight = clusterRows * orphanNodeHeight + (clusterRows - 1) * nodeSpacingY;

    // How many clusters per row (aim for 3-4 clusters wide)
    const numClusters = Math.ceil(orphanNodes.length / clusterSize);
    const clustersPerRow = Math.min(4, numClusters);

    // Start orphans below the main graph with some padding
    const orphanStartY = layoutedNodes.length > 0 ? maxY + 100 : 0;
    const orphanStartX = minX;

    orphanNodes.forEach((node, index) => {
      const clusterIndex = Math.floor(index / clusterSize);
      const positionInCluster = index % clusterSize;
      
      // Position within cluster (2x2)
      const colInCluster = positionInCluster % clusterCols;
      const rowInCluster = Math.floor(positionInCluster / clusterCols);
      
      // Cluster position
      const clusterCol = clusterIndex % clustersPerRow;
      const clusterRow = Math.floor(clusterIndex / clustersPerRow);
      
      const x = orphanStartX + 
        clusterCol * (clusterWidth + clusterSpacingX) + 
        colInCluster * (orphanNodeWidth + nodeSpacingX);
      
      const y = orphanStartY + 
        clusterRow * (clusterHeight + clusterSpacingY) + 
        rowInCluster * (orphanNodeHeight + nodeSpacingY);
      
      layoutedNodes.push({
        ...node,
        position: { x, y },
      });
    });
  }

  return layoutedNodes;
}

/**
 * Apply force-directed layout to graph nodes
 */
export function applyForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
  onTick?: (nodes: GraphNode[]) => void,
  onEnd?: (nodes: GraphNode[]) => void
): Simulation<SimNode, SimLink> {
  // Create simulation nodes
  const simNodes: SimNode[] = nodes.map((node) => ({
    id: node.id,
    cluster: node.data.cluster,
    x: node.position.x,
    y: node.position.y,
  }));

  // Create simulation links
  const simLinks: SimLink[] = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));

  // Calculate collision radius based on node sizes
  const nodeSizes = new Map<string, { width: number; height: number }>();
  nodes.forEach((node) => {
    nodeSizes.set(node.id, estimateNodeSize(node));
  });

  // Create node lookup
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Create simulation
  const simulation = forceSimulation<SimNode>(simNodes)
    // Link force - pulls connected nodes together
    .force(
      "link",
      forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(config.linkDistance)
        .strength(0.5)
    )
    // Charge force - nodes repel each other
    .force("charge", forceManyBody().strength(config.chargeStrength))
    // Center force - keeps graph centered
    .force("center", forceCenter(0, 0).strength(config.centerStrength))
    // Collision force - prevents overlap with dynamic radius
    // Use diagonal of bounding box for accurate rectangular collision
    .force(
      "collide",
      forceCollide<SimNode>((d) => {
        const size = nodeSizes.get(d.id);
        if (size) {
          // Use half-diagonal for better rectangular collision detection
          // This ensures nodes don't overlap even at corners
          const diagonal = Math.sqrt(size.width * size.width + size.height * size.height);
          return diagonal / 2 + 10; // Extra buffer for visual breathing room
        }
        return config.collisionRadius;
      }).iterations(3) // More iterations for better collision resolution
    )
    // Cluster X force - pulls nodes toward cluster X position
    .force(
      "clusterX",
      forceX<SimNode>((d) => CLUSTER_POSITIONS[d.cluster].x).strength(
        config.clusterStrength
      )
    )
    // Cluster Y force - pulls nodes toward cluster Y position
    .force(
      "clusterY",
      forceY<SimNode>((d) => CLUSTER_POSITIONS[d.cluster].y).strength(
        config.clusterStrength
      )
    );

  // Handle tick updates
  if (onTick) {
    simulation.on("tick", () => {
      const updatedNodes = nodes.map((node) => {
        const simNode = simNodes.find((sn) => sn.id === node.id);
        if (simNode) {
          return {
            ...node,
            position: {
              x: simNode.x,
              y: simNode.y,
            },
          };
        }
        return node;
      });
      onTick(updatedNodes);
    });
  }

  // Handle simulation end
  if (onEnd) {
    simulation.on("end", () => {
      const updatedNodes = nodes.map((node) => {
        const simNode = simNodes.find((sn) => sn.id === node.id);
        if (simNode) {
          return {
            ...node,
            position: {
              x: simNode.x,
              y: simNode.y,
            },
          };
        }
        return node;
      });
      onEnd(updatedNodes);
    });
  }

  return simulation;
}

/**
 * Run simulation synchronously and return final positions
 */
export function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
  iterations: number = 300
): GraphNode[] {
  // Create simulation nodes
  const simNodes: SimNode[] = nodes.map((node) => ({
    id: node.id,
    cluster: node.data.cluster,
    x: node.position.x,
    y: node.position.y,
  }));

  // Create simulation links
  const simLinks: SimLink[] = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));

  // Calculate collision radius based on node sizes
  const nodeSizes = new Map<string, { width: number; height: number }>();
  nodes.forEach((node) => {
    nodeSizes.set(node.id, estimateNodeSize(node));
  });

  // Create simulation
  const simulation = forceSimulation<SimNode>(simNodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(config.linkDistance)
        .strength(0.5)
    )
    .force("charge", forceManyBody().strength(config.chargeStrength))
    .force("center", forceCenter(0, 0).strength(config.centerStrength))
    .force(
      "collide",
      forceCollide<SimNode>((d) => {
        const size = nodeSizes.get(d.id);
        if (size) {
          // Use half-diagonal for better rectangular collision detection
          const diagonal = Math.sqrt(size.width * size.width + size.height * size.height);
          return diagonal / 2 + 10;
        }
        return config.collisionRadius;
      }).iterations(3)
    )
    .force(
      "clusterX",
      forceX<SimNode>((d) => CLUSTER_POSITIONS[d.cluster].x).strength(
        config.clusterStrength
      )
    )
    .force(
      "clusterY",
      forceY<SimNode>((d) => CLUSTER_POSITIONS[d.cluster].y).strength(
        config.clusterStrength
      )
    )
    .stop();

  // Run simulation
  for (let i = 0; i < iterations; i++) {
    simulation.tick();
  }

  // Return updated nodes
  return nodes.map((node) => {
    const simNode = simNodes.find((sn) => sn.id === node.id);
    if (simNode) {
      return {
        ...node,
        position: {
          x: simNode.x,
          y: simNode.y,
        },
      };
    }
    return node;
  });
}

/**
 * Get cluster statistics from nodes
 */
export function getClusterStats(nodes: GraphNode[]): Record<ClusterType, number> {
  const stats: Record<ClusterType, number> = {
    frontend: 0,
    backend: 0,
    shared: 0,
    unknown: 0,
  };

  for (const node of nodes) {
    stats[node.data.cluster]++;
  }

  return stats;
}
