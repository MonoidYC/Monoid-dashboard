import { NextRequest, NextResponse } from "next/server";
import { suggestNodeLinks } from "@/lib/roadmap/gemini";
import { getAllNodesForRepo } from "@/lib/roadmap/queries";

export async function POST(request: NextRequest) {
  try {
    const { text, repoId } = await request.json();

    if (!text || !repoId) {
      return NextResponse.json(
        { error: "Missing required fields: text, repoId" },
        { status: 400 }
      );
    }

    // Get API key from environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    // Get available nodes for the repo
    const availableNodes = await getAllNodesForRepo(repoId);

    if (availableNodes.length === 0) {
      return NextResponse.json({ suggestion: null });
    }

    // Get LLM suggestion
    const suggestion = await suggestNodeLinks(text, availableNodes, apiKey);

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("Error in suggest-link API:", error);
    return NextResponse.json(
      { error: "Failed to get suggestion" },
      { status: 500 }
    );
  }
}
