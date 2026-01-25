"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, FlaskConical, Github } from "lucide-react";
import { TestCanvas } from "@/components/test";
import { useTestData } from "@/components/test/hooks";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { useWebview } from "@/components/providers/WebviewProvider";
import { getSupabase } from "@/lib/supabase";

export default function TestsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const versionId = params.versionId as string;
  const isEmbed = searchParams.get("embed") === "true";
  
  const { isWebview, authSession, requestSignIn } = useWebview();
  const [isAuthReady, setIsAuthReady] = useState(!isEmbed);
  const [authChecked, setAuthChecked] = useState(false);

  // For embedded views, wait for auth to be established
  useEffect(() => {
    if (!isEmbed) {
      setIsAuthReady(true);
      setAuthChecked(true);
      return;
    }

    const checkAuth = async () => {
      try {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('[TestsPage] User already authenticated:', user.email);
          setIsAuthReady(true);
        }
      } catch (e) {
        console.log('[TestsPage] No existing auth session');
      }
      setAuthChecked(true);
    };

    checkAuth();

    if (authSession) {
      console.log('[TestsPage] Auth session received from webview context');
      setIsAuthReady(true);
    }
  }, [isEmbed, authSession]);

  const { nodes, edges, repo, version, isLoading, error, refetch } = useTestData(
    isAuthReady ? versionId : ""
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
          <FlaskConical className="w-12 h-12 text-lime-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-white">Sign in required</h2>
          <p className="text-gray-400 mb-6">
            Sign in with GitHub to view your test results.
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
          <Loader2 className="w-8 h-8 animate-spin text-mono-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading tests...</p>
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
          <h2 className="text-xl font-semibold mb-2 text-white">Failed to load tests</h2>
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
          <FlaskConical className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-white">No tests found</h2>
          <p className="text-gray-400 mb-4">
            This version doesn&apos;t have any test nodes yet.
            Run the test ingestion pipeline to populate the graph.
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-lime-400 to-emerald-600 flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-white" />
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
                      <span className="ml-2 text-lime-400">({version.branch})</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="font-medium text-white">Demo Tests</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Link to code graph */}
          <Link
            href={`/graph/${versionId}`}
            className="text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            View Code Graph
          </Link>
          
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{nodes.length} tests</span>
          </div>

          <SignOutButton />
        </div>
      </header>

      {/* Test Canvas */}
      <main className="flex-1 relative">
        <TestCanvas
          initialNodes={nodes}
          initialEdges={edges}
          repo={repo}
          version={version}
        />
      </main>
    </div>
  );
}
