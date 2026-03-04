"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const simple_git_1 = require("simple-git");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const analyzer_core_1 = require("@monoid/analyzer-core");
// ── Configuration ──────────────────────────────────────────────────────
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
function requireEnv(name) {
    const val = process.env[name];
    if (!val) {
        console.error(`❌  Missing required environment variable: ${name}`);
        process.exit(1);
    }
    return val;
}
// ── Supabase client (service-role, bypasses RLS) ───────────────────────
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});
// ── Worker loop ────────────────────────────────────────────────────────
let running = true;
process.on('SIGTERM', () => {
    console.log('🛑  SIGTERM received, shutting down gracefully…');
    running = false;
});
process.on('SIGINT', () => {
    console.log('🛑  SIGINT received, shutting down gracefully…');
    running = false;
});
async function main() {
    console.log('🚀  Monoid ingest worker starting…');
    console.log(`   Supabase URL : ${SUPABASE_URL}`);
    console.log(`   Poll interval: ${POLL_INTERVAL_MS}ms`);
    console.log('');
    while (running) {
        try {
            const job = await claimJob();
            if (job) {
                await processJob(job);
            }
        }
        catch (error) {
            console.error('💥  Unexpected error in poll loop:', error);
        }
        await sleep(POLL_INTERVAL_MS);
    }
    console.log('👋  Worker shut down.');
}
// ── Claim a pending job atomically ─────────────────────────────────────
async function claimJob() {
    // Use RPC for atomic claim (UPDATE … RETURNING with FOR UPDATE SKIP LOCKED)
    const { data, error } = await supabase.rpc('claim_ingest_job');
    if (error) {
        // If the function doesn't exist yet, fall back to a two-step approach
        if (error.code === '42883') {
            return claimJobFallback();
        }
        console.error('Error claiming job via RPC:', error.message);
        return null;
    }
    if (!data || (Array.isArray(data) && data.length === 0)) {
        return null;
    }
    const job = Array.isArray(data) ? data[0] : data;
    console.log(`📋  Claimed job ${job.id} for ${job.owner}/${job.name} (attempt ${job.attempt_count})`);
    return job;
}
/**
 * Fallback claim: SELECT then UPDATE.
 * Not perfectly atomic but works without the RPC function.
 */
async function claimJobFallback() {
    const { data: pending } = await supabase
        .from('ingest_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
    if (!pending)
        return null;
    const { data: claimed, error: updateError } = await supabase
        .from('ingest_jobs')
        .update({
        status: 'running',
        started_at: new Date().toISOString(),
        attempt_count: (pending.attempt_count ?? 0) + 1,
    })
        .eq('id', pending.id)
        .eq('status', 'pending') // optimistic lock
        .select('*')
        .single();
    if (updateError || !claimed)
        return null;
    console.log(`📋  Claimed job ${claimed.id} for ${claimed.owner}/${claimed.name} (attempt ${claimed.attempt_count})`);
    return claimed;
}
// ── Process a single job ───────────────────────────────────────────────
async function processJob(job) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `monoid-ingest-${job.id}-`));
    console.log(`📂  Temp dir: ${tmpDir}`);
    try {
        // 1. Clone the repo
        console.log(`🔄  Cloning ${job.owner}/${job.name} (branch: ${job.branch})…`);
        await cloneRepo(job, tmpDir);
        console.log('✅  Clone complete.');
        // 2. Detect HEAD commit
        const git = (0, simple_git_1.simpleGit)(tmpDir);
        const headCommit = (await git.revparse(['HEAD'])).trim();
        console.log(`📌  HEAD commit: ${headCommit}`);
        // 3. Run analyzer
        console.log('🔬  Running code analysis…');
        const githubInfo = {
            owner: job.owner,
            repo: job.name,
            branch: job.branch,
        };
        const result = await (0, analyzer_core_1.analyzeDirectory)(tmpDir, githubInfo, {
            logger: (msg) => console.log(`   ${msg}`),
            onProgress: (msg, pct) => console.log(`   [${pct.toFixed(0)}%] ${msg}`),
        });
        console.log(`✅  Analysis complete: ${result.nodes.length} nodes, ${result.edges.length} edges`);
        // 4. Create repo_version
        const version = await createVersion(job.repo_id, headCommit, job.branch);
        console.log(`📎  Created version: ${version.id}`);
        // 5. Save nodes
        console.log('💾  Saving nodes…');
        const stableIdToId = await saveNodes(version.id, result.nodes);
        console.log(`   Saved ${stableIdToId.size} nodes.`);
        // 6. Save edges
        console.log('💾  Saving edges…');
        await saveEdges(version.id, result.edges, stableIdToId);
        console.log(`   Saved edges.`);
        // 7. Update version counts
        await updateVersionCounts(version.id, result.nodes.length, result.edges.length);
        // 8. Mark job succeeded
        await markJobSucceeded(job.id, version.id);
        console.log(`🎉  Job ${job.id} succeeded! Version: ${version.id}`);
    }
    catch (error) {
        console.error(`❌  Job ${job.id} failed: ${error?.message || error}`);
        await markJobFailed(job, error?.message || String(error));
    }
    finally {
        // Cleanup temp directory
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
            console.log(`🗑️  Cleaned up ${tmpDir}`);
        }
        catch (e) {
            console.warn(`⚠️  Failed to clean up ${tmpDir}:`, e);
        }
        console.log('');
    }
}
// ── Git clone ──────────────────────────────────────────────────────────
async function cloneRepo(job, targetDir) {
    let repoUrl;
    if (job.github_token) {
        repoUrl = `https://x-access-token:${job.github_token}@github.com/${job.owner}/${job.name}.git`;
    }
    else {
        repoUrl = `https://github.com/${job.owner}/${job.name}.git`;
    }
    const git = (0, simple_git_1.simpleGit)();
    await git.clone(repoUrl, targetDir, [
        '--depth', '1',
        '--branch', job.branch,
        '--single-branch',
    ]);
}
async function createVersion(repoId, commitSha, branch) {
    const { data, error } = await supabase
        .from('repo_versions')
        .insert({ repo_id: repoId, commit_sha: commitSha, branch: branch || 'main' })
        .select()
        .single();
    if (error) {
        throw new Error(`Failed to create version: ${error.message}`);
    }
    return data;
}
async function saveNodes(versionId, nodes) {
    const stableIdToId = new Map();
    const batchSize = 100;
    for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize).map((node) => ({
            version_id: versionId,
            stable_id: node.stable_id,
            name: node.name,
            qualified_name: node.qualified_name,
            node_type: node.node_type,
            language: node.language,
            file_path: node.file_path,
            start_line: node.start_line,
            start_column: node.start_column,
            end_line: node.end_line,
            end_column: node.end_column,
            snippet: node.snippet?.substring(0, 1000),
            signature: node.signature,
            summary: node.summary,
            metadata: node.metadata || {},
            github_link: node.github_link,
        }));
        const { data, error } = await supabase.from('code_nodes').insert(batch).select('id, stable_id');
        if (error) {
            throw new Error(`Failed to save nodes (batch ${i / batchSize + 1}): ${error.message}`);
        }
        data?.forEach((row) => {
            stableIdToId.set(row.stable_id, row.id);
        });
    }
    return stableIdToId;
}
async function saveEdges(versionId, edges, stableIdToId) {
    const validEdges = edges.filter((edge) => stableIdToId.has(edge.source_stable_id) && stableIdToId.has(edge.target_stable_id));
    // Deduplicate edges by source:target:type
    const edgeMap = new Map();
    for (const edge of validEdges) {
        const sourceId = stableIdToId.get(edge.source_stable_id);
        const targetId = stableIdToId.get(edge.target_stable_id);
        const key = `${sourceId}:${targetId}:${edge.edge_type}`;
        if (!edgeMap.has(key)) {
            edgeMap.set(key, {
                source_node_id: sourceId,
                target_node_id: targetId,
                edge_type: edge.edge_type,
                weight: edge.weight || 1,
                metadata: edge.metadata || {},
            });
        }
        else {
            edgeMap.get(key).weight += edge.weight || 1;
        }
    }
    const uniqueEdges = Array.from(edgeMap.values());
    const batchSize = 100;
    for (let i = 0; i < uniqueEdges.length; i += batchSize) {
        const batch = uniqueEdges.slice(i, i + batchSize).map((edge) => ({
            version_id: versionId,
            ...edge,
        }));
        const { error } = await supabase.from('code_edges').insert(batch);
        if (error) {
            throw new Error(`Failed to save edges (batch ${i / batchSize + 1}): ${error.message}`);
        }
    }
}
async function updateVersionCounts(versionId, nodeCount, edgeCount) {
    const { error } = await supabase
        .from('repo_versions')
        .update({ node_count: nodeCount, edge_count: edgeCount })
        .eq('id', versionId);
    if (error) {
        throw new Error(`Failed to update version counts: ${error.message}`);
    }
}
// ── Job state transitions ──────────────────────────────────────────────
async function markJobSucceeded(jobId, versionId) {
    const { error } = await supabase
        .from('ingest_jobs')
        .update({
        status: 'succeeded',
        repo_version_id: versionId,
        finished_at: new Date().toISOString(),
    })
        .eq('id', jobId);
    if (error) {
        console.error(`Failed to mark job ${jobId} as succeeded:`, error.message);
    }
}
async function markJobFailed(job, errorMessage) {
    const newStatus = job.attempt_count >= job.max_attempts ? 'failed' : 'pending';
    const { error } = await supabase
        .from('ingest_jobs')
        .update({
        status: newStatus,
        error: errorMessage.substring(0, 2000),
        finished_at: newStatus === 'failed' ? new Date().toISOString() : null,
    })
        .eq('id', job.id);
    if (error) {
        console.error(`Failed to mark job ${job.id} as ${newStatus}:`, error.message);
    }
    else if (newStatus === 'pending') {
        console.log(`♻️  Job ${job.id} will be retried (${job.attempt_count}/${job.max_attempts})`);
    }
}
// ── Utilities ──────────────────────────────────────────────────────────
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// ── Create the atomic claim RPC if it doesn't exist ────────────────────
async function ensureClaimRpc() {
    // Test if the RPC function exists by calling it
    const result = await supabase.rpc('claim_ingest_job');
    if (result.error) {
        console.log('ℹ️  claim_ingest_job RPC not available, using fallback claim strategy.');
    }
}
// ── Start ──────────────────────────────────────────────────────────────
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map