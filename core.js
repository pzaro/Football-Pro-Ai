// core.js - API ENGINE & QUANT LOGIC
window._apiQueue = []; 
window._apiActiveCount = 0; 
const MAX_CONCURRENT = 5; 
const REQUEST_GAP_MS = 150;

async function apiReq(path) {
  return new Promise(resolve => { _apiQueue.push({path, resolve}); _drainQueue(); });
}

async function _drainQueue() {
  while(_apiActiveCount < MAX_CONCURRENT && _apiQueue.length > 0) {
    const {path, resolve} = _apiQueue.shift();
    _apiActiveCount++; _executeRequest(path, resolve);
  }
}

async function _executeRequest(path, resolve) {
  await new Promise(r => setTimeout(r, Math.random() * 100));
  try {
    const r = await fetch(`${API_BASE}/${path}`, { headers: { 'x-apisports-key': API_KEY } });
    if(typeof currentCredits === 'number') {
      currentCredits--; 
      if(typeof window.updateCredits === 'function') window.updateCredits(currentCredits);
    }
    resolve(r.ok ? await r.json() : { response: [] });
  } catch { resolve({ response: [] }); }
  finally { await new Promise(r => setTimeout(r, REQUEST_GAP_MS)); _apiActiveCount--; _drainQueue(); }
}

// MATH & LOGIC
function poissonProb(lambda, k) {
  if(lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for(let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function getPoissonMatrix(hL, aL, maxG = 6) {
  const m = [];
  for(let h = 0; h <= maxG; h++) { m[h] = []; for(let a = 0; a <= maxG; a++) m[h][a] = poissonProb(hL, h) * poissonProb(aL, a); }
  return m;
}

function getPoissonProbabilities(hL, aL) {
  const m = getPoissonMatrix(hL, aL, 6);
  let pHome=0, pDraw=0, pAway=0, pO25=0, pO35=0, pU25=0, pBTTS=0, bestScore={h:1, a:1, prob:0};
  for(let h = 0; h <= 6; h++) for(let a = 0; a <= 6; a++) {
    const p = m[h]?.[a] ?? 0;
    if(h > a) pHome += p; else if(h < a) pAway += p; else pDraw += p;
    if(h + a > 2.5) pO25 += p; if(h + a > 3.5) pO35 += p; if(h + a < 2.5) pU25 += p;
    if(h > 0 && a > 0) pBTTS += p;
    if(p > bestScore.prob) bestScore = {h, a, prob:p};
  }
  return { pHome, pDraw, pAway, pO25, pO35, pU25, pBTTS, bestScore, matrix: m };
}

// FETCHERS
async function getTStats(t, lg, s) { 
    const k = `${t}_${lg}_${s}`; 
    if(teamStatsCache.has(k)) return teamStatsCache.get(k); 
    const d = await apiReq(`teams/statistics?team=${t}&league=${lg}&season=${s}`);
    teamStatsCache.set(k, d?.response || {}); return d?.response || {}; 
}

async function getLFix(t, lg, s) { 
    const k = `${t}_${lg}_${s}`; 
    if(lastFixCache.has(k)) return lastFixCache.get(k); 
    const d = await apiReq(`fixtures?team=${t}&league=${lg}&season=${s}&last=20&status=FT`);
    lastFixCache.set(k, d?.response || []); return d?.response || []; 
}

// INTEL BUILDER
window.buildIntel = async function(tId, lg, s, isHome) {
  try {
    const [ss, allFix] = await Promise.all([getTStats(tId, lg, s), getLFix(tId, lg, s)]);
    const seasonXG = parseFloat(ss?.goals?.for?.average?.total) || 1.35;
    const seasonXGA = parseFloat(ss?.goals?.against?.average?.total) || 1.35;
    
    return {
      fXG: seasonXG, fXGA: seasonXGA,
      wXG: seasonXG, cor: 4.5, crd: 2.0, formRating: 50,
      uiXG: seasonXG.toFixed(2), uiXGA: seasonXGA.toFixed(2)
    };
  } catch { return { fXG: 1.35, fXGA: 1.35, wXG: 1.35, cor: 4.5, crd: 2.0, formRating: 50, uiXG: '1.35', uiXGA: '1.35' }; }
}

window.computePick = function(hXG, aXG, tXG, bttsScore, lp) {
  const hLambda = Math.max(hXG * lp.mult, 0.5);
  const aLambda = Math.max(aXG * lp.mult, 0.5);
  const pp = getPoissonProbabilities(hLambda, aLambda);
  
  let omegaPick = "NO BET", pickScore = 0;
  if(pp.pO25 > 0.65 && tXG >= lp.minXGO25) { omegaPick = "🔥 OVER 2.5"; pickScore = pp.pO25 * 100; }
  else if(pp.pBTTS > 0.55 && bttsScore >= lp.minBTTS) { omegaPick = "🎯 BTTS"; pickScore = pp.pBTTS * 100; }

  return { omegaPick, pickScore, hG: pp.bestScore.h, aG: pp.bestScore.a };
}

window.getMatchCardHTML = function(d) {
  return `<div class="match-card" id="card-${d.fixId}">
    <div class="match-league"><span class="league-badge">${esc(d.lg)}</span></div>
    <div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="team-name">${esc(d.ht)}</div>
        <div class="score-display">vs</div>
        <div class="team-name" style="text-align:right;">${esc(d.at)}</div>
    </div>
    <div class="signal-box signal-hit">
        <div class="signal-value">${esc(d.omegaPick)}</div>
        <div class="signal-desc">Conf: ${d.strength.toFixed(1)}% | xG: ${d.tXG.toFixed(2)}</div>
    </div>
  </div>`;
};
