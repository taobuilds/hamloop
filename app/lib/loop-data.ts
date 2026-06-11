// Static data + design tokens for the HamLoop app.
// Ported from the original design handoff — mock data only,
// no backend, no API calls.

export type TaskType =
  | "Build"
  | "GitHub"
  | "Skill Test"
  | "Learning"
  | "Review"
  | "Health"
  | "Life"
  | "Admin";

export type TaskStatus = "candidate" | "today" | "skippedToday" | "done";

export interface Task {
  id: string;
  title: string;
  reason: string;
  min: number;
  type: TaskType;
  energy: "Low" | "Medium" | "High";
  steps: string[];
  commit?: string;
  status: TaskStatus;
}

export type ToolStatus = "New" | "Viewed" | "Saved";

export interface RadarTool {
  id: string;
  name: string;
  cat: string;
  desc: string;
  today: number;
  stars: string;
  what: string;
  why: string;
  how: string;
  test: string;
  install: string;
  example: string;
}

export type LibStatus = "Saved" | "Testing" | "Useful" | "Archived";

export interface LibraryItem {
  id: string;
  tool: string;
  cat: string;
  status: LibStatus;
  why: string;
  next: string;
  install: string;
  example: string;
}

export type ThemeName = "Daybreak" | "Tide";

export interface Theme {
  bg: string;
  btn: string;
  solid: string;
  softBg: string;
  softBd: string;
  done: { bg: string; bd: string; label: string; check: string };
  navBg: string;
  navBorder: string;
}

// Each theme couples a background, its matching gradient button, a solid
// accent (dots / ring / bars / active tab) and an adaptive frosted
// bottom-bar tint — picking a theme sets everything in one move.
export const THEMES: Record<ThemeName, Theme> = {
  Daybreak: {
    bg: "linear-gradient(180deg, #E2ECF8 0%, #EFEAE8 52%, #FBEEDE 100%)",
    btn: "linear-gradient(135deg, #84A4E8 0%, #F0A88E 100%)",
    solid: "#C76A56",
    softBg: "#F4E7DC",
    softBd: "rgba(176,108,80,0.18)",
    done: { bg: "#F6E7DD", bd: "rgba(199,106,86,0.40)", label: "#A85138", check: "#C76A56" },
    navBg: "linear-gradient(180deg, rgba(238,234,232,0.52) 0%, rgba(251,238,222,0.80) 100%)",
    navBorder: "rgba(224,130,94,0.30)",
  },
  Tide: {
    bg: "linear-gradient(180deg, #DEEDF0 0%, #ECEDE6 52%, #F8EFE2 100%)",
    btn: "linear-gradient(135deg, #64BFAD 0%, #DDB969 100%)",
    solid: "#5E9277",
    softBg: "#E7EEE9",
    softBd: "rgba(70,120,100,0.18)",
    done: { bg: "#E3F0E7", bd: "rgba(90,160,117,0.40)", label: "#3E7A56", check: "#5AA075" },
    navBg: "linear-gradient(180deg, rgba(236,237,230,0.52) 0%, rgba(248,239,226,0.80) 100%)",
    navBorder: "rgba(62,155,139,0.30)",
  },
};

// [text, badge background] per task type
export const TYPE_COLORS: Record<TaskType, [string, string]> = {
  Build: ["#BE5E37", "#F4E4DA"],
  GitHub: ["#5C6657", "#E8EBE2"],
  "Skill Test": ["#6E72C8", "#E8E9F7"],
  Learning: ["#4E8AA8", "#E1EEF4"],
  Review: ["#5AA075", "#E3F0E7"],
  Health: ["#3E9B8B", "#DFF0EC"],
  Life: ["#C29A3A", "#F6EED8"],
  Admin: ["#8A8E84", "#ECEDE8"],
};

export const RADAR_CHIP_COLORS: Record<ToolStatus, [string, string]> = {
  New: ["#BE5E37", "#F4E4DA"],
  Viewed: ["#8A8E84", "#ECEDE8"],
  Saved: ["#5AA075", "#E3F0E7"],
};

export const LIB_CHIP_COLORS: Record<LibStatus, [string, string]> = {
  Saved: ["#8A8E84", "#ECEDE8"],
  Testing: ["#6E72C8", "#E8E9F7"],
  Useful: ["#5AA075", "#E3F0E7"],
  Archived: ["#ABAC9F", "#F1F1EA"],
};

export const SEED_CANDIDATES: Task[] = [
  { id: "c1", title: "Create Skill Library page", reason: "Next step for HamLoop", min: 45, type: "Build", energy: "High", steps: ["Open the right file", "Make one small change", "Test locally", "Commit the change"], commit: "add skill library page", status: "candidate" },
  { id: "c2", title: "Make one GitHub commit", reason: "Keep the public building record alive", min: 10, type: "GitHub", energy: "Low", steps: ["Pick the smallest change", "Commit and push"], commit: "small daily commit", status: "candidate" },
  { id: "c3", title: "Test Claude Code on one small task", reason: "Improve coding workflow", min: 30, type: "Skill Test", energy: "Medium", steps: ["Pick one tiny task", "Run it with Claude Code", "Note what worked"], status: "candidate" },
  { id: "c4", title: "Write a short daily review", reason: "Feed tomorrow's plan", min: 5, type: "Review", energy: "Low", steps: ["Open the Review tab", "One line per prompt"], status: "candidate" },
  { id: "c5", title: "Go for a run", reason: "Reset energy and mental health", min: 30, type: "Health", energy: "Medium", steps: ["Shoes on", "Out the door"], status: "candidate" },
  { id: "c6", title: "Read one Agents SDK doc page", reason: "Sharpen the toolkit", min: 20, type: "Learning", energy: "Low", steps: ["Open the docs", "Read one page", "Save one idea"], status: "candidate" },
  { id: "c7", title: "Sketch the Review screen", reason: "Prep tomorrow's build", min: 25, type: "Build", energy: "Medium", steps: ["Paper or canvas open", "Three rough frames"], commit: "sketch review screen", status: "candidate" },
  { id: "c8", title: "Try Promptfoo on one prompt", reason: "From your skill library", min: 20, type: "Skill Test", energy: "Medium", steps: ["Install promptfoo", "Eval one prompt"], status: "candidate" },
  { id: "c9", title: "Reply to two emails", reason: "Clear the deck", min: 15, type: "Admin", energy: "Low", steps: ["Inbox — top two only"], status: "candidate" },
  { id: "c10", title: "Tidy desk for ten minutes", reason: "Lighter space, lighter head", min: 10, type: "Life", energy: "Low", steps: ["Set a ten minute window", "Surfaces only"], status: "candidate" },
];

export const RADAR_TOOLS: RadarTool[] = [
  { id: "g1", name: "Last30Days Skill", cat: "Research", desc: "Scan what shipped in AI in the last 30 days.", today: 312, stars: "4.1k", what: "Searches and summarizes the last 30 days of AI releases on any topic.", why: "Keeps your radar current without doomscrolling.", how: "Run it on one focused research question each week.", test: "Test Last30Days on one AI product research question", install: "npx last30days init", example: 'last30days "voice agents"' },
  { id: "g2", name: "Claude Code", cat: "Coding agent", desc: "Agentic coding from your terminal.", today: 189, stars: "38k", what: "An agent that reads, edits and tests your codebase from the CLI.", why: "Turns vague tasks into shipped commits.", how: "Give it one small, well-scoped task at a time.", test: "Refactor one file with Claude Code", install: "npm i -g @anthropic-ai/claude-code", example: 'claude "fix the failing test"' },
  { id: "g3", name: "Codex", cat: "Coding agent", desc: "Software engineering agent for multi-step tasks.", today: 84, stars: "33k", what: "Plans and executes multi-step coding tasks against a repo.", why: "A good second opinion on hard refactors.", how: "Compare its diff with your own approach.", test: "Run Codex on one small bug ticket", install: "npm i -g @openai/codex", example: 'codex "triage issue #42"' },
  { id: "g4", name: "OpenAI Agents SDK", cat: "Agents", desc: "Build multi-agent workflows in Python.", today: 95, stars: "22k", what: "Primitives for handoffs, guardrails and tracing between agents.", why: "Cleanest way to chain small agents together.", how: "Wrap one existing script as an agent first.", test: "Build a two-agent hello world", install: "pip install openai-agents", example: "python agents_demo.py" },
  { id: "g5", name: "Vercel AI SDK", cat: "AI workflows", desc: "TypeScript toolkit for AI-powered apps.", today: 71, stars: "31k", what: "Streaming, tool calls and UI hooks for TypeScript apps.", why: "Fastest path from prompt to product UI.", how: "Add one streaming endpoint to HamLoop.", test: "Stream one completion into a page", install: "npm i ai", example: 'import { streamText } from "ai"' },
  { id: "g6", name: "Gemini CLI", cat: "Coding agent", desc: "Terminal coding agent with a huge context window.", today: 66, stars: "45k", what: "Free-tier agentic CLI that can hold very large repos in context.", why: "Useful for whole-repo questions.", how: "Point it at a repo you do not know yet.", test: "Summarize one unfamiliar repo", install: "npm i -g @google/gemini-cli", example: 'gemini "explain this repo"' },
  { id: "g7", name: "MCP Server Collection", cat: "MCP", desc: "Curated Model Context Protocol servers.", today: 58, stars: "12k", what: "Ready-made MCP servers for files, browsers and APIs.", why: "Plug new capabilities into agents fast.", how: "Add one server to your agent config.", test: "Wire the filesystem MCP into Claude", install: "npx @mcp/server-fs", example: "mcp add filesystem" },
  { id: "g8", name: "Awesome AI Agents", cat: "List", desc: "Large curated list of AI agents.", today: 44, stars: "18k", what: "Hundreds of agents sorted by category, updated weekly.", why: "A reliable source of radar candidates.", how: "Skim one category per week, save one tool.", test: "Pick one new agent to try", install: "— (browse the README)", example: "open the repo, skim one section" },
  { id: "g9", name: "Promptfoo", cat: "Evaluation", desc: "Test and eval your prompts like code.", today: 39, stars: "7.2k", what: "Batch-evaluates prompts against fixtures and assertions.", why: "Catches prompt regressions before users do.", how: "Eval your review-generation prompt.", test: "Eval one prompt with five cases", install: "npm i -g promptfoo", example: "promptfoo eval" },
  { id: "g10", name: "Continue", cat: "Dev plugin", desc: "Open-source AI assistant inside your IDE.", today: 27, stars: "26k", what: "Editor assistant with custom model and prompt support.", why: "Keeps AI help inside the editor flow.", how: "Map one shortcut to a custom prompt.", test: "Set up one custom Continue command", install: "code --install-extension continue.continue", example: "cmd-I to edit the selection" },
];

export const SEED_LIBRARY: LibraryItem[] = [
  { id: "l1", tool: "Claude Code", cat: "Coding agent", status: "Testing", why: "Core daily coding tool.", next: "Refactor one file with Claude Code", install: "npm i -g @anthropic-ai/claude-code", example: 'claude "fix the failing test"' },
  { id: "l2", tool: "Last30Days Skill", cat: "Research", status: "Saved", why: "Weekly AI research routine.", next: "Run one research question", install: "npx last30days init", example: 'last30days "voice agents"' },
  { id: "l3", tool: "Promptfoo", cat: "Evaluation", status: "Useful", why: "Caught a prompt regression in v2.", next: "Eval the review prompt", install: "npm i -g promptfoo", example: "promptfoo eval" },
];

export const BASICS = [
  { id: "b1", label: "Morning meds" },
  { id: "b2", label: "Drink water" },
  { id: "b3", label: "Stretch / move" },
  { id: "b4", label: "Review the plan" },
] as const;

// Mock "generate tomorrow's tasks" output — these become tomorrow
// morning's swipe cards after the day rolls over.
export const GEN_TASKS: { title: string; type: TaskType; min: number; steps: string[]; commit?: string }[] = [
  { title: "Polish Skill Library empty state", type: "Build", min: 40, steps: ["Open the right file", "Make one small change", "Test locally", "Commit the change"], commit: "polish skill library empty state" },
  { title: "Make one GitHub commit", type: "GitHub", min: 10, steps: ["Pick the smallest change", "Commit and push"], commit: "small daily commit" },
  { title: "Test Last30Days on one question", type: "Skill Test", min: 25, steps: ["Open Last30Days", "Run one small test", "Note what worked"] },
  { title: "Go for a run", type: "Health", min: 30, steps: ["Shoes on", "Out the door"] },
  { title: "Write a short daily review", type: "Review", min: 5, steps: ["Open the Review tab", "One line per prompt"] },
];

export const REVIEW_PROMPTS = [
  "Today I built",
  "Today I learned",
  "Today I shipped",
  "What blocked me",
  "Tomorrow I will",
] as const;
