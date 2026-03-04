// @ts-nocheck - Supabase types infer 'never' due to complex RLS policies
import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText, Building2, Github } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ShareMarkdownContent } from "@/components/docs/ShareMarkdownContent";

interface Props {
  params: Promise<{
    orgSlug: string;
    docSlug: string;
  }>;
}

export default async function ShareDocPage({ params }: Props) {
  const { orgSlug, docSlug } = await params;
  const supabase = await createClient();

  // Get organization by slug using the public function (works for published docs)
  // This allows public access to org info for share links
  const { data: orgData, error: orgError } = await supabase.rpc(
    "get_org_for_published_doc",
    { org_slug: orgSlug }
  );

  let organization;
  if (orgError || !orgData || orgData.length === 0) {
    // Fallback: try direct query (for authenticated users who are members)
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("slug", orgSlug)
      .single();
    
    if (!org) {
      notFound();
    }
    organization = org;
  } else {
    organization = orgData[0];
  }

  // Get published doc
  const { data: doc } = await supabase
    .from("org_docs")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("slug", docSlug)
    .eq("is_published", true)
    .single();

  if (!doc) {
    notFound();
  }

  return (
    <main className="min-h-screen flex flex-col bg-[#08080a]">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Left: Org + Doc Info */}
          <div className="flex items-center gap-4">
            {organization.avatar_url ? (
              <img
                src={organization.avatar_url}
                alt={organization.name}
                className="w-9 h-9 rounded-xl"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-violet-400" />
              </div>
            )}
            <div>
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <span>{organization.name}</span>
                <span className="text-gray-600">/</span>
              </div>
              <h1 className="font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" />
                {doc.title}
              </h1>
            </div>
          </div>

          {/* Right: Badge */}
          <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
            Published
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          <article className="prose prose-invert max-w-none">
            {doc.description && (
              <p className="text-lg text-gray-400 mb-8 pb-8 border-b border-white/[0.06]">
                {doc.description}
              </p>
            )}
            <ShareMarkdownContent
              htmlContent={renderMarkdown(doc.content)}
              orgId={organization.id}
              repoId={doc.repo_id}
            />
          </article>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center">
          <a
            href="https://github.com/MonoidYC"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-400 transition-colors"
          >
            <Github className="w-4 h-4" />
            Monoid 2026
          </a>
        </div>
      </footer>
    </main>
  );
}

// Simple markdown renderer (same as doc editor)
function renderMarkdown(content: string): string {
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = escaped.split("\n");
  const html: string[] = [];
  let i = 0;

  const formatInline = (text: string): string =>
    text
      .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-sm">$1</code>')
      .replace(
        /\[\[Node:\s*([^\]]+)\]\]/g,
        '<a href="#" data-node-name="$1" class="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 hover:text-violet-200 rounded text-sm font-medium cursor-pointer transition-colors no-underline">$1 →</a>'
      )
      .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      html.push(
        `<pre class="bg-white/5 rounded-lg p-4 overflow-x-auto my-4"><code>${codeLines.join("\n")}</code></pre>`
      );
      continue;
    }

    if (/^###\s+/.test(line)) {
      html.push(
        `<h3 class="text-lg font-semibold mt-6 mb-2">${formatInline(line.replace(/^###\s+/, ""))}</h3>`
      );
      i += 1;
      continue;
    }

    if (/^##\s+/.test(line)) {
      html.push(
        `<h2 class="text-xl font-semibold mt-8 mb-3">${formatInline(line.replace(/^##\s+/, ""))}</h2>`
      );
      i += 1;
      continue;
    }

    if (/^#\s+/.test(line)) {
      html.push(
        `<h1 class="text-2xl font-bold mt-8 mb-4">${formatInline(line.replace(/^#\s+/, ""))}</h1>`
      );
      i += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const item = lines[i].replace(/^\s*[-*]\s+/, "");
        items.push(`<li class="my-0.5">${formatInline(item)}</li>`);
        i += 1;
      }
      html.push(`<ul class="list-disc ml-6 my-2">${items.join("")}</ul>`);
      continue;
    }

    const paragraphLines: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const nextLine = lines[i];
      if (
        !nextLine.trim() ||
        /^```/.test(nextLine) ||
        /^#{1,3}\s+/.test(nextLine) ||
        /^\s*[-*]\s+/.test(nextLine)
      ) {
        break;
      }
      paragraphLines.push(nextLine);
      i += 1;
    }

    html.push(`<p class="my-4">${formatInline(paragraphLines.join("<br>"))}</p>`);
  }

  return html.join("");
}
