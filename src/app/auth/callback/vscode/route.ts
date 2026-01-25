import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

type CookieToSet = {
  name: string;
  value: string;
  options?: Partial<ResponseCookie>;
};

/**
 * VS Code-specific auth callback route
 * After OAuth, redirects to the vscode-connect page with the session
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error_description = searchParams.get("error_description");

  // Handle OAuth errors from Supabase/GitHub
  if (error_description) {
    console.error("[VS Code Auth] OAuth error:", error_description);
    const errorUrl = new URL("/login", origin);
    errorUrl.searchParams.set("error", error_description);
    return NextResponse.redirect(errorUrl);
  }

  if (!code) {
    console.error("[VS Code Auth] No code provided");
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // We need a mutable response to collect cookies during exchange
  const cookiesToSet: CookieToSet[] = [];

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookieHeader = request.headers.get("cookie") ?? "";
        return cookieHeader.split(";").map((cookie) => {
          const [name, ...rest] = cookie.trim().split("=");
          return { name, value: rest.join("=") };
        });
      },
      setAll(cookies: CookieToSet[]) {
        cookiesToSet.push(...cookies);
      },
    },
  });

  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[VS Code Auth] Code exchange failed:", error.message);
    const errorUrl = new URL("/login", origin);
    errorUrl.searchParams.set("error", "code_exchange_failed");
    errorUrl.searchParams.set("details", error.message);
    return NextResponse.redirect(errorUrl);
  }

  if (!sessionData.session) {
    console.error("[VS Code Auth] No session returned");
    return NextResponse.redirect(`${origin}/login?error=no_session`);
  }

  // Build the session payload for VS Code
  const session = {
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    expires_at: sessionData.session.expires_at,
    user: {
      id: sessionData.session.user.id,
      email: sessionData.session.user.email,
      user_metadata: sessionData.session.user.user_metadata,
    },
  };
  const sessionBase64 = Buffer.from(JSON.stringify(session)).toString('base64');

  // Build redirect URL
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const baseUrl = isLocalEnv ? origin : (forwardedHost ? `https://${forwardedHost}` : origin);
  
  const redirectUrl = new URL("/auth/vscode-connect", baseUrl);
  redirectUrl.searchParams.set("session", sessionBase64);

  // Create response and set cookies
  const response = NextResponse.redirect(redirectUrl);
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  console.log("[VS Code Auth] Success, redirecting to vscode-connect");
  return response;
}
