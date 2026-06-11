"use client";

// HamLoop — ADHD-friendly daily builder loop.
// Pick → Build → Commit → Review, four tabs, localStorage only.
// Visuals ported from the design handoff (HamLoop.dc.html):
// frosted-glass cards over a cool→warm gradient, two coupled themes.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BASICS,
  REVIEW_PROMPTS,
  SEED_CANDIDATES,
  Task,
  TaskType,
  THEMES,
  ThemeName,
  TYPE_COLORS,
} from "../lib/loop-data";
import type { Skill, SkillStatus, Task as PlannedTask } from "@/lib/types";
import { getSkills, getTasks, saveSkills, saveTasks } from "@/lib/storage";
import type { RadarResponse, RadarTool } from "@/lib/github-radar";

type Tab = "today" | "build" | "skills" | "review";

// One turn in the evening Review conversation. "user" bubbles are what you
// type; "assistant" bubbles are HamLoop's short replies from /api/review-chat.
type ReviewMsg = { role: "user" | "assistant"; text: string };

interface Persisted {
  day: string;
  theme: ThemeName;
  candidates: Task[];
  swiped: number;
  basicsDone: Record<string, boolean>;
  stepsDone: Record<string, boolean>;
  committed: Record<string, boolean>;
  msgs: ReviewMsg[];
  generated: boolean;
  // The user's own daily-basics checklist. Persisted (so it repeats every day);
  // only the per-day `basicsDone` ticks reset at rollover.
  basics: { id: string; label: string }[];
}

// Older saves stored msgs as a plain string[] (user lines only). Upgrade them
// to typed turns so existing journals keep rendering after this change.
function migrateMsgs(raw: unknown): ReviewMsg[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m): ReviewMsg | null => {
      if (typeof m === "string") return { role: "user", text: m };
      if (m && typeof m === "object" && typeof (m as ReviewMsg).text === "string") {
        const r = (m as ReviewMsg).role;
        return { role: r === "assistant" ? "assistant" : "user", text: (m as ReviewMsg).text };
      }
      return null;
    })
    .filter((m): m is ReviewMsg => m !== null);
}

const STORAGE_KEY = "hamloop_loop_v1";
// Legacy (pre-HamLoop) blob key; migrated to STORAGE_KEY on first load.
const LEGACY_STORAGE_KEY = "taostack_loop_v1";
// The prototype nudged after 18s for demo purposes; in real use a gentle
// re-entry after 5 minutes is supportive without being annoying.
const NUDGE_SECONDS = 300;
const RING_R = 64;
const RING_C = 2 * Math.PI * RING_R;

// Map the canonical (lowercase) task model used by the storage layer / AI
// planner back to the prototype's display-style enums, for tasks mirrored into
// Today's deck.
const NEW_TO_OLD_TYPE: Record<string, TaskType> = {
  build: "Build",
  github: "GitHub",
  "skill-test": "Skill Test",
  learning: "Learning",
  review: "Review",
  health: "Health",
  life: "Life",
  admin: "Admin",
};
const NEW_TO_OLD_ENERGY: Record<string, "Low" | "Medium" | "High"> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const defaultPersisted = (): Persisted => ({
  day: todayKey(),
  theme: "Daybreak",
  candidates: SEED_CANDIDATES,
  swiped: 0,
  basicsDone: {},
  stepsDone: {},
  committed: {},
  msgs: [],
  generated: false,
  basics: BASICS.map((b) => ({ id: b.id, label: b.label })),
});

// New day: completed one-off tasks never reappear, skipped/today cards return
// to the deck as candidates, and basics, the loop and the review reset. Tasks
// from the AI planner are already candidates, so they simply carry over.
function rollover(p: Persisted): Persisted {
  const day = todayKey();
  if (p.day === day) return p;
  const kept: Task[] = p.candidates
    .filter((c) => c.status !== "done")
    .map((c) => (c.status === "skippedToday" || c.status === "today" ? { ...c, status: "candidate" } : c));
  return {
    ...p,
    day,
    candidates: kept,
    swiped: 0,
    basicsDone: {},
    generated: false,
    msgs: [],
  };
}

/* ---------- small shared pieces ---------- */

function MonoLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--ink3)] ${className}`}>
      {children}
    </span>
  );
}

function TypeBadge({ type }: { type: TaskType }) {
  const [c, bg] = TYPE_COLORS[type];
  return (
    <span
      className="rounded-full px-[11px] py-[6px] font-mono text-[10px] uppercase tracking-[0.12em]"
      style={{ background: bg, color: c }}
    >
      {type}
    </span>
  );
}

function Sheet({
  onClose,
  label,
  children,
}: {
  onClose: () => void;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-[rgba(20,24,32,0.34)] animate-ts-fade" onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 z-[51] w-full max-w-[430px] -translate-x-1/2 rounded-t-[28px] bg-[#F4F7FA] px-[22px] pt-[14px] pb-9 shadow-[0_-18px_40px_-20px_rgba(30,35,25,0.4)] animate-ts-rise">
        <div className="mx-auto mb-4 h-1 w-[38px] rounded-sm bg-[rgba(30,33,42,0.14)]" />
        {label && <MonoLabel>{label}</MonoLabel>}
        {children}
      </div>
    </>
  );
}

/* ---------- the app ---------- */

export default function LoopApp() {
  const [loaded, setLoaded] = useState(false);
  const [p, setP] = useState<Persisted>(defaultPersisted);

  // ephemeral UI state
  const [tab, setTab] = useState<Tab>("today");
  const [swipeExit, setSwipeExit] = useState(0);
  // After a card flies off, the next one is "entering": it must snap to center
  // (no slide) and fade in from behind the deck rather than sliding in from the
  // swipe direction.
  const [entering, setEntering] = useState(false);
  // Tinder-style drag: dx is horizontal offset in px, active while a finger/
  // pointer is down. dragRef holds the pointer's start so move/up can measure.
  const [drag, setDrag] = useState<{ dx: number; active: boolean }>({ dx: 0, active: false });
  const dragRef = useRef<{ x: number; id: number } | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [quickType, setQuickType] = useState<TaskType>("Life");
  const [buildIdx, setBuildIdx] = useState(0);
  const [timer, setTimer] = useState<{
    sel: number | "Custom";
    custom: number;
    left: number | null;
    total: number;
    running: boolean;
  }>({ sel: 25, custom: 35, left: null, total: 0, running: false });
  const [nudge, setNudge] = useState(false);
  const [nudgeHidden, setNudgeHidden] = useState(false);
  const [celebrate, setCelebrate] = useState<{ on: boolean; sub: string }>({ on: false, sub: "" });
  const [draft, setDraft] = useState("");
  const [editingBasics, setEditingBasics] = useState(false);
  const [newBasic, setNewBasic] = useState("");
  const [replying, setReplying] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<{ id: string; title: string; type: string; minutes: number }[]>([]);
  const [toastText, setToastText] = useState<string | null>(null);

  const secRef = useRef(0);
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const celebT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* ---------- persistence ---------- */

  useEffect(() => {
    // localStorage is client-only: load after mount so the server-rendered
    // splash and the first client render match.
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        // One-time migration from the legacy (pre-HamLoop) blob key.
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy !== null) {
          localStorage.setItem(STORAGE_KEY, legacy);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          raw = legacy;
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Persisted>;
        // Older saves predate custom basics — fall back to the seed list.
        const basics =
          Array.isArray(parsed.basics) && parsed.basics.length
            ? parsed.basics.filter((b) => b && typeof b.id === "string" && typeof b.label === "string")
            : defaultPersisted().basics;
        const merged = { ...defaultPersisted(), ...parsed, msgs: migrateMsgs(parsed.msgs), basics };
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setP(rollover(merged));
      }
    } catch {
      // corrupted storage — start fresh
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      // storage unavailable — run in-memory
    }
  }, [p, loaded]);

  /* ---------- feedback ---------- */

  const toast = useCallback((t: string) => {
    clearTimeout(toastT.current);
    setToastText(t);
    toastT.current = setTimeout(() => setToastText(null), 1900);
  }, []);

  const celebrateNow = useCallback((sub: string) => {
    clearTimeout(celebT.current);
    setCelebrate({ on: true, sub });
    celebT.current = setTimeout(() => setCelebrate((c) => ({ ...c, on: false })), 1600);
  }, []);

  useEffect(() => () => {
    clearTimeout(toastT.current);
    clearTimeout(celebT.current);
  }, []);

  /* ---------- derived ---------- */

  const theme = THEMES[p.theme];
  const accent = theme.solid;
  const deck = p.candidates.filter((c) => c.status === "candidate");
  const sel = p.candidates.filter((c) => c.status === "today" || c.status === "done");
  const pending = p.candidates.filter((c) => c.status === "today");
  const doneCount = sel.filter((c) => c.status === "done").length;
  const cur = pending.length ? pending[Math.min(buildIdx, pending.length - 1)] : null;
  const allComplete = sel.length > 0 && pending.length === 0 && deck.length === 0;

  /* ---------- timer + nudge ticks ---------- */

  useEffect(() => {
    if (!timer.running) return;
    const iv = setInterval(() => {
      setTimer((t) => {
        if (!t.running || t.left == null) return t;
        const left = t.left - 1;
        if (left <= 0) {
          queueMicrotask(() => toast("Focus block done. Nice."));
          return { ...t, left: null, running: false };
        }
        return { ...t, left };
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [timer.running, toast]);

  const nudgeEligible = tab === "build" && !!cur && !nudge && !nudgeHidden && !celebrate.on;
  useEffect(() => {
    if (!nudgeEligible) return;
    const iv = setInterval(() => {
      secRef.current += 1;
      if (secRef.current >= NUDGE_SECONDS) setNudge(true);
    }, 1000);
    return () => clearInterval(iv);
  }, [nudgeEligible]);

  /* ---------- actions ---------- */

  const goTab = (k: Tab) => {
    secRef.current = 0;
    setTab(k);
    setNudge(false);
    setNudgeHidden(false);
  };

  const swipe = (keep: boolean) => {
    if (swipeExit || !deck.length) return;
    const id = deck[0].id;
    setSwipeExit(keep ? 1 : -1);
    setTimeout(() => {
      setSwipeExit(0);
      setEntering(true);
      setP((s) => ({
        ...s,
        swiped: s.swiped + 1,
        candidates: s.candidates.map((c) =>
          c.id === id ? { ...c, status: keep ? "today" : "skippedToday" } : c
        ),
      }));
      // Let the next card settle at center (instant), then re-enable the normal
      // transform transition once it's done fading in.
      setTimeout(() => setEntering(false), 260);
    }, 290);
  };

  // Drag gestures for the morning-swipe card. Pointer events cover both touch
  // and mouse; past SWIPE_THRESHOLD a release commits the same keep/skip the
  // buttons do, otherwise the card springs back to center.
  const SWIPE_THRESHOLD = 90;
  const onCardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeExit || !deck.length) return;
    // Let the in-card buttons handle their own taps — don't hijack as a drag.
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { x: e.clientX, id: e.pointerId };
    setDrag({ dx: 0, active: true });
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onCardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.id !== e.pointerId) return;
    setDrag({ dx: e.clientX - dragRef.current.x, active: true });
  };
  const onCardPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.id !== e.pointerId) return;
    const dx = e.clientX - dragRef.current.x;
    dragRef.current = null;
    setDrag({ dx: 0, active: false });
    if (dx > SWIPE_THRESHOLD) swipe(true);
    else if (dx < -SWIPE_THRESHOLD) swipe(false);
  };

  const completeTask = (id: string, fromBuild: boolean) => {
    const remaining = pending.filter((c) => c.id !== id).length;
    setP((s) => ({
      ...s,
      candidates: s.candidates.map((c) => (c.id === id ? { ...c, status: "done" } : c)),
    }));
    setNudge(false);
    secRef.current = 0;
    if (fromBuild) {
      setTimer((t) => ({ ...t, left: null, running: false }));
      celebrateNow(remaining > 0 ? `${remaining} to go today` : "today's loop is built — review tonight");
    } else {
      setTimer((t) => ({ ...t, running: false }));
      toast(remaining > 0 ? `Done — ${remaining} to go` : "All done for today");
    }
  };

  const quickAdd = (toToday: boolean) => {
    const t = quickText.trim();
    if (!t) {
      toast("Type a task first");
      return;
    }
    const task: Task = {
      id: `q${Date.now()}`,
      title: t,
      reason: "Quick added",
      min: 15,
      type: quickType,
      energy: "Low",
      steps: ["Just do the thing"],
      status: toToday ? "today" : "candidate",
    };
    setP((s) => ({ ...s, candidates: [...s.candidates, task] }));
    setQuickOpen(false);
    setQuickText("");
    toast(toToday ? "Added to today" : "Added to morning picks");
  };

  // Test Today (from the Skill Library): create a skill-test candidate task.
  // It's written to the Sprint 1 task store (clean model) and mirrored into
  // Today's candidate deck — which still reads the prototype store — so it
  // shows up in Morning picks right away. The mirror goes away once Today is
  // migrated onto the storage layer in a later sprint.
  const addSkillTestCandidate = (skill: Skill) => {
    const id = `st-${Date.now()}`;
    const title = skill.nextTestTask?.trim() || `Test ${skill.name} on one small task`;
    const reason = `From your skill library — ${skill.name}`;
    const steps = [`Open ${skill.name}`, "Run one small test", "Note what worked"];
    const now = new Date().toISOString();

    saveTasks([
      ...getTasks(),
      {
        id,
        title,
        type: "skill-test",
        status: "candidate",
        reason,
        minutes: 25,
        energy: "medium",
        steps,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    setP((s) => ({
      ...s,
      candidates: [
        ...s.candidates,
        { id, title, reason, min: 25, type: "Skill Test", energy: "Medium", steps, status: "candidate" },
      ],
    }));
    toast("Candidate added to Today's picks");
  };

  // AI Planner: turn tonight's review + context into tomorrow's candidates.
  const generatePlan = async () => {
    if (planning) return;
    setPlanning(true);
    try {
      const res = await fetch("/api/ai-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewText: p.msgs.filter((m) => m.role === "user").map((m) => m.text).join("\n"),
          currentTasks: p.candidates
            .filter((c) => c.status === "candidate" || c.status === "today")
            .map((c) => c.title),
          completedTasks: p.candidates.filter((c) => c.status === "done").map((c) => c.title),
          savedSkills: getSkills().map((s) => s.name),
          dailyBasics: p.basics.map((b) => ({ label: b.label, done: !!p.basicsDone[b.id] })),
        }),
      });
      const data = (await res.json()) as { tasks?: PlannedTask[] };
      const tasks = data.tasks ?? [];
      if (tasks.length === 0) throw new Error("empty plan");

      // Persist to the clean task store (Sprint 1 layer)...
      saveTasks([...getTasks(), ...tasks]);

      // ...and mirror into Today's Morning Swipe, which still reads the
      // prototype store, so the candidates show up right away.
      const mirrored: Task[] = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        reason: t.reason || "From tonight's review",
        min: t.minutes ?? 20,
        type: NEW_TO_OLD_TYPE[t.type] ?? "Build",
        energy: NEW_TO_OLD_ENERGY[t.energy ?? "medium"] ?? "Medium",
        steps: ["Make a small start"],
        status: "candidate",
      }));
      setP((s) => ({ ...s, candidates: [...s.candidates, ...mirrored], generated: true }));
      setPlan(tasks.map((t) => ({ id: t.id, title: t.title, type: t.type, minutes: t.minutes ?? 20 })));
      toast("Tomorrow's candidates are ready");
    } catch {
      toast("Couldn't generate — try again");
    } finally {
      setPlanning(false);
    }
  };

  // Drop a single proposed task before accepting it: remove it from the plan
  // preview, from Today's mirrored candidates, and from the canonical store.
  const dropPlanItem = (id: string) => {
    setPlan((rows) => rows.filter((r) => r.id !== id));
    setP((s) => ({ ...s, candidates: s.candidates.filter((c) => c.id !== id) }));
    try {
      saveTasks(getTasks().filter((t) => t.id !== id));
    } catch {
      // Store unavailable — the in-memory removal above still applies.
    }
    toast("Removed from tomorrow's plan");
  };

  // Throw away the whole proposed plan and ask for a fresh one. Clears every
  // AI-mirrored candidate first so a regenerate replaces rather than stacks.
  const regeneratePlan = () => {
    setPlan([]);
    const dropIds = new Set(plan.map((r) => r.id));
    setP((s) => ({
      ...s,
      candidates: s.candidates.filter((c) => !dropIds.has(c.id)),
      generated: false,
    }));
    try {
      saveTasks(getTasks().filter((t) => !dropIds.has(t.id)));
    } catch {
      // Store unavailable — in-memory removal still applies.
    }
    void generatePlan();
  };

  // Send a review line, then fetch HamLoop's short spoken reply. The user
  // bubble shows immediately; the assistant bubble appears once the API
  // returns. On any failure we still drop in a gentle reply so the chat never
  // stalls silently.
  const send = async () => {
    const t = draft.trim();
    if (!t || replying) return;
    const userMsg: ReviewMsg = { role: "user", text: t };
    const history = [...p.msgs, userMsg];
    setP((s) => ({ ...s, msgs: history }));
    setDraft("");
    setReplying(true);
    try {
      const res = await fetch("/api/review-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = (await res.json()) as { reply?: string };
      const reply = (data.reply ?? "").trim();
      setP((s) => ({
        ...s,
        msgs: [...s.msgs, { role: "assistant", text: reply || "Thanks for sharing that." }],
      }));
    } catch {
      setP((s) => ({
        ...s,
        msgs: [...s.msgs, { role: "assistant", text: "I'm having trouble replying right now — but it's noted. Keep going." }],
      }));
    } finally {
      setReplying(false);
    }
  };

  const toggleTheme = () => {
    const next: ThemeName = p.theme === "Daybreak" ? "Tide" : "Daybreak";
    setP((s) => ({ ...s, theme: next }));
    toast(`Theme · ${next}`);
  };

  /* ---------- daily basics (user-editable, repeat every day) ---------- */

  const addBasic = () => {
    const label = newBasic.trim().slice(0, 40);
    if (!label) return;
    const id = `b-${Date.now()}`;
    setP((s) => ({ ...s, basics: [...s.basics, { id, label }] }));
    setNewBasic("");
  };

  const removeBasic = (id: string) => {
    setP((s) => {
      const { [id]: _drop, ...restDone } = s.basicsDone;
      void _drop;
      return { ...s, basics: s.basics.filter((b) => b.id !== id), basicsDone: restDone };
    });
  };

  const renameBasic = (id: string, label: string) => {
    setP((s) => ({
      ...s,
      basics: s.basics.map((b) => (b.id === id ? { ...b, label: label.slice(0, 40) } : b)),
    }));
  };

  // Wipe every HamLoop key (the prototype loop blob + the canonical store and
  // their legacy aliases) and reload, so the app re-seeds from scratch — handy
  // for replaying the full workflow without opening DevTools.
  const resetAll = () => {
    if (!confirm("Reset HamLoop? This clears today's loop, review, and all saved tasks/skills.")) return;
    try {
      for (const k of [
        STORAGE_KEY,
        LEGACY_STORAGE_KEY,
        "hamloop:tasks",
        "hamloop:skills",
        "hamloop:reviews",
        "hamloop:dailyBasics",
        "taostack:tasks",
        "taostack:skills",
        "taostack:reviews",
        "taostack:dailyBasics",
      ]) {
        localStorage.removeItem(k);
      }
    } catch {
      // Storage unavailable — reload still re-seeds from defaults.
    }
    location.reload();
  };

  /* ---------- render helpers ---------- */

  if (!loaded) {
    return <div className="min-h-dvh" style={{ background: THEMES.Daybreak.bg }} />;
  }

  const now = new Date();
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const dateLabel = `${days[now.getDay()]} · ${months[now.getMonth()]} ${now.getDate()}`;
  const h = now.getHours();
  const greeting = h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";

  const curSteps = cur?.steps ?? [];
  const curStepsDone = cur ? curSteps.every((_, i) => p.stepsDone[`${cur.id}:${i}`]) : false;

  let statusLabel = "Not started";
  let statusColor = "#959AA4";
  if (sel.length > 0 && pending.length === 0 && p.generated) {
    statusLabel = "Completed";
    statusColor = "#5AA075";
  } else if (sel.length > 0 && pending.length === 0) {
    statusLabel = "Ready to review";
    statusColor = "#4E8AA8";
  } else if (cur && curStepsDone && cur.commit && !p.committed[cur.id]) {
    statusLabel = "Ready to commit";
    statusColor = "#6E72C8";
  } else if (sel.length > 0) {
    statusLabel = "In progress";
    statusColor = accent;
  } else if (p.swiped > 0) {
    statusLabel = "Picking";
    statusColor = "#C29A3A";
  }

  const segData: [string, boolean][] = [
    ["Pick", sel.length > 0],
    ["Build", doneCount > 0],
    ["Review", p.generated],
  ];
  const segCount = segData.filter(([, on]) => on).length;

  const basicsDoneCount = p.basics.filter((b) => p.basicsDone[b.id]).length;
  const top = deck[0];
  const exiting = swipeExit !== 0;
  const deckDone = deck.length === 0 && p.swiped > 0;

  const startLen = timer.sel === "Custom" ? timer.custom : timer.sel;
  const timerActive = timer.left != null;
  const timerDisplay = timerActive
    ? `${String(Math.floor((timer.left as number) / 60)).padStart(2, "0")}:${String((timer.left as number) % 60).padStart(2, "0")}`
    : "00:00";
  const timerPct =
    timerActive && timer.total ? Math.round(100 * (1 - (timer.left as number) / timer.total)) : 0;
  const committedNow = cur ? !!p.committed[cur.id] : false;
  const loopClosed = p.generated && allComplete;

  const tabColor = (k: Tab) => (tab === k ? accent : "#959AA4");

  const cssVars = {
    "--ink": "#1E2127",
    "--ink2": "#565C66",
    "--ink3": "#959AA4",
    "--accent": accent,
    "--accent-bg": theme.btn,
    "--soft": theme.softBg,
    "--soft-bd": theme.softBd,
  } as React.CSSProperties;

  return (
    <div
      className="min-h-dvh font-sans text-[var(--ink)] antialiased"
      style={{ ...cssVars, background: theme.bg }}
    >
      <main className="mx-auto w-full max-w-[430px]">
        {/* ============ TODAY ============ */}
        {tab === "today" && (
          <div className="animate-ts-fade px-[22px] pt-16">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-[9px]">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink3)]">
                  {dateLabel}
                </span>
                <h1 className="text-[31px] font-bold leading-[1.05] tracking-[-0.02em]">{greeting}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetAll}
                  title="Reset all data (replay from scratch)"
                  aria-label="Reset all data"
                  className="glass-pill flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full text-[var(--ink2)] shadow-[0_8px_18px_-10px_rgba(42,50,68,0.45)]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
                <button
                  onClick={toggleTheme}
                  title={`Switch theme (${p.theme === "Daybreak" ? "Tide" : "Daybreak"})`}
                  aria-label="Switch theme"
                  className="h-[26px] w-[26px] cursor-pointer rounded-full border border-[rgba(255,255,255,0.7)] shadow-[0_8px_18px_-10px_rgba(42,50,68,0.45)]"
                  style={{ background: THEMES[p.theme === "Daybreak" ? "Tide" : "Daybreak"].btn }}
                />
                <button
                  onClick={() => setQuickOpen(true)}
                  title="Quick add"
                  className="glass-pill flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-full pb-0.5 text-2xl font-light leading-none text-[var(--ink)] shadow-[0_10px_22px_-10px_rgba(42,50,68,0.45)]"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span className="glass-pill inline-flex items-center gap-[7px] rounded-full px-[13px] py-[7px] font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink2)]">
                <span
                  className="h-[7px] w-[7px] rounded-full transition-colors duration-300"
                  style={{ background: statusColor }}
                />
                {statusLabel}
              </span>
            </div>

            <p className="mt-5 max-w-[24ch] text-[21px] font-medium leading-[1.3] tracking-[-0.01em]">
              Ship one small loop today.
            </p>

            <div className="mt-[18px] flex items-end gap-2.5">
              {segData.map(([label, on]) => (
                <div key={label} className="flex-1">
                  <div
                    className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] transition-colors duration-300"
                    style={{ color: on ? "var(--ink)" : "var(--ink3)" }}
                  >
                    {label}
                  </div>
                  <div
                    className="h-1 rounded-sm transition-colors duration-300"
                    style={{ background: on ? accent : "rgba(30,33,42,0.1)" }}
                  />
                </div>
              ))}
              <span className="font-mono text-[11px] text-[var(--ink3)]">{segCount}/3</span>
            </div>

            {/* daily basics — user-editable, repeats every day */}
            <div className="mt-7">
              <div className="mb-2.5 flex items-center justify-between">
                <MonoLabel>Daily basics</MonoLabel>
                <div className="flex items-center gap-2.5">
                  {!editingBasics && (
                    <span className="font-mono text-[10.5px] text-[var(--ink3)]">
                      {basicsDoneCount}/{p.basics.length} · resets tomorrow
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setEditingBasics((e) => !e);
                      setNewBasic("");
                    }}
                    className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--accent)] underline underline-offset-2"
                  >
                    {editingBasics ? "Done" : "Edit"}
                  </button>
                </div>
              </div>

              {editingBasics ? (
                <div className="flex flex-col gap-2">
                  {p.basics.map((b) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <input
                        value={b.label}
                        onChange={(e) => renameBasic(b.id, e.target.value)}
                        placeholder="Basic name"
                        className="min-w-0 flex-1 rounded-[14px] border border-[rgba(30,33,42,0.1)] bg-white px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] outline-none placeholder:text-[#ABAC9F]"
                      />
                      <button
                        onClick={() => removeBasic(b.id)}
                        title="Delete basic"
                        aria-label={`Delete ${b.label}`}
                        className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full border border-[rgba(30,33,42,0.12)] bg-white text-[15px] leading-none text-[var(--ink2)]"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="mt-0.5 flex items-center gap-2">
                    <input
                      value={newBasic}
                      onChange={(e) => setNewBasic(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addBasic()}
                      placeholder="Add a daily basic…"
                      className="min-w-0 flex-1 rounded-[14px] border border-[rgba(30,33,42,0.1)] bg-white px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] outline-none placeholder:text-[#ABAC9F]"
                    />
                    <button
                      onClick={addBasic}
                      title="Add basic"
                      aria-label="Add basic"
                      className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full border-none pb-0.5 text-[18px] font-light leading-none text-white"
                      style={{ background: "var(--accent-bg)" }}
                    >
                      +
                    </button>
                  </div>
                  {p.basics.length === 0 && (
                    <div className="text-[12.5px] font-light text-[var(--ink2)]">
                      No basics yet — add a few above. They&apos;ll repeat every day.
                    </div>
                  )}
                </div>
              ) : (
                <div className="ts-scroll -mx-[22px] flex gap-2 overflow-x-auto px-[22px] pb-2 pt-0.5">
                  {p.basics.map((b) => {
                    const on = !!p.basicsDone[b.id];
                    const dn = theme.done;
                    return (
                      <button
                        key={b.id}
                        onClick={() =>
                          setP((s) => ({
                            ...s,
                            basicsDone: { ...s.basicsDone, [b.id]: !s.basicsDone[b.id] },
                          }))
                        }
                        className="flex flex-none cursor-pointer items-center gap-2 rounded-full py-[9px] pl-2.5 pr-3.5 text-[13px] font-medium shadow-[0_8px_18px_-12px_rgba(42,50,68,0.35)] transition-all duration-200"
                        style={{
                          background: on ? dn.bg : "#fff",
                          border: `1px solid ${on ? dn.bd : "rgba(30,33,42,0.06)"}`,
                          color: on ? dn.label : "var(--ink2)",
                        }}
                      >
                        <span
                          className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] text-white transition-all duration-200"
                          style={{
                            background: on ? dn.check : "#fff",
                            border: `1px solid ${on ? dn.check : "rgba(30,33,42,0.18)"}`,
                          }}
                        >
                          {on ? "✓" : ""}
                        </span>
                        {b.label}
                      </button>
                    );
                  })}
                  {p.basics.length === 0 && (
                    <span className="py-[9px] text-[13px] font-light text-[var(--ink3)]">
                      No basics — tap Edit to add some.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* morning swipe planner */}
            {deck.length > 0 && top && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <MonoLabel>Morning picks</MonoLabel>
                  <span className="font-mono text-[10.5px] text-[var(--ink3)]">
                    {Math.min(p.swiped + 1, p.swiped + deck.length)} of {p.swiped + deck.length}
                  </span>
                </div>
                <div className="relative">
                  {deck.length > 1 && (
                    <div className="absolute -bottom-3 left-4 right-4 top-4 rounded-[26px] border border-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.32)]" />
                  )}
                  <div
                    onPointerDown={onCardPointerDown}
                    onPointerMove={onCardPointerMove}
                    onPointerUp={onCardPointerUp}
                    onPointerCancel={onCardPointerUp}
                    className="glass-card relative cursor-grab touch-pan-y select-none rounded-[26px] p-6 shadow-[0_22px_40px_-24px_rgba(42,50,68,0.45)] active:cursor-grabbing"
                    style={{
                      transform: exiting
                        ? `translateX(${swipeExit * 430}px) rotate(${swipeExit * 7}deg)`
                        : `translateX(${drag.dx}px) rotate(${drag.dx * 0.04}deg)`,
                      opacity: exiting ? 0 : 1,
                      transition: exiting
                        ? "transform 0.3s ease, opacity 0.3s ease"
                        : entering
                        ? // snap to center with no transform slide; just fade in
                          "opacity 0.25s ease"
                        : drag.active
                        ? "none"
                        : "transform 0.25s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease",
                    }}
                  >
                    {/* drag feedback — fade in as the card is pulled past center */}
                    <div
                      className="pointer-events-none absolute right-5 top-5 rounded-[10px] border-2 px-2.5 py-1 font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-white"
                      style={{
                        background: "var(--accent-bg)",
                        borderColor: "rgba(255,255,255,0.7)",
                        opacity: Math.max(0, Math.min(1, drag.dx / SWIPE_THRESHOLD)),
                        transform: "rotate(8deg)",
                      }}
                    >
                      Keep
                    </div>
                    <div
                      className="pointer-events-none absolute left-5 top-5 rounded-[10px] border-2 border-[rgba(30,33,42,0.25)] bg-[rgba(30,33,42,0.55)] px-2.5 py-1 font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-white"
                      style={{
                        opacity: Math.max(0, Math.min(1, -drag.dx / SWIPE_THRESHOLD)),
                        transform: "rotate(-8deg)",
                      }}
                    >
                      Skip
                    </div>
                    <div className="flex items-center justify-between">
                      <TypeBadge type={top.type} />
                      <span className="font-mono text-[10.5px] text-[var(--ink3)]">
                        {top.min} min · {top.energy.toLowerCase()} energy
                      </span>
                    </div>
                    <div className="mt-[18px] text-[26px] font-semibold leading-[1.18] tracking-[-0.02em] [text-wrap:pretty]">
                      {top.title}
                    </div>
                    <div className="mt-[9px] text-[14.5px] font-light leading-[1.45] text-[var(--ink2)]">
                      {top.reason}
                    </div>
                    <div className="mt-[26px] flex gap-2.5">
                      <button
                        onClick={() => swipe(false)}
                        className="h-[52px] flex-1 cursor-pointer rounded-[18px] bg-[var(--soft)] text-[14.5px] font-medium text-[var(--ink2)]"
                        style={{ border: "1px solid var(--soft-bd)" }}
                      >
                        Not today
                      </button>
                      <button
                        onClick={() => swipe(true)}
                        className="h-[52px] flex-[1.4] cursor-pointer rounded-[18px] border-none text-[14.5px] font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)]"
                        style={{ background: "var(--accent-bg)" }}
                      >
                        Keep today
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* no more candidates — loop ring */}
            {deckDone && (
              <div className="glass-card mt-6 animate-ts-rise rounded-[26px] p-[22px] shadow-[0_18px_34px_-22px_rgba(42,50,68,0.4)]">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--ink3)]">
                    Loop
                  </span>
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-[rgba(30,33,42,0.1)] text-xs text-[var(--ink3)]">
                    ›
                  </span>
                </div>
                <div className="flex justify-center pb-1.5 pt-2.5">
                  <div className="relative h-[150px] w-[150px]">
                    <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
                      <circle cx="75" cy="75" r={RING_R} fill="none" stroke="rgba(30,33,42,0.08)" strokeWidth="8" />
                      <circle
                        cx="75"
                        cy="75"
                        r={RING_R}
                        fill="none"
                        stroke={accent}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={RING_C}
                        strokeDashoffset={RING_C * (1 - (sel.length ? doneCount / sel.length : 0))}
                        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[44px] font-light leading-none tracking-[-0.02em]">{doneCount}</span>
                      <span className="mt-1 font-mono text-[11px] text-[var(--ink3)]">of {sel.length}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 text-center text-[19px] font-semibold tracking-[-0.01em]">
                  No more candidates.
                </div>
                <div className="mt-1 text-center text-[13.5px] font-light text-[var(--ink2)]">
                  Your loop is ready.
                </div>
                <button
                  onClick={() => goTab("build")}
                  className="mt-[18px] h-[54px] w-full cursor-pointer rounded-[18px] border-none text-[15px] font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)]"
                  style={{ background: "var(--accent-bg)" }}
                >
                  Start building
                </button>
              </div>
            )}

            {/* today's plan */}
            {sel.length > 0 && (
              <div className="mt-[26px]">
                <div className="mb-2.5 flex items-center justify-between">
                  <MonoLabel>Today&apos;s plan</MonoLabel>
                  <span className="font-mono text-[10.5px] text-[var(--ink3)]">
                    {doneCount}/{sel.length} done
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {sel.map((t) => {
                    const done = t.status === "done";
                    const [dot] = TYPE_COLORS[t.type];
                    return (
                      <div
                        key={t.id}
                        className="glass-card flex items-center gap-[13px] rounded-[20px] py-3.5 pl-[18px] pr-3.5 shadow-[0_12px_24px_-18px_rgba(42,50,68,0.4)]"
                      >
                        <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: dot }} />
                        <div className="min-w-0 flex-1">
                          <div
                            className="text-[15.5px] font-semibold tracking-[-0.01em] transition-colors duration-200"
                            style={{
                              color: done ? "var(--ink3)" : "var(--ink)",
                              textDecoration: done ? "line-through" : "none",
                            }}
                          >
                            {t.title}
                          </div>
                          <div className="mt-[3px] font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--ink3)]">
                            {t.type} · {t.min} min
                          </div>
                        </div>
                        <button
                          onClick={() => !done && completeTask(t.id, false)}
                          title="Mark complete"
                          className="flex h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center rounded-full text-sm transition-all duration-200"
                          style={{
                            background: done ? accent : "#fff",
                            border: `1px solid ${done ? accent : "rgba(30,33,42,0.14)"}`,
                            color: done ? "#fff" : "rgba(30,33,42,0.35)",
                          }}
                        >
                          ✓
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {allComplete && (
              <div className="mt-6 rounded-[26px] border border-[rgba(90,160,117,0.32)] bg-[rgba(227,240,231,0.42)] p-6 text-center shadow-[0_18px_34px_-22px_rgba(42,50,68,0.4)] backdrop-blur-[26px] backdrop-saturate-[1.4]">
                <div className="text-[19px] font-semibold">All done for today.</div>
                <button
                  onClick={() => goTab("review")}
                  className="mt-3.5 cursor-pointer rounded-full border-none bg-[#E3F0E7] px-[22px] py-[13px] text-sm font-semibold text-[#3E7A56]"
                >
                  Close the loop tonight ›
                </button>
              </div>
            )}

            <div className="h-[130px]" />
          </div>
        )}

        {/* ============ BUILD ============ */}
        {tab === "build" && (
          <div className="animate-ts-fade px-[22px] pt-16">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink3)]">
              Focus mode
            </span>
            <h1 className="mt-[9px] text-[31px] font-bold leading-[1.05] tracking-[-0.02em]">One thing.</h1>

            {!cur && (
              <div className="glass-card mt-[26px] rounded-[26px] px-6 py-[34px] text-center shadow-[0_18px_34px_-22px_rgba(42,50,68,0.4)]">
                <div className="mx-auto mb-3.5 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[var(--soft)]">
                  <svg width="18" height="18" viewBox="0 0 22 22">
                    <path d="M11 2 L20 11 L11 20 L2 11 Z" fill="none" stroke="var(--accent)" strokeWidth="1.8" />
                  </svg>
                </div>
                <div className="text-[19px] font-semibold">
                  {allComplete ? "All built for today." : "Nothing picked yet."}
                </div>
                <div className="mt-[5px] text-[13.5px] font-light text-[var(--ink2)]">
                  {allComplete
                    ? "Close the loop with a short review tonight."
                    : "Choose your tasks on Today first."}
                </div>
                <button
                  onClick={() => goTab("today")}
                  className="mt-[18px] cursor-pointer rounded-full border-none px-[26px] py-3.5 text-sm font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)]"
                  style={{ background: "var(--accent-bg)" }}
                >
                  {allComplete ? "Back to Today" : "Go to Today"}
                </button>
              </div>
            )}

            {cur && (
              <>
                <div className="mb-2.5 mt-6 flex items-center justify-between">
                  <MonoLabel>
                    Now building · {Math.min(buildIdx, pending.length - 1) + 1} of {pending.length}
                  </MonoLabel>
                  {pending.length > 1 && (
                    <button
                      onClick={() => {
                        secRef.current = 0;
                        setNudge(false);
                        setBuildIdx((i) => (i + 1) % pending.length);
                      }}
                      className="cursor-pointer border-none bg-transparent py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink2)]"
                    >
                      Switch ›
                    </button>
                  )}
                </div>

                <div className="glass-card rounded-[26px] p-6 shadow-[0_22px_40px_-24px_rgba(42,50,68,0.45)]">
                  <div className="flex items-center justify-between">
                    <TypeBadge type={cur.type} />
                    <span className="font-mono text-[10.5px] text-[var(--ink3)]">
                      {cur.min} min · {cur.energy.toLowerCase()} energy
                    </span>
                  </div>
                  <div className="mt-4 text-[27px] font-semibold leading-[1.16] tracking-[-0.02em] [text-wrap:pretty]">
                    {cur.title}
                  </div>

                  <div className="mt-[22px] border-t border-[rgba(30,33,42,0.06)] pt-4">
                    <div className="mb-2.5 flex justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink3)]">
                        Small steps
                      </span>
                      <span className="font-mono text-[10px] text-[var(--ink3)]">
                        {curSteps.filter((_, i) => p.stepsDone[`${cur.id}:${i}`]).length}/{curSteps.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {curSteps.map((label, i) => {
                        const key = `${cur.id}:${i}`;
                        const on = !!p.stepsDone[key];
                        return (
                          <button
                            key={key}
                            onClick={() =>
                              setP((s) => ({
                                ...s,
                                stepsDone: { ...s.stepsDone, [key]: !s.stepsDone[key] },
                              }))
                            }
                            className="flex cursor-pointer items-center gap-[11px] border-none bg-transparent py-[7px] text-left"
                          >
                            <span
                              className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] text-white transition-all duration-200"
                              style={{
                                background: on ? accent : "#fff",
                                border: `1px solid ${on ? accent : "rgba(30,33,42,0.18)"}`,
                              }}
                            >
                              {on ? "✓" : ""}
                            </span>
                            <span
                              className="text-[14.5px] transition-colors duration-200"
                              style={{
                                color: on ? "var(--ink3)" : "var(--ink)",
                                textDecoration: on ? "line-through" : "none",
                              }}
                            >
                              {label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* gentle nudge */}
                {nudge && (
                  <div className="mt-3.5 flex animate-ts-rise items-center gap-3 rounded-[20px] border border-[rgba(194,154,58,0.25)] bg-[#F7F1E2] px-[18px] py-4">
                    <div className="flex-1">
                      <div className="text-[14.5px] font-semibold">Still on this?</div>
                      <div className="mt-0.5 text-[12.5px] font-light text-[var(--ink2)]">
                        No rush — continue or switch.
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        secRef.current = 0;
                        setNudge(false);
                        setNudgeHidden(true);
                      }}
                      className="cursor-pointer rounded-full border border-[rgba(30,33,42,0.08)] bg-white px-3.5 py-[9px] text-[12.5px] font-semibold text-[var(--ink)]"
                    >
                      Still on it
                    </button>
                    <button
                      onClick={() => {
                        secRef.current = 0;
                        setNudge(false);
                        setBuildIdx((i) => (i + 1) % Math.max(pending.length, 1));
                      }}
                      className="cursor-pointer border-none bg-transparent px-3.5 py-[9px] text-[12.5px] font-medium text-[var(--ink2)]"
                    >
                      Switch
                    </button>
                  </div>
                )}

                {/* focus timer */}
                <div className="glass-card mt-3.5 rounded-[26px] px-[22px] py-5 shadow-[0_16px_30px_-22px_rgba(42,50,68,0.4)]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink3)]">
                      Focus timer
                    </span>
                    <span
                      className="rounded-full px-[9px] py-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--ink2)]"
                      style={{ background: "var(--soft)", border: "1px solid var(--soft-bd)" }}
                    >
                      optional
                    </span>
                  </div>

                  {!timerActive && (
                    <>
                      <div className="mt-3 text-[13.5px] font-light leading-[1.45] text-[var(--ink2)]">
                        Start one only if it helps. Or just work — that counts too.
                      </div>
                      <div className="mt-3.5 flex gap-2">
                        {([15, 25, 45, "Custom"] as const).map((c) => {
                          const on = timer.sel === c;
                          return (
                            <button
                              key={c}
                              onClick={() => setTimer((t) => ({ ...t, sel: c }))}
                              className="flex-1 cursor-pointer rounded-[14px] py-[11px] font-mono text-[11.5px] transition-all duration-150"
                              style={{
                                background: on ? theme.done.bg : "rgba(255,255,255,0.6)",
                                border: `1px solid ${on ? theme.done.bd : "rgba(122,108,92,0.14)"}`,
                                color: on ? theme.done.label : "var(--ink2)",
                                fontWeight: on ? 600 : 400,
                              }}
                            >
                              {c === "Custom" ? "custom" : `${c} min`}
                            </button>
                          );
                        })}
                      </div>
                      {timer.sel === "Custom" && (
                        <div className="mt-3 flex items-center justify-center gap-[18px]">
                          <button
                            onClick={() => setTimer((t) => ({ ...t, custom: Math.max(5, t.custom - 5) }))}
                            className="h-9 w-9 cursor-pointer rounded-full border border-[rgba(122,108,92,0.16)] bg-[rgba(255,255,255,0.7)] text-[17px] text-[var(--ink)]"
                          >
                            −
                          </button>
                          <span className="min-w-16 text-center font-mono text-sm text-[var(--ink)]">
                            {timer.custom} min
                          </span>
                          <button
                            onClick={() => setTimer((t) => ({ ...t, custom: Math.min(120, t.custom + 5) }))}
                            className="h-9 w-9 cursor-pointer rounded-full border border-[rgba(122,108,92,0.16)] bg-[rgba(255,255,255,0.7)] text-[17px] text-[var(--ink)]"
                          >
                            +
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() =>
                          setTimer((t) => ({ ...t, left: startLen * 60, total: startLen * 60, running: true }))
                        }
                        className="mt-3.5 h-12 w-full cursor-pointer rounded-2xl border-none text-sm font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)]"
                        style={{ background: "var(--accent-bg)" }}
                      >
                        Start focus · {startLen} min
                      </button>
                    </>
                  )}

                  {timerActive && (
                    <>
                      <div className="mt-4 text-center font-mono text-[44px] font-medium tracking-[0.04em]">
                        {timerDisplay}
                      </div>
                      <div className="mt-3.5 h-[5px] overflow-hidden rounded-[3px] bg-[rgba(122,108,92,0.14)]">
                        <div
                          className="h-[5px] rounded-[3px] transition-[width] duration-1000 ease-linear"
                          style={{ background: "#5AA075", width: `${timerPct}%` }}
                        />
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => setTimer((t) => ({ ...t, running: !t.running }))}
                          className="h-[46px] flex-1 cursor-pointer rounded-[15px] text-[13.5px] font-semibold"
                          style={{
                            background: "var(--soft)",
                            border: "1px solid var(--soft-bd)",
                            color: theme.done.label,
                          }}
                        >
                          {timer.running ? "Pause" : "Resume"}
                        </button>
                        <button
                          onClick={() => setTimer((t) => ({ ...t, left: null, running: false }))}
                          className="h-[46px] flex-1 cursor-pointer rounded-[15px] border border-[rgba(122,108,92,0.16)] bg-[rgba(255,255,255,0.7)] text-[13.5px] font-medium text-[var(--ink2)]"
                        >
                          Stop timer
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* suggested commit */}
                {cur.commit && (
                  <div className="glass-card mt-3.5 rounded-[26px] px-[22px] py-5 shadow-[0_16px_30px_-22px_rgba(42,50,68,0.4)]">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink3)]">
                      Suggested commit
                    </span>
                    <div className="ts-scroll mt-3 overflow-x-auto whitespace-nowrap rounded-[14px] border border-[rgba(122,108,92,0.18)] bg-[#F7F2E6] px-4 py-[13px] font-mono text-[12.5px] text-[#5C5546]">
                      git commit -m &quot;{cur.commit}&quot;
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          try {
                            navigator.clipboard.writeText(cur.commit ?? "");
                          } catch {
                            // clipboard unavailable
                          }
                          toast("Commit message copied");
                        }}
                        className="h-11 flex-1 cursor-pointer rounded-[14px] border border-[rgba(122,108,92,0.16)] bg-[rgba(255,255,255,0.7)] text-[13px] font-medium text-[var(--ink)]"
                      >
                        Copy commit
                      </button>
                      <button
                        onClick={() => {
                          setP((s) => ({ ...s, committed: { ...s.committed, [cur.id]: true } }));
                          toast("Committed — nice");
                        }}
                        className="h-11 flex-1 cursor-pointer rounded-[14px] text-[13px] font-semibold transition-all duration-200"
                        style={{
                          background: committedNow ? "#E3F0E7" : "#fff",
                          border: `1px solid ${committedNow ? "rgba(90,160,117,0.4)" : "rgba(30,33,42,0.12)"}`,
                          color: committedNow ? "#3E7A56" : "var(--ink)",
                        }}
                      >
                        {committedNow ? "Committed ✓" : "Mark committed"}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => completeTask(cur.id, true)}
                  className="mt-[18px] h-14 w-full cursor-pointer rounded-[19px] border-none text-[15.5px] font-semibold text-white shadow-[0_16px_30px_-12px_var(--accent)]"
                  style={{ background: "var(--accent-bg)" }}
                >
                  Mark complete
                </button>
              </>
            )}

            <div className="h-[130px]" />
          </div>
        )}

        {/* ============ SKILLS ============ */}
        {tab === "skills" && (
          <SkillsTab
            onTestToday={addSkillTestCandidate}
            toast={toast}
            dateLabel={`GitHub radar · ${months[now.getMonth()].toLowerCase()} ${now.getDate()}`}
          />
        )}

        {/* ============ REVIEW ============ */}
        {tab === "review" && (
          <div className="animate-ts-fade px-[22px] pt-16">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink3)]">
              Evening review
            </span>
            <h1 className="mt-[9px] text-[31px] font-bold leading-[1.05] tracking-[-0.02em]">
              Close the loop.
            </h1>
            <p className="mt-3 text-sm font-light leading-normal text-[var(--ink2)]">
              One line is enough. Tap a prompt or just type.
            </p>

            <div className="mt-[18px] flex flex-wrap gap-2">
              {REVIEW_PROMPTS.map((pr) => (
                <button
                  key={pr}
                  onClick={() => setDraft(`${pr}: `)}
                  className="glass-pill cursor-pointer rounded-full px-3.5 py-[9px] font-mono text-[11px] text-[var(--ink2)] shadow-[0_8px_18px_-14px_rgba(42,50,68,0.4)]"
                >
                  {pr}
                </button>
              ))}
            </div>

            <div className="mt-[22px] flex flex-col gap-2.5">
              {p.msgs.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="glass-pill max-w-[84%] animate-ts-rise rounded-[20px] rounded-br-md px-4 py-[13px] text-sm leading-[1.45] text-[var(--ink)] shadow-[0_10px_22px_-16px_rgba(42,50,68,0.4)]">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[84%] animate-ts-rise rounded-[20px] rounded-bl-md border border-[var(--soft-bd)] bg-[var(--soft)] px-4 py-[13px] text-sm leading-[1.45] text-[var(--ink)] shadow-[0_10px_22px_-16px_rgba(42,50,68,0.4)]">
                      {m.text}
                    </div>
                  </div>
                ),
              )}
              {replying && (
                <div className="flex justify-start">
                  <div className="animate-ts-rise rounded-[20px] rounded-bl-md border border-[var(--soft-bd)] bg-[var(--soft)] px-4 py-[15px] shadow-[0_10px_22px_-16px_rgba(42,50,68,0.4)]">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ink3)] [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ink3)] [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ink3)]" />
                    </span>
                  </div>
                </div>
              )}
            </div>

            {p.msgs.some((m) => m.role === "user") && !p.generated && (
              <button
                onClick={generatePlan}
                disabled={planning}
                className="mt-[18px] h-[54px] w-full cursor-pointer rounded-[18px] border-none text-[14.5px] font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)] disabled:opacity-60"
                style={{ background: "var(--accent-bg)" }}
              >
                {planning ? "Generating…" : "Generate tomorrow's tasks"}
              </button>
            )}

            {p.generated && (
              <div className="mt-5 animate-ts-rise rounded-3xl border border-[rgba(90,160,117,0.32)] bg-[rgba(227,240,231,0.42)] p-[22px] shadow-[0_16px_30px_-22px_rgba(42,50,68,0.4)] backdrop-blur-[26px] backdrop-saturate-[1.4]">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#5AA075] text-xs text-white">
                    ✓
                  </span>
                  <span className="text-[16.5px] font-semibold">Tomorrow&apos;s candidates are ready.</span>
                </div>
                <div className="mt-4 flex flex-col gap-[9px]">
                  {plan.map((g) => (
                    <div key={g.id} className="group flex items-center gap-[11px]">
                      <span
                        className="h-2 w-2 flex-none rounded-full"
                        style={{ background: TYPE_COLORS[NEW_TO_OLD_TYPE[g.type] ?? "Build"][0] }}
                      />
                      <span className="flex-1 text-[13.5px] font-medium">{g.title}</span>
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-[var(--ink3)]">
                        {g.minutes} min
                      </span>
                      <button
                        onClick={() => dropPlanItem(g.id)}
                        title="Remove this task"
                        aria-label={`Remove ${g.title}`}
                        className="flex h-[22px] w-[22px] flex-none cursor-pointer items-center justify-center rounded-full border border-[rgba(30,33,42,0.12)] bg-white/70 text-[13px] leading-none text-[var(--ink2)]"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {plan.length === 0 && (
                    <div className="text-[13px] font-light text-[var(--ink2)]">
                      No tasks left — regenerate for a fresh set.
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-2.5">
                  <button
                    onClick={regeneratePlan}
                    disabled={planning}
                    className="h-[46px] flex-1 cursor-pointer rounded-[15px] border-none text-[13.5px] font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)] disabled:opacity-60"
                    style={{ background: "var(--accent-bg)" }}
                  >
                    {planning ? "Regenerating…" : "Regenerate plan"}
                  </button>
                </div>
                {plan.length > 0 && (
                  <div className="mt-3.5 font-mono text-[10px] tracking-[0.08em] text-[var(--ink3)]">
                    added to your Morning picks ↑
                  </div>
                )}
              </div>
            )}

            {loopClosed && (
              <div className="mt-4 pt-[22px] text-center">
                <svg width="20" height="20" viewBox="0 0 22 22" className="mx-auto">
                  <path d="M11 0 L13 9 L22 11 L13 13 L11 22 L9 13 L0 11 L9 9 Z" fill="#5AA075" />
                </svg>
                <div className="mt-2.5 text-lg font-semibold">Loop closed.</div>
                <div className="mt-1 font-mono text-[11px] text-[var(--ink3)]">see you tomorrow morning</div>
              </div>
            )}

            <div className="h-[210px]" />
          </div>
        )}
      </main>

      {/* review input bar */}
      {tab === "review" && (
        <div className="fixed bottom-[106px] left-1/2 z-[35] flex w-[calc(100%-28px)] max-w-[402px] -translate-x-1/2 items-center gap-2 rounded-[22px] border border-[rgba(30,33,42,0.07)] bg-[rgba(255,255,255,0.95)] p-2 shadow-[0_18px_36px_-18px_rgba(42,50,68,0.5)] backdrop-blur-[14px]">
          <button
            onClick={() => toast("Voice notes — coming soon")}
            title="Voice (coming soon)"
            className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full border border-[rgba(30,33,42,0.06)] bg-[#EAEEF3]"
          >
            <svg width="15" height="15" viewBox="0 0 22 22">
              <rect x="8" y="2" width="6" height="11" rx="3" fill="#565C66" />
              <path d="M5 11 a6 6 0 0 0 12 0" fill="none" stroke="#565C66" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="11" y1="17.5" x2="11" y2="20.5" stroke="#565C66" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Tell HamLoop what happened today…"
            className="min-w-0 flex-1 border-none bg-transparent text-[14.5px] text-[var(--ink)] outline-none placeholder:text-[#ABAC9F]"
          />
          <button
            onClick={send}
            title="Send"
            className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full border-none pb-0.5 text-[17px] text-white"
            style={{ background: "var(--accent-bg)" }}
          >
            ↑
          </button>
        </div>
      )}

      {/* bottom tab bar — adaptive frosted glass */}
      <nav
        className="fixed bottom-0 left-1/2 z-40 grid w-full max-w-[430px] -translate-x-1/2 grid-cols-4 gap-1 px-3.5 pt-[11px] backdrop-blur-[28px] backdrop-saturate-[1.7]"
        style={{
          background: theme.navBg,
          borderTop: `1px solid ${theme.navBorder}`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 -10px 26px -18px rgba(30,33,42,0.45)",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        }}
      >
        {(
          [
            ["today", "Today", <path key="i" d="M11 1 L13 9 L21 11 L13 13 L11 21 L9 13 L1 11 L9 9 Z" fill="currentColor" />],
            ["build", "Build", <path key="i" d="M11 2 L20 11 L11 20 L2 11 Z" fill="currentColor" />],
            [
              "skills",
              "Skills",
              <g key="i" fill="currentColor">
                <circle cx="6.5" cy="6.5" r="3" />
                <circle cx="15.5" cy="6.5" r="3" />
                <circle cx="6.5" cy="15.5" r="3" />
                <circle cx="15.5" cy="15.5" r="3" />
              </g>,
            ],
            [
              "review",
              "Review",
              <g key="i" fill="none" stroke="currentColor" strokeWidth="1.9">
                <circle cx="11" cy="11" r="8" />
                <polyline points="7.6,11.3 10,13.7 14.6,8.7" strokeLinecap="round" strokeLinejoin="round" />
              </g>,
            ],
          ] as [Tab, string, React.ReactNode][]
        ).map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => goTab(k)}
            className="flex cursor-pointer flex-col items-center gap-1.5 border-none bg-transparent py-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] transition-colors duration-200"
            style={{ color: tabColor(k) }}
          >
            <svg width="21" height="21" viewBox="0 0 22 22">
              {icon}
            </svg>
            {label}
          </button>
        ))}
      </nav>

      {/* quick add sheet */}
      {quickOpen && (
        <Sheet onClose={() => setQuickOpen(false)} label="Quick add">
          <input
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && quickAdd(true)}
            placeholder="e.g. Go for a run"
            autoFocus
            className="mt-3 h-[52px] w-full rounded-2xl border border-[rgba(30,33,42,0.08)] bg-white px-4 text-[15px] text-[var(--ink)] outline-none placeholder:text-[#ABAC9F]"
          />
          <div className="mt-3 flex gap-2">
            {(["Build", "Health", "Life", "Admin"] as TaskType[]).map((tp) => {
              const on = quickType === tp;
              const [tc, tb] = TYPE_COLORS[tp];
              return (
                <button
                  key={tp}
                  onClick={() => setQuickType(tp)}
                  className="cursor-pointer rounded-full px-[13px] py-2 font-mono text-[10px] uppercase tracking-[0.1em] transition-all duration-150"
                  style={{
                    background: on ? tb : "#fff",
                    border: `1px solid ${on ? tc : "rgba(30,33,42,0.08)"}`,
                    color: on ? tc : "var(--ink3)",
                  }}
                >
                  {tp}
                </button>
              );
            })}
          </div>
          <div className="mt-[18px] flex gap-2.5">
            <button
              onClick={() => quickAdd(false)}
              className="h-[52px] flex-1 cursor-pointer rounded-[17px] bg-[var(--soft)] text-sm font-medium text-[var(--ink2)]"
              style={{ border: "1px solid var(--soft-bd)" }}
            >
              Add as candidate
            </button>
            <button
              onClick={() => quickAdd(true)}
              className="h-[52px] flex-[1.3] cursor-pointer rounded-[17px] border-none text-sm font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)]"
              style={{ background: "var(--accent-bg)" }}
            >
              Add to Today
            </button>
          </div>
        </Sheet>
      )}

      {/* completion overlay */}
      {celebrate.on && (
        <div className="fixed inset-0 z-[60] flex animate-ts-fade flex-col items-center justify-center gap-4 bg-[rgba(243,246,250,0.93)] backdrop-blur-[10px]">
          <div
            className="flex h-[92px] w-[92px] animate-ts-pop items-center justify-center rounded-full shadow-[0_26px_50px_-18px_var(--accent)]"
            style={{ background: "var(--accent-bg)" }}
          >
            <svg width="36" height="36" viewBox="0 0 22 22">
              <polyline
                points="5,11.5 9.5,16 17,7"
                fill="none"
                stroke="#fff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="text-[22px] font-semibold tracking-[-0.01em] text-[#1E2127]">One loop closer.</div>
          <div className="font-mono text-[11px] tracking-[0.08em] text-[#959AA4]">{celebrate.sub}</div>
        </div>
      )}

      {/* toast */}
      {toastText && (
        <div className="fixed bottom-[118px] left-1/2 z-[55] max-w-[86%] -translate-x-1/2 animate-ts-rise overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-[#1E2127] px-[18px] py-2.5 font-mono text-[11px] tracking-[0.06em] text-[#EAEEF3] shadow-[0_14px_30px_-12px_rgba(20,22,16,0.6)]">
          {toastText}
        </div>
      )}
    </div>
  );
}

/* ---------- skills tab ---------- */

const SKILL_CHIP: Record<SkillStatus, [string, string]> = {
  new: ["#BE5E37", "#F4E4DA"],
  viewed: ["#8A8E84", "#ECEDE8"],
  saved: ["#5AA075", "#E3F0E7"],
  testing: ["#6E72C8", "#E8E9F7"],
  useful: ["#3E7A56", "#D9EBDF"],
  archived: ["#ABAC9F", "#F1F1EA"],
};

function SkillsTab({
  onTestToday,
  toast,
  dateLabel,
}: {
  onTestToday: (skill: Skill) => void;
  toast: (msg: string) => void;
  dateLabel: string;
}) {
  const [view, setView] = useState<"radar" | "library">("radar");
  const [tools, setTools] = useState<RadarTool[]>([]);
  const [radarSource, setRadarSource] = useState<RadarResponse["source"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [useSkill, setUseSkill] = useState<Skill | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Saved skills live in the Sprint 1 localStorage layer; load them on mount.
  useEffect(() => {
    setSkills(getSkills());
  }, []);

  // Fetch the radar from the API; re-runs when Retry bumps reloadKey.
  useEffect(() => {
    const ctrl = new AbortController();
    let active = true;
    setLoading(true);
    setError(false);
    fetch("/api/github-radar", { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json() as Promise<RadarResponse>;
      })
      .then((data) => {
        if (!active) return;
        setTools(data.tools);
        setRadarSource(data.source);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
      ctrl.abort();
    };
  }, [reloadKey]);

  const radarOn = view === "radar";
  const libCount = skills.filter((s) => s.status !== "archived").length;
  const savedUrls = new Set(skills.map((s) => s.url).filter(Boolean));

  const persist = (next: Skill[]) => {
    setSkills(next);
    saveSkills(next);
  };

  const saveSkill = (t: RadarTool) => {
    if (savedUrls.has(t.url) || skills.some((s) => s.name === t.name)) {
      toast("Already in your library");
      return;
    }
    const now = new Date().toISOString();
    const skill: Skill = {
      id: `sk-${Date.now()}`,
      name: t.name,
      category: t.category,
      description: t.description,
      url: t.url,
      stars: t.stars,
      language: t.language,
      topics: t.topics,
      source: t.source,
      status: "saved",
      whySaved: t.whyRelevant,
      nextTestTask: t.suggestedTestTask,
      createdAt: now,
      updatedAt: now,
    };
    persist([...skills, skill]);
    toast("Saved to your library");
  };

  const setStatus = (id: string, status: SkillStatus, msg: string) => {
    persist(skills.map((s) => (s.id === id ? { ...s, status, updatedAt: new Date().toISOString() } : s)));
    toast(msg);
  };

  return (
    <div className="animate-ts-fade px-[22px] pt-16">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink3)]">{dateLabel}</span>
      <h1 className="mt-[9px] text-[31px] font-bold leading-[1.05] tracking-[-0.02em]">Skills</h1>

      <div className="mt-5 flex gap-1 rounded-2xl bg-[rgba(30,33,42,0.05)] p-1">
        {(
          [
            ["radar", "Daily radar"],
            ["library", `My library · ${libCount}`],
          ] as const
        ).map(([k, label]) => {
          const on = view === k;
          return (
            <button
              key={k}
              onClick={() => setView(k)}
              className="flex-1 cursor-pointer rounded-[13px] border-none py-[11px] text-[13.5px] font-semibold transition-all duration-200"
              style={{
                background: on ? "#fff" : "transparent",
                color: on ? "var(--ink)" : "var(--ink3)",
                boxShadow: on ? "0 6px 14px -8px rgba(42,50,68,0.5)" : "none",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {radarOn && (
        <div className="mt-[18px]">
          {loading && <RadarLoading />}

          {!loading && error && (
            <div className="glass-card rounded-[22px] px-[18px] py-7 text-center shadow-[0_12px_24px_-18px_rgba(42,50,68,0.4)]">
              <div className="text-[15px] font-semibold">Couldn&apos;t reach the radar.</div>
              <div className="mt-1 text-[13px] font-light text-[var(--ink2)]">
                Check your connection and try again.
              </div>
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="mt-4 cursor-pointer rounded-full border-none px-[22px] py-[11px] text-[13px] font-semibold text-white shadow-[0_14px_26px_-12px_var(--accent)]"
                style={{ background: "var(--accent-bg)" }}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="flex flex-col gap-2.5">
              {radarSource === "mock-fallback" && (
                <div className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink3)]">
                  Showing sample tools · GitHub unavailable
                </div>
              )}
              {tools.map((t) => {
                const saved = savedUrls.has(t.url) || skills.some((s) => s.name === t.name);
                const open = expandedId === t.id;
                const [cc, cb] = SKILL_CHIP[t.status];
                return (
                  <div
                    key={t.id}
                    className="glass-card rounded-[22px] px-[18px] pb-3.5 pt-[18px] shadow-[0_12px_24px_-18px_rgba(42,50,68,0.4)]"
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <span className="text-base font-semibold tracking-[-0.01em]">{t.name}</span>
                      <span
                        className="flex-none rounded-full px-[9px] py-1 font-mono text-[9px] uppercase tracking-[0.12em]"
                        style={{ background: cb, color: cc }}
                      >
                        {t.status}
                      </span>
                    </div>
                    <div className="mt-[5px] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink3)]">
                      {t.category} · ★ {t.stars.toLocaleString()}
                      {t.language ? ` · ${t.language}` : ""}
                    </div>
                    <div className="mt-2 text-[13.5px] font-light leading-[1.45] text-[var(--ink2)]">
                      {t.description}
                    </div>

                    {open && (
                      <div className="mt-3 flex flex-col gap-3 border-t border-[rgba(30,33,42,0.06)] pt-3">
                        <DetailRow label="Why it's relevant" text={t.whyRelevant} />
                        <DetailRow label="Suggested test task" text={t.suggestedTestTask} />
                        {t.topics.length > 0 && (
                          <div>
                            <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--ink3)]">
                              Topics
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {t.topics.slice(0, 8).map((tp) => (
                                <span
                                  key={tp}
                                  className="rounded-full bg-[rgba(30,33,42,0.05)] px-2.5 py-1 font-mono text-[10px] text-[var(--ink2)]"
                                >
                                  {tp}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink3)]">
                          <span>★ {t.stars.toLocaleString()}</span>
                          {t.language && <span>{t.language}</span>}
                        </div>
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] text-[var(--accent)] underline underline-offset-2"
                        >
                          {t.url.replace("https://", "")} ↗
                        </a>
                      </div>
                    )}

                    <div className="mt-[13px] flex gap-2">
                      <button
                        onClick={() => setExpandedId(open ? null : t.id)}
                        className="cursor-pointer rounded-full border border-[rgba(30,33,42,0.06)] bg-[#EAEEF3] px-4 py-[9px] text-[12.5px] font-semibold text-[var(--ink)]"
                      >
                        {open ? "Hide" : "View"}
                      </button>
                      <button
                        onClick={() => saveSkill(t)}
                        className="cursor-pointer rounded-full px-4 py-[9px] text-[12.5px] font-semibold transition-all duration-200"
                        style={{
                          background: saved ? "#E3F0E7" : "#fff",
                          border: `1px solid ${saved ? "rgba(90,160,117,0.4)" : "rgba(30,33,42,0.12)"}`,
                          color: saved ? "#3E7A56" : "var(--ink)",
                        }}
                      >
                        {saved ? "Saved ✓" : "Save"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!radarOn && (
        <div className="mt-[18px] flex flex-col gap-2.5">
          {skills.length === 0 && (
            <div className="glass-card rounded-[22px] px-[18px] py-7 text-center shadow-[0_12px_24px_-18px_rgba(42,50,68,0.4)]">
              <div className="text-[15px] font-semibold">No saved skills yet.</div>
              <div className="mt-1 text-[13px] font-light text-[var(--ink2)]">
                Save a tool from the Daily radar to start your library.
              </div>
            </div>
          )}
          {skills.map((l) => {
            const [cc, cb] = SKILL_CHIP[l.status];
            return (
              <div
                key={l.id}
                className="glass-card rounded-[22px] px-[18px] pb-3.5 pt-[18px] shadow-[0_12px_24px_-18px_rgba(42,50,68,0.4)]"
                style={{ opacity: l.status === "archived" ? 0.55 : 1 }}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-base font-semibold tracking-[-0.01em]">{l.name}</span>
                  <span
                    className="flex-none rounded-full px-[9px] py-1 font-mono text-[9px] uppercase tracking-[0.12em]"
                    style={{ background: cb, color: cc }}
                  >
                    {l.status}
                  </span>
                </div>
                <div className="mt-[5px] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink3)]">
                  {l.category ?? "Tool"}
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink3)]">
                  next · {l.nextTestTask || "pick one small test"}
                </div>
                <div className="mt-[13px] flex flex-wrap gap-[7px]">
                  <button
                    onClick={() => onTestToday(l)}
                    className="cursor-pointer rounded-full border-none bg-[#F4E4DA] px-[13px] py-2 text-xs font-semibold text-[#A4502C]"
                  >
                    Test Today
                  </button>
                  <button
                    onClick={() => setUseSkill(l)}
                    className="cursor-pointer rounded-full border border-[rgba(30,33,42,0.06)] bg-[#EAEEF3] px-[13px] py-2 text-xs font-semibold text-[var(--ink)]"
                  >
                    Use
                  </button>
                  <button
                    onClick={() => setStatus(l.id, "useful", "Marked useful")}
                    className="cursor-pointer rounded-full border border-[rgba(30,33,42,0.1)] bg-transparent px-[13px] py-2 text-xs font-medium text-[var(--ink2)]"
                  >
                    Mark Useful
                  </button>
                  <button
                    onClick={() => setStatus(l.id, "archived", "Archived")}
                    className="cursor-pointer rounded-full border-none bg-transparent px-[13px] py-2 text-xs font-medium text-[var(--ink3)]"
                  >
                    Archive
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="h-[130px]" />

      {/* use panel */}
      {useSkill && (
        <Sheet onClose={() => setUseSkill(null)} label="Use skill">
          <div className="mt-2 text-[23px] font-semibold tracking-[-0.02em]">{useSkill.name}</div>
          <div className="mt-4 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--ink3)]">Install</div>
          <div className="ts-scroll mt-1.5 overflow-x-auto whitespace-nowrap rounded-[14px] bg-[#1E2127] px-4 py-3 font-mono text-xs text-[#D8DCCF]">
            # install command — add yours after the first run
          </div>
          <div className="mt-3.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--ink3)]">
            Example use
          </div>
          <div className="ts-scroll mt-1.5 overflow-x-auto whitespace-nowrap rounded-[14px] bg-[#E7EBF1] px-4 py-3 font-mono text-xs text-[var(--ink2)]">
            {useSkill.nextTestTask || "Try it on one small, real task."}
          </div>
          <div className="mt-3.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--ink3)]">Notes</div>
          <div className="mt-1.5 text-[13.5px] font-light leading-normal text-[var(--ink2)]">
            {useSkill.whySaved ? `Saved because: ${useSkill.whySaved} ` : ""}Add your own notes after the first real use.
          </div>
          {useSkill.url && (
            <a
              href={useSkill.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3.5 block font-mono text-[11px] text-[var(--accent)] underline underline-offset-2"
            >
              {useSkill.url.replace("https://", "")} ↗
            </a>
          )}
          <button
            onClick={() => setUseSkill(null)}
            className="mt-5 h-[50px] w-full cursor-pointer rounded-[17px] border border-[rgba(30,33,42,0.06)] bg-[#EAEEF3] text-sm font-semibold text-[var(--ink)]"
          >
            Done
          </button>
        </Sheet>
      )}
    </div>
  );
}

function DetailRow({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--ink3)]">{label}</div>
      <div className="text-sm leading-normal text-[var(--ink)]">{text}</div>
    </div>
  );
}

function RadarLoading() {
  return (
    <div className="flex flex-col gap-2.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="glass-card rounded-[22px] px-[18px] pb-4 pt-[18px] shadow-[0_12px_24px_-18px_rgba(42,50,68,0.4)]"
        >
          <div className="h-3.5 w-1/2 animate-pulse rounded-full bg-[rgba(30,33,42,0.08)]" />
          <div className="mt-3 h-2.5 w-1/3 animate-pulse rounded-full bg-[rgba(30,33,42,0.06)]" />
          <div className="mt-3 h-2.5 w-full animate-pulse rounded-full bg-[rgba(30,33,42,0.05)]" />
        </div>
      ))}
    </div>
  );
}
