// stats.js - Στατιστική Ανάλυση, Μοντέλο Poisson & UI Engine (Με Accordion)

// Global App Variables 
const API_BASE = "https://v3.football.api-sports.io";
let API_KEY = "956cbd05f9e9bf934df78d9b72d9a3a0";

const LS_PREDS = "omega_preds_v5.0";
const LS_SETTINGS = "omega_settings_v5.0";
const LS_LGMODS = "omega_lgmods_v5.0";
const LS_BANKROLL = "omega_bankroll_v5.0";

let teamStatsCache = new Map(), lastFixCache = new Map(), standCache = new Map(), h2hCache = new Map();
let isRunning = false, currentCredits = null;
let latestTopLists = { exact:[], combo1:[], combo2:[], outcomes:[], over25:[], over35:[], under25:[] };
window.scannedMatchesData = [];
let bankrollData = { current: 0, history: [] };

// ── Live Tracker State ──────────────────────────────────────────────────────
let liveTrackerInterval  = null;   // setInterval handle
let isLiveTracking       = false;
let liveTrackerLeagues   = 'MY_LEAGUES';
let liveMatchesState     = {};     // fixId → { prev signal, prev score, rec }
let liveAlerts           = [];     // signal flip log
const LIVE_POLL_MS       = 60000;  // 60 seconds
const LS_LIVE_ALERTS     = 'omega_live_alerts_v5.0';

const DEFAULT_SETTINGS = {
  wShotsOn:0.14, wShotsOff:0.04, wCorners:0.02, wGoals:0.20,
  tXG_O25:2.70, tXG_O35:3.25, tXG_U25:1.80, tBTTS_U25:0.65,
  xG_Diff:0.55, tBTTS:1.10, modTrap:0.90, modTight:0.95, modGold:1.15,
  minCorners: 10.5, minCards: 5.8
};
let engineConfig = {...DEFAULT_SETTINGS};
let leagueMods = {};

const SETTINGS_MAP = {
  cfg_wShotsOn:'wShotsOn', cfg_wShotsOff:'wShotsOff', cfg_wCorners:'wCorners', cfg_wGoals:'wGoals',
  cfg_tXG_O25:'tXG_O25',   cfg_tXG_O35:'tXG_O35',     cfg_tXG_U25:'tXG_U25',  cfg_tBTTS_U25:'tBTTS_U25',
  cfg_xG_Diff:'xG_Diff',   cfg_tBTTS:'tBTTS', cfg_minCorners:'minCorners', cfg_minCards:'minCards',
  cfg_modTrap:'modTrap',   cfg_modTight:'modTight',   cfg_modGold:'modGold'
};

const _apiQueue=[]; let _apiActiveCount=0; const MAX_CONCURRENT=4; const REQUEST_GAP_MS=350;
let _errTimer=null, _okTimer=null;

// --- Βοηθητικές ---
const safeNum  = (x, d=0) => Number.isFinite(Number(x)) ? Number(x) : d;
const clamp    = (n,mn,mx) => Math.max(mn, Math.min(mx, n));
const statVal  = (arr,type) => parseFloat(String((arr.find(x=>x.type===type)||{}).value||0).replace('%',''))||0;

const getTeamGoals = (f,t) => f?.teams?.home?.id===t?(f?.goals?.home??0):(f?.goals?.away??0);
const getOppGoals  = (f,t) => f?.teams?.home?.id===t?(f?.goals?.away??0):(f?.goals?.home??0);
const isLive = s => ["1H","2H","HT","LIVE","ET","BT","P"].includes(s);
const isFinished = s => ["FT","AET","PEN"].includes(s);
const esc = str => String(str??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const todayISO = () => new Date().toISOString().split('T')[0];

function getDatesInRange(s,e) {
  const d=[];let c=new Date(s),end=new Date(e);
  while(c<=end){d.push(c.toISOString().split('T')[0]);c.setDate(c.getDate()+1);}
  return d;
}

// --- UI Helpers ---
window.togglePanel = function(panelId,arrowId) {
  const p=document.getElementById(panelId),a=document.getElementById(arrowId);
  if(p.style.display==='none'){p.style.display='block';if(a)a.innerText='▲';}
  else{p.style.display='none';if(a)a.innerText='▼';}
};
function setLoader(show,text='') { 
  document.getElementById('loader').style.display=show?'block':'none'; 
  document.getElementById('status').textContent=text; 
  if(!show) document.getElementById('bar').style.width='0%'; 
}
function setProgress(pct,text='') { 
  document.getElementById('bar').style.width=Math.round(clamp(pct,0,100))+'%'; 
  document.getElementById('status').textContent=text + (_apiActiveCount > 0 ? ` [${_apiActiveCount} active]` : ''); 
}
function setBtnsDisabled(d) { ["btnPre","leagueFilter","auditLeague"].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=d;}); }
function showErr(msg) { clearTimeout(_errTimer); const box=document.getElementById('errorBox'); box.innerHTML=`<div style="background:var(--accent-red); color:#fff; padding:12px; border-radius:var(--radius-sm); margin-bottom:15px; font-weight:600; box-shadow:0 4px 12px rgba(244,63,94,0.3);">⚠️ ${esc(msg)}</div>`; _errTimer=setTimeout(()=>box.innerHTML='',8000); }
function showOk(msg) { clearTimeout(_okTimer); const box=document.getElementById('successBox'); box.innerHTML=`<div style="background:var(--accent-green); color:#000; padding:12px; border-radius:var(--radius-sm); margin-bottom:15px; font-weight:600; box-shadow:0 4px 12px rgba(16,185,129,0.3);">✓ ${esc(msg)}</div>`; _okTimer=setTimeout(()=>box.innerHTML='',4000); }
function clearAlerts() { document.getElementById('errorBox').innerHTML=''; document.getElementById('successBox').innerHTML=''; }
function abortScan(msg) { if(msg)showErr(msg); isRunning=false; setBtnsDisabled(false); setLoader(false); }

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
async function apiReq(path) {
  return new Promise(resolve=>{ _apiQueue.push({path,resolve}); _drainQueue(); });
}
async function _drainQueue() {
  while(_apiActiveCount<MAX_CONCURRENT && _apiQueue.length>0) {
    const {path,resolve}=_apiQueue.shift();
    _apiActiveCount++; _executeRequest(path,resolve);
  }
}
async function _executeRequest(path,resolve) {
  await new Promise(r=>setTimeout(r,Math.random()*100));
  try {
    const url = `${API_BASE}/${path}`;
    const options = { method: 'GET', headers: { 'x-apisports-key': API_KEY, 'Accept': 'application/json' } };
    const r=await fetch(url, options);
    if(r.ok) {
        const data = await r.json();
        if(data.response && typeof currentCredits==='number') {
          currentCredits--; 
          const el = document.getElementById('creditDisplay');
          if(el) el.textContent = currentCredits;
        }
        resolve(data);
    } else { resolve({response:[]}); }
  } catch (error) { resolve({response:[]}); }
  finally { await new Promise(r=>setTimeout(r,REQUEST_GAP_MS)); _apiActiveCount--; _drainQueue(); }
}

window.initCredits = async function() {
  try {
    const r=await fetch(`${API_BASE}/status`,{headers:{'x-apisports-key':API_KEY,'Accept': 'application/json'}});
    if(!r.ok) return;
    const d=await r.json();
    currentCredits=(d.response?.requests?.limit_day||500)-(d.response?.requests?.current||0);
    const el = document.getElementById('creditDisplay');
    if(el) el.textContent = currentCredits;
  } catch (error) {}
}

async function getTStats(t,lg,s){const k=`${t}_${lg}_${s}`;if(teamStatsCache.has(k))return teamStatsCache.get(k);const d=await apiReq(`teams/statistics?team=${t}&league=${lg}&season=${s}`);teamStatsCache.set(k,d?.response||{});return d?.response||{};}
async function getLFix(t,lg,s){const k=`${t}_${lg}_${s}`;if(lastFixCache.has(k))return lastFixCache.get(k);const d=await apiReq(`fixtures?team=${t}&league=${lg}&season=${s}&last=20&status=FT`);lastFixCache.set(k,d?.response||[]);return d?.response||[];}
async function getStand(lg,s){const k=`${lg}_${s}`;if(standCache.has(k))return standCache.get(k);const d=await apiReq(`standings?league=${lg}&season=${s}`);const f=Array.isArray(d?.response?.[0]?.league?.standings)?d.response[0].league.standings.flat():[];standCache.set(k,f);return f;}
async function getHeadToHead(t1,t2,lg,s){const k=`${t1}_${t2}_${lg||'a'}_${s||'a'}`;if(h2hCache.has(k))return h2hCache.get(k);let path=`fixtures/headtohead?h2h=${t1}-${t2}`;if(lg&&s)path+=`&league=${lg}&season=${s}`;const d=await apiReq(path);h2hCache.set(k,d?.response||[]);return d?.response||[];}
const getTeamRank =(st,tId)=>{const r=(st||[]).find(x=>String(x?.team?.id)===String(tId));return r?.rank??null;};

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

function getLeagueParams(leagueId) {
  const lm = leagueMods[leagueId] || {};
  let defaultXgDiff = engineConfig.xG_Diff;
  if (typeof TIGHT_LEAGUES !== 'undefined' && TIGHT_LEAGUES.has(leagueId)) defaultXgDiff = 0.35;
  else if (typeof GOLD_LEAGUES !== 'undefined' && GOLD_LEAGUES.has(leagueId)) defaultXgDiff = 0.65;
  
  let defaultMult = 1.00;
  if (typeof GOLD_LEAGUES !== 'undefined' && GOLD_LEAGUES.has(leagueId)) defaultMult = engineConfig.modGold;
  else if (typeof TRAP_LEAGUES !== 'undefined' && TRAP_LEAGUES.has(leagueId)) defaultMult = engineConfig.modTrap;
  else if (typeof TIGHT_LEAGUES !== 'undefined' && TIGHT_LEAGUES.has(leagueId)) defaultMult = engineConfig.modTight;

  return {
    mult:     lm.mult     !== undefined ? lm.mult     : defaultMult,
    minXGO25: lm.minXGO25 !== undefined ? lm.minXGO25 : engineConfig.tXG_O25,
    minXGO35: lm.minXGO35 !== undefined ? lm.minXGO35 : engineConfig.tXG_O35,
    maxU25:   lm.maxU25   !== undefined ? lm.maxU25   : engineConfig.tXG_U25,
    minBTTS:  lm.minBTTS  !== undefined ? lm.minBTTS  : engineConfig.tBTTS,
    xgDiff:   lm.xgDiff   !== undefined ? lm.xgDiff   : defaultXgDiff
  };
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


function computePick(hXG, aXG, tXG, btts, lp, hS, aS, h2h) {
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

// ═══════════════════════════════════════════════════════════════════
// IN-PLAY xG ADJUSTMENT ENGINE
// Adjusts pre-match lambdas based on current score + elapsed time.
// Methodology:
//   1. Goals scored → Bayesian update: each goal is evidence of
//      higher attacking strength; update lambda proportionally
//   2. Elapsed-time decay: remaining time fraction shrinks expected
//      goals proportionally (linear model, 90 min baseline)
//   3. Market-specific confidence decay:
//      - Over 2.5: drops steeply after 70' if still 0-0 or 1-0
//      - Under 2.5: grows strongly after 60' if ≤1 goal
//      - BTTS: grows if one team has scored, drops if 0-0 at 75'+
// ═══════════════════════════════════════════════════════════════════

function inPlayLambdaAdjust(baseLambda, goalsScored, goalsAgainst, elapsed) {
  // Remaining time fraction (clamp between 0 and 1)
  const remaining = clamp((90 - (elapsed || 0)) / 90, 0, 1);

  // Bayesian goal-rate update: each goal scored shifts lambda up by ~0.15
  // each goal conceded doesn't change our scoring lambda (independent)
  const goalBoost  = goalsScored  * 0.15;
  const adjustedLambda = (baseLambda + goalBoost) * remaining;

  return Math.max(adjustedLambda, 0.05);
}

function inPlayMarketDecay(pp, elapsed, hGoals, aGoals, origPick) {
  const totGoals = hGoals + aGoals;
  const e = elapsed || 0;
  const remaining = clamp((90 - e) / 90, 0, 1);

  let decayedO25  = pp.pO25;
  let decayedO35  = pp.pO35;
  let decayedU25  = pp.pU25;
  let decayedBTTS = pp.pBTTS;

  // Already settled markets (goals can't un-happen)
  if(totGoals >= 3) { decayedO25 = 1.0; decayedO35 = totGoals >= 4 ? 1.0 : pp.pO35; }
  if(totGoals >= 4) { decayedO35 = 1.0; }
  if(totGoals <= 2 && e >= 85) decayedU25 = totGoals < 3 ? 1.0 : 0.0;
  if(hGoals >= 1 && aGoals >= 1) decayedBTTS = 1.0;

  // Time-based scaling for unsettled markets
  if(totGoals < 3 && e > 60) {
    // Each minute after 60 without the 3rd goal → over 2.5 confidence erodes
    const erosion = clamp((e - 60) / 30, 0, 0.7);
    decayedO25 *= (1 - erosion * 0.6);
    decayedO35 *= (1 - erosion * 0.8);
  }
  if(totGoals === 0 && e > 70) {
    // 0-0 at 70'+ → under 2.5 strengthens dramatically
    const boost = clamp((e - 70) / 20, 0, 0.9);
    decayedU25 = Math.min(decayedU25 + boost * 0.4, 0.98);
  }
  if(aGoals === 0 && e > 75) {
    // If away team hasn't scored at 75'+ → BTTS fades
    const fade = clamp((e - 75) / 15, 0, 0.8);
    decayedBTTS *= (1 - fade * 0.5);
  }
  if(hGoals === 0 && e > 75) {
    const fade = clamp((e - 75) / 15, 0, 0.8);
    decayedBTTS *= (1 - fade * 0.5);
  }

  return {
    pO25:  clamp(decayedO25,  0, 1),
    pO35:  clamp(decayedO35,  0, 1),
    pU25:  clamp(decayedU25,  0, 1),
    pBTTS: clamp(decayedBTTS, 0, 1),
  };
}

function computeInPlayPick(baseRec, liveFixture) {
  if(!baseRec || !liveFixture) return null;

  const hGoals  = liveFixture.goals?.home  ?? 0;
  const aGoals  = liveFixture.goals?.away  ?? 0;
  const elapsed = liveFixture.fixture?.status?.elapsed ?? 0;
  const status  = liveFixture.fixture?.status?.short   ?? '';

  if(!isLive(status)) return null;

  const lp = getLeagueParams(baseRec.leagueId);

  // Adjusted lambdas for remaining time
  const hLambdaAdj = inPlayLambdaAdjust(baseRec.hExp, hGoals, aGoals, elapsed);
  const aLambdaAdj = inPlayLambdaAdjust(baseRec.aExp, aGoals, hGoals, elapsed);
  const ppAdj      = getPoissonProbabilities(hLambdaAdj, aLambdaAdj);

  // Apply market-specific time-decay on top of Poisson
  const decayed = inPlayMarketDecay(ppAdj, elapsed, hGoals, aGoals, baseRec.omegaPick);

  // Re-derive pick from decayed probabilities
  const totGoals = hGoals + aGoals;
  let inPlayPick = 'NO BET ⏱';
  let inPlayConf = 0;
  let inPlayReason = '';

  if(totGoals >= 3 || decayed.pO35 >= 0.70) {
    inPlayPick = '🚀 OVER 3.5 GOALS'; inPlayConf = decayed.pO35 * 100;
    inPlayReason = `${totGoals >= 4 ? '4+ goals scored' : `P(O3.5): ${(decayed.pO35*100).toFixed(0)}%`} · ${elapsed}'`;
  } else if(totGoals >= 2 || decayed.pO25 >= 0.72) {
    inPlayPick = '🔥 OVER 2.5 GOALS'; inPlayConf = decayed.pO25 * 100;
    inPlayReason = `${totGoals === 2 ? '2 goals scored' : `P(O2.5): ${(decayed.pO25*100).toFixed(0)}%`} · ${elapsed}'`;
  } else if(decayed.pU25 >= 0.72 && elapsed >= 60) {
    inPlayPick = '🔒 UNDER 2.5 GOALS'; inPlayConf = decayed.pU25 * 100;
    inPlayReason = `${totGoals} goals · ${elapsed}' · P(U2.5): ${(decayed.pU25*100).toFixed(0)}%`;
  } else if(decayed.pBTTS >= 0.68 && hGoals === 1 && aGoals === 0 && elapsed <= 70) {
    inPlayPick = '🎯 BTTS (Away to score)'; inPlayConf = decayed.pBTTS * 100;
    inPlayReason = `Home leads 1-0 · ${elapsed}' · P(BTTS): ${(decayed.pBTTS*100).toFixed(0)}%`;
  } else if(decayed.pBTTS >= 0.68 && aGoals === 1 && hGoals === 0 && elapsed <= 70) {
    inPlayPick = '🎯 BTTS (Home to score)'; inPlayConf = decayed.pBTTS * 100;
    inPlayReason = `Away leads 1-0 · ${elapsed}' · P(BTTS): ${(decayed.pBTTS*100).toFixed(0)}%`;
  } else if(elapsed < 30) {
    // Early — keep pre-match signal, slightly decay confidence
    const decay = 1 - (elapsed / 90) * 0.3;
    inPlayPick   = baseRec.omegaPick;
    inPlayConf   = (baseRec.strength || 0) * decay;
    inPlayReason = `Pre-match signal · ${elapsed}' remaining: ${(90-elapsed)}'`;
  } else {
    inPlayReason = `Insufficient edge at ${elapsed}'`;
  }

  return {
    inPlayPick, inPlayConf: clamp(inPlayConf, 0, 99), inPlayReason,
    hGoals, aGoals, elapsed, status,
    decayed, ppAdj
  };
}

// ═══════════════════════════════════════════════════════════════════
// LIVE TRACKER ENGINE
// ═══════════════════════════════════════════════════════════════════

window.startLiveTracker = async function() {
  if(isLiveTracking) return;
  const lgEl = document.getElementById('liveTrackerLeague');
  liveTrackerLeagues = lgEl?.value || 'MY_LEAGUES';
  isLiveTracking = true;
  _updateLiveTrackerUI();
  await _liveTrackerTick();  // immediate first run
  liveTrackerInterval = setInterval(_liveTrackerTick, LIVE_POLL_MS);
};

window.stopLiveTracker = function() {
  if(liveTrackerInterval) { clearInterval(liveTrackerInterval); liveTrackerInterval = null; }
  isLiveTracking = false;
  _updateLiveTrackerUI();
  const status = document.getElementById('liveTrackerStatus');
  if(status) status.textContent = 'Tracker stopped.';
};

async function _liveTrackerTick() {
  const statusEl  = document.getElementById('liveTrackerStatus');
  const lastEl    = document.getElementById('liveTrackerLastPoll');
  const countEl   = document.getElementById('liveMatchCount');

  if(statusEl) statusEl.textContent = 'Polling live fixtures...';

  try {
    // Fetch all live fixtures
    const res = await apiReq('fixtures?live=all');
    const all  = (res.response || []).filter(m => {
      if(liveTrackerLeagues === 'ALL')        return typeof LEAGUE_IDS !== 'undefined' && LEAGUE_IDS.includes(m.league.id);
      if(liveTrackerLeagues === 'MY_LEAGUES') return typeof MY_LEAGUES_IDS !== 'undefined' && MY_LEAGUES_IDS.includes(m.league.id);
      return m.league.id === parseInt(liveTrackerLeagues);
    });

    if(countEl) countEl.textContent = all.length;

    // For each live fixture, check if we have pre-match intel, compute in-play signal
    const liveRecs = [];
    for(const lf of all) {
      const fixId = lf.fixture.id;
      // Try to find pre-match record from scan data
      const preMatch = (window.scannedMatchesData || []).find(r => r.fixId === fixId);

      let inPlay = null;
      if(preMatch) {
        inPlay = computeInPlayPick(preMatch, lf);
      } else {
        // No pre-match data → fetch minimal intel on the fly
        try {
          const [hS, aS] = await Promise.all([
            buildIntel(lf.teams.home.id, lf.league.id, lf.league.season, true),
            buildIntel(lf.teams.away.id, lf.league.id, lf.league.season, false)
          ]);
          const lp  = getLeagueParams(lf.league.id);
          const hXG = Number(hS.fXG) * lp.mult;
          const aXG = Number(aS.fXG) * lp.mult;
          const tXG = hXG + aXG;
          const res2 = computePick(hXG, aXG, tXG, Math.min(hXG,aXG), lp, hS, aS, {});
          const synthetic = {
            fixId, ht: lf.teams.home.name, at: lf.teams.away.name,
            lg: lf.league.name, leagueId: lf.league.id,
            hExp: res2.hExp, aExp: res2.aExp,
            omegaPick: res2.omegaPick, strength: res2.pickScore,
            tXG, hS, aS
          };
          inPlay = computeInPlayPick(synthetic, lf);
        } catch { /* skip */ }
      }

      // Detect signal flips
      const prev = liveMatchesState[fixId];
      if(prev && inPlay && prev.inPlayPick !== inPlay.inPlayPick) {
        const alert = {
          time:     new Date().toLocaleTimeString('el-GR'),
          fixId,
          ht:       lf.teams.home.name,
          at:       lf.teams.away.name,
          elapsed:  lf.fixture.status.elapsed,
          from:     prev.inPlayPick,
          to:       inPlay.inPlayPick,
          score:    `${lf.goals.home}-${lf.goals.away}`
        };
        liveAlerts.unshift(alert);
        if(liveAlerts.length > 20) liveAlerts.pop();
        _flashSignalAlert(alert);
        try { localStorage.setItem(LS_LIVE_ALERTS, JSON.stringify(liveAlerts.slice(0,20))); } catch {}
      }

      // Update state
      liveMatchesState[fixId] = { ...inPlay, lf };
      liveRecs.push({ lf, inPlay, preMatch });
    }

    _renderLiveDashboard(liveRecs);
    _renderLiveAlerts();

    if(statusEl) statusEl.textContent = `Ενεργό — επόμενο poll σε ${LIVE_POLL_MS/1000}s`;
    if(lastEl) lastEl.textContent = new Date().toLocaleTimeString('el-GR');

  } catch(e) {
    if(statusEl) statusEl.textContent = `Poll error: ${e.message}`;
  }
}

function _updateLiveTrackerUI() {
  const startBtn = document.getElementById('liveStartBtn');
  const stopBtn  = document.getElementById('liveStopBtn');
  const dot      = document.getElementById('liveStatusDot');
  if(startBtn) startBtn.disabled = isLiveTracking;
  if(stopBtn)  stopBtn.disabled  = !isLiveTracking;
  if(dot) {
    dot.style.background  = isLiveTracking ? 'var(--accent-green)' : 'var(--accent-red)';
    dot.style.boxShadow   = isLiveTracking ? '0 0 8px var(--accent-green)' : 'none';
    dot.title             = isLiveTracking ? 'Tracking active' : 'Stopped';
  }
}

function _flashSignalAlert(alert) {
  const box = document.getElementById('liveAlertFlash');
  if(!box) return;
  box.innerHTML = `<div style="background:rgba(251,191,36,0.15);border:1px solid var(--accent-gold);border-radius:var(--radius-sm);padding:10px 14px;font-size:0.75rem;">
    🔔 <strong>SIGNAL FLIP</strong> · ${esc(alert.ht)} vs ${esc(alert.at)} · ${alert.elapsed}' · ${esc(alert.score)}
    <br><span style="color:var(--accent-red)">${esc(alert.from)}</span> → <span style="color:var(--accent-green)">${esc(alert.to)}</span>
  </div>`;
  setTimeout(() => { if(box) box.innerHTML = ''; }, 8000);
  // Show alert log section
  const logSec = document.getElementById('liveAlertSection');
  if(logSec) logSec.style.display = 'block';
}

function _renderLiveDashboard(liveRecs) {
  const el = document.getElementById('liveDashboard');
  if(!el) return;

  if(!liveRecs.length) {
    el.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:32px 0;font-size:0.8rem;">Δεν υπάρχουν live αγώνες αυτή τη στιγμή για τα επιλεγμένα πρωταθλήματα.</div>`;
    return;
  }

  // Sort: signal flips first, then by elapsed desc
  liveRecs.sort((a,b) => {
    const aFlip = a.inPlay && liveMatchesState[a.lf.fixture.id]?.inPlayPick !== a.preMatch?.omegaPick ? 1 : 0;
    const bFlip = b.inPlay && liveMatchesState[b.lf.fixture.id]?.inPlayPick !== b.preMatch?.omegaPick ? 1 : 0;
    if(bFlip !== aFlip) return bFlip - aFlip;
    return (b.lf.fixture.status.elapsed||0) - (a.lf.fixture.status.elapsed||0);
  });

  el.innerHTML = liveRecs.map(({lf, inPlay, preMatch}) => {
    const hG     = lf.goals?.home ?? 0;
    const aG     = lf.goals?.away ?? 0;
    const el_min = lf.fixture.status.elapsed || 0;
    const status = lf.fixture.status.short;
    const isHT   = status === 'HT';

    const conf   = inPlay ? clamp(inPlay.inPlayConf, 0, 99) : 0;
    const confColor = conf >= 70 ? 'var(--accent-green)' : conf >= 45 ? 'var(--accent-gold)' : 'var(--accent-red)';
    const pick   = inPlay?.inPlayPick || 'NO BET ⏱';
    const reason = inPlay?.inPlayReason || '';
    const isNoBet = pick.includes('NO BET');
    const pickColor = isNoBet ? 'var(--text-muted)' :
                      pick.includes('UNDER') ? 'var(--accent-teal)' :
                      pick.includes('OVER 3.5') ? 'var(--accent-purple)' :
                      pick.includes('BTTS') ? 'var(--accent-gold)' : 'var(--accent-green)';

    // Signal flip badge
    const preMatchPick = preMatch?.omegaPick || '';
    const isFlip = inPlay && !isNoBet && preMatchPick && preMatchPick !== pick && !preMatchPick.includes('NO BET');
    const flipBadge = isFlip
      ? `<span style="font-size:0.6rem;background:rgba(251,191,36,0.2);color:var(--accent-gold);border:1px solid var(--accent-gold);border-radius:4px;padding:1px 6px;font-weight:700;margin-left:6px;">FLIP</span>`
      : '';

    // Time bar
    const timeProgress = isHT ? 50 : clamp(el_min / 90 * 100, 0, 100);
    const htLabel = isHT ? 'HT' : `${el_min}'`;

    // Decayed market probabilities for mini indicators
    const d = inPlay?.decayed;

    return `
    <div class="match-card" id="live-card-${lf.fixture.id}" style="border-color:${isFlip ? 'var(--accent-gold)' : isNoBet ? 'var(--border-light)' : 'rgba(16,185,129,0.25)'};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <div class="match-league">
            <span class="live-dot"></span>
            <span class="league-badge">${esc(status)}</span>
            <span style="color:var(--text-muted);font-size:0.65rem;margin-left:4px;">${esc(lf.league.name)}</span>
          </div>
          <div style="font-weight:700;font-size:0.95rem;margin:6px 0 2px;">${esc(lf.teams.home.name)}</div>
          <div style="font-weight:600;font-size:0.85rem;color:var(--text-muted);">${esc(lf.teams.away.name)}</div>
        </div>

        <div style="text-align:center;min-width:80px;">
          <div style="font-size:2rem;font-weight:900;font-family:'Fira Code',monospace;color:var(--accent-green);line-height:1;">${hG} - ${aG}</div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px;">${htLabel}</div>
          <div style="margin-top:6px;background:var(--bg-base);border-radius:4px;overflow:hidden;height:4px;">
            <div style="height:4px;width:${timeProgress}%;background:var(--accent-green);transition:width 1s;border-radius:4px;"></div>
          </div>
        </div>

        <div style="flex:1;min-width:160px;text-align:right;">
          <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">In-Play Signal${flipBadge}</div>
          <div style="font-size:0.85rem;font-weight:800;color:${pickColor};">${esc(pick)}</div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:3px;">${esc(reason)}</div>
          <div style="margin-top:6px;">
            <div style="display:flex;justify-content:flex-end;align-items:center;gap:6px;font-size:0.65rem;">
              <span style="color:var(--text-muted);">Conf</span>
              <span style="font-family:'Fira Code',monospace;color:${confColor};font-weight:700;">${conf.toFixed(0)}%</span>
            </div>
            <div style="background:var(--bg-base);border-radius:3px;height:5px;margin-top:3px;">
              <div style="height:5px;width:${conf}%;background:${confColor};border-radius:3px;transition:width 0.5s;"></div>
            </div>
          </div>
        </div>
      </div>

      ${d ? `
      <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">
        ${[
          {lbl:'O2.5', v: d.pO25, c:'var(--accent-green)'},
          {lbl:'O3.5', v: d.pO35, c:'var(--accent-purple)'},
          {lbl:'U2.5', v: d.pU25, c:'var(--accent-teal)'},
          {lbl:'BTTS', v: d.pBTTS,c:'var(--accent-gold)'},
        ].map(m => {
          const pct = Math.round(m.v * 100);
          return `<div style="flex:1;min-width:55px;background:var(--bg-base);border-radius:6px;padding:6px 8px;text-align:center;">
            <div style="font-size:0.58rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">${m.lbl}</div>
            <div style="font-size:0.9rem;font-weight:900;font-family:'Fira Code',monospace;color:${pct>=65?m.c:'var(--text-muted)'};">${pct}%</div>
          </div>`;
        }).join('')}
        ${preMatchPick && !isNoBet ? `
        <div style="flex:2;min-width:120px;background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.15);border-radius:6px;padding:6px 10px;">
          <div style="font-size:0.58rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:2px;">Pre-match</div>
          <div style="font-size:0.72rem;font-weight:700;color:var(--accent-blue);">${esc(preMatchPick)}</div>
        </div>` : ''}
      </div>` : ''}
    </div>`;
  }).join('');
}

function _renderLiveAlerts() {
  const el = document.getElementById('liveAlertLog');
  if(!el || !liveAlerts.length) return;
  el.innerHTML = liveAlerts.map(a => `
    <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border-light);font-size:0.7rem;flex-wrap:wrap;">
      <span style="color:var(--text-muted);font-family:'Fira Code',monospace;min-width:55px;">${a.time}</span>
      <span style="font-weight:700;color:var(--text-main);">${esc(a.ht)} vs ${esc(a.at)}</span>
      <span style="color:var(--text-muted);">${a.elapsed}' · ${a.score}</span>
      <span style="color:var(--accent-red);">${esc(a.from)}</span>
      <span style="color:var(--text-muted);">→</span>
      <span style="color:var(--accent-green);">${esc(a.to)}</span>
    </div>`).join('');
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

async function fetchFixturesForDates(dates,selLg) {
  let all=[];
  for(let i=0;i<dates.length;i++){
    setProgress((i/dates.length)*100,`Fetching fixtures: ${dates[i]}`);
    const res=await apiReq(`fixtures?date=${dates[i]}`);
    const dm=(res.response||[]).filter(m=>{
      if(selLg==='WORLD') return true;
      if(selLg==='ALL')   return typeof LEAGUE_IDS !== 'undefined' && LEAGUE_IDS.includes(m.league.id);
      if(selLg==='MY_LEAGUES') return typeof MY_LEAGUES_IDS !== 'undefined' && MY_LEAGUES_IDS.includes(m.league.id);
      return m.league.id===parseInt(selLg);
    });
    all.push(...dm); if(all.length>350) break;
  }
  return all;
}

window.runScan = async function() {
  if(isRunning) return;
  const startD=document.getElementById('scanStart').value||todayISO();
  const endD=document.getElementById('scanEnd').value||startD;
  if(new Date(endD)<new Date(startD)){ showErr("Η ημ/νία 'To' πρέπει να είναι >= 'From'."); return; }

  isRunning=true; clearAlerts(); setBtnsDisabled(true);
  setLoader(true,'Initializing Deep Quant...');
  ['topSection','summarySection'].forEach(id=>{ const el = document.getElementById(id); if(el) el.innerHTML=''; });
  window.scannedMatchesData=[]; teamStatsCache.clear(); lastFixCache.clear(); standCache.clear(); h2hCache.clear();

  try {
    const selLg=document.getElementById('leagueFilter').value;
    let all=await fetchFixturesForDates(getDatesInRange(startD,endD),selLg);
    if(!all.length){showErr('Δεν βρέθηκαν αγώνες.');return;}
    if(all.length>350){showOk('Περιορίστηκε σε 350 αγώνες.');all=all.slice(0,350);}

    for(let i=0;i<all.length;i++) await analyzeMatchSafe(all[i],i,all.length);

    rebuildTopLists(); renderTopSections(); renderSummaryTable(); renderMatchesFeed();
    showOk(`Scan ολοκληρώθηκε. ${all.length} αγώνες αναλύθηκαν.`);
  } catch(e){ showErr(e.message); }
  finally { isRunning=false; setLoader(false); setBtnsDisabled(false); }
}

// --- Accordion Logic & Rendering ---
window.toggleMatchDetails = function(id) {
  const details = document.getElementById('details-' + id);
  if(details) { details.style.display = details.style.display === 'none' ? 'block' : 'none'; }
};

function getMatchCardHTML(d) {
  const isUnder = d.omegaPick.includes('UNDER');
  const isNoBet = d.omegaPick.includes('NO BET');
  const isCards = d.omegaPick.includes('ΚΑΡΤΕΣ');
  let signalClass = isNoBet ? 'signal-warn' : isUnder ? 'signal-under' : 'signal-hit';
  let pickColor = isNoBet ? 'var(--accent-red)' : isUnder ? 'var(--accent-teal)' : isCards ? 'var(--accent-gold)' : 'var(--accent-green)';
  if(d.isBomb) { signalClass = 'signal-hit'; pickColor = 'var(--accent-purple)'; }

  let scoreHtml='';
  if(d.m?.goals?.home != null){
    const live = isLive(d.m.fixture.status.short);
    const col  = live ? 'var(--accent-green)' : '#ffffff';
    const el   = live ? `<span style="font-size:0.8rem;color:var(--accent-green);margin-left:4px;">${d.m.fixture.status.elapsed}'</span>` : '';
    scoreHtml  = `<div class="score-display" style="color:${col}; font-weight:900;">${d.m.goals.home} - ${d.m.goals.away}${el}</div>`;
  }

  const rankBadge = r => r && r !== 99 ? `<span class="team-rank">#${r}</span>` : '';
  const formHtml  = (hist) => `<div style="display:flex;gap:3px;margin-top:4px;">${(hist||[]).slice(0,5).map(h=>`<div class="form-dot form-${h.cls}">${h.res}</div>`).join('')}</div>`;
  const conf = Math.min(Math.max(Number(d.strength) || 0, 0), 100);
  const confColor = conf >= 70 ? 'var(--accent-green)' : conf >= 50 ? 'var(--accent-gold)' : 'var(--accent-red)';
  const isMatchLive = isLive(d.m?.fixture?.status?.short);
  const liveIndicator = isMatchLive ? `<span class="live-dot"></span>` : '';
  const countryName = d.m?.league?.country;
  const countryStr = countryName ? `<span style="color:var(--text-main); font-weight:700;">${esc(countryName)}</span> <span style="color:var(--text-muted); opacity:0.5">|</span> ` : '';

  let poissonHtml = '';
  if(d.pp) {
      let html = `<div class="poisson-grid" style="grid-template-columns: repeat(6, 1fr); gap: 2px; margin-top: 10px;">`;
      html += `<div class="poisson-cell" style="color:var(--text-muted)"></div>`;
      for(let a = 0; a <= 4; a++) html += `<div class="poisson-cell" style="color:var(--accent-blue)">${a}</div>`;
      for(let h = 0; h <= 4; h++) {
        html += `<div class="poisson-cell" style="color:var(--accent-gold)">${h}</div>`;
        for(let a = 0; a <= 4; a++) {
          const prob = (d.pp.matrix[h][a] * 100);
          const textCol = prob > 6 ? '#000' : 'var(--text-main)';
          html += `<div class="poisson-cell" style="background:rgba(56,189,248,${prob/12});color:${textCol}">${prob.toFixed(1)}%</div>`;
        }
      }
      html += `</div>`;
      poissonHtml = html;
  }

  return `
  <div class="match-card" id="card-${d.fixId}">
    <div class="match-header" style="cursor:pointer;" onclick="toggleMatchDetails('${d.fixId}')" title="Πατήστε για την Προηγμένη Στατιστική Ανάλυση">
      <div>
        <div class="match-league">${liveIndicator}<span class="league-badge">${esc(d.m?.fixture?.status?.short || 'FT')}</span> ${countryStr}${esc(d.lg)}</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div><div class="team-name">${esc(d.ht)}${rankBadge(d.hr)}</div>${formHtml(d.hS?.history)}</div>
          <div><div class="team-name" style="color:var(--text-muted)">${esc(d.at)}${rankBadge(d.ar)}</div>${formHtml(d.aS?.history)}</div>
        </div>
      </div>
      <div class="score-box">
        ${scoreHtml}
        <div class="total-xg-badge">Total xG: ${Number(d.tXG).toFixed(2)}</div>
      </div>
    </div>
    
    <div class="signal-box ${signalClass}" style="cursor:pointer;" onclick="toggleMatchDetails('${d.fixId}')">
      <div style="font-size:0.65rem;font-weight:700;color:${pickColor};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">System Output Signal</div>
      <div class="signal-value" style="color:${pickColor}">${esc(d.omegaPick)}</div>
      <div class="signal-desc">${esc(d.reason)}</div>
      <div class="conf-bar-wrap" style="margin-top:10px;">
        <div class="conf-bar-label"><span>Confidence</span><span style="color:${confColor};font-family:'Fira Code',monospace">${conf.toFixed(1)}%</span></div>
        <div class="conf-bar-track"><div class="conf-bar-fill" style="width:${conf}%;background:${confColor};"></div></div>
      </div>
      <div style="margin-top:12px; font-size:0.65rem; color:var(--text-muted); opacity:0.6; font-weight:700;">▼ ΠΑΤΗΣΤΕ ΓΙΑ ΑΝΑΛΥΣΗ ▼</div>
    </div>
    
    <div id="details-${d.fixId}" style="display:none; margin-top:20px; padding-top:20px; border-top:1px dashed var(--border-light);">
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-box-title">Game Projections</div>
          <div class="stat-row"><span class="stat-lbl">Exact Score (Poisson)</span><span class="stat-val stat-highlight">${esc(d.exact)}</span></div>
          <div class="stat-row"><span class="stat-lbl">Lambda xG</span><span class="stat-val" style="color:var(--accent-blue)">${Number(d.hExp).toFixed(2)} - ${Number(d.aExp).toFixed(2)}</span></div>
          <div class="stat-row"><span class="stat-lbl">xG Diff</span><span class="stat-val" style="color:${d.xgDiff > 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${d.xgDiff > 0 ? '+' : ''}${Number(d.xgDiff).toFixed(2)}</span></div>
          <div class="stat-row"><span class="stat-lbl">BTTS Rating</span><span class="stat-val">${Number(d.btts).toFixed(2)}</span></div>
          <div class="stat-row"><span class="stat-lbl">Poisson O2.5</span><span class="stat-val" style="color:var(--accent-blue)">${d.pp ? (d.pp.pO25*100).toFixed(1)+'%' : '—'}</span></div>
          <div class="stat-row"><span class="stat-lbl">Poisson U2.5</span><span class="stat-val" style="color:var(--accent-teal)">${d.pp ? (d.pp.pU25*100).toFixed(1)+'%' : '—'}</span></div>
        </div>
        <div class="stat-box">
          <div class="stat-box-title">Home vs Away Breakdown</div>
          <div class="stat-row"><span class="stat-lbl">Form xG</span><span class="stat-val">${d.hS?.uiXG||'0.00'} <span style="color:var(--text-muted)">vs</span> ${d.aS?.uiXG||'0.00'}</span></div>
          <div class="stat-row"><span class="stat-lbl">Split xG</span><span class="stat-val">${d.hS?.uiSXG||'0.00'} <span style="color:var(--text-muted)">vs</span> ${d.aS?.uiSXG||'0.00'}</span></div>
          <div class="stat-row"><span class="stat-lbl">Exp. Cards</span><span class="stat-val">${Number(d.hS?.crd||0).toFixed(1)} <span style="color:var(--text-muted)">vs</span> ${Number(d.aS?.crd||0).toFixed(1)}</span></div>
          <div class="stat-row" style="border-top:1px solid var(--border-light);margin-top:6px;padding-top:6px;"><span class="stat-lbl" style="color:var(--text-muted)">H2H (Last 8)</span><span class="stat-val" style="font-size:0.65rem">${d.h2h?`${d.h2h.homeWins}W - ${d.h2h.draws}D - ${d.h2h.awayWins}W`:'N/A'}</span></div>
        </div>
      </div>
      <div class="stat-box" style="margin-top:12px;">
        <div class="stat-box-title">🚩 Corner Model — Advanced Analysis</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <div>
            <div style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Home</div>
            <div class="stat-row"><span class="stat-lbl">Avg Corners</span><span class="stat-val" style="color:var(--accent-teal)">${Number(d.hS?.cor||5).toFixed(1)}</span></div>
            <div class="stat-row"><span class="stat-lbl">Conceded</span><span class="stat-val" style="color:var(--text-muted)">${Number(d.hS?.corAgainst||4.5).toFixed(1)}</span></div>
            <div class="stat-row"><span class="stat-lbl">Shots On/Off</span><span class="stat-val">${Number(d.hS?.shotsOn||0).toFixed(1)} / ${Number(d.hS?.shotsOff||0).toFixed(1)}</span></div>
            <div class="stat-row"><span class="stat-lbl">Cor/Shot ratio</span><span class="stat-val" style="color:var(--accent-gold)">${Number(d.hS?.corRatio||0).toFixed(3)}</span></div>
          </div>
          <div>
            <div style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Away</div>
            <div class="stat-row"><span class="stat-lbl">Avg Corners</span><span class="stat-val" style="color:var(--accent-teal)">${Number(d.aS?.cor||4.7).toFixed(1)}</span></div>
            <div class="stat-row"><span class="stat-lbl">Conceded</span><span class="stat-val" style="color:var(--text-muted)">${Number(d.aS?.corAgainst||5.1).toFixed(1)}</span></div>
            <div class="stat-row"><span class="stat-lbl">Shots On/Off</span><span class="stat-val">${Number(d.aS?.shotsOn||0).toFixed(1)} / ${Number(d.aS?.shotsOff||0).toFixed(1)}</span></div>
            <div class="stat-row"><span class="stat-lbl">Cor/Shot ratio</span><span class="stat-val" style="color:var(--accent-gold)">${Number(d.aS?.corRatio||0).toFixed(3)}</span></div>
          </div>
        </div>
        <div style="background:var(--bg-surface);border-radius:var(--radius-sm);padding:10px;margin-top:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div style="font-size:0.7rem;">
            <span style="color:var(--text-muted);">Projected Total:</span>
            <span style="font-family:var(--font-mono);font-size:1.1rem;font-weight:900;color:var(--accent-teal);margin-left:8px;">${d.hS?._expCorners ?? '—'}</span>
            <span style="color:var(--text-muted);font-size:0.65rem;margin-left:4px;">corners</span>
          </div>
          <div style="font-size:0.7rem;">
            <span style="color:var(--text-muted);">P(Over 8.5):</span>
            <span style="font-family:var(--font-mono);font-size:1.1rem;font-weight:900;color:${(d.hS?._pOver85||0)>=65?'var(--accent-green)':(d.hS?._pOver85||0)>=45?'var(--accent-gold)':'var(--accent-red)'};margin-left:8px;">${d.hS?._pOver85 ?? '—'}%</span>
          </div>
          <div style="font-size:0.65rem;color:var(--text-muted);font-style:italic;">NegBin model · Bayesian shrinkage · shots regression</div>
        </div>
      </div>
      <div class="stat-box" style="margin-top:12px;">
        <div class="stat-box-title">📊 Poisson Score Matrix (Home↓ Away→)</div>
        ${poissonHtml}
      </div>
    </div>
  </div>`;
}

function renderMatchesFeed() {
  const feed = document.getElementById('matchesFeed');
  if (!feed) return;
  const sd = window.scannedMatchesData || [];
  if (!sd.length) { feed.innerHTML = ''; return; }
  feed.innerHTML = sd.map(d => getMatchCardHTML(d)).join('');
}

function rebuildTopLists() {
  const sd = window.scannedMatchesData || [];
  latestTopLists.combo1   = sd.filter(x=>x.omegaPick&&x.omegaPick.includes('⚡')).sort((a,b)=>(b.strength||0)-(a.strength||0)).slice(0,5);
  latestTopLists.outcomes = sd.filter(x=>x.omegaPick&&(x.omegaPick.includes('ΑΣΟΣ')||x.omegaPick.includes('ΔΙΠΛΟ'))).sort((a,b)=>(b.strength||0)-(a.strength||0)).slice(0,5);
  latestTopLists.exact    = [...sd].filter(x=>x.exactConf).sort((a,b)=>(b.exactConf||0)-(a.exactConf||0)).slice(0,5);
  latestTopLists.over25   = sd.filter(x=>x.omegaPick&&x.omegaPick.includes('OVER 2.5')).sort((a,b)=>(b.strength||0)-(a.strength||0)).slice(0,5);
  latestTopLists.over35   = sd.filter(x=>x.omegaPick&&x.omegaPick.includes('OVER 3.5')).sort((a,b)=>(b.strength||0)-(a.strength||0)).slice(0,5);
  latestTopLists.under25  = sd.filter(x=>x.omegaPick&&x.omegaPick.includes('UNDER 2.5')).sort((a,b)=>(b.strength||0)-(a.strength||0)).slice(0,5);
}

function renderTopSections() {
  const tabs=[
    {id:'combo1',  lbl:'High Conf 1X2',      d:latestTopLists.combo1,   sk:'strength', sl:'CONF'},
    {id:'outcomes',lbl:'Match Odds',         d:latestTopLists.outcomes, sk:'strength', sl:'CONF'},
    {id:'over25',  lbl:'Over 2.5',           d:latestTopLists.over25,   sk:'tXG',      sl:'xG'},
    {id:'over35',  lbl:'Over 3.5',           d:latestTopLists.over35,   sk:'tXG',      sl:'xG'},
    {id:'under25', lbl:'Under 2.5',          d:latestTopLists.under25,  sk:'strength', sl:'CONF'},
    {id:'exact',   lbl:'Exact Score',        d:latestTopLists.exact,    sk:'exactConf',sl:'CONF'}
  ];
  let html=`<div class="quant-panel" style="padding:0; overflow:hidden;"><div class="tabs-wrapper">`;
  tabs.forEach((t,i)=>{ html+=`<button class="tab-btn ${i===0?'active':''}" onclick="switchTab('${t.id}')" id="tab-btn-${t.id}">${t.lbl} <span class="tab-count">${t.d.length}</span></button>`; });
  html+=`</div>`;
  tabs.forEach((t,i)=>{
    html+=`<div class="pred-tab-panel" style="display:${i===0?'block':'none'}" id="tabpanel-${t.id}">
      <div style="padding:0 20px 20px 20px; display:flex; flex-direction:column; gap:8px;">`;
    if(!t.d.length) html+=`<div style="text-align:center;color:var(--text-muted);padding:20px 0;font-weight:600;">No high-confidence signals found.</div>`;
    t.d.forEach((x,j)=>{
      const rawVal = t.id === 'exact' ? x.exact : Number(x[t.sk] || 0);
      const val = t.id === 'exact' ? rawVal : rawVal.toFixed(1);
      html+=`
      <div onclick="scrollToMatch('card-${x.fixId}')" style="display:flex; align-items:center; gap:16px; padding:12px; background:var(--bg-base); border:1px solid var(--border-light); border-radius:var(--radius-sm); cursor:pointer;">
        <div class="data-num" style="color:var(--text-muted); font-size:1.2rem;">#${j+1}</div>
        <div style="flex:1;">
          <div style="font-weight:700; font-size:0.9rem;">${esc(x.ht)} <span style="color:var(--text-muted)">vs</span> ${esc(x.at)}</div>
          <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">${esc(x.lg)}</div>
          <div style="font-size:0.7rem; color:var(--accent-green); font-weight:600; margin-top:2px;">${esc(x.omegaPick)}</div>
        </div>
        <div style="text-align:right;">
          <div class="data-num" style="color:var(--accent-blue); font-size:1.1rem;">${val}</div>
          <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">${t.sl}</div>
        </div>
      </div>`;
    });
    html+=`</div></div>`;
  });
  html+=`</div>`;
  const topSec = document.getElementById('topSection');
  if(topSec) topSec.innerHTML=html;
}

window.switchTab = function(id){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.pred-tab-panel').forEach(p=>p.style.display='none');
  const btn=document.getElementById('tab-btn-'+id); if(btn) btn.classList.add('active');
  const panel=document.getElementById('tabpanel-'+id); if(panel) panel.style.display='block';
};

window.scrollToMatch = function(id){
  setTimeout(()=>{
    const c = document.getElementById(id);
    if(c){
      c.scrollIntoView({behavior:'smooth',block:'center'});
      c.style.transition='box-shadow 0.3s, border-color 0.3s';
      c.style.borderColor='var(--accent-blue)';
      c.style.boxShadow='0 0 30px var(--accent-blue-glow)';
      
      const fixId = id.replace('card-', '');
      const details = document.getElementById('details-' + fixId);
      if(details && details.style.display === 'none') { details.style.display = 'block'; }
      setTimeout(()=>{c.style.borderColor='var(--border-light)'; c.style.boxShadow='var(--shadow-subtle)';}, 2000);
    }
  }, 150);
};

function renderSummaryTable() {
  const sec = document.getElementById('summarySection');
  if(!sec) return;
  const sd = window.scannedMatchesData;
  if(!sd.length) { sec.innerHTML=''; return; }

  let matchRows = '';
  const grouped={};
  sd.forEach((d,i)=>{ if(!grouped[d.lg]) grouped[d.lg]=[]; grouped[d.lg].push({...d,originalIndex:i}); });
  
  for(const[lg,matches] of Object.entries(grouped)){
    matchRows+=`<div style="background:rgba(14,165,233,0.05);padding:7px 16px;font-weight:700;font-size:0.72rem;color:var(--accent-blue);border-top:1px solid var(--border-light);border-bottom:1px solid var(--border-light);text-transform:uppercase;letter-spacing:1px;">${esc(lg)}</div>
    <div class="data-table-wrapper" style="border:none;border-radius:0;margin-bottom:0;">
    <table class="summary-table">
      <thead><tr>
        <th class="col-match">Match</th><th class="col-score">Score</th>
        <th class="col-1x2">1X2</th><th class="col-o25">O2.5</th>
        <th class="col-u25">U2.5</th><th class="col-btts">BTTS</th>
        <th class="col-exact">Exact</th><th class="col-conf">Conf%</th>
        <th class="col-signal">Signal</th>
      </tr></thead><tbody>`;

    matches.forEach(x=>{
      const isFin=isFinished(x.m?.fixture?.status?.short), isLiveNow=isLive(x.m?.fixture?.status?.short);
      const ah=x.m?.goals?.home??0, aa=x.m?.goals?.away??0, aTot=ah+aa;
      const aBtts=ah>0&&aa>0, aOut=ah>aa?'1':(ah<aa?'2':'X');
      let scoreStr='-',scoreCol='var(--text-muted)';
      if(isFin){scoreStr=`${ah}-${aa}`;scoreCol='var(--text-main)';}
      else if(isLiveNow){scoreStr=`${ah}-${aa}`;scoreCol='var(--accent-green)';}

      let colOut=x.outPick==='X'?'var(--text-muted)':'var(--text-main)';
      let colOm=x.omegaPick?.includes('NO BET')?'var(--text-muted)':'var(--text-main)';
      
      const isO25=x.omegaPick?.includes('OVER 2.5')||x.omegaPick?.includes('OVER 3.5')?'🔥':'-';
      const isU25=x.omegaPick?.includes('UNDER 2.5')?'🔒':'-';
      const isBttsF=x.omegaPick?.includes('GOAL')?'🎯':'-';

      const conf=Math.min(Math.max(safeNum(x.strength),0),100);

      matchRows+=`<tr onclick="scrollToMatch('card-${x.fixId}')" style="cursor:pointer;" title="Πατήστε για να δείτε την ανάλυση">
        <td class="col-match" style="font-weight:600;color:var(--text-main);">
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${isLiveNow?'<span class="live-dot"></span>':''}${esc(x.ht)} <span style="color:var(--text-muted)">–</span> ${esc(x.at)}</div>
        </td>
        <td class="col-score data-num" style="color:${scoreCol};">${scoreStr}</td>
        <td class="col-1x2 data-num" style="color:${colOut};">${x.outPick}</td>
        <td class="col-o25 data-num">${isO25}</td>
        <td class="col-u25 data-num">${isU25}</td>
        <td class="col-btts data-num">${isBttsF}</td>
        <td class="col-exact data-num">${x.exact||'?-?'}</td>
        <td class="col-conf data-num" style="color:${conf>=65?'var(--accent-green)':conf>=45?'var(--accent-gold)':'var(--text-muted)'};">${conf.toFixed(0)}%</td>
        <td class="col-signal" style="font-size:0.68rem;color:${colOm};font-weight:800;">${x.omegaPick?.split(' ').slice(0,3).join(' ')||'-'}</td>
      </tr>`;
    });
    matchRows+=`</tbody></table></div>`;
  }
  sec.innerHTML = matchRows;
}

window.loadSettings = function() {
  try { const s=JSON.parse(localStorage.getItem(LS_SETTINGS)); if(s) engineConfig={...DEFAULT_SETTINGS,...s}; } catch {}
  try { const lm=JSON.parse(localStorage.getItem(LS_LGMODS)); if(lm) leagueMods={ ...leagueMods, ...lm }; } catch {}
  for(const [id,key] of Object.entries(SETTINGS_MAP)) { const el=document.getElementById(id); if(el) el.value=engineConfig[key]; }
  buildLeagueModTable();
}

window.saveSettings = function() {
  for(const [id,key] of Object.entries(SETTINGS_MAP)) { const v=parseFloat(document.getElementById(id)?.value); if(!isNaN(v)) engineConfig[key]=v; }
  try { localStorage.setItem(LS_SETTINGS, JSON.stringify(engineConfig)); } catch {}
  showOk("Global Parameters Saved!"); buildLeagueModTable();
}

window.resetSettings = function() { engineConfig={...DEFAULT_SETTINGS}; for(const [id,key] of Object.entries(SETTINGS_MAP)) { const el=document.getElementById(id); if(el) el.value=engineConfig[key]; } try{localStorage.setItem(LS_SETTINGS,JSON.stringify(engineConfig));}catch{} showOk("Restored Defaults."); buildLeagueModTable(); }

function buildLeagueModTable() {
  const tbody = document.getElementById('leagueModBody'); if(!tbody) return; tbody.innerHTML='';
  if (typeof LEAGUES_DATA === 'undefined') return;
  LEAGUES_DATA.forEach(l => {
    let placeholderDiff = engineConfig.xG_Diff.toFixed(2);
    if(typeof TIGHT_LEAGUES !== 'undefined' && TIGHT_LEAGUES.has(l.id)) placeholderDiff = "0.35";
    else if(typeof GOLD_LEAGUES !== 'undefined' && GOLD_LEAGUES.has(l.id)) placeholderDiff = "0.65";
    tbody.innerHTML += `<tr><td class="left-align" style="font-weight:700;color:var(--text-main);font-size:0.8rem">${l.name}</td><td><input type="number" step="0.01" placeholder="${engineConfig.modGold.toFixed(2)}" class="league-mod-input"></td><td><input type="number" step="0.05" placeholder="${engineConfig.tXG_O25.toFixed(2)}" class="league-mod-input"></td><td><input type="number" step="0.05" placeholder="${engineConfig.tXG_O35.toFixed(2)}" class="league-mod-input"></td><td><input type="number" step="0.05" placeholder="${engineConfig.tXG_U25.toFixed(2)}" class="league-mod-input"></td><td><input type="number" step="0.05" placeholder="${engineConfig.tBTTS.toFixed(2)}" class="league-mod-input"></td><td><input type="number" step="0.05" placeholder="${placeholderDiff}" class="league-mod-input"></td><td>—</td></tr>`;
  });
}

window.saveLeagueMods = function() { showOk("League Mods saved."); }

window.resimulateMatches = function() {
  if (!window.scannedMatchesData || !window.scannedMatchesData.length) {
    showErr("Δεν υπάρχουν δεδομένα για επανάληψη. Τρέξτε πρώτα το Model Scan.");
    return;
  }
  // Re-apply computePick with updated engineConfig to existing data
  window.scannedMatchesData = window.scannedMatchesData.map(rec => {
    try {
      const lp = getLeagueParams(rec.leagueId);
      const hXG = Number(rec.hS?.fXG || 1.1) * lp.mult;
      const aXG = Number(rec.aS?.fXG || 1.1) * lp.mult;
      const tXG = hXG + aXG;
      const btts = Math.min(hXG, aXG);
      const result = computePick(hXG, aXG, tXG, btts, lp, rec.hS || {}, rec.aS || {}, rec.h2h);
      return {
        ...rec, tXG, btts: btts, outPick: result.outPick, xgDiff: result.xgDiff,
        exact: `${result.hG}-${result.aG}`, exactConf: result.exactConf,
        omegaPick: result.omegaPick, strength: result.pickScore, reason: result.reason,
        hExp: result.hExp, aExp: result.aExp, pp: result.pp
      };
    } catch { return rec; }
  });
  rebuildTopLists(); renderTopSections(); renderSummaryTable(); renderMatchesFeed();
  showOk("Re-simulation complete με τις νέες παραμέτρους.");
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

window.saveBankroll = function() {
  const inp = document.getElementById('bankrollInput');
  const val = parseFloat(inp?.value);
  if (!val || val <= 0) { showErr("Εισάγετε έγκυρο ποσό."); return; }
  bankrollData.history = bankrollData.history || [];
  bankrollData.history.unshift({ amount: val, date: todayISO() });
  if (bankrollData.history.length > 10) bankrollData.history.pop();
  bankrollData.current = val;
  try { localStorage.setItem(LS_BANKROLL, JSON.stringify(bankrollData)); } catch {}
  const disp = document.getElementById('bankrollDisplay');
  if (disp) disp.textContent = `€${val.toFixed(2)}`;
  renderBankrollHistory();
  showOk(`Bankroll ορίστηκε σε €${val.toFixed(2)}`);
};

function renderBankrollHistory() {
  const el = document.getElementById('bankrollHistory');
  if (!el || !bankrollData.history?.length) return;
  el.innerHTML = `<div style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Ιστορικό</div>` +
    bankrollData.history.map(h => `<div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:4px 0;border-bottom:1px solid var(--border-light);"><span style="color:var(--text-muted)">${h.date}</span><span style="color:var(--accent-gold);font-family:var(--font-mono)">€${Number(h.amount).toFixed(2)}</span></div>`).join('');
}

window.addEventListener('DOMContentLoaded', () => {
  // Load saved bankroll
  try {
    const b = JSON.parse(localStorage.getItem(LS_BANKROLL));
    if (b) { bankrollData = b; const disp = document.getElementById('bankrollDisplay'); if (disp && bankrollData.current) disp.textContent = `€${Number(bankrollData.current).toFixed(2)}`; }
  } catch {}

  const pinInput = document.getElementById('pin');
  if (pinInput) {
    pinInput.addEventListener('input', function() {
      if(this.value === "106014") {
        document.getElementById('auth').style.display = 'none';
        document.getElementById('app').style.display  = 'block';
        if(typeof loadSettings === 'function') loadSettings();
        if(typeof initCredits === 'function') initCredits();
      }
    });
  }
  
  const scanStart = document.getElementById('scanStart');
  const scanEnd = document.getElementById('scanEnd');
  if(scanStart) scanStart.value = todayISO();
  if(scanEnd) scanEnd.value = todayISO();
  
  const sel=document.getElementById('leagueFilter');
  if(sel && typeof LEAGUES_DATA !== 'undefined') {
    LEAGUES_DATA.forEach(l=>sel.innerHTML+=`<option value="${l.id}">${l.flag||''} ${l.country} — ${l.name}</option>`);
  }

  // Build Live Tracker Panel HTML
  const liveSecEl = document.getElementById('advisorSection');
  if(liveSecEl) {
    liveSecEl.innerHTML = `
    <div class="quant-panel" style="border-color:rgba(16,185,129,0.5);">
      <div class="panel-title" style="cursor:pointer;color:var(--accent-green);" onclick="togglePanel('liveTrackerBody','liveTrackerArrow')">
        <span style="display:flex;align-items:center;gap:10px;">
          <span id="liveStatusDot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--accent-red);flex-shrink:0;transition:background 0.3s,box-shadow 0.3s;"></span>
          📡 Live Tracker — In-Play Signal Monitor
          <span id="liveMatchCount" style="font-family:'Fira Code',monospace;font-size:0.75rem;background:rgba(16,185,129,0.15);color:var(--accent-green);padding:2px 8px;border-radius:10px;border:1px solid rgba(16,185,129,0.3);">0</span>
          <span style="font-size:0.65rem;color:var(--text-muted);">live now</span>
        </span>
        <span id="liveTrackerArrow">▼</span>
      </div>
      <div id="liveTrackerBody" style="display:none;">
        <div class="toolbar" style="margin-bottom:16px;">
          <div class="input-group" style="flex:2;">
            <label class="input-label">Πρωταθλήματα</label>
            <select id="liveTrackerLeague" class="quant-input">
              <option value="MY_LEAGUES">⭐ MY LEAGUES</option>
              <option value="ALL">🌐 Top 24 Leagues</option>
              ${(typeof LEAGUES_DATA !== 'undefined' ? LEAGUES_DATA : []).map(l=>`<option value="${l.id}">${l.flag||''} ${l.country} — ${l.name}</option>`).join('')}
            </select>
          </div>
          <button id="liveStartBtn" class="btn btn-primary" onclick="startLiveTracker()" style="height:38px;background:var(--accent-green);border-color:var(--accent-green);color:#000;font-weight:800;">▶ Start Tracking</button>
          <button id="liveStopBtn"  class="btn btn-outline"  onclick="stopLiveTracker()"  style="height:38px;" disabled>⏹ Stop</button>
          <div style="display:flex;flex-direction:column;justify-content:center;gap:2px;">
            <div style="font-size:0.65rem;color:var(--text-muted);">Status: <span id="liveTrackerStatus" style="color:var(--accent-blue);">Inactive</span></div>
            <div style="font-size:0.65rem;color:var(--text-muted);">Last poll: <span id="liveTrackerLastPoll" style="font-family:'Fira Code',monospace;">—</span></div>
          </div>
        </div>

        <div id="liveAlertFlash" style="margin-bottom:12px;"></div>

        <div id="liveDashboard" style="display:flex;flex-direction:column;gap:12px;"></div>

        <div id="liveAlertSection" style="margin-top:20px;display:none;">
          <div style="font-size:0.72rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
            <span>🔔 Signal Flip Log</span>
            <button onclick="liveAlerts=[];_renderLiveAlerts();document.getElementById('liveAlertSection').style.display='none';" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:0.7rem;">Clear</button>
          </div>
          <div id="liveAlertLog"></div>
        </div>
      </div>
    </div>`;

    // Show alert section when alerts arrive
    const origFlash = _flashSignalAlert;
  }

  // Load saved live alerts
  try { const la = JSON.parse(localStorage.getItem(LS_LIVE_ALERTS)); if(Array.isArray(la)) liveAlerts = la; } catch {}

  // Build Audit Panel HTML
  const auditSec = document.getElementById('auditSection');
  if(auditSec) {
    auditSec.innerHTML = `
    <div class="quant-panel" style="border-color:rgba(16,185,129,0.3);">
      <div class="panel-title" style="cursor:pointer;color:var(--accent-green);" onclick="togglePanel('auditBody','auditArrow')">
        <span>🔬 Audit Engine — Αξιολόγηση Αποτελεσματικότητας</span><span id="auditArrow">▼</span>
      </div>
      <div id="auditBody" style="display:none;">
        <div class="toolbar" style="margin-bottom:16px;">
          <div class="input-group"><label class="input-label">Audit Από</label><input type="date" id="auditFrom" class="quant-input"></div>
          <div class="input-group"><label class="input-label">Audit Έως</label><input type="date" id="auditTo" class="quant-input"></div>
          <div class="input-group" style="flex:2;">
            <label class="input-label">Πρωτάθλημα</label>
            <select id="auditLeague" class="quant-input">
              <option value="MY_LEAGUES">⭐ MY LEAGUES</option>
              <option value="ALL">🌐 Top 24 Leagues</option>
              ${(typeof LEAGUES_DATA !== 'undefined' ? LEAGUES_DATA : []).map(l=>`<option value="${l.id}">${l.flag||''} ${l.country} — ${l.name}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary" id="auditRunBtn" onclick="runAudit()" style="height:38px;background:var(--accent-green);border-color:var(--accent-green);color:#000;">▶ Run Audit</button>
        </div>
        <div id="auditLoader" style="display:none;" class="progress-container">
          <div class="progress-track"><div id="auditBar" class="progress-bar" style="background:var(--accent-green);"></div></div>
          <div class="progress-text" id="auditStatus">Initializing Audit...</div>
        </div>
        <div id="auditResults"></div>
      </div>
    </div>`;

    // Set default dates: last 14 days
    const af = document.getElementById('auditFrom');
    const at = document.getElementById('auditTo');
    if(af && at) {
      const d = new Date(); d.setDate(d.getDate()-14);
      af.value = d.toISOString().split('T')[0];
      const y = new Date(); y.setDate(y.getDate()-1);
      at.value = y.toISOString().split('T')[0];
    }
  }
});

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
    window.resimulateMatches();
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
