// 쿼카 모션랩 연결. 같은 주소(gottkf1208.github.io) 아래에 있어서 모션랩 페이지를 숨겨 열고
// quokaLab.catalog() · quokaLab.html(id, opts) 를 그대로 부른다. 만든 장면은 qmPlayer.seek(초)로 시간을 맞춘다.
export const LAB_URL = (() => {
  const q = new URLSearchParams(location.search).get('lab');
  if (q) return q;
  return new URL('../quoka-motion-lab/', location.href).href;
})();

let labWin = null, labReady = null;
export function lab() {
  if (labReady) return labReady;
  labReady = new Promise((ok, no) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;height:800px;opacity:0;pointer-events:none';
    f.src = LAB_URL + '?embed=quokavideolab';
    document.body.appendChild(f);
    const t0 = Date.now();
    const poll = () => {
      try { if (f.contentWindow && f.contentWindow.quokaLab) { labWin = f.contentWindow; return ok(labWin); } } catch (e) { return no(new Error('모션랩이 다른 주소에 있어요')); }
      if (Date.now() - t0 > 60000) return no(new Error('모션랩을 열지 못했어요'));
      setTimeout(poll, 300);
    };
    poll();
  });
  return labReady;
}
let CAT = null;
export async function catalog() { if (CAT) return CAT; const w = await lab(); CAT = w.quokaLab.catalog(); return CAT; }

export async function motionHTML(id, opts = {}) {
  const w = await lab();
  let html = await w.quokaLab.html(id, Object.assign({ transparent: true, player: true }, opts));
  const base = `<base href="${LAB_URL}">` + (opts.transparent === false ? '' : '<style>html,body{background:transparent!important}</style>');
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + base) : base + html;
  return html;
}
// 바구니 링크(…#basket=XXXX) 풀기 — 모션랩과 같은 방식(URL-safe base64 + JSON)
export function unpackBasket(link) {
  const m = String(link).match(/#basket=([A-Za-z0-9\-_=+/]+)/); if (!m) return null;
  const str = new TextDecoder().decode(Uint8Array.from(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
  const p = JSON.parse(str); if (!p || !Array.isArray(p.s)) return null;
  return { title: p.t || '', ratio: p.r, slots: p.s.map(x => ({ id: x.i, label: x.l || '', dur: x.d, scene: !!x.m, set: x.x || {}, words: x.w ? String(x.w).split(',').map(s => s.trim()) : null, font: x.f, point: x.p, bg: x.b })) };
}

export class MotionLayer {
  constructor(iframe, clip, ratio) {
    this.f = iframe; this.key = ''; this.clip = clip; this.ratio = ratio; this.ready = null;
  }
  async ensure() {
    const c = this.clip, k = JSON.stringify([c.motion, c.set, c.words, c.font, c.point, this.ratio, c.full]);
    if (k === this.key && this.ready) return this.ready;
    this.key = k;
    this.ready = (async () => {
      const html = await motionHTML(c.motion, { set: c.set || {}, words: c.words || undefined, font: c.font || undefined, point: c.point || undefined, ratio: (c.ratio || this.ratio).replace(':', ' / ') });
      await new Promise(ok => { this.f.onload = ok; this.f.srcdoc = html; });
      for (let i = 0; i < 100 && !(this.f.contentWindow && this.f.contentWindow.qmPlayer); i++) await new Promise(r => setTimeout(r, 50));
    })();
    return this.ready;
  }
  async seek(sec) {
    try { await this.ensure(); const p = this.f.contentWindow && this.f.contentWindow.qmPlayer; if (p && p.seek) { if (this.pausedKey !== this.key) { try { p.pause(); } catch (e) {} this.pausedKey = this.key; } p.seek(sec); } } catch (e) { console.warn('[모션랩]', e); }
  }
}
