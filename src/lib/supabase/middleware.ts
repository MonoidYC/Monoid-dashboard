import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../database.types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow access to login page, auth callback pages, settings page, and public assets
  const isLoginPage = request.nextUrl.pathname === "/login";
  const isSettingsPage = request.nextUrl.pathname === "/settings";
  const isAuthCallbackPage = request.nextUrl.pathname === "/auth/callback";
  const isGitHubAuthCallbackPage = request.nextUrl.pathname === "/auth/github/callback";
  const isSharePage = request.nextUrl.pathname.startsWith("/share/");
  const isPublishedDocsApi = request.nextUrl.pathname.startsWith("/api/docs/");
  const isMcpApi = request.nextUrl.pathname.startsWith("/api/mcp");
  const isPublicAsset =
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/api/auth");

  if (
    !user &&
    !isLoginPage &&
    !isSettingsPage &&
    !isAuthCallbackPage &&
    !isGitHubAuthCallbackPage &&
    !isSharePage &&
    !isPublishedDocsApi &&
    !isMcpApi &&
    !isPublicAsset
  ) {
    // Redirect to login if not authenticated (except for login/settings pages)
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    // Redirect to home if already authenticated and trying to access login
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
