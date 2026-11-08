// 쿼카 비디오랩 — 편집기 본체: 설계도(project) · 파일 · 재생 · 저장 · 클로드에게 넘기기
import { Stage, active, boxOf, subStyleOf, safeBox } from './stage.js';
import { rng, drawTwinkle } from './bling.js';
import { fontCss, barOf } from './bars.js';
import { Timeline } from './timeline.js';
import { Panels } from './panels.js';
import { SIZES, KINDS, uid, typeOf, fmt, defaultSub, newProject, normalize } from './core.js';

const Q = new URLSearchParams(location.search);
const PROJECT_FILE = 'quokavideolab.json', MEMO_FILE = '클로드에게.md';
const $ = id => document.getElementById(id);
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return 'a' + (h >>> 0).toString(36); };

class App {
  constructor() {
    this.project = newProject(); this.t = 0; this.playing = false; this.sel = null; this.urls = {}; this.files = {};
    this.dir = null; this.undo = []; this.redo = []; this.base = null; this.scope = 'one';
  }
  // ---------- 설계도 다루기 ----------
  asset(id) { return this.project.assets[id]; }
  url(id) {
    if (!id) return '';
    if (this.urls[id]) return this.urls[id];
    const a = this.asset(id); if (!a) return '';
    if (this.base && a.path) return (this.urls[id] = new URL(a.path, this.base).href);
    return a.url || '';
  }
  async text(id) {
    if (this.files[id]) return await this.files[id].text();
    const u = this.url(id); if (!u) return null;
    try { return await (await fetch(u)).text(); } catch (e) { return null; }
  }
  track(kind) { return this.project.tracks.find(t => t.kind === kind); }
  find(id) { for (const tr of this.project.tracks) { const c = tr.clips.find(c => c.id === id); if (c) return { clip: c, track: tr }; } return null; }
  duration() { let d = 0; this.project.tracks.forEach(t => t.clips.forEach(c => { d = Math.max(d, c.end); })); return Math.max(d, 1); }
  snapshot() { return JSON.stringify(this.project); }
  change(fn, quiet) {
    this.undo.push(this.snapshot()); if (this.undo.length > 80) this.undo.shift(); this.redo = [];
    fn(this.project); this.dirty(); this.refresh(quiet);
  }
  doUndo() { if (!this.undo.length) return; this.redo.push(this.snapshot()); this.project = normalize(JSON.parse(this.undo.pop())); this.dirty(); this.refresh(); this.toast('되돌렸어요'); }
  doRedo() { if (!this.redo.length) return; this.undo.push(this.snapshot()); this.project = normalize(JSON.parse(this.redo.pop())); this.dirty(); this.refresh(); }
  addClip(kind, clip, select = true) {
    clip.id = clip.id || uid();
    this.change(p => { p.tracks.find(t => t.kind === kind).clips.push(clip); });
    if (select) this.select(clip.id);
    return clip;
  }
  removeClip(id) { this.change(p => p.tracks.forEach(t => { t.clips = t.clips.filter(c => c.id !== id); })); if (this.sel === id) this.select(null); }
  select(id) { this.sel = id; this.timeline.paint(); this.panels.props(); this.paintAll(); }
  refresh(quiet) {
    $('title').value = this.project.title || '';
    $('ratio').value = this.project.ratio;
    this.stages.forEach(s => s.sync());
    this.timeline.paint();
    if (!quiet) this.panels.props();
    this.seek(this.t);
    this.checks();
  }
  // ---------- 시간 ----------
  seek(t) {
    this.t = Math.max(0, Math.min(t, this.duration()));
    this.stages.forEach(s => s.seek(this.t, this.playing));
    this.timeline.playhead();
    $('tTime').textContent = fmt(this.t) + ' / ' + fmt(this.duration());
    this.syncAudio();
  }
  paintAll() { this.stages.forEach(s => { if (s.ov) this.paintOverlay(s); }); }
  play() {
    if (this.playing) return this.pause();
    if (this.t >= this.duration() - 0.05) this.t = 0;
    this.playing = true; $('tPlay').textContent = '❚❚';
    let last = performance.now();
    const loop = now => {
      if (!this.playing) return;
      this.t += (now - last) / 1000; last = now;
      if (this.t >= this.duration()) { this.t = this.duration(); this.pause(); this.seek(this.t); return; }
      this.seek(this.t); requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  pause() { this.playing = false; $('tPlay').textContent = '▶'; this.seek(this.t); }
  // 배경음악·목소리(소리 줄) 미리 듣기. 장면 영상 소리는 완성 미리보기의 영상이 냄.
  syncAudio() {
    this.audioEls = this.audioEls || {};
    const tr = this.track('audio'); const ids = new Set();
    const speaking = this.project.tracks.some(t => t.kind === 'audio' && t.clips.some(c => c.voice && active(c, this.t)));
    tr.clips.forEach(c => {
      ids.add(c.id); let a = this.audioEls[c.id];
      if (!a) { a = this.audioEls[c.id] = new Audio(this.url(c.asset)); a.preload = 'auto'; }
      const on = active(c, this.t), lt = this.t - c.start + (c.in || 0);
      let v = c.vol ?? 0.8; if (c.duck && speaking && !c.voice) v *= 0.25;
      if (c.fadeIn && lt < c.fadeIn) v *= lt / c.fadeIn; if (c.fadeOut && c.end - this.t < c.fadeOut) v *= (c.end - this.t) / c.fadeOut;
      a.volume = Math.max(0, Math.min(1, v));
      if (on && this.playing) { if (a.paused) { a.currentTime = lt; a.play().catch(() => {}); } else if (Math.abs(a.currentTime - lt) > 0.3) a.currentTime = lt; }
      else if (!a.paused) a.pause();
    });
    Object.keys(this.audioEls).forEach(id => { if (!ids.has(id)) { this.audioEls[id].pause(); delete this.audioEls[id]; } });
  }
  // ---------- 편집 화면 위 손잡이 ----------
  paintOverlay(st) {
    const p = this.project, s = st.scale, ov = st.ov; if (!ov) return;
    let h = '';
    if ($('ckGuide').checked) { const g = safeBox(p); h += `<div class="guide" style="left:${g.x * s}px;top:${g.y * s}px;width:${g.w * s}px;height:${g.h * s}px"></div>`; }
    (this.badList || []).forEach(b => { if (b.on(this.t)) h += `<div class="bad" style="left:${b.box.x * s}px;top:${b.box.y * s}px;width:${b.box.w * s}px;height:${b.box.h * s}px"></div>`; });
    const f = this.sel && this.find(this.sel);
    if (f && ['scene', 'code', 'motion', 'text', 'sub'].includes(f.track.kind) && active(f.clip, this.t) && !(f.clip.full || f.clip.fit === 'full')) {
      const b = boxOf(p, f.clip, f.track.kind), lab = { scene: '장면', code: '코드 애니', motion: '모션랩', text: '제목', sub: '자막' }[f.track.kind];
      h += `<div class="sel" data-drag="move" style="left:${b.x * s}px;top:${b.y * s}px;width:${b.w * s}px;height:${b.h * s}px"><span class="tagc">${lab}</span>
        <i data-drag="nw" style="left:-6px;top:-6px;cursor:nwse-resize"></i><i data-drag="ne" style="right:-6px;top:-6px;cursor:nesw-resize"></i>
        <i data-drag="sw" style="left:-6px;bottom:-6px;cursor:nesw-resize"></i><i data-drag="se" style="right:-6px;bottom:-6px;cursor:nwse-resize"></i></div>`;
    }
    ov.innerHTML = h;
  }
  bindOverlay(st) {
    st.ov.addEventListener('pointerdown', e => {
      const p = this.project, s = st.scale, r = st.ov.getBoundingClientRect();
      const px = (e.clientX - r.left) / s, py = (e.clientY - r.top) / s;
      const mode = e.target.dataset.drag;
      if (!mode) { // 빈 곳을 누르면 그 자리의 층을 고름 (위에 있는 것부터)
        const order = ['sub', 'text', 'motion', 'code', 'scene'];
        for (const k of order) { const tr = this.track(k); const hit = [...tr.clips].reverse().find(c => active(c, this.t) && !(c.full || c.fit === 'full') && (b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h)(boxOf(p, c, k))); if (hit) { this.select(hit.id); return; } }
        return;
      }
      const f = this.find(this.sel); if (!f) return; e.preventDefault(); st.ov.setPointerCapture(e.pointerId);
      const kind = f.track.kind, c = f.clip, b0 = boxOf(p, c, kind), snap0 = this.snapshot();
      const sub = kind === 'sub', scopeAll = sub && this.scope === 'all';
      const move = ev => {
        const dx = (ev.clientX - e.clientX) / s, dy = (ev.clientY - e.clientY) / s;
        let b = { ...b0 };
        if (mode === 'move') { b.x += dx; b.y += dy; }
        else { const ax = mode.includes('w') ? -1 : 1, ay = mode.includes('n') ? -1 : 1, nw = Math.max(80, b0.w + ax * dx), nh = Math.max(40, b0.h + ay * dy);
          if (mode.includes('w')) b.x = b0.x + b0.w - nw; if (mode.includes('n')) b.y = b0.y + b0.h - nh; b.w = nw; b.h = nh;
          if (kind === 'scene' && !ev.shiftKey) { const ar = b0.w / b0.h; b.h = b.w / ar; if (mode.includes('n')) b.y = b0.y + b0.h - b.h; } }
        b = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) };
        if (sub) { const tgt = scopeAll ? p.subStyle : (c.style = c.style || {}); tgt.x = b.x + b.w / 2; tgt.y = b.y + b.h / 2; tgt.w = b.w; tgt.h = b.h; if (scopeAll) p.tracks.find(t => t.kind === 'sub').clips.forEach(x => { if (x.style) ['x', 'y', 'w', 'h'].forEach(k => delete x.style[k]); }); }
        else if (kind === 'text') { c.style = c.style || {}; c.style.x = b.x + b.w / 2; c.style.y = b.y + b.h / 2; c.style.w = b.w; if (mode !== 'move') c.style.size = Math.round((c.style.size || 88) * b.h / b0.h); }
        else c.box = b;
        this.stages.forEach(x => x.sync()); this.seek(this.t);
      };
      const up = () => { st.ov.removeEventListener('pointermove', move); st.ov.removeEventListener('pointerup', up); this.undo.push(snap0); this.dirty(); this.panels.props(); this.checks(); };
      st.ov.addEventListener('pointermove', move); st.ov.addEventListener('pointerup', up);
    });
  }
  // ---------- 검사: 박스 밖 · 넘침 ----------
  checks() {
    const p = this.project, g = safeBox(p), bad = [], over = [];
    const out = b => b.x < g.x - 1 || b.y < g.y - 1 || b.x + b.w > g.x + g.w + 1 || b.y + b.h > g.y + g.h + 1;
    const cv = this._cv || (this._cv = document.createElement('canvas')), ctx = cv.getContext('2d');
    ['sub', 'text'].forEach(k => this.track(k).clips.forEach(c => {
      let b = boxOf(p, c, k);
      if (k === 'text') { const st = Object.assign({ size: 88, font: 'Pretendard' }, c.style || {}); ctx.font = `900 ${st.size}px ${fontCss(st.font)}`; const lw = Math.max(...String(c.text || '').split('\n').map(l => ctx.measureText(l).width)) + (st.preset === 'chip' ? st.size * 1.8 : 0); b = { x: (st.x ?? p.w / 2) - lw / 2, y: b.y, w: lw, h: b.h }; }
      if (out(b)) bad.push({ id: c.id, box: b, on: t => active(c, t) });
      if (k === 'sub') { const s = subStyleOf(p, c); ctx.font = `700 ${s.size}px ${fontCss(s.font || barOf(s.bar).font)}`;
        const wmax = Math.max(...String(c.text || '').replace(/\*/g, '').split('\n').map(l => ctx.measureText(l).width)); if (wmax > s.w - s.size * 0.6) over.push(c.id); }
    }));
    this.badList = bad; this.overList = over;
    const cb = $('chkBox'), co = $('chkOver');
    cb.textContent = '박스 밖 ' + bad.length; cb.className = 'chip ' + (bad.length ? 'warn' : 'ok');
    co.textContent = '넘침 ' + over.length; co.className = 'chip ' + (over.length ? 'warn' : 'ok');
    this.paintAll(); this.timeline && this.timeline.paint();
  }
  // ---------- 파일 ----------
  async openFolder() {
    if (!window.showDirectoryPicker) return this.toast('이 브라우저는 폴더 열기를 못 해요. 크롬에서 열어 주세요');
    try { this.dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'quokavideolab' }); } catch (e) { return; }
    const found = []; await this.scan(this.dir, '', found, 0);
    let p = null;
    try { const fh = await this.dir.getFileHandle(PROJECT_FILE); p = JSON.parse(await (await fh.getFile()).text()); } catch (e) {}
    this.urls = {}; this.files = {};
    if (p) this.project = normalize(p); else { this.project = newProject(this.project.ratio); this.project.title = this.dir.name; }
    for (const f of found) { const id = this.idForPath(f.path); const file = await f.handle.getFile(); this.files[id] = file; this.urls[id] = URL.createObjectURL(file);
      this.project.assets[id] = Object.assign(this.project.assets[id] || {}, { type: f.type, name: f.name, path: f.path }); }
    this.base = null; this.undo = []; this.t = 0; this.sel = null;
    this.refresh(); this.panels.tab('files');
    this.toast(p ? `'${this.dir.name}' 편집 설계도를 열었어요` : `'${this.dir.name}' 폴더를 열었어요 — 재료 ${found.length}개`);
    if (!p) this.save();
    this.probeAll();
  }
  idForPath(path) { const ex = Object.entries(this.project.assets).find(([, a]) => a.path === path); return ex ? ex[0] : hash(path); }
  async scan(dir, prefix, out, depth) {
    for await (const [name, h] of dir.entries()) {
      if (name.startsWith('.') || name.startsWith('_') || name === 'node_modules') continue;
      if (h.kind === 'directory') { if (depth < 2) await this.scan(h, prefix + name + '/', out, depth + 1); continue; }
      const type = typeOf(name); if (type && name !== PROJECT_FILE) out.push({ name, path: prefix + name, type, handle: h });
    }
  }
  async addFiles(list) {
    let n = 0;
    for (const file of list) {
      const type = typeOf(file.name); if (!type) continue;
      if (type === 'srt') { this.panels.importSrt(await file.text()); continue; }
      if (file.name === PROJECT_FILE || /\.json$/i.test(file.name)) { try { this.project = normalize(JSON.parse(await file.text())); this.refresh(); this.toast('설계도를 불러왔어요'); } catch (e) { this.toast('설계도를 읽지 못했어요'); } continue; }
      let path = file.name;
      if (this.dir) { try { const fh = await this.dir.getFileHandle(file.name, { create: true }); const w = await fh.createWritable(); await w.write(file); await w.close(); } catch (e) {} }
      const id = this.idForPath(path); this.files[id] = file; this.urls[id] = URL.createObjectURL(file);
      this.project.assets[id] = { type, name: file.name, path }; n++;
    }
    this.dirty(); this.panels.tab('files'); this.probeAll();
    if (n) this.toast(`재료 ${n}개를 넣었어요`);
  }
  probe(id) {
    const a = this.asset(id); if (!a || a.duration || !['video', 'audio'].includes(a.type)) return Promise.resolve(a && a.duration);
    return new Promise(ok => { const el = document.createElement(a.type === 'video' ? 'video' : 'audio'); el.preload = 'metadata'; el.src = this.url(id);
      el.onloadedmetadata = () => { a.duration = Math.round(el.duration * 1000) / 1000; if (el.videoWidth) { a.w = el.videoWidth; a.h = el.videoHeight; } ok(a.duration); this.panels.tab(); };
      el.onerror = () => ok(null); });
  }
  probeAll() { Object.keys(this.project.assets).forEach(id => this.probe(id)); }
  // 재료를 타임라인에 넣기
  async place(id, at = this.t) {
    const a = this.asset(id), p = this.project; if (!a) return;
    const dur = (await this.probe(id)) || (a.type === 'image' ? 4 : 6);
    if (a.type === 'video' || a.type === 'image') {
      const scene = this.track('scene'), start = at;
      const ar = a.w && a.h ? a.w / a.h : 16 / 9, fill = Math.abs(ar - p.w / p.h) < 0.05;
      const bw = p.w < p.h ? Math.round(p.w * 0.667) : Math.round(p.w * 0.72), bh = Math.round(bw / ar);
      const clip = { kind: 'scene', asset: id, start, end: start + dur, in: 0, vol: 1, fit: fill ? 'full' : 'frame', box: { x: Math.round((p.w - bw) / 2), y: Math.round(p.h * 0.5 - bh / 2 - (p.w < p.h ? 30 : 0)), w: bw, h: bh }, frame: { radius: 30, border: 9, glow: true } };
      this.addClip('scene', clip);
      if (!this.track('bg').clips.some(c => c.start <= start && c.end >= start + dur) && !fill) this.addClip('bg', { start, end: start + dur, bg: { tex: 'pinkGlitter', twinkle: 1 } }, false);
    } else if (a.type === 'audio') this.addClip('audio', { asset: id, start: at, end: at + dur, in: 0, vol: 0.8, duck: true, fadeIn: 0.5, fadeOut: 1.5 });
    else if (a.type === 'html') this.addClip('code', { asset: id, start: at, end: at + 6, full: true, box: { x: 0, y: 0, w: p.w, h: p.h } });
    else if (a.type === 'srt') this.panels.importSrt(await this.text(id));
  }
  dirty() {
    $('saved').textContent = '저장 중…'; clearTimeout(this._sv);
    this._sv = setTimeout(() => this.save(true), 900);
  }
  async save(auto) {
    const json = JSON.stringify(this.project, null, 1);
    try { localStorage.setItem('qv:last', json); } catch (e) {}
    if (this.dir) {
      try { const fh = await this.dir.getFileHandle(PROJECT_FILE, { create: true }); const w = await fh.createWritable(); await w.write(json); await w.close();
        $('saved').textContent = '✓ 폴더에 저장됨 · ' + new Date().toTimeString().slice(0, 5); }
      catch (e) { $('saved').textContent = '저장 실패 — 폴더 권한을 확인해 주세요'; }
    } else {
      $('saved').textContent = '✓ 브라우저에 저장됨 · ' + new Date().toTimeString().slice(0, 5);
      if (!auto) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = PROJECT_FILE; a.click(); this.toast('폴더를 안 열어서 설계도를 내려받았어요'); }
    }
  }
  async writeMemo() {
    const p = this.project, todo = p.memos.filter(m => !m.done);
    const md = `# 클로드에게 — ${p.title}\n\n쿼카 비디오랩 편집 설계도: \`${PROJECT_FILE}\` (${p.ratio} · ${p.w}×${p.h} · ${p.fps}fps · ${fmt(this.duration())})\n\n## 할 일 ${todo.length}개\n` +
      todo.map((m, i) => `${i + 1}. [${fmt(m.t)}] ${m.text}`).join('\n') +
      `\n\n## 처리하는 법\n- quoka-editor 스킬(쿼카 비디오랩 편)을 따른다. 설계도를 읽고 할 일을 처리한 뒤, 결과 파일을 이 폴더에 넣고 설계도에 반영한다.\n- 처리한 메모는 설계도 memos에서 done: true로 바꾼다.\n- 영상 뽑기: quokavideolab/render/render.mjs (프레임 단위로 찍어 mp4)\n`;
    if (this.dir) { try { const fh = await this.dir.getFileHandle(MEMO_FILE, { create: true }); const w = await fh.createWritable(); await w.write(md); await w.close(); } catch (e) {} }
    return md;
  }
  async handoff(extra) {
    if (extra) this.project.memos.push({ id: uid(), t: this.t, text: extra, done: false });
    await this.save(true); await this.writeMemo();
    const where = this.dir ? `'${this.dir.name}' 폴더` : '내려받은 설계도';
    const prompt = `쿼카 비디오랩 ${where}의 클로드에게.md 메모 처리해줘`;
    try { await navigator.clipboard.writeText(prompt); } catch (e) {}
    this.panels.rtab('memo');
    this.modal(`<h3>클로드에게 넘겼어요 ✦</h3><p>설계도와 메모(<b>${MEMO_FILE}</b>)를 ${where}에 저장했어요. 클로드 데스크톱 앱에서 그 폴더를 연결하고 이렇게 말하면 돼요. (복사해 뒀어요)</p><div class="hand" style="margin-top:10px"><code>${prompt}</code></div>${this.dir ? '' : '<p class="cap" style="margin-top:10px">폴더를 열지 않아서 설계도 파일만 내려받았어요. 재료와 같은 폴더에 넣어 주세요.</p>'}`);
  }
  // ---------- 알림 ----------
  toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('on'), 2600); }
  modal(html) { $('mbody').innerHTML = html; $('modal').hidden = false; }
}

// ---------- 시작 ----------
const app = window.qv = new App();
async function bootRender() {
  document.body.className = 'render';
  const projUrl = Q.get('project'); app.base = new URL(projUrl, location.href);
  app.project = normalize(await (await fetch(projUrl)).json());
  const framesBase = Q.get('frames'); let meta = {};
  if (framesBase) { try { meta = await (await fetch(framesBase.replace(/\/$/, '') + '/meta.json')).json(); } catch (e) {} }
  app.frameUrl = (id, lt) => { const m = meta[id]; if (!m) return ''; const i = Math.max(1, Math.min(m.count, Math.floor(lt * m.fps + 1e-4) + 1)); return `${framesBase.replace(/\/$/, '')}/${id}/${String(i).padStart(6, '0')}.jpg`; };
  const host = document.createElement('div'); host.id = 'renderHost'; Object.assign(host.style, { width: app.project.w + 'px', height: app.project.h + 'px' }); document.body.appendChild(host);
  const st = new Stage(host, app, { render: true }); app.stages = [st]; app.paintOverlay = () => {};
  st.sync();
  if (document.fonts) await document.fonts.ready;
  window.__qv = { info: { w: app.project.w, h: app.project.h, fps: app.project.fps, duration: app.duration() }, seek: async t => { await st.seek(t); return true; } };
}
function bootEditor() {
  app.stages = [new Stage($('editHost'), app, { edit: true }), new Stage($('outHost'), app, {})];
  app.bindOverlay(app.stages[0]);
  app.timeline = new Timeline(app); app.panels = new Panels(app);
  try { const s = localStorage.getItem('qv:last'); if (s) { app.project = normalize(JSON.parse(s)); Object.values(app.project.assets).forEach(a => { delete a.url; }); } } catch (e) {}
  // 바탕의 반짝이(블링 나이트 테마)
  const bgc = document.createElement('canvas'); document.querySelector('.bgfx').appendChild(bgc);
  const paintBg = () => { bgc.width = innerWidth; bgc.height = innerHeight; const g = bgc.getContext('2d'); const r = rng(3);
    for (let i = 0; i < innerWidth * innerHeight / 90; i++) { g.globalAlpha = 0.2 + r() * 0.6; g.fillStyle = ['#ff4fa3', '#ff7cc4', '#c86bff', '#ffffff', '#ffb3d9'][(r() * 5) | 0]; const s = 0.6 + r() * 1.8; g.fillRect(r() * innerWidth, r() * innerHeight, s, s); }
    g.globalAlpha = 1; drawTwinkle(g, innerWidth, innerHeight, 0.37, { count: 26, amount: 1 }); };
  paintBg(); addEventListener('resize', () => { paintBg(); app.stages.forEach(s => s.fit()); app.paintAll(); });
  // 위 막대
  $('title').oninput = e => { app.project.title = e.target.value; app.dirty(); };
  $('ratio').onchange = e => app.change(p => { const [w, h] = SIZES[e.target.value], sx = w / p.w, sy = h / p.h; p.ratio = e.target.value; p.w = w; p.h = h; p.subStyle = Object.assign(p.subStyle, defaultSub(w, h), { bar: p.subStyle.bar, font: p.subStyle.font, pal: p.subStyle.pal });
    p.tracks.forEach(t => t.clips.forEach(c => { if (c.box) c.box = { x: Math.round(c.box.x * sx), y: Math.round(c.box.y * sy), w: Math.round(c.box.w * sx), h: Math.round(c.box.h * sx) }; if (c.style && c.style.x != null) { c.style.x *= sx; c.style.y *= sy; } if (c.heart) { c.heart.x *= sx; c.heart.y *= sy; } })); });
  document.querySelectorAll('#theme button').forEach(b => b.onclick = () => { document.querySelectorAll('#theme button').forEach(x => x.classList.toggle('on', x === b)); document.body.className = 'theme-' + b.dataset.v; try { localStorage.setItem('qv:theme', b.dataset.v); } catch (e) {} });
  const th = localStorage.getItem('qv:theme'); if (th) document.querySelector(`#theme button[data-v="${th}"]`)?.click();
  $('btnSave').onclick = () => app.save();
  $('btnExport').onclick = () => app.panels.exportDialog();
  $('chkBox').onclick = () => { const b = app.badList[0]; if (b) { const f = app.find(b.id); app.seek(f.clip.start + 0.01); app.select(b.id); } };
  $('chkOver').onclick = () => { const id = app.overList[0]; if (id) { const f = app.find(id); app.seek(f.clip.start + 0.01); app.select(id); } };
  $('mclose').onclick = () => { $('modal').hidden = true; };
  $('modal').onclick = e => { if (e.target.id === 'modal') $('modal').hidden = true; };
  // 재생
  $('tPlay').onclick = () => app.play(); $('tStart').onclick = () => { app.pause(); app.seek(0); };
  $('tPrev').onclick = () => app.seek(app.t - 1 / app.project.fps); $('tNext').onclick = () => app.seek(app.t + 1 / app.project.fps);
  $('ckGuide').onchange = () => app.paintAll();
  $('ckSide').onchange = e => { document.querySelectorAll('.ctr .col')[1].classList.toggle('hide', !e.target.checked); app.stages.forEach(s => s.fit()); app.paintAll(); };
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); app.play(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? app.doRedo() : app.doUndo(); }
    else if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); app.save(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); app.timeline.tool('dup'); }
    else if (k === 'delete' || k === 'backspace') { if (app.sel) app.removeClip(app.sel); }
    else if (k === 's') app.timeline.tool('split');
    else if (k === 'arrowleft') app.seek(app.t - (e.shiftKey ? 1 : 1 / app.project.fps));
    else if (k === 'arrowright') app.seek(app.t + (e.shiftKey ? 1 : 1 / app.project.fps));
  });
  // 파일 끌어다 놓기 (어디에 놓아도)
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files.length) app.addFiles([...e.dataTransfer.files]); });
  $('filePick').onchange = e => { app.addFiles([...e.target.files]); e.target.value = ''; };
  $('srtPick').onchange = async e => { const f = e.target.files[0]; if (f) app.panels.importSrt(await f.text()); e.target.value = ''; };
  app.panels.tab('files'); app.refresh();
  if (Q.get('demo') != null) app.panels.openDemo();
}
if (Q.get('render')) bootRender(); else bootEditor();
