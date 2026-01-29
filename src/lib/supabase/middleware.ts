import { NextResponse, type NextRequest } from "next/server";

/**
 * Public POC: no authentication/session enforcement.
 */
export async function updateSession(request: NextRequest) {
  return NextResponse.next({ request });
}

