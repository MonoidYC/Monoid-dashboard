"use client";

import { useState, useEffect } from "react";
import { Github, Loader2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Check if we're in a VS Code webview
function isVSCodeWebview(): boolean {
  if (typeof window === 'undefined') return false;
  const isInIframe = window.self !== window.top;
  const isVSCodeProtocol = window.location.protocol === 'vscode-webview:';
  const isVSCodeUserAgent = navigator.userAgent.includes('VSCode') || navigator.userAgent.includes('Electron');
  return isInIframe || isVSCodeProtocol || isVSCodeUserAgent || (window as any).__isVSCodeWebview === true;
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWebview, setIsWebview] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsWebview(isVSCodeWebview());
  }, []);

  const handleGitHubLogin = async () => {
    setIsLoading(true);
    setError(null);
    setAuthMessage(null);

    try {
      const supabase = createClient();
      
      // Check for `from=vscode` URL param (opened from VS Code sign in command)
      const urlParams = new URLSearchParams(window.location.search);
      const fromVscode = urlParams.get('from') === 'vscode';

      // Check if we're in a VS Code webview or opened from VS Code
      if (isVSCodeWebview() || fromVscode) {
        // Get OAuth URL and open in external browser (or redirect if already in browser)
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "github",
          options: {
            redirectTo: `${window.location.origin}/auth/callback?from=vscode`,
            skipBrowserRedirect: isVSCodeWebview(), // Only skip redirect if in webview
          },
        });

        if (error) {
          setError(error.message);
          setIsLoading(false);
          return;
        }

        if (isVSCodeWebview() && data.url) {
          // In webview - send message to parent to open in external browser
          window.parent.postMessage({ type: 'openAuthUrl', url: data.url }, '*');
          setAuthMessage('Opening GitHub in your browser. After signing in, click "Connect to VS Code".');
          setIsLoading(false);
        }
        // If not in webview but from=vscode, the OAuth will redirect normally
      } else {
        // Normal browser - standard OAuth flow
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "github",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          setError(error.message);
          setIsLoading(false);
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-[#08080a]">
      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="mb-10 flex items-center justify-center">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Monoid
            </h1>
          </div>

          {/* Login card */}
          <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <h2 className="text-xl font-medium text-white/90 text-center mb-2">
              Welcome back
            </h2>
            <p className="text-sm text-gray-500 text-center mb-8">
              Sign in to access your repositories
            </p>

            {error && (
              <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {authMessage && (
              <div className="mb-6 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm text-center flex items-center gap-2 justify-center">
                <ExternalLink className="w-4 h-4" />
                {authMessage}
              </div>
            )}

            <button
              onClick={handleGitHubLogin}
              disabled={isLoading || !!authMessage}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-white text-black font-medium text-[15px] hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Github className="w-5 h-5" />
              )}
              {isLoading ? "Signing in..." : authMessage ? "Waiting for browser..." : "Sign in with GitHub"}
            </button>

            {isWebview && (
              <p className="mt-4 text-xs text-gray-500 text-center">
                Running in VS Code webview. Authentication will open in your browser.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="p-6 text-center">
        <a
          href="https://github.com/MonoidYC"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-400 transition-colors"
        >
          <Github className="w-4 h-4" />
          Monoid 2026
        </a>
      </footer>
    </main>
  );
}
