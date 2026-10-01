// Vector display emulation on Canvas 2D: thin white lines on black with a phosphor glow,
// letterboxed to the 4:3 logical screen. Everything drawn in a frame goes into one path and
// is stroked once, which keeps the glow cheap.
import { SCREEN_H, SCREEN_W } from './camera';
import type { Pen } from './font';

export interface Vector extends Pen {
  /** Resize the backing store to the window and devicePixelRatio. */
  resize(): void;
  begin(): void;
  end(): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  poly(points: { x: number; y: number }[], close?: boolean): void;
  /** Device-pixel scale of one logical unit (for tests/diagnostics). */
  readonly scale: number;
}

export function createVector(canvas: HTMLCanvasElement): Vector {
  const ctx = canvas.getContext('2d', { alpha: false })!;
  let scale = 1;
  let offX = 0;
  let offY = 0;

  const v: Vector = {
    get scale() {
      return scale;
    },
    resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      scale = Math.min(canvas.width / SCREEN_W, canvas.height / SCREEN_H);
      offX = (canvas.width - SCREEN_W * scale) / 2;
      offY = (canvas.height - SCREEN_H * scale) / 2;
    },
    begin() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, offX, offY);
      // Clip to the logical screen so off-screen geometry never bleeds into the letterbox.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, SCREEN_W, SCREEN_H);
      ctx.clip();
      ctx.beginPath();
    },
    end() {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Halo pass, then a bright core with a soft bloom.
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(150, 180, 255, 0.16)';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.shadowColor = 'rgba(210, 225, 255, 0.9)';
      ctx.shadowBlur = 6 * scale;
      ctx.strokeStyle = '#f4f8ff';
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    },
    moveTo(x, y) {
      ctx.moveTo(x, y);
    },
    lineTo(x, y) {
      ctx.lineTo(x, y);
    },
    line(x1, y1, x2, y2) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    },
    poly(points, close = false) {
      points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      if (close && points.length > 0) ctx.lineTo(points[0]!.x, points[0]!.y);
    },
  };
  return v;
}
