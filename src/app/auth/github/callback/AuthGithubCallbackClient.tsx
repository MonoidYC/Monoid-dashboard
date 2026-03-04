"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthGithubCallbackClient() {
  const params = useSearchParams();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);

  const code = params.get("code");
  const oauthError = params.get("error_description") || params.get("error");

  useEffect(() => {
    async function completeSignIn() {
      if (oauthError) {
        setError(oauthError);
        return;
      }

      if (!code) {
        setError("Missing OAuth code from GitHub callback.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setError(error.message);
        return;
      }

      window.location.replace("/");
    }

    completeSignIn().catch((err: any) => {
      setError(err?.message || "Failed to complete GitHub sign-in.");
    });
  }, [code, oauthError, supabase]);

  return (
    <main className="min-h-screen bg-[#08080a] text-white flex items-center justify-center p-6">
      <div className="max-w-xl w-full rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6">
        <h1 className="text-xl font-semibold">Finishing GitHub sign-in...</h1>

        {error ? (
          <>
            <p className="text-sm text-red-300 mt-3">{error}</p>
            <Link
              href="/login"
              className="inline-flex mt-5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors"
            >
              Back to login
            </Link>
          </>
        ) : (
          <p className="text-sm text-gray-400 mt-3">
            Exchanging GitHub OAuth code for a Supabase session...
          </p>
        )}
      </div>
    </main>
  );
}
