import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { orgSlug: string; docSlug: string } }
) {
  const { orgSlug, docSlug } = params;

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Get organization by slug
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", orgSlug)
    .single();

  if (orgError || !org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  // Get published doc
  const { data: doc, error: docError } = await supabase
    .from("org_docs")
    .select("*")
    .eq("organization_id", org.id)
    .eq("slug", docSlug)
    .eq("is_published", true)
    .single();

  if (docError || !doc) {
    return NextResponse.json(
      { error: "Document not found or not published" },
      { status: 404 }
    );
  }

  // Try to get content from storage first
  let content = doc.content;
  const storagePath = `${org.id}/${docSlug}.md`;

  const { data: storageData } = await supabase.storage
    .from("docs")
    .download(storagePath);

  if (storageData) {
    content = await storageData.text();
  }

  // Get repo name if doc is linked to a repo
  let repoInfo = null;
  if (doc.repo_id) {
    const { data: repo } = await supabase
      .from("repos")
      .select("id, name, owner")
      .eq("id", doc.repo_id)
      .single();

    if (repo) {
      repoInfo = { id: repo.id, name: repo.name, owner: repo.owner };
    }
  }

  // Check Accept header for format preference
  const accept = request.headers.get("accept") || "";

  if (accept.includes("text/markdown") || accept.includes("text/plain")) {
    // Return raw markdown
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  }

  // Return JSON by default
  return NextResponse.json({
    title: doc.title,
    slug: doc.slug,
    description: doc.description,
    content,
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
    },
    repo: repoInfo,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  });
}
