import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../database.types";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

type CookieToSet = {
  name: string;
  value: string;
  options?: Partial<ResponseCookie>;
};

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // If env vars are missing, just pass through
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Log for debugging (remove in production)
  if (process.env.NODE_ENV === "development") {
    console.log(`[Middleware] ${request.nextUrl.pathname} - User: ${user ? user.email : "none"}`);
  }

  // Define public routes that don't require authentication
  const publicRoutes = [
    "/login",
    "/auth/callback",
    "/auth/vscode-connect",
    "/share",
    "/api/mcp",
    "/api/docs",
    "/api/auth/vscode-session",
    "/api/github-webhook",
  ];

  const isPublicRoute = publicRoutes.some(
    (route) =>
      request.nextUrl.pathname === route ||
      request.nextUrl.pathname.startsWith(route + "/")
  );

  // VS Code webview bypass: Skip auth entirely when ?vscode=true is present
  // This is a proof-of-concept approach - VS Code embeds get full access without auth
  // Normal browser users still require authentication
  const isVSCodeRequest = request.nextUrl.searchParams.get("vscode") === "true";

  // Redirect to login if not authenticated and not on a public route
  // Exception: VS Code webview requests bypass auth entirely
  if (!user && !isPublicRoute && !isVSCodeRequest) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect to home if authenticated and on login page
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
