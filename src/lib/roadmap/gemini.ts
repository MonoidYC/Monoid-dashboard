import type { NodeLinkSuggestion } from "./types";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message: string;
  };
}

// Suggest node links based on text content
export async function suggestNodeLinks(
  text: string,
  availableNodes: { id: string; name: string; nodeType: string; filePath: string }[],
  apiKey: string
): Promise<NodeLinkSuggestion | null> {
  if (!apiKey) {
    console.error("Gemini API key not provided");
    return null;
  }

  if (!text.trim() || availableNodes.length === 0) {
    return null;
  }

  // Create a concise list of node names with types
  const nodeList = availableNodes
    .slice(0, 100) // Limit to 100 nodes for context window
    .map((n) => `${n.name} (${n.nodeType})`)
    .join(", ");

  const prompt = `You are analyzing a roadmap document for a software project. The user is writing about their codebase and you need to identify if they're referring to any existing code components.

Available code components in this codebase:
${nodeList}

User's current text:
"${text}"

Task: Identify if the user is referring to any of the available code components in their text. If you find a match, respond with ONLY a JSON object in this exact format (no markdown, no code blocks):
{"suggestedNodeName": "ComponentName", "confidence": 0.85, "reason": "Brief explanation"}

If no match is found or confidence is below 0.5, respond with exactly: null

Be strict - only suggest if the text clearly refers to the component by name or describes its exact functionality.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 256,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      return null;
    }

    const data: GeminiResponse = await response.json();

    if (data.error) {
      console.error("Gemini API error:", data.error.message);
      return null;
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!responseText || responseText === "null") {
      return null;
    }

    // Parse the JSON response
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanedResponse = responseText;
      if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      }
      
      const parsed = JSON.parse(cleanedResponse);
      
      if (!parsed.suggestedNodeName || parsed.confidence < 0.5) {
        return null;
      }

      // Find the node ID
      const matchedNode = availableNodes.find(
        (n) => n.name.toLowerCase() === parsed.suggestedNodeName.toLowerCase()
      );

      if (!matchedNode) {
        return null;
      }

      return {
        suggestedNodeName: matchedNode.name,
        nodeId: matchedNode.id,
        confidence: parsed.confidence,
        reason: parsed.reason || "This component matches your description",
      };
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", responseText);
      return null;
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return null;
  }
}

// Batch suggest for multiple paragraphs
export async function suggestNodeLinksForParagraphs(
  paragraphs: string[],
  availableNodes: { id: string; name: string; nodeType: string; filePath: string }[],
  apiKey: string
): Promise<Map<number, NodeLinkSuggestion>> {
  const suggestions = new Map<number, NodeLinkSuggestion>();

  // Process paragraphs in parallel with a limit
  const batchSize = 3;
  for (let i = 0; i < paragraphs.length; i += batchSize) {
    const batch = paragraphs.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((text) => suggestNodeLinks(text, availableNodes, apiKey))
    );

    results.forEach((result, index) => {
      if (result) {
        suggestions.set(i + index, result);
      }
    });
  }

  return suggestions;
}
