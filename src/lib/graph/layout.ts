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

/**
 * Apply hierarchical layout using dagre (top-down tree structure)
 * Parents appear above their children
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
    nodeWidth = 180,
    nodeHeight = 60,
    rankSep = 100, // Vertical spacing between ranks/levels
    nodeSep = 60,  // Horizontal spacing between nodes
  } = options;

  // Create a new dagre graph
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

  // Add nodes to the graph
  nodes.forEach((node) => {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // Add edges to the graph
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  // Run the layout algorithm
  dagre.layout(g);

  // Map the dagre positions back to our nodes
  return nodes.map((node) => {
    const dagreNode = g.node(node.id);
    return {
      ...node,
      position: {
        x: dagreNode.x - nodeWidth / 2,
        y: dagreNode.y - nodeHeight / 2,
      },
    };
  });
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
    // Collision force - prevents overlap
    .force("collide", forceCollide(config.collisionRadius))
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
    .force("collide", forceCollide(config.collisionRadius))
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
