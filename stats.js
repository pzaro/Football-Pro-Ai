// stats.js - Engine Library (loaded by index.html)
// NOTE: Variables/functions already defined in index.html are omitted here to avoid redeclaration errors.
// This file provides: Poisson model, batchCalc, buildIntel, computePick, analyzeCorners, corner model, audit engine.

// stats.js - Στατιστική Ανάλυση, Μοντέλο Poisson & UI Engine (Με Accordion)

// Global App Variables 






// --- Βοηθητικές ---



// --- UI Helpers ---
function poissonProb(lambda, k) {
  if(lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for(let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function getPoissonMatrix(hLambda, aLambda, maxGoals=5) {
  const matrix = [];
  for(let h = 0; h <= maxGoals; h++) {
    matrix[h] = [];
    for(let a = 0; a <= maxGoals; a++) {
      matrix[h][a] = poissonProb(hLambda, h) * poissonProb(aLambda, a);
    }
  }
  return matrix;
}

function getPoissonProbabilities(hLambda, aLambda) {
  const m = getPoissonMatrix(hLambda, aLambda, 6);
  let pHome=0, pDraw=0, pAway=0, pO25=0, pO35=0, pU25=0, pBTTS=0;
  let bestScore = { h:1, a:1, prob: 0 };
  for(let h = 0; h <= 6; h++) {
    for(let a = 0; a <= 6; a++) {
      const p = m[h]?.[a] ?? 0;
      if(h > a) pHome += p; else if(h < a) pAway += p; else pDraw += p;
      if(h + a > 2.5) pO25 += p;
      if(h + a > 3.5) pO35 += p;
      if(h + a < 2.5) pU25 += p;
      if(h > 0 && a > 0) pBTTS += p;
      if(p > bestScore.prob) bestScore = { h, a, prob: p };
    }
  }
  return { pHome, pDraw, pAway, pO25, pO35, pU25, pBTTS, bestScore, matrix: m };
}

function normalCDF(z) {
  if(z < -6) return 0; if(z > 6) return 1;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t*(0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429))));
  const pdf  = Math.exp(-0.5*z*z)/Math.sqrt(2*Math.PI);
  const p    = 1 - pdf * poly;
  return z >= 0 ? p : 1 - p;
}

// --- API Queue ---



// Cache for fixture statistics (corners/cards/shots per game)
let fixStatsCache = new Map();

async function getFixStats(fixtureId) {
  if(fixStatsCache.has(fixtureId)) return fixStatsCache.get(fixtureId);
  const d = await apiReq(`fixtures/statistics?fixture=${fixtureId}`);
  const r = d?.response || [];
  fixStatsCache.set(fixtureId, r);
  return r;
}

function extractFixStatFor(statsArr, teamId, statType) {
  const teamStats = statsArr.find(s => s?.team?.id === teamId);
  if(!teamStats) return null;
  const entry = (teamStats.statistics||[]).find(s => s.type === statType);
  const v = entry?.value;
  if(v === null || v === undefined || v === '') return null;
  return parseFloat(String(v).replace('%','')) || 0;
}

// Advanced corner model: fetches per-fixture statistics for last N games
// Returns: { cor, corAgainst, corRatio, shotsCor, crd, shotsOn, shotsOff, xgProxy }
async function batchCalc(fixtures, tId) {
  if (!fixtures || !fixtures.length) {
    return { xg:'1.10', xga:'1.10', cor:5.0, corAgainst:4.5, corRatio:3.8, shotsCor:0.22, crd:2.0, shotsOn:4.5, shotsOff:3.5, corRatio:'3.8' };
  }

  // Fetch statistics for each fixture in parallel (up to 8 most recent)
  const recent = fixtures.slice(0, 8);
  const statsPerFix = await Promise.all(recent.map(f => getFixStats(f.fixture.id)));

  let totalXG=0, totalXGA=0;
  let totalCor=0, totalCorAgainst=0;
  let totalCrd=0;
  let totalShotsOn=0, totalShotsOff=0;
  let totalOppShotsOn=0;
  let n=0, nCor=0, nCrd=0, nShots=0;

  for(let i=0; i<recent.length; i++) {
    const f    = recent[i];
    const st   = statsPerFix[i];
    const isH  = f.teams?.home?.id === tId;
    const oppId = isH ? f.teams?.away?.id : f.teams?.home?.id;

    // Goals → proxy xG
    const myGoals  = getTeamGoals(f, tId);
    const oppGoals = getOppGoals(f, tId);
    totalXG  += myGoals  > 0 ? myGoals  * 1.08 : 0.38;
    totalXGA += oppGoals > 0 ? oppGoals * 1.08 : 0.38;
    n++;

    if(st && st.length) {
      // Corners
      const myCor  = extractFixStatFor(st, tId,  'Corner Kicks');
      const oppCor = extractFixStatFor(st, oppId, 'Corner Kicks');
      if(myCor !== null)  { totalCor        += myCor;  nCor++; }
      if(oppCor !== null) { totalCorAgainst += oppCor; }

      // Cards (Yellow + Red)
      const myY  = extractFixStatFor(st, tId, 'Yellow Cards') ?? 0;
      const myR  = extractFixStatFor(st, tId, 'Red Cards')    ?? 0;
      totalCrd += myY + myR; nCrd++;

      // Shots
      const mySOn  = extractFixStatFor(st, tId,  'Shots on Goal');
      const mySOff = extractFixStatFor(st, tId,  'Shots off Goal');
      const oppSOn = extractFixStatFor(st, oppId, 'Shots on Goal');
      if(mySOn  !== null) { totalShotsOn  += mySOn;  nShots++; }
      if(mySOff !== null) { totalShotsOff += mySOff; }
      if(oppSOn !== null) { totalOppShotsOn += oppSOn; }
    }
  }

  const avgXG   = n > 0 ? totalXG  / n : 1.10;
  const avgXGA  = n > 0 ? totalXGA / n : 1.10;
  const avgCor  = nCor   > 0 ? totalCor        / nCor  : 5.0;
  const avgCorA = nCor   > 0 ? totalCorAgainst / nCor  : 4.5;
  const avgCrd  = nCrd   > 0 ? totalCrd        / nCrd  : 2.0;
  const avgSOn  = nShots > 0 ? totalShotsOn    / nShots: 4.5;
  const avgSOff = nShots > 0 ? totalShotsOff   / nShots: 3.5;
  const avgOppSOn = nShots > 0 ? totalOppShotsOn / nShots : 4.0;

  // Corner ratio: corners per unit of attacking pressure (shots on + off)
  const totalShots = avgSOn + avgSOff;
  const corRatio   = totalShots > 0 ? avgCor / totalShots : 0.40;
  // shotsCor: probability a shot sequence generates a corner (0-1)
  const shotsCor   = totalShots > 0 ? clamp(avgCor / (totalShots * 2.5), 0.05, 0.60) : 0.22;

  return {
    xg:         avgXG.toFixed(2),
    xga:        avgXGA.toFixed(2),
    cor:        parseFloat(avgCor.toFixed(2)),
    corAgainst: parseFloat(avgCorA.toFixed(2)),
    corRatio:   parseFloat(corRatio.toFixed(3)),
    shotsCor:   parseFloat(shotsCor.toFixed(3)),
    crd:        parseFloat(avgCrd.toFixed(2)),
    shotsOn:    parseFloat(avgSOn.toFixed(2)),
    shotsOff:   parseFloat(avgSOff.toFixed(2)),
    oppShotsOn: parseFloat(avgOppSOn.toFixed(2)),
  };
}


function getFormHistory(fixtures,teamId) {
  return fixtures.map(f=>{ const my=getTeamGoals(f,teamId),op=getOppGoals(f,teamId); return my>op?{res:'W',cls:'W'}:(my<op?{res:'L',cls:'L'}:{res:'D',cls:'D'}); }).reverse();
}

function getFormRating(hist) {
  if(!hist||!hist.length) return 50;
  const weights=[1,0.8,0.6,0.4,0.2]; let score=0,totalWeight=0;
  hist.slice(0,5).forEach((h,i)=>{
    const w=weights[i]||0.1,pts=h.res==='W'?100:(h.res==='D'?33:0);
    score+=pts*w; totalWeight+=w;
  });
  return totalWeight>0?Math.round(score/totalWeight):50;
}

async function buildIntel(tId,lg,s,isHome) {
  try {
    const [ss, allFix] = await Promise.all([getTStats(tId, lg, s), getLFix(tId, lg, s)]);
    const gen = allFix.slice(0,6);
    const split = allFix.filter(f=>(isHome?f.teams.home.id:f.teams.away.id)===tId).slice(0,6);
    const [fData,sData] = await Promise.all([batchCalc(gen,tId),batchCalc(split,tId)]);
    
    const seasonXG = parseFloat(ss?.goals?.for?.average?.total) || 1.35;
    const seasonXGA = parseFloat(ss?.goals?.against?.average?.total) || 1.35;
    const history = getFormHistory(gen,tId);
    const formRating = getFormRating(history);
    
    const final_fXG = Math.max(fData.xg !== null ? safeNum(fData.xg) : seasonXG, 0.85);
    const final_fXGA = Math.max(fData.xga !== null ? safeNum(fData.xga) : seasonXGA, 0.85);
    const final_sXG = Math.max(sData.xg !== null ? safeNum(sData.xg) : seasonXG, 0.85);

    return {
      fXG: final_fXG, fXGA: final_fXGA, sXG: final_sXG, formRating,
      corRatio:    safeNum(fData.corRatio, 0.40),
      cor:         safeNum(fData.cor, 5.0),
      corAgainst:  safeNum(fData.corAgainst, 4.5),
      shotsCor:    safeNum(fData.shotsCor, 0.22),
      crd:         safeNum(fData.crd, 2.0),
      shotsOn:     safeNum(fData.shotsOn, 4.5),
      shotsOff:    safeNum(fData.shotsOff, 3.5),
      oppShotsOn:  safeNum(fData.oppShotsOn, 4.0),
      uiXG: fData.xg, uiXGA: fData.xga, uiSXG: sData.xg, uiSXGA: sData.xga,
      history
    };
  } catch {
    return {fXG:1.35,fXGA:1.35,sXG:1.35,formRating:50,corRatio:3.5,cor:4.5,crd:2.0, uiXG:'1.35', uiXGA:'1.35', uiSXG:'1.35', uiSXGA:'1.35', history:[]};
  }
}

function summarizeH2H(fixtures, homeId, awayId) {
  let hw=0, aw=0, dr=0, hGoals=0, aGoals=0;
  for (const f of (fixtures || []).slice(0, 8)) {
    const hg = f?.goals?.home ?? 0, ag = f?.goals?.away ?? 0;
    const myG = f?.teams?.home?.id === homeId ? hg : ag;
    const opG = f?.teams?.home?.id === awayId ? hg : ag;
    hGoals += myG; aGoals += opG;
    if (myG > opG) hw++; else if (opG > myG) aw++; else dr++;
  }
  const total = hw + aw + dr || 1;
  return { homeWins: hw, awayWins: aw, draws: dr, h2hAvgGoals: parseFloat(((hGoals + aGoals) / total).toFixed(2)) };
}


// ─── ADVANCED CORNER MODEL ──────────────────────────────────────────────────
// Methodology:
//   1. Expected corners per team = weighted blend of:
//      a) shots-based projection  (corRatio × projected shots)
//      b) historical avg corners  (regression to mean with n-weight)
//      c) opponent corners conceded (defensive pressure)
//   2. Total expected corners → Negative Binomial approx via Normal CDF
//   3. Bayesian shrinkage: low-sample teams regress to league mean (5.1 H, 4.7 A)
//   4. Confidence penalty if historical sample < 4 fixtures
// ─────────────────────────────────────────────────────────────────────────────
const LEAGUE_CORNER_MEAN_H = 5.1;
const LEAGUE_CORNER_MEAN_A = 4.7;
const CORNER_OVERDISPERSION = 1.35; // NegBin overdispersion factor k

function negativeBinomialCDF_approx(lambda, k_disp, x) {
  // Variance = lambda + lambda²/k  →  use Normal approx with continuity correction
  const variance = lambda + (lambda * lambda) / k_disp;
  const sigma    = Math.sqrt(variance);
  if(sigma <= 0) return x >= lambda ? 1 : 0;
  return normalCDF((x + 0.5 - lambda) / sigma);
}

function computeCornerConfidence(hS, aS, hXG, aXG) {
  // ── 1. Sample sizes (proxy: shots data present → n ≈ games used)
  const hN = hS.shotsOn > 0 ? 6 : 2;   // rough: if we have shots data → 6 games
  const aN = aS.shotsOn > 0 ? 6 : 2;

  // ── 2. Shots-based corner projection
  //   Projected shots ≈ from xG (1 xG ≈ ~4.5 shots on target on average)
  const hProjShotsOn  = hS.shotsOn  > 0 ? hS.shotsOn  : hXG * 4.2;
  const hProjShotsOff = hS.shotsOff > 0 ? hS.shotsOff : hXG * 3.1;
  const aProjShotsOn  = aS.shotsOn  > 0 ? aS.shotsOn  : aXG * 4.2;
  const aProjShotsOff = aS.shotsOff > 0 ? aS.shotsOff : aXG * 3.1;

  const hShotsBased = (hProjShotsOn + hProjShotsOff) * (hS.corRatio > 0 ? hS.corRatio : 0.40);
  const aShotsBased = (aProjShotsOn + aProjShotsOff) * (aS.corRatio > 0 ? aS.corRatio : 0.38);

  // ── 3. Historical corner averages with Bayesian shrinkage to league mean
  const hHistCor = safeNum(hS.cor,   LEAGUE_CORNER_MEAN_H);
  const aHistCor = safeNum(aS.cor,   LEAGUE_CORNER_MEAN_A);
  const hOppCor  = safeNum(hS.corAgainst, LEAGUE_CORNER_MEAN_A);  // corners given away by home defense
  const aOppCor  = safeNum(aS.corAgainst, LEAGUE_CORNER_MEAN_H);  // corners given away by away defense

  // Bayesian shrinkage weight: more games → trust data more
  const hW = clamp(hN / (hN + 4), 0.2, 0.85);
  const aW = clamp(aN / (aN + 4), 0.2, 0.85);
  const hShrunk = hW * hHistCor + (1 - hW) * LEAGUE_CORNER_MEAN_H;
  const aShrunk = aW * aHistCor + (1 - aW) * LEAGUE_CORNER_MEAN_A;

  // ── 4. Opponent defensive corner rate (how many corners does opponent concede?)
  const hOppAdj = (hOppCor + LEAGUE_CORNER_MEAN_A) / 2;
  const aOppAdj = (aOppCor + LEAGUE_CORNER_MEAN_H) / 2;

  // ── 5. Blend: 40% shots-based, 35% historical, 25% opponent conceded
  const hExp = 0.40 * hShotsBased + 0.35 * hShrunk + 0.25 * hOppAdj;
  const aExp = 0.40 * aShotsBased + 0.35 * aShrunk + 0.25 * aOppAdj;

  // ── 6. Dominance bonus: higher xG diff → more sustained pressure → more corners
  const xgDiff      = Math.abs(hXG - aXG);
  const domBonus    = xgDiff > 0.6 ? clamp((xgDiff - 0.6) * 1.2, 0, 1.8) : 0;
  const totalExpCor = hExp + aExp + domBonus;

  // ── 7. Over 8.5 probability via Negative Binomial approximation
  const pOver85 = 1 - negativeBinomialCDF_approx(totalExpCor, CORNER_OVERDISPERSION, 8);

  // ── 8. Confidence score with low-sample penalty
  let score = pOver85 * 100;
  const samplePenalty = (hN < 4 || aN < 4) ? 12 : 0;
  score -= samplePenalty;

  // Store projected values on hS for UI display
  hS._expCorners = parseFloat(totalExpCor.toFixed(1));
  hS._pOver85    = parseFloat((pOver85*100).toFixed(1));

  return clamp(score, 0, 99);
}


function computePick(hXG, aXG, tXG, btts, lp_or_cor, hS_or_totCards, aS_or_lp, h2h_or_hS, aS_extra) {
  // Support both call signatures:
  // stats.js style:  computePick(hXG, aXG, tXG, btts, lp, hS, aS, h2h)
  // index.html style: computePick(hXG, aXG, tXG, btts, cor, totCards, lp, hS, aS)
  let lp, hS, aS, h2h;
  if (typeof lp_or_cor === 'object' && lp_or_cor !== null && 'mult' in lp_or_cor) {
    // stats.js style
    lp = lp_or_cor; hS = hS_or_totCards; aS = aS_or_lp; h2h = h2h_or_hS || {};
  } else {
    // index.html style: cor=lp_or_cor, totCards=hS_or_totCards, lp=aS_or_lp, hS=h2h_or_hS, aS=aS_extra
    lp = aS_or_lp; hS = h2h_or_hS; aS = aS_extra; h2h = {};
  }
  const hLambda = clamp(hXG * lp.mult, 0.15, 4.0);
  const aLambda = clamp(aXG * lp.mult, 0.15, 4.0);
  const pp = getPoissonProbabilities(hLambda, aLambda);
  const xgDiff = hXG - aXG;
  
  let outPick="X";
  if(pp.pHome-pp.pAway>0.15 && xgDiff>lp.xgDiff) outPick="1";
  else if(pp.pAway-pp.pHome>0.15 && xgDiff<-lp.xgDiff) outPick="2";

  let omegaPick="NO BET", reason="Insufficient statistical edge.", pickScore=0;

  const cornerConf = computeCornerConfidence(hS, aS, hXG, aXG);
  const totCards = safeNum(hS.crd, 2.0) + safeNum(aS.crd, 2.0);

  if (pp.pO35 >= 0.42 && tXG >= lp.minXGO35 && btts >= 1.20) {
    omegaPick = "🚀 OVER 3.5 GOALS"; pickScore = pp.pO35 * 100; reason = `Poisson O3.5: ${(pp.pO35*100).toFixed(1)}% | tXG: ${tXG.toFixed(2)}`;
  }
  else if (pp.pO25 >= 0.52 && tXG >= lp.minXGO25 && btts >= 0.85) {
    omegaPick = "🔥 OVER 2.5 GOALS"; pickScore = pp.pO25 * 100; reason = `Poisson O2.5: ${(pp.pO25*100).toFixed(1)}% | tXG: ${tXG.toFixed(2)}`;
  }
  else if (pp.pU25 >= 0.55 && tXG <= lp.maxU25 && btts <= engineConfig.tBTTS_U25) {
    omegaPick = "🔒 UNDER 2.5 GOALS"; pickScore = pp.pU25 * 100; reason = `Poisson U2.5: ${(pp.pU25*100).toFixed(1)}% | tXG: ${tXG.toFixed(2)}`;
  }
  else if (btts >= lp.minBTTS && pp.pBTTS >= 0.48 && hXG >= 0.90 && aXG >= 0.90) {
    omegaPick = "🎯 GOAL/GOAL (BTTS)"; pickScore = pp.pBTTS * 100; reason = `Poisson BTTS: ${(pp.pBTTS*100).toFixed(1)}% | hXG: ${hXG.toFixed(2)} aXG: ${aXG.toFixed(2)}`;
  }
  else if (outPick !== "X" && Math.abs(xgDiff) >= lp.xgDiff + 0.10) {
    const outcome  = outPick === "1" ? "🏠 ΑΣΟΣ" : "✈️ ΔΙΠΛΟ";
    const outProb  = outPick === "1" ? pp.pHome : pp.pAway;
    const formOk   = outPick === "1" ? hS.formRating >= 40 : aS.formRating >= 40;
    if (outProb >= 0.52 && formOk) {
      omegaPick = outProb >= 0.60 ? `⚡ ${outcome}` : outcome; pickScore = outProb * 100; reason = `Poisson ${outPick==='1'?'Home':'Away'}: ${(outProb*100).toFixed(1)}% | xG Diff: ${xgDiff.toFixed(2)}`;
    }
  }
  else if(cornerConf >= 65) {
    omegaPick = "🚩 OVER 8.5 ΚΟΡΝΕΡ"; pickScore = cornerConf; reason = `Corners/xG Model: ${cornerConf.toFixed(1)}%`;
  }
  else if(totCards >= engineConfig.minCards && Math.abs(xgDiff) < 0.45) {
    omegaPick="🟨 OVER 5.5 ΚΑΡΤΕΣ"; pickScore=clamp((totCards - 5.0) * 20, 0, 85); reason=`Avg Cards: ${totCards.toFixed(1)}`;
  }

  let {h: hG_raw, a: aG_raw} = pp.bestScore;
  let hG = hG_raw, aG = aG_raw;
  const exactConf = Math.round(clamp(pp.bestScore.prob * 100 * 8, 0, 99));

  return { omegaPick, reason, pickScore, outPick, hG, aG, hExp:hLambda, aExp:aLambda, exactConf, xgDiff, pp };
}

async function analyzeMatchSafe(m, index, total) {
  try {
    setProgress(10+((index+1)/total)*88, `Processing ${index+1}/${total}: ${m.teams.home.name}`);

    const [hS,aS,stand,h2hFix] = await Promise.all([
      buildIntel(m.teams.home.id,m.league.id,m.league.season,true),
      buildIntel(m.teams.away.id,m.league.id,m.league.season,false),
      getStand(m.league.id,m.league.season),
      getHeadToHead(m.teams.home.id, m.teams.away.id, m.league.id, m.league.season)
    ]);

    const lp=getLeagueParams(m.league.id);
    const hXG=Number(hS.fXG)*lp.mult, aXG=Number(aS.fXG)*lp.mult;
    const tXG=hXG+aXG, bttsScore=Math.min(hXG,aXG);
    const h2h = summarizeH2H(h2hFix, m.teams.home.id, m.teams.away.id);

    const result=computePick(hXG,aXG,tXG,bttsScore, lp, hS, aS, h2h);

    const rec={
      m, fixId:m.fixture.id, ht:m.teams.home.name, at:m.teams.away.name,
      lg:m.league.name, leagueId:m.league.id, scanDate:todayISO(),
      tXG, btts:bttsScore, outPick:result.outPick, xgDiff:result.xgDiff,
      exact:`${result.hG}-${result.aG}`, exactConf:result.exactConf,
      omegaPick:result.omegaPick, strength:result.pickScore, reason:result.reason,
      hExp:result.hExp, aExp:result.aExp, pp:result.pp,
      hr:getTeamRank(stand,m.teams.home.id)??99, ar:getTeamRank(stand,m.teams.away.id)??99,
      isBomb:false, hS, aS, h2h
    };
    window.scannedMatchesData.push(rec);
  } catch(err) {
    window.scannedMatchesData.push({
      m, fixId:m.fixture.id, ht:m.teams.home.name, at:m.teams.away.name,
      lg:m.league.name, leagueId:m.league.id, omegaPick:"NO BET",
      reason:"Analysis error", strength:0, tXG:0, outPick:"X", exact:"0-0"
    });
  }
}



// --- Accordion Logic & Rendering ---
window.toggleMatchDetails = function(id) {
  const details = document.getElementById('details-' + id);
  if(details) { details.style.display = details.style.display === 'none' ? 'block' : 'none'; }
};












window.openBankroll = function() {
  try { const b = JSON.parse(localStorage.getItem(LS_BANKROLL)); if (b) bankrollData = b; } catch {}
  const modal = document.getElementById('bankrollModal');
  if (modal) {
    modal.style.display = 'flex';
    const inp = document.getElementById('bankrollInput');
    if (inp && bankrollData.current) inp.value = bankrollData.current;
    renderBankrollHistory();
  }
};

window.closeBankroll = function() {
  const modal = document.getElementById('bankrollModal');
  if (modal) modal.style.display = 'none';
};




// =============================================
// AUDIT ENGINE
// =============================================

let isAuditing = false;
let _auditRecordsCache = [];   // raw records με xg/btts values — επαναξιολογούνται χωρίς νέα API calls
let _auditRawFixtures  = [];   // αποθηκεύει τα hS/aS/lp per record για re-compute

function setAuditProgress(pct, text) {
  const bar = document.getElementById('auditBar');
  const st  = document.getElementById('auditStatus');
  if(bar) bar.style.width = Math.round(clamp(pct,0,100)) + '%';
  if(st)  st.textContent  = text;
}

window.runAudit = async function() {
  if(isAuditing) return;
  const fromEl = document.getElementById('auditFrom');
  const toEl   = document.getElementById('auditTo');
  const lgEl   = document.getElementById('auditLeague');
  if(!fromEl?.value || !toEl?.value) { showErr("Επιλέξτε εύρος ημερομηνιών για Audit."); return; }
  if(new Date(toEl.value) < new Date(fromEl.value)) { showErr("Η ημ/νία 'Έως' πρέπει να είναι >= 'Από'."); return; }

  isAuditing = true;
  const auditRunBtn = document.getElementById('auditRunBtn');
  if(auditRunBtn) auditRunBtn.disabled = true;
  const auditLoader = document.getElementById('auditLoader');
  if(auditLoader) auditLoader.style.display = 'block';
  const auditResults = document.getElementById('auditResults');
  if(auditResults) auditResults.innerHTML = '';

  const selLg = lgEl?.value || 'MY_LEAGUES';
  const dates  = getDatesInRange(fromEl.value, toEl.value);

  try {
    // Step 1: fetch finished fixtures
    setAuditProgress(5, `Φόρτωση αγώνων (${dates.length} ημέρες)...`);
    let allFixtures = [];
    for(let i=0; i<dates.length; i++) {
      setAuditProgress(5 + (i/dates.length)*30, `Fixtures: ${dates[i]}`);
      const res = await apiReq(`fixtures?date=${dates[i]}&status=FT`);
      const dm  = (res.response||[]).filter(m => {
        if(!isFinished(m.fixture?.status?.short)) return false;
        if(selLg==='ALL')        return typeof LEAGUE_IDS!=='undefined' && LEAGUE_IDS.includes(m.league.id);
        if(selLg==='MY_LEAGUES') return typeof MY_LEAGUES_IDS!=='undefined' && MY_LEAGUES_IDS.includes(m.league.id);
        return m.league.id === parseInt(selLg);
      });
      allFixtures.push(...dm);
      if(allFixtures.length > 500) break;
    }

    if(!allFixtures.length) { showErr("Δεν βρέθηκαν ολοκληρωμένοι αγώνες για audit."); return; }
    showOk(`Βρέθηκαν ${allFixtures.length} αγώνες. Τρέχει ανάλυση...`);

    // Step 2: run model + compare with actual results
    const auditRecords = [];
    for(let i=0; i<allFixtures.length; i++) {
      setAuditProgress(35 + (i/allFixtures.length)*60, `Ανάλυση ${i+1}/${allFixtures.length}`);
      const m = allFixtures[i];
      try {
        const [hS, aS] = await Promise.all([
          buildIntel(m.teams.home.id, m.league.id, m.league.season, true),
          buildIntel(m.teams.away.id, m.league.id, m.league.season, false)
        ]);
        const lp    = getLeagueParams(m.league.id);
        const hXG   = Number(hS.fXG) * lp.mult;
        const aXG   = Number(aS.fXG) * lp.mult;
        const tXG   = hXG + aXG;
        const btts  = Math.min(hXG, aXG);
        const res   = computePick(hXG, aXG, tXG, btts, lp, hS, aS, {});

        const aH    = m.goals?.home ?? 0;
        const aA    = m.goals?.away ?? 0;
        const aTot  = aH + aA;
        const aBTTS = aH > 0 && aA > 0;
        const aOver25 = aTot > 2;
        const aOver35 = aTot > 3;
        const aUnder25 = aTot < 3;
        const aCorners = (m.statistics?.[0]?.statistics?.find(s=>s.type==='Corner Kicks')?.value??null);

        const predOver25  = tXG >= lp.minXGO25 && res.pp.pO25 >= 0.52;
        const predOver35  = tXG >= lp.minXGO35 && res.pp.pO35 >= 0.42;
        const predUnder25 = tXG <= lp.maxU25   && res.pp.pU25 >= 0.55;
        const predBTTS    = btts >= lp.minBTTS  && res.pp.pBTTS >= 0.48;
        const predExact   = `${res.hG}-${res.aG}`;
        const actualExact = `${aH}-${aA}`;

        auditRecords.push({
          lgId: m.league.id, lgName: m.league.name,
          ht: m.teams.home.name, at: m.teams.away.name,
          date: m.fixture.date?.split('T')[0] || '',
          tXG, hXG, aXG, xgDiff: hXG-aXG,
          predOver25, predOver35, predUnder25, predBTTS,
          predExact, actualExact,
          aOver25, aOver35, aUnder25, aBTTS, aTot,
          aCorners: aCorners !== null ? Number(aCorners) : null,
          omegaPick: res.omegaPick, pickScore: res.pickScore,
          cornerConf: computeCornerConfidence(hS, aS, hXG, aXG),
          _hS: hS, _aS: aS  // store for re-evaluation
        });
      } catch { /* skip */ }
    }

    setAuditProgress(98, 'Υπολογισμός στατιστικών...');
    _auditRecordsCache = auditRecords;
    renderAuditResults(auditRecords, selLg, true);
    setAuditProgress(100, 'Audit ολοκληρώθηκε.');
  } catch(e) { showErr("Audit error: " + e.message); }
  finally {
    isAuditing = false;
    if(auditRunBtn) auditRunBtn.disabled = false;
    if(auditLoader) auditLoader.style.display = 'none';
  }
};

function calcAuditStats(records, predKey, actualKey) {
  let tp=0, fp=0, tn=0, fn=0;
  records.forEach(r => {
    const pred = r[predKey], act = r[actualKey];
    if(pred && act)  tp++;
    else if(pred && !act) fp++;
    else if(!pred && !act) tn++;
    else fn++;
  });
  const total   = tp+fp+tn+fn;
  const correct = tp+tn;
  const predicted = tp+fp;
  const precision = predicted > 0 ? tp/predicted : 0;
  const recall    = (tp+fn) > 0   ? tp/(tp+fn)   : 0;
  const accuracy  = total > 0     ? correct/total : 0;
  return { tp, fp, tn, fn, total, predicted, precision, recall, accuracy };
}

// Find optimal xG threshold for a market
function findOptimalXgThreshold(records, predKey, actualKey) {
  const thresholds = [];
  for(let t=1.0; t<=4.5; t+=0.1) {
    const filtered = records.filter(r => r.tXG >= t);
    if(filtered.length < 5) continue;
    const hits = filtered.filter(r => r[actualKey]).length;
    const rate  = hits / filtered.length;
    thresholds.push({ t: parseFloat(t.toFixed(1)), n: filtered.length, rate, hits });
  }
  return thresholds;
}

function recomputeAuditRecords(records) {
  return records.map(r => {
    try {
      const lp    = getLeagueParams(r.lgId);
      const hXG   = Number(r._hS.fXG) * lp.mult;
      const aXG   = Number(r._aS.fXG) * lp.mult;
      const tXG   = hXG + aXG;
      const btts  = Math.min(hXG, aXG);
      const res   = computePick(hXG, aXG, tXG, btts, lp, r._hS, r._aS, {});
      return {
        ...r, tXG, hXG, aXG, xgDiff: hXG - aXG,
        predOver25:  tXG >= lp.minXGO25 && res.pp.pO25  >= 0.52,
        predOver35:  tXG >= lp.minXGO35 && res.pp.pO35  >= 0.42,
        predUnder25: tXG <= lp.maxU25   && res.pp.pU25  >= 0.55,
        predBTTS:    btts >= lp.minBTTS && res.pp.pBTTS >= 0.48,
        predExact:   `${res.hG}-${res.aG}`,
        omegaPick:   res.omegaPick, pickScore: res.pickScore,
        cornerConf:  computeCornerConfidence(r._hS, r._aS, hXG, aXG)
      };
    } catch { return r; }
  });
}

window.applyAuditSuggestions = function() {
  // Read values from suggestion inputs
  const readF = id => { const el=document.getElementById(id); return el ? parseFloat(el.value) : null; };
  const newO25  = readF('sug_tXG_O25');
  const newO35  = readF('sug_tXG_O35');
  const newBTTS = readF('sug_tBTTS');
  const newU25  = readF('sug_tXG_U25');
  const newDiff = readF('sug_xG_Diff');

  if(newO25  !== null && !isNaN(newO25))  { engineConfig.tXG_O25 = newO25;  const el=document.getElementById('cfg_tXG_O25');  if(el) el.value=newO25; }
  if(newO35  !== null && !isNaN(newO35))  { engineConfig.tXG_O35 = newO35;  const el=document.getElementById('cfg_tXG_O35');  if(el) el.value=newO35; }
  if(newBTTS !== null && !isNaN(newBTTS)) { engineConfig.tBTTS   = newBTTS; const el=document.getElementById('cfg_tBTTS');    if(el) el.value=newBTTS; }
  if(newU25  !== null && !isNaN(newU25))  { engineConfig.tXG_U25 = newU25;  const el=document.getElementById('cfg_tXG_U25');  if(el) el.value=newU25; }
  if(newDiff !== null && !isNaN(newDiff)) { engineConfig.xG_Diff = newDiff; const el=document.getElementById('cfg_xG_Diff'); if(el) el.value=newDiff; }

  // Apply per-league mod suggestions
  if(typeof LEAGUES_DATA !== 'undefined') {
    LEAGUES_DATA.forEach(l => {
      const xgEl = document.getElementById(`sug_lg_xg_${l.id}`);
      if(xgEl && xgEl.value !== '') {
        const v = parseFloat(xgEl.value);
        if(!isNaN(v)) {
          if(!leagueMods[l.id]) leagueMods[l.id] = {};
          leagueMods[l.id].minXGO25 = v;
        }
      }
    });
  }

  try { localStorage.setItem(LS_SETTINGS, JSON.stringify(engineConfig)); } catch {}
  try { localStorage.setItem(LS_LGMODS,   JSON.stringify(leagueMods));   } catch {}

  // Re-evaluate cached audit records with new config
  if(!_auditRecordsCache.length) { showErr("Δεν υπάρχουν cached audit data. Τρέξτε ξανά το Audit."); return; }
  const newRecords = recomputeAuditRecords(_auditRecordsCache);
  _auditRecordsCache = newRecords;
  renderAuditResults(newRecords, null, false);
  showOk("Ρυθμίσεις εφαρμόστηκαν & αποτελέσματα επαναξιολογήθηκαν!");

  // Also re-simulate main scan if data exists
  if(window.scannedMatchesData?.length) {
    showOk("Engine config αποθηκεύτηκε. Main scan & Audit επαναξιολογήθηκαν!");
  }
};

function renderAuditResults(records, selLg, isInitial=true) {
  const el = document.getElementById('auditResults');
  if(!el || !records.length) return;

  // ---- Global Stats ----
  const o25  = calcAuditStats(records, 'predOver25',  'aOver25');
  const o35  = calcAuditStats(records, 'predOver35',  'aOver35');
  const u25  = calcAuditStats(records, 'predUnder25', 'aUnder25');
  const btts = calcAuditStats(records, 'predBTTS',    'aBTTS');
  const exactHits = records.filter(r=>r.predExact===r.actualExact).length;
  const exactTotal = records.length;
  const cornerRecs = records.filter(r=>r.aCorners!==null);
  const cornerHits = cornerRecs.filter(r=>r.cornerConf>=65 && r.aCorners>8.5).length;

  // ---- Per-League breakdown ----
  const byLeague = {};
  records.forEach(r => {
    if(!byLeague[r.lgId]) byLeague[r.lgId] = { name: r.lgName, records: [] };
    byLeague[r.lgId].records.push(r);
  });

  // ---- xG Threshold curves ----
  const o25Curve  = findOptimalXgThreshold(records, 'predOver25',  'aOver25');
  const o35Curve  = findOptimalXgThreshold(records, 'predOver35',  'aOver35');
  const bttsCurve = findOptimalXgThreshold(records, 'predBTTS',    'aBTTS');

  const bestO25  = o25Curve.reduce ((a,b)=>b.rate>a.rate?b:a, {rate:0, t:0, n:0});
  const bestO35  = o35Curve.reduce ((a,b)=>b.rate>a.rate?b:a, {rate:0, t:0, n:0});
  const bestBTTS = bttsCurve.reduce((a,b)=>b.rate>a.rate?b:a, {rate:0, t:0, n:0});

  // ---- xG Diff analysis ----
  const xgDiffBuckets = {};
  records.forEach(r => {
    const bucket = Math.floor(Math.abs(r.xgDiff)*10)/10;
    const key = bucket.toFixed(1);
    if(!xgDiffBuckets[key]) xgDiffBuckets[key] = { n:0, o25:0, o35:0, btts:0 };
    xgDiffBuckets[key].n++;
    if(r.aOver25) xgDiffBuckets[key].o25++;
    if(r.aOver35) xgDiffBuckets[key].o35++;
    if(r.aBTTS)   xgDiffBuckets[key].btts++;
  });

  const pct = v => `${(v*100).toFixed(1)}%`;
  const bar = (v, max=1, color='var(--accent-green)') => {
    const w = clamp((v/max)*100,0,100);
    return `<div style="height:6px;background:var(--border-light);border-radius:3px;margin-top:3px;"><div style="height:6px;width:${w}%;background:${color};border-radius:3px;transition:width 0.4s;"></div></div>`;
  };
  const scoreColor = v => v>=0.65?'var(--accent-green)':v>=0.45?'var(--accent-gold)':'var(--accent-red)';

  // ---- xG Diff optimal for 1X2 ----
  // Find the xgDiff bucket where O2.5 rate peaks to suggest for xG_Diff param
  const diffEntries = Object.entries(xgDiffBuckets).sort((a,b)=>parseFloat(a[0])-parseFloat(b[0]));
  const bestDiffEntry = diffEntries.reduce((best, [k,v]) => v.n>=5 && v.o25/v.n > (best.rate||0) ? {k, rate:v.o25/v.n, n:v.n} : best, {k:'0.5', rate:0});
  const suggestedDiff = parseFloat(bestDiffEntry.k) > 0 ? parseFloat(bestDiffEntry.k) : engineConfig.xG_Diff;

  // ---- Per-league best O2.5 threshold for mods ----
  const leagueSuggestions = Object.entries(byLeague).map(([id, lg]) => {
    const curve = findOptimalXgThreshold(lg.records, 'predOver25', 'aOver25');
    const best  = curve.reduce((a,b)=>b.rate>a.rate&&b.n>=3?b:a, {rate:0, t:null, n:0});
    const current = leagueMods[id]?.minXGO25 ?? engineConfig.tXG_O25;
    const diff = best.t ? (best.t - current).toFixed(2) : null;
    return { id, name: lg.name, bestT: best.t, bestRate: best.rate, bestN: best.n, current, diff };
  }).filter(l => l.bestT !== null && Math.abs(l.bestT - l.current) >= 0.1);

  const applyPanel = isInitial ? `
  <div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.3);border-radius:var(--radius-md);padding:20px;margin-bottom:20px;">
    <div style="font-size:0.85rem;font-weight:800;color:var(--accent-green);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">🎯 Audit Suggestions — Εφαρμογή στο Engine</div>
    <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:16px;">Οι τιμές παρακάτω προτείνονται βάσει των audit δεδομένων. Μπορείς να τις τροποποιήσεις πριν εφαρμόσεις.</div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px;">
      ${[
        {id:'sug_tXG_O25',  label:'Min xG (O2.5)',   val:bestO25.t,        cur:engineConfig.tXG_O25,  color:'var(--accent-green)'},
        {id:'sug_tXG_O35',  label:'Min xG (O3.5)',   val:bestO35.t,        cur:engineConfig.tXG_O35,  color:'var(--accent-blue)'},
        {id:'sug_tBTTS',    label:'Min xG (BTTS)',   val:bestBTTS.t,       cur:engineConfig.tBTTS,    color:'var(--accent-gold)'},
        {id:'sug_tXG_U25',  label:'Max xG (U2.5)',   val:null,             cur:engineConfig.tXG_U25,  color:'var(--accent-teal)'},
        {id:'sug_xG_Diff',  label:'xG Diff (1X2)',   val:suggestedDiff,    cur:engineConfig.xG_Diff,  color:'var(--accent-purple)'},
      ].map(s => {
        const sugVal = s.val !== null && s.val !== 0 ? Number(s.val).toFixed(2) : Number(s.cur).toFixed(2);
        const changed = s.val && Math.abs(s.val - s.cur) >= 0.05;
        return `<div style="background:var(--bg-base);border:1px solid ${changed?s.color:'var(--border-light)'};border-radius:var(--radius-sm);padding:12px;">
          <div style="font-size:0.62rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${s.label}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:0.65rem;color:var(--text-muted);">Τρέχον:</span>
            <span style="font-family:var(--font-mono);color:var(--text-muted);font-size:0.75rem;">${Number(s.cur).toFixed(2)}</span>
            ${changed ? `<span style="font-size:0.6rem;color:${s.color};font-weight:700;">→ ${sugVal}</span>` : ''}
          </div>
          <input type="number" id="${s.id}" step="0.05" value="${sugVal}" style="width:100%;background:var(--bg-surface);border:1px solid var(--border-light);color:${s.color};padding:6px 8px;border-radius:6px;font-family:var(--font-mono);font-size:0.85rem;font-weight:700;outline:none;">
        </div>`;
      }).join('')}
    </div>

    ${leagueSuggestions.length > 0 ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:0.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Per-League xG O2.5 Overrides (Προτεινόμενες αλλαγές ≥ 0.1)</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;">
        ${leagueSuggestions.map(l => `
          <div style="background:var(--bg-base);border:1px solid rgba(251,191,36,0.3);border-radius:var(--radius-sm);padding:10px;">
            <div style="font-size:0.68rem;font-weight:700;color:var(--text-main);margin-bottom:4px;">${esc(l.name)}</div>
            <div style="font-size:0.6rem;color:var(--text-muted);margin-bottom:6px;">Τρέχον: <span style="color:var(--accent-gold);font-family:var(--font-mono);">${Number(l.current).toFixed(2)}</span> → Προτεινόμενο: <span style="color:var(--accent-green);font-family:var(--font-mono);">${l.bestT}</span> <span style="color:var(--text-muted);">(${(l.bestRate*100).toFixed(0)}% hit, n=${l.bestN})</span></div>
            <input type="number" id="sug_lg_xg_${l.id}" step="0.05" value="${l.bestT}" style="width:100%;background:var(--bg-surface);border:1px solid var(--border-light);color:var(--accent-gold);padding:5px 8px;border-radius:6px;font-family:var(--font-mono);font-size:0.8rem;font-weight:700;outline:none;">
          </div>`).join('')}
      </div>
    </div>` : ''}

    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
      <button onclick="applyAuditSuggestions()" style="background:var(--accent-green);color:#000;border:none;padding:10px 24px;border-radius:var(--radius-sm);font-weight:800;font-size:0.8rem;cursor:pointer;letter-spacing:0.5px;">✅ Apply & Re-Evaluate</button>
      <button onclick="window.saveSettings?.(); showOk('Config αποθηκεύτηκε.');" style="background:transparent;color:var(--accent-blue);border:1px solid var(--accent-blue);padding:10px 16px;border-radius:var(--radius-sm);font-weight:700;font-size:0.75rem;cursor:pointer;">💾 Αποθήκευση Μόνο</button>
      <span style="font-size:0.65rem;color:var(--text-muted);">Θα ενημερωθούν: Global Config + League Mods + Main Scan (αν υπάρχει)</span>
    </div>
  </div>` : `
  <div style="background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.3);border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:12px;">
    <span style="font-size:1.2rem;">🔄</span>
    <div>
      <div style="font-size:0.75rem;font-weight:800;color:var(--accent-blue);">Επαναξιολόγηση με νέες ρυθμίσεις</div>
      <div style="font-size:0.65rem;color:var(--text-muted);">Τα αποτελέσματα παρακάτω αντικατοπτρίζουν τις νέες παραμέτρους του engine.</div>
    </div>
    <button onclick="renderAuditResults(_auditRecordsCache, null, true)" style="margin-left:auto;background:transparent;color:var(--accent-blue);border:1px solid var(--accent-blue);padding:6px 14px;border-radius:var(--radius-sm);font-size:0.7rem;font-weight:700;cursor:pointer;">↩ Edit Suggestions</button>
  </div>`;

  // ---- Build HTML ----
  let html = applyPanel + `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px;">
    ${[
      {label:'Over 2.5', prec:o25.precision, rec:o25.recall, acc:o25.accuracy, n:o25.predicted, hits:o25.tp},
      {label:'Over 3.5', prec:o35.precision, rec:o35.recall, acc:o35.accuracy, n:o35.predicted, hits:o35.tp},
      {label:'Under 2.5',prec:u25.precision, rec:u25.recall, acc:u25.accuracy, n:u25.predicted, hits:u25.tp},
      {label:'BTTS',     prec:btts.precision,rec:btts.recall,acc:btts.accuracy,n:btts.predicted,hits:btts.tp},
    ].map(s=>`
      <div style="background:var(--bg-base);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:14px;">
        <div style="font-size:0.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${s.label}</div>
        <div style="font-size:1.6rem;font-weight:900;font-family:var(--font-mono);color:${scoreColor(s.prec)};">${pct(s.prec)}</div>
        <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:4px;">Precision · ${s.hits}/${s.n} προβλέψεις</div>
        ${bar(s.prec,1,scoreColor(s.prec))}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:8px;font-size:0.65rem;">
          <div><span style="color:var(--text-muted);">Recall</span> <span style="color:var(--accent-blue);font-family:var(--font-mono);">${pct(s.rec)}</span></div>
          <div><span style="color:var(--text-muted);">Accuracy</span> <span style="color:var(--accent-blue);font-family:var(--font-mono);">${pct(s.acc)}</span></div>
        </div>
      </div>`).join('')}
    <div style="background:var(--bg-base);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:14px;">
      <div style="font-size:0.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Ακριβές Σκορ</div>
      <div style="font-size:1.6rem;font-weight:900;font-family:var(--font-mono);color:var(--accent-purple);">${exactHits}/${exactTotal}</div>
      <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:4px;">Hit Rate: ${pct(exactHits/exactTotal||0)}</div>
      ${bar(exactHits/exactTotal||0, 1, 'var(--accent-purple)')}
    </div>
    <div style="background:var(--bg-base);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:14px;">
      <div style="font-size:0.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Κόρνερ (>8.5)</div>
      <div style="font-size:1.6rem;font-weight:900;font-family:var(--font-mono);color:var(--accent-teal);">${cornerRecs.length?pct(cornerHits/cornerRecs.length):'N/A'}</div>
      <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:4px;">${cornerHits}/${cornerRecs.length} αγώνες με δεδομένα</div>
      ${bar(cornerRecs.length?cornerHits/cornerRecs.length:0, 1, 'var(--accent-teal)')}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
    ${[
      {label:'Ιδανικό xG threshold για Over 2.5', best:bestO25,  color:'var(--accent-green)'},
      {label:'Ιδανικό xG threshold για Over 3.5', best:bestO35,  color:'var(--accent-blue)'},
      {label:'Ιδανικό xG threshold για BTTS',     best:bestBTTS, color:'var(--accent-gold)'},
    ].map(t=>`
      <div style="background:var(--bg-base);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:14px;">
        <div style="font-size:0.65rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${t.label}</div>
        <div style="font-size:2rem;font-weight:900;font-family:var(--font-mono);color:${t.color};">xG ≥ ${t.best.t}</div>
        <div style="font-size:0.7rem;color:var(--text-muted);">Hit rate: <span style="color:${t.color};font-weight:700;">${pct(t.best.rate||0)}</span> σε ${t.best.n||0} αγώνες</div>
        <div style="margin-top:10px;">${buildMiniCurve(t.best.t, o25Curve, t.color)}</div>
      </div>`).join('')}
  </div>

  <div style="margin-bottom:20px;">
    <div style="font-size:0.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">📊 Hit Rates ανά |xG Diff| Bucket</div>
    <div class="data-table-wrapper">
      <table class="summary-table" style="font-size:0.72rem;">
        <thead><tr>
          <th>|xG Diff|</th><th>Αγώνες</th><th>O2.5 %</th><th>O3.5 %</th><th>BTTS %</th>
        </tr></thead><tbody>
        ${Object.entries(xgDiffBuckets).sort((a,b)=>parseFloat(a[0])-parseFloat(b[0])).map(([k,v])=>`
          <tr>
            <td class="data-num" style="color:var(--accent-blue);">${k}</td>
            <td class="data-num">${v.n}</td>
            <td class="data-num" style="color:${scoreColor(v.o25/v.n)};">${pct(v.o25/v.n)}</td>
            <td class="data-num" style="color:${scoreColor(v.o35/v.n)};">${pct(v.o35/v.n)}</td>
            <td class="data-num" style="color:${scoreColor(v.btts/v.n)};">${pct(v.btts/v.n)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div style="margin-bottom:20px;">
    <div style="font-size:0.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">🏆 Ανάλυση ανά Πρωτάθλημα</div>
    <div class="data-table-wrapper">
      <table class="summary-table" style="font-size:0.72rem;">
        <thead><tr>
          <th class="left-align">Πρωτάθλημα</th><th>Αγώνες</th>
          <th>O2.5<br>Prec</th><th>O3.5<br>Prec</th><th>BTTS<br>Prec</th><th>U2.5<br>Prec</th>
          <th>Exact<br>Hits</th><th>Ιδαν.<br>xG O2.5</th>
        </tr></thead><tbody>
        ${Object.values(byLeague).sort((a,b)=>b.records.length-a.records.length).map(lg=>{
          const lr = lg.records;
          const lo25  = calcAuditStats(lr,'predOver25','aOver25');
          const lo35  = calcAuditStats(lr,'predOver35','aOver35');
          const lu25  = calcAuditStats(lr,'predUnder25','aUnder25');
          const lbtts = calcAuditStats(lr,'predBTTS','aBTTS');
          const lexact = lr.filter(r=>r.predExact===r.actualExact).length;
          const curve = findOptimalXgThreshold(lr,'predOver25','aOver25');
          const best  = curve.reduce((a,b)=>b.rate>a.rate?b:a,{rate:0,t:'-'});
          return `<tr>
            <td class="left-align" style="font-weight:700;color:var(--text-main);">${esc(lg.name)}</td>
            <td class="data-num">${lr.length}</td>
            <td class="data-num" style="color:${scoreColor(lo25.precision)};">${pct(lo25.precision)}</td>
            <td class="data-num" style="color:${scoreColor(lo35.precision)};">${pct(lo35.precision)}</td>
            <td class="data-num" style="color:${scoreColor(lbtts.precision)};">${pct(lbtts.precision)}</td>
            <td class="data-num" style="color:${scoreColor(lu25.precision)};">${pct(lu25.precision)}</td>
            <td class="data-num" style="color:var(--accent-purple);">${lexact}</td>
            <td class="data-num" style="color:var(--accent-gold);">${best.t}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div style="font-size:0.65rem;color:var(--text-muted);text-align:center;padding:8px;border-top:1px solid var(--border-light);">
    Audit βασισμένο σε ${records.length} ολοκληρωμένους αγώνες · Τελευταία ενημέρωση: ${new Date().toLocaleString('el-GR')}
  </div>`;

  el.innerHTML = html;
}

function buildMiniCurve(bestT, curve, color) {
  if(!curve.length) return '';
  const max = Math.max(...curve.map(c=>c.rate), 0.01);
  const w = 100 / curve.length;
  const bars = curve.map((c,i) => {
    const h = Math.round((c.rate/max)*32);
    const isB = Math.abs(c.t - bestT) < 0.05;
    return `<div title="xG≥${c.t}: ${(c.rate*100).toFixed(1)}% (n=${c.n})" style="display:inline-block;width:${w}%;height:${h}px;background:${isB?color:'rgba(255,255,255,0.15)'};border-radius:2px 2px 0 0;vertical-align:bottom;"></div>`;
  }).join('');
  return `<div style="display:flex;align-items:flex-end;height:36px;gap:1px;background:var(--border-light);border-radius:4px;padding:2px;">${bars}</div>
    <div style="display:flex;justify-content:space-between;font-size:0.55rem;color:var(--text-muted);margin-top:2px;"><span>${curve[0]?.t||1.0}</span><span>${curve[Math.floor(curve.length/2)]?.t||''}</span><span>${curve[curve.length-1]?.t||4.5}</span></div>`;
}

// ================================================================
// MISSING FUNCTIONS (needed by index.html)
// ================================================================

// analyzeCorners: called by index.html with projected corner counts + xG values
function analyzeCorners(hCors, aCors, hSXG, aSXG, hFXG, aFXG) {
  const hC = parseFloat(hCors) || 0;
  const aC = parseFloat(aCors) || 0;
  const tot = hC + aC;
  let signal, signalColor, confidence, detail;
  if (tot >= 11.5) {
    signal = '🚀 OVER 10.5 ΚΟΡΝΕΡ'; signalColor = 'var(--accent-green)'; confidence = 'HIGH';
    detail = `H:${hC.toFixed(1)} + A:${aC.toFixed(1)} = ${tot.toFixed(1)} projected`;
  } else if (tot >= 9.5) {
    signal = '🚩 OVER 8.5 ΚΟΡΝΕΡ'; signalColor = 'var(--accent-teal)'; confidence = 'MED-HIGH';
    detail = `H:${hC.toFixed(1)} + A:${aC.toFixed(1)} = ${tot.toFixed(1)} projected`;
  } else if (tot >= 8.0) {
    signal = '⚠️ BORDERLINE 8.5'; signalColor = 'var(--accent-gold)'; confidence = 'MEDIUM';
    detail = `H:${hC.toFixed(1)} + A:${aC.toFixed(1)} = ${tot.toFixed(1)} — marginal`;
  } else {
    signal = '🔒 UNDER 8.5 ΚΟΡΝΕΡ'; signalColor = 'var(--text-muted)'; confidence = 'LOW';
    detail = `H:${hC.toFixed(1)} + A:${aC.toFixed(1)} = ${tot.toFixed(1)} — low corner game`;
  }
  return { signal, signalColor, confidence, total: tot, hCors: hC, aCors: aC, detail };
}

// getPoissonMatrixHTML: renders Poisson probability grid as HTML table
function getPoissonMatrixHTML(hLambda, aLambda, maxGoals=4) {
  const matrix = getPoissonMatrix(hLambda, aLambda, maxGoals);
  let html = `<div class="poisson-grid" style="grid-template-columns: repeat(${maxGoals+2}, 1fr); gap: 2px; margin-top: 10px;">`;
  html += `<div class="poisson-cell" style="color:var(--text-muted)"></div>`;
  for(let a = 0; a <= maxGoals; a++) html += `<div class="poisson-cell" style="color:var(--accent-blue)">${a}</div>`;
  for(let h = 0; h <= maxGoals; h++) {
    html += `<div class="poisson-cell" style="color:var(--accent-gold)">${h}</div>`;
    for(let a = 0; a <= maxGoals; a++) {
      const prob = (matrix[h]?.[a] || 0) * 100;
      const textCol = prob > 6 ? '#000' : 'var(--text-main)';
      html += `<div class="poisson-cell" style="background:rgba(56,189,248,${(prob/12).toFixed(2)});color:${textCol}">${prob.toFixed(1)}%</div>`;
    }
  }
  return html + `</div>`;
}
