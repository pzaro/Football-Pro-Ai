// core.js - THE ENGINE

// 1. API QUEUE SYSTEM (Για να μην μπλοκάρει το API Key)
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
  try {
    const r = await fetch(`${API_BASE}/${path}`, { headers: { 'x-apisports-key': API_KEY } });
    const data = await r.json();
    if(typeof currentCredits === 'number' && data.results !== undefined) {
      currentCredits--; 
      if(window.updateCreditsDisplay) window.updateCreditsDisplay(currentCredits);
    }
    resolve(data);
  } catch(e) { resolve({ response: [] }); }
  finally { 
    await new Promise(r => setTimeout(r, REQUEST_GAP_MS)); 
    _apiActiveCount--; _drainQueue(); 
  }
}

// 2. MATH FUNCTIONS (Poisson & Stats)
function poissonProb(lambda, k) {
  if(lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for(let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function getPoissonProbabilities(hL, aL) {
  let pHome=0, pDraw=0, pAway=0, pO25=0, pBTTS=0;
  let maxG = 6, bestScore = {h:1, a:1, prob:0};
  
  for(let h=0; h<=maxG; h++) {
    for(let a=0; a<=maxG; a++) {
      const p = poissonProb(hL, h) * poissonProb(aL, a);
      if(h > a) pHome += p; else if(h < a) pAway += p; else pDraw += p;
      if(h + a > 2.5) pO25 += p;
      if(h > 0 && a > 0) pBTTS += p;
      if(p > bestScore.prob) bestScore = {h, a, prob:p};
    }
  }
  return { pHome, pDraw, pAway, pO25, pBTTS, bestScore };
}

// 3. DATA FETCHERS
async function getTStats(t, lg, s) { 
  const d = await apiReq(`teams/statistics?team=${t}&league=${lg}&season=${s}`);
  return d?.response || {}; 
}

async function getLFix(t, lg, s) { 
  const d = await apiReq(`fixtures?team=${t}&league=${lg}&season=${s}&last=10&status=FT`);
  return d?.response || []; 
}

// 4. INTEL BUILDER (Εδώ γίνεται η ανάλυση)
window.buildIntel = async function(tId, lg, s) {
  try {
    const [ss, fix] = await Promise.all([getTStats(tId, lg, s), getLFix(tId, lg, s)]);
    const fXG = parseFloat(ss?.goals?.for?.average?.total) || 1.30;
    const fXGA = parseFloat(ss?.goals?.against?.average?.total) || 1.30;
    
    // Υπολογισμός Φόρμας (Τελευταία 6 παιχνίδια)
    let formPts = 0;
    fix.slice(0,6).forEach(f => {
      const myG = f.teams.home.id === tId ? f.goals.home : f.goals.away;
      const opG = f.teams.home.id === tId ? f.goals.away : f.goals.home;
      if(myG > opG) formPts += 3; else if(myG === opG) formPts += 1;
    });

    return { fXG, fXGA, formRating: (formPts/18)*100, uiXG: fXG.toFixed(2), uiXGA: fXGA.toFixed(2) };
  } catch { return { fXG:1.3, fXGA:1.3, formRating:50, uiXG:'1.30', uiXGA:'1.30' }; }
}

window.computePick = function(hS, aS, lp) {
  const hExp = hS.fXG * (hS.formRating/100 + 0.5);
  const aExp = aS.fXG * (aS.formRating/100 + 0.5);
  const pp = getPoissonProbabilities(hExp, aExp);
  
  let pick = "NO BET", strength = 0;
  const totalXG = hS.fXG + aS.fXG;

  if(pp.pO25 > 0.60 && totalXG > lp.tXG_O25) { pick = "🔥 OVER 2.5"; strength = pp.pO25 * 100; }
  else if(pp.pHome > 0.50) { pick = "🏠 ΑΣΟΣ"; strength = pp.pHome * 100; }
  else if(pp.pAway > 0.50) { pick = "✈️ ΔΙΠΛΟ"; strength = pp.pAway * 100; }

  return { pick, strength, hExp, aExp, hG: pp.bestScore.h, aG: pp.bestScore.a };
}
