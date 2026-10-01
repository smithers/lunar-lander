// Local high-score table (spec §10, an addition to the original). Versioned localStorage
// with an in-memory fallback when storage is missing, blocked or throws.

export interface HighScore {
  initials: string;
  score: number;
}

/** The subset of the Web Storage API we use. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const HIGH_SCORE_KEY = 'lunar-lander.highscores';
export const HIGH_SCORE_VERSION = 1;
export const MAX_SCORES = 10;

export interface HighScores {
  list(): HighScore[];
  qualifies(score: number): boolean;
  add(initials: string, score: number): void;
}

function isEntry(e: unknown): e is HighScore {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as HighScore).initials === 'string' &&
    typeof (e as HighScore).score === 'number' &&
    Number.isFinite((e as HighScore).score)
  );
}

function load(storage: StorageLike | null): HighScore[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(HIGH_SCORE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { version?: unknown; scores?: unknown };
    if (data.version !== HIGH_SCORE_VERSION || !Array.isArray(data.scores)) return [];
    if (!data.scores.every(isEntry)) return [];
    // Stable sort, so a hand-edited or reordered table still ranks correctly.
    return [...(data.scores as HighScore[])].sort((a, b) => b.score - a.score).slice(0, MAX_SCORES);
  } catch {
    return [];
  }
}

export function createHighScores(storage: StorageLike | null): HighScores {
  let table = load(storage);
  const save = () => {
    if (!storage) return;
    try {
      storage.setItem(HIGH_SCORE_KEY, JSON.stringify({ version: HIGH_SCORE_VERSION, scores: table }));
    } catch {
      // Storage blocked or full: keep the in-memory table for this session.
    }
  };
  return {
    list: () => table.map((e) => ({ ...e })),
    qualifies: (score) => score > 0 && (table.length < MAX_SCORES || score > table[table.length - 1]!.score),
    add(initials, score) {
      const entry = { initials, score };
      const i = table.findIndex((e) => e.score < score);
      table = i < 0 ? [...table, entry] : [...table.slice(0, i), entry, ...table.slice(i)];
      table = table.slice(0, MAX_SCORES);
      save();
    },
  };
}

/** The browser's localStorage, or null if even touching it throws. */
export function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
