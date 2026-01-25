import type { Database } from "../database.types";

// Database row types
export type RoadmapRow = Database["public"]["Tables"]["roadmaps"]["Row"];
export type RoadmapInsert = Database["public"]["Tables"]["roadmaps"]["Insert"];
export type RoadmapUpdate = Database["public"]["Tables"]["roadmaps"]["Update"];
export type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

// Extended roadmap with repo info
export interface RoadmapWithRepo extends RoadmapRow {
  repo: {
    id: string;
    name: string;
    owner: string;
    organization_id: string | null;
  };
}

// Node reference for linking
export interface NodeReference {
  id: string;
  name: string;
  nodeType: string;
  filePath: string;
  versionId: string;
}

// Parsed node link from markdown
export interface ParsedNodeLink {
  fullMatch: string;      // The full [[Node: X]] string
  nodeName: string;       // Just the node name
  startIndex: number;     // Position in content
  endIndex: number;       // End position in content
}

// LLM suggestion response
export interface NodeLinkSuggestion {
  suggestedNodeName: string;
  nodeId: string;
  confidence: number;
  reason: string;
}

// Autocomplete result
export interface AutocompleteNode {
  id: string;
  name: string;
  nodeType: string;
  filePath: string;
  matchScore: number;
}

// GitHub sync result
export interface GitHubSyncResult {
  success: boolean;
  commitSha?: string;
  filePath?: string;
  error?: string;
}

// Regex pattern for parsing node links
export const NODE_LINK_PATTERN = /\[\[Node:\s*([^\]]+)\]\]/g;

// Parse all node links from content
export function parseNodeLinks(content: string): ParsedNodeLink[] {
  const links: ParsedNodeLink[] = [];
  let match;
  
  // Reset regex state
  NODE_LINK_PATTERN.lastIndex = 0;
  
  while ((match = NODE_LINK_PATTERN.exec(content)) !== null) {
    links.push({
      fullMatch: match[0],
      nodeName: match[1].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }
  
  return links;
}
