import { Suspense } from "react";
import AuthGithubCallbackClient from "./AuthGithubCallbackClient";

// OAuth callback pages should never be statically prerendered.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AuthGithubCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#08080a] text-white flex items-center justify-center p-6">
          <div className="max-w-xl w-full rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6">
            <h1 className="text-xl font-semibold">Finishing GitHub sign-in...</h1>
            <p className="text-sm text-gray-400 mt-2">Loading OAuth callback...</p>
          </div>
        </main>
      }
    >
      <AuthGithubCallbackClient />
    </Suspense>
  );
}
