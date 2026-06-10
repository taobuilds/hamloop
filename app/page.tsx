// Mock data only — no database, API calls, or external dependencies.

const todaysFocus = {
  headline: "Ship the Last30Days skill",
  tasks: [
    "Draft the social-signal collector",
    "Wire up GitHub trending pull",
    "Review weekly learning notes",
  ],
};

const activeProjects = [
  {
    name: "EvidenceCanvas",
    description: "Visual workspace for assembling and citing evidence.",
    status: "In progress",
  },
  {
    name: "RightsScale",
    description: "Tooling for scaling rights and licensing workflows.",
    status: "In progress",
  },
  {
    name: "BriefPilot",
    description: "Assisted drafting and review for briefs.",
    status: "In progress",
  },
];

const githubHabit = {
  streakDays: 12,
  contributionsThisWeek: 23,
  // Last 7 days, most recent last.
  recent: [2, 4, 1, 5, 3, 6, 2],
};

const skillLibrary = [
  {
    name: "Last30Days Skill",
    description:
      "Research recent signals across social platforms, GitHub, and the web.",
  },
];

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.12] dark:bg-zinc-950">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function Home() {
  const maxBar = Math.max(...githubHabit.recent);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-10">
        <header className="mb-12">
          <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
            TaoStack
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            My personal AI workspace for building, learning, shipping, and
            running agent skills.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Card title="Today's Focus">
            <p className="text-base font-medium text-black dark:text-zinc-50">
              {todaysFocus.headline}
            </p>
            <ul className="mt-4 space-y-2">
              {todaysFocus.tasks.map((task) => (
                <li
                  key={task}
                  className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-600"
                  />
                  {task}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Active Projects">
            <ul className="space-y-4">
              {activeProjects.map((project) => (
                <li key={project.name}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-base font-medium text-black dark:text-zinc-50">
                      {project.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {project.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {project.description}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="GitHub Habit">
            <div className="flex items-baseline gap-6">
              <div>
                <p className="text-3xl font-semibold text-black dark:text-zinc-50">
                  {githubHabit.streakDays}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  day streak
                </p>
              </div>
              <div>
                <p className="text-3xl font-semibold text-black dark:text-zinc-50">
                  {githubHabit.contributionsThisWeek}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  this week
                </p>
              </div>
            </div>
            <div
              className="mt-6 flex h-16 items-end gap-2"
              aria-hidden
            >
              {githubHabit.recent.map((count, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-zinc-300 dark:bg-zinc-700"
                  style={{ height: `${(count / maxBar) * 100}%` }}
                />
              ))}
            </div>
          </Card>

          <Card title="Skill Library">
            <ul className="space-y-4">
              {skillLibrary.map((skill) => (
                <li key={skill.name}>
                  <p className="text-base font-medium text-black dark:text-zinc-50">
                    {skill.name}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {skill.description}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
