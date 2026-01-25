"use client";

import { useEffect, createContext, useContext, useState, ReactNode, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";

interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user?: {
    id: string;
    email?: string;
    user_metadata?: {
      avatar_url?: string;
      full_name?: string;
      user_name?: string;
    };
  };
}

interface WebviewContextType {
  isWebview: boolean;
  openExternal: (url: string) => void;
  authSession: AuthSession | null;
  requestSignIn: () => void;
  requestSignOut: () => void;
}

const WebviewContext = createContext<WebviewContextType>({
  isWebview: false,
  openExternal: () => {},
  authSession: null,
  requestSignIn: () => {},
  requestSignOut: () => {},
});

export function useWebview() {
  return useContext(WebviewContext);
}

export function WebviewProvider({ children }: { children: ReactNode }) {
  const [isWebview, setIsWebview] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isSettingSession, setIsSettingSession] = useState(false);

  // Request sign in from VS Code
  const requestSignIn = useCallback(() => {
    if (isWebview) {
      window.parent.postMessage({ type: 'requestSignIn' }, '*');
    }
  }, [isWebview]);

  // Request sign out from VS Code
  const requestSignOut = useCallback(() => {
    if (isWebview) {
      window.parent.postMessage({ type: 'requestSignOut' }, '*');
      setAuthSession(null);
    }
  }, [isWebview]);

  useEffect(() => {
    // Detect if we're in a VS Code webview
    const detectWebview = () => {
      // Check if we're in an iframe
      const isInIframe = window.self !== window.top;
      
      // Check for VS Code webview protocol
      const isVSCodeProtocol = window.location.protocol === 'vscode-webview:';
      
      // Check for VS Code webview user agent patterns
      const isVSCodeUserAgent = navigator.userAgent.includes('VSCode') || 
                                 navigator.userAgent.includes('Electron');
      
      return isInIframe || isVSCodeProtocol || isVSCodeUserAgent;
    };

    const detected = detectWebview();
    setIsWebview(detected);
    
    // Also store globally for non-React code
    (window as any).__isVSCodeWebview = detected;

    // If in webview, notify parent we're ready and request auth session
    if (detected) {
      // Send ready message so webview knows iframe is loaded
      window.parent.postMessage({ type: 'ready' }, '*');
      // Request auth session
      window.parent.postMessage({ type: 'requestAuthSession' }, '*');
      
      // Also request again after a short delay in case of timing issues
      setTimeout(() => {
        window.parent.postMessage({ type: 'requestAuthSession' }, '*');
      }, 1000);
    }

    // If in webview, patch Supabase auth to handle OAuth properly
    if (detected) {
      try {
        const supabase = getSupabase();
        const originalSignInWithOAuth = supabase.auth.signInWithOAuth.bind(supabase.auth);
        
        // Monkey-patch signInWithOAuth to intercept in webview context
        (supabase.auth as any).signInWithOAuth = async (credentials: any) => {
          console.log('[Monoid Auth] Intercepting OAuth call in webview');
          
          // Request sign in through VS Code instead
          window.parent.postMessage({ type: 'requestSignIn' }, '*');
          
          // Return a "pending" result
          return { data: { url: null, provider: 'github' }, error: null };
        };
        
        console.log('[Monoid] Patched Supabase auth for webview context');
      } catch (e) {
        console.warn('[Monoid] Could not patch Supabase auth:', e);
      }
    }

    // Listen for messages from VS Code
    const handleMessage = (event: MessageEvent) => {
      // Log all messages for debugging
      if (event.data?.type) {
        console.log('[Monoid] Received message:', event.data.type);
      }
      
      if (event.data?.type === 'vscodeWebview' && event.data?.isWebview) {
        console.log('[Monoid] Detected VS Code webview via message');
        setIsWebview(true);
        (window as any).__isVSCodeWebview = true;
        // Request auth session when we know we're in a webview
        window.parent.postMessage({ type: 'requestAuthSession' }, '*');
      }
      
      // Handle auth session from VS Code
      if (event.data?.type === 'setAuthSession') {
        console.log('[Monoid] Received setAuthSession message, session exists:', !!event.data?.session);
        if (event.data?.session && !isSettingSession) {
          // Check if we're already authenticated BEFORE setting session
          const checkAndSetSession = async () => {
            try {
              const supabase = getSupabase();
              
              // First check if we're already authenticated by checking for user (reads from cookies)
              const { data: { user }, error: userError } = await supabase.auth.getUser();
              
              if (user) {
                console.log('[Monoid] Already authenticated, user:', user.email);
                // Check if it's the same user
                if (user.id === event.data.session.user?.id) {
                  console.log('[Monoid] Same user, skipping session setup');
                  setAuthSession(event.data.session);
                  setIsSettingSession(false);
                  return;
                } else {
                  console.log('[Monoid] Different user, will update session');
                }
              } else {
                console.log('[Monoid] No authenticated user found, will set session');
              }

              // No valid session - set it
              setIsSettingSession(true);
              setAuthSession(event.data.session);

              // Set server-side cookies via API endpoint
              console.log('[Monoid] Setting server session cookies...');
              const response = await fetch('/api/auth/vscode-session', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include', // Important: include cookies
                body: JSON.stringify({
                  access_token: event.data.session.access_token,
                  refresh_token: event.data.session.refresh_token,
                }),
              });

              if (!response.ok) {
                const error = await response.json();
                console.warn('[Monoid] Failed to set server session:', error);
                setIsSettingSession(false);
                return;
              }

              console.log('[Monoid] Server session cookies set successfully');

              // Also set client-side Supabase session
              const { error } = await supabase.auth.setSession({
                access_token: event.data.session.access_token,
                refresh_token: event.data.session.refresh_token,
              });

              if (error) {
                console.warn('[Monoid] Could not set Supabase client session:', error);
                setIsSettingSession(false);
              } else {
                console.log('[Monoid] Supabase client session set successfully');
                // Small delay before reload to ensure cookies are set
                setTimeout(() => {
                  console.log('[Monoid] Reloading to pick up session cookies...');
                  window.location.reload();
                }, 100);
              }
            } catch (e) {
              console.warn('[Monoid] Could not set session:', e);
              setIsSettingSession(false);
            }
          };

          checkAndSetSession();
        } else if (isSettingSession) {
          console.log('[Monoid] Already setting session, ignoring duplicate message');
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Intercept clicks on OAuth/external links
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      
      if (link && link.href) {
        const url = link.href;
        
        // Check if this is an OAuth or external URL that needs special handling
        const isOAuthUrl = url.includes('github.com/login') || 
                          url.includes('supabase.co/auth') ||
                          url.includes('/auth/v1/authorize');
        
        const isExternalUrl = !url.startsWith(window.location.origin) && 
                             (url.startsWith('http://') || url.startsWith('https://'));
        
        if ((window as any).__isVSCodeWebview && (isOAuthUrl || isExternalUrl)) {
          e.preventDefault();
          e.stopPropagation();
          
          // Send message to parent webview to open externally
          window.parent.postMessage({ type: 'openExternalUrl', url }, '*');
          console.log('[Monoid] Opening external URL:', url);
        }
      }
    };

    document.addEventListener('click', handleClick, true);

    // Intercept window.location changes for OAuth redirects
    // Note: window.location.assign/replace are readonly in some browsers (Safari),
    // so we wrap this in a try-catch and skip if not supported
    // Also check if already intercepted to avoid redefinition errors
    let originalAssign: ((url: string) => void) | null = null;
    let originalReplace: ((url: string) => void) | null = null;
    
    // Check if already intercepted (prevent multiple interceptions)
    const isAlreadyIntercepted = (window as any).__monoidLocationIntercepted === true;
    
    if (!isAlreadyIntercepted) {
      const interceptRedirect = (url: string, originalFn: (url: string) => void) => {
        const isOAuthUrl = url.includes('github.com/login') || 
                          url.includes('supabase.co/auth') ||
                          url.includes('/auth/v1/authorize');
        
        if ((window as any).__isVSCodeWebview && isOAuthUrl) {
          window.parent.postMessage({ type: 'openAuthUrl', url }, '*');
          console.log('[Monoid] Intercepted OAuth redirect:', url);
          return;
        }
        
        originalFn(url);
      };

      try {
        originalAssign = window.location.assign.bind(window.location);
        originalReplace = window.location.replace.bind(window.location);
        
        // Check if property descriptor allows redefinition
        const assignDescriptor = Object.getOwnPropertyDescriptor(window.location, 'assign');
        const replaceDescriptor = Object.getOwnPropertyDescriptor(window.location, 'replace');
        
        // Only try to redefine if configurable or if descriptor doesn't exist
        if (!assignDescriptor || assignDescriptor.configurable) {
          Object.defineProperty(window.location, 'assign', {
            value: (url: string) => interceptRedirect(url, originalAssign!),
            writable: true,
            configurable: true,
          });
        }
        
        if (!replaceDescriptor || replaceDescriptor.configurable) {
          Object.defineProperty(window.location, 'replace', {
            value: (url: string) => interceptRedirect(url, originalReplace!),
            writable: true,
            configurable: true,
          });
        }
        
        // Mark as intercepted to prevent multiple attempts
        (window as any).__monoidLocationIntercepted = true;
      } catch (e) {
        // Safari and some browsers don't allow modifying window.location properties
        // Silently fail - this is expected in some environments
        originalAssign = null;
        originalReplace = null;
      }
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('click', handleClick, true);
      
      // Restore original methods if we successfully patched them
      if (originalAssign && originalReplace && (window as any).__monoidLocationIntercepted) {
        try {
          const assignDescriptor = Object.getOwnPropertyDescriptor(window.location, 'assign');
          const replaceDescriptor = Object.getOwnPropertyDescriptor(window.location, 'replace');
          
          if (!assignDescriptor || assignDescriptor.configurable) {
            Object.defineProperty(window.location, 'assign', {
              value: originalAssign,
              writable: true,
              configurable: true,
            });
          }
          
          if (!replaceDescriptor || replaceDescriptor.configurable) {
            Object.defineProperty(window.location, 'replace', {
              value: originalReplace,
              writable: true,
              configurable: true,
            });
          }
          
          // Clear the flag
          delete (window as any).__monoidLocationIntercepted;
        } catch (e) {
          // Ignore restoration errors
        }
      }
    };
  }, []);

  const openExternal = useCallback((url: string) => {
    if (isWebview) {
      window.parent.postMessage({ type: 'openExternalUrl', url }, '*');
    } else {
      window.open(url, '_blank');
    }
  }, [isWebview]);

  return (
    <WebviewContext.Provider value={{ 
      isWebview, 
      openExternal, 
      authSession, 
      requestSignIn, 
      requestSignOut 
    }}>
      {children}
    </WebviewContext.Provider>
  );
}
