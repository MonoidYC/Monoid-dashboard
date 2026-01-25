"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ExternalLink, Copy, Check, Loader2 } from "lucide-react";

function VSCodeConnectContent() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session");
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);

  // Generate the VS Code URI
  const vscodeUri = sessionParam 
    ? `vscode://monoid.monoid-visualize/auth/callback?session=${encodeURIComponent(sessionParam)}`
    : null;

  const handleConnectToVSCode = () => {
    if (vscodeUri) {
      window.location.href = vscodeUri;
      setOpened(true);
    }
  };

  const handleCopyUri = async () => {
    if (vscodeUri) {
      await navigator.clipboard.writeText(vscodeUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Auto-open VS Code after a short delay
  useEffect(() => {
    if (vscodeUri && !opened) {
      const timer = setTimeout(() => {
        handleConnectToVSCode();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [vscodeUri, opened]);

  if (!sessionParam) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#08080a] p-8">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold text-white mb-4">
            Authentication Error
          </h1>
          <p className="text-gray-400 mb-6">
            No session was found. Please try signing in again from VS Code.
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 transition-colors"
          >
            Back to Login
          </a>
        </div>
      </main>
    );
  }

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
