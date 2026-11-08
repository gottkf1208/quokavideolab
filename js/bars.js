// 자막바 — 영상마다 새로 만든다. 여기 있는 건 '틀'이고, 색은 영상에서 뽑은 색(pal)을 넣는다.
// pal = { base, line, text, key }  (base: 바 색, line: 테두리, text: 글자, key: 핵심어)
export const BARS = [
  { id: 'wool', ko: '양털 구름', pal: { base: '#fffaf2', line: '#ecd6c4', text: '#5a3e30', key: '#e2463a' }, font: 'Gaegu' },
  { id: 'glass', ko: '유리', pal: { base: '#ffffff', line: '#ffffff', text: '#2b2330', key: '#ff4fa3' }, font: 'Pretendard' },
  { id: 'pill', ko: '알약', pal: { base: '#1f1a22', line: '#1f1a22', text: '#ffffff', key: '#ffd76a' }, font: 'Pretendard' },
  { id: 'neon', ko: '네온 테두리', pal: { base: '#140a16', line: '#ff4fa3', text: '#ffffff', key: '#ff8fd0' }, font: 'Pretendard' },
  { id: 'stitch', ko: '바늘땀', pal: { base: '#ffffff', line: '#e2463a', text: '#5a3e30', key: '#e2463a' }, font: 'Gaegu' },
  { id: 'chalk', ko: '칠판 분필', pal: { base: '#2f4a3d', line: '#e9e4d6', text: '#f8f5ec', key: '#ffd76a' }, font: 'Gaegu' },
  { id: 'none', ko: '바 없이 테두리 글자', pal: { base: 'transparent', line: '#2b2330', text: '#ffffff', key: '#ffd76a' }, font: 'Pretendard' },
];
export const barOf = id => BARS.find(b => b.id === id) || BARS[0];

function woolPath(w, h) {
  const r = h / 2, n = Math.max(2, Math.floor((w - h) / 36)), step = (w - h) / n; let d = `M${r} 6 `;
  for (let i = 0; i < n; i++) d += `q${step / 2} -12 ${step} 0 `;
  d += `a${r - 6} ${r - 6} 0 0 1 0 ${h - 12} `;
  for (let i = 0; i < n; i++) d += `q${-step / 2} 12 ${-step} 0 `;
  return d + `a${r - 6} ${r - 6} 0 0 1 0 ${-(h - 12)}z`;
}
export function barSVG(id, w, h, pal, image) {
  const p = Object.assign({}, barOf(id).pal, pal || {}), r = h / 2;
  if (id === 'image' && image) return `<img src="${image}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill">`;
  let body = '';
  if (id === 'wool') body = `<path d="${woolPath(w, h)}" fill="${p.base}" fill-opacity=".96" stroke="${p.line}" stroke-width="3"/>`;
  else if (id === 'glass') body = `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="${r}" fill="${p.base}" fill-opacity=".62" stroke="${p.line}" stroke-opacity=".9" stroke-width="3"/><rect x="${r * .5}" y="8" width="${w - r}" height="${h * .28}" rx="${h * .14}" fill="#fff" fill-opacity=".35"/>`;
  else if (id === 'pill') body = `<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="${p.base}" fill-opacity=".9"/>`;
  else if (id === 'neon') body = `<rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="${r - 6}" fill="${p.base}" fill-opacity=".72" stroke="${p.line}" stroke-width="5" style="filter:drop-shadow(0 0 10px ${p.line}) drop-shadow(0 0 24px ${p.line})"/>`;
  else if (id === 'stitch') body = `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="${r}" fill="${p.base}" fill-opacity=".94"/><rect x="12" y="12" width="${w - 24}" height="${h - 24}" rx="${r - 12}" fill="none" stroke="${p.line}" stroke-width="4" stroke-dasharray="14 10"/>`;
  else if (id === 'chalk') body = `<rect x="0" y="0" width="${w}" height="${h}" rx="18" fill="${p.base}" fill-opacity=".93"/><rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="12" fill="none" stroke="${p.line}" stroke-opacity=".35" stroke-width="3"/>`;
  return body ? `<svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="position:absolute;inset:0;overflow:visible">${body}</svg>` : '';
}
// *핵심어* → 색. 줄바꿈 \n 유지
export function markup(text, keyColor) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc(text || '').replace(/\*([^*]+)\*/g, `<em style="font-style:normal;color:${keyColor}">$1</em>`).replace(/\n/g, '<br>');
}
export const FONTS = [
  { id: 'Pretendard', ko: 'Pretendard', css: "'Pretendard', 'Noto Sans KR', sans-serif" },
  { id: 'Gaegu', ko: '개구쟁이 손글씨', css: "'Gaegu', 'Pretendard', cursive" },
  { id: 'SBAggro', ko: 'SB 어그로', css: "'SBAggroB', 'Pretendard', sans-serif" },
];
export const fontCss = id => (FONTS.find(f => f.id === id) || FONTS[0]).css;

// 영상 한 장에서 색 뽑기 → 자막바 색 제안 (밝은 바탕이면 밝은 바, 진하면 진한 바)
export function paletteFrom(canvas) {
  const ctx = canvas.getContext('2d'), { width: w, height: h } = canvas, d = ctx.getImageData(0, 0, w, h).data;
  const buckets = {};
  for (let i = 0; i < d.length; i += 4 * 37) {
    const r = d[i], g = d[i + 1], b = d[i + 2], k = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5);
    (buckets[k] = buckets[k] || { n: 0, r: 0, g: 0, b: 0 }); const B = buckets[k]; B.n++; B.r += r; B.g += g; B.b += b;
  }
  const cols = Object.values(buckets).map(B => ({ n: B.n, r: B.r / B.n, g: B.g / B.n, b: B.b / B.n }))
    .map(c => Object.assign(c, { l: (c.r * 299 + c.g * 587 + c.b * 114) / 1000, s: Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) }));
  const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  cols.sort((a, b) => b.n - a.n);
  const bg = cols[0], vivid = cols.filter(c => c.s > 70 && c.n > 2).sort((a, b) => b.s * Math.sqrt(b.n) - a.s * Math.sqrt(a.n))[0] || cols[1] || bg;
  const dark = cols.filter(c => c.l < 90).sort((a, b) => b.n - a.n)[0] || { r: 60, g: 45, b: 40 };
  const light = bg.l > 150;
  return { base: light ? '#fffaf2' : hex(dark), line: light ? '#ecd6c4' : hex(vivid), text: light ? hex(dark) : '#ffffff', key: hex(vivid), swatches: cols.slice(0, 6).map(hex) };
}
