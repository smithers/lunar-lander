// Line-segment vector font in the spirit of Atari's vector games (our own glyph design).
// Glyphs live on a 4 × 6 grid, y up; each string is one polyline of "x,y" points.

const GLYPHS: Record<string, string[]> = {
  A: ['0,0 0,4 2,6 4,4 4,0', '0,3 4,3'],
  B: ['0,0 0,6 3,6 4,5 4,4 3,3 0,3', '3,3 4,2 4,1 3,0 0,0'],
  C: ['4,0 0,0 0,6 4,6'],
  D: ['0,0 0,6 2,6 4,4 4,2 2,0 0,0'],
  E: ['4,0 0,0 0,6 4,6', '0,3 3,3'],
  F: ['0,0 0,6 4,6', '0,3 3,3'],
  G: ['4,4 4,6 0,6 0,0 4,0 4,2 2,2'],
  H: ['0,0 0,6', '4,0 4,6', '0,3 4,3'],
  I: ['0,0 4,0', '2,0 2,6', '0,6 4,6'],
  J: ['0,2 2,0 4,0 4,6'],
  K: ['0,0 0,6', '4,6 0,3 4,0'],
  L: ['0,6 0,0 4,0'],
  M: ['0,0 0,6 2,4 4,6 4,0'],
  N: ['0,0 0,6 4,0 4,6'],
  O: ['0,0 0,6 4,6 4,0 0,0'],
  P: ['0,0 0,6 4,6 4,3 0,3'],
  Q: ['0,0 0,6 4,6 4,2 2,0 0,0', '2,2 4,0'],
  R: ['0,0 0,6 4,6 4,3 0,3', '1,3 4,0'],
  S: ['4,6 0,6 0,3 4,3 4,0 0,0'],
  T: ['0,6 4,6', '2,6 2,0'],
  U: ['0,6 0,0 4,0 4,6'],
  V: ['0,6 2,0 4,6'],
  W: ['0,6 0,0 2,2 4,0 4,6'],
  X: ['0,0 4,6', '0,6 4,0'],
  Y: ['0,6 2,4 4,6', '2,4 2,0'],
  Z: ['0,6 4,6 0,0 4,0'],
  '0': ['0,0 0,6 4,6 4,0 0,0', '0,0 4,6'],
  '1': ['1,5 2,6 2,0', '1,0 3,0'],
  '2': ['0,6 4,6 4,3 0,3 0,0 4,0'],
  '3': ['0,6 4,6 4,0 0,0', '1,3 4,3'],
  '4': ['0,6 0,3 4,3', '4,6 4,0'],
  '5': ['4,6 0,6 0,3 4,3 4,0 0,0'],
  '6': ['0,6 0,0 4,0 4,3 0,3'],
  '7': ['0,6 4,6 4,0'],
  '8': ['0,0 0,6 4,6 4,0 0,0', '0,3 4,3'],
  '9': ['4,3 0,3 0,6 4,6 4,0'],
  ':': ['2,1 2,1.7', '2,4.3 2,5'],
  '.': ['2,0 2,0.7'],
  ',': ['2,0.7 1.4,-0.8'],
  '-': ['1,3 3,3'],
  '!': ['2,6 2,2', '2,0 2,0.7'],
  '?': ['0,5 1,6 3,6 4,5 4,4 2,3 2,2', '2,0 2,0.7'],
  '/': ['0,0 4,6'],
  "'": ['2,6 2,4.5'],
  '=': ['0,2 4,2', '0,4 4,4'],
  '<': ['4,6 0,3 4,0'],
  '>': ['0,6 4,3 0,0'],
  '_': ['0,0 4,0'],
};

type Stroke = [number, number][];
const PARSED: Record<string, Stroke[]> = Object.fromEntries(
  Object.entries(GLYPHS).map(([ch, strokes]) => [
    ch,
    strokes.map((s) => s.split(' ').map((p) => p.split(',').map(Number) as [number, number])),
  ]),
);

/** Character advance in grid units (4 wide + 2 gap). */
export const ADVANCE = 6;

export interface Pen {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
}

export function hasGlyph(ch: string): boolean {
  return ch === ' ' || ch in PARSED;
}

export function textWidth(text: string, size: number): number {
  const u = size / 6;
  return text.length > 0 ? (text.length * ADVANCE - 2) * u : 0;
}

/**
 * Draw text with its baseline at screen y (y grows downward). `size` is the cap height.
 * Unknown characters draw as a space.
 */
export function drawText(
  pen: Pen,
  text: string,
  x: number,
  y: number,
  size: number,
  align: 'left' | 'center' | 'right' = 'left',
): void {
  const u = size / 6;
  let ox = align === 'left' ? x : align === 'center' ? x - textWidth(text, size) / 2 : x - textWidth(text, size);
  for (const ch of text.toUpperCase()) {
    for (const stroke of PARSED[ch] ?? []) {
      stroke.forEach(([gx, gy], i) => {
        const px = ox + gx * u;
        const py = y - gy * u;
        if (i === 0) pen.moveTo(px, py);
        else pen.lineTo(px, py);
      });
    }
    ox += ADVANCE * u;
  }
}
