import type { Node, Edge } from "@xyflow/react";
import type { Database } from "../database.types";

// Database row types
export type TestNodeRow = Database["public"]["Tables"]["test_nodes"]["Row"];
export type TestCoverageEdgeRow = Database["public"]["Tables"]["test_coverage_edges"]["Row"];
export type RepoVersionRow = Database["public"]["Tables"]["repo_versions"]["Row"];
export type RepoRow = Database["public"]["Tables"]["repos"]["Row"];
export type CodeNodeRow = Database["public"]["Tables"]["code_nodes"]["Row"];

// Enum types
export type TestType = Database["public"]["Enums"]["test_type"];
export type SourceType = "file" | "generated" | "external" | "synced";
export type TestStatus = "passed" | "failed" | "skipped" | "pending";
export type CoverageType = "covers" | "calls" | "tests_endpoint";

// Runtime validation for SourceType
export function isValidSourceType(value: string): value is SourceType {
  return value === "file" || value === "generated" || value === "external" || value === "synced";
}

// Extended node data for React Flow
export interface TestNodeData extends Record<string, unknown> {
  // From database
  id: string;
  name: string;
  description: string | null;
  testType: TestType;
  sourceType: SourceType;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  runner: string | null;
  command: string | null;
  lastStatus: TestStatus | null;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
  stableId: string;
  metadata: Record<string, unknown>;
  githubLink: string | null; // Direct GitHub permalink to the test file/lines

  // Computed
  coveredCodeCount: number;

  // UI state
  isHighlighted?: boolean;
  isSelected?: boolean;
  isFaded?: boolean;
}

// React Flow node with our custom data
export type TestGraphNode = Node<TestNodeData, "testNode">;

// Extended edge data for React Flow (test -> code coverage)
export interface TestCoverageEdgeData extends Record<string, unknown> {
  coverageType: CoverageType;
  metadata: Record<string, unknown>;
  isHighlighted?: boolean;
}

// React Flow edge with our custom data
export type TestGraphEdge = Edge<TestCoverageEdgeData>;

// Test type styling
export const TEST_TYPE_COLORS: Record<TestType, string> = {
  e2e: "#3b82f6",         // blue
  unit: "#10b981",        // green
  integration: "#8b5cf6", // purple
  security: "#ef4444",    // red
  contract: "#f59e0b",    // amber
  smoke: "#06b6d4",       // cyan
  regression: "#ec4899",  // pink
  performance: "#f97316", // orange
  other: "#6b7280",       // gray
};

// Test type labels
export const TEST_TYPE_LABELS: Record<TestType, string> = {
  e2e: "E2E",
  unit: "Unit",
  integration: "Integration",
  security: "Security",
  contract: "Contract",
  smoke: "Smoke",
  regression: "Regression",
  performance: "Performance",
  other: "Other",
};

// Status colors
export const TEST_STATUS_COLORS: Record<TestStatus, string> = {
  passed: "#10b981",  // green
  failed: "#ef4444",  // red
  skipped: "#f59e0b", // amber
  pending: "#6b7280", // gray
};

// Runner icons (Lucide icon names)
export const RUNNER_ICONS: Record<string, string> = {
  playwright: "Chrome",
  cypress: "Chrome",
  jest: "FlaskConical",
  vitest: "FlaskConical",
  zap: "Shield",
  curl: "Terminal",
  postman: "Send",
  k6: "Activity",
  artillery: "Activity",
  default: "Play",
};

// Source type labels
export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  file: "File",
  generated: "Generated",
  external: "External",
  synced: "Synced",
};

// Get runner display name
export function getRunnerDisplayName(runner: string | null): string {
  if (!runner) return "Unknown";
  return runner.charAt(0).toUpperCase() + runner.slice(1);
}

// Format duration
export function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Format relative time
export function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}
