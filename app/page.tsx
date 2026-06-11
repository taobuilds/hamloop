// TaoStack — Day 1 prototype. Hardcoded data only: no auth, no database,
// no API calls, no new dependencies.

const todaysFocus = [
  "Build the first TaoStack dashboard",
  "Make one GitHub commit",
  "Write a short daily review",
];

const projectAreas = [
  {
    name: "AI Builder System",
    description:
      "A personal system for planning, learning, shipping, and managing my build process.",
    status: "Active",
    nextStep: "Build the first dashboard.",
  },
  {
    name: "Health Data Visualization",
    description:
      "Exploring how AI and visualization can help people and teams understand complex health-related data.",
    status: "Exploring",
    nextStep: "Collect examples and define one possible B2B use case.",
  },
  {
    name: "Creative Workflow Tools",
    description:
      "Exploring AI tools that support designers, creators, and media workflows.",
    status: "Exploring",
    nextStep: "Map possible workflows and user pain points.",
  },
  {
    name: "Agent Skills & Tooling",
    description:
      "Exploring Claude Code, Codex, GitHub skills, and agent workflows for building faster.",
    status: "Learning",
    nextStep: "Create a first skill library.",
  },
];

const githubChecklist = [
  "Check git status",
  "Make one small commit",
  "Push to GitHub",
  "Update README or notes",
];

const skillLibrary = [
  {
    name: "Claude Code",
    type: "Coding agent",
    useCase:
      "Local coding partner for editing, debugging, and understanding code.",
    status: "Learning",
  },
  {
    name: "Codex",
    type: "Coding agent",
    useCase:
      "Cloud coding agent for clear engineering tasks and PR-style workflows.",
    status: "Learning",
  },
  {
    name: "Last30Days Skill",
    type: "Research skill",
    useCase:
      "Research recent signals across social platforms, GitHub, and the web.",
    status: "Saved for testing",
    source: "https://github.com/mvanhorn/last30days-skill",
  },
  {
    name: "Vercel AI SDK",
    type: "AI app framework",
    useCase: "Build AI-powered web apps and agent workflows.",
    status: "Planned",
  },
  {
    name: "OpenAI Agents SDK",
    type: "Agent framework",
    useCase: "Build tool-using, multi-step AI agents.",
    status: "Planned",
  },
];

const learningTracks = [
  {
    name: "Full-stack development",
    currentFocus: "Next.js App Router patterns",
    dailyMinimum: "30 min of hands-on coding",
    weeklyGoal: "Ship one small feature",
  },
  {
    name: "AI agents",
    currentFocus: "Agent loops and tool use",
    dailyMinimum: "Read or test one agent example",
    weeklyGoal: "Build one working agent demo",
  },
  {
    name: "GitHub workflow",
    currentFocus: "Daily commits and clean messages",
    dailyMinimum: "One commit pushed",
    weeklyGoal: "Five green days on the graph",
  },
  {
    name: "English technical reading",
    currentFocus: "Framework docs and changelogs",
    dailyMinimum: "15 min of docs reading",
    weeklyGoal: "Summarize one article in my notes",
  },
  {
    name: "Product thinking",
    currentFocus: "Problem framing and user pain points",
    dailyMinimum: "Write down one observation",
    weeklyGoal: "Sketch one product hypothesis",
  },
  {
    name: "Finance",
    currentFocus: "Basics of SaaS business models",
    dailyMinimum: "10 min of reading",
    weeklyGoal: "One note on pricing or costs",
  },
  {
    name: "Japanese",
    currentFocus: "Core vocabulary and listening",
    dailyMinimum: "10 min of practice",
    weeklyGoal: "Finish one lesson unit",
  },
];

const dailyReviewPrompts = [
  { prompt: "Today I built:", placeholder: "The first TaoStack dashboard layout." },
  { prompt: "Today I learned:", placeholder: "How small scope keeps shipping possible." },
  { prompt: "Today I shipped:", placeholder: "One commit pushed to GitHub." },
  { prompt: "What blocked me:", placeholder: "Too many ideas competing for attention." },
  { prompt: "Tomorrow I will:", placeholder: "Pick one next step and finish it." },
];

const pipelineStages = [
  "Raw idea",
  "Researching",
  "Prototype candidate",
  "Paused",
  "Shipped",
];

const ideas = [
  { name: "AI tools for health data understanding", stage: "Researching" },
  { name: "AI agents for creative workflows", stage: "Raw idea" },
  { name: "Personal AI workspace for builders", stage: "Prototype candidate" },
  { name: "Synthetic user simulation for product testing", stage: "Raw idea" },
];

const roadmap = [
  {
    phase: "Phase 1",
    title: "Static dashboard",
    items: [
      "Homepage",
      "Project area cards",
      "Skill library",
      "GitHub habit",
      "Daily review",
      "Idea pipeline",
    ],
    current: true,
  },
  {
    phase: "Phase 2",
    title: "Local inputs",
    items: [
      "Add project area",
      "Add idea",
      "Add skill",
      "Add daily review",
      "Store data in localStorage",
    ],
  },
  {
    phase: "Phase 3",
    title: "Database",
    items: [
      "Supabase",
      "Project areas table",
      "Ideas table",
      "Skills table",
      "Daily logs table",
      "GitHub logs table",
    ],
  },
  {
    phase: "Phase 4",
    title: "AI assistant",
    items: [
      "Generate today's plan",
      "Break down tasks",
      "Suggest commit messages",
      "Summarize weekly progress",
      "Help decide which idea to prototype next",
    ],
  },
  {
    phase: "Phase 5",
    title: "Integrations",
    items: [
      "GitHub API",
      "Agent skill runner",
      "Research tools",
      "AI tool log",
    ],
  },
];

const coreLoop = ["Plan", "Build", "Commit", "Learn", "Review", "Ship"];

const statusStyles: Record<string, string> = {
  Active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  Exploring: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  Learning: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  "Saved for testing": "border-amber-500/30 bg-amber-500/10 text-amber-400",
  Planned: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  Researching: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  "Raw idea": "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  "Prototype candidate":
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  Paused: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  Shipped: "border-violet-500/30 bg-violet-500/10 text-violet-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${
        statusStyles[status] ?? statusStyles.Planned
      }`}
    >
      {status}
    </span>
  );
}

function Section({
  index,
  title,
  purpose,
  children,
}: {
  index: string;
  title: string;
  purpose?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14 sm:mt-20">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-zinc-600">{index}</span>
        <h2 className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
          {title}
        </h2>
      </div>
      {purpose && (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          {purpose}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-full flex-1">
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-12 sm:px-8 sm:pt-16 lg:px-10">
        {/* 1. Hero */}
        <header>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
              TaoStack
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Day 1 Prototype
            </span>
          </div>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">
            My personal AI workspace for building, learning, shipping, and
            running agent skills.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base sm:leading-7">
            A system for turning ambitious goals into daily shipped work
            through experiments, learning loops, GitHub habits, and
            reflection.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-zinc-500 sm:text-sm">
            {coreLoop.map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                <span className="text-zinc-400">{step}</span>
                {i < coreLoop.length - 1 && (
                  <span className="text-zinc-700">→</span>
                )}
              </span>
            ))}
          </div>
          <p className="mt-6 font-mono text-sm text-emerald-400">
            Small loops compound.
          </p>
        </header>

        {/* 2. Today's Focus */}
        <Section
          index="01"
          title="Today's Focus"
          purpose="The three actions that matter today. Everything else can wait."
        >
          <Card>
            <ol className="space-y-3">
              {todaysFocus.map((task, i) => (
                <li key={task} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 font-mono text-xs text-zinc-400">
                    {i + 1}
                  </span>
                  <span className="text-sm text-zinc-200 sm:text-base">
                    {task}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </Section>

        {/* 3. Project Areas */}
        <Section
          index="02"
          title="Project Areas"
          purpose="Flexible areas to explore — not committed products yet."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {projectAreas.map((area) => (
              <Card key={area.name}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-medium text-zinc-50">
                    {area.name}
                  </h3>
                  <StatusBadge status={area.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {area.description}
                </p>
                <p className="mt-4 text-sm text-zinc-500">
                  <span className="font-mono text-xs text-zinc-600">
                    Next step:{" "}
                  </span>
                  <span className="text-zinc-300">{area.nextStep}</span>
                </p>
              </Card>
            ))}
          </div>
        </Section>

        {/* 4. GitHub Habit */}
        <Section
          index="03"
          title="GitHub Habit"
          purpose="A visible public track record, built one small commit at a time."
        >
          <Card>
            <ul className="space-y-3">
              {githubChecklist.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-900"
                  />
                  <span className="font-mono text-sm text-zinc-300">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>

        {/* 5. Skill Library */}
        <Section
          index="04"
          title="Skill Library"
          purpose="AI tools, plugins, and agent skills to learn or test."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {skillLibrary.map((skill) => (
              <Card key={skill.name}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-medium text-zinc-50">
                    {skill.name}
                  </h3>
                  <StatusBadge status={skill.status} />
                </div>
                <p className="mt-1 font-mono text-xs text-zinc-500">
                  {skill.type}
                </p>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  {skill.useCase}
                </p>
                {skill.source && (
                  <a
                    href={skill.source}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block break-all font-mono text-xs text-sky-400 hover:text-sky-300"
                  >
                    {skill.source.replace("https://", "")}
                  </a>
                )}
              </Card>
            ))}
          </div>
        </Section>

        {/* 6. Learning Tracks */}
        <Section
          index="05"
          title="Learning Tracks"
          purpose="Long-term skills, kept alive with small daily minimums."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {learningTracks.map((track) => (
              <Card key={track.name}>
                <h3 className="text-base font-medium text-zinc-50">
                  {track.name}
                </h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="font-mono text-xs text-zinc-600">
                      Current focus
                    </dt>
                    <dd className="mt-0.5 text-zinc-300">
                      {track.currentFocus}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-xs text-zinc-600">
                      Daily minimum
                    </dt>
                    <dd className="mt-0.5 text-zinc-400">
                      {track.dailyMinimum}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-xs text-zinc-600">
                      Weekly goal
                    </dt>
                    <dd className="mt-0.5 text-zinc-400">
                      {track.weeklyGoal}
                    </dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
        </Section>

        {/* 7. Daily Review */}
        <Section
          index="06"
          title="Daily Review"
          purpose="Close the loop every day. Static prompts for now — inputs come in Phase 2."
        >
          <Card>
            <dl className="space-y-4">
              {dailyReviewPrompts.map(({ prompt, placeholder }) => (
                <div key={prompt}>
                  <dt className="font-mono text-sm text-zinc-300">{prompt}</dt>
                  <dd className="mt-1 border-l-2 border-zinc-800 pl-3 text-sm italic text-zinc-600">
                    {placeholder}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </Section>

        {/* 8. Idea Pipeline */}
        <Section
          index="07"
          title="Idea Pipeline"
          purpose="Early ideas moving through stages — flexible, not committed."
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-zinc-600">
            {pipelineStages.map((stage, i) => (
              <span key={stage} className="flex items-center gap-2">
                <span>{stage}</span>
                {i < pipelineStages.length - 1 && (
                  <span className="text-zinc-800">→</span>
                )}
              </span>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ideas.map((idea) => (
              <Card key={idea.name} className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-medium leading-6 text-zinc-200">
                  {idea.name}
                </h3>
                <StatusBadge status={idea.stage} />
              </Card>
            ))}
          </div>
        </Section>

        {/* 9. Future Roadmap */}
        <Section
          index="08"
          title="Future Roadmap"
          purpose="Where TaoStack goes from here, one phase at a time."
        >
          <div className="space-y-4">
            {roadmap.map((phase) => (
              <Card
                key={phase.phase}
                className={phase.current ? "border-emerald-500/30" : ""}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-zinc-500">
                    {phase.phase}
                  </span>
                  <h3 className="text-base font-medium text-zinc-50">
                    {phase.title}
                  </h3>
                  {phase.current && (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] text-emerald-400">
                      You are here
                    </span>
                  )}
                </div>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {phase.items.map((item) => (
                    <li
                      key={item}
                      className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </Section>

        <footer className="mt-20 border-t border-zinc-900 pt-8 text-center font-mono text-xs text-zinc-600">
          Small loops compound. — TaoStack, Day 1
        </footer>
      </main>
    </div>
  );
}
