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
  // Validate and normalize sourceType
  const sourceType: SourceType = (row.source_type === "synced" || 
                                  row.source_type === "file" || 
                                  row.source_type === "generated" || 
                                  row.source_type === "external")
    ? row.source_type as SourceType
    : "file"; // Default fallback
  
  const data: TestNodeData = {
    id: row.id,
    name: row.name,
    description: row.description,
    testType: row.test_type as TestType,
    sourceType: sourceType,
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
    
    // Fetch test nodes ordered by creation time (earliest first = runs first)
    const { data: testNodes, error: nodesError } = await supabase
      .from("test_nodes")
      .select("*")
      .eq("version_id", versionId)
      .order("created_at", { ascending: true });

    if (nodesError) throw nodesError;
    if (!testNodes) return { nodes: [], edges: [], error: null };

    // Fetch coverage edges to count covered code per test
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

    // Create sequential execution order edges between consecutive tests
    // Tests are already ordered by created_at, so we chain them: test1 -> test2 -> test3 ...
    const edges: TestGraphEdge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `exec-order-${i}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
        type: "default",
        data: {
          coverageType: "covers" as CoverageType,
          metadata: { isExecutionOrder: true },
        },
      });
    }

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
  // Demo tests ordered by creation time (earliest first = runs first)
  const demoTests: (Partial<TestNodeRow> & { github_link?: string; created_at: string })[] = [
    // Stage 1: Smoke tests (run first)
    {
      id: "test-1",
      name: "Database connection smoke test",
      test_type: "smoke",
      source_type: "generated",
      runner: "curl",
      last_status: "passed",
      last_duration_ms: 89,
      stable_id: "test-db-smoke",
      created_at: "2026-01-01T00:00:00Z",
    },
    // Stage 2: Unit tests
    {
      id: "test-2",
      name: "Auth service unit tests",
      test_type: "unit",
      source_type: "file",
      file_path: "src/services/__tests__/auth.test.ts",
      runner: "jest",
      last_status: "passed",
      last_duration_ms: 234,
      stable_id: "test-auth-unit",
      github_link: `${DEMO_GITHUB_BASE}/src/services/__tests__/auth.test.ts#L1-L45`,
      created_at: "2026-01-01T00:01:00Z",
    },
    // Stage 3: Contract tests
    {
      id: "test-3",
      name: "API contract validation",
      test_type: "contract",
      source_type: "generated",
      runner: "postman",
      last_status: "failed",
      last_duration_ms: 567,
      last_error: "Response schema mismatch: missing field 'email'",
      stable_id: "test-api-contract",
      created_at: "2026-01-01T00:02:00Z",
    },
    // Stage 4: E2E tests
    {
      id: "test-4",
      name: "GET /api/users returns 200",
      test_type: "e2e",
      source_type: "file",
      file_path: "tests/api/users.spec.ts",
      runner: "playwright",
      last_status: "passed",
      last_duration_ms: 1234,
      stable_id: "test-users-get",
      github_link: `${DEMO_GITHUB_BASE}/tests/api/users.spec.ts#L10-L25`,
      created_at: "2026-01-01T00:03:00Z",
    },
    {
      id: "test-5",
      name: "User authentication flow",
      test_type: "e2e",
      source_type: "file",
      file_path: "tests/auth/login.spec.ts",
      runner: "playwright",
      last_status: "passed",
      last_duration_ms: 3456,
      stable_id: "test-auth-flow",
      github_link: `${DEMO_GITHUB_BASE}/tests/auth/login.spec.ts#L1-L80`,
      created_at: "2026-01-01T00:04:00Z",
    },
    // Stage 5: Security tests
    {
      id: "test-6",
      name: "XSS vulnerability check for /search",
      test_type: "security",
      source_type: "external",
      runner: "zap",
      last_status: "passed",
      last_duration_ms: 8234,
      stable_id: "test-xss-search",
      created_at: "2026-01-01T00:05:00Z",
    },
    // Stage 6: Regression tests
    {
      id: "test-7",
      name: "User registration regression",
      test_type: "regression",
      source_type: "file",
      file_path: "tests/regression/registration.spec.ts",
      runner: "playwright",
      last_status: "passed",
      last_duration_ms: 2345,
      stable_id: "test-reg-registration",
      github_link: `${DEMO_GITHUB_BASE}/tests/regression/registration.spec.ts#L1-L120`,
      created_at: "2026-01-01T00:06:00Z",
    },
    // Stage 7: Performance tests (run last)
    {
      id: "test-8",
      name: "Homepage load performance",
      test_type: "performance",
      source_type: "file",
      file_path: "tests/perf/homepage.k6.js",
      runner: "k6",
      last_status: "pending",
      stable_id: "test-perf-homepage",
      github_link: `${DEMO_GITHUB_BASE}/tests/perf/homepage.k6.js#L1-L50`,
      created_at: "2026-01-01T00:07:00Z",
    },
  ];

  const nodes = demoTests.map((test) =>
    transformTestNode(
      {
        ...test,
        version_id: "demo",
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

  // Create sequential execution order edges (linear chain based on creation order)
  const edges: TestGraphEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `exec-order-${i}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      type: "default",
      data: {
        coverageType: "covers" as CoverageType,
        metadata: { isExecutionOrder: true },
      },
    });
  }

  return { nodes, edges };
}
