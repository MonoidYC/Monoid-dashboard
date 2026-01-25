import type { GitHubCommentResponse } from "./types";

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Format a PEM private key from environment variable
 * Handles various formats: escaped newlines, base64 encoded, all on one line, etc.
 */
function formatPrivateKey(key: string): string {
  // First, handle escaped newlines (common in env vars)
  let formatted = key.replace(/\\n/g, "\n");
  
  // Extract the key type (RSA PRIVATE KEY or PRIVATE KEY)
  const beginMatch = formatted.match(/-----BEGIN (RSA )?PRIVATE KEY-----/);
  const endMatch = formatted.match(/-----END (RSA )?PRIVATE KEY-----/);
  
  if (beginMatch && endMatch) {
    // Extract just the base64 content between headers
    const beginHeader = beginMatch[0];
    const endHeader = endMatch[0];
    
    // Get content between headers
    const startIdx = formatted.indexOf(beginHeader) + beginHeader.length;
    const endIdx = formatted.indexOf(endHeader);
    let keyContent = formatted.substring(startIdx, endIdx);
    
    // Remove all whitespace from key content
    keyContent = keyContent.replace(/\s/g, "");
    
    // Split into 64-character lines (PEM standard)
    const chunks = keyContent.match(/.{1,64}/g) || [];
    
    // Reconstruct with proper format
    formatted = `${beginHeader}\n${chunks.join("\n")}\n${endHeader}`;
  } else if (!formatted.includes("-----BEGIN")) {
    // No headers at all - assume it's just the base64 content
    const cleanKey = formatted.replace(/\s/g, "");
    const chunks = cleanKey.match(/.{1,64}/g) || [];
    formatted = `-----BEGIN RSA PRIVATE KEY-----\n${chunks.join("\n")}\n-----END RSA PRIVATE KEY-----`;
  }
  
  return formatted;
}

/**
 * Create a JWT for GitHub App authentication
 * This is used to get installation access tokens
 */
async function createAppJWT(): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("GitHub App credentials not configured");
  }

  // JWT header and payload
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // Issued 60 seconds ago to account for clock drift
    exp: now + 600, // Expires in 10 minutes
    iss: appId,
  };

  // Base64url encode
  const base64UrlEncode = (obj: object) => {
    const json = JSON.stringify(obj);
    const base64 = Buffer.from(json).toString("base64");
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);
  const unsignedToken = `${headerEncoded}.${payloadEncoded}`;

  // Sign with private key
  const crypto = await import("crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsignedToken);
  
  // Format the private key properly
  const formattedKey = formatPrivateKey(privateKey);
  
  try {
    const signature = sign.sign(formattedKey, "base64");
    const signatureUrlSafe = signature
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    return `${unsignedToken}.${signatureUrlSafe}`;
  } catch (error) {
    console.error("JWT signing failed. Key format issue. First 50 chars of formatted key:", formattedKey.substring(0, 50));
    throw error;
  }
}

/**
 * Get an installation access token for a specific installation
 */
async function getInstallationToken(installationId: number): Promise<string> {
  const jwt = await createAppJWT();

  const response = await fetch(
    `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get installation token: ${error}`);
  }

  const data = await response.json();
  return data.token;
}

/**
 * Post a comment on a GitHub issue
 */
export async function postIssueComment(params: {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
  installationId: number;
}): Promise<GitHubCommentResponse> {
  const { owner, repo, issueNumber, body, installationId } = params;

  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to post comment: ${error}`);
  }

  return response.json();
}

/**
 * Add a label to an issue
 */
export async function addIssueLabel(params: {
  owner: string;
  repo: string;
  issueNumber: number;
  label: string;
  installationId: number;
}): Promise<void> {
  const { owner, repo, issueNumber, label, installationId } = params;

  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ labels: [label] }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`Failed to add label: ${error}`);
    // Don't throw - label addition is optional
  }
}

/**
 * Get repository contents (for fetching code files if needed)
 */
export async function getRepoContents(params: {
  owner: string;
  repo: string;
  path: string;
  installationId: number;
}): Promise<string | null> {
  const { owner, repo, path, installationId } = params;

  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  // Handle file content (base64 encoded)
  if (data.content && data.encoding === "base64") {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }

  return null;
}
