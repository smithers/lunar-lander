// HUD and on-screen messages (spec §6.1, §8, §9).
import {
  ALT_PER_SB,
  FLASH_FRAMES,
  FUEL_PER_COIN,
  INSERT_COIN_FLASH_FRAMES,
  LOW_FUEL,
  MISSION_NAMES,
} from '../sim/constants';
import { GameState, type Game } from '../sim/game';
import { disp } from '../sim/landing';
import { groundY } from '../sim/terrain';
import { SCREEN_H, SCREEN_W } from './camera';
import { drawText, textWidth } from './font';
import type { Vector } from './vector';

const SIZE = 16;
const ROW = 30;
const TOP = 46;

export function altitudeHud(g: Game, x = g.lander.x, y = g.lander.y): number {
  return Math.max(0, Math.floor((y - groundY(g.terrain, x)) * ALT_PER_SB));
}

const pad4 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(4, '0');

function arrow(v: Vector, x: number, y: number, dir: 'left' | 'right' | 'up' | 'down'): void {
  const h = SIZE * 0.5;
  const cy = y - SIZE / 2;
  if (dir === 'right' || dir === 'left') {
    const s = dir === 'right' ? 1 : -1;
    v.line(x - s * 10, cy, x + s * 10, cy);
    v.line(x + s * 10, cy, x + s * 3, cy - h);
    v.line(x + s * 10, cy, x + s * 3, cy + h);
  } else {
    const s = dir === 'down' ? 1 : -1;
    v.line(x, cy - s * 10, x, cy + s * 10);
    v.line(x, cy + s * 10, x - h, cy + s * 3);
    v.line(x, cy + s * 10, x + h, cy + s * 3);
  }
}

export function drawHud(v: Vector, g: Game, shipX: number, shipY: number): void {
  const s = g.lander;
  const inGame = g.state === GameState.Playing || g.state === GameState.Landed;
  const minutes = Math.floor(g.roundSeconds / 60);
  const seconds = String(g.roundSeconds % 60).padStart(2, '0');

  drawText(v, 'SCORE', 48, TOP, SIZE);
  drawText(v, pad4(g.score), 176, TOP, SIZE);
  drawText(v, 'TIME', 48, TOP + ROW, SIZE);
  drawText(v, `${minutes}:${seconds}`, 176, TOP + ROW, SIZE);
  drawText(v, 'FUEL', 48, TOP + 2 * ROW, SIZE);
  drawText(v, pad4(s.fuel / 100), 176, TOP + 2 * ROW, SIZE);

  const lx = 560;
  const vx = 900;
  drawText(v, 'ALTITUDE', lx, TOP, SIZE);
  drawText(v, String(inGame ? altitudeHud(g, shipX, shipY) : 0), vx, TOP, SIZE, 'right');
  drawText(v, 'HORIZONTAL SPEED', lx, TOP + ROW, SIZE);
  const h = inGame ? disp(s.vx) : 0;
  drawText(v, String(h), vx, TOP + ROW, SIZE, 'right');
  if (h > 0) arrow(v, vx + 30, TOP + ROW, s.vx > 0 ? 'right' : 'left');
  drawText(v, 'VERTICAL SPEED', lx, TOP + 2 * ROW, SIZE);
  const vv = inGame ? disp(s.vy) : 0;
  drawText(v, String(vv), vx, TOP + 2 * ROW, SIZE, 'right');
  if (vv > 0) arrow(v, vx + 30, TOP + 2 * ROW, s.vy > 0 ? 'up' : 'down');

  drawText(v, MISSION_NAMES[g.mission], SCREEN_W / 2, SCREEN_H - 24, 12, 'center');
}

function centered(v: Vector, lines: string[], y: number, size = 20, gap = 34): void {
  lines.forEach((line, i) => drawText(v, line, SCREEN_W / 2, y + i * gap, size, 'center'));
}

export function drawMessages(v: Vector, g: Game): void {
  const flash = (period: number) => ((g.frame / period) & 1) === 0;
  const s = g.lander;
  switch (g.state) {
    case GameState.Attract:
      centered(v, [`${FUEL_PER_COIN / 100} FUEL UNITS PER COIN`], 300);
      if (flash(INSERT_COIN_FLASH_FRAMES)) centered(v, ['INSERT COINS'], 360);
      break;
    case GameState.Ready:
      centered(v, ['SELECT OPTION', 'PUSH START', `${Math.floor(s.fuel / 100)} FUEL UNITS`], 300);
      break;
    case GameState.Playing:
      if (s.outOfFuel) centered(v, ['OUT OF FUEL'], 250);
      else if (s.fuel < LOW_FUEL && flash(FLASH_FRAMES)) centered(v, ['LOW ON FUEL'], 250);
      break;
    case GameState.Landed: {
      centered(v, g.message, 300);
      if (g.fuelLostFrames > 0) {
        centered(v, ['AUXILIARY FUEL TANKS DESTROYED', `${Math.floor(g.fuelLost / 100)} FUEL UNITS LOST`], 300 + g.message.length * 34 + 30, 16, 28);
      }
      break;
    }
    case GameState.GameOver:
      centered(v, ['GAME OVER'], 330, 28);
      break;
    case GameState.Initials: {
      centered(v, ['GREAT SCORE', 'ENTER YOUR INITIALS'], 270);
      const ini = g.initials;
      const size = 36;
      const step = 56;
      const x0 = SCREEN_W / 2 - step;
      ini.letters.forEach((ch, i) => {
        drawText(v, ch === ' ' ? '_' : ch, x0 + i * step, 420, size, 'center');
        if (i === ini.pos && flash(FLASH_FRAMES)) v.line(x0 + i * step - 16, 432, x0 + i * step + 16, 432);
      });
      centered(v, ['LEFT/RIGHT TO CHANGE  SPACE TO CONFIRM'], 500, 12, 20);
      break;
    }
  }
}

/** Width helper re-exported for page layout tests. */
export { textWidth };
