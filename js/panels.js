// 왼쪽 탭(재료·자막바·배경·블링·코드 애니·모션랩·뉴테이크·소리)과 오른쪽 속성·메모
import { uid, fmt, normalize } from './core.js';
import { BARS, barOf, barSVG, markup, FONTS, paletteFrom } from './bars.js';
import { TEX, makeTex } from './bling.js';
import { subStyleOf } from './stage.js';
import { catalog, unpackBasket, LAB_URL } from './motionlab.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const ICON = { video: '▶', image: '▣', audio: '♪', html: '&lt;/&gt;', srt: 'T' };
const texURL = {};
function texThumb(id, opt) { const k = id + JSON.stringify(opt || {}); if (!texURL[k]) texURL[k] = makeTex(id, 135, 240, 11, opt || {}).toDataURL('image/jpeg', 0.85); return texURL[k]; }

export class Panels {
  constructor(app) {
    this.app = app; this.cur = 'files'; this.r = 'props';
    document.querySelectorAll('#rail button').forEach(b => b.onclick = () => this.tab(b.dataset.tab));
    document.querySelectorAll('#rtabs button').forEach(b => b.onclick = () => this.rtab(b.dataset.r));
  }
  tab(name) {
    if (name) this.cur = name;
    document.querySelectorAll('#rail button').forEach(b => b.classList.toggle('on', b.dataset.tab === this.cur));
    const el = $('lp'); el.innerHTML = this['tab_' + this.cur]();
    const bind = this['bind_' + this.cur]; if (bind) bind.call(this, el);
  }
  rtab(name) { this.r = name; document.querySelectorAll('#rtabs button').forEach(b => b.classList.toggle('on', b.dataset.r === name)); this.props(); }

  // ---------------- 재료 ----------------
  tab_files() {
    const as = Object.entries(this.app.project.assets);
    return `<h4>재료 <small>${as.length}개</small></h4>
      <div class="row"><button class="b2 pk" id="fOpen">폴더 열기</button><button class="b2" id="fAdd">파일 추가</button></div>
      <div class="row"><button class="b2" id="fDemo">✦ 예시 열기</button></div>
      <div class="drop" id="fDrop">영상·사진·음악·HTML·SRT를<br>여기(또는 화면 아무 데)에 끌어다 놓아요</div>
      <p class="cap">폴더를 열면 그 안의 재료가 보이고, 편집 설계도(quokavideolab.json)가 그 폴더에 저장돼요. 파일은 브라우저 밖으로 나가지 않아요.</p>
      <div class="alist">${as.map(([id, a]) => `<div class="aitem"><span class="ic">${ICON[a.type] || '?'}</span><span class="nm">${esc(a.name)}<small>${a.type}${a.duration ? ' · ' + fmt(a.duration) : ''}${a.w ? ' · ' + a.w + '×' + a.h : ''}</small></span><button data-put="${id}">넣기</button></div>`).join('') || '<div class="empty">아직 재료가 없어요.</div>'}</div>`;
  }
  bind_files(el) {
    $('fOpen').onclick = () => this.app.openFolder(); $('fAdd').onclick = () => $('filePick').click(); $('fDemo').onclick = () => this.openDemo();
    const d = $('fDrop'); d.ondragover = e => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over');
    d.ondrop = () => d.classList.remove('over');
    el.querySelectorAll('[data-put]').forEach(b => b.onclick = () => this.app.place(b.dataset.put));
  }
  async openDemo() {
    const app = this.app, base = new URL('examples/demo/', location.href);
    try { const p = await (await fetch(new URL('quokavideolab.json', base))).json(); app.dir = null; app.files = {}; app.urls = {}; app.base = base; app.project = normalize(p); app.t = 0; app.sel = null; app.undo = []; app.refresh(); this.tab('files'); app.toast('예시를 열었어요 — 스페이스로 재생'); }
    catch (e) { app.toast('예시를 열지 못했어요'); }
  }

  // ---------------- 자막바 ----------------
  tab_bars() {
    const p = this.app.project, s = p.subStyle, pal = s.pal || {};
    const card = b => { const P = Object.assign({}, b.pal, s.bar === b.id ? pal : {}); return `<div class="barcard${s.bar === b.id ? ' on' : ''}" data-bar="${b.id}"><div class="pv"><div class="in">${barSVG(b.id, 200, 24, P)}<span style="position:relative;font-family:${b.font === 'Gaegu' ? 'Gaegu' : 'Pretendard'};color:${P.text};${b.id === 'none' ? `-webkit-text-stroke:2px ${P.line};paint-order:stroke fill;` : ''}">올해도 <b style="color:${P.key}">함께</b></span></div></div><div class="nm">${b.ko}${s.bar === b.id ? ' ✓' : ''}</div></div>`; };
    return `<h4>이 영상의 자막바 <small>영상마다 새로</small></h4>
      <p class="cap">틀을 고르고, 지금 화면에서 색을 뽑아 이 영상만의 자막바로 만들어요. 고르면 자막 전체에 적용돼요.</p>
      <div class="row"><button class="b2 pk" id="bPick">✦ 지금 화면에서 색 뽑기</button></div>
      ${pal.swatches ? `<div class="row" style="gap:4px">${pal.swatches.map(c => `<span style="height:22px;border-radius:6px;background:${c};box-shadow:0 0 0 1px rgba(255,255,255,.15)"></span>`).join('')}</div>` : ''}
      <div class="grid2">${BARS.map(card).join('')}</div>
      <div class="hr"></div>
      <div class="row"><button class="b2" id="bAdd">T 자막 추가</button><button class="b2" id="bSrt">SRT 불러오기</button></div>
      <div class="row"><button class="b2" id="bSrtOut">SRT 내보내기</button><button class="b2" id="bAsk">새 자막바 부탁</button></div>
      <p class="cap">*핵심어*처럼 별표로 감싸면 핵심어 색이 돼요. 더 특별한 자막바(나무·털실 그림 등)는 '새 자막바 부탁'으로 클로드에게 맡겨요.</p>`;
  }
  bind_bars(el) {
    const app = this.app;
    el.querySelectorAll('[data-bar]').forEach(c => c.onclick = () => app.change(p => { const b = barOf(c.dataset.bar); p.subStyle.bar = b.id; p.subStyle.font = b.font; delete p.subStyle.pal; p.tracks.find(t => t.kind === 'sub').clips.forEach(x => { if (x.style) { delete x.style.bar; delete x.style.pal; delete x.style.font; } }); }) || this.tab());
    $('bPick').onclick = () => {
      const st = app.stages[1], cv = document.createElement('canvas'); cv.width = 160; cv.height = Math.round(160 * app.project.h / app.project.w); const g = cv.getContext('2d');
      let drew = false;
      st.root.querySelectorAll('.qv-l').forEach(l => { if (l.style.display === 'none') return; const v = l.querySelector('video,img'); const c = l.querySelector('canvas');
        try { const r = { x: l.offsetLeft / app.project.w * cv.width, y: l.offsetTop / app.project.h * cv.height, w: l.offsetWidth / app.project.w * cv.width, h: l.offsetHeight / app.project.h * cv.height };
          if (v) { g.drawImage(v, r.x, r.y, r.w, r.h); drew = true; } else if (c) { g.drawImage(c, 0, 0, cv.width, cv.height); drew = true; } } catch (e) {} });
      if (!drew) return app.toast('화면에 영상이나 배경이 있을 때 눌러 주세요');
      const pal = paletteFrom(cv); app.change(p => { p.subStyle.pal = pal; }); this.tab(); app.toast('이 화면의 색으로 자막바를 칠했어요');
    };
    $('bAdd').onclick = () => app.timeline.tool('sub'); $('bSrt').onclick = () => $('srtPick').click();
    $('bSrtOut').onclick = () => { const s = this.toSrt(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'text/plain' })); a.download = (app.project.title || 'subtitles') + '.srt'; a.click(); };
    $('bAsk').onclick = () => app.handoff('[새 자막바] 이 영상 분위기에 맞는 자막바를 새로 디자인해 주세요. (지금 틀: ' + barOf(app.project.subStyle.bar).ko + ')');
  }
  importSrt(text) {
    const tc = s => { const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : 0; };
    const blocks = String(text || '').replace(/\r/g, '').split(/\n\s*\n/), clips = [];
    blocks.forEach(b => { const ls = b.split('\n').filter(Boolean); const i = ls.findIndex(l => l.includes('-->')); if (i < 0) return; const [a, z] = ls[i].split('-->'); const tx = ls.slice(i + 1).join('\n').trim(); if (tx) clips.push({ id: uid(), start: tc(a), end: tc(z), text: tx }); });
    if (!clips.length) return this.app.toast('자막을 찾지 못했어요');
    this.app.change(p => { p.tracks.find(t => t.kind === 'sub').clips.push(...clips); }); this.app.toast(`자막 ${clips.length}줄을 넣었어요`);
  }
  toSrt() {
    const tc = t => { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
    return this.app.track('sub').clips.slice().sort((a, b) => a.start - b.start).map((c, i) => `${i + 1}\n${tc(c.start)} --> ${tc(c.end)}\n${c.text.replace(/\*/g, '')}\n`).join('\n');
  }

  // ---------------- 배경 ----------------
  tab_bg() {
    const app = this.app, f = app.sel && app.find(app.sel), sel = f && f.track.kind === 'bg' ? f.clip : app.track('bg').clips[0];
    const cur = sel ? (sel.bg || {}).tex : null, heart = sel && sel.heart && sel.heart.on, frameOn = app.track('scene').clips.some(c => c.fit !== 'full');
    const items = TEX.map(t => ({ id: t.id, ko: t.ko })).concat([{ id: 'gradient', ko: '그라데이션' }, { id: 'solid', ko: '단색' }]);
    return `<div class="seg" style="margin-bottom:10px" id="bgScope"><button data-v="one" class="${this.bgScope !== 'all' ? 'on' : ''}">이 장면만</button><button data-v="all" class="${this.bgScope === 'all' ? 'on' : ''}">전체 장면</button></div>
      <h4>블링 배경 <small>코드로 그려서 크레딧 0</small></h4>
      <div class="grid3">${items.map(t => `<div class="g${cur === t.id ? ' on' : ''}" data-tex="${t.id}" style="background-image:url(${texThumb(t.id, t.id === 'gradient' ? { c1: '#ffe3ee', c2: '#ffffff' } : t.id === 'solid' ? { c1: '#120a14' } : {})})"><span>${t.ko}${cur === t.id ? ' ✓' : ''}</span></div>`).join('')}</div>
      <label class="tg">하트 전구 액자<input type="checkbox" id="bgHeart" ${heart ? 'checked' : ''}><i></i></label>
      <label class="tg">영상 액자 (둥근 카드로 띄우기)<input type="checkbox" id="bgFrame" ${frameOn ? 'checked' : ''}><i></i></label>
      <p class="cap">글리터는 정지 그림이 아니라 영상 안에서 반짝반짝 움직여요. 세기·색은 배경 클립을 고르면 오른쪽 속성에서 바꿔요.</p>`;
  }
  bgTargets(p) { const app = this.app, f = app.sel && app.find(app.sel), tr = p.tracks.find(t => t.kind === 'bg');
    if (!tr.clips.length) { const c = { id: uid(), start: 0, end: app.duration(), bg: { tex: 'pinkGlitter', twinkle: 1 } }; tr.clips.push(c); }
    if (this.bgScope === 'all') return tr.clips; const one = f && f.track.kind === 'bg' ? tr.clips.find(c => c.id === f.clip.id) : tr.clips.find(c => c.start <= app.t && c.end > app.t) || tr.clips[0]; return [one]; }
  bind_bg(el) {
    const app = this.app;
    el.querySelectorAll('#bgScope button').forEach(b => b.onclick = () => { this.bgScope = b.dataset.v; this.tab(); });
    el.querySelectorAll('[data-tex]').forEach(g => g.onclick = () => { app.change(p => this.bgTargets(p).forEach(c => { c.bg = Object.assign(c.bg || {}, { tex: g.dataset.tex }); if (g.dataset.tex === 'gradient' && !c.bg.c1) Object.assign(c.bg, { c1: '#ffe3ee', c2: '#ffffff' }); if (g.dataset.tex === 'solid' && !c.bg.c1) c.bg.c1 = '#120a14'; if (g.dataset.tex === 'heartLights') c.heart = Object.assign(this.heartDefault(p), c.heart || {}, { on: true }); })); this.tab(); });
    $('bgHeart').onchange = e => { app.change(p => this.bgTargets(p).forEach(c => { c.heart = Object.assign(this.heartDefault(p), c.heart || {}, { on: e.target.checked }); })); };
    $('bgFrame').onchange = e => app.change(p => p.tracks.find(t => t.kind === 'scene').clips.forEach(c => { c.fit = e.target.checked ? 'frame' : 'full'; c.frame = c.frame || { radius: 30, border: 9, glow: true }; }));
  }
  heartDefault(p) { const fb = this.app.stages[1].frameBox(this.app.t); return fb ? { x: fb.x + fb.w / 2, y: fb.y + fb.h / 2 + fb.h * 0.06, scale: fb.w / 23.6, count: 52, r: 10, speed: 0.7 } : { x: p.w / 2, y: p.h * 0.48, scale: Math.min(p.w, p.h) * 0.028, count: 52, r: 10, speed: 0.7 }; }

  // ---------------- 블링 ----------------
  tab_bling() {
    const b = this.blingTarget() || { level: 2, shape: 'cross', area: 'frame', speed: 1 };
    const seg = (id, val, opts) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(val) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    return `<h4>✦ 블링 <small>맨 위 반짝임 층</small></h4>
      <p class="cap">${this.app.track('bling').clips.length ? '고른 블링 클립(없으면 지금 시점 블링)을 바꿔요.' : '아직 블링이 없어요. 아래에서 고르면 바로 깔려요.'}</p>
      <div class="fld"><label>세기</label>${seg('blLevel', b.level, [[0, '끔'], [1, '살짝'], [2, '반짝'], [3, '블링블링']])}</div>
      <div class="fld"><label>모양</label>${seg('blShape', b.shape, [['cross', '✦ 십자 빛'], ['orb', '● 빛망울'], ['heart', '♥ 하트']])}</div>
      <div class="fld"><label>자리</label>${seg('blArea', b.area, [['frame', '영상 액자 둘레'], ['sub', '자막 둘레'], ['all', '화면 전체']])}</div>
      <div class="fld"><label>반짝이는 속도 <b>${(b.speed || 1).toFixed(1)}</b></label><input type="range" id="blSpeed" min="0.3" max="2.5" step="0.1" value="${b.speed || 1}"></div>
      <p class="cap">네온 제목은 타임라인의 'Aa 제목'으로, 하트 전구는 배경 탭에서 켜요.</p>`;
  }
  blingTarget() { const app = this.app, f = app.sel && app.find(app.sel); if (f && f.track.kind === 'bling') return f.clip.bling; const c = app.track('bling').clips.find(c => c.start <= app.t && c.end > app.t) || app.track('bling').clips[0]; return c && c.bling; }
  bind_bling(el) {
    const app = this.app;
    const set = (k, v) => app.change(p => { const tr = p.tracks.find(t => t.kind === 'bling'); let tgt = app.sel && tr.clips.find(c => c.id === app.sel);
      if (!tgt) tgt = tr.clips.find(c => c.start <= app.t && c.end > app.t) || tr.clips[0];
      if (!tgt) { tgt = { id: uid(), start: 0, end: app.duration(), bling: { level: 2, shape: 'cross', area: 'frame', speed: 1 } }; tr.clips.push(tgt); }
      tgt.bling[k] = v; });
    [['blLevel', 'level', Number], ['blShape', 'shape', String], ['blArea', 'area', String]].forEach(([id, k, cv]) => el.querySelectorAll('#' + id + ' button').forEach(b => b.onclick = () => { set(k, cv(b.dataset.v)); this.tab(); }));
    $('blSpeed').onchange = e => { set('speed', +e.target.value); this.tab(); };
  }

  // ---------------- 코드 애니 ----------------
  tab_code() {
    const html = Object.entries(this.app.project.assets).filter(([, a]) => a.type === 'html');
    return `<h4>&lt;/&gt; 코드 애니 <small>HTML 그대로</small></h4>
      <p class="cap">코드로 만든 애니메이션(HTML 파일)을 장면이나 레이어로 넣어요. 편집기가 '가상 시계'를 끼워 넣어서 재생바를 움직이면 애니메이션도 정확히 그 시간으로 가요.</p>
      <div class="alist">${html.map(([id, a]) => `<div class="aitem"><span class="ic">&lt;/&gt;</span><span class="nm">${esc(a.name)}<small>${esc(a.path)}</small></span><button data-put="${id}">넣기</button></div>`).join('') || '<div class="empty">폴더에 HTML 파일이 없어요. 재료 탭에서 폴더를 열거나 HTML을 끌어다 놓아요.</div>'}</div>
      <div class="hr"></div>
      <h4>잘 붙는 코드</h4>
      <p class="cap">✔ 시간에 따라 저절로 움직이는 것 — CSS 애니메이션, GSAP, requestAnimationFrame, three.js<br>△ 무작위 움직임은 매번 같게(시드 고정), 사진·글꼴은 HTML 안이나 인터넷 주소로<br>✕ 눌러야 움직이는 것 · 여러 파일로 나뉜 프로젝트 → 클로드에게 '한 파일로 묶어 줘'</p>
      <p class="cap">배경을 투명하게 하려면 HTML의 body 배경을 비워 두면 돼요.</p>`;
  }
  bind_code(el) { el.querySelectorAll('[data-put]').forEach(b => b.onclick = () => this.app.place(b.dataset.put)); }

  // ---------------- 모션랩 ----------------
  tab_lab() {
    return `<h4>쿼카 모션랩 <small><a href="${LAB_URL}" target="_blank" style="color:#ffc6e2">열기 ↗</a></small></h4>
      <input class="inp" id="labQ" placeholder="찾기: 자막, 숫자, 제목, 하트…" value="${esc(this.labQ || '')}">
      <div class="seg" id="labL" style="margin:8px 0"><button data-v="overlay" class="${(this.labL || 'overlay') === 'overlay' ? 'on' : ''}">위에 얹기</button><button data-v="full" class="${this.labL === 'full' ? 'on' : ''}">화면 전체</button></div>
      <div class="mlist" id="labList"><div class="empty">모션랩을 여는 중… (처음엔 조금 걸려요)</div></div>
      <div class="hr"></div>
      <h4>바구니 링크로 한꺼번에</h4>
      <p class="cap">모션랩에서 바구니를 채우고 '링크 복사'한 주소를 붙여 넣으면, 칸 순서대로 재생바부터 이어서 깔아요.</p>
      <div class="row"><input class="inp" id="labBasket" placeholder="https://…/quoka-motion-lab/#basket=…"><button class="b2 pk" id="labGo" style="flex:none">넣기</button></div>`;
  }
  async bind_lab(el) {
    const app = this.app, list = $('labList');
    const paint = async () => {
      let cat; try { cat = await catalog(); } catch (e) { list.innerHTML = `<div class="empty">모션랩을 열지 못했어요. 이 편집기와 모션랩이 같은 주소(gottkf1208.github.io)에 있어야 해요.<br>${esc(e.message)}</div>`; return; }
      const q = (this.labQ || '').trim(), L = this.labL || 'overlay';
      const items = cat.filter(m => m.layer === L && (!q || (m.ko + m.role + m.desc + m.id + (m.catKo || '') + (m.subKo || '')).includes(q))).slice(0, 80);
      list.innerHTML = items.map(m => `<div class="mitem" data-id="${m.id}"><b>${esc(m.ko)}</b><em>${esc(m.role)} · ${m.ratio}${m.fresh ? ' · ★' : ''}</em><small>${esc(m.desc)}</small></div>`).join('') || '<div class="empty">찾는 모션이 없어요.</div>';
      list.querySelectorAll('[data-id]').forEach(d => d.onclick = () => { const m = cat.find(x => x.id === d.dataset.id); this.addMotion(m, app.t); });
    };
    $('labQ').oninput = e => { this.labQ = e.target.value; clearTimeout(this._lq); this._lq = setTimeout(paint, 250); };
    el.querySelectorAll('#labL button').forEach(b => b.onclick = () => { this.labL = b.dataset.v; el.querySelectorAll('#labL button').forEach(x => x.classList.toggle('on', x === b)); paint(); });
    $('labGo').onclick = async () => {
      const bk = (() => { try { return unpackBasket($('labBasket').value); } catch (e) { return null; } })(); if (!bk) return app.toast('바구니 링크를 읽지 못했어요');
      let cat = []; try { cat = await catalog(); } catch (e) {}
      let t = app.t; bk.slots.forEach(s => { const m = cat.find(x => x.id === s.id) || { id: s.id, ko: s.id, layer: s.scene ? 'full' : 'overlay', loop: s.dur || 4 }; this.addMotion(m, t, s); t += s.dur || m.loop || 4; });
      app.toast(`바구니 ${bk.slots.length}칸을 깔았어요`);
    };
    paint();
  }
  addMotion(m, at, s = {}) {
    const p = this.app.project, full = m.layer !== 'overlay' || s.scene, dur = s.dur || m.loop || 4;
    this.app.addClip('motion', { start: at, end: at + dur, motion: m.id, ko: m.ko, set: s.set || {}, words: s.words || null, font: s.font || null, point: s.point || null, full: true, box: { x: 0, y: 0, w: p.w, h: p.h }, layer: full ? 'full' : 'overlay' });
  }

  // ---------------- 뉴테이크 ----------------
  tab_newtake() {
    const subs = this.app.track('sub').clips.length;
    return `<h4>뉴테이크로 만들기 <small>클로드가 대신 돌려요</small></h4>
      <p class="cap">뉴테이크는 유료라서, 여기서 부탁을 적으면 클로드가 <b>예상 크레딧을 먼저 알려 드리고</b> 승인하시면 만들어 이 폴더에 넣어요.</p>
      <div class="fld"><label>목소리 (자막 → AI 목소리)</label><select class="inp" id="ntVoice"><option>밝고 또렷한 선생님 목소리</option><option>차분한 내레이터</option><option>귀여운 어린이 목소리</option><option>다정한 할아버지 목소리</option></select></div>
      <button class="b2 pk" id="ntVoiceGo" style="width:100%">자막 ${subs}줄을 목소리로 부탁</button>
      <div class="hr"></div>
      <div class="fld"><label>영상 구간 늘리기·바꾸기 (고른 장면)</label><textarea class="inp" id="ntVid" placeholder="예: 끝에서 4초 더 이어서, 쿼카와 양이 함께 하트를 그리며 손을 흔들게"></textarea></div>
      <button class="b2" id="ntVidGo" style="width:100%">이 장면 부탁</button>
      <div class="hr"></div>
      <div class="fld"><label>배경음악</label><input class="inp" id="ntMus" placeholder="예: 반짝이는 마림바, 밝고 귀엽게, 15초"></div>
      <button class="b2" id="ntMusGo" style="width:100%">배경음악 부탁</button>
      <p class="cap" style="margin-top:10px">지금 계정은 비회원이라 클링·시댄스 같은 회원 전용 모델은 막힐 수 있어요.</p>`;
  }
  bind_newtake() {
    const app = this.app;
    $('ntVoiceGo').onclick = () => app.handoff(`[뉴테이크 목소리] 자막 ${app.track('sub').clips.length}줄을 '${$('ntVoice').value}'로 만들어 소리 줄(목소리)에 자막 시간대로 넣어 주세요. 만들기 전에 예상 크레딧을 먼저 알려 주세요.`);
    $('ntVidGo').onclick = () => { const f = app.sel && app.find(app.sel); const a = f && f.track.kind === 'scene' ? app.asset(f.clip.asset) : null; if (!a) return app.toast('타임라인에서 장면을 먼저 골라 주세요'); app.handoff(`[뉴테이크 영상] '${a.name}' (${fmt(f.clip.start)}~${fmt(f.clip.end)}): ${$('ntVid').value || '(설명 없음)'} — 만들기 전에 예상 크레딧을 먼저 알려 주세요.`); };
    $('ntMusGo').onclick = () => app.handoff(`[뉴테이크 배경음악] ${$('ntMus').value || '영상 분위기에 맞게'} · 길이 ${fmt(app.duration())} — 상업용으로 쓸 수 있는지 라이선스도 확인해 주세요. 만들기 전에 예상 크레딧을 먼저 알려 주세요.`);
  }

  // ---------------- 소리 ----------------
  tab_sound() {
    const au = Object.entries(this.app.project.assets).filter(([, a]) => a.type === 'audio');
    return `<h4>♪ 소리</h4>
      <div class="alist">${au.map(([id, a]) => `<div class="aitem"><span class="ic">♪</span><span class="nm">${esc(a.name)}<small>${a.duration ? fmt(a.duration) : ''}</small></span><button data-put="${id}">넣기</button></div>`).join('') || '<div class="empty">음악·목소리 파일을 끌어다 놓아요.</div>'}</div>
      <p class="cap" style="margin-top:10px">소리 클립을 고르면 크기·덕킹(말할 때 자동으로 낮춤)·페이드를 바꿀 수 있어요. 목소리 클립은 '목소리'로 표시해 두면 배경음악이 그 동안 내려가요. 최종 음량 검수(LUFS)는 영상 뽑기 때 클로드가 해요.</p>`;
  }
  bind_sound(el) { el.querySelectorAll('[data-put]').forEach(b => b.onclick = () => this.app.place(b.dataset.put)); }

  // ---------------- 오른쪽: 속성 ----------------
  props() {
    const el = $('rp'); if (this.r === 'memo') return this.memoPanel(el);
    const app = this.app, f = app.sel && app.find(app.sel);
    if (!f) { el.innerHTML = this.projectProps(); this.bindForm(el, null); return; }
    const k = f.track.kind, c = f.clip, F = [];
    F.push({ t: 'times' });
    if (k === 'sub') {
      F.push({ t: 'textarea', key: 'text', label: '글자 · *핵심어*', rows: 2 });
      F.push({ t: 'scope' });
      const s = subStyleOf(app.project, c);
      F.push({ t: 'select', skey: 'bar', label: '자막바', opts: BARS.map(b => [b.id, b.ko]), val: s.bar });
      F.push({ t: 'select', skey: 'font', label: '글꼴', opts: FONTS.map(f => [f.id, f.ko]), val: s.font || barOf(s.bar).font });
      F.push({ t: 'range', skey: 'size', label: '글자 크기', min: 24, max: 140, step: 1, val: s.size });
      F.push({ t: 'color2', skeys: ['color', 'keyColor'], labels: ['글자색', '핵심어 색'], vals: [s.color || (s.pal || barOf(s.bar).pal).text, s.keyColor || (s.pal || barOf(s.bar).pal).key] });
      F.push({ t: 'pos', s });
      F.push({ t: 'range', skey: 'w', label: '자막바 폭', min: 200, max: app.project.w, step: 10, val: s.w });
      F.push({ t: 'range', skey: 'h', label: '자막바 높이', min: 50, max: 300, step: 2, val: s.h });
    } else if (k === 'text') {
      const s = Object.assign({ preset: 'neon', size: 88, color: '#ffffff', glow: '#ff3d9a', font: 'Pretendard' }, c.style || {});
      F.push({ t: 'textarea', key: 'text', label: '글자 (줄바꿈 가능)', rows: 2 });
      F.push({ t: 'segc', ckey: 'preset', label: '모양', opts: [['neon', '✦ 네온'], ['chip', '알약 라벨'], ['plain', '그냥 글자']], val: s.preset });
      F.push({ t: 'selectc', ckey: 'font', label: '글꼴', opts: FONTS.map(f => [f.id, f.ko]), val: s.font });
      F.push({ t: 'rangec', ckey: 'size', label: '글자 크기', min: 24, max: 220, step: 1, val: s.size });
      F.push({ t: 'colorc2', ckeys: ['color', 'glow'], labels: ['글자색', '네온 빛'], vals: [s.color, s.glow] });
    } else if (k === 'scene') {
      const a = app.asset(c.asset);
      F.push({ t: 'info', html: `<b>${esc(a ? a.name : '')}</b> ${a && a.duration ? '· ' + fmt(a.duration) : ''}` });
      F.push({ t: 'seg', key: 'fit', label: '보이는 방식', opts: [['frame', '영상 액자'], ['full', '꽉 채움']], val: c.fit || 'frame' });
      F.push({ t: 'num', key: 'in', label: '원본에서 시작(초)', step: 0.1 });
      F.push({ t: 'range', key: 'vol', label: '원본 소리', min: 0, max: 1, step: 0.05, val: c.vol ?? 1 });
      if (c.fit !== 'full') { F.push({ t: 'framef' }); }
    } else if (k === 'bg') {
      const bg = c.bg || {};
      F.push({ t: 'select', key2: ['bg', 'tex'], label: '배경', opts: TEX.map(t => [t.id, t.ko]).concat([['gradient', '그라데이션'], ['solid', '단색']]), val: bg.tex });
      if (bg.tex === 'gradient' || bg.tex === 'solid') F.push({ t: 'colorbg', vals: [bg.c1 || '#ffe3ee', bg.c2 || '#ffffff'], two: bg.tex === 'gradient' });
      F.push({ t: 'range', key2: ['bg', 'twinkle'], label: '반짝임 양', min: 0, max: 2.5, step: 0.1, val: bg.twinkle ?? 1 });
      F.push({ t: 'range', key2: ['bg', 'speed'], label: '반짝이는 속도', min: 0.2, max: 3, step: 0.1, val: bg.speed ?? 1 });
      F.push({ t: 'range', key2: ['bg', 'density'], label: '글리터 밀도', min: 0.3, max: 1.8, step: 0.1, val: bg.density ?? 1 });
      F.push({ t: 'toggle', key2: ['heart', 'on'], label: '하트 전구', val: !!(c.heart && c.heart.on) });
    } else if (k === 'bling') {
      F.push({ t: 'info', html: '세기·모양·자리는 왼쪽 <b>블링</b> 탭에서 바꿔요.' });
    } else if (k === 'code') {
      const a = app.asset(c.asset);
      F.push({ t: 'info', html: `<b>${esc(a ? a.name : '')}</b> — 재생바 시간에 맞춰 멈추고 돌아가요` });
      F.push({ t: 'seg', key: 'full', label: '자리', opts: [['true', '화면 전체'], ['false', '상자']], val: String(!!c.full) });
    } else if (k === 'motion') {
      F.push({ t: 'info', html: `<b>${esc(c.ko || c.motion)}</b> <span style="color:var(--mu)">${esc(c.motion)}</span>` });
      F.push({ t: 'motionset' });
      F.push({ t: 'seg', key: 'full', label: '자리', opts: [['true', '화면 전체'], ['false', '상자']], val: String(!!c.full) });
    } else if (k === 'audio') {
      const a = app.asset(c.asset);
      F.push({ t: 'info', html: `<b>${esc(a ? a.name : '')}</b>` });
      F.push({ t: 'range', key: 'vol', label: '크기', min: 0, max: 1.5, step: 0.05, val: c.vol ?? 0.8 });
      F.push({ t: 'toggle', key: 'voice', label: '목소리(이 동안 음악을 낮춤)', val: !!c.voice });
      F.push({ t: 'toggle', key: 'duck', label: '덕킹 받기(목소리 나올 때 낮아짐)', val: !!c.duck });
      F.push({ t: 'num', key: 'fadeIn', label: '페이드 인(초)', step: 0.1 }); F.push({ t: 'num', key: 'fadeOut', label: '페이드 아웃(초)', step: 0.1 });
    }
    el.innerHTML = F.map(x => this.field(x, c, k)).join('') + `<div class="row" style="margin-top:6px"><button class="b2" id="pDup">⧉ 복제</button><button class="b2" id="pDel">⌫ 지우기</button></div>`;
    this.bindForm(el, f);
  }
  projectProps() {
    const p = this.app.project, d = this.app.duration();
    return `<h4>영상 전체</h4><div class="fld"><label>크기 <b>${p.w}×${p.h} · ${p.fps}fps · ${fmt(d)}</b></label></div>
      <div class="fld"><label>프레임</label><div class="seg" id="pFps">${[24, 30, 60].map(f => `<button data-v="${f}" class="${p.fps === f ? 'on' : ''}">${f}fps</button>`).join('')}</div></div>
      <div class="hand" style="margin-top:12px">타임라인이나 화면에서 무엇이든 누르면 여기서 고쳐요.<br><br><b>스페이스</b> 재생 · <b>S</b> 자르기 · <b>Ctrl+D</b> 복제 · <b>Delete</b> 지우기 · <b>Ctrl+Z</b> 되돌리기 · <b>← →</b> 한 프레임</div>`;
  }
  field(x, c, k) {
    const app = this.app, v = x.key ? c[x.key] : null;
    const seg = (id, val, opts) => `<div class="seg" id="${id}">${opts.map(([o, l]) => `<button data-v="${o}" class="${String(val) === String(o) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    switch (x.t) {
      case 'times': return `<div class="row"><div class="fld"><label>시작</label><input class="inp" type="number" step="0.1" data-time="start" value="${c.start.toFixed(2)}"></div><div class="fld"><label>끝</label><input class="inp" type="number" step="0.1" data-time="end" value="${c.end.toFixed(2)}"></div></div>`;
      case 'textarea': return `<div class="fld"><label>${x.label}</label><textarea class="inp" rows="${x.rows || 2}" data-key="${x.key}">${esc(v)}</textarea></div>`;
      case 'scope': return `<div class="fld"><label>적용 범위</label>${seg('pScope', app.scope, [['one', '이 자막만'], ['all', `자막 전체 ${app.track('sub').clips.length}개`]])}</div>`;
      case 'select': return `<div class="fld"><label>${x.label}</label><select class="inp" ${x.skey ? `data-skey="${x.skey}"` : `data-key2="${x.key2.join('.')}"`}>${x.opts.map(([o, l]) => `<option value="${o}" ${String(x.val) === String(o) ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
      case 'selectc': return `<div class="fld"><label>${x.label}</label><select class="inp" data-ckey="${x.ckey}">${x.opts.map(([o, l]) => `<option value="${o}" ${String(x.val) === String(o) ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
      case 'range': { const attr = x.skey ? `data-skey="${x.skey}"` : x.key2 ? `data-key2="${x.key2.join('.')}"` : `data-key="${x.key}"`; return `<div class="fld"><label>${x.label} <b>${+(+x.val).toFixed(2)}</b></label><input type="range" min="${x.min}" max="${x.max}" step="${x.step}" value="${x.val}" ${attr} data-num="1"></div>`; }
      case 'rangec': return `<div class="fld"><label>${x.label} <b>${x.val}</b></label><input type="range" min="${x.min}" max="${x.max}" step="${x.step}" value="${x.val}" data-ckey="${x.ckey}" data-num="1"></div>`;
      case 'color2': return `<div class="row"><div class="fld"><label>${x.labels[0]}</label><input type="color" data-skey="${x.skeys[0]}" value="${x.vals[0]}"></div><div class="fld"><label>${x.labels[1]}</label><input type="color" data-skey="${x.skeys[1]}" value="${x.vals[1]}"></div></div>`;
      case 'colorc2': return `<div class="row"><div class="fld"><label>${x.labels[0]}</label><input type="color" data-ckey="${x.ckeys[0]}" value="${x.vals[0]}"></div><div class="fld"><label>${x.labels[1]}</label><input type="color" data-ckey="${x.ckeys[1]}" value="${x.vals[1]}"></div></div>`;
      case 'colorbg': return `<div class="row"><div class="fld"><label>${x.two ? '위 색' : '색'}</label><input type="color" data-key2="bg.c1" value="${x.vals[0]}"></div>${x.two ? `<div class="fld"><label>아래 색</label><input type="color" data-key2="bg.c2" value="${x.vals[1]}"></div>` : ''}</div>`;
      case 'pos': { const p = app.project; return `<div class="fld"><label>위치</label>${seg('pPos', '', [['top', '위'], ['mid', '가운데'], ['low', '자막 자리'], ['empty', '빈 자리 찾기']])}</div><div class="row"><div class="fld"><label>가로 X</label><input class="inp" type="number" data-skey="x" data-num="1" value="${Math.round(x.s.x)}"></div><div class="fld"><label>세로 Y</label><input class="inp" type="number" data-skey="y" data-num="1" value="${Math.round(x.s.y)}"></div></div>`; }
      case 'seg': return `<div class="fld"><label>${x.label}</label>${seg('seg_' + x.key, x.val, x.opts).replace('class="seg"', `class="seg" data-segkey="${x.key}"`)}</div>`;
      case 'segc': return `<div class="fld"><label>${x.label}</label>${seg('segc_' + x.ckey, x.val, x.opts).replace('class="seg"', `class="seg" data-segckey="${x.ckey}"`)}</div>`;
      case 'num': return `<div class="fld"><label>${x.label}</label><input class="inp" type="number" step="${x.step}" data-key="${x.key}" data-num="1" value="${c[x.key] ?? 0}"></div>`;
      case 'toggle': return `<label class="tg">${x.label}<input type="checkbox" ${x.key ? `data-key="${x.key}"` : `data-key2="${x.key2.join('.')}"`} data-bool="1" ${x.val ? 'checked' : ''}><i></i></label>`;
      case 'info': return `<div class="fld" style="font-size:12.5px;line-height:1.5">${x.html}</div>`;
      case 'framef': { const fr = c.frame || {}; return `<div class="row"><div class="fld"><label>모서리</label><input class="inp" type="number" data-key2="frame.radius" data-num="1" value="${fr.radius ?? 30}"></div><div class="fld"><label>흰 테두리</label><input class="inp" type="number" data-key2="frame.border" data-num="1" value="${fr.border ?? 9}"></div></div><label class="tg">핑크 빛 테두리<input type="checkbox" data-key2="frame.glow" data-bool="1" ${fr.glow ? 'checked' : ''}><i></i></label>`; }
      case 'motionset': { const keys = Object.keys(c.set || {}); return `<div class="fld"><label>문구 (상수 이름: 값, JSON)</label><textarea class="inp" rows="3" data-json="set">${esc(JSON.stringify(c.set || {}, null, 0))}</textarea></div>${keys.length ? '' : '<p class="cap">비워 두면 모션랩 기본 문구로 나와요. 예: {"TITLE":"올해도 함께"}</p>'}`; }
    }
    return '';
  }
  bindForm(el, f) {
    const app = this.app;
    el.querySelectorAll('#pFps button').forEach(b => b.onclick = () => app.change(p => { p.fps = +b.dataset.v; }));
    if (!f) return;
    const c = f.clip, k = f.track.kind;
    const upd = (fn, quiet = true) => app.change(() => fn(), quiet);
    el.querySelectorAll('[data-time]').forEach(i => i.onchange = () => upd(() => { const v = Math.max(0, +i.value); if (i.dataset.time === 'start') c.start = Math.min(v, c.end - 0.1); else c.end = Math.max(v, c.start + 0.1); }, false));
    el.querySelectorAll('[data-key]').forEach(i => { const ev = i.tagName === 'TEXTAREA' || i.type === 'number' ? 'input' : 'change';
      i.addEventListener(ev, () => upd(() => { c[i.dataset.key] = i.dataset.bool ? i.checked : i.dataset.num ? +i.value : i.value; }));
      if (i.type === 'range') i.addEventListener('input', () => { i.previousElementSibling.querySelector('b').textContent = i.value; c[i.dataset.key] = +i.value; app.stages.forEach(s => { s.sync(); s.seek(app.t); }); }); });
    el.querySelectorAll('[data-key2]').forEach(i => i.addEventListener(i.type === 'range' ? 'input' : 'change', () => { const [a, b] = i.dataset.key2.split('.'); c[a] = c[a] || {}; c[a][b] = i.dataset.bool ? i.checked : i.dataset.num || i.type === 'range' ? +i.value : i.value;
      if (a === 'heart' && i.checked) Object.assign(c.heart, Object.assign(this.heartDefault(app.project), c.heart));
      if (i.type === 'range') { i.previousElementSibling.querySelector('b').textContent = i.value; app.stages.forEach(s => { s.sync(); s.seek(app.t); }); clearTimeout(this._rk); this._rk = setTimeout(() => { app.dirty(); }, 400); }
      else upd(() => {}, i.tagName !== 'SELECT'); }));
    // 자막 스타일: 이 자막만 / 전체
    const setS = (key, val) => upd(() => { if (app.scope === 'all') { app.project.subStyle[key] = val; app.track('sub').clips.forEach(x => { if (x.style) delete x.style[key]; }); } else { c.style = c.style || {}; c.style[key] = val; } });
    el.querySelectorAll('[data-skey]').forEach(i => { const ev = i.type === 'range' || i.type === 'color' ? 'input' : 'change';
      i.addEventListener(ev, () => { const v = i.dataset.num ? +i.value : i.value; if (i.type === 'range') i.previousElementSibling.querySelector('b').textContent = i.value;
        if (i.dataset.skey === 'bar') { const b = barOf(v); setS('bar', v); setS('font', b.font); return; }
        setS(i.dataset.skey, v); }); });
    el.querySelectorAll('#pScope button').forEach(b => b.onclick = () => { app.scope = b.dataset.v; this.props(); });
    el.querySelectorAll('#pPos button').forEach(b => b.onclick = () => { const p = app.project, s = subStyleOf(p, c); let y;
      if (b.dataset.v === 'top') y = p.w < p.h ? 360 : 140; else if (b.dataset.v === 'mid') y = p.h / 2; else if (b.dataset.v === 'low') y = p.w < p.h ? 1500 : p.h - 150;
      else { const fb = app.stages[1].frameBox(app.t); y = fb ? (fb.y + fb.h + 40 + s.h / 2 < p.h - 420 ? fb.y + fb.h + 60 + s.h / 2 : fb.y - 60 - s.h / 2) : p.h * 0.78; }
      setS('y', Math.round(y)); setS('x', p.w / 2); this.props(); });
    el.querySelectorAll('[data-ckey]').forEach(i => i.addEventListener(i.type === 'range' || i.type === 'color' ? 'input' : 'change', () => { c.style = c.style || {}; c.style[i.dataset.ckey] = i.dataset.num ? +i.value : i.value; if (i.type === 'range') i.previousElementSibling.querySelector('b').textContent = i.value; upd(() => {}); }));
    el.querySelectorAll('[data-segkey]').forEach(s => s.querySelectorAll('button').forEach(b => b.onclick = () => upd(() => { const key = s.dataset.segkey; let v = b.dataset.v; if (v === 'true' || v === 'false') v = v === 'true'; c[key] = v; if (key === 'full' && v) c.box = { x: 0, y: 0, w: app.project.w, h: app.project.h }; if (key === 'full' && !v) c.box = { x: app.project.w * 0.1, y: app.project.h * 0.3, w: app.project.w * 0.8, h: app.project.w * 0.8 * 9 / 16 }; if (key === 'fit' && v === 'frame') c.frame = c.frame || { radius: 30, border: 9, glow: true }; }, false)));
    el.querySelectorAll('[data-segckey]').forEach(s => s.querySelectorAll('button').forEach(b => b.onclick = () => upd(() => { c.style = c.style || {}; c.style[s.dataset.segckey] = b.dataset.v; }, false)));
    el.querySelectorAll('[data-json]').forEach(i => i.onchange = () => { try { const v = JSON.parse(i.value || '{}'); upd(() => { c[i.dataset.json] = v; }); } catch (e) { app.toast('JSON 모양이 아니에요'); } });
    const d = $('pDup'), x = $('pDel'); if (d) d.onclick = () => app.timeline.tool('dup'); if (x) x.onclick = () => app.removeClip(c.id);
  }
  // ---------------- 오른쪽: 메모·Claude ----------------
  memoPanel(el) {
    const app = this.app, ms = app.project.memos;
    el.innerHTML = `<h4>메모 <small>${ms.filter(m => !m.done).length}개 남음</small></h4>
      ${ms.map(m => `<div class="memo${m.done ? ' done' : ''}" data-id="${m.id}"><input type="checkbox" ${m.done ? 'checked' : ''} data-done="${m.id}"><time data-t="${m.t}">${fmt(m.t)}</time><div>${esc(m.text)}</div><button class="x" data-x="${m.id}">✕</button></div>`).join('') || '<div class="empty">클로드에게 맡길 일을 시점마다 적어 두세요. (예: "여기 멧돼지 빼줘", "이 장면 4초 더 늘려줘")</div>'}
      <textarea class="inp" id="memoText" rows="3" placeholder="${fmt(app.t)} 시점 메모…" style="margin-top:6px"></textarea>
      <div class="row" style="margin-top:6px"><button class="b2" id="memoAdd">+ 이 시점에 메모</button></div>
      <div class="hr"></div>
      <div class="hand"><b>✦ 클로드에게 넘기기</b><br>설계도와 메모를 폴더에 저장하고, 클로드에게 할 말을 복사해 드려요. 클로드는 같은 폴더를 읽고 처리한 뒤 결과를 다시 넣어요.<button class="btn" id="memoGo" style="width:100%;margin-top:10px">✦ 클로드에게 넘기기</button></div>`;
    el.querySelectorAll('[data-done]').forEach(i => i.onchange = () => { const m = ms.find(x => x.id === i.dataset.done); m.done = i.checked; app.dirty(); this.props(); });
    el.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { app.project.memos = ms.filter(x => x.id !== b.dataset.x); app.dirty(); this.props(); });
    el.querySelectorAll('[data-t]').forEach(t => t.onclick = () => app.seek(+t.dataset.t));
    $('memoAdd').onclick = () => { const v = $('memoText').value.trim(); if (!v) return; ms.push({ id: uid(), t: app.t, text: v, done: false }); app.dirty(); this.props(); };
    $('memoGo').onclick = () => { const v = $('memoText').value.trim(); app.handoff(v || null); };
  }
  exportDialog() {
    const app = this.app, p = app.project;
    app.modal(`<h3>✦ 영상 뽑기</h3>
      <p>최종 영상은 클로드가 편집 화면과 <b>같은 틀로 한 프레임씩</b> 찍어서 만들어요. 그래서 미리보기와 똑같이 나오고, 음량 검수(LUFS·피크)까지 같이 해요.</p>
      <div class="hand" style="margin-top:10px">${p.ratio} · ${p.w}×${p.h} · ${p.fps}fps · ${fmt(app.duration())}<button class="btn" id="exGo" style="width:100%;margin-top:10px">클로드에게 영상 뽑기 맡기기</button></div>
      <p class="cap" style="margin-top:10px">클로드 코드가 있는 컴퓨터라면 직접도 돼요: <code>node quokavideolab/render/render.mjs 폴더/quokavideolab.json</code></p>`);
    $('exGo').onclick = () => { $('modal').hidden = true; app.handoff(`[영상 뽑기] ${p.w}×${p.h} ${p.fps}fps 최종본 mp4로 뽑고 음량 검수(-16 LUFS, 피크 -1 dBTP 이하)까지 해 주세요.`); };
  }
}
