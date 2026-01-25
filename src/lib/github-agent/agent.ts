import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import type {
  FeasibilityAnalysisParams,
  FeasibilityAnalysisResult,
  VisualizationResult,
  CodeNodeContext,
} from "./types";

/**
 * Analyze the feasibility of a GitHub issue using codebase context and Gemini
 */
export async function analyzeFeasibility(
  params: FeasibilityAnalysisParams
): Promise<FeasibilityAnalysisResult> {
  const { issueTitle, issueBody, repoOwner, repoName } = params;

  // Get Supabase client with service role for server-side access
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return createErrorResult("Supabase credentials not configured");
  }

  if (!geminiApiKey) {
    return createErrorResult("Gemini API key not configured");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 1. Find the repository in Supabase
  const { data: repo, error: repoError } = await supabase
    .from("repos")
    .select("id, name, owner")
    .eq("owner", repoOwner)
    .eq("name", repoName)
    .single();

  if (repoError || !repo) {
    return createErrorResult(
      `Repository ${repoOwner}/${repoName} not found in Monoid. Please index this repository first.`
    );
  }

  // 2. Get the latest version for this repo
  const { data: latestVersion, error: versionError } = await supabase
    .from("repo_versions")
    .select("id, commit_sha, branch, ingested_at")
    .eq("repo_id", repo.id)
    .order("ingested_at", { ascending: false })
    .limit(1)
    .single();

  if (versionError || !latestVersion) {
    return createErrorResult(
      `No indexed versions found for ${repoOwner}/${repoName}. Please run an analysis first.`
    );
  }

  // 3. Get code nodes for context
  const { data: nodes, error: nodesError } = await supabase
    .from("code_nodes")
    .select("id, name, node_type, file_path, signature")
    .eq("version_id", latestVersion.id)
    .limit(150); // Limit to fit in context window

  if (nodesError) {
    console.error("Error fetching nodes:", nodesError);
  }

  const codeNodes: CodeNodeContext[] = (nodes || []).map((n) => ({
    id: n.id,
    name: n.name,
    nodeType: n.node_type,
    filePath: n.file_path,
    summary: null,
    signature: n.signature,
  }));

  // 4. Get node summaries from metadata if available
  const { data: nodesWithMeta } = await supabase
    .from("code_nodes")
    .select("id, metadata")
    .eq("version_id", latestVersion.id)
    .not("metadata", "is", null)
    .limit(50);

  const summaryMap = new Map<string, string>();
  if (nodesWithMeta) {
    for (const node of nodesWithMeta) {
      const meta = node.metadata as Record<string, unknown> | null;
      if (meta?.summary && typeof meta.summary === "string") {
        summaryMap.set(node.id, meta.summary);
      }
    }
  }

  // Enhance nodes with summaries
  for (const node of codeNodes) {
    if (summaryMap.has(node.id)) {
      node.summary = summaryMap.get(node.id) || null;
    }
  }

  // 5. Build context string for Gemini
  const codeContext = buildCodeContext(codeNodes);

  // 6. Call Gemini for analysis
  const analysis = await callGeminiForAnalysis(
    issueTitle,
    issueBody,
    codeContext,
    geminiApiKey,
    params.triggerComment,
    params.triggerUser
  );

  return analysis;
}

/**
 * Build a context string from code nodes for the LLM
 */
function buildCodeContext(nodes: CodeNodeContext[]): string {
  if (nodes.length === 0) {
    return "No code analysis available for this repository.";
  }

  // Group nodes by type for better organization
  const byType = new Map<string, CodeNodeContext[]>();
  for (const node of nodes) {
    const type = node.nodeType;
    if (!byType.has(type)) {
      byType.set(type, []);
    }
    byType.get(type)!.push(node);
  }

  const sections: string[] = [];

  byType.forEach((typeNodes, type) => {
    const items = typeNodes
      .slice(0, 25) // Limit per type
      .map((n) => {
        let line = `  - ${n.name} (${n.filePath})`;
        if (n.summary) {
          line += `: ${n.summary}`;
        } else if (n.signature) {
          line += `: ${n.signature.slice(0, 100)}`;
        }
        return line;
      })
      .join("\n");

    sections.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}s\n${items}`);
  });

  return sections.join("\n\n");
}

/**
 * Call Gemini API for feasibility analysis using Gemini 3.0 Flash
 */
async function callGeminiForAnalysis(
  issueTitle: string,
  issueBody: string,
  codeContext: string,
  apiKey: string,
  triggerComment?: string,
  triggerUser?: string
): Promise<FeasibilityAnalysisResult> {
  // Build the question context
  const questionContext = triggerComment
    ? `\n\n**Question from @${triggerUser || "user"}:**\n${triggerComment}`
    : "";

  const prompt = `You are a senior software engineer analyzing the feasibility of implementing a GitHub issue.

## Issue to Analyze
**Title:** ${issueTitle}

**Description:**
${issueBody || "(No description provided)"}${questionContext}

## Codebase Structure
The repository has been analyzed and contains the following code elements:

${codeContext}

## Your Task
Analyze the feasibility of implementing this issue. Provide a structured analysis covering:

1. **Feasibility Score** (1-10): How feasible is this issue to implement?
   - 8-10: Highly feasible, clear path forward
   - 5-7: Moderately feasible, some challenges expected
   - 1-4: Low feasibility, significant challenges or blockers

2. **Complexity Estimate**: low / medium / high

3. **Affected Components**: List the specific files or components that would likely need to be modified

4. **Implementation Approach**: Brief outline of how this could be implemented

5. **Potential Challenges**: Any risks, unknowns, or blockers

6. **Prerequisites**: Any dependencies or prior work needed

Format your response as a clear, professional GitHub comment. Use markdown formatting.
Do NOT use emojis in your response.
Keep the response concise but actionable. Focus on practical insights.`;

  try {
    // Initialize Gemini 3.0 client
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.3,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 2048,
      },
    });

    const analysisText = response.text?.trim() || "";

    if (!analysisText) {
      return createErrorResult("No analysis generated");
    }

    // Parse score and complexity from response
    const scoreMatch = analysisText.match(
      /feasibility\s*(?:score)?[:\s]*(\d+)/i
    );
    const feasibilityScore = scoreMatch
      ? Math.min(10, Math.max(1, parseInt(scoreMatch[1])))
      : 5;

    const complexityMatch = analysisText.match(
      /complexity[:\s]*(low|medium|high)/i
    );
    const complexity = (complexityMatch?.[1]?.toLowerCase() || "medium") as
      | "low"
      | "medium"
      | "high";

    // Extract affected components (simplified)
    const affectedNodes: string[] = [];
    const componentsMatch = analysisText.match(
      /affected\s*components?[:\s]*([^\n]+)/i
    );
    if (componentsMatch) {
      const components = componentsMatch[1].split(/[,;]/);
      for (const comp of components) {
        const cleaned = comp.trim().replace(/^[-*]\s*/, "");
        if (cleaned && cleaned.length < 100) {
          affectedNodes.push(cleaned);
        }
      }
    }

    return {
      comment: formatAnalysisComment(analysisText, feasibilityScore),
      feasibilityScore,
      estimatedComplexity: complexity,
      affectedNodes: affectedNodes.slice(0, 10),
      analysisTimestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return createErrorResult("Failed to connect to AI service");
  }
}

/**
 * Format the analysis as a GitHub comment
 */
function formatAnalysisComment(analysis: string, score: number): string {
  const header = `## Feasibility Analysis\n\n`;
  const footer = `\n\n---\n<sub>Score: **${score}/10** | Generated by [Monoid](https://monoid.so) | ${new Date().toLocaleDateString()}</sub>`;

  return header + analysis + footer;
}

/**
 * Create an error result with a helpful message
 */
function createErrorResult(message: string): FeasibilityAnalysisResult {
  return {
    comment: `## Analysis Unavailable\n\n${message}\n\nPlease ensure the repository has been indexed by Monoid before requesting feasibility analysis.\n\n---\n<sub>Generated by [Monoid](https://monoid.so)</sub>`,
    feasibilityScore: 0,
    estimatedComplexity: "high",
    affectedNodes: [],
    analysisTimestamp: new Date().toISOString(),
  };
}

/**
 * Create a visualization error result
 */
function createVisualizationErrorResult(message: string): VisualizationResult {
  return {
    comment: `## Visualization Unavailable\n\n${message}\n\nPlease ensure the repository has been indexed by Monoid before requesting visualization.\n\n---\n<sub>Generated by [Monoid](https://monoid.so)</sub>`,
    mermaidDiagram: "",
    affectedNodes: [],
    analysisTimestamp: new Date().toISOString(),
  };
}

/**
 * Analyze and visualize how a proposed change fits into the codebase
 */
export async function analyzeAndVisualize(
  params: FeasibilityAnalysisParams
): Promise<VisualizationResult> {
  const { issueTitle, issueBody, repoOwner, repoName } = params;

  // Get Supabase client with service role for server-side access
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return createVisualizationErrorResult("Supabase credentials not configured");
  }

  if (!geminiApiKey) {
    return createVisualizationErrorResult("Gemini API key not configured");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 1. Find the repository in Supabase
  const { data: repo, error: repoError } = await supabase
    .from("repos")
    .select("id, name, owner")
    .eq("owner", repoOwner)
    .eq("name", repoName)
    .single();

  if (repoError || !repo) {
    return createVisualizationErrorResult(
      `Repository ${repoOwner}/${repoName} not found in Monoid. Please index this repository first.`
    );
  }

  // 2. Get the latest version for this repo
  const { data: version, error: versionError } = await supabase
    .from("versions")
    .select("id")
    .eq("repo_id", repo.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (versionError || !version) {
    return createVisualizationErrorResult(
      "No code analysis found for this repository. Please run Monoid indexing first."
    );
  }

  // 3. Fetch code nodes with their relationships
  const { data: nodes, error: nodesError } = await supabase
    .from("code_nodes")
    .select("id, name, node_type, file_path, summary, signature")
    .eq("version_id", version.id)
    .limit(100);

  if (nodesError || !nodes || nodes.length === 0) {
    return createVisualizationErrorResult(
      "No code nodes found. The repository may not be fully indexed."
    );
  }

  // 4. Fetch edges (relationships between nodes)
  const { data: edges, error: edgesError } = await supabase
    .from("node_edges")
    .select("source_node_id, target_node_id, edge_type")
    .eq("version_id", version.id)
    .limit(200);

  const codeNodes: CodeNodeContext[] = nodes.map((n) => ({
    id: n.id,
    name: n.name,
    nodeType: n.node_type,
    filePath: n.file_path,
    summary: n.summary,
    signature: n.signature,
  }));

  // Build context with relationships
  const codeContext = buildVisualizationContext(codeNodes, edges || []);

  // 5. Call Gemini for visualization
  const visualization = await callGeminiForVisualization(
    issueTitle,
    issueBody,
    codeContext,
    geminiApiKey,
    params.triggerComment,
    params.triggerUser
  );

  return visualization;
}

/**
 * Build context for visualization including node relationships
 */
function buildVisualizationContext(
  nodes: CodeNodeContext[],
  edges: Array<{ source_node_id: string; target_node_id: string; edge_type: string }>
): string {
  if (nodes.length === 0) {
    return "No code analysis available for this repository.";
  }

  // Create a map for quick node lookup
  const nodeMap = new Map<string, CodeNodeContext>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Build node list
  const nodeList = nodes
    .slice(0, 50)
    .map((n) => `- ${n.name} (${n.nodeType}): ${n.filePath}${n.summary ? ` - ${n.summary}` : ""}`)
    .join("\n");

  // Build relationship list
  const relationships = edges
    .slice(0, 100)
    .map((e) => {
      const source = nodeMap.get(e.source_node_id);
      const target = nodeMap.get(e.target_node_id);
      if (source && target) {
        return `- ${source.name} --[${e.edge_type}]--> ${target.name}`;
      }
      return null;
    })
    .filter(Boolean)
    .join("\n");

  return `## Code Components\n${nodeList}\n\n## Relationships\n${relationships || "No relationships found."}`;
}

/**
 * Call Gemini API to generate a visualization diagram
 */
async function callGeminiForVisualization(
  issueTitle: string,
  issueBody: string,
  codeContext: string,
  apiKey: string,
  triggerComment?: string,
  triggerUser?: string
): Promise<VisualizationResult> {
  const questionContext = triggerComment
    ? `\n\n**Request from @${triggerUser || "user"}:**\n${triggerComment}`
    : "";

  const prompt = `You are a software architect creating a visualization of how a proposed change fits into an existing codebase.

## Issue to Visualize
**Title:** ${issueTitle}

**Description:**
${issueBody || "(No description provided)"}${questionContext}

## Existing Codebase Structure
${codeContext}

## Your Task
Create a Mermaid diagram that shows:
1. The existing components that would be affected by this change
2. The new components or modifications that would be introduced
3. How the new changes connect to and interact with existing code

Use this format for your response:

1. First, provide a brief explanation (2-3 sentences) of what the diagram shows.

2. Then provide a Mermaid diagram using one of these formats:
   - flowchart TD (for showing data/control flow)
   - classDiagram (for showing class relationships)
   - graph LR (for showing component connections)

Use these conventions in your diagram:
- Use solid lines for existing relationships
- Use dashed lines (-.->)for new/proposed relationships
- Mark new components with "NEW:" prefix in their labels
- Mark modified components with "MOD:" prefix in their labels

Keep the diagram focused and readable (max 15-20 nodes).
Do NOT use emojis.
Do NOT wrap the mermaid code in markdown code blocks - just output the raw mermaid syntax.`;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.3,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 2048,
      },
    });

    const responseText = response.text?.trim() || "";

    if (!responseText) {
      return createVisualizationErrorResult("No visualization generated");
    }

    // Extract Mermaid diagram from response
    const mermaidMatch = responseText.match(/(flowchart|graph|classDiagram|sequenceDiagram|stateDiagram)[\s\S]*?(?=\n\n|$)/i);
    const mermaidDiagram = mermaidMatch ? mermaidMatch[0].trim() : "";

    // Extract explanation (text before the diagram)
    const explanation = mermaidMatch
      ? responseText.substring(0, responseText.indexOf(mermaidMatch[0])).trim()
      : responseText;

    // Extract affected nodes from diagram
    const affectedNodes: string[] = [];
    const nodeMatches = mermaidDiagram.match(/\[([^\]]+)\]/g);
    if (nodeMatches) {
      for (const match of nodeMatches) {
        const nodeName = match.replace(/[\[\]]/g, "").trim();
        if (nodeName && !affectedNodes.includes(nodeName)) {
          affectedNodes.push(nodeName);
        }
      }
    }

    return {
      comment: formatVisualizationComment(explanation, mermaidDiagram),
      mermaidDiagram,
      affectedNodes: affectedNodes.slice(0, 15),
      analysisTimestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error calling Gemini for visualization:", error);
    return createVisualizationErrorResult("Failed to connect to AI service");
  }
}

/**
 * Format the visualization as a GitHub comment
 */
function formatVisualizationComment(explanation: string, mermaidDiagram: string): string {
  const header = `## Architecture Visualization\n\n`;
  
  let body = "";
  if (explanation) {
    body += explanation + "\n\n";
  }
  
  if (mermaidDiagram) {
    body += "```mermaid\n" + mermaidDiagram + "\n```\n";
  } else {
    body += "*No diagram could be generated for this request.*\n";
  }

  const footer = `\n---\n<sub>Generated by [Monoid](https://monoid.so) | ${new Date().toLocaleDateString()}</sub>`;

  return header + body + footer;
}
