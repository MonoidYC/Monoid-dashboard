"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Github } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [isVSCodeWebview, setIsVSCodeWebview] = useState(false);
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  // Detect if we're inside a VS Code webview
  useEffect(() => {
    // Check URL param first (set by the webview)
    if (searchParams.get("vscode") === "true") {
      setIsVSCodeWebview(true);
    }

    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError(oauthError);
    }
    
    // Also listen for message from parent webview
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "vscodeWebview" && event.data?.isWebview) {
        setIsVSCodeWebview(true);
      }
    };
    
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [searchParams]);

  const handleGitHubSignIn = async () => {
    setError(null);
    setOauthLoading(true);

    try {
      if (isVSCodeWebview) {
        throw new Error("GitHub OAuth sign-in must be completed in a browser window, not inside VS Code.");
      }

      const redirectTo = `${window.location.origin}/auth/github/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo,
          scopes: "repo read:user read:org",
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("[Login] GitHub OAuth error:", err);
      setError(err.message || "Failed to start GitHub sign-in");
      setOauthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const redirectAfterAuth = () => {
      if (isVSCodeWebview) {
        const redirect = () => {
          console.log("[Login] Navigating to / inside iframe");
          window.location.replace("/");
        };
        setTimeout(redirect, 800);
        window.parent.postMessage({ type: "authSuccess", redirectUrl: "/" }, "*");
      } else {
        window.location.href = "/";
      }
    };

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;

        if (data.session) {
          console.log("[Login] Sign up successful, user:", data.user?.email);
          console.log("[Login] Is VS Code webview:", isVSCodeWebview);
          redirectAfterAuth();
        } else {
          setIsSignUp(false);
          setPassword("");
          alert("Account created. You can sign in now.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Verify we got a session
        if (!data.session) {
          throw new Error("No session returned from sign in");
        }
        
        console.log("[Login] Sign in successful, user:", data.user?.email);
        console.log("[Login] Is VS Code webview:", isVSCodeWebview);
        redirectAfterAuth();
      }
    } catch (err: any) {
      console.error("[Login] Error:", err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isSignUp ? "Create your account" : "Sign in to Monoid"}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isSignUp
              ? "Visualize and document your codebase"
              : "Access your code visualizations"}
          </p>
        </div>
        {!isSignUp && (
          <>
            <button
              type="button"
              onClick={handleGitHubSignIn}
              disabled={loading || oauthLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Github className="w-4 h-4" />
              {oauthLoading ? "Redirecting to GitHub..." : "Sign in with GitHub"}
            </button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or continue with email</span>
              </div>
            </div>
          </>
        )}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || oauthLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Loading..." : isSignUp ? "Sign up" : "Sign in"}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
