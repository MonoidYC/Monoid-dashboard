// GitHub Webhook Event Types

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  user: {
    login: string;
    id: number;
    avatar_url: string;
  };
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
  };
  private: boolean;
  html_url: string;
  default_branch: string;
}

export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

export interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    id: number;
  };
}

export interface IssueWebhookPayload {
  action: "opened" | "edited" | "labeled" | "unlabeled" | "closed" | "reopened";
  issue: GitHubIssue;
  repository: GitHubRepository;
  sender: {
    login: string;
    id: number;
  };
  label?: GitHubLabel; // Present when action is "labeled" or "unlabeled"
  installation?: GitHubInstallation;
}

// Issue Comment Webhook Payload
export interface IssueCommentWebhookPayload {
  action: "created" | "edited" | "deleted";
  issue: GitHubIssue;
  comment: GitHubComment;
  repository: GitHubRepository;
  sender: {
    login: string;
    id: number;
  };
  installation?: GitHubInstallation;
}

export interface GitHubComment {
  id: number;
  body: string;
  user: {
    login: string;
    id: number;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  html_url: string;
}

// Feasibility Analysis Types

export interface FeasibilityAnalysisParams {
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  repoOwner: string;
  repoName: string;
  installationId?: number;
  // Optional: the triggering comment that requested the analysis
  triggerComment?: string;
  triggerUser?: string;
}

export interface FeasibilityAnalysisResult {
  comment: string;
  feasibilityScore: number; // 1-10
  estimatedComplexity: "low" | "medium" | "high";
  affectedNodes: string[];
  analysisTimestamp: string;
}

// Code Node context for analysis
export interface CodeNodeContext {
  id: string;
  name: string;
  nodeType: string;
  filePath: string;
  summary: string | null;
  signature: string | null;
}

// GitHub API Response Types

export interface GitHubCommentResponse {
  id: number;
  html_url: string;
  body: string;
  user: {
    login: string;
    id: number;
  };
  created_at: string;
}

// Gemini API Types (matching existing pattern)

export interface GeminiResponse {
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
