import { getGitHubRadar } from "@/lib/github-radar";

// GET /api/github-radar
//
// Returns ~10 normalized AI / agent / dev-tool repositories from GitHub's public
// repository search API, or a mock fallback when GitHub is unavailable or rate
// limited. All of the fetch / normalize / fallback logic lives in
// lib/github-radar.ts so this handler stays a thin wrapper.

// Always run at request time — this endpoint fetches live external data.
export const dynamic = "force-dynamic";

export async function GET() {
  // getGitHubRadar never throws: it resolves to mock-fallback on any failure.
  const radar = await getGitHubRadar();
  return Response.json(radar);
}
