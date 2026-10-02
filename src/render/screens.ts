// Non-flight screens: attract pages, mode select (Ready), game over and initials entry
// (spec §9, §10; the high-score and controls pages are additions to the original).
import {
  FLASH_FRAMES,
  FUEL_PER_COIN,
  INSERT_COIN_FLASH_FRAMES,
  MISSION_NAMES,
} from '../sim/constants';
import { GameState, type Game } from '../sim/game';
import type { HighScore } from '../storage/highscores';
import { SCREEN_W } from './camera';
import { drawText, textWidth } from './font';
import type { Vector } from './vector';

/** Each attract page shows for ≈ 6 s (spec §9). */
export const ATTRACT_PAGE_FRAMES = 246;
export const ATTRACT_PAGES = ['title', 'scores', 'controls'] as const;
export type AttractPage = (typeof ATTRACT_PAGES)[number];

export const CONTROLS: [string, string][] = [
  ['SPACE', 'FIRE ENGINE (HOLD)'],
  ['UP / W', 'MORE POWER'],
  ['DOWN / S', 'LESS POWER'],
  ['LEFT / A', 'ROTATE LEFT'],
  ['RIGHT / D', 'ROTATE RIGHT'],
  ['X', 'ABORT'],
  ['5 OR C', 'INSERT COIN'],
  ['1', 'START'],
  ['TAB', 'SELECT GAME'],
  ['M', 'SOUND ON/OFF'],
];

export function attractPage(frame: number): AttractPage {
  return ATTRACT_PAGES[Math.floor(frame / ATTRACT_PAGE_FRAMES) % ATTRACT_PAGES.length]!;
}

/**
 * Text-heavy screens drop the terrain so nothing is drawn over the mountains. On the others
 * the text sits above the highest possible peak (screen y ≈ 367).
 */
export function showTerrain(g: Game): boolean {
  if (g.state === GameState.Initials) return false;
  if (g.state === GameState.Attract) return attractPage(g.frame) === 'title';
  return true;
}

const flash = (g: Game, period: number) => ((g.frame / period) & 1) === 0;

function centered(v: Vector, lines: string[], y: number, size = 20, gap = 34): void {
  lines.forEach((line, i) => drawText(v, line, SCREEN_W / 2, y + i * gap, size, 'center'));
}

function insertCoins(v: Vector, g: Game, y: number): void {
  if (flash(g, INSERT_COIN_FLASH_FRAMES)) centered(v, ['INSERT COINS'], y);
  centered(v, [`${FUEL_PER_COIN / 100} FUEL UNITS PER COIN`], y + 38, 14);
}

function drawScores(v: Vector, scores: HighScore[], y: number): void {
  centered(v, ['HIGH SCORES'], y, 24);
  if (scores.length === 0) {
    centered(v, ['NO SCORES YET'], y + 80, 16);
    return;
  }
  scores.forEach((e, i) => {
    const row = y + 60 + i * 30;
    drawText(v, `${String(i + 1).padStart(2, ' ')}.`, 360, row, 16);
    drawText(v, e.initials.replace(/ /g, '_'), 430, row, 16);
    drawText(v, String(e.score), 660, row, 16, 'right');
  });
}

function drawControls(v: Vector, y: number): void {
  centered(v, ['CONTROLS'], y, 24);
  CONTROLS.forEach(([keys, action], i) => {
    const row = y + 56 + i * 30;
    drawText(v, keys, 290, row, 16);
    drawText(v, action, 520, row, 16);
  });
}

/** Mission list with the selected mission bracketed. */
function drawMissions(v: Vector, g: Game, y: number): void {
  const labels = MISSION_NAMES.map((n, i) => (i === g.mission ? `<${n}>` : ` ${n} `));
  const gap = 24;
  const total = labels.reduce((w, l) => w + textWidth(l, 16), 0) + gap * (labels.length - 1);
  let x = SCREEN_W / 2 - total / 2;
  for (const l of labels) {
    drawText(v, l, x, y, 16);
    x += textWidth(l, 16) + gap;
  }
}

export function drawScreens(v: Vector, g: Game, scores: HighScore[]): void {
  const s = g.lander;
  switch (g.state) {
    case GameState.Attract: {
      const page = attractPage(g.frame);
      if (page === 'title') {
        centered(v, ['LUNAR LANDER'], 190, 40);
        insertCoins(v, g, 262);
      } else {
        if (page === 'scores') drawScores(v, scores, 220);
        else drawControls(v, 200);
        insertCoins(v, g, 640);
      }
      break;
    }
    case GameState.Ready:
      centered(v, ['SELECT OPTION', 'PUSH START'], 160, 22, 40);
      centered(v, [`${Math.floor(s.fuel / 100)} FUEL UNITS`], 250, 18);
      drawMissions(v, g, 300);
      centered(v, ['TAB  SELECT GAME      1  START      5  ADD COIN'], 335, 12);
      break;
    case GameState.GameOver:
      centered(v, ['GAME OVER'], 230, 32);
      centered(v, [`SCORE ${g.score}`], 290, 20);
      break;
    case GameState.Initials: {
      centered(v, ['GREAT SCORE', String(g.score)], 230, 24, 44);
      centered(v, ['ENTER YOUR INITIALS'], 360, 18);
      const ini = g.initials;
      const size = 40;
      const step = 64;
      const x0 = SCREEN_W / 2 - step;
      ini.letters.forEach((ch, i) => {
        drawText(v, ch === ' ' ? '_' : ch, x0 + i * step, 460, size, 'center');
        if (i === ini.pos && flash(g, FLASH_FRAMES)) v.line(x0 + i * step - 18, 474, x0 + i * step + 18, 474);
      });
      centered(v, ['LEFT / RIGHT  CHANGE LETTER     SPACE  CONFIRM'], 540, 12);
      break;
    }
  }
}
