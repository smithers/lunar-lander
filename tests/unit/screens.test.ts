import { describe, expect, it } from 'vitest';
import { ATTRACT_PAGE_FRAMES, attractPage, CONTROLS } from '../../src/render/screens';
import { hasGlyph } from '../../src/render/font';

describe('attract pages', () => {
  it('cycles title -> scores -> controls every ATTRACT_PAGE_FRAMES', () => {
    expect(attractPage(0)).toBe('title');
    expect(attractPage(ATTRACT_PAGE_FRAMES)).toBe('scores');
    expect(attractPage(2 * ATTRACT_PAGE_FRAMES)).toBe('controls');
    expect(attractPage(3 * ATTRACT_PAGE_FRAMES)).toBe('title');
  });
  it('the controls page lists the spec §2.6 keys in drawable characters', () => {
    const text = CONTROLS.flat().join('');
    for (const ch of text) expect(hasGlyph(ch)).toBe(true);
    expect(CONTROLS).toEqual(
      expect.arrayContaining([
        ['SPACE', 'FIRE ENGINE (HOLD)'],
        ['UP / W', 'MORE POWER'],
        ['DOWN / S', 'LESS POWER'],
        ['X', 'ABORT'],
        ['5 OR C', 'INSERT COIN'],
        ['1', 'START'],
        ['TAB', 'SELECT GAME'],
      ]),
    );
  });
});
