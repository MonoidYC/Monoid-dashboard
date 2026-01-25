"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, Network, Map, Github } from "lucide-react";
import { GraphCanvas } from "@/components/graph";
import { useGraphData } from "@/components/graph/hooks";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { useWebview } from "@/components/providers/WebviewProvider";
import { getSupabase } from "@/lib/supabase";

export default function GraphPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const versionId = params.versionId as string;
  const highlightNodeId = searchParams.get("highlight");
  const isEmbed = searchParams.get("embed") === "true";
  
  const { isWebview, authSession, requestSignIn } = useWebview();
  const [isAuthReady, setIsAuthReady] = useState(!isEmbed); // Non-embed pages are auth-ready immediately
  const [authChecked, setAuthChecked] = useState(false);

  // For embedded views, wait for auth to be established
  useEffect(() => {
    if (!isEmbed) {
      setIsAuthReady(true);
      setAuthChecked(true);
      return;
    }

    // Check if we already have a session (from cookies or previous setup)
    const checkAuth = async () => {
      try {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('[GraphPage] User already authenticated:', user.email);
          setIsAuthReady(true);
        }
      } catch (e) {
        console.log('[GraphPage] No existing auth session');
      }
      setAuthChecked(true);
    };

    checkAuth();

    // Also check when authSession changes from WebviewProvider
    if (authSession) {
      console.log('[GraphPage] Auth session received from webview context');
      setIsAuthReady(true);
    }
  }, [isEmbed, authSession]);

  // Wait a bit for auth in embed mode, then show sign-in if needed
  useEffect(() => {
    if (isEmbed && authChecked && !isAuthReady) {
      // Give it 3 seconds for auth tokens to arrive via postMessage
      const timeout = setTimeout(() => {
        console.log('[GraphPage] Auth timeout - showing sign-in prompt');
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [isEmbed, authChecked, isAuthReady]);

  const { nodes, edges, repo, version, isLoading, error, refetch } = useGraphData(
    isAuthReady ? versionId : "" // Don't fetch until auth is ready
  );

  // Refetch when auth becomes ready
  useEffect(() => {
    if (isAuthReady && versionId) {
      refetch();
    }
  }, [isAuthReady, versionId]);

  // Show sign-in prompt for embedded views without auth
  if (isEmbed && authChecked && !isAuthReady && !authSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080a]">
        <div className="text-center max-w-md">
          <Network className="w-12 h-12 text-violet-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-white">Sign in required</h2>
          <p className="text-gray-400 mb-6">
            Sign in with GitHub to view your code graph.
          </p>
          <button
            onClick={requestSignIn}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            <Github className="w-5 h-5" />
            Sign in with GitHub
          </button>
        </div>
      </div>
    );
  }

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
        <div className="flex items-center gap-4">
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
          {/* View Roadmap Button - Only show for real repos */}
          {repo && (
            <Link
              href={`/roadmap/${repo.id}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 text-sm font-medium hover:bg-violet-500/20 transition-colors"
            >
              <Map className="w-4 h-4" />
              View Roadmap
            </Link>
          )}
          
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{nodes.length} nodes</span>
            <span>·</span>
            <span>{edges.length} edges</span>
          </div>

          <SignOutButton />
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
