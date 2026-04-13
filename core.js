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

function normalCDF(z) {
  if(z < -6) return 0; if(z > 6) return 1;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) * poly;
  return z >= 0 ? p : 1 - p;
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

async function getStand(lg, s) { 
    const k = `${lg}_${s}`; 
    if(standCache.has(k)) return standCache.get(k); 
    const d = await apiReq(`standings?league=${lg}&season=${s}`); 
    const f = Array.isArray(d?.response?.[0]?.league?.standings) ? d.response[0].league.standings.flat() : []; 
    standCache.set(k, f); return f; 
}

async function getHeadToHead(t1, t2, lg, s) { 
    const k = `${t1}_${t2}_${lg||'a'}_${s||'a'}`; 
    if(h2hCache.has(k)) return h2hCache.get(k); 
    const d = await apiReq(`fixtures/headtohead?h2h=${t1}-${t2}${lg && s ? `&league=${lg}&season=${s}` : ''}`); 
    h2hCache.set(k, d?.response || []); return d?.response || []; 
}

// DATA PROCESSORS
window.getTeamRank =(st,tId)=>{const r=(st||[]).find(x=>String(x?.team?.id)===String(tId));return r?.rank??null;};
const getTeamGoals=(f,t)=>{if(!f?.teams)return 0;return f.teams.home?.id===t?(f.goals?.home??0):(f.goals?.away??0);};
const getOppGoals =(f,t)=>{if(!f?.teams)return 0;return f.teams.home?.id===t?(f.goals?.away??0):(f.goals?.home??0);};

window.summarizeH2H = function(fixtures, homeId, awayId) {
  let hw=0, aw=0, dr=0, totGoals=0, bttsCount=0, n=0;
  for(const f of (fixtures || []).slice(0, 10)) {
    const hg = f?.goals?.home ?? 0, ag = f?.goals?.away ?? 0;
    const myG = f?.teams?.home?.id === homeId ? hg : ag, opG = f?.teams?.home?.id === homeId ? ag : hg;
    if(myG > opG) hw++; else if(opG > myG) aw++; else dr++;
    totGoals += hg + ag; if(hg > 0 && ag > 0) bttsCount++; n++;
  }
  return { homeWins: hw, awayWins: aw, draws: dr, avgGoals: n > 0 ? totGoals / n : 0, bttsRate: n > 0 ? bttsCount / n : 0, n };
}

window.buildIntel = async function(tId, lg, s, isHome) {
  try {
    const [ss, allFix] = await Promise.all([getTStats(tId, lg, s), getLFix(tId, lg, s)]);
    const gen = allFix.slice(0, 6);
    const seasonXG = parseFloat(ss?.goals?.for?.average?.total) || 1.35;
    const seasonXGA = parseFloat(ss?.goals?.against?.average?.total) || 1.35;
    
    return {
      fXG: seasonXG, fXGA: seasonXGA,
      wXG: seasonXG, cor: 4.5, crd: 2.0, formRating: 50
    };
  } catch { return { fXG: 1.35, fXGA: 1.35, wXG: 1.35, cor: 4.5, crd: 2.0, formRating: 50 }; }
}

window.computePick = function(hXG, aXG, tXG, bttsScore, cor, totCards, lp, hS, aS, h2h, hInj=0, aInj=0, lgId=0) {
  const hLambda = clamp(hXG * lp.mult, 0.5, 4.0);
  const aLambda = clamp(aXG * lp.mult, 0.5, 4.0);
  const pp = getPoissonProbabilities(hLambda, aLambda);
  const xgDiff = hXG - aXG;
  
  let outPick = "X";
  if(pp.pHome - pp.pAway > 0.15 && xgDiff > lp.xgDiff) outPick = "1";
  else if(pp.pAway - pp.pHome > 0.15 && xgDiff < -lp.xgDiff) outPick = "2";

  let omegaPick = "NO BET", pickScore = 0;
  if(pp.pO25 > 0.65 && tXG >= lp.minXGO25) { omegaPick = "🔥 OVER 2.5"; pickScore = pp.pO25 * 100; }
  else if(pp.pBTTS > 0.55 && bttsScore >= lp.minBTTS) { omegaPick = "🎯 BTTS"; pickScore = pp.pBTTS * 100; }
  else if(outPick !== "X") { omegaPick = outPick === "1" ? "🏠 ΑΣΟΣ" : "✈️ ΔΙΠΛΟ"; pickScore = (outPick === "1" ? pp.pHome : pp.pAway) * 100; }

  return { omegaPick, pickScore, outPick, hG: pp.bestScore.h, aG: pp.bestScore.a, exactConf: 50, xgDiff, hExp: hLambda, aExp: aLambda };
}

window.scrollToMatch = function(id) {
  const el = document.getElementById(id);
  if(el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); if(typeof flashElement === 'function') flashElement(el); }
};

window.getMatchCardHTML = function(d) {
  const score = isLive(d.m.fixture.status.short) || isFinished(d.m.fixture.status.short) ? `${d.m.goals.home}-${d.m.goals.away}` : "vs";
  return `<div class="match-card" id="card-${d.fixId}">
    <div class="match-league"><span class="league-badge">${esc(d.lg)}</span> ${d.m.fixture.date.slice(11,16)}</div>
    <div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="team-name">${esc(d.ht)}</div>
        <div class="score-display">${score}</div>
        <div class="team-name" style="text-align:right;">${esc(d.at)}</div>
    </div>
    <div class="signal-box signal-hit">
        <div class="signal-value">${esc(d.omegaPick)}</div>
        <div class="signal-desc">Confidence: ${d.strength.toFixed(1)}% | xG: ${d.tXG.toFixed(2)}</div>
    </div>
  </div>`;
};
