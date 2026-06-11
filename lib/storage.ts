// localStorage-backed persistence for the canonical HamLoop model.
//
// Each entity gets its own key so reads and writes stay small and independent.
// Every accessor is SSR-safe: on the server (no `window`) reads return empty
// defaults and writes are no-ops, so these helpers can be imported anywhere and
// called freely from client components after mount.
//
// Keys use the "hamloop:" prefix. Data written under the old "taostack:" keys is
// migrated to the new keys on first access (see ensureMigrated), so the rename
// never orphans existing localStorage.

import type { DailyBasic, DailyReview, Skill, Task } from "./types";

const KEYS = {
  tasks: "hamloop:tasks",
  skills: "hamloop:skills",
  reviews: "hamloop:reviews",
  dailyBasics: "hamloop:dailyBasics",
} as const;

// Legacy (pre-HamLoop) key → current key. Data under a legacy key is copied to
// its new key on first access, then the legacy key is removed.
const LEGACY_KEYS: Record<string, string> = {
  "taostack:tasks": KEYS.tasks,
  "taostack:skills": KEYS.skills,
  "taostack:reviews": KEYS.reviews,
  "taostack:dailyBasics": KEYS.dailyBasics,
};

const isBrowser = typeof window !== "undefined";

let migrated = false;

/** One-time copy of any legacy "taostack:" data to the new "hamloop:" keys. */
function ensureMigrated(): void {
  if (migrated || !isBrowser) return;
  migrated = true;
  try {
    for (const [legacyKey, newKey] of Object.entries(LEGACY_KEYS)) {
      if (window.localStorage.getItem(newKey) === null) {
        const value = window.localStorage.getItem(legacyKey);
        if (value !== null) {
          window.localStorage.setItem(newKey, value);
          window.localStorage.removeItem(legacyKey);
        }
      }
    }
  } catch {
    // Storage unavailable — nothing to migrate.
  }
}

/** Read and JSON-parse a key, returning `fallback` on miss, SSR, or corruption. */
function read<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  ensureMigrated();
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Missing, unavailable, or corrupted storage — fall back cleanly.
    return fallback;
  }
}

/** JSON-serialize and write a key. No-op on the server or if storage is blocked/full. */
function write<T>(key: string, value: T): void {
  if (!isBrowser) return;
  ensureMigrated();
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode, quota exceeded) — degrade to in-memory.
  }
}

/* ---------- Tasks ---------- */

export function getTasks(): Task[] {
  return read<Task[]>(KEYS.tasks, []);
}

export function saveTasks(tasks: Task[]): void {
  write(KEYS.tasks, tasks);
}

/* ---------- Skills ---------- */

export function getSkills(): Skill[] {
  return read<Skill[]>(KEYS.skills, []);
}

export function saveSkills(skills: Skill[]): void {
  write(KEYS.skills, skills);
}

/* ---------- Daily reviews ---------- */

export function getReviews(): DailyReview[] {
  return read<DailyReview[]>(KEYS.reviews, []);
}

/**
 * Upsert a single day's review. Reviews are keyed by `date` (one per day), so
 * saving an existing date replaces that day's review rather than duplicating it.
 */
export function saveReview(review: DailyReview): void {
  const reviews = getReviews();
  const idx = reviews.findIndex((r) => r.date === review.date);
  if (idx >= 0) reviews[idx] = review;
  else reviews.push(review);
  write(KEYS.reviews, reviews);
}

/* ---------- Daily basics ---------- */

export function getDailyBasics(): DailyBasic[] {
  return read<DailyBasic[]>(KEYS.dailyBasics, []);
}

export function saveDailyBasics(basics: DailyBasic[]): void {
  write(KEYS.dailyBasics, basics);
}
