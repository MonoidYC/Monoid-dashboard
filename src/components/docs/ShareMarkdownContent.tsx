"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  searchNodesForOrgAutocomplete,
  searchNodesForRepoAutocomplete,
} from "@/lib/docs";
import { getSupabase } from "@/lib/supabase";

interface ShareMarkdownContentProps {
  htmlContent: string;
  orgId: string;
  repoId: string | null;
}

export function ShareMarkdownContent({
  htmlContent,
  orgId,
  repoId,
}: ShareMarkdownContentProps) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle clicking on node links
  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const nodeLink = target.closest('[data-node-name]') as HTMLElement;

      if (!nodeLink) return;

      e.preventDefault();
      const nodeName = nodeLink.getAttribute("data-node-name");
      if (!nodeName) return;

      // Search for the node
      let nodes;
      if (repoId) {
        nodes = await searchNodesForRepoAutocomplete(repoId, nodeName, 1);
      } else {
        nodes = await searchNodesForOrgAutocomplete(orgId, nodeName, 1);
      }

      if (nodes.length === 0) {
        alert(
          `Node "${nodeName}" not found. Make sure the component exists in the codebase.`
        );
        return;
      }

      const node = nodes[0];

      // If doc has a specific repo, we can go directly to the graph
      // Otherwise, we need to find the version for this node's repo
      if (node.repoId) {
        // Get the latest version for this repo
        const supabase = getSupabase();

        const { data: version } = await supabase
          .from("repo_versions")
          .select("id")
          .eq("repo_id", node.repoId)
          .order("ingested_at", { ascending: false })
          .limit(1)
          .single() as { data: { id: string } | null };

        if (version) {
          router.push(`/graph/${version.id}?highlight=${node.id}`);
        } else {
          alert(`No version found for repository containing "${nodeName}"`);
        }
      }
    },
    [repoId, orgId, router]
  );

  return (
    <div
      ref={contentRef}
      className="markdown-preview"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
