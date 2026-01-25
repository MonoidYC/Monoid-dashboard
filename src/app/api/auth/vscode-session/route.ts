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
 * API endpoint to set Supabase session from VS Code auth token
 * This validates the token and sets proper cookies that middleware can read
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { access_token, refresh_token } = body;

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: "Missing access_token or refresh_token" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Create a response that we'll modify with cookies
    const response = NextResponse.json({ success: true });
    const cookiesToSet: CookieToSet[] = [];

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return [];
        },
        setAll(cookies: CookieToSet[]) {
          cookiesToSet.push(...cookies);
        },
      },
    });

    // Validate the token by setting the session
    const { data: sessionData, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error || !sessionData.session) {
      console.error("[VSCode Session] Failed to validate session:", error);
      return NextResponse.json(
        { error: "Invalid session token" },
        { status: 401 }
      );
    }

    // Set all cookies on the response
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, {
        ...options,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    });

    console.log("[VSCode Session] Session validated and cookies set");
    return response;
  } catch (error) {
    console.error("[VSCode Session] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
