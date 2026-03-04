import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError =
    requestUrl.searchParams.get("error_description") || requestUrl.searchParams.get("error");

  const loginUrl = new URL("/login", requestUrl.origin);

  if (oauthError) {
    loginUrl.searchParams.set("error", oauthError);
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    loginUrl.searchParams.set("error", "Missing OAuth code from GitHub callback.");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    loginUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(loginUrl);
  }

  const next = requestUrl.searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : "/";
  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}
