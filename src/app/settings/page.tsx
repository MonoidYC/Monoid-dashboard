"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Copy, Check, LogOut, Key } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTokens() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setAccessToken(session.access_token);
      }
      setLoading(false);
    }
    loadTokens();
  }, [supabase]);

  const handleCopy = async () => {
    if (accessToken) {
      await navigator.clipboard.writeText(accessToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080a] text-white">
      <header className="border-b border-white/5 bg-[#0c0c0e]">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="w-6 h-6 text-violet-400" />
              <h1 className="text-2xl font-semibold">Settings</h1>
            </div>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Access Token Section */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6">
            <h2 className="text-lg font-semibold mb-4">VS Code Extension Access Token</h2>
            <p className="text-sm text-gray-400 mb-4">
              Copy this token and paste it into VS Code settings:{" "}
              <code className="text-xs bg-white/5 px-2 py-1 rounded">
                monoid-visualize.supabaseAccessToken
              </code>
            </p>

            {accessToken ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
                  <code className="flex-1 text-xs font-mono break-all text-gray-300">
                    {accessToken}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-300 text-sm font-medium transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  This token is used to authenticate your VS Code extension with Supabase. Keep it
                  secure and don't share it publicly.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-300">
                  You need to be signed in to get your access token.{" "}
                  <Link href="/login" className="underline">
                    Sign in here
                  </Link>
                  .
                </p>
              </div>
            )}
          </div>

          {/* Sign Out Section */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6">
            <h2 className="text-lg font-semibold mb-4">Account</h2>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
