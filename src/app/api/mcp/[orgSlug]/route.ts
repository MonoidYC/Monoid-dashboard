import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Tool definitions (org_slug is not needed since it's in the URL)
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
          description: "Search query (keyword to search for in titles and content)",
        },
      },
      required: ["query"],
    },
  },
];

// Get organization by slug
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

// Tool handlers
async function listDocs(orgId: string, orgName: string, orgSlug: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: docs, error: docsError } = await supabase
    .from("org_docs")
    .select("slug, title, description, repo_id")
    .eq("organization_id", orgId)
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  if (docsError) {
    return { content: [{ type: "text", text: `Error fetching docs: ${docsError.message}` }] };
  }

  if (!docs || docs.length === 0) {
    return {
      content: [{ type: "text", text: `No published documentation found for organization "${orgName}"` }],
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
        text: `# Documentation for ${orgName}\n\n${docs.length} document(s) available:\n\n${docList}\n\nUse the \`get_doc\` tool with the doc slug to read a specific document.`,
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
        { type: "text", text: `Document "${docSlug}" not found or not published in organization "${orgName}"` },
      ],
    };
  }

  let content = doc.content || "";
  const storagePath = `${orgId}/${docSlug}.md`;

  const { data: storageData } = await supabase.storage.from("docs").download(storagePath);

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
    return { content: [{ type: "text", text: `Error searching: ${searchError.message}` }] };
  }

  if (!docs || docs.length === 0) {
    return {
      content: [{ type: "text", text: `No results found for "${query}" in ${orgName} documentation` }],
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
        text: `# Search Results for "${query}" in ${orgName}\n\nFound ${docs.length} result(s):\n\n${results}\n\nUse \`get_doc\` with the doc slug to read the full document.`,
      },
    ],
  };
}

// Handle tool calls
async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  orgId: string,
  orgName: string,
  orgSlug: string
) {
  switch (name) {
    case "list_docs":
      return listDocs(orgId, orgName, orgSlug);
    case "get_doc":
      return getDoc(orgId, orgName, args.doc_slug as string);
    case "search_docs":
      return searchDocs(orgId, orgName, args.query as string);
    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
}

// MCP JSON-RPC handler
async function handleMcpRequest(
  body: unknown,
  orgId: string,
  orgName: string,
  orgSlug: string
): Promise<unknown> {
  const request = body as { jsonrpc: string; id?: number | string; method: string; params?: unknown };

  if (request.jsonrpc !== "2.0") {
    return { jsonrpc: "2.0", id: request.id, error: { code: -32600, message: "Invalid Request" } };
  }

  const { id, method, params } = request;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
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
      const result = await handleToolCall(callParams.name, callParams.arguments || {}, orgId, orgName, orgSlug);
      return {
        jsonrpc: "2.0",
        id,
        result,
      };
    }

    case "ping":
      return {
        jsonrpc: "2.0",
        id,
        result: {},
      };

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

// Handle GET requests - return server info
export async function GET(
  request: NextRequest,
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
    usage: "Connect using MCP Inspector or any MCP-compatible client via POST",
    endpoint: `/api/mcp/${orgSlug}`,
    protocol: "MCP JSON-RPC 2.0",
  });
}

// Handle POST requests - MCP protocol
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
    const body = await request.json();

    // Handle batch requests
    if (Array.isArray(body)) {
      const results = await Promise.all(
        body.map((req) => handleMcpRequest(req, org.id, org.name, org.slug))
      );
      const responses = results.filter((r) => r !== null);
      return NextResponse.json(responses);
    }

    // Handle single request
    const result = await handleMcpRequest(body, org.id, org.name, org.slug);

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
