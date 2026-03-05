import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const writeToken = process.env.MONOID_MCP_WRITE_TOKEN?.trim() || null;
const STORAGE_BUCKET = "docs";
const WRITE_TOOL_NAMES = new Set(["create_doc", "update_doc"]);

type ToolResponse = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

const TOOLS = [
  {
    name: "list_docs",
    description: "List all published documentation pages for this organization",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_doc",
    description: "Get the full content of a documentation page by its slug",
    inputSchema: {
      type: "object",
      properties: {
        doc_slug: {
          type: "string",
          description: "The document slug",
        },
      },
      required: ["doc_slug"],
    },
  },
  {
    name: "search_docs",
    description: "Search documentation by keyword",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "create_doc",
    description:
      "Create a new doc in this organization (requires x-monoid-mcp-write-token header)",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Document title",
        },
        content: {
          type: "string",
          description: "Markdown content",
        },
        doc_slug: {
          type: "string",
          description: "Optional slug; if omitted, derived from title",
        },
        description: {
          type: "string",
          description: "Optional short description",
        },
        is_published: {
          type: "boolean",
          description: "Optional publish flag (default false)",
        },
        repo_id: {
          type: "string",
          description: "Optional repo ID to associate",
        },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "update_doc",
    description:
      "Update an existing doc by slug (requires x-monoid-mcp-write-token header)",
    inputSchema: {
      type: "object",
      properties: {
        doc_slug: {
          type: "string",
          description: "Existing document slug to update",
        },
        new_doc_slug: {
          type: "string",
          description: "Optional new slug",
        },
        title: {
          type: "string",
          description: "Optional new title",
        },
        content: {
          type: "string",
          description: "Optional new markdown content",
        },
        description: {
          type: "string",
          description: "Optional new description",
        },
        is_published: {
          type: "boolean",
          description: "Optional publish flag",
        },
        repo_id: {
          type: "string",
          description: "Optional repo ID (set null to clear)",
        },
      },
      required: ["doc_slug"],
    },
  },
];

type RpcRequest = {
  jsonrpc: string;
  id?: number | string;
  method: string;
  params?: unknown;
};

function textResult(text: string): ToolResponse {
  return { content: [{ type: "text", text }] };
}

function errorResult(text: string): ToolResponse {
  return { content: [{ type: "text", text }], isError: true };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseBooleanInput(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return null;
}

async function saveDocToStorage(orgId: string, slug: string, content: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const filePath = `${orgId}/${slug}.md`;
  const blob = new Blob([content], { type: "text/markdown" });

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, blob, {
    contentType: "text/markdown",
    upsert: true,
  });

  if (error) {
    return `Storage warning: ${error.message}`;
  }
  return null;
}

async function validateRepoId(repoId: string, orgId: string): Promise<string | null> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase
    .from("repos")
    .select("id")
    .eq("id", repoId)
    .eq("organization_id", orgId)
    .single();

  if (error || !data) {
    return `Repository "${repoId}" not found in this organization`;
  }

  return null;
}

async function createDocTool(
  orgId: string,
  orgSlug: string,
  orgName: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const title = String(args.title || "").trim();
  if (!title) {
    return errorResult("title is required");
  }

  const providedSlug = String(args.doc_slug || "").trim();
  const generatedSlug = slugify(title);
  const docSlug = (providedSlug || generatedSlug).trim();

  if (!docSlug) {
    return errorResult("Could not generate a valid slug. Provide doc_slug explicitly.");
  }

  const content = typeof args.content === "string" ? args.content : "";
  const description =
    args.description === undefined
      ? null
      : args.description === null
        ? null
        : String(args.description);

  const isPublishedInput = args.is_published;
  const isPublished =
    isPublishedInput === undefined ? false : parseBooleanInput(isPublishedInput);
  if (isPublished === null && isPublishedInput !== undefined) {
    return errorResult("is_published must be true/false");
  }

  let repoId: string | null = null;
  if (args.repo_id !== undefined && args.repo_id !== null && String(args.repo_id).trim()) {
    repoId = String(args.repo_id).trim();
    const repoError = await validateRepoId(repoId, orgId);
    if (repoError) return errorResult(repoError);
  }

  const { data: existing } = await supabase
    .from("org_docs")
    .select("id")
    .eq("organization_id", orgId)
    .eq("slug", docSlug)
    .single();

  if (existing) {
    return errorResult(
      `Document slug "${docSlug}" already exists. Use update_doc or choose a different slug.`
    );
  }

  const { data: created, error: createError } = await supabase
    .from("org_docs")
    .insert({
      organization_id: orgId,
      title,
      slug: docSlug,
      content,
      description,
      repo_id: repoId,
      is_published: isPublished,
    })
    .select("id, title, slug, is_published")
    .single();

  if (createError || !created) {
    return errorResult(`Error creating doc: ${createError?.message || "unknown error"}`);
  }

  const storageWarning = await saveDocToStorage(orgId, docSlug, content);
  const publicUrl = `https://monoid-dashboard.vercel.app/share/${orgSlug}/${docSlug}`;

  return textResult(
    `Created doc "${created.title}" (slug: ${created.slug}) in ${orgName}.\n` +
      `Published: ${created.is_published ? "yes" : "no"}\n` +
      `Share URL: ${publicUrl}` +
      (storageWarning ? `\n${storageWarning}` : "")
  );
}

async function updateDocTool(
  orgId: string,
  orgSlug: string,
  orgName: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const targetSlug = String(args.doc_slug || "").trim();

  if (!targetSlug) {
    return errorResult("doc_slug is required");
  }

  const hasTitle = Object.prototype.hasOwnProperty.call(args, "title");
  const hasContent = Object.prototype.hasOwnProperty.call(args, "content");
  const hasDescription = Object.prototype.hasOwnProperty.call(args, "description");
  const hasPublished = Object.prototype.hasOwnProperty.call(args, "is_published");
  const hasRepoId = Object.prototype.hasOwnProperty.call(args, "repo_id");
  const hasNewSlug = Object.prototype.hasOwnProperty.call(args, "new_doc_slug");

  if (!hasTitle && !hasContent && !hasDescription && !hasPublished && !hasRepoId && !hasNewSlug) {
    return errorResult(
      "Provide at least one field to update: title, content, description, is_published, repo_id, or new_doc_slug."
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("org_docs")
    .select("id, slug, title, content, is_published")
    .eq("organization_id", orgId)
    .eq("slug", targetSlug)
    .single();

  if (existingError || !existing) {
    return errorResult(`Document "${targetSlug}" not found in ${orgName}`);
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  let finalSlug = existing.slug;
  if (hasNewSlug) {
    const nextSlug = String(args.new_doc_slug || "").trim();
    if (!nextSlug) {
      return errorResult("new_doc_slug cannot be empty");
    }
    finalSlug = nextSlug;

    if (finalSlug !== existing.slug) {
      const { data: conflict } = await supabase
        .from("org_docs")
        .select("id")
        .eq("organization_id", orgId)
        .eq("slug", finalSlug)
        .neq("id", existing.id)
        .single();
      if (conflict) {
        return errorResult(`A document with slug "${finalSlug}" already exists.`);
      }
    }

    updateData.slug = finalSlug;
  }

  if (hasTitle) {
    const nextTitle = String(args.title || "").trim();
    if (!nextTitle) return errorResult("title cannot be empty");
    updateData.title = nextTitle;
  }

  let nextContent = existing.content || "";
  if (hasContent) {
    nextContent = args.content === null ? "" : String(args.content || "");
    updateData.content = nextContent;
  }

  if (hasDescription) {
    updateData.description =
      args.description === null || args.description === undefined
        ? null
        : String(args.description);
  }

  if (hasPublished) {
    const published = parseBooleanInput(args.is_published);
    if (published === null) return errorResult("is_published must be true/false");
    updateData.is_published = published;
  }

  if (hasRepoId) {
    if (args.repo_id === null || String(args.repo_id || "").trim() === "") {
      updateData.repo_id = null;
    } else {
      const repoId = String(args.repo_id).trim();
      const repoError = await validateRepoId(repoId, orgId);
      if (repoError) return errorResult(repoError);
      updateData.repo_id = repoId;
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("org_docs")
    .update(updateData)
    .eq("id", existing.id)
    .select("title, slug, is_published")
    .single();

  if (updateError || !updated) {
    return errorResult(`Error updating doc: ${updateError?.message || "unknown error"}`);
  }

  const storageWarning = await saveDocToStorage(orgId, finalSlug, nextContent);
  const publicUrl = `https://monoid-dashboard.vercel.app/share/${orgSlug}/${updated.slug}`;

  return textResult(
    `Updated doc "${updated.title}" (slug: ${updated.slug}) in ${orgName}.\n` +
      `Published: ${updated.is_published ? "yes" : "no"}\n` +
      `Share URL: ${publicUrl}` +
      (storageWarning ? `\n${storageWarning}` : "")
  );
}

async function getOrganization(orgSlug: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", orgSlug)
    .single();

  if (error || !org) {
    return null;
  }

  return org;
}

async function listDocs(orgId: string, orgName: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: docs, error: docsError } = await supabase
    .from("org_docs")
    .select("slug, title, description, repo_id")
    .eq("organization_id", orgId)
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  if (docsError) {
    return {
      content: [{ type: "text", text: `Error fetching docs: ${docsError.message}` }],
    };
  }

  if (!docs || docs.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No published documentation found for organization "${orgName}"`,
        },
      ],
    };
  }

  const repoIds = docs.filter((d) => d.repo_id).map((d) => d.repo_id);
  const repoMap = new Map<string, string>();

  if (repoIds.length > 0) {
    const { data: repos } = await supabase
      .from("repos")
      .select("id, name, owner")
      .in("id", repoIds);

    if (repos) {
      repos.forEach((r) => repoMap.set(r.id, `${r.owner}/${r.name}`));
    }
  }

  const docList = docs
    .map((doc) => {
      const repo = doc.repo_id ? repoMap.get(doc.repo_id) : null;
      return `- **${doc.title}** (slug: ${doc.slug})${doc.description ? `\n  ${doc.description}` : ""}${repo ? `\n  Repository: ${repo}` : ""}`;
    })
    .join("\n\n");

  return {
    content: [
      {
        type: "text",
        text:
          `# Documentation for ${orgName}\n\n${docs.length} published document(s) available:\n\n${docList}` +
          "\n\nUse get_doc with a doc_slug to read a specific document.",
      },
    ],
  };
}

async function getDoc(orgId: string, orgName: string, docSlug: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: doc, error: docError } = await supabase
    .from("org_docs")
    .select("*")
    .eq("organization_id", orgId)
    .eq("slug", docSlug)
    .eq("is_published", true)
    .single();

  if (docError || !doc) {
    return {
      content: [
        {
          type: "text",
          text: `Document "${docSlug}" not found or not published in organization "${orgName}"`,
        },
      ],
    };
  }

  let content = doc.content || "";
  const storagePath = `${orgId}/${docSlug}.md`;

  const { data: storageData } = await supabase.storage
    .from("docs")
    .download(storagePath);

  if (storageData) {
    content = await storageData.text();
  }

  let repoInfo = "";
  if (doc.repo_id) {
    const { data: repo } = await supabase
      .from("repos")
      .select("name, owner")
      .eq("id", doc.repo_id)
      .single();

    if (repo) {
      repoInfo = `\nRepository: ${repo.owner}/${repo.name}`;
    }
  }

  return {
    content: [
      {
        type: "text",
        text: `# ${doc.title}\n\nOrganization: ${orgName}${repoInfo}\n${doc.description ? `\n${doc.description}\n` : ""}\n---\n\n${content}`,
      },
    ],
  };
}

async function searchDocs(orgId: string, orgName: string, query: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: docs, error: searchError } = await supabase
    .from("org_docs")
    .select("slug, title, description, content")
    .eq("organization_id", orgId)
    .eq("is_published", true)
    .or(`title.ilike.%${query}%,content.ilike.%${query}%,description.ilike.%${query}%`)
    .order("order_index", { ascending: true })
    .limit(10);

  if (searchError) {
    return {
      content: [{ type: "text", text: `Error searching: ${searchError.message}` }],
    };
  }

  if (!docs || docs.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No results found for "${query}" in ${orgName} documentation`,
        },
      ],
    };
  }

  const results = docs
    .map((doc) => {
      const docContent = doc.content || "";
      const contentLower = docContent.toLowerCase();
      const queryLower = query.toLowerCase();
      const matchIndex = contentLower.indexOf(queryLower);

      let snippet = "";
      if (matchIndex >= 0) {
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(docContent.length, matchIndex + query.length + 100);
        snippet =
          (start > 0 ? "..." : "") +
          docContent.slice(start, end).trim() +
          (end < docContent.length ? "..." : "");
      } else if (doc.description) {
        snippet = doc.description;
      }

      return `### ${doc.title}\n**Slug:** ${doc.slug}${snippet ? `\n> ${snippet}` : ""}`;
    })
    .join("\n\n");

  return {
    content: [
      {
        type: "text",
        text: `# Search Results for "${query}" in ${orgName}\n\nFound ${docs.length} result(s):\n\n${results}\n\nUse get_doc with a doc_slug to read the full document.`,
      },
    ],
  };
}

async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  orgId: string,
  orgSlug: string,
  orgName: string,
  providedWriteToken: string | null
) {
  if (WRITE_TOOL_NAMES.has(name)) {
    if (!writeToken) {
      return errorResult(
        "Write tools are disabled on this server. Set MONOID_MCP_WRITE_TOKEN in server environment."
      );
    }
    if (!providedWriteToken) {
      return errorResult(
        "Missing write token. Send x-monoid-mcp-write-token header for create_doc/update_doc."
      );
    }
    if (providedWriteToken !== writeToken) {
      return errorResult("Invalid write token.");
    }
  }

  switch (name) {
    case "list_docs":
      return listDocs(orgId, orgName);
    case "get_doc":
      return getDoc(orgId, orgName, String(args.doc_slug || ""));
    case "search_docs":
      return searchDocs(orgId, orgName, String(args.query || ""));
    case "create_doc":
      return createDocTool(orgId, orgSlug, orgName, args);
    case "update_doc":
      return updateDocTool(orgId, orgSlug, orgName, args);
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

async function handleMcpRequest(
  body: unknown,
  orgId: string,
  orgName: string,
  orgSlug: string,
  providedWriteToken: string | null
) {
  const request = body as RpcRequest;

  if (request.jsonrpc !== "2.0") {
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: { code: -32600, message: "Invalid Request" },
    };
  }

  const { id, method, params } = request;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: `${orgSlug}-docs`,
            version: "1.0.0",
          },
        },
      };
    case "notifications/initialized":
      return null;
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOLS,
        },
      };
    case "tools/call": {
      const callParams = params as { name: string; arguments?: Record<string, unknown> };
      const result = await handleToolCall(
        callParams.name,
        callParams.arguments || {},
        orgId,
        orgSlug,
        orgName,
        providedWriteToken
      );
      return { jsonrpc: "2.0", id, result };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { orgSlug: string } }
) {
  const { orgSlug } = params;
  const org = await getOrganization(orgSlug);

  if (!org) {
    return NextResponse.json(
      { error: `Organization "${orgSlug}" not found` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    name: `${orgSlug}-docs`,
    version: "1.0.0",
    description: `MCP server for ${org.name} documentation`,
    organization: {
      name: org.name,
      slug: org.slug,
    },
    tools: TOOLS.map((t) => t.name),
    usage:
      "Connect via POST. Read tools are public; write tools require x-monoid-mcp-write-token header.",
    endpoint: `/api/mcp/${orgSlug}`,
    protocol: "MCP JSON-RPC 2.0",
    writeTools: {
      enabled: Boolean(writeToken),
      requiredHeader: "x-monoid-mcp-write-token",
      tools: ["create_doc", "update_doc"],
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { orgSlug: string } }
) {
  const { orgSlug } = params;
  const org = await getOrganization(orgSlug);

  if (!org) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32602, message: `Organization "${orgSlug}" not found` },
      },
      { status: 404 }
    );
  }

  try {
    const headerWriteToken =
      request.headers.get("x-monoid-mcp-write-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      null;

    const body = await request.json();

    if (Array.isArray(body)) {
      const results = await Promise.all(
        body.map((req) =>
          handleMcpRequest(req, org.id, org.name, org.slug, headerWriteToken)
        )
      );
      const responses = results.filter((r) => r !== null);
      return NextResponse.json(responses);
    }

    const result = await handleMcpRequest(
      body,
      org.id,
      org.name,
      org.slug,
      headerWriteToken
    );
    if (result === null) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("MCP error:", error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      { status: 400 }
    );
  }
}
