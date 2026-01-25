"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function VSCodeConnectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Session can come from: 
  // 1. URL query param (from server callback - base64 encoded)
  // 2. Supabase client (after exchanging code from URL hash/params)
  const sessionParam = searchParams.get("session");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  
  const [session, setSession] = useState<string | null>(sessionParam);
  const [isLoading, setIsLoading] = useState(!sessionParam);
  const [error, setError] = useState<string | null>(
    errorParam ? (errorDescription || errorParam) : null
  );
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);

  // Generate the VS Code URI
  const vscodeUri = session 
    ? `vscode://monoid.monoid-visualize/auth/callback?session=${encodeURIComponent(session)}`
    : null;

  const handleConnectToVSCode = useCallback(() => {
    if (vscodeUri) {
      window.location.href = vscodeUri;
      setOpened(true);
    }
  }, [vscodeUri]);

  const handleCopyUri = async () => {
    if (vscodeUri) {
      await navigator.clipboard.writeText(vscodeUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle OAuth callback - exchange code for session
  useEffect(() => {
    // If we already have a session param, no need to check for OAuth callback
    if (sessionParam) {
      setIsLoading(false);
      return;
    }

    const handleOAuthCallback = async () => {
      try {
        const supabase = createClient();
        
        // Check if there's a code in the URL (OAuth callback)
        // Supabase handles the hash fragment internally via onAuthStateChange
        const { data: { session: supabaseSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("[VSCode Connect] Session error:", sessionError);
          setError(sessionError.message);
          setIsLoading(false);
          return;
        }

        if (supabaseSession) {
          // We have a session! Encode it for VS Code
          const sessionData = {
            access_token: supabaseSession.access_token,
            refresh_token: supabaseSession.refresh_token,
            expires_at: supabaseSession.expires_at,
            user: {
              id: supabaseSession.user.id,
              email: supabaseSession.user.email,
              user_metadata: supabaseSession.user.user_metadata,
            },
          };
          const sessionBase64 = btoa(JSON.stringify(sessionData));
          setSession(sessionBase64);
          setIsLoading(false);
        } else {
          // No session yet - set up listener for auth state changes
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
              console.log("[VSCode Connect] Auth state changed:", event);
              
              if (event === 'SIGNED_IN' && newSession) {
                const sessionData = {
                  access_token: newSession.access_token,
                  refresh_token: newSession.refresh_token,
                  expires_at: newSession.expires_at,
                  user: {
                    id: newSession.user.id,
                    email: newSession.user.email,
                    user_metadata: newSession.user.user_metadata,
                  },
                };
                const sessionBase64 = btoa(JSON.stringify(sessionData));
                setSession(sessionBase64);
                setIsLoading(false);
                subscription.unsubscribe();
              }
            }
          );

          // Give it a moment for Supabase to process the URL hash
          setTimeout(() => {
            if (!session) {
              setError("No authentication session found. Please try signing in again.");
              setIsLoading(false);
            }
          }, 5000);

          return () => {
            subscription.unsubscribe();
          };
        }
      } catch (err) {
        console.error("[VSCode Connect] Error:", err);
        setError("Failed to process authentication. Please try again.");
        setIsLoading(false);
      }
    };

    handleOAuthCallback();
  }, [sessionParam, session]);

  // Auto-open VS Code after session is ready
  useEffect(() => {
    if (vscodeUri && !opened && !isLoading) {
      const timer = setTimeout(() => {
        handleConnectToVSCode();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [vscodeUri, opened, isLoading, handleConnectToVSCode]);

  // Loading state
  if (isLoading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#08080a] p-8">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400 mx-auto mb-4" />
          <p className="text-gray-400">Processing authentication...</p>
        </div>
      </main>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#08080a] p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-4">
            Authentication Error
          </h1>
          <p className="text-gray-400 mb-6">
            {error || "No session was found. Please try signing in again from VS Code."}
          </p>
          <a
            href="/login?from=vscode"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 transition-colors"
          >
            Try Again
          </a>
        </div>
      </main>
    );
  }

  // Success state
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#08080a] p-8">
      <div className="text-center max-w-md">
        {/* Success icon */}
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>

        <h1 className="text-2xl font-semibold text-white mb-2">
          Authentication Successful!
        </h1>
        
        <p className="text-gray-400 mb-8">
          Click the button below to connect your session to VS Code.
        </p>

        {/* Connect to VS Code button */}
        <button
          onClick={handleConnectToVSCode}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium text-lg hover:opacity-90 transition-opacity mb-4"
        >
          <ExternalLink className="w-5 h-5" />
          {opened ? "Opening VS Code..." : "Connect to VS Code"}
        </button>

        {/* Manual instructions */}
        <div className="mt-8 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <p className="text-sm text-gray-400 mb-3">
            If VS Code doesn&apos;t open automatically:
          </p>
          
          <button
            onClick={handleCopyUri}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Link & Open VS Code Manually
              </>
            )}
          </button>
          
          <p className="text-xs text-gray-500 mt-3">
            Paste the link in your browser&apos;s address bar, or run the &quot;Monoid: Sign In&quot; command in VS Code.
          </p>

          {/* Dev mode: Copy just the session token */}
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <p className="text-xs text-gray-500 mb-2">
              For Extension Development Host (debug mode):
            </p>
            <button
              onClick={async () => {
                if (session) {
                  await navigator.clipboard.writeText(session);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400/80 text-xs font-medium hover:bg-amber-500/15 transition-colors"
            >
              <Copy className="w-3 h-3" />
              Copy Session Token (for &quot;Paste Session Token&quot; command)
            </button>
          </div>
        </div>

        {/* Back link */}
        <p className="mt-8 text-sm text-gray-500">
          You can close this tab after connecting to VS Code.
        </p>
      </div>
    </main>
  );
}

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#08080a] p-8">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">Loading...</p>
      </div>
    </main>
  );
}

// Default export wrapped in Suspense
export default function VSCodeConnectPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VSCodeConnectContent />
    </Suspense>
  );
}
