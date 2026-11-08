// 블링 — 반짝이 배경(코드로 그림), 반짝이는 빛, 하트 전구. 같은 시간(t)이면 언제나 같은 그림이 나온다.
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export const TEX = [
  { id: 'pinkGlitter', ko: '핑크 글리터' },
  { id: 'blackGlitter', ko: '블랙 글리터' },
  { id: 'holo', ko: '홀로그램 포일' },
  { id: 'pearl', ko: '펄 쉬머' },
  { id: 'bokeh', ko: '빛망울' },
  { id: 'heartLights', ko: '하트 전구' },
];

export function glint(ctx, x, y, size, alpha, tint, rot = 0) {
  if (alpha <= 0.01 || size <= 0.5) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, alpha);
  const g = ctx.createRadialGradient(x, y, 0, x, y, size * 0.9);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,255,255,.8)');
  g.addColorStop(0.4, tint || 'rgba(255,170,215,.35)'); g.addColorStop(1, 'rgba(255,170,215,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, size * 0.9, 0, 7); ctx.fill();
  const ray = (len, w, ang) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang + rot);
    const lg = ctx.createLinearGradient(-len, 0, len, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, -w); ctx.lineTo(len, 0); ctx.lineTo(0, w); ctx.closePath(); ctx.fill(); ctx.restore();
  };
  ray(size * 3.2, size * 0.09, 0); ray(size * 3.2, size * 0.09, Math.PI / 2);
  ray(size * 1.3, size * 0.06, Math.PI / 4); ray(size * 1.3, size * 0.06, -Math.PI / 4);
  ctx.restore();
}
function orb(ctx, x, y, r, alpha, color) {
  if (alpha <= 0.01) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, alpha);
  const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, color || 'rgba(255,170,215,.55)'); g.addColorStop(1, 'rgba(255,170,215,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
}
function heartShape(ctx, x, y, s, alpha) {
  if (alpha <= 0.01) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, alpha); ctx.translate(x, y); ctx.scale(s / 16, s / 16);
  ctx.shadowColor = 'rgba(255,90,170,.9)'; ctx.shadowBlur = 18;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-14, -4, -8, -16, 0, -8); ctx.bezierCurveTo(8, -16, 14, -4, 0, 5); ctx.fill(); ctx.restore();
}
function flakes(ctx, w, h, n, pal, r, minS, maxS, aMin, aMax) {
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, s = minS + r() * (maxS - minS), a = aMin + r() * (aMax - aMin);
    ctx.save(); ctx.translate(x, y); ctx.rotate(r() * 6.28); ctx.globalAlpha = a; ctx.fillStyle = pal[(r() * pal.length) | 0];
    if (r() < 0.5) ctx.fillRect(-s / 2, -s / 2, s, s * 0.8);
    else { ctx.beginPath(); for (let j = 0; j < 6; j++) { const t = j / 6 * 6.283; ctx.lineTo(Math.cos(t) * s / 2, Math.sin(t) * s / 2); } ctx.fill(); }
    ctx.restore();
  }
}
function bokeh(ctx, w, h, n, pal, r, minR, maxR, aMin, aMax, blur) {
  ctx.save(); ctx.filter = `blur(${blur}px)`; ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, R = minR + r() * (maxR - minR); ctx.globalAlpha = aMin + r() * (aMax - aMin);
    const c = pal[(r() * pal.length) | 0], g = ctx.createRadialGradient(x, y, R * 0.2, x, y, R);
    g.addColorStop(0, c); g.addColorStop(0.85, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function holo(ctx, w, h, r, soft = 1) {
  const img = ctx.createImageData(w, h), d = img.data;
  const P = [[255, 182, 222], [214, 190, 255], [168, 226, 255], [184, 255, 226], [255, 224, 186], [255, 182, 222]];
  const ph1 = r() * 6, ph2 = r() * 6, ph3 = r() * 6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    let t = 0.5 + 0.5 * Math.sin(u * 5.0 + v * 3.2 + Math.sin(v * 6 + ph1) * 1.6 + Math.sin(u * 4 + ph2) * 0.9);
    t = (t + 0.25 * Math.sin((u + v) * 14 + ph3)) % 1; if (t < 0) t += 1;
    const f = t * (P.length - 1), i = Math.floor(f), k = f - i, a = P[i], b = P[Math.min(i + 1, P.length - 1)];
    const R = a[0] + (b[0] - a[0]) * k, G = a[1] + (b[1] - a[1]) * k, B = a[2] + (b[2] - a[2]) * k;
    const spec = Math.pow(Math.max(0, Math.sin(u * 9 - v * 7 + Math.sin(v * 5 + ph2) * 2)), 40) * 55 + Math.sin((u * 1.3 - v) * 420) * 5;
    const n = (r() - 0.5) * 18, o = (y * w + x) * 4;
    d[o] = Math.min(255, R * soft + spec + n + (1 - soft) * 255); d[o + 1] = Math.min(255, G * soft + spec + n + (1 - soft) * 255);
    d[o + 2] = Math.min(255, B * soft + spec + n + (1 - soft) * 255); d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
export function heartPts(cx, cy, sc, n) {
  const raw = []; for (let i = 0; i <= 2000; i++) { const t = i / 2000 * Math.PI * 2; raw.push([16 * Math.pow(Math.sin(t), 3), -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); }
  const L = [0]; for (let i = 1; i < raw.length; i++) L.push(L[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  const out = []; let j = 0; for (let k = 0; k < n; k++) { const tl = k / n * L[L.length - 1]; while (L[j] < tl) j++; out.push([cx + raw[j][0] * sc, cy + raw[j][1] * sc]); }
  return out;
}
export function bulb(ctx, x, y, R, a) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
  const g = ctx.createRadialGradient(x, y, 0, x, y, R * 3.2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,250,252,.95)'); g.addColorStop(0.35, 'rgba(255,190,225,.45)'); g.addColorStop(1, 'rgba(255,120,190,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 3.2, 0, 7); ctx.fill(); ctx.restore();
}

// 정지 질감 (배경 한 장). 크기·종류·seed가 같으면 같은 그림.
export function makeTex(name, w, h, seed = 11, opt = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); const r = rng(seed); const S = Math.min(w, h) / 1080;
  const dens = opt.density ?? 1;
  if (name === 'pinkGlitter') {
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#f2448f'); g.addColorStop(0.55, '#ff7db6'); g.addColorStop(1, '#ffb2d2'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    flakes(ctx, w, h, Math.round(90000 * S * S * (w * h) / (1080 * 1920) / (S * S) * S * S * dens), ['#d92f7c', '#ff4f9a', '#ff86bd', '#ffc1dc', '#b8236a', '#ff9ccb'], r, 1.5 * S, 4.5 * S, 0.45, 0.95);
    bokeh(ctx, w, h, 26, ['#ffffff', '#ffd6ea', '#ffe9b8'], r, 40 * S, 120 * S, 0.06, 0.16, 14 * S);
    flakes(ctx, w, h, Math.round(9000 * (w * h) / (1080 * 1920) * dens), ['#ffffff', '#fff3c9', '#ffe1ef'], r, 1.5 * S, 3.5 * S, 0.6, 1);
  } else if (name === 'blackGlitter') {
    ctx.fillStyle = '#0c0610'; ctx.fillRect(0, 0, w, h);
    bokeh(ctx, w, h, 70, ['#ff4fa3', '#c86bff', '#ff8fc7', '#7a3cff'], r, 30 * S, 120 * S, 0.10, 0.28, 14 * S);
    flakes(ctx, w, h, Math.round(26000 * (w * h) / (1080 * 1920) * dens), ['#ff4fa3', '#ff7cc4', '#c86bff', '#ffffff', '#ffb3d9', '#5a2a6a'], r, 1.5 * S, 5 * S, 0.25, 0.9);
  } else if (name === 'holo') {
    holo(ctx, w, h, r);
    flakes(ctx, w, h, Math.round(9000 * (w * h) / (1080 * 1920) * dens), ['#ffffff', '#fff0fb', '#e9f7ff'], r, 1.5 * S, 4 * S, 0.3, 0.9);
  } else if (name === 'pearl') {
    holo(ctx, w, h, r, 0.42);
    bokeh(ctx, w, h, 18, ['#ffffff', '#ffe9f4', '#eef6ff'], r, 40 * S, 120 * S, 0.08, 0.2, 16 * S);
    flakes(ctx, w, h, Math.round(5000 * (w * h) / (1080 * 1920) * dens), ['#ffffff', '#ffd6ea', '#e0d4ff'], r, 1.5 * S, 4 * S, 0.3, 0.8);
  } else if (name === 'bokeh') {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a0f24'); g.addColorStop(1, '#5a1a45'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    bokeh(ctx, w, h, 80, ['#ff6fb2', '#ffb36b', '#ffffff', '#ff9fe0', '#c86bff'], r, 25 * S, 100 * S, 0.14, 0.42, 7 * S);
    bokeh(ctx, w, h, 60, ['#ffffff', '#ffd6ea'], r, 8 * S, 24 * S, 0.4, 0.8, 2 * S);
  } else if (name === 'heartLights') {
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.8); g.addColorStop(0, '#ffd3e6'); g.addColorStop(1, '#f7a9cb'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    flakes(ctx, w, h, Math.round(30000 * (w * h) / (1080 * 1920) * dens), ['#ffffff', '#ffe3f0', '#ff9fcd', '#ffd0a8'], r, 1.5 * S, 4 * S, 0.25, 0.75);
  } else if (name === 'solid') {
    ctx.fillStyle = opt.c1 || '#ffffff'; ctx.fillRect(0, 0, w, h);
  } else if (name === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, opt.c1 || '#ffe3ee'); g.addColorStop(1, opt.c2 || '#ffffff'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  return c;
}

// 배경 위에서 반짝반짝 움직이는 빛 (시간에 따라)
export function drawTwinkle(ctx, w, h, t, opt = {}) {
  const r = rng(opt.seed || 5); const S = Math.min(w, h) / 1080;
  const n = Math.round((opt.count ?? 70) * (opt.amount ?? 1)); const speed = opt.speed ?? 1;
  const tint = opt.tint || 'rgba(255,170,215,.35)';
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, base = 6 + r() * 20, per = 1.2 + r() * 2.2, ph = r();
    const k = ((t * speed) / per + ph) % 1, env = Math.pow(Math.sin(Math.PI * k), 3);
    glint(ctx, x, y, base * S * (0.6 + 0.4 * env), env, tint, k * 0.6);
  }
}
export function drawHeart(ctx, t, heart, S = 1) {
  const pts = heartPts(heart.x, heart.y, heart.scale, heart.count || 52);
  pts.forEach((p, i) => bulb(ctx, p[0], p[1], (heart.r || 10) * S, 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * (heart.speed || 0.7) - i * 0.45))));
}

// 맨 위 블링 층: 세기(level 0~3), 모양(cross/orb/heart), 자리(all/box)
export function drawBling(ctx, w, h, t, b, box) {
  const lv = b.level ?? 2; if (!lv) return;
  const n = [0, 6, 12, 22][lv] || 12, r = rng(b.seed || 21), S = Math.min(w, h) / 1080;
  for (let i = 0; i < n; i++) {
    let x, y;
    if (b.area === 'box' && box) {
      const per = 2 * (box.w + box.h), d = r() * per; const pad = 6;
      if (d < box.w) { x = box.x + d; y = box.y - pad; } else if (d < box.w + box.h) { x = box.x + box.w + pad; y = box.y + (d - box.w); }
      else if (d < 2 * box.w + box.h) { x = box.x + (d - box.w - box.h); y = box.y + box.h + pad; } else { x = box.x - pad; y = box.y + (d - 2 * box.w - box.h); }
    } else { x = r() * w; y = r() * h; }
    const per = 1.4 + r() * 1.8, ph = r(), size = (14 + r() * 26) * S * (lv === 3 ? 1.15 : 1);
    const k = ((t * (b.speed || 1)) / per + ph) % 1, env = Math.pow(Math.sin(Math.PI * k), 2);
    if (b.shape === 'orb') orb(ctx, x, y, size * 1.6, env * 0.9);
    else if (b.shape === 'heart') heartShape(ctx, x, y - k * 40 * S, size * 1.1, env);
    else glint(ctx, x, y, size * (0.5 + 0.5 * env), env, 'rgba(255,170,215,.4)', k * 0.5);
  }
}
