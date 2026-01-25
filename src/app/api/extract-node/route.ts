import { NextRequest, NextResponse } from "next/server";

// Node type detection patterns
const NODE_TYPE_PATTERNS: Array<{ type: string; patterns: RegExp[] }> = [
  { type: "component", patterns: [/^(export\s+)?(default\s+)?function\s+[A-Z]/, /^const\s+[A-Z]\w+\s*[=:]\s*\(?\s*\{?.*\)?\s*=>/] },
  { type: "hook", patterns: [/^(export\s+)?(const|function)\s+use[A-Z]/] },
  { type: "class", patterns: [/^(export\s+)?(abstract\s+)?class\s+\w+/] },
  { type: "interface", patterns: [/^(export\s+)?interface\s+\w+/] },
  { type: "type", patterns: [/^(export\s+)?type\s+\w+/] },
  { type: "endpoint", patterns: [/^(export\s+)?(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/] },
  { type: "handler", patterns: [/handler|Handler/, /^(export\s+)?(async\s+)?function\s+handle[A-Z]/] },
  { type: "middleware", patterns: [/middleware|Middleware/, /^(export\s+)?(async\s+)?function\s+\w+Middleware/] },
  { type: "constant", patterns: [/^(export\s+)?const\s+[A-Z_]+\s*=/] },
  { type: "function", patterns: [/^(export\s+)?(async\s+)?function\s+\w+/, /^(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(/] },
  { type: "method", patterns: [/^\s+(async\s+)?\w+\s*\([^)]*\)\s*[:{]/] },
];

function detectNodeType(code: string): string {
  const lines = code.split("\n");
  const firstNonEmptyLine = lines.find(line => line.trim().length > 0)?.trim() || "";

  for (const { type, patterns } of NODE_TYPE_PATTERNS) {
    if (patterns.some(pattern => pattern.test(firstNonEmptyLine) || pattern.test(code))) {
      return type;
    }
  }

  return "other";
}

function extractName(code: string): string {
  // Try to extract function/class/component name
  const patterns = [
    /function\s+([A-Za-z_$][\w$]*)/,
    /class\s+([A-Za-z_$][\w$]*)/,
    /const\s+([A-Za-z_$][\w$]*)\s*[=:]/,
    /interface\s+([A-Za-z_$][\w$]*)/,
    /type\s+([A-Za-z_$][\w$]*)/,
    /export\s+default\s+function\s+([A-Za-z_$][\w$]*)/,
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return "UnnamedNode";
}

function extractSignature(code: string, nodeType: string): string | null {
  const lines = code.split("\n");
  
  // For functions, classes, etc., get the first line or two
  if (["function", "method", "handler", "endpoint", "hook", "component"].includes(nodeType)) {
    // Find the line with the function signature
    for (const line of lines) {
      if (/function\s+\w+|const\s+\w+\s*=|=>\s*{/.test(line)) {
        return line.trim();
      }
    }
  }

  if (nodeType === "class") {
    const match = code.match(/class\s+\w+[^{]*/);
    return match ? match[0].trim() : null;
  }

  if (nodeType === "interface" || nodeType === "type") {
    const match = code.match(/(interface|type)\s+\w+[^{=]*/);
    return match ? match[0].trim() : null;
  }

  return null;
}

function generateSummary(code: string, nodeType: string, name: string): string {
  // Simple heuristic-based summary generation
  // In production, you'd call an actual LLM here
  
  const lines = code.split("\n").filter(l => l.trim());
  const hasAsync = /async/.test(code);
  const hasReturn = /return\s/.test(code);
  const hasAwait = /await\s/.test(code);
  const hasFetch = /fetch\(/.test(code);
  const hasUseState = /useState/.test(code);
  const hasUseEffect = /useEffect/.test(code);

  if (nodeType === "component") {
    if (hasUseState && hasUseEffect) {
      return `React component that manages state and side effects`;
    }
    if (hasUseState) {
      return `React component with internal state management`;
    }
    return `React component that renders UI`;
  }

  if (nodeType === "hook") {
    return `Custom React hook that encapsulates reusable logic`;
  }

  if (nodeType === "endpoint") {
    const method = name.match(/^(GET|POST|PUT|DELETE|PATCH)/)?.[0] || "HTTP";
    return `${method} endpoint handler for API requests`;
  }

  if (nodeType === "handler") {
    return `Event or request handler function`;
  }

  if (nodeType === "middleware") {
    return `Middleware function for request processing`;
  }

  if (nodeType === "class") {
    return `Class definition for ${name}`;
  }

  if (nodeType === "interface" || nodeType === "type") {
    return `TypeScript type definition for ${name}`;
  }

  if (nodeType === "constant") {
    return `Constant value definition`;
  }

  if (nodeType === "function" || nodeType === "method") {
    if (hasAsync && hasFetch) {
      return `Async function that fetches data from an API`;
    }
    if (hasAsync) {
      return `Async function that performs asynchronous operations`;
    }
    if (hasReturn) {
      return `Utility function that computes and returns a value`;
    }
    return `Function that performs operations`;
  }

  return `Code block for ${name}`;
}

export async function POST(request: NextRequest) {
  try {
    const { code, filePath, startLine } = await request.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      );
    }

    const nodeType = detectNodeType(code);
    const name = extractName(code);
    const signature = extractSignature(code, nodeType);
    const summary = generateSummary(code, nodeType, name);

    return NextResponse.json({
      name,
      nodeType,
      signature,
      summary,
    });
  } catch (error) {
    console.error("Error extracting node:", error);
    return NextResponse.json(
      { error: "Failed to extract node information" },
      { status: 500 }
    );
  }
}
