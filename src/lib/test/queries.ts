import { getSupabase } from "../supabase";
import type {
  TestNodeRow,
  TestCoverageEdgeRow,
  TestGraphNode,
  TestGraphEdge,
  TestNodeData,
  TestType,
  SourceType,
  TestStatus,
  CoverageType,
  RepoRow,
  RepoVersionRow,
  CodeNodeRow,
} from "./types";

// Transform database row to React Flow node
function transformTestNode(
  row: TestNodeRow,
  coveredCodeCount: number
): TestGraphNode {
  const data: TestNodeData = {
    id: row.id,
    name: row.name,
    description: row.description,
    testType: row.test_type as TestType,
    sourceType: row.source_type as SourceType,
    filePath: row.file_path,
    startLine: row.start_line,
    endLine: row.end_line,
    runner: row.runner,
    command: row.command,
    lastStatus: row.last_status as TestStatus | null,
    lastRunAt: row.last_run_at,
    lastDurationMs: row.last_duration_ms,
    lastError: row.last_error,
    stableId: row.stable_id,
    metadata: (row.metadata as Record<string, unknown>) || {},
    githubLink: (row as any).github_link || null,
    coveredCodeCount,
  };

  return {
    id: row.id,
    type: "testNode",
    position: { x: 0, y: 0 }, // Will be set by layout
    data,
  };
}

// Transform database row to React Flow edge
function transformCoverageEdge(row: TestCoverageEdgeRow): TestGraphEdge {
  return {
    id: row.id,
    source: row.test_node_id,
    target: row.code_node_id,
    type: "testCoverage",
    data: {
      coverageType: row.coverage_type as CoverageType,
      metadata: (row.metadata as Record<string, unknown>) || {},
    },
  };
}

// Fetch test nodes for a version
export async function fetchTestNodes(versionId: string): Promise<{
  nodes: TestGraphNode[];
  edges: TestGraphEdge[];
  error: Error | null;
}> {
  try {
    const supabase = getSupabase();
    
    // Fetch test nodes
    const { data: testNodes, error: nodesError } = await supabase
      .from("test_nodes")
      .select("*")
      .eq("version_id", versionId)
      .order("test_type")
      .order("name");

    if (nodesError) throw nodesError;
    if (!testNodes) return { nodes: [], edges: [], error: null };

    // Fetch coverage edges
    const { data: coverageEdges, error: edgesError } = await supabase
      .from("test_coverage_edges")
      .select("*")
      .eq("version_id", versionId);

    if (edgesError) throw edgesError;

    // Count covered code per test
    const coverageCountMap = new Map<string, number>();
    (coverageEdges || []).forEach((edge) => {
      const count = coverageCountMap.get(edge.test_node_id) || 0;
      coverageCountMap.set(edge.test_node_id, count + 1);
    });

    // Transform to React Flow format
    const nodes = testNodes.map((row) =>
      transformTestNode(row, coverageCountMap.get(row.id) || 0)
    );

    const edges = (coverageEdges || []).map(transformCoverageEdge);

    return { nodes, edges, error: null };
  } catch (error) {
    return { nodes: [], edges: [], error: error as Error };
  }
}

// Fetch version and repo info
export async function fetchVersionInfo(versionId: string): Promise<{
  version: RepoVersionRow | null;
  repo: RepoRow | null;
  error: Error | null;
}> {
  try {
    const supabase = getSupabase();
    
    const { data: version, error: versionError } = await supabase
      .from("repo_versions")
      .select("*")
      .eq("id", versionId)
      .single();

    if (versionError) throw versionError;
    if (!version) return { version: null, repo: null, error: null };

    const { data: repo, error: repoError } = await supabase
      .from("repos")
      .select("*")
      .eq("id", version.repo_id)
      .single();

    if (repoError) throw repoError;

    return { version, repo, error: null };
  } catch (error) {
    return { version: null, repo: null, error: error as Error };
  }
}

// Fetch code nodes covered by a test
export async function fetchCoveredCodeNodes(testNodeId: string): Promise<{
  codeNodes: CodeNodeRow[];
  error: Error | null;
}> {
  try {
    const supabase = getSupabase();
    
    const { data: edges, error: edgesError } = await supabase
      .from("test_coverage_edges")
      .select("code_node_id")
      .eq("test_node_id", testNodeId);

    if (edgesError) throw edgesError;
    if (!edges || edges.length === 0) return { codeNodes: [], error: null };

    const codeNodeIds = edges.map((e) => e.code_node_id);

    const { data: codeNodes, error: nodesError } = await supabase
      .from("code_nodes")
      .select("*")
      .in("id", codeNodeIds);

    if (nodesError) throw nodesError;

    return { codeNodes: codeNodes || [], error: null };
  } catch (error) {
    return { codeNodes: [], error: error as Error };
  }
}

// Get test statistics for a version
export async function fetchTestStats(versionId: string): Promise<{
  total: number;
  passed: number;
  failed: number;
  pending: number;
  byType: Record<TestType, number>;
  error: Error | null;
}> {
  const emptyStats = {
    total: 0,
    passed: 0,
    failed: 0,
    pending: 0,
    byType: {} as Record<TestType, number>,
    error: null,
  };

  try {
    const supabase = getSupabase();
    
    const { data: tests, error } = await supabase
      .from("test_nodes")
      .select("test_type, last_status")
      .eq("version_id", versionId);

    if (error) throw error;
    if (!tests) return emptyStats;

    const stats = {
      total: tests.length,
      passed: tests.filter((t) => t.last_status === "passed").length,
      failed: tests.filter((t) => t.last_status === "failed").length,
      pending: tests.filter(
        (t) => t.last_status === "pending" || t.last_status === null
      ).length,
      byType: {} as Record<TestType, number>,
      error: null,
    };

    // Count by type
    tests.forEach((t) => {
      const type = t.test_type as TestType;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });

    return stats;
  } catch (error) {
    return { ...emptyStats, error: error as Error };
  }
}

// Demo GitHub links - using a fake repo for demonstration
const DEMO_GITHUB_BASE = "https://github.com/monoid-dev/example-app/blob/abc123";

// Demo data for testing without a real database
export function generateDemoTestData(): {
  nodes: TestGraphNode[];
  edges: TestGraphEdge[];
} {
  const demoTests: (Partial<TestNodeRow> & { github_link?: string })[] = [
    // Stage 1: Smoke tests (run first)
    {
      id: "test-6",
      name: "Database connection smoke test",
      test_type: "smoke",
      source_type: "generated",
      runner: "curl",
      last_status: "passed",
      last_duration_ms: 89,
      stable_id: "test-db-smoke",
      // No github_link for generated tests
    },
    // Stage 2: Unit tests
    {
      id: "test-5",
      name: "Auth service unit tests",
      test_type: "unit",
      source_type: "file",
      file_path: "src/services/__tests__/auth.test.ts",
      runner: "jest",
      last_status: "passed",
      last_duration_ms: 234,
      stable_id: "test-auth-unit",
      github_link: `${DEMO_GITHUB_BASE}/src/services/__tests__/auth.test.ts#L1-L45`,
    },
    // Stage 3: Contract tests
    {
      id: "test-4",
      name: "API contract validation",
      test_type: "contract",
      source_type: "generated",
      runner: "postman",
      last_status: "failed",
      last_duration_ms: 567,
      last_error: "Response schema mismatch: missing field 'email'",
      stable_id: "test-api-contract",
      // No github_link for generated tests
    },
    // Stage 4: Integration/E2E tests
    {
      id: "test-1",
      name: "GET /api/users returns 200",
      test_type: "e2e",
      source_type: "file",
      file_path: "tests/api/users.spec.ts",
      runner: "playwright",
      last_status: "passed",
      last_duration_ms: 1234,
      stable_id: "test-users-get",
      github_link: `${DEMO_GITHUB_BASE}/tests/api/users.spec.ts#L10-L25`,
    },
    {
      id: "test-2",
      name: "User authentication flow",
      test_type: "e2e",
      source_type: "file",
      file_path: "tests/auth/login.spec.ts",
      runner: "playwright",
      last_status: "passed",
      last_duration_ms: 3456,
      stable_id: "test-auth-flow",
      github_link: `${DEMO_GITHUB_BASE}/tests/auth/login.spec.ts#L1-L80`,
    },
    // Stage 5: Security tests
    {
      id: "test-3",
      name: "XSS vulnerability check for /search",
      test_type: "security",
      source_type: "external",
      runner: "zap",
      last_status: "passed",
      last_duration_ms: 8234,
      stable_id: "test-xss-search",
      // No github_link for external tests
    },
    // Stage 6: Regression tests
    {
      id: "test-8",
      name: "User registration regression",
      test_type: "regression",
      source_type: "file",
      file_path: "tests/regression/registration.spec.ts",
      runner: "playwright",
      last_status: "passed",
      last_duration_ms: 2345,
      stable_id: "test-reg-registration",
      github_link: `${DEMO_GITHUB_BASE}/tests/regression/registration.spec.ts#L1-L120`,
    },
    // Stage 7: Performance tests (run last)
    {
      id: "test-7",
      name: "Homepage load performance",
      test_type: "performance",
      source_type: "file",
      file_path: "tests/perf/homepage.k6.js",
      runner: "k6",
      last_status: "pending",
      stable_id: "test-perf-homepage",
      github_link: `${DEMO_GITHUB_BASE}/tests/perf/homepage.k6.js#L1-L50`,
    },
  ];

  const nodes = demoTests.map((test) =>
    transformTestNode(
      {
        ...test,
        version_id: "demo",
        created_at: new Date().toISOString(),
        description: null,
        start_line: null,
        end_line: null,
        command: null,
        last_run_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        metadata: {},
      } as TestNodeRow,
      Math.floor(Math.random() * 5)
    )
  );

  // Create execution order edges (test pipeline flow)
  const executionOrderEdges: TestGraphEdge[] = [
    // Smoke -> Unit
    { id: "order-1", source: "test-6", target: "test-5", type: "default", data: { coverageType: "covers" as CoverageType, metadata: {} } },
    // Unit -> Contract
    { id: "order-2", source: "test-5", target: "test-4", type: "default", data: { coverageType: "covers" as CoverageType, metadata: {} } },
    // Contract -> E2E tests
    { id: "order-3", source: "test-4", target: "test-1", type: "default", data: { coverageType: "covers" as CoverageType, metadata: {} } },
    { id: "order-4", source: "test-4", target: "test-2", type: "default", data: { coverageType: "covers" as CoverageType, metadata: {} } },
    // E2E -> Security
    { id: "order-5", source: "test-1", target: "test-3", type: "default", data: { coverageType: "covers" as CoverageType, metadata: {} } },
    { id: "order-6", source: "test-2", target: "test-3", type: "default", data: { coverageType: "covers" as CoverageType, metadata: {} } },
    // Security -> Regression
    { id: "order-7", source: "test-3", target: "test-8", type: "default", data: { coverageType: "covers" as CoverageType, metadata: {} } },
    // Regression -> Performance
    { id: "order-8", source: "test-8", target: "test-7", type: "default", data: { coverageType: "covers" as CoverageType, metadata: {} } },
  ];

  return { nodes, edges: executionOrderEdges };
}
