// 무대 — 편집 설계도(project)와 시간 t를 받아 한 장면을 그린다.
// 편집 화면 · 완성 미리보기 · 영상 뽑기(렌더)가 모두 이 무대 하나로 그려져서 셋이 똑같이 나온다.
import { makeTex, drawTwinkle, drawHeart, drawBling } from './bling.js';
import { barSVG, markup, fontCss, barOf } from './bars.js';
import { CodeLayer } from './codeanim.js';
import { MotionLayer } from './motionlab.js';

const Z = { bg: 0, scene: 10, code: 20, motion: 30, text: 40, sub: 50, bling: 60, audio: -1 };
const TINT = { blackGlitter: 'rgba(255,90,170,.4)', holo: 'rgba(200,180,255,.35)', pearl: 'rgba(255,190,225,.35)', bokeh: 'rgba(255,170,215,.3)' };
const texCache = new Map();
function texFor(bg, w, h) {
  const k = [bg.tex, bg.density ?? 1, bg.c1, bg.c2, w, h].join('|');
  if (!texCache.has(k)) texCache.set(k, makeTex(bg.tex || 'pinkGlitter', w, h, 11, bg));
  return texCache.get(k);
}
export const active = (c, t) => t >= c.start && t < c.end;
export function subStyleOf(p, c) { return Object.assign({}, p.subStyle || {}, (c && c.style) || {}); }
export function safeBox(p) {
  return p.w < p.h ? { x: 54, y: 210, w: p.w - 108, h: p.h - 550 } : { x: Math.round(p.w * 0.05), y: Math.round(p.h * 0.05), w: Math.round(p.w * 0.9), h: Math.round(p.h * 0.9) };
}
export function boxOf(p, clip, kind) {
  if (kind === 'sub') { const s = subStyleOf(p, clip); return { x: s.x - s.w / 2, y: s.y - s.h / 2, w: s.w, h: s.h }; }
  if (kind === 'text') { const s = clip.style || {}; const h = (s.size || 80) * 1.25 * ((clip.text || '').split('\n').length); return { x: s.x - (s.w || 900) / 2, y: s.y - h / 2, w: s.w || 900, h }; }
  if (clip.full || clip.fit === 'full') return { x: 0, y: 0, w: p.w, h: p.h };
  return clip.box || { x: 0, y: 0, w: p.w, h: p.h };
}

export class Stage {
  constructor(host, app, opts = {}) {
    this.host = host; this.app = app; this.edit = !!opts.edit; this.render = !!opts.render; this.els = new Map();
    this.root = document.createElement('div'); this.root.className = 'qv-stage';
    host.appendChild(this.root);
    if (this.edit) { this.ov = document.createElement('div'); this.ov.className = 'qv-ov'; host.appendChild(this.ov); }
    this.t = 0;
  }
  get p() { return this.app.project; }
  fit() {
    const p = this.p, W = this.host.clientWidth, H = this.host.clientHeight;
    const s = this.render ? 1 : Math.min(W / p.w, H / p.h); this.scale = s;
    Object.assign(this.root.style, { width: p.w + 'px', height: p.h + 'px', transform: `scale(${s})`, left: ((W - p.w * s) / 2) + 'px', top: ((H - p.h * s) / 2) + 'px' });
    if (this.ov) Object.assign(this.ov.style, { width: p.w * s + 'px', height: p.h * s + 'px', left: ((W - p.w * s) / 2) + 'px', top: ((H - p.h * s) / 2) + 'px' });
  }
  // 설계도가 바뀌면 층을 맞춤 (새 클립은 만들고, 지운 클립은 없앰)
  sync() {
    const p = this.p, seen = new Set();
    this.root.style.background = p.bgColor || '#000';
    p.tracks.forEach((tr, ti) => tr.clips.forEach(c => {
      if (tr.kind === 'audio') return;
      seen.add(c.id); let L = this.els.get(c.id);
      if (!L || L.kind !== tr.kind || L.sig !== this.sig(tr.kind, c)) { if (L) L.el.remove(); L = this.make(tr.kind, c); this.els.set(c.id, L); this.root.appendChild(L.el); }
      L.el.style.zIndex = (Z[tr.kind] || 0) * 10 + ti;
      this.style(L, tr.kind, c);
    }));
    [...this.els.keys()].forEach(id => { if (!seen.has(id)) { this.els.get(id).el.remove(); this.els.delete(id); } });
    this.fit();
  }
  sig(kind, c) {
    if (kind === 'scene') return 'scene:' + c.asset;
    if (kind === 'code') return 'code:' + c.asset;
    if (kind === 'motion') return 'motion';
    return kind;
  }
  make(kind, c) {
    const el = document.createElement('div'); el.className = 'qv-l qv-' + kind; const L = { kind, el, clip: c };
    if (kind === 'bg') {
      L.tex = document.createElement('canvas'); L.dyn = document.createElement('canvas');
      el.append(L.tex, L.dyn);
    } else if (kind === 'scene') {
      const a = this.app.asset(c.asset);
      if (a && a.type === 'image') { L.img = document.createElement('img'); L.img.src = this.app.url(c.asset); el.appendChild(L.img); }
      else if (this.render) { L.img = document.createElement('img'); el.appendChild(L.img); }
      else { L.vid = document.createElement('video'); L.vid.src = this.app.url(c.asset) || ''; L.vid.preload = 'auto'; L.vid.playsInline = true; L.vid.muted = this.edit; el.appendChild(L.vid); }
    } else if (kind === 'code' || kind === 'motion') {
      L.f = document.createElement('iframe'); L.f.setAttribute('allowtransparency', 'true'); L.f.setAttribute('scrolling', 'no'); el.appendChild(L.f);
      if (kind === 'code') { L.ctl = null; const a = this.app.asset(c.asset), base = this.app.base && a ? new URL(a.path, this.app.base).href : undefined; L.ready = this.app.text(c.asset).then(html => { if (html != null) L.ctl = new CodeLayer(L.f, html, base); }); }
      else L.ctl = new MotionLayer(L.f, c, this.p.ratio);
    } else if (kind === 'text' || kind === 'sub') {
      L.bar = document.createElement('div'); L.bar.className = 'qv-bar'; L.txt = document.createElement('div'); L.txt.className = 'qv-txt'; el.append(L.bar, L.txt);
    } else if (kind === 'bling') {
      L.cv = document.createElement('canvas'); el.appendChild(L.cv);
    }
    return L;
  }
  style(L, kind, c) {
    const p = this.p, el = L.el; L.clip = c;
    if (kind === 'bg') {
      [L.tex, L.dyn].forEach(cv => { if (cv.width !== p.w || cv.height !== p.h) { cv.width = p.w; cv.height = p.h; } });
      const bg = c.bg || {}, key = JSON.stringify([bg.tex, bg.density, bg.c1, bg.c2, p.w, p.h]);
      if (L.texKey !== key) { L.texKey = key; const g = L.tex.getContext('2d'); g.clearRect(0, 0, p.w, p.h); g.drawImage(texFor(bg, p.w, p.h), 0, 0); }
      L.lastT = null;
    } else if (kind === 'scene' || kind === 'code' || kind === 'motion') {
      const b = boxOf(p, c, kind); Object.assign(el.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
      const fr = kind === 'scene' && c.fit !== 'full' && c.frame;
      el.style.borderRadius = fr ? (c.frame.radius ?? 30) + 'px' : '0';
      el.style.border = fr && c.frame.border ? `${c.frame.border}px solid ${c.frame.borderColor || '#fff'}` : '0';
      el.style.boxShadow = fr && c.frame.glow ? `0 0 0 2px rgba(255,255,255,.6),0 0 60px ${c.frame.glowColor || 'rgba(255,90,170,.65)'},0 30px 80px rgba(90,10,60,.45)` : 'none';
      if (L.ctl && kind === 'motion') { L.ctl.clip = c; L.ctl.ratio = p.ratio; }
      if (L.vid) L.vid.style.objectFit = L.img ? '' : (c.objectFit || 'cover');
      if (L.img) L.img.style.objectFit = c.objectFit || 'cover';
    } else if (kind === 'sub') {
      const s = subStyleOf(p, c), bar = barOf(s.bar);
      Object.assign(el.style, { left: (s.x - s.w / 2) + 'px', top: (s.y - s.h / 2) + 'px', width: s.w + 'px', height: s.h + 'px' });
      const pal = Object.assign({}, bar.pal, s.pal || {});
      const bk = JSON.stringify([s.bar, s.w, s.h, pal, s.barImage]);
      if (L.barKey !== bk) { L.barKey = bk; L.bar.innerHTML = s.bar === 'none' ? '' : barSVG(s.bar, s.w, s.h, pal, s.barImage && this.app.url(s.barImage)); }
      const stroke = s.bar === 'none' ? `-webkit-text-stroke:${Math.round(s.size / 12)}px ${pal.line};paint-order:stroke fill;` : '';
      L.txt.style.cssText = `font-family:${fontCss(s.font || bar.font)};font-weight:${s.weight || 700};font-size:${s.size}px;color:${s.color || pal.text};text-align:${s.align || 'center'};${stroke}`;
      L.txt.innerHTML = '<span>' + markup(c.text, s.keyColor || pal.key) + '</span>';
    } else if (kind === 'text') {
      const s = Object.assign({ x: p.w / 2, y: p.h * 0.15, w: p.w - 120, size: 88, preset: 'neon', color: '#ffffff', glow: '#ff3d9a', font: 'Pretendard', align: 'center' }, c.style || {});
      const b = boxOf(p, { text: c.text, style: s }, 'text');
      Object.assign(el.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
      let css = `font-family:${fontCss(s.font)};font-size:${s.size}px;line-height:1.18;text-align:${s.align};color:${s.color};font-weight:${s.weight || 900};letter-spacing:-0.02em;`;
      if (s.preset === 'neon') css += `text-shadow:0 0 6px #fff,0 0 18px ${s.glow},0 0 38px ${s.glow},0 0 70px ${s.glow2 || '#c86bff'},0 4px 0 rgba(120,20,70,.35);`;
      L.bar.innerHTML = '';
      L.txt.style.cssText = css;
      const inner = markup(c.text, s.keyColor || '#ffd76a');
      L.txt.innerHTML = s.preset === 'chip'
        ? `<span style="display:inline-block;background:${s.chipBg || '#fff'};color:${s.color === '#ffffff' ? '#2a1d28' : s.color};font-weight:800;border-radius:999px;padding:.32em .95em;box-shadow:0 10px 40px rgba(120,20,70,.35);white-space:nowrap">${inner}</span>`
        : '<span>' + inner + '</span>';
    } else if (kind === 'bling') {
      if (L.cv.width !== p.w || L.cv.height !== p.h) { L.cv.width = p.w; L.cv.height = p.h; }
      L.lastT = null;
    }
  }
  // t초의 장면으로 맞춤. playing이면 영상은 그냥 흘려보내고(어긋날 때만 바로잡음) 정지 중이면 정확히 맞춤.
  async seek(t, playing = false) {
    const p = this.p; this.t = t; const waits = [];
    const frameBox = this.frameBox(t);
    for (const tr of p.tracks) for (const c of tr.clips) {
      const L = this.els.get(c.id); if (!L) continue;
      const on = active(c, t), lt = t - c.start;
      L.el.style.display = on ? '' : 'none';
      if (L.vid) {
        if (!on) { if (!L.vid.paused) L.vid.pause(); continue; }
        const want = lt + (c.in || 0);
        L.vid.volume = Math.max(0, Math.min(1, c.vol ?? 1));
        if (playing) { if (L.vid.paused) L.vid.play().catch(() => {}); if (Math.abs(L.vid.currentTime - want) > 0.25) L.vid.currentTime = want; }
        else { if (!L.vid.paused) L.vid.pause(); if (Math.abs(L.vid.currentTime - want) > 0.02) { L.vid.currentTime = want; } }
        continue;
      }
      if (!on) continue;
      if (tr.kind === 'scene' && this.render && L.img && this.app.frameUrl) {
        const src = this.app.frameUrl(c.asset, lt + (c.in || 0));
        if (L.img.getAttribute('src') !== src) { L.img.src = src; waits.push(L.img.decode().catch(() => {})); }
      }
      if (tr.kind === 'code' && !L.ctl && L.ready) waits.push(L.ready.then(() => L.ctl && L.ctl.seek(lt)));
      else if ((tr.kind === 'code' || tr.kind === 'motion') && L.ctl) waits.push(L.ctl.seek(lt));
      if (tr.kind === 'bg') this.drawBg(L, c, lt);
      if (tr.kind === 'bling') this.drawBling(L, c, lt, frameBox);
    }
    if (this.render) { await Promise.all(waits); if (document.fonts) await document.fonts.ready; }
    if (this.ov) this.app.paintOverlay(this);
  }
  frameBox(t) {
    const p = this.p; for (const tr of p.tracks) if (tr.kind === 'scene') for (const c of tr.clips) if (active(c, t) && c.fit !== 'full') return boxOf(p, c, 'scene');
    return null;
  }
  drawBg(L, c, lt) {
    const p = this.p, bg = c.bg || {}, g = L.dyn.getContext('2d');
    g.clearRect(0, 0, p.w, p.h);
    if ((bg.twinkle ?? 1) > 0) drawTwinkle(g, p.w, p.h, lt, { amount: bg.twinkle ?? 1, speed: bg.speed ?? 1, tint: TINT[bg.tex], count: 60 });
    if (c.heart && c.heart.on) drawHeart(g, lt, c.heart, Math.min(p.w, p.h) / 1080);
  }
  drawBling(L, c, lt, frameBox) {
    const p = this.p, g = L.cv.getContext('2d'); g.clearRect(0, 0, p.w, p.h);
    const b = c.bling || {}; let box = null;
    if (b.area === 'frame') box = frameBox;
    else if (b.area === 'sub') { for (const tr of p.tracks) if (tr.kind === 'sub') for (const s of tr.clips) if (active(s, this.t)) box = boxOf(p, s, 'sub'); }
    drawBling(g, p.w, p.h, lt, Object.assign({}, b, { area: box ? 'box' : 'all' }), box);
  }
}
