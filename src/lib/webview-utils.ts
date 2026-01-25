/**
 * Utilities for handling VS Code webview context
 * When the dashboard is embedded in a VS Code webview, certain actions
 * (like OAuth) need to be handled differently.
 */

// Check if we're running inside a VS Code webview
export function isVSCodeWebview(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for VS Code webview indicators
  // 1. Check if we're in an iframe
  const isInIframe = window.self !== window.top;
  
  // 2. Check for vscode webview protocol or specific user agent
  const isVSCodeProtocol = window.location.protocol === 'vscode-webview:';
  
  // 3. Check if parent sent us a vscodeWebview message (set by listener below)
  const hasWebviewFlag = (window as any).__isVSCodeWebview === true;
  
  return isInIframe || isVSCodeProtocol || hasWebviewFlag;
}

// Listen for VS Code webview identification message
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'vscodeWebview' && event.data?.isWebview) {
      (window as any).__isVSCodeWebview = true;
    }
  });
}

/**
 * Open a URL - if in VS Code webview, requests external browser via postMessage
 * Otherwise opens normally
 */
export function openUrl(url: string, options?: { forceExternal?: boolean }): void {
  if (typeof window === 'undefined') return;
  
  const shouldOpenExternal = options?.forceExternal || isVSCodeWebview();
  
  if (shouldOpenExternal) {
    // Send message to parent webview to open in external browser
    window.parent.postMessage({ type: 'openExternalUrl', url }, '*');
  } else {
    // Normal navigation
    window.open(url, '_blank');
  }
}

/**
 * Handle OAuth authentication - opens in external browser when in webview
 * @param provider The OAuth provider (e.g., 'github')
 * @param authUrl The full OAuth authorization URL
 */
export function handleOAuthLogin(authUrl: string): void {
  if (typeof window === 'undefined') return;
  
  if (isVSCodeWebview()) {
    // In VS Code webview - need to open OAuth URL in external browser
    window.parent.postMessage({ type: 'openAuthUrl', url: authUrl }, '*');
    
    // Optionally show a message to the user
    console.log('[Monoid] Opening authentication in external browser...');
  } else {
    // Normal browser - can redirect directly
    window.location.href = authUrl;
  }
}

/**
 * Get the redirect URL for OAuth callbacks
 * In VS Code webview context, we need to handle this differently
 */
export function getOAuthRedirectUrl(): string {
  if (typeof window === 'undefined') return '';
  
  // Always use the web app URL for OAuth callbacks
  // The user will authenticate in the browser and the session will sync
  return window.location.origin;
}
