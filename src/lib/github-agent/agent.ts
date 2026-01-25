import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import type {
  FeasibilityAnalysisParams,
  FeasibilityAnalysisResult,
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

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
Start with an emoji summary:
- ✅ for highly feasible (8-10)
- ⚠️ for moderately feasible (5-7)
- ❌ for low feasibility (1-4)

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
  const header = `## 🤖 Feasibility Analysis\n\n`;
  const footer = `\n\n---\n<sub>📊 Score: **${score}/10** | Generated by [Monoid](https://monoid.so) | ${new Date().toLocaleDateString()}</sub>`;

  return header + analysis + footer;
}

/**
 * Create an error result with a helpful message
 */
function createErrorResult(message: string): FeasibilityAnalysisResult {
  return {
    comment: `## ⚠️ Analysis Unavailable\n\n${message}\n\nPlease ensure the repository has been indexed by Monoid before requesting feasibility analysis.\n\n---\n<sub>Generated by [Monoid](https://monoid.so)</sub>`,
    feasibilityScore: 0,
    estimatedComplexity: "high",
    affectedNodes: [],
    analysisTimestamp: new Date().toISOString(),
  };
}
