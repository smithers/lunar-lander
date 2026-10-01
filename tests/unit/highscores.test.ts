import { describe, expect, it } from 'vitest';
import { createHighScores, HIGH_SCORE_KEY, MAX_SCORES, type StorageLike } from '../../src/storage/highscores';

function memStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('high scores', () => {
  it('orders descending, keeps earlier entries ahead on ties, caps at 10', () => {
    const hs = createHighScores(memStorage());
    for (let i = 1; i <= 12; i++) hs.add('A' + String.fromCharCode(64 + i) + 'A', i * 10);
    hs.add('TIE', 120);
    const list = hs.list();
    expect(list).toHaveLength(MAX_SCORES);
    expect(list[0]).toEqual({ initials: 'ALA', score: 120 });
    expect(list[1]).toEqual({ initials: 'TIE', score: 120 });
    expect(list.map((e) => e.score)).toEqual([...list.map((e) => e.score)].sort((a, b) => b - a));
  });
  it('qualifies only positive scores that beat the table when full', () => {
    const hs = createHighScores(memStorage());
    expect(hs.qualifies(0)).toBe(false);
    expect(hs.qualifies(5)).toBe(true);
    for (let i = 0; i < 10; i++) hs.add('AAA', 100);
    expect(hs.qualifies(100)).toBe(false);
    expect(hs.qualifies(101)).toBe(true);
  });
  it('round-trips through storage', () => {
    const st = memStorage();
    createHighScores(st).add('JEF', 250);
    expect(createHighScores(st).list()).toEqual([{ initials: 'JEF', score: 250 }]);
    expect(JSON.parse(st.data.get(HIGH_SCORE_KEY)!).version).toBe(1);
  });
  it('a schema version mismatch or corrupt data resets the table', () => {
    const st = memStorage();
    st.setItem(HIGH_SCORE_KEY, JSON.stringify({ version: 0, scores: [{ initials: 'OLD', score: 9 }] }));
    expect(createHighScores(st).list()).toEqual([]);
    st.setItem(HIGH_SCORE_KEY, '{not json');
    expect(createHighScores(st).list()).toEqual([]);
    st.setItem(HIGH_SCORE_KEY, JSON.stringify({ version: 1, scores: [{ initials: 5, score: 'x' }] }));
    expect(createHighScores(st).list()).toEqual([]);
  });
  it('falls back to memory when storage throws or is missing', () => {
    for (const st of [throwing, null]) {
      const hs = createHighScores(st);
      expect(() => hs.add('MEM', 30)).not.toThrow();
      expect(hs.list()).toEqual([{ initials: 'MEM', score: 30 }]);
    }
  });
});

describe('review pass 1', () => {
  it('sorts a loaded table that was stored out of order', () => {
    const st = memStorage();
    const scores = Array.from({ length: 10 }, (_, i) => ({ initials: 'AAA', score: (i + 1) * 100 }));
    st.setItem(HIGH_SCORE_KEY, JSON.stringify({ version: 1, scores }));
    const hs = createHighScores(st);
    expect(hs.list()[0]!.score).toBe(1000);
    expect(hs.qualifies(150)).toBe(true);
  });
});
