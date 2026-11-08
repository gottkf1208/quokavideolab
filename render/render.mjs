#!/usr/bin/env node
// 쿼카 비디오랩 — 영상 뽑기 (편집기 '완성 미리보기'와 같은 무대를 한 프레임씩 찍어 mp4로)
//
//   node render/render.mjs <프로젝트폴더/quokavideolab.json> [--out 결과.mp4] [--fps 30] [--from 0] [--to 끝]
//                          [--draft]  (720 폭 초안)  [--lab 모션랩폴더]  [--png 폴더](낱장만)
//
// 필요한 것: Node 18+, ffmpeg, playwright(`npm i playwright && npx playwright install chromium`)
// 모션랩 클립이 있으면 모션랩 저장소가 필요(없으면 알아서 git clone). 같은 주소로 띄워야 quokaLab을 부를 수 있음.
import fs from 'fs'; import path from 'path'; import os from 'os'; import http from 'http'; import { spawn, spawnSync } from 'child_process'; import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), APP = path.resolve(HERE, '..');
const args = process.argv.slice(2), opt = {}; let projPath = null;
for (let i = 0; i < args.length; i++) { const a = args[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true; opt[k] = v; } else projPath = a; }
if (!projPath) { console.log('사용법: node render/render.mjs 폴더/quokavideolab.json [--out 결과.mp4] [--draft]'); process.exit(1); }
projPath = path.resolve(projPath); const PROJ_DIR = path.dirname(projPath);
const P = JSON.parse(fs.readFileSync(projPath, 'utf8'));
const FPS = +(opt.fps || P.fps || 30);
let DUR = 0; P.tracks.forEach(t => t.clips.forEach(c => { DUR = Math.max(DUR, c.end); }));
const T0 = +(opt.from || 0), T1 = Math.min(DUR, +(opt.to || DUR)), N = Math.max(1, Math.round((T1 - T0) * FPS));
const OUT = path.resolve(opt.out || path.join(PROJ_DIR, (P.title || 'quokavideolab').replace(/[\\/:*?"<>|]/g, '_') + (opt.draft ? '_초안.mp4' : '.mp4')));
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'qvr-'));
const log = (...m) => console.log('[영상 뽑기]', ...m);
const run = (cmd, a, o = {}) => { const r = spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 1 << 28, ...o }); if (r.status !== 0) throw new Error(cmd + ' 실패: ' + (r.stderr || '').slice(-1500)); return r; };
const probeDur = f => { try { return +run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout.trim(); } catch (e) { return 0; } };
const hasAudio = f => { try { return run('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', f]).stdout.trim().length > 0; } catch (e) { return false; } };

// 1) 장면 영상 → 낱장 (헤드리스 크롬은 H.264를 못 읽어서 미리 풀어 둠)
const FR = path.join(WORK, 'frames'); fs.mkdirSync(FR); const meta = {};
const usedVideo = new Set(); P.tracks.filter(t => t.kind === 'scene').forEach(t => t.clips.forEach(c => { const a = P.assets[c.asset]; if (a && a.type === 'video') usedVideo.add(c.asset); }));
for (const id of usedVideo) {
  const a = P.assets[id], src = path.join(PROJ_DIR, a.path); fs.mkdirSync(path.join(FR, id));
  log('낱장 풀기:', a.name);
  run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `fps=${FPS}`, '-q:v', '2', path.join(FR, id, '%06d.jpg')]);
  meta[id] = { fps: FPS, count: fs.readdirSync(path.join(FR, id)).length };
}
fs.writeFileSync(path.join(FR, 'meta.json'), JSON.stringify(meta));

// 2) 모션랩 (같은 주소로 띄워야 함)
let LAB = opt.lab ? path.resolve(opt.lab) : null;
const usesLab = P.tracks.some(t => t.kind === 'motion' && t.clips.length);
if (usesLab && !LAB) {
  const guess = [path.resolve(APP, '..', 'quoka-motion-lab'), path.join(os.homedir(), '.cache', 'quoka-motion-lab')].find(d => fs.existsSync(path.join(d, 'index.html')));
  LAB = guess || path.join(os.homedir(), '.cache', 'quoka-motion-lab');
  if (!guess) { log('모션랩 받는 중…'); run('git', ['clone', '--depth', '1', 'https://github.com/gottkf1208/quoka-motion-lab.git', LAB]); }
}

// 3) 작은 서버: /quokavideolab = 편집기, /proj = 프로젝트 폴더, /frames = 낱장, /quoka-motion-lab = 모션랩
const MOUNT = { '/quokavideolab/': APP, '/proj/': PROJ_DIR, '/frames/': FR }; if (LAB) MOUNT['/quoka-motion-lab/'] = LAB;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); const m = Object.keys(MOUNT).find(k => u.startsWith(k));
  if (!m) { res.writeHead(404); return res.end(); }
  let f = path.join(MOUNT[m], u.slice(m.length)); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(MOUNT[m]) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok)); const PORT = server.address().port;

// 4) 크롬으로 한 프레임씩
let pw; try { pw = await import(process.env.QV_PLAYWRIGHT || 'playwright'); } catch (e) { console.error('playwright가 없어요: npm i playwright && npx playwright install chromium'); process.exit(1); }
const chromium = pw.chromium || pw.default.chromium;
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: P.w, height: P.h } });
if (process.env.HTTPS_PROXY || process.env.https_proxy) { // 프록시 뒤(클라우드)에서는 바깥 주소를 대신 받아 넘김
  try { const { ProxyAgent, fetch: uf } = await import(process.env.QV_UNDICI || 'undici'); const ca = ['/root/.ccr/ca-bundle.crt', process.env.SSL_CERT_FILE].filter(p => p && fs.existsSync(p)).map(p => fs.readFileSync(p));
    const agent = new ProxyAgent({ uri: process.env.HTTPS_PROXY || process.env.https_proxy, requestTls: ca.length ? { ca } : undefined }); const cache = new Map();
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, async r => { const url = r.request().url(); try { if (!cache.has(url)) { const x = await uf(url, { dispatcher: agent }); cache.set(url, { s: x.status, t: x.headers.get('content-type') || '', b: Buffer.from(await x.arrayBuffer()) }); } const c = cache.get(url); await r.fulfill({ status: c.s, headers: { 'content-type': c.t, 'access-control-allow-origin': '*' }, body: c.b }); } catch (e) { await r.abort(); } });
  } catch (e) { log('(바깥 주소 우회 없이 진행)'); }
}
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/quokavideolab/index.html?render=1&project=/proj/${encodeURIComponent(path.basename(projPath))}&frames=/frames`);
await page.waitForFunction(() => window.__qv, null, { timeout: 120000 });
log(`${P.w}×${P.h} · ${FPS}fps · ${(T1 - T0).toFixed(2)}초 · ${N}프레임`);
await page.evaluate(t => window.__qv.seek(t), T0); await page.waitForTimeout(1500); // 첫 장면 준비(글꼴·iframe)

const VID = path.join(WORK, 'video.mp4'), scale = opt.draft ? `,scale=${P.w < P.h ? 720 : 1280}:-2` : '';
let ff = null, pngDir = opt.png ? path.resolve(opt.png) : null; if (pngDir) fs.mkdirSync(pngDir, { recursive: true });
if (!pngDir) ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-vf', `format=yuv420p${scale}`, '-c:v', 'libx264', '-preset', opt.best ? 'slow' : 'veryfast', '-crf', opt.draft ? '23' : '17', '-r', String(FPS), VID], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const t = T0 + i / FPS; await page.evaluate(t => window.__qv.seek(t), t);
  const buf = await page.screenshot({ type: pngDir ? 'png' : 'jpeg', quality: pngDir ? undefined : 94 });
  if (pngDir) fs.writeFileSync(path.join(pngDir, String(i + 1).padStart(6, '0') + '.png'), buf);
  else if (!ff.stdin.write(buf)) await new Promise(ok => ff.stdin.once('drain', ok));
  if (i % Math.max(1, Math.round(FPS * 2)) === 0) process.stdout.write(`\r  ${i + 1}/${N} (${Math.round((i + 1) / N * 100)}%)  `);
}
console.log(`\r  ${N}/${N} 완료 · ${((Date.now() - t0) / 1000).toFixed(1)}초`);
await browser.close(); server.close();
if (errs.length) log('페이지 경고:', [...new Set(errs)].slice(0, 5).join(' | '));
if (pngDir) { log('낱장 저장:', pngDir); process.exit(0); }
ff.stdin.end(); await new Promise(ok => ff.on('close', ok));

// 5) 소리: 장면 영상 소리 + 소리 줄(음악·목소리), 목소리 나올 때 음악 덕킹, -16 LUFS · 피크 -1 dBTP
const inputs = [], parts = [], voice = [], music = [];
const add = (file, c, vol, kind) => {
  const i = inputs.length; inputs.push(file); const len = Math.min(c.end, T1) - Math.max(c.start, T0); if (len <= 0) return;
  const inn = (c.in || 0) + Math.max(0, T0 - c.start), delay = Math.round(Math.max(0, c.start - T0) * 1000);
  let f = `[${i}:a]atrim=start=${inn}:duration=${len},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=${vol}`;
  if (c.fadeIn) f += `,afade=t=in:st=0:d=${c.fadeIn}`; if (c.fadeOut) f += `,afade=t=out:st=${Math.max(0, len - c.fadeOut)}:d=${c.fadeOut}`;
  const lab = `s${i}`; parts.push(f + `,adelay=${delay}|${delay},apad=whole_dur=${T1 - T0}[${lab}]`); (kind === 'music' ? music : voice).push(lab);
};
P.tracks.forEach(t => t.clips.forEach(c => {
  const a = P.assets[c.asset]; if (!a) return; const f = path.join(PROJ_DIR, a.path);
  if (t.kind === 'scene' && a.type === 'video' && (c.vol ?? 1) > 0 && hasAudio(f)) add(f, c, c.vol ?? 1, 'voice');
  if (t.kind === 'audio' && fs.existsSync(f)) add(f, c, c.vol ?? 0.8, c.voice || !c.duck ? 'voice' : 'music');
}));
const AUD = path.join(WORK, 'mix.wav');
if (inputs.length) {
  const mixOf = (labs, name) => labs.length > 1 ? `${labs.map(l => `[${l}]`).join('')}amix=inputs=${labs.length}:normalize=0[${name}]` : `[${labs[0]}]anull[${name}]`;
  let g = parts.join(';');
  if (voice.length && music.length) g += `;${mixOf(voice, 'v')};${mixOf(music, 'm')};[v]asplit=2[v1][v2];[m][v2]sidechaincompress=threshold=0.03:ratio=8:attack=30:release=600[md];[v1][md]amix=inputs=2:normalize=0[out]`;
  else g += `;${mixOf(voice.length ? voice : music, 'out')}`;
  run('ffmpeg', ['-v', 'error', '-y', ...inputs.flatMap(f => ['-i', f]), '-filter_complex', g, '-map', '[out]', '-t', String(T1 - T0), '-c:a', 'pcm_f32le', AUD]);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', AUD, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const I = +([...r.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop() || [])[1]; const gain = isFinite(I) && I > -70 ? Math.min(20, -16 - I) : 0;
  log(`소리: ${inputs.length}개 섞음 · 원래 ${isFinite(I) ? I.toFixed(1) : '?'} LUFS → ${gain >= 0 ? '+' : ''}${gain.toFixed(1)}dB`);
  run('ffmpeg', ['-v', 'error', '-y', '-i', AUD, '-af', `volume=${gain}dB,alimiter=limit=0.89:attack=5:release=50:level=false`, '-c:a', 'pcm_f32le', AUD + '.n.wav']); fs.renameSync(AUD + '.n.wav', AUD);
} else run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', String(T1 - T0), AUD]);
run('ffmpeg', ['-v', 'error', '-y', '-i', VID, '-i', AUD, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', OUT]);

// 6) 검수
const d = probeDur(OUT), lr = spawnSync('ffmpeg', ['-hide_banner', '-i', OUT, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const I = ([...lr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop() || [])[1], TP = ([...lr.matchAll(/Peak:\s+(-?[\d.]+|-inf) dBFS/g)].pop() || [])[1];
log(`완성: ${OUT}`); log(`길이 ${d.toFixed(2)}초 · 음량 ${I ?? '-'} LUFS · 최대 피크 ${TP ?? '-'} dBTP`);
fs.rmSync(WORK, { recursive: true, force: true });
