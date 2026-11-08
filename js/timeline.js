// 타임라인 — 줄마다 클립을 그리고, 끌어서 옮기기·양끝 늘이기·자르기·복제
import { KINDS, uid, fmt } from './core.js';
import { TEX, makeTex } from './bling.js';

const $ = id => document.getElementById(id);
const COLOR = Object.fromEntries(KINDS.map(k => [k[0], k[2]]));
const texThumb = {};
function thumb(tex) {
  if (!texThumb[tex]) texThumb[tex] = makeTex(tex, 240, 60, 11, tex === 'gradient' ? { c1: '#ffe3ee', c2: '#ffffff' } : tex === 'solid' ? { c1: '#120a14' } : {}).toDataURL('image/jpeg', 0.8);
  return texThumb[tex];
}

export class Timeline {
  constructor(app) {
    this.app = app; this.pps = 100; this.body = $('tlbody');
    document.querySelectorAll('.tools [data-tool]').forEach(b => b.onclick = () => this.tool(b.dataset.tool));
    $('zoom').oninput = e => { this.pps = +e.target.value; this.userZoom = true; this.paint(); };
    $('zIn').onclick = () => { this.userZoom = true; $('zoom').value = this.pps = Math.min(400, this.pps * 1.25); this.paint(); };
    $('zOut').onclick = () => { this.userZoom = true; $('zoom').value = this.pps = Math.max(20, this.pps / 1.25); this.paint(); };
    const scrub = e => { const r = $('ruler').getBoundingClientRect(); this.app.seek((e.clientX - r.left) / this.pps); };
    $('ruler').addEventListener('pointerdown', e => { if (this.app.playing) this.app.pause(); scrub(e); const mv = ev => scrub(ev); const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); });
    this.autoFit = true;
    new ResizeObserver(() => { if (this.body.clientWidth > 200 && !this._fitted) { this._fitted = true; this.autoFit = true; this.paint(); } }).observe(this.body);
  }
  label(kind, c) {
    const a = this.app.asset(c.asset);
    if (kind === 'bg') { const t = TEX.find(x => x.id === (c.bg || {}).tex); return (t ? t.ko : (c.bg || {}).tex === 'gradient' ? '그라데이션' : '단색') + (c.heart && c.heart.on ? ' + 하트 전구' : ''); }
    if (kind === 'scene') return (a ? a.name : '(재료 없음)') + (c.fit === 'full' ? ' · 꽉 채움' : ' · 영상 액자');
    if (kind === 'code') return '</> ' + (a ? a.name : '(코드 없음)');
    if (kind === 'motion') return '모션랩 · ' + (c.ko || c.motion);
    if (kind === 'text') return (c.text || '').replace(/\n/g, ' ');
    if (kind === 'sub') return (c.text || '').replace(/\*/g, '').replace(/\n/g, ' ');
    if (kind === 'bling') return '✦ ' + (['끔', '살짝', '반짝', '블링블링'][(c.bling || {}).level ?? 2]) + ' · ' + ({ cross: '십자 빛', orb: '빛망울', heart: '하트' }[(c.bling || {}).shape || 'cross']);
    if (kind === 'audio') return (c.voice ? '목소리 · ' : '♪ ') + (a ? a.name : '');
    return kind;
  }
  paint() {
    const app = this.app, p = app.project, d = app.duration();
    if (!this.userZoom && Math.abs((this._fitD || 0) - d) > 0.5) this.autoFit = true;
    if (this.autoFit) { this._fitD = d; const w = this.body.clientWidth - 140; if (w > 100) { this.pps = Math.max(20, Math.min(400, w / Math.max(d, 5))); $('zoom').value = this.pps; } this.autoFit = false; }
    const W = Math.max(this.body.clientWidth - 112, (d + 5) * this.pps);
    let r = ''; const step = this.pps > 140 ? 0.5 : this.pps > 60 ? 1 : this.pps > 30 ? 2 : 5;
    for (let s = 0; s <= d + 5; s += step) r += `<b style="left:${s * this.pps}px"></b>${(s % (step * 2) === 0 || step >= 2) ? `<span style="left:${s * this.pps}px">${fmt(s).replace(/\.0$/, '')}</span>` : ''}`;
    $('ruler').innerHTML = r; $('ruler').style.width = W + 'px';
    const warn = new Set([...(app.badList || []).map(b => b.id), ...(app.overList || [])]);
    let h = '';
    p.tracks.forEach(tr => {
      const rows = [], rowOf = {}; tr.clips.slice().sort((a, b) => a.start - b.start).forEach(c => { let r = rows.findIndex(end => end <= c.start + 1e-6); if (r < 0) { r = rows.length; rows.push(0); } rows[r] = c.end; rowOf[c.id] = r; });
      const nrow = Math.max(1, rows.length);
      h += `<div class="trk" data-kind="${tr.kind}" style="width:${W + 112}px;height:${42 + (nrow - 1) * 34}px"><div class="lb"><i style="background:${COLOR[tr.kind]};box-shadow:0 0 6px ${COLOR[tr.kind]}"></i>${tr.name}</div><div class="lane" data-kind="${tr.kind}">`;
      tr.clips.forEach(c => {
        const bgimg = tr.kind === 'bg' ? `background-image:url(${thumb((c.bg || {}).tex || 'pinkGlitter')})` : '';
        h += `<div class="clip k-${tr.kind}${c.id === app.sel ? ' sel' : ''}${warn.has(c.id) ? ' warn' : ''}" data-id="${c.id}" style="top:${5 + rowOf[c.id] * 34}px;left:${c.start * this.pps}px;width:${Math.max(6, (c.end - c.start) * this.pps - 3)}px;${bgimg}" title="${fmt(c.start)} ~ ${fmt(c.end)}"><i class="eh l" data-e="l"></i>${this.esc(this.label(tr.kind, c))}<i class="eh r" data-e="r"></i></div>`;
      });
      h += '</div></div>';
    });
    $('tracks').innerHTML = h;
    $('tracks').querySelectorAll('.clip').forEach(el => el.onpointerdown = e => this.drag(e, el));
    $('tracks').querySelectorAll('.lane').forEach(el => el.addEventListener('pointerdown', e => { if (e.target === el) { app.select(null); app.seek((e.clientX - el.getBoundingClientRect().left) / this.pps); } }));
    $('tracks').querySelectorAll('.lane').forEach(el => el.addEventListener('dblclick', e => { if (e.target !== el) return; const t = (e.clientX - el.getBoundingClientRect().left) / this.pps; app.seek(t); if (el.dataset.kind === 'sub') this.tool('sub'); if (el.dataset.kind === 'text') this.tool('title'); if (el.dataset.kind === 'bling') this.tool('bling'); }));
    this.playhead();
  }
  esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  playhead() { $('ph').style.left = (112 + this.app.t * this.pps) + 'px'; }
  edges(except) { const out = [0, this.app.t]; this.app.project.tracks.forEach(t => t.clips.forEach(c => { if (c.id !== except) out.push(c.start, c.end); })); return out; }
  drag(e, el) {
    const app = this.app, f = app.find(el.dataset.id); if (!f) return; e.preventDefault(); e.stopPropagation();
    if (app.sel !== f.clip.id) app.select(f.clip.id);
    const mode = e.target.dataset.e || 'move', c = f.clip, s0 = c.start, e0 = c.end, x0 = e.clientX, snap0 = app.snapshot();
    const lane = el.parentElement, edges = this.edges(c.id), mag = $('ckSnap').checked, tol = 8 / this.pps;
    const sn = v => { if (!mag) return Math.round(v * 20) / 20; let best = v, bd = tol; edges.forEach(x => { if (Math.abs(x - v) < bd) { bd = Math.abs(x - v); best = x; } }); return best === v ? Math.round(v * 20) / 20 : best; };
    let moved = false;
    const mv = ev => {
      const dt = (ev.clientX - x0) / this.pps; if (Math.abs(ev.clientX - x0) > 2) moved = true;
      if (mode === 'move') { let ns = Math.max(0, s0 + dt); const a = sn(ns), b = sn(ns + (e0 - s0)) - (e0 - s0); ns = Math.abs(a - ns) <= Math.abs(b - ns) ? a : b; c.start = Math.max(0, ns); c.end = c.start + (e0 - s0); }
      else if (mode === 'l') { c.start = Math.min(e0 - 0.1, Math.max(0, sn(s0 + dt))); if (f.track.kind === 'scene' || f.track.kind === 'audio') c.in = Math.max(0, (c.in || 0) + (c.start - s0)); }
      else { c.end = Math.max(s0 + 0.1, sn(e0 + dt)); }
      el.style.left = c.start * this.pps + 'px'; el.style.width = Math.max(6, (c.end - c.start) * this.pps - 3) + 'px';
      app.stages.forEach(s => s.seek(app.t)); $('tTime').textContent = fmt(app.t) + ' / ' + fmt(app.duration());
    };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (moved) { app.undo.push(snap0); app.dirty(); app.refresh(true); } };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  tool(name) {
    const app = this.app, p = app.project, f = app.sel && app.find(app.sel), t = app.t;
    if (name === 'split') { if (!f || !(t > f.clip.start && t < f.clip.end)) return app.toast('자를 클립을 고르고 재생바를 그 위에 두세요');
      const c = f.clip, b = JSON.parse(JSON.stringify(c)); b.id = uid(); b.start = t; if (c.in != null) b.in = (c.in || 0) + (t - c.start);
      app.change(() => { c.end = t; f.track.clips.push(b); }); app.select(b.id); return; }
    if (name === 'dup') { if (!f) return; const b = JSON.parse(JSON.stringify(f.clip)); b.id = uid(); const len = b.end - b.start; b.start = f.clip.end; b.end = b.start + len; app.change(() => f.track.clips.push(b)); app.select(b.id); return; }
    if (name === 'del') { if (f) app.removeClip(f.clip.id); return; }
    if (name === 'sub') { app.addClip('sub', { start: t, end: t + 2.5, text: '자막을 입력하세요' }); app.panels.rtab('props'); setTimeout(() => document.querySelector('#rp textarea')?.select(), 50); return; }
    if (name === 'title') { app.addClip('text', { start: t, end: t + 3, text: '제목을 입력하세요', style: { preset: 'neon', size: p.w < p.h ? 92 : 96, x: p.w / 2, y: p.w < p.h ? 360 : 170, w: p.w - 120 } }); return; }
    if (name === 'bling') { app.addClip('bling', { start: t, end: Math.max(t + 3, app.duration()), bling: { level: 2, shape: 'cross', area: 'frame', speed: 1 } }); return; }
    if (name === 'memo') { app.panels.rtab('memo'); setTimeout(() => document.getElementById('memoText')?.focus(), 50); }
  }
}
