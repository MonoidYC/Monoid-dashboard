import type { Database } from "../database.types";

// Database row types
export type OrgDocRow = Database["public"]["Tables"]["org_docs"]["Row"];
export type OrgDocInsert = Database["public"]["Tables"]["org_docs"]["Insert"];
export type OrgDocUpdate = Database["public"]["Tables"]["org_docs"]["Update"];
export type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
export type RepoRow = Database["public"]["Tables"]["repos"]["Row"];

// Extended doc with org and repo info
export interface OrgDocWithRelations extends OrgDocRow {
  organization: OrganizationRow;
  repo: RepoRow | null;
}

// Autocomplete node for org-wide search
export interface OrgAutocompleteNode {
  id: string;
  name: string;
  nodeType: string;
  filePath: string;
  repoId: string;
  repoName: string;
  matchScore: number;
}

// Create doc input
export interface CreateDocInput {
  organizationId: string;
  title: string;
  slug: string;
  content?: string;
  description?: string;
  repoId?: string | null;
  isPublished?: boolean;
}

// Update doc input
export interface UpdateDocInput {
  title?: string;
  slug?: string;
  content?: string;
  description?: string;
  repoId?: string | null;
  isPublished?: boolean;
  orderIndex?: number;
}

// Generate slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

// Validate slug format
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length > 0 && slug.length <= 100;
}
