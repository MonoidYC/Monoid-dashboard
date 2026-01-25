"use client";

import { useState, useEffect } from "react";
import type {
  TestGraphNode,
  TestGraphEdge,
  RepoRow,
  RepoVersionRow,
} from "@/lib/test/types";
import {
  fetchTestNodes,
  fetchVersionInfo,
  generateDemoTestData,
} from "@/lib/test/queries";

interface UseTestDataResult {
  nodes: TestGraphNode[];
  edges: TestGraphEdge[];
  repo: RepoRow | null;
  version: RepoVersionRow | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useTestData(versionId: string): UseTestDataResult {
  const [nodes, setNodes] = useState<TestGraphNode[]>([]);
  const [edges, setEdges] = useState<TestGraphEdge[]>([]);
  const [repo, setRepo] = useState<RepoRow | null>(null);
  const [version, setVersion] = useState<RepoVersionRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    // Skip fetching if no versionId (waiting for auth)
    if (!versionId) {
      setIsLoading(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Handle demo mode
      if (versionId === "demo") {
        const demoData = generateDemoTestData();
        setNodes(demoData.nodes);
        setEdges(demoData.edges);
        setRepo(null);
        setVersion(null);
        setIsLoading(false);
        return;
      }

      // Fetch version info and test nodes in parallel
      const [versionResult, testsResult] = await Promise.all([
        fetchVersionInfo(versionId),
        fetchTestNodes(versionId),
      ]);

      if (versionResult.error) throw versionResult.error;
      if (testsResult.error) throw testsResult.error;

      setVersion(versionResult.version);
      setRepo(versionResult.repo);
      setNodes(testsResult.nodes);
      setEdges(testsResult.edges);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (versionId) {
      fetchData();
    }
  }, [versionId]);

  return {
    nodes,
    edges,
    repo,
    version,
    isLoading,
    error,
    refetch: fetchData,
  };
}
