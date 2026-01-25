// GitHub Agent - Feasibility Analysis for GitHub Issues
// This module provides functionality to analyze GitHub issues
// and post feasibility assessments as comments.

export { analyzeFeasibility, analyzeAndVisualize } from "./agent";
export {
  postIssueComment,
  addIssueLabel,
  getRepoContents,
} from "./github-client";
export {
  verifyWebhookSignature,
  parseGitHubEvent,
  shouldProcessIssueEvent,
  shouldProcessCommentEvent,
  parseMonoidCommand,
  isFeasibilityRequest,
  isVisualizationRequest,
  generateRequestId,
} from "./webhook";
export type {
  GitHubIssue,
  GitHubRepository,
  GitHubLabel,
  GitHubInstallation,
  GitHubComment,
  IssueWebhookPayload,
  IssueCommentWebhookPayload,
  FeasibilityAnalysisParams,
  FeasibilityAnalysisResult,
  VisualizationResult,
  CodeNodeContext,
  GitHubCommentResponse,
} from "./types";
