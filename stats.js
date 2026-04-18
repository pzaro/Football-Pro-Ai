// stats.js - Στατιστική Ανάλυση, Μοντέλο Poisson & Pick Engine
// v2.1 - Ενσωματωμένο API, UI και Σύστημα Τραυματισμών

// ================================================================
//  GLOBAL APP VARIABLES & API SETUP
// ================================================================
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

// ================================================================
//  ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ ΚΑΙ UI HELPERS
// ================================================================
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

window.togglePanel = function(panelId,arrowId) {
  const p=document.getElementById(panelId),a=document.getElementById(arrowId);
  if(p.style.display==='none'){p.style.display='block';if(a)a.innerText='▲';}
  else{p.style.display='none';if(a)a.innerText='▼';}
};
function setLoader(show,text='') { 
  const l = document.getElementById('loader'); if(l) l.style.display=show?'block':'none'; 
  const s = document.getElementById('status'); if(s) s.textContent=text; 
  const b = document.getElementById('bar'); if(!show && b) b.style.width='0%'; 
}
function setProgress(pct,text='') { 
  const b = document.getElementById('bar'); if(b) b.style.width=Math.round(clamp(pct,0,100))+'%'; 
  const s = document.getElementById('status'); if(s) s.textContent=text + (_apiActiveCount > 0 ? ` [${_apiActiveCount} active]` : ''); 
}
function setBtnsDisabled(d) { ["btnPre","leagueFilter"].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=d;}); }
function showErr(msg) { clearTimeout(_errTimer); const box=document.getElementById('errorBox'); if(box) box.innerHTML=`<div style="background:var(--accent-red); color:#fff; padding:12px; border-radius:var(--radius-sm); margin-bottom:15px; font-weight:600; box-shadow:0 4px 12px rgba(244,63,94,0.3);">⚠️ ${esc(msg)}</div>`; _errTimer=setTimeout(()=>box.innerHTML='',8000); }
function showOk(msg) { clearTimeout(_okTimer); const box=document.getElementById('successBox'); if(box) box.innerHTML=`<div style="background:var(--accent-green); color:#000; padding:12px; border-radius:var(--radius-sm); margin-bottom:15px; font-weight:600; box-shadow:0 4px 12px rgba(16,185,129,0.3);">✓ ${esc(msg)}</div>`; _okTimer=setTimeout(()=>box.innerHTML='',4000); }
function clearAlerts() { const e = document.getElementById('errorBox'), s = document.getElementById('successBox'); if(e) e.innerHTML=''; if(s) s.innerHTML=''; }
function abortScan(msg) { if(msg)showErr(msg); isRunning=false; setBtnsDisabled(false); setLoader(false); }

// ================================================================
//  INJURY / ABSENCE IMPACT SYSTEM  —  v1.0
// ================================================================
const POSITION_IMPACT = {
  FW:  { xg: 0.18, xga: 0.00, cor: 0.04 },
  MF:  { xg: 0.10, xga: 0.04, cor: 0.06 },
  DF:  { xg: 0.02, xga: 0.14, cor: 0.01 },
  GK:  { xg: 0.00, xga: 0.20, cor: 0.00 },
  UNK: { xg: 0.06, xga: 0.06, cor: 0.02 }  
};

function applyInjuryPenalties(absentPlayers = []) {
  let xgPenalty = 0, xgaPenalty = 0, corPenalty = 0;
  for (const p of absentPlayers) {
    const pos    = (p.position || 'UNK').toUpperCase().slice(0, 2);
    const impact = POSITION_IMPACT[pos] || POSITION_IMPACT.UNK;
    const w      = clamp(safeNum(p.importanceScore, 0.5), 0, 1);
    xgPenalty  += impact.xg  * w;
    xgaPenalty += impact.xga * w;
    corPenalty += impact.cor * w;
  }
  return {
    xgFactor:  clamp(1 - xgPenalty,  0.50, 1.00),
    xgaFactor: clamp(1 - xgaPenalty, 0.50, 1.00),
    corFactor: clamp(1 - corPenalty,  0.70, 1.00)
  };
}

function applyInjuriesToIntel(intel, absentPlayers = []) {
  if (!absentPlayers || !absentPlayers.length) return intel;
  const { xgFactor, xgaFactor, corFactor } = applyInjuryPenalties(absentPlayers);
  return {
    ...intel,
    fXG:  safeNum(intel.fXG)  * xgFactor,
    sXG:  safeNum(intel.sXG)  * xgFactor,
    wXG:  safeNum(intel.wXG)  * xgFactor,
    fXGA: safeNum(intel.fXGA) * xgaFactor,
    sXGA: safeNum(intel.sXGA) * xgaFactor,
    cor:  safeNum(intel.cor)  * corFactor,
    uiXG:  (safeNum(intel.fXG) * xgFactor).toFixed(2),
    uiXGA: (safeNum(intel.fXGA) * xgaFactor).toFixed(2),
    injuryFactors: { xgFactor, xgaFactor, corFactor },
    absentPlayers
  };
}

function injuryBadgeHTML(intel, teamName) {
  if (!intel?.injuryFactors || !intel?.absentPlayers?.length) return '';
  const { xgFactor, xgaFactor } = intel.injuryFactors;
  const count = intel.absentPlayers.length;
  const severity = (2 - xgFactor - xgaFactor) / 2; 
  const col = severity > 0.25 ? 'var(--accent-red)' : severity > 0.10 ? 'var(--accent-gold)' : 'var(--text-muted)';
  const icon = severity > 0.25 ? '🚨' : severity > 0.10 ? '⚠️' : 'ℹ️';
  const xgPct = ((1 - xgFactor) * 100).toFixed(0);
  const xgaPct = ((1 - xgaFactor) * 100).toFixed(0);

  const playerList = intel.absentPlayers.slice(0, 4).map(p => `<span style="opacity:0.8">${p.name || '?'} (${p.position || '?'})</span>`).join(', ');

  return `
    <div style="margin-top:8px; padding:8px 10px; background:rgba(244,63,94,0.06); border:1px solid rgba(244,63,94,0.2); border-radius:6px; font-size:0.68rem; color:${col}; line-height:1.5;">
      ${icon} <strong>Απόντες (${count}):</strong> ${playerList} ${count > 4 ? `<span style="opacity:0.6">+${count-4} ακόμα</span>` : ''}
      <div style="margin-top:4px; color:var(--text-muted); font-size:0.63rem; font-family:'Fira Code',monospace;">
        xG penalty: <span style="color:var(--accent-red)">-${xgPct}%</span> &nbsp;|&nbsp; xGA penalty: <span style="color:var(--accent-gold)">-${xgaPct}%</span>
      </div>
    </div>`;
}

// ================================================================
//  POISSON ENGINE
// ================================================================
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

function getPoissonMatrixHTML(hLambda, aLambda, maxG=4) {
  const m = getPoissonMatrix(hLambda, aLambda, maxG);
  let html = `<div class="poisson-grid" style="grid-template-columns: 20px repeat(${maxG+1}, 1fr);">`;
  html += `<div class="poisson-cell" style="color:var(--text-muted)"></div>`;
  for(let a = 0; a <= maxG; a++) html += `<div class="poisson-cell" style="color:var(--accent-blue)">${a}</div>`;
  for(let h = 0; h <= maxG; h++) {
    html += `<div class="poisson-cell" style="color:var(--accent-gold)">${h}</div>`;
    for(let a = 0; a <= maxG; a++) {
      const prob = (m[h][a] * 100);
      const intensity = Math.min(prob / 12, 1);
      const r2 = Math.round(14 * (1-intensity) + 16 * intensity);
      const g2 = Math.round(165 * (1-intensity) + 185 * intensity);
      const b2 = Math.round(233 * (1-intensity) + 129 * intensity);
      const textCol = prob > 6 ? '#000' : 'var(--text-main)';
      html += `<div class="poisson-cell" style="background:rgba(${r2},${g2},${b2},${intensity*0.8+0.05});color:${textCol}">${prob.toFixed(1)}%</div>`;
    }
  }
  html += `</div>`;
  return html;
}

// ================================================================
//  API QUEUE ΚΑΙ DATA FETCHING
// ================================================================
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
    const r=await fetch(`${API_BASE}/${path}`,{headers:{'x-apisports-key':API_KEY, 'Accept': 'application/json'}});
    if(r.ok) {
        const data = await r.json();
        if(typeof currentCredits==='number' && data.response){
          currentCredits--; 
          const el = document.getElementById('creditDisplay');
          if(el) el.textContent = currentCredits;
        }
        resolve(data);
    } else {
        resolve({response:[]});
    }
  } catch (error) { 
      resolve({response:[]}); 
  }
  finally { await new Promise(r=>setTimeout(r,REQUEST_GAP_MS)); _apiActiveCount--; _drainQueue(); }
}

window.initCredits = async function() {
  try {
    const r=await fetch(`${API_BASE}/status`,{headers:{'x-apisports-key':API_KEY}});
    if(!r.ok) return;
    const d=await r.json();
    currentCredits=(d.response?.requests?.limit_day||500)-(d.response?.requests?.current||0);
    const el = document.getElementById('creditDisplay');
    if(el) el.textContent = currentCredits;
  } catch {}
}

async function getTStats(t,lg,s){const k=`${t}_${lg}_${s}`;if(teamStatsCache.has(k))return teamStatsCache.get(k);const d=await apiReq(`teams/statistics?team=${t}&league=${lg}&season=${s}`);teamStatsCache.set(k,d?.response||{});return d?.response||{};}
async function getLFix(t,lg,s){const k=`${t}_${lg}_${s}`;if(lastFixCache.has(k))return lastFixCache.get(k);const d=await apiReq(`fixtures?team=${t}&league=${lg}&season=${s}&last=20&status=FT`);lastFixCache.set(k,d?.response||[]);return d?.response||[];}
async function getStand(lg,s){const k=`${lg}_${s}`;if(standCache.has(k))return standCache.get(k);const d=await apiReq(`standings?league=${lg}&season=${s}`);const f=Array.isArray(d?.response?.[0]?.league?.standings)?d.response[0].league.standings.flat():[];standCache.set(k,f);return f;}
const getTeamRank =(st,tId)=>{const r=(st||[]).find(x=>String(x?.team?.id)===String(tId));return r?.rank??null;};

// ================================================================
//  WEIGHTED FORM & XG ESTIMATION (V2.1)
// ================================================================
function weightedRecentXG(fixtures, teamId, leagueAvg = 1.25) {
  const weights = [0.30, 0.25, 0.20, 0.12, 0.08, 0.05];
  let total = 0, wSum = 0;
  fixtures.slice(0, 6).forEach((f, i) => {
    const goals = getTeamGoals(f, teamId);
    const w = weights[i] ?? 0.02;
    total += goals * w;
    wSum  += w;
  });
  const rawWXG = wSum > 0 ? total / wSum : leagueAvg;
  const sampleWeight = Math.min(wSum, 1.0); 
  return rawWXG * sampleWeight + leagueAvg * (1 - sampleWeight);
}

function getFormHistory(fixtures, teamId) {
  return fixtures.map(f => {
    const my = getTeamGoals(f, teamId);
    const op = getOppGoals(f, teamId);
    const oppGoalsFor  = f?.teams?.home?.id === teamId ? (f?.goals?.away ?? 1) : (f?.goals?.home ?? 1);
    const oppGoalsAga  = f?.teams?.home?.id === teamId ? (f?.goals?.home ?? 1) : (f?.goals?.away ?? 1);
    const oppStrength  = clamp((oppGoalsFor + 0.5) / (oppGoalsAga + 0.5), 0.5, 2.0);

    let res, cls, weight;
    if (my > op) { res = 'W'; cls = 'W'; weight = clamp(1.0 + (oppStrength - 1.0) * 0.4, 0.7, 1.6); }
    else if (my < op) { res = 'L'; cls = 'L'; weight = clamp(1.0 - (oppStrength - 1.0) * 0.4, 0.6, 1.4); }
    else { res = 'D'; cls = 'D'; weight = 1.0; }
    return { res, cls, weight: parseFloat(weight.toFixed(2)), gf: my, ga: op };
  }).reverse();
}

function calcFormScore(history) {
  if (!history.length) return 0.5;
  const recencyWeights = [0.30, 0.25, 0.20, 0.12, 0.08, 0.05];
  let score = 0, wSum = 0;
  history.slice().reverse().forEach((h, i) => {
    const rw = recencyWeights[i] ?? 0.02;
    const resultVal = h.res === 'W' ? 1.0 : h.res === 'D' ? 0.5 : 0.0;
    score += resultVal * h.weight * rw;
    wSum  += rw;
  });
  return clamp(score / wSum, 0, 1);
}

function estXG(arr, g=0) {
  const base = (statVal(arr,'Shots on Goal') * engineConfig.wShotsOn)
             + (statVal(arr,'Shots off Goal') * engineConfig.wShotsOff)
             + (statVal(arr,'Corner Kicks')   * engineConfig.wCorners)
             + (g * engineConfig.wGoals);
  return base > 0 ? base : (0.60 + g * 0.25);
}

function devBadge(curr, base) {
  if (!base || base <= 0) return `<span class="dev-badge"></span>`;
  const d = (((parseFloat(curr) - base) / base) * 100).toFixed(1);
  return `<span class="dev-badge ${d >= 0 ? 'dev-pos' : 'dev-neg'}">${d > 0 ? '+' : ''}${d}%</span>`;
}

// ================================================================
//  DATA BUILDERS
// ================================================================
async function batchCalc(list, tId) {
  if (!list.length) return { xg:'0.00', xga:'0.00', cor:'0.0', crd:'0.0' };
  let x=0, xa=0, c=0, cr=0, n=0;
  for (const f of list) {
    // Ελαφριά μέθοδος (fast-scan) για αποφυγή api calls και blocks
    const myGoals = getTeamGoals(f, tId);
    const oppGoals = getOppGoals(f, tId);
    const myEstXG = myGoals > 0 ? myGoals * 1.05 : 0.40;
    const opEstXG = oppGoals > 0 ? oppGoals * 1.05 : 0.40;

    x  += myEstXG;
    xa += opEstXG;
    c  += 4.8; // Static estimate
    cr += 2.1; // Static estimate
    n++;
  }
  return {
    xg:  n > 0 ? (x/n).toFixed(2)  : '0.00',
    xga: n > 0 ? (xa/n).toFixed(2) : '0.00',
    cor: n > 0 ? (c/n).toFixed(1)  : '0.0',
    crd: n > 0 ? (cr/n).toFixed(1) : '0.0'
  };
}

async function buildIntel(tId, lg, s, isHome) {
  const [ss, allFix] = await Promise.all([getTStats(tId, lg, s), getLFix(tId, lg, s)]);
  const gen   = allFix.slice(0, 6);
  const split = allFix.filter(f => (isHome ? f.teams.home.id : f.teams.away.id) === tId).slice(0, 6);
  const [fData, sData] = await Promise.all([batchCalc(gen, tId), batchCalc(split, tId)]);

  const baseXG  = parseFloat(ss?.goals?.for?.average?.total)     || 1.10;
  const baseXGA = parseFloat(ss?.goals?.against?.average?.total) || 1.10;
  let leagueAvg = 1.25;
  if(typeof LEAGUE_AVG_GOALS !== 'undefined' && LEAGUE_AVG_GOALS[lg]) {
      leagueAvg = LEAGUE_AVG_GOALS[lg] / 2;
  }

  const history   = getFormHistory(gen, tId);
  const formScore = calcFormScore(history);
  const wXG       = weightedRecentXG(gen, tId, leagueAvg);

  return {
    fXG:  safeNum(fData.xg),  fXGA:  safeNum(fData.xga),
    sXG:  safeNum(sData.xg),  sXGA:  safeNum(sData.xga),
    wXG,  formScore,
    cor:  safeNum(fData.cor), crd:   safeNum(fData.crd),
    scrd: safeNum(sData.crd || fData.crd),
    uiXG: fData.xg, uiXGA: fData.xga,
    uiDevXG:  devBadge(fData.xg,  baseXG),
    uiDevXGA: devBadge(fData.xga, baseXGA),
    uiSXG: sData.xg, uiSXGA: sData.xga,
    history
  };
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
  return {
    homeWins: hw, awayWins: aw, draws: dr,
    h2hAvgGoals: parseFloat(((hGoals + aGoals) / total).toFixed(2))
  };
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

// ================================================================
//  PICK ENGINE  —  v2.1
// ================================================================
function computePick(hXG, aXG, tXG, bttsScore, cor, totCards, lp, hS, aS, h2h) {
  const hForm = 0.85 + clamp(safeNum(hS?.formScore, 0.5), 0, 1) * 0.30;
  const aForm = 0.85 + clamp(safeNum(aS?.formScore, 0.5), 0, 1) * 0.30;

  const hLambda = clamp(((hXG * 0.45) + (safeNum(hS?.wXG) * 0.30) + (safeNum(aS?.fXGA) * 0.25)) * lp.mult * hForm, 0.15, 4.0);
  const aLambda = clamp(((aXG * 0.45) + (safeNum(aS?.wXG) * 0.30) + (safeNum(hS?.fXGA) * 0.25)) * lp.mult * aForm, 0.15, 4.0);

  const pp = getPoissonProbabilities(hLambda, aLambda);

  const hExp = hLambda, aExp = aLambda;
  const { h: hG_raw, a: aG_raw } = pp.bestScore;
  let hG = hG_raw, aG = aG_raw;

  const xgDiff = hXG - aXG;
  let outPick = "X";
  if (pp.pHome - pp.pAway > 0.15 && xgDiff > lp.xgDiff) outPick = "1";
  else if (pp.pAway - pp.pHome > 0.15 && xgDiff < -lp.xgDiff) outPick = "2";

  if (outPick === "1" && hG <= aG) { hG = aG + 1; }
  if (outPick === "2" && aG <= hG) { aG = hG + 1; }

  const exactConf = Math.round(pp.bestScore.prob * 100 * 8);
  const btts = clamp(safeNum(bttsScore), 0, 2.0);
  const h2hBoost = h2h?.h2hAvgGoals > 2.8 ? 0.03 : 0;

  let omegaPick = "NO BET", reason = "Insufficient statistical edge.", pickScore = 0;

  if (pp.pO35 >= 0.44 && tXG >= lp.minXGO35 && btts >= 1.15 && (hForm + aForm) / 2 >= 1.05) {
    omegaPick = "🚀 OVER 3.5 GOALS";
    pickScore = (pp.pO35 + h2hBoost) * 100;
    reason = `Poisson O3.5: ${(pp.pO35*100).toFixed(1)}% | tXG: ${tXG.toFixed(2)} | Form: ✓`;
  }
  else if (pp.pO25 >= 0.55 && tXG >= lp.minXGO25 && btts >= 0.90) {
    omegaPick = "🔥 OVER 2.5 GOALS";
    pickScore = (pp.pO25 + h2hBoost) * 100;
    reason = `Poisson O2.5: ${(pp.pO25*100).toFixed(1)}% | tXG: ${tXG.toFixed(2)}`;
  }
  else if (pp.pU25 >= 0.58 && tXG <= lp.maxU25 && btts <= engineConfig.tBTTS_U25 && (hForm + aForm) / 2 <= 1.05) {
    omegaPick = "🔒 UNDER 2.5 GOALS";
    pickScore = pp.pU25 * 100;
    reason = `Poisson U2.5: ${(pp.pU25*100).toFixed(1)}% | tXG: ${tXG.toFixed(2)}`;
  }
  else if (btts >= lp.minBTTS && pp.pBTTS >= 0.48 && hXG >= 0.90 && aXG >= 0.90) {
    omegaPick = "🎯 GOAL/GOAL (BTTS)";
    pickScore = pp.pBTTS * 100;
    reason = `Poisson BTTS: ${(pp.pBTTS*100).toFixed(1)}% | hXG: ${hXG.toFixed(2)} aXG: ${aXG.toFixed(2)}`;
  }
  else if (outPick !== "X" && Math.abs(xgDiff) >= lp.xgDiff + 0.10) {
    const outcome  = outPick === "1" ? "🏠 ΑΣΟΣ" : "✈️ ΔΙΠΛΟ";
    const outProb  = outPick === "1" ? pp.pHome : pp.pAway;
    const formOk   = outPick === "1" ? hForm >= 1.0 : aForm >= 1.0;
    if (outProb >= 0.52 && formOk) {
      omegaPick  = outProb >= 0.57 ? `⚡ ${outcome}` : outcome;
      pickScore  = outProb * 100;
      reason = `Poisson ${outPick==='1'?'Home':'Away'}: ${(outProb*100).toFixed(1)}% | xGdiff: ${xgDiff.toFixed(2)}`;
    }
  }
  else if (totCards >= 5.5 && Math.abs(xgDiff) < 0.40) {
    omegaPick = "🟨 OVER 5.5 ΚΑΡΤΕΣ";
    pickScore = totCards * 15;
    reason = `High tension derby | Cards avg: ${totCards.toFixed(1)}`;
  }
  else if (cor >= 10.3) {
    omegaPick = "🚩 OVER 8.5 ΚΟΡΝΕΡ";
    pickScore = cor * 8.5;
    reason = `High corner yield: ${cor.toFixed(1)}`;
  }

  return { omegaPick, reason, pickScore, outPick, hG, aG, hExp, aExp, exactConf, xgDiff, pp };
}

// ================================================================
//  SCANNER & MATCH ANALYSIS
// ================================================================
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
    const cor=Number(hS.cor)+Number(aS.cor), totCards=Number(hS.crd)+Number(aS.crd);
    const h2h = summarizeH2H(h2hFix, m.teams.home.id, m.teams.away.id);

    const result=computePick(hXG,aXG,tXG,bttsScore,cor,totCards,lp,hS,aS,h2h);

    const rec={
      m, fixId:m.fixture.id, ht:m.teams.home.name, at:m.teams.away.name,
      lg:m.league.name, leagueId:m.league.id, scanDate:todayISO(),
      tXG, btts:bttsScore, cor, outPick:result.outPick, xgDiff:result.xgDiff,
      exact:`${result.hG}-${result.aG}`, exactConf:result.exactConf,
      omegaPick:result.omegaPick, strength:result.pickScore, reason:result.reason,
      hExp:result.hExp, aExp:result.aExp, pp:result.pp,
      hr:getTeamRank(stand,m.teams.home.id)??99, ar:getTeamRank(stand,m.teams.away.id)??99,
      isBomb:false, hS, aS, h2h,
      isLockO25:  tXG >= (lp.minXGO25+0.15) && bttsScore >= 1.00,
      isLockBTTS: bttsScore >= (lp.minBTTS+0.05) && tXG >= 2.50,
      isLockU25:  tXG <= (lp.maxU25 - 0.20) && bttsScore <= (engineConfig.tBTTS_U25 - 0.10)
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

    rebuildTopLists(); renderTopSections(); renderSummaryTable();
    showOk(`Scan ολοκληρώθηκε. ${all.length} αγώνες αναλύθηκαν.`);
  } catch(e){ showErr(e.message); }
  finally { isRunning=false; setLoader(false); setBtnsDisabled(false); }
}

// ================================================================
//  UI RENDERING
// ================================================================
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
      <div style="display:flex; align-items:center; gap:16px; padding:12px; background:var(--bg-base); border:1px solid var(--border-light); border-radius:var(--radius-sm); cursor:pointer;">
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

      matchRows+=`<tr>
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

// ================================================================
//  ΑΡΧΙΚΟΠΟΙΗΣΗ - ΕΛΕΓΧΟΣ PIN
// ================================================================
window.addEventListener('DOMContentLoaded', () => {
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
    LEAGUES_DATA.forEach(l=>sel.innerHTML+=`<option value="${l.id}">${l.name}</option>`);
  }
});
