"use client";

import { useState, useEffect } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useWebview } from "@/components/providers/WebviewProvider";

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className }: SignOutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const webviewContext = useWebview();
  const isWebview = webviewContext?.isWebview ?? false;
  const requestSignOut = webviewContext?.requestSignOut ?? (() => {});

  // Ensure component only renders on client to avoid hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }
  
  const handleSignOut = async () => {
    setIsLoading(true);
    
    try {
      // Always clear Supabase session first
      const supabase = getSupabase();
      await supabase.auth.signOut();
      
      if (isWebview) {
        // In VS Code webview - also request sign out through VS Code
        requestSignOut();
        // Reload to show login state
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        // Normal browser - redirect to login page
        window.location.href = "/login";
      }
    } catch (err) {
      console.error("Sign out error:", err);
      setIsLoading(false);
    }
  };
  
  return (
    <button
      onClick={handleSignOut}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <LogOut className="w-4 h-4" />
      )}
      Sign Out
    </button>
  );
}

export default SignOutButton;
