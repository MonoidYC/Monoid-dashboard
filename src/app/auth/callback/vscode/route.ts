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

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Redirect to vscode-connect page after auth
    const redirectUrl = new URL("/auth/vscode-connect", origin);
    let response = NextResponse.redirect(redirectUrl);

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get("cookie") ?? "";
          return cookieHeader.split(";").map((cookie) => {
            const [name, ...rest] = cookie.trim().split("=");
            return { name, value: rest.join("=") };
          });
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData.session) {
      // Include session in URL params (base64 encoded) for VS Code
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
      redirectUrl.searchParams.set('session', sessionBase64);
      
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(redirectUrl);
      } else if (forwardedHost) {
        const finalUrl = new URL(redirectUrl.pathname + redirectUrl.search, `https://${forwardedHost}`);
        return NextResponse.redirect(finalUrl.toString(), {
          headers: response.headers,
        });
      } else {
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
