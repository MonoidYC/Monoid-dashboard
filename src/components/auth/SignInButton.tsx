"use client";

import { useState } from "react";
import { Github, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { isVSCodeWebview, handleOAuthLogin } from "@/lib/webview-utils";

interface SignInButtonProps {
  className?: string;
}

export function SignInButton({ className }: SignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSignIn = async () => {
    setIsLoading(true);
    
    try {
      const supabase = getSupabase();
      
      // Check if we're in a VS Code webview
      if (isVSCodeWebview()) {
        // In webview - need to generate OAuth URL and open externally
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'github',
          options: {
            redirectTo: window.location.origin,
            skipBrowserRedirect: true, // Don't auto-redirect, we'll handle it
          }
        });
        
        if (error) {
          console.error('Auth error:', error);
          setIsLoading(false);
          return;
        }
        
        if (data.url) {
          // Open the OAuth URL in the external browser
          handleOAuthLogin(data.url);
          
          // Show a message - the user needs to complete auth in browser
          // and then refresh the webview
          alert(
            'A browser window will open for GitHub authentication.\n\n' +
            'After signing in, click "Reload" in the webview toolbar to refresh.'
          );
        }
      } else {
        // Normal browser - standard OAuth flow
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'github',
          options: {
            redirectTo: window.location.origin,
          }
        });
        
        if (error) {
          console.error('Auth error:', error);
        }
      }
    } catch (err) {
      console.error('Sign in error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <button
      onClick={handleSignIn}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/90 font-medium transition-colors ${className}`}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Github className="w-4 h-4" />
      )}
      Sign in with GitHub
    </button>
  );
}

export default SignInButton;
