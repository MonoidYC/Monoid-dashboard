import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

type CookieToSet = {
  name: string;
  value: string;
  options?: Partial<ResponseCookie>;
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Create a response that we'll modify with cookies
    const redirectUrl = new URL(next, origin);
    let response = NextResponse.redirect(redirectUrl);

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          // Parse cookies from the request
          const cookieHeader = request.headers.get("cookie") ?? "";
          return cookieHeader.split(";").map((cookie) => {
            const [name, ...rest] = cookie.trim().split("=");
            return { name, value: rest.join("=") };
          });
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // Set cookies on the response
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return response;
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`, {
          headers: response.headers,
        });
      } else {
        return response;
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
