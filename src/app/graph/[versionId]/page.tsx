"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, Network, LogOut } from "lucide-react";
import { GraphCanvas } from "@/components/graph";
import { useGraphData } from "@/components/graph/hooks";
import { createClient } from "@/lib/supabase/client";

export default function GraphPage() {
  const router = useRouter();
  const supabase = createClient();
  const params = useParams();
  const searchParams = useSearchParams();
  const versionId = params.versionId as string;
  const highlightNodeId = searchParams.get("highlight");
  const isVSCode = searchParams.get("vscode") === "true";

  const { nodes, edges, repo, version, isLoading, error } = useGraphData(versionId);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080a]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading graph...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080a]">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-white">Failed to load graph</h2>
          <p className="text-gray-400 mb-4">{error.message}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Empty state
  if (nodes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080a]">
        <div className="text-center max-w-md">
          <Network className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-white">No nodes found</h2>
          <p className="text-gray-400 mb-4">
            This version doesn&apos;t have any code nodes yet.
            Run the ingestion pipeline to populate the graph.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#08080a]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0c0c0e]">
        <div className="flex items-center gap-4 flex-1">
          <Link
            href="/"
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center">
              <Network className="w-4 h-4 text-white" />
            </div>
            {repo ? (
              <div>
                <div className="font-medium text-sm text-white">
                  {repo.owner}/{repo.name}
                </div>
                {version && (
                  <div className="text-xs text-gray-500 font-mono">
                    {version.commit_sha.slice(0, 7)}
                    {version.branch && (
                      <span className="ml-2 text-violet-400">({version.branch})</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="font-medium text-white">Demo Graph</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{nodes.length} nodes</span>
            <span>·</span>
            <span>{edges.length} edges</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white/70 hover:text-white transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>

      {/* Graph Canvas */}
      <main className="flex-1 relative">
        <GraphCanvas
          initialNodes={nodes}
          initialEdges={edges}
          repo={repo}
          version={version}
          highlightNodeId={highlightNodeId || undefined}
        />
      </main>
    </div>
  );
}
