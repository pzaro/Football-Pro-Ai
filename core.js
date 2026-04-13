window._apiQueue = []; window._apiActiveCount = 0;
const MAX_CONCURRENT = 5, REQUEST_GAP_MS = 150;
const clamp = (n, mn, mx) => Math.max(mn, Math.min(mx, n));
const safeNum = (x,d=0) => Number.isFinite(Number(x))?Number(x):d;

async function apiReq(path) { return new Promise(resolve => { _apiQueue.push({path, resolve}); _drainQueue(); }); }
async function _drainQueue() { while(_apiActiveCount < MAX_CONCURRENT && _apiQueue.length > 0) { const {path, resolve} = _apiQueue.shift(); _apiActiveCount++; _executeRequest(path, resolve); } }
async function _executeRequest(path, resolve) {
  try {
    const r = await fetch(`${API_BASE}/${path}`, { headers: { 'x-apisports-key': API_KEY } });
    const data = await r.json();
    if(typeof currentCredits === 'number') { currentCredits--; if(window.updateCreditsDisplay) window.updateCreditsDisplay(currentCredits); }
    resolve(data);
  } catch(e) { resolve({ response: [] }); }
  finally { await new Promise(r => setTimeout(r, REQUEST_GAP_MS)); _apiActiveCount--; _drainQueue(); }
}

function poissonProb(l, k) { if(l<=0) return k===0?1:0; let logP = -l + k*Math.log(l); for(let i=1;i<=k;i++) logP -= Math.log(i); return Math.exp(logP); }
function getPoissonProbabilities(hL, aL) {
  let pO25=0, best={h:1,a:1,prob:0};
  for(let h=0;h<=6;h++) for(let a=0;a<=6;a++) {
    const p = poissonProb(hL,h)*poissonProb(aL,a);
    if(h+a>2.5) pO25+=p; if(p>best.prob) best={h,a,prob:p};
  }
  return { pO25, bestScore: best };
}

async function getTStats(t,lg,s) { const d = await apiReq(`teams/statistics?team=${t}&league=${lg}&season=${s}`); return d?.response || {}; }
async function getLFix(t,lg,s) { const d = await apiReq(`fixtures?team=${t}&league=${lg}&season=${s}&last=5&status=FT`); return d?.response || []; }

window.buildIntel = async function(tId, lg, s) {
  try {
    const [ss, fix] = await Promise.all([getTStats(tId, lg, s), getLFix(tId, lg, s)]);
    const fXG = parseFloat(ss?.goals?.for?.average?.total) || 1.3;
    return { fXG, uiXG: fXG.toFixed(2) };
  } catch { return { fXG:1.3, uiXG:'1.30' }; }
}

window.computePick = function(hS, aS, lp) {
  const pp = getPoissonProbabilities(hS.fXG, aS.fXG);
  let pick = "NO BET", strength = 0;
  if(pp.pO25 > 0.60) { pick = "🔥 OVER 2.5"; strength = pp.pO25*100; }
  return { pick, strength, hG: pp.bestScore.h, aG: pp.bestScore.a };
}

window.getMatchCardHTML = function(d) {
  return `<div class="match-card">
    <div class="match-league">${d.lg}</div>
    <div style="display:flex; justify-content:space-between; padding:10px 0;">
      <div class="team-name">${d.ht}</div>
      <div class="score-display">${d.hG} - ${d.aG}</div>
      <div class="team-name" style="text-align:right;">${d.at}</div>
    </div>
    <div class="signal-box signal-hit"><div class="signal-value">${d.omegaPick}</div></div>
  </div>`;
}
