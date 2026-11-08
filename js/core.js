// 공통: 크기 · 줄 종류 · 설계도 기본값
const EXT = { video: /\.(mp4|mov|webm|m4v)$/i, image: /\.(png|jpe?g|webp|gif|svg)$/i, audio: /\.(mp3|wav|m4a|aac|ogg|flac)$/i, html: /\.html?$/i, srt: /\.(srt|vtt)$/i };
export const SIZES = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080] };
export const KINDS = [['bg', '배경', '#ff4fa3'], ['scene', '장면', '#8f86ff'], ['code', '코드 애니', '#c86bff'], ['motion', '모션랩', '#ff9646'], ['text', '제목', '#ff8fd0'], ['sub', '자막', '#3fc8d4'], ['bling', '블링', '#ffd76a'], ['audio', '소리', '#5fe28a']];
export const uid = () => Math.random().toString(36).slice(2, 9);
export const typeOf = name => Object.keys(EXT).find(k => EXT[k].test(name)) || null;
export const fmt = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return String(m).padStart(2, '0') + ':' + s.toFixed(1).padStart(4, '0'); };

export function defaultSub(w, h) {
  return w < h ? { bar: 'wool', font: 'Gaegu', size: 64, x: w / 2, y: 1500, w: 860, h: 124, align: 'center' }
    : { bar: 'wool', font: 'Gaegu', size: 56, x: w / 2, y: h - 150, w: 1100, h: 104, align: 'center' };
}
export function newProject(ratio = '9:16') {
  const [w, h] = SIZES[ratio];
  return { app: 'quokavideolab', version: 1, title: '새 영상', ratio, w, h, fps: 30, bgColor: '#000000', assets: {},
    tracks: KINDS.map(([kind, name]) => ({ id: 't_' + kind, kind, name, clips: [] })), subStyle: defaultSub(w, h), memos: [] };
}
export function normalize(p) {
  p.tracks = p.tracks || []; KINDS.forEach(([kind, name]) => { if (!p.tracks.some(t => t.kind === kind)) p.tracks.push({ id: 't_' + kind, kind, name, clips: [] }); });
  p.tracks.sort((a, b) => KINDS.findIndex(k => k[0] === a.kind) - KINDS.findIndex(k => k[0] === b.kind));
  p.tracks.forEach(t => t.clips.forEach(c => { c.id = c.id || uid(); }));
  p.assets = p.assets || {}; p.memos = p.memos || []; p.fps = p.fps || 30;
  if (!p.w) [p.w, p.h] = SIZES[p.ratio || '9:16']; p.subStyle = Object.assign(defaultSub(p.w, p.h), p.subStyle || {});
  return p;
}

