import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  parseGitHubEvent,
  shouldProcessIssueEvent,
  shouldProcessCommentEvent,
  parseMonoidCommand,
  generateRequestId,
} from "@/lib/github-agent/webhook";
import { analyzeFeasibility } from "@/lib/github-agent/agent";
import { postIssueComment, addIssueLabel } from "@/lib/github-agent/github-client";
import type { 
  IssueWebhookPayload, 
  IssueCommentWebhookPayload,
  FeasibilityAnalysisParams 
} from "@/lib/github-agent/types";

// Use nodejs runtime for crypto operations
export const runtime = "nodejs";

// Increase max duration for analysis (Vercel Pro: up to 60s, Hobby: 10s)
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Received GitHub webhook`);

  try {
    // Get raw payload for signature verification
    const payload = await req.text();
    const signature = req.headers.get("x-hub-signature-256") || "";
    const event = parseGitHubEvent(req.headers.get("x-github-event"));
    const deliveryId = req.headers.get("x-github-delivery") || "unknown";

    console.log(`[${requestId}] Event: ${event}, Delivery: ${deliveryId}`);

    // Verify webhook signature
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error(`[${requestId}] Webhook secret not configured`);
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }

    if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
      console.error(`[${requestId}] Invalid webhook signature`);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse the payload
    const data = JSON.parse(payload);

    // Handle issue_comment events (triggered by /monoid command)
    if (shouldProcessCommentEvent(event, data.action)) {
      const commentData = data as IssueCommentWebhookPayload;
      const { issue, comment, repository, installation } = commentData;

      // Check for /monoid command in the comment
      const monoidCommand = parseMonoidCommand(comment.body);
      
      if (!monoidCommand) {
        console.log(`[${requestId}] No /monoid command found in comment`);
        return NextResponse.json({ message: "No command found", requestId });
      }

      console.log(
        `[${requestId}] /monoid command detected: "${monoidCommand}" on issue #${issue.number}`
      );

      // Validate we have an installation ID
      if (!installation?.id) {
        console.error(`[${requestId}] No installation ID in webhook payload`);
        return NextResponse.json(
          { error: "No installation ID" },
          { status: 400 }
        );
      }

      // Prepare analysis parameters with the trigger comment
      const analysisParams: FeasibilityAnalysisParams = {
        issueNumber: issue.number,
        issueTitle: issue.title,
        issueBody: issue.body || "",
        repoOwner: repository.owner.login,
        repoName: repository.name,
        installationId: installation.id,
        triggerComment: monoidCommand,
        triggerUser: comment.user.login,
      };

      // Run analysis and wait for completion
      // GitHub webhooks have a 10s timeout, but we extend via maxDuration
      await runAnalysisInBackground(analysisParams, requestId);

      return NextResponse.json({
        message: "Analysis complete",
        requestId,
        issueNumber: issue.number,
        trigger: "comment",
        command: monoidCommand,
      });
    }

    // Handle issue events (new issues or labels)
    const issueData = data as IssueWebhookPayload;
    const labelName = issueData.label?.name;
    
    if (!shouldProcessIssueEvent(event, issueData.action, labelName)) {
      console.log(`[${requestId}] Skipping event: ${event}/${issueData.action}`);
      return NextResponse.json({ message: "Event ignored", requestId });
    }

    const { issue, repository, installation } = issueData;

    console.log(
      `[${requestId}] Processing issue #${issue.number}: "${issue.title}" in ${repository.full_name}`
    );

    // Validate we have an installation ID
    if (!installation?.id) {
      console.error(`[${requestId}] No installation ID in webhook payload`);
      return NextResponse.json(
        { error: "No installation ID" },
        { status: 400 }
      );
    }

    // Prepare analysis parameters
    const analysisParams: FeasibilityAnalysisParams = {
      issueNumber: issue.number,
      issueTitle: issue.title,
      issueBody: issue.body || "",
      repoOwner: repository.owner.login,
      repoName: repository.name,
      installationId: installation.id,
    };

    // Run analysis and wait for completion
    await runAnalysisInBackground(analysisParams, requestId);

    return NextResponse.json({
      message: "Analysis complete",
      requestId,
      issueNumber: issue.number,
      trigger: "issue",
    });
  } catch (error) {
    console.error(`[${requestId}] Webhook error:`, error);
    return NextResponse.json(
      { error: "Internal server error", requestId },
      { status: 500 }
    );
  }
}

/**
 * Run the feasibility analysis in the background and post results
 */
async function runAnalysisInBackground(
  params: FeasibilityAnalysisParams,
  requestId: string
): Promise<void> {
  console.log(`[${requestId}] Starting feasibility analysis...`);

  try {
    // Analyze the issue
    const analysis = await analyzeFeasibility(params);

    console.log(
      `[${requestId}] Analysis complete. Score: ${analysis.feasibilityScore}/10, Complexity: ${analysis.estimatedComplexity}`
    );

    // Post the comment to the issue
    if (params.installationId) {
      await postIssueComment({
        owner: params.repoOwner,
        repo: params.repoName,
        issueNumber: params.issueNumber,
        body: analysis.comment,
        installationId: params.installationId,
      });

      console.log(`[${requestId}] Comment posted successfully`);

      // Optionally add a label based on feasibility score
      const labelToAdd = getFeasibilityLabel(analysis.feasibilityScore);
      if (labelToAdd) {
        await addIssueLabel({
          owner: params.repoOwner,
          repo: params.repoName,
          issueNumber: params.issueNumber,
          label: labelToAdd,
          installationId: params.installationId,
        });
        console.log(`[${requestId}] Added label: ${labelToAdd}`);
      }
    }
  } catch (error) {
    console.error(`[${requestId}] Error during analysis:`, error);
    
    // Try to post an error comment
    if (params.installationId) {
      try {
        await postIssueComment({
          owner: params.repoOwner,
          repo: params.repoName,
          issueNumber: params.issueNumber,
          body: `## ⚠️ Feasibility Analysis Failed\n\nAn error occurred while analyzing this issue. Please try again later or contact support.\n\n---\n<sub>Generated by [Monoid](https://monoid.so)</sub>`,
          installationId: params.installationId,
        });
      } catch (commentError) {
        console.error(`[${requestId}] Failed to post error comment:`, commentError);
      }
    }
  }
}

/**
 * Get a label to add based on feasibility score
 */
function getFeasibilityLabel(score: number): string | null {
  if (score >= 8) {
    return "feasibility: high";
  } else if (score >= 5) {
    return "feasibility: medium";
  } else if (score >= 1) {
    return "feasibility: low";
  }
  return null;
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json({
    message: "Monoid GitHub Webhook Endpoint",
    status: "active",
    docs: "https://docs.monoid.so/github-integration",
  });
}
