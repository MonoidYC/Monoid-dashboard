import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }

  const organizations = [];
  for (const org of orgs || []) {
    const { count } = await supabase
      .from("org_docs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .eq("is_published", true);

    if ((count || 0) > 0) {
      organizations.push({
        name: org.name,
        slug: org.slug,
        endpoint: `/api/mcp/${org.slug}`,
        docsCount: count,
      });
    }
  }

  return NextResponse.json({
    name: "monoid-docs-mcp",
    version: "1.0.0",
    description: "MCP server discovery for Monoid organization documentation",
    usage: "Use an organization endpoint from the organizations list below.",
    organizations,
  });
}

export async function POST() {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32600,
        message:
          "Connect to an organization-specific endpoint: /api/mcp/{org-slug}",
      },
    },
    { status: 400 }
  );
}
