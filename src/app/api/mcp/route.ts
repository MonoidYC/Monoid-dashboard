import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Discovery endpoint - lists all organizations with MCP servers
export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Get all organizations that have published docs
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

  // For each org, check if they have any published docs
  const orgsWithDocs = [];
  for (const org of orgs || []) {
    const { count } = await supabase
      .from("org_docs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .eq("is_published", true);

    if (count && count > 0) {
      orgsWithDocs.push({
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
    usage: "Each organization has its own MCP endpoint. Use the endpoint URL below to connect.",
    organizations: orgsWithDocs,
    example: orgsWithDocs.length > 0 
      ? `Connect to: /api/mcp/${orgsWithDocs[0].slug}`
      : "No organizations with published docs found",
  });
}

// POST to root endpoint - return error directing to org-specific endpoint
export async function POST() {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32600,
        message: "Please connect to an organization-specific endpoint: /api/mcp/{org-slug}",
      },
    },
    { status: 400 }
  );
}
