/**
 * confetti.js — lightweight canvas confetti celebration. No dependencies.
 * Respects prefers-reduced-motion (skips entirely).
 */

const COLORS = ['#1d4ed8', '#15803d', '#b91c1c', '#f59e0b', '#7c3aed', '#db2777', '#0891b2'];

export function celebrate(durationMs = 3500) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const N = 140;
  const pieces = Array.from({ length: N }, () => ({
    x: Math.random() * innerWidth,
    y: -20 - Math.random() * innerHeight * 0.5,
    w: 8 + Math.random() * 8,
    h: 10 + Math.random() * 10,
    color: COLORS[(Math.random() * COLORS.length) | 0],
    vy: 130 + Math.random() * 160,        // px/s
    vx: -40 + Math.random() * 80,
    rot: Math.random() * Math.PI * 2,
    vrot: -4 + Math.random() * 8,
    sway: 30 + Math.random() * 50,
    phase: Math.random() * Math.PI * 2,
  }));

  const t0 = performance.now();
  let last = t0;

  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;
    const elapsed = now - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    const fade = elapsed > durationMs - 600 ? Math.max(0, (durationMs - elapsed) / 600) : 1;
    ctx.globalAlpha = fade;

    for (const p of pieces) {
      p.y += p.vy * dt;
      p.x += (p.vx + Math.sin(now / 400 + p.phase) * p.sway) * dt;
      p.rot += p.vrot * dt;
      if (p.y > innerHeight + 20 && elapsed < durationMs - 1200) {
        p.y = -20; p.x = Math.random() * innerWidth;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.4 + 0.6 * Math.abs(Math.sin(p.rot))));
      ctx.restore();
    }

    if (elapsed < durationMs) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
