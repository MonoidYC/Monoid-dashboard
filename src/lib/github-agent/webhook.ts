import crypto from "crypto";

/**
 * Verify the webhook signature from GitHub
 * GitHub sends a signature in the x-hub-signature-256 header
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(payload).digest("hex");

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(signature)
    );
  } catch {
    // If buffers have different lengths, timingSafeEqual throws
    return false;
  }
}

/**
 * Parse the GitHub event type from headers
 */
export function parseGitHubEvent(eventHeader: string | null): string | null {
  return eventHeader || null;
}

/**
 * Check if this is an issue event we should process
 */
export function shouldProcessIssueEvent(
  event: string | null,
  action: string,
  labelName?: string
): boolean {
  // Only process issue events
  if (event !== "issues") {
    return false;
  }

  // DON'T auto-process new issues - only respond to explicit /monoid commands
  // This prevents unwanted automatic analysis
  // if (action === "opened") {
  //   return true;
  // }

  // Process when specific trigger label is added
  // IMPORTANT: Only trigger on explicit "monoid-analyze" label, NOT "feasibility" labels
  // (since our bot adds "feasibility: X" labels which would cause infinite loops)
  if (action === "labeled" && labelName) {
    const triggerLabels = ["monoid-analyze"];
    return triggerLabels.some(
      (trigger) => labelName.toLowerCase() === trigger
    );
  }

  return false;
}

/**
 * Check if this is an issue comment event we should process
 */
export function shouldProcessCommentEvent(
  event: string | null,
  action: string
): boolean {
  return event === "issue_comment" && action === "created";
}

/**
 * Parse a /monoid or @monoid command from a comment body
 * Returns the command text after the trigger, or null if no command found
 * 
 * Examples:
 *   "/monoid is this feasible?" -> "is this feasible?"
 *   "@monoid analyze this" -> "analyze this"
 *   "Hey team, /monoid can we do this?" -> "can we do this?"
 *   "No command here" -> null
 */
export function parseMonoidCommand(commentBody: string): string | null {
  if (!commentBody) {
    return null;
  }

  // Match /monoid or @monoid followed by optional text
  // The command can appear anywhere in the comment
  const match = commentBody.match(/[/@]monoid\s*(.*?)(?:\n|$)/i);
  
  if (match) {
    const command = match[1].trim();
    // Return the command text, or a default if just "/monoid" or "@monoid" was used
    return command || "analyze feasibility";
  }

  return null;
}

/**
 * Check if the command is a visualization request
 */
export function isVisualizationRequest(command: string): boolean {
  const visualizeKeywords = [
    "visualise",
    "visualize",
    "diagram",
    "chart",
    "graph",
    "mermaid",
    "flow",
    "architecture",
    "show me",
    "draw",
  ];

  const lowerCommand = command.toLowerCase();
  return visualizeKeywords.some((keyword) => lowerCommand.includes(keyword));
}

/**
 * Check if the comment contains a feasibility-related question
 */
export function isFeasibilityRequest(command: string): boolean {
  const feasibilityKeywords = [
    "feasible",
    "feasibility",
    "possible",
    "doable",
    "implement",
    "can we",
    "can this",
    "is this",
    "how hard",
    "how difficult",
    "effort",
    "estimate",
    "analyze",
    "analysis",
  ];

  const lowerCommand = command.toLowerCase();
  return feasibilityKeywords.some((keyword) => lowerCommand.includes(keyword));
}

/**
 * Generate a unique request ID for logging/tracking
 */
export function generateRequestId(): string {
  return `gh-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
