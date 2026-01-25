"use client";

import { useState } from "react";
import { Network, Github, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGitHubLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
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
          <div className="mb-10 flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/[0.08] flex items-center justify-center">
              <Network className="w-6 h-6 text-white/90" />
            </div>
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

            <button
              onClick={handleGitHubLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-white text-black font-medium text-[15px] hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Github className="w-5 h-5" />
              )}
              {isLoading ? "Signing in..." : "Sign in with GitHub"}
            </button>
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
