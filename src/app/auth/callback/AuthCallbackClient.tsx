"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

/**
 * Hosted callback page for Supabase PKCE flows started by the VS Code extension.
 *
 * Supabase redirects here with `?code=...&state=...` (and possibly other params).
 * We forward the `code` + `state` to the VS Code extension via a deep link:
 *   vscode://monoid.monoid-visualize/auth-callback?code=...&state=...
 *
 * The extension then calls `exchangeCodeForSession(code)` to obtain refresh token securely.
 */
export default function AuthCallbackClient() {
  const params = useSearchParams();
  const [didAttempt, setDidAttempt] = useState(false);

  const code = params.get("code");
  const state = params.get("state");

  const vscodeUri = useMemo(() => {
    const qp = new URLSearchParams();
    if (code) qp.set("code", code);
    if (state) qp.set("state", state);
    return `vscode://monoid.monoid-visualize/auth-callback?${qp.toString()}`;
  }, [code, state]);

  useEffect(() => {
    // Automatically bounce back to VS Code.
    // If VS Code isn't installed / link is blocked, user can copy the link.
    if (!didAttempt && code) {
      setDidAttempt(true);
      window.location.href = vscodeUri;
    }
  }, [didAttempt, code, vscodeUri]);

  return (
    <main className="min-h-screen bg-[#08080a] text-white flex items-center justify-center p-6">
      <div className="max-w-xl w-full rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6">
        <h1 className="text-xl font-semibold">Finish signing in</h1>
        <p className="text-sm text-gray-400 mt-2">
          We’re sending you back to VS Code to complete sign-in.
        </p>

        {!code ? (
          <div className="mt-4 text-sm text-red-300">
            Missing <code className="font-mono">code</code> parameter. Please retry sign-in from
            VS Code.
          </div>
        ) : (
          <>
            <div className="mt-4 text-sm text-gray-400">
              If nothing happens, copy this link and open it:
            </div>
            <div className="mt-2 p-3 bg-white/5 border border-white/10 rounded-lg">
              <code className="text-xs break-all text-gray-300">{vscodeUri}</code>
            </div>
          </>
        )}

        <div className="mt-6 flex items-center gap-3">
          <a
            href={vscodeUri}
            className="px-4 py-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-300 text-sm font-medium transition-colors"
          >
            Open VS Code
          </a>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

