// 코드로 만든 애니메이션(HTML)을 편집기 시간에 맞춰 멈추고 돌리는 장치.
// HTML 맨 앞에 '가상 시계'를 끼워 넣는다: performance.now · Date · requestAnimationFrame · setTimeout/Interval ·
// CSS/Web 애니메이션이 모두 편집기의 재생바 시간을 따른다. (개념극장 녹화 때 쓴 방식과 같음)
const SHIM = `<script>(function(){
var T=0,D0=1767225600000,raf=[],rid=0,timers=[],tid=0,_D=Date;
performance.now=function(){return T};
function QD(){var a=[].slice.call(arguments);if(!(this instanceof QD))return new _D(D0+T).toString();return a.length?new (Function.prototype.bind.apply(_D,[null].concat(a)))():new _D(D0+T)}
QD.prototype=_D.prototype;QD.now=function(){return D0+T};QD.parse=_D.parse;QD.UTC=_D.UTC;window.Date=QD;
window.requestAnimationFrame=function(cb){raf.push({id:++rid,cb:cb});return rid};
window.cancelAnimationFrame=function(id){raf=raf.filter(function(r){return r.id!==id})};
window.setTimeout=function(cb,ms){var a=[].slice.call(arguments,2),id=++tid;timers.push({id:id,at:T+(+ms||0),cb:cb,a:a,ev:0});return id};
window.setInterval=function(cb,ms){var a=[].slice.call(arguments,2),id=++tid;timers.push({id:id,at:T+(+ms||0),cb:cb,a:a,ev:Math.max(4,+ms||0)});return id};
window.clearTimeout=window.clearInterval=function(id){timers=timers.filter(function(t){return t.id!==id})};
function fire(to){for(var g=0;g<5000;g++){var due=null;timers.forEach(function(t){if(t.at<=to&&(!due||t.at<due.at))due=t});if(!due)break;T=Math.max(T,due.at);if(due.ev)due.at+=due.ev;else timers=timers.filter(function(t){return t!==due});try{typeof due.cb==='function'?due.cb.apply(null,due.a):(0,eval)(due.cb)}catch(e){console.error(e)}}}
function step(to){fire(to);T=to;var q=raf;raf=[];q.forEach(function(r){try{r.cb(T)}catch(e){console.error(e)}})}
function anims(ms){try{document.getAnimations().forEach(function(a){a.pause();a.currentTime=ms})}catch(e){}}
window.__qvTime=function(){return T};
window.__qvSeek=function(ms,fr){fr=fr||1000/30;if(ms<T-0.5)return 'back';var big=ms-T>3000?100:fr;while(T+big<ms-fr)step(T+big);while(T+fr<ms)step(T+fr);step(ms);anims(ms);return 'ok'};
addEventListener('DOMContentLoaded',function(){anims(T)});
})();<\/script>`;

export function withShim(html, baseHref) {
  const base = baseHref ? `<base href="${baseHref}">` : '';
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + base + SHIM);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, m => m + '<head>' + base + SHIM + '</head>');
  return base + SHIM + html;
}

// iframe 하나를 맡아 '지금 t초'로 맞춤. 뒤로 가면 다시 열고 앞으로 감기.
export class CodeLayer {
  constructor(iframe, html, baseHref) {
    this.f = iframe; this.src = withShim(html, baseHref); this.ready = null; this.cur = -1; this.load();
  }
  load() {
    this.cur = 0;
    this.ready = new Promise(ok => { this.f.onload = () => ok(); this.f.srcdoc = this.src; });
    return this.ready;
  }
  async seek(sec) {
    await this.ready;
    const w = this.f.contentWindow; if (!w || !w.__qvSeek) return;
    let r = w.__qvSeek(sec * 1000);
    if (r === 'back') { await this.load(); const w2 = this.f.contentWindow; if (w2 && w2.__qvSeek) w2.__qvSeek(sec * 1000); }
    this.cur = sec;
  }
}
