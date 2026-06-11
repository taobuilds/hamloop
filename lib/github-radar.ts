// GitHub Radar — server-side discovery of interesting AI / agent / dev-tool repos.
//
// Queries GitHub's public repository Search API across a fixed set of topics,
// keeping only repos created in the last RECENT_DAYS, then ranks them by recent
// star velocity (a "trending" approximation, since GitHub has no Trending API)
// and returns the hottest ~10. If GitHub is unreachable, rate-limited, or
// unhelpful, a hand-curated mock list is returned so the endpoint always responds.
//
// No dependencies and no auth required. If a GITHUB_TOKEN env var happens to be
// set it is used to raise the rate limit (10 → 30 search requests/min), but it
// is entirely optional — the radar works unauthenticated.

export type RadarSource = "github-search-api" | "mock-fallback";

/** A single normalized tool in the radar response. */
export interface RadarTool {
  id: string;
  name: string;
  category: string;
  description: string;
  url: string;
  stars: number;
  language: string | null;
  topics: string[];
  source: "github";
  status: "new";
  whyRelevant: string;
  suggestedTestTask: string;
  createdAt: string;
  updatedAt: string;
}

export interface RadarResponse {
  generatedAt: string;
  source: RadarSource;
  tools: RadarTool[];
}

// Each search topic maps to the category its results are filed under. The set
// mirrors HamLoop's interests: agents, coding agents, dev tooling, MCP, AI
// workflows, evaluation and productivity.
const SEARCH_TOPICS: { query: string; category: string }[] = [
  { query: "AI agent", category: "Agent Framework" },
  { query: "coding agent", category: "Coding Agent" },
  { query: "LLM tools", category: "Developer Workflow" },
  { query: "MCP server", category: "MCP Tooling" },
  { query: "AI productivity", category: "Productivity Tool" },
  { query: "developer workflow", category: "Developer Workflow" },
  { query: "prompt evaluation", category: "Evaluation Tool" },
  { query: "AI coding assistant", category: "Coding Agent" },
];

const PER_TOPIC = 10; // results fetched per topic before ranking
const MAX_TOOLS = 10; // final cap on the returned list
const MIN_STARS = 10; // floor to filter out noise (recent repos start small)
const RECENT_DAYS = 30; // only repos created within this window count as recent
const PER_CATEGORY = 3; // cap per category in the final list, for variety

// The slice of GitHub's search response we actually depend on.
interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  topics?: string[];
  created_at: string;
  forks_count: number;
}

interface GitHubSearchResponse {
  items?: GitHubRepo[];
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    // GitHub rejects requests without a User-Agent with a 403.
    "User-Agent": "hamloop-github-radar",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

type Topic = { query: string; category: string };
type RepoHit = { repo: GitHubRepo; topic: Topic };

/** YYYY-MM-DD cutoff: repos created on/after this date count as recent. */
function recentSince(): string {
  return new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10);
}

// "Hotness" approximates trending without a star-history API: stars accrued per
// day since the repo was created. A 3-day-old repo with 300 stars (100/day)
// outranks a 28-day-old repo with 500 stars (~18/day).
function ageInDays(repo: GitHubRepo): number {
  return Math.max(1, Math.round((Date.now() - Date.parse(repo.created_at)) / 86_400_000));
}

function hotness(repo: GitHubRepo): number {
  return repo.stargazers_count / ageInDays(repo);
}

/** Search one topic for recent, popular repos. Throws on a non-OK response. */
async function searchTopic(topic: Topic): Promise<RepoHit[]> {
  const q = encodeURIComponent(`${topic.query} created:>${recentSince()} stars:>${MIN_STARS}`);
  const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${PER_TOPIC}`;

  const res = await fetch(url, { headers: githubHeaders(), cache: "no-store" });
  if (!res.ok) {
    // Rate limit (403/429) or any other error — let the caller treat this
    // topic as failed via Promise.allSettled.
    throw new Error(`GitHub search failed for "${topic.query}" (${res.status})`);
  }

  const data = (await res.json()) as GitHubSearchResponse;
  return (data.items ?? []).map((repo) => ({ repo, topic }));
}

function normalizeRepo(repo: GitHubRepo, topic: Topic): RadarTool {
  const now = new Date().toISOString();
  const days = ageInDays(repo);
  const perDay = Math.max(1, Math.round(repo.stargazers_count / days));
  return {
    // id is derived from full_name, so it doubles as the de-dupe key.
    id: `github:${repo.full_name}`,
    name: repo.name,
    category: topic.category,
    description: repo.description?.trim() || "No description provided.",
    url: repo.html_url,
    stars: repo.stargazers_count,
    language: repo.language,
    topics: repo.topics ?? [],
    source: "github",
    status: "new",
    whyRelevant: `Rising ${topic.category.toLowerCase()} — ${repo.stargazers_count} stars, created ${days}d ago (~${perDay}/day). Matched "${topic.query}".`,
    suggestedTestTask: suggestTestTask(repo.name, topic.category),
    createdAt: now,
    updatedAt: now,
  };
}

/** A short, category-aware "try it today" prompt. */
function suggestTestTask(name: string, category: string): string {
  switch (category) {
    case "Coding Agent":
    case "Agent Framework":
      return `Point ${name} at one small, well-scoped task and review what it produces.`;
    case "MCP Tooling":
      return `Wire ${name} into your agent setup and call it once.`;
    case "Evaluation Tool":
      return `Run ${name} on one prompt with a few test cases.`;
    case "AI App Framework":
      return `Build a tiny hello-world with ${name}.`;
    case "Research Tool":
      return `Run ${name} on one focused research question.`;
    default:
      return `Try ${name} on one real task today and note what worked.`;
  }
}

/** Keep the first occurrence of each repo, keyed by full_name. */
function dedupeHits(hits: RepoHit[]): RepoHit[] {
  const byName = new Map<string, RepoHit>();
  for (const hit of hits) {
    if (!byName.has(hit.repo.full_name)) byName.set(hit.repo.full_name, hit);
  }
  return [...byName.values()];
}

const LIST_RE = /awesome|roadmap|tutorial|interview|cheat-?sheet|free-?courses?/i;

// Light quality gate: keep repos that look like real, usable tools. Filters out
// empty repos, "awesome"/learning-list repos, and the zero-fork star-farm
// pattern (lots of stars but almost nobody actually using it).
function isQuality(repo: GitHubRepo): boolean {
  const hasDescription = !!repo.description && repo.description.trim().length > 0;
  const isList = LIST_RE.test(repo.full_name) || (repo.topics ?? []).some((t) => /awesome|list/i.test(t));
  return hasDescription && !isList && repo.forks_count >= 3;
}

// Take up to `max` hits (already ranked best-first) while capping how many come
// from any single category, so one broad query can't fill the whole list.
// Backfills with the next-best if the caps leave us short.
function pickDiverse(hits: RepoHit[], max: number, perCategory: number): RepoHit[] {
  const counts = new Map<string, number>();
  const picked: RepoHit[] = [];
  for (const hit of hits) {
    if (picked.length >= max) break;
    const used = counts.get(hit.topic.category) ?? 0;
    if (used >= perCategory) continue;
    counts.set(hit.topic.category, used + 1);
    picked.push(hit);
  }
  if (picked.length < max) {
    for (const hit of hits) {
      if (picked.length >= max) break;
      if (!picked.includes(hit)) picked.push(hit);
    }
  }
  return picked;
}

/**
 * Fetch the radar. Always resolves: on any failure, rate limit, or empty result
 * set it returns the mock fallback instead of throwing.
 */
export async function getGitHubRadar(): Promise<RadarResponse> {
  const generatedAt = new Date().toISOString();

  try {
    const settled = await Promise.allSettled(SEARCH_TOPICS.map(searchTopic));
    const hits = settled
      .filter((r): r is PromiseFulfilledResult<RepoHit[]> => r.status === "fulfilled")
      .flatMap((r) => r.value);

    // Drop low-quality / likely star-farmed repos, rank by recent star velocity
    // (trending approximation), then take a category-diverse top slice.
    const ranked = dedupeHits(hits)
      .filter((hit) => isQuality(hit.repo))
      .sort((a, b) => hotness(b.repo) - hotness(a.repo));
    const tools = pickDiverse(ranked, MAX_TOOLS, PER_CATEGORY).map((hit) =>
      normalizeRepo(hit.repo, hit.topic),
    );

    if (tools.length === 0) {
      // Every topic failed or returned nothing useful.
      return buildMockResponse(generatedAt);
    }
    return { generatedAt, source: "github-search-api", tools };
  } catch {
    return buildMockResponse(generatedAt);
  }
}

// --- Mock fallback --------------------------------------------------------
// A small, hand-picked set of real ecosystem repos used when the live API is
// unavailable. Star counts are approximate snapshots, not live values — daily
// star tracking is a later sprint.

const MOCK_TOOLS_BASE: Array<{
  full_name: string;
  name: string;
  category: string;
  description: string;
  stars: number;
  language: string | null;
  topics: string[];
}> = [
  { full_name: "Significant-Gravitas/AutoGPT", name: "AutoGPT", category: "Agent Framework", description: "An experimental open-source attempt to make GPT-4 fully autonomous.", stars: 168000, language: "Python", topics: ["ai", "agents", "autonomous", "gpt-4"] },
  { full_name: "langchain-ai/langchain", name: "langchain", category: "AI App Framework", description: "Build context-aware reasoning applications with LLMs.", stars: 95000, language: "Python", topics: ["llm", "ai", "framework", "agents"] },
  { full_name: "geekan/MetaGPT", name: "MetaGPT", category: "Agent Framework", description: "The multi-agent framework: given one line of requirement, return PRD, design, and tasks.", stars: 45000, language: "Python", topics: ["multi-agent", "llm", "agents"] },
  { full_name: "OpenInterpreter/open-interpreter", name: "open-interpreter", category: "Coding Agent", description: "A natural language interface for computers.", stars: 52000, language: "Python", topics: ["interpreter", "llm", "coding"] },
  { full_name: "Aider-AI/aider", name: "aider", category: "Coding Agent", description: "AI pair programming in your terminal.", stars: 24000, language: "Python", topics: ["cli", "coding-assistant", "llm"] },
  { full_name: "continuedev/continue", name: "continue", category: "Developer Workflow", description: "The leading open-source AI code assistant inside your IDE.", stars: 20000, language: "TypeScript", topics: ["ide", "vscode", "copilot", "ai"] },
  { full_name: "modelcontextprotocol/servers", name: "servers", category: "MCP Tooling", description: "Model Context Protocol reference servers.", stars: 20000, language: "TypeScript", topics: ["mcp", "model-context-protocol", "tools"] },
  { full_name: "langgenius/dify", name: "dify", category: "AI App Framework", description: "Open-source LLM app development platform with an intuitive interface.", stars: 50000, language: "TypeScript", topics: ["llmops", "workflow", "rag", "agents"] },
  { full_name: "promptfoo/promptfoo", name: "promptfoo", category: "Evaluation Tool", description: "Test and evaluate LLM prompts, agents, and RAG; red-teaming and benchmarking.", stars: 5500, language: "TypeScript", topics: ["evaluation", "testing", "llm", "prompts"] },
  { full_name: "danny-avila/LibreChat", name: "LibreChat", category: "Productivity Tool", description: "Enhanced ChatGPT clone with agents, multiple AI providers, and more.", stars: 20000, language: "TypeScript", topics: ["chatgpt", "ai", "productivity", "agents"] },
];

function buildMockResponse(generatedAt: string): RadarResponse {
  const tools: RadarTool[] = MOCK_TOOLS_BASE.map((m) => ({
    id: `github:${m.full_name}`,
    name: m.name,
    category: m.category,
    description: m.description,
    url: `https://github.com/${m.full_name}`,
    stars: m.stars,
    language: m.language,
    topics: m.topics,
    source: "github",
    status: "new",
    whyRelevant: `Hand-picked ${m.category.toLowerCase()} from the AI tooling ecosystem (${m.stars} stars).`,
    suggestedTestTask: suggestTestTask(m.name, m.category),
    createdAt: generatedAt,
    updatedAt: generatedAt,
  }));
  return { generatedAt, source: "mock-fallback", tools };
}
