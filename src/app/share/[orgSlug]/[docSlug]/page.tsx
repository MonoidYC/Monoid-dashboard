import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText, Building2, Github } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

interface Props {
  params: Promise<{
    orgSlug: string;
    docSlug: string;
  }>;
}

export default async function ShareDocPage({ params }: Props) {
  const { orgSlug, docSlug } = await params;
  const supabase = getSupabase();

  // Get organization by slug
  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", orgSlug)
    .single();

  if (!organization) {
    notFound();
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
            <div
              className="markdown-preview"
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(doc.content),
              }}
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
  let html = content
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-8 mb-3">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
    // Bold and Italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-white/5 rounded-lg p-4 overflow-x-auto my-4"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-sm">$1</code>')
    // Node links - render as styled text (no interactivity in public view)
    .replace(
      /\[\[Node:\s*([^\]]+)\]\]/g,
      '<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-500/20 text-violet-300 rounded text-sm font-medium">$1</span>'
    )
    // Lists
    .replace(/^\s*[-*]\s+(.*)$/gm, '<li class="ml-4 my-1">$1</li>')
    // Paragraphs
    .replace(/\n\n/g, "</p><p class='my-4'>")
    .replace(/\n/g, "<br>");

  // Wrap list items
  html = html.replace(
    /(<li.*?<\/li>)+/g,
    '<ul class="list-disc ml-4 my-4">$&</ul>'
  );

  return `<p class="my-4">${html}</p>`;
}
