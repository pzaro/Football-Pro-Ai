// ==========================================================================
// APEX OMEGA v5.0 - MASTER ENGINE (All Features Included)
// API, Poisson, Accordion, Audit, Ticker, Live Sync, Bankroll, Export
// ==========================================================================

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
  cfg_tXG_O25:'tXG_O25', cfg_tXG_O35:'tXG_O35', cfg_tXG_U25:'tXG_U25', cfg_tBTTS_U25:'tBTTS_U25',
  cfg_xG_Diff:'xG_Diff', cfg_tBTTS:'tBTTS', cfg_minCorners:'minCorners', cfg_minCards:'minCards',
  cfg_modTrap:'modTrap', cfg_modTight:'modTight', cfg_modGold:'modGold'
};

const _apiQueue=[]; let _apiActiveCount=0; const MAX_CONCURRENT=4; const REQUEST_GAP_MS=350;
let _errTimer=null, _okTimer=null;

// ================================================================
//  UTILITIES & HELPERS
// ================================================================
const safeNum = (x, d=0) => Number.isFinite(Number(x)) ? Number(x) : d;
const clamp = (n,mn,mx) => Math.max(mn, Math.min(mx, n));
const statVal = (arr,type) => parseFloat(String((arr.find(x=>x.type===type)||{}).value||0).replace('%',''))||0;
const getTeamGoals = (f,t) => f?.teams?.home?.id===t?(f?.goals?.home??0):(f?.goals?.away??0);
const getOppGoals = (f,t) => f?.teams?.home?.id===t?(f?.goals?.away??0):(f?.goals?.home??0);
const isLive = s => ["1H","2H","HT","LIVE","ET","BT","P"].includes(s);
const isFinished = s => ["FT","AET","PEN"].includes(s);
const esc = str => String(str??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const todayISO = () => new Date().toISOString().split('T')[0];

function getDatesInRange(s,e) {
  const d=[]; let c=new Date(s), end=new Date(e);
  while(c<=end){ d.push(c.toISOString().split('T')[0]); c.setDate(c.getDate()+1); }
  return d;
}

window.togglePanel = function(panelId,arrowId) {
  const p=document.getElementById(panelId), a=document.getElementById(arrowId);
  if(p.style.display==='none'){ p.style.display='block'; if(a)a.innerText='▲'; }
  else { p.style.display='none'; if(a)a.innerText='▼'; }
};
function setLoader(show,text='') { document.getElementById('loader').style.display=show?'block':'none'; document.getElementById('status').textContent=text; if(!show) document.getElementById('bar').style.width='0%'; }
function setProgress(pct,text='') { document.getElementById('bar').style.width=Math.round(clamp(pct,0,100))+'%'; document.getElementById('status').textContent=text; }
function setBtnsDisabled(d) { ["btnPre","leagueFilter"].forEach(id=>{ const el=document.getElementById(id); if(el)el.disabled=d; }); }
function showErr(msg) { clearTimeout(_errTimer); const box=document.getElementById('errorBox'); if(box) box.innerHTML=`<div style="background:var(--accent-red); color:#fff; padding:12px; border-radius:var(--radius-sm); margin-bottom:15px; font-weight:600;">⚠️ ${esc(msg)}</div>`; _errTimer=setTimeout(()=>box.innerHTML='',6000); }
function showOk(msg) { clearTimeout(_okTimer); const box=document.getElementById('successBox'); if(box) box.innerHTML=`<div style="background:var(--accent-green); color:#000; padding:12px; border-radius:var(--radius-sm); margin-bottom:15px; font-weight:600;">✓ ${esc(msg)}</div>`; _okTimer=setTimeout(()=>box.innerHTML='',4000); }
function clearAlerts() { const e=document.getElementById('errorBox'), s=document.getElementById('successBox'); if(e) e.innerHTML=''; if(s) s.innerHTML=''; }

// ================================================================
//  BANKROLL MANAGER
// ================================================================
window.loadBankroll = function() {
  try { const b = JSON.parse(localStorage.getItem(LS_BANKROLL)); if(b) bankrollData = b; } catch {}
  updateBankrollDisplay();
}
function updateBankrollDisplay() { const el = document.getElementById('bankrollDisplay'); if(el) el.textContent = bankrollData.current > 0 ? `€${bankrollData.current.toFixed(2)}` : 'Set'; }
window.openBankroll = function() { document.getElementById('bankrollModal').style.display = 'flex'; document.getElementById('bankrollInput').value = bankrollData.current || ''; renderBankrollHistory(); }
window.closeBankroll = function() { document.getElementById('bankrollModal').style.display = 'none'; }
window.saveBankroll = function() {
  const val = parseFloat(document.getElementById('bankrollInput').value);
  if(isNaN(val) || val <= 0) { showErr('Εισάγετε έγκυρο ποσό.'); return; }
  if(bankrollData.current !== val) {
    bankrollData.history.unshift({ date: todayISO(), amount: val, prev: bankrollData.current });
    if(bankrollData.history.length > 20) bankrollData.history = bankrollData.history.slice(0, 20);
  }
  bankrollData.current = val;
  try { localStorage.setItem(LS_BANKROLL, JSON.stringify(bankrollData)); } catch {}
  updateBankrollDisplay(); renderBankrollHistory(); showOk(`Bankroll ενημερώθηκε: €${val.toFixed(2)}`);
}
function renderBankrollHistory() {
  const div = document.getElementById('bankrollHistory');
  if(!div) return;
  if(!bankrollData.history.length) { div.innerHTML = ''; return; }
  let html = `<table class="bk-table"><thead><tr><th>Ημερομηνία</th><th>Προηγ.</th><th>Νέο</th></tr></thead><tbody>`;
  bankrollData.history.slice(0, 8).forEach(h => {
    html += `<tr><td>${h.date}</td><td>€${Number(h.prev).toFixed(2)}</td><td>€${Number(h.amount).toFixed(2)}</td></tr>`;
  });
  html += `</tbody></table>`;
  div.innerHTML = html;
}
function kellyStake(winProb, odds) {
  if(!bankrollData.current || bankrollData.current <= 0 || !winProb || !odds || odds <= 1) return null;
  const b = odds - 1; const p = Math.min(Math.max(winProb, 0.01), 0.99); const q = 1 - p;
  const kelly = (b * p - q) / b;
  if(kelly <= 0) return null;
  const stake = bankrollData.current * kelly * 0.25; // 25% Fractional
  return Math.max(0.5, Math.min(stake, bankrollData.current * 0.20));
}

// ================================================================
//  EXPORT / IMPORT
// ================================================================
window.exportData = function() {
  if (!window.scannedMatchesData || !window.scannedMatchesData.length) { showErr("Δεν υπάρχουν δεδομένα."); return; }
  const blob = new Blob([JSON.stringify(window.scannedMatchesData)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `apex_export_${todayISO()}.json`; a.click();
  URL.revokeObjectURL(url); showOk("Τα δεδομένα εξήχθησαν!");
};
window.importData = function(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      window.scannedMatchesData = imported;
      rebuildTopLists(); renderTopSections(); renderSummaryTable();
      showOk(`Εισήχθησαν ${imported.length} αγώνες.`);
    } catch (err) { showErr("Σφάλμα αρχείου."); }
    event.target.value = '';
  };
  reader.readAsText(file);
};

// ================================================================
//  POISSON & MATH
// ================================================================
function normalCDF(z) {
  if(z < -6) return 0; if(z > 6) return 1;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t*(0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429))));
  const pdf  = Math.exp(-0.5*z*z)/Math.sqrt(2*Math.PI);
  const p    = 1 - pdf * poly;
  return z >= 0 ? p : 1 - p;
}

function poissonProb(lambda, k) {
  if(lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for(let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function getPoissonProbabilities(hLambda, aLambda) {
  const m = []; let pHome=0, pDraw=0, pAway=0, pO25=0, pO35=0, pU25=0, pBTTS=0;
  let bestScore = { h:1, a:1, prob: 0 };
  for(let h=0; h<=6; h++) {
    m[h] = [];
    for(let a=0; a<=6; a++) {
      const p = poissonProb(hLambda, h) * poissonProb(aLambda, a);
      m[h][a] = p;
      if(h > a) pHome+=p; else if(h < a) pAway+=p; else pDraw+=p;
      if(h+a > 2.5) pO25+=p;
      if(h+a > 3.5) pO35+=p;
      if(h+a < 2.5) pU25+=p;
      if(h>0 && a>0) pBTTS+=p;
      if(p > bestScore.prob) bestScore = { h, a, prob: p };
    }
  }
  return { pHome, pDraw, pAway, pO25, pO35, pU25, pBTTS, bestScore, matrix: m };
}

// ================================================================
//  API SYSTEM
// ================================================================
async function apiReq(path) { return new Promise(resolve=>{ _apiQueue.push({path,resolve}); _drainQueue(); }); }
async function _drainQueue() {
  while(_apiActiveCount<MAX_CONCURRENT && _apiQueue.length>0) {
    const {path,resolve} = _apiQueue.shift();
    _apiActiveCount++; _executeRequest(path,resolve);
  }
}
async function _executeRequest(path,resolve) {
  await new Promise(r=>setTimeout(r,Math.random()*100));
  try {
    const r=await fetch(`${API_BASE}/${path}`,{headers:{'x-apisports-key':API_KEY, 'Accept': 'application/json'}});
    if(r.ok) {
        const data = await r.json();
        if(data.response && typeof currentCredits==='number') {
          currentCredits--; const el = document.getElementById('creditDisplay'); if(el) el.textContent = currentCredits;
        }
        resolve(data);
    } else { resolve({response:[]}); }
  } catch (error) { resolve({response:[]}); }
  finally { await new Promise(r=>setTimeout(r,REQUEST_GAP_MS)); _apiActiveCount--; _drainQueue(); }
}

window.initCredits = async function() {
  try {
    const r=await fetch(`${API_BASE}/status`,{headers:{'x-apisports-key':API_KEY}});
    if(r.ok) {
      const d=await r.json();
      currentCredits=(d.response?.requests?.limit_day||500)-(d.response?.requests?.current||0);
      const el = document.getElementById('creditDisplay'); if(el) el.textContent = currentCredits;
    }
  } catch(e) {}
}

async function getTStats(t,lg,s){const k=`${t}_${lg}_${s}`;if(teamStatsCache.has(k))return teamStatsCache.get(k);const d=await apiReq(`teams/statistics?team=${t}&league=${lg}&season=${s}`);teamStatsCache.set(k,d?.response||{});return d?.response||{};}
async function getLFix(t,lg,s){const k=`${t}_${lg}_${s}`;if(lastFixCache.has(k))return lastFixCache.get(k);const d=await apiReq(`fixtures?team=${t}&league=${lg}&season=${s}&last=20&status=FT`);lastFixCache.set(k,d?.response||[]);return d?.response||[];}
async function getStand(lg,s){const k=`${lg}_${s}`;if(standCache.has(k))return standCache.get(k);const d=await apiReq(`standings?league=${lg}&season=${s}`);const f=Array.isArray(d?.response?.[0]?.league?.standings)?d.response[0].league.standings.flat():[];standCache.set(k,f);return f;}

// ================================================================
//  STATISTICS & INTEL BUILDER
// ================================================================
async function batchCalc(list, tId) {
  if (!list || !list.length) return { xg: '1.10', xga: '1.10', cor: '4.5', crd: '2.0', corRatio: '3.5' };
  let totalXG = 0, totalXGA = 0, n = 0;
  for (const f of list) {
    const myGoals = getTeamGoals(f, tId); const oppGoals = getOppGoals(f, tId);
    totalXG += (myGoals > 0 ? myGoals * 1.10 : 0.40); 
    totalXGA += (oppGoals > 0 ? oppGoals * 1.10 : 0.40);
    n++;
  }
  const avgXG = n > 0 ? totalXG / n : 0;
  return { xg: n > 0 ? avgXG.toFixed(2) : '1.10', xga: n > 0 ? (totalXGA / n).toFixed(2) : '1.10', cor: '4.8', crd: '2.1', corRatio: '3.5' };
}

function getFormHistory(fixtures,teamId) { return fixtures.map(f=>{ const my=getTeamGoals(f,teamId),op=getOppGoals(f,teamId); return my>op?{res:'W',cls:'W'}:(my<op?{res:'L',cls:'L'}:{res:'D',cls:'D'}); }).reverse(); }
function getFormRating(hist) {
  if(!hist||!hist.length) return 50;
  const weights=[1,0.8,0.6,0.4,0.2]; let score=0,totalWeight=0;
  hist.slice(0,5).forEach((h,i)=>{ const w=weights[i]||0.1,pts=h.res==='W'?100:(h.res==='D'?33:0); score+=pts*w; totalWeight+=w; });
  return totalWeight>0?Math.round(score/totalWeight):50;
}

async function buildIntel(tId,lg,s,isHome) {
  try {
    const [ss, allFix] = await Promise.all([getTStats(tId, lg, s), getLFix(tId, lg, s)]);
    const gen = allFix.slice(0,6); const split = allFix.filter(f=>(isHome?f.teams.home.id:f.teams.away.id)===tId).slice(0,6);
    const [fData,sData] = await Promise.all([batchCalc(gen,tId),batchCalc(split,tId)]);
    
    const seasonXG = parseFloat(ss?.goals?.for?.average?.total) || 1.35;
    const seasonXGA = parseFloat(ss?.goals?.against?.average?.total) || 1.35;
    
    return {
      fXG: Math.max(fData.xg !== null ? safeNum(fData.xg) : seasonXG, 0.85),
      fXGA: Math.max(fData.xga !== null ? safeNum(fData.xga) : seasonXGA, 0.85),
      sXG: Math.max(sData.xg !== null ? safeNum(sData.xg) : seasonXG, 0.85),
      formRating: getFormRating(getFormHistory(gen,tId)),
      corRatio: safeNum(fData.corRatio, 3.5), cor: safeNum(fData.cor, 4.5), crd: safeNum(fData.crd, 2.0),
      uiXG: fData.xg, uiXGA: fData.xga, uiSXG: sData.xg, uiSXGA: sData.xga, // ΕΔΩ ΕΙΝΑΙ ΤΟ UI FIX ΣΟΥ!
      history: getFormHistory(gen,tId)
    };
  } catch { return {fXG:1.35,fXGA:1.35,sXG:1.35,formRating:50,corRatio:3.5,cor:4.5,crd:2.0, uiXG:'1.35', uiXGA:'1.35', uiSXG:'1.35', uiSXGA:'1.35', history:[]}; }
}

function summarizeH2H(fixtures, homeId, awayId) {
  let hw=0, aw=0, dr=0, hGoals=0, aGoals=0;
  for (const f of (fixtures || []).slice(0, 8)) {
    const hg = f?.goals?.home ?? 0, ag = f?.goals?.away ?? 0;
    const myG = f?.teams?.home?.id === homeId ? hg : ag; const opG = f?.teams?.home?.id === awayId ? hg : ag;
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
    mult: lm.mult !== undefined ? lm.mult : defaultMult,
    minXGO25: lm.minXGO25 !== undefined ? lm.minXGO25 : engineConfig.tXG_O25,
    minXGO35: lm.minXGO35 !== undefined ? lm.minXGO35 : engineConfig.tXG_O35,
    maxU25: lm.maxU25 !== undefined ? lm.maxU25 : engineConfig.tXG_U25,
    minBTTS: lm.minBTTS !== undefined ? lm.minBTTS : engineConfig.tBTTS,
    xgDiff: lm.xgDiff !== undefined ? lm.xgDiff : defaultXgDiff
  };
}

function computeCornerConfidence(hS, aS, hXG, aXG) {
  const expectedHomeCorners = hXG * safeNum(hS.corRatio, 3.5);
  const expectedAwayCorners = aXG * safeNum(aS.corRatio, 3.5);
  let expCor = expectedHomeCorners + expectedAwayCorners;
  const xgDiff = Math.abs(hXG - aXG);
  expCor += xgDiff > 0.8 ? clamp((xgDiff - 0.8) * 1.5, 0, 2.0) : 0;
  const z = (8.5 - expCor) / (Math.sqrt(expCor) * 0.85); 
  let score = (1 - normalCDF(z)) * 100;
  const baseCor = safeNum(hS.cor, 4.5) + safeNum(aS.cor, 4.5);
  if (baseCor < engineConfig.minCorners) score -= (engineConfig.minCorners - baseCor) * 8;
  return clamp(score, 0, 99);
}

function computePick(hXG, aXG, tXG, btts, lp, hS, aS) {
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
    const outcome = outPick === "1" ? "🏠 ΑΣΟΣ" : "✈️ ΔΙΠΛΟ";
    const outProb = outPick === "1" ? pp.pHome : pp.pAway;
    const formOk  = outPick === "1" ? hS.formRating >= 40 : aS.formRating >= 40;
    if (outProb >= 0.52 && formOk) {
      omegaPick = outProb >= 0.60 ? `⚡ ${outcome}` : outcome; pickScore = outProb * 100; reason = `Poisson ${outPick==='1'?'Home':'Away'}: ${(outProb*100).toFixed(1)}%`;
    }
  }
  else if(cornerConf >= 65) {
    omegaPick = "🚩 OVER 8.5 ΚΟΡΝΕΡ"; pickScore = cornerConf; reason = `Corners/xG Model: ${cornerConf.toFixed(1)}%`;
  }

  const exactConf = Math.round(clamp(pp.bestScore.prob * 100 * 8, 0, 99));
  return { omegaPick, reason, pickScore, outPick, hG: pp.bestScore.h, aG: pp.bestScore.a, hExp:hLambda, aExp:aLambda, exactConf, xgDiff, pp };
}

// ================================================================
//  SCANNER
// ================================================================
async function analyzeMatchSafe(m, index, total) {
  try {
    setProgress(10+((index+1)/total)*88, `Processing: ${m.teams.home.name}`);
    const [hS,aS,stand,h2hFix] = await Promise.all([
      buildIntel(m.teams.home.id,m.league.id,m.league.season,true),
      buildIntel(m.teams.away.id,m.league.id,m.league.season,false),
      getStand(m.league.id,m.league.season),
      getHeadToHead(m.teams.home.id, m.teams.away.id, m.league.id, m.league.season)
    ]);

    const lp=getLeagueParams(m.league.id);
    const hXG=Number(hS.fXG)*lp.mult, aXG=Number(aS.fXG)*lp.mult;
    const tXG=hXG+aXG, bttsScore=Math.min(hXG,aXG);
    const result=computePick(hXG,aXG,tXG,bttsScore, lp, hS, aS);

    window.scannedMatchesData.push({
      m, fixId:m.fixture.id, ht:m.teams.home.name, at:m.teams.away.name, lg:m.league.name, leagueId:m.league.id,
      tXG, btts:bttsScore, outPick:result.outPick, xgDiff:result.xgDiff, exact:`${result.hG}-${result.aG}`, exactConf:result.exactConf,
      omegaPick:result.omegaPick, strength:result.pickScore, reason:result.reason, hExp:result.hExp, aExp:result.aExp, pp:result.pp,
      hr:getTeamRank(stand,m.teams.home.id)??99, ar:getTeamRank(stand,m.teams.away.id)??99, isBomb:false, hS, aS,
      h2h: summarizeH2H(h2hFix, m.teams.home.id, m.teams.away.id)
    });
  } catch(err) {
    window.scannedMatchesData.push({ m, fixId:m.fixture.id, ht:m.teams.home.name, at:m.teams.away.name, lg:m.league.name, leagueId:m.league.id, omegaPick:"NO BET", reason:"Analysis error", strength:0, tXG:0, outPick:"X", exact:"0-0" });
  }
}

window.runScan = async function() {
  if(isRunning) return;
  const startD=document.getElementById('scanStart').value||todayISO(); const endD=document.getElementById('scanEnd').value||startD;
  if(new Date(endD)<new Date(startD)){ showErr("Invalid Date"); return; }
  isRunning=true; clearAlerts(); setBtnsDisabled(true); setLoader(true,'Initializing Deep Quant...');
  ['topSection','summarySection'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=''; });
  window.scannedMatchesData=[]; teamStatsCache.clear(); lastFixCache.clear(); standCache.clear(); h2hCache.clear();

  try {
    let dates = getDatesInRange(startD,endD); let all=[]; const selLg=document.getElementById('leagueFilter').value;
    for(let i=0;i<dates.length;i++){
      const res=await apiReq(`fixtures?date=${dates[i]}`);
      const dm=(res.response||[]).filter(m=>{
        if(selLg==='WORLD') return true;
        if(selLg==='ALL') return typeof LEAGUE_IDS!=='undefined' && LEAGUE_IDS.includes(m.league.id);
        if(selLg==='MY_LEAGUES') return typeof MY_LEAGUES_IDS!=='undefined' && MY_LEAGUES_IDS.includes(m.league.id);
        return m.league.id===parseInt(selLg);
      });
      all.push(...dm); if(all.length>350) break;
    }
    if(!all.length){showErr('Δεν βρέθηκαν αγώνες.');return;}
    for(let i=0;i<all.length;i++) await analyzeMatchSafe(all[i],i,all.length);
    saveToVault(window.scannedMatchesData);
    rebuildTopLists(); renderTopSections(); renderSummaryTable();
    showOk(`Scan ολοκληρώθηκε.`);
  } catch(e){ showErr(e.message); }
  finally { isRunning=false; setLoader(false); setBtnsDisabled(false); }
}

// ================================================================
//  SMART AUDIT & VAULT
// ================================================================
function saveToVault(data) {
  try {
    let store = JSON.parse(localStorage.getItem(LS_PREDS) || "[]");
    const map = new Map(store.map(x => [String(x.fixtureId), x]));
    data.forEach(d => {
      map.set(String(d.fixId), {
        fixtureId: d.fixId, date: d.m.fixture.date, leagueId: d.leagueId, league: d.lg,
        homeTeam: d.ht, awayTeam: d.at, outPick: d.outPick, exactScorePred: d.exact,
        predOver25: d.omegaPick.includes('OVER 2')||d.omegaPick.includes('OVER 3'),
        predOver35: d.omegaPick.includes('OVER 3'), predUnder25: d.omegaPick.includes('UNDER 2.5'),
        predBTTS: d.omegaPick.includes('GOAL'), omegaPick: d.omegaPick
      });
    });
    localStorage.setItem(LS_PREDS, JSON.stringify(Array.from(map.values())));
  } catch(e) {}
}

window.clearVault = function() { if(confirm("Purge all data?")){ localStorage.removeItem(LS_PREDS); showOk("Vault Purged."); } }

window.runCustomAudit = async function() {
  const s=document.getElementById('auditStart').value, e=document.getElementById('auditEnd').value;
  if(!s||!e){ showErr('Select date range.'); return; }
  setLoader(true,'Auditing...'); setBtnsDisabled(true);
  try {
    const store = JSON.parse(localStorage.getItem(LS_PREDS)||"[]");
    const endD = new Date(e); endD.setDate(endD.getDate()+1);
    let cands = store.filter(x=>{ const d=new Date(x.date); return d>=new Date(s) && d<endD; });
    const lgFilter=document.getElementById('auditLeague')?.value || 'ALL';
    if(lgFilter !== 'ALL') cands = cands.filter(x=>String(x.leagueId)===lgFilter);
    
    let stats={games:0, o25Tot:0, o25Hit:0};
    for(let i=0;i<cands.length;i++){
      const fr=await apiReq(`fixtures?id=${cands[i].fixtureId}`); const fix=fr?.response?.[0];
      if(!fix || !isFinished(fix?.fixture?.status?.short)) continue;
      stats.games++;
      const atot = safeNum(fix.goals.home) + safeNum(fix.goals.away);
      if(cands[i].predOver25){ stats.o25Tot++; if(atot>2.5) stats.o25Hit++; }
    }
    const html = `<div class="quant-panel"><h4>Audit Results</h4><p>Games: ${stats.games} | O2.5 Hit Rate: ${(stats.o25Tot>0?(stats.o25Hit/stats.o25Tot)*100:0).toFixed(1)}%</p></div>`;
    document.getElementById('auditSection').innerHTML = html;
  } catch(e) {} finally { setLoader(false); setBtnsDisabled(false); }
}

// ================================================================
//  LIVE TICKER / AUTO SYNC
// ================================================================
let _liveAutoInterval = null;
window.syncLiveScores = async function() {
  const res = await apiReq('fixtures?live=all'); const liveFix = res.response || [];
  if (!liveFix.length) return;
  const liveMap = new Map(liveFix.map(f => [f.fixture.id, f]));
  window.scannedMatchesData.forEach(d => {
    if(liveMap.has(d.fixId)) { d.m.goals = liveMap.get(d.fixId).goals; d.m.fixture.status = liveMap.get(d.fixId).fixture.status; }
  });
  renderSummaryTable();
};
window.startAutoSync = function() {
  if (_liveAutoInterval) clearInterval(_liveAutoInterval);
  _liveAutoInterval = setInterval(window.syncLiveScores, 90000);
}

// ================================================================
//  ACCORDION UI RENDERING
// ================================================================
window.toggleMatchDetails = function(id) {
  const el = document.getElementById('details-' + id);
  if(el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

function renderSummaryTable() {
  const sec = document.getElementById('summarySection'); if(!sec) return;
  const sd = window.scannedMatchesData; if(!sd.length) { sec.innerHTML=''; return; }

  let matchRows = '';
  const grouped={};
  sd.forEach((d,i)=>{ if(!grouped[d.lg]) grouped[d.lg]=[]; grouped[d.lg].push({...d,originalIndex:i}); });
  
  for(const[lg,matches] of Object.entries(grouped)){
    matchRows+=`<div style="background:rgba(14,165,233,0.05);padding:7px 16px;font-weight:700;font-size:0.72rem;color:var(--accent-blue);border-top:1px solid var(--border-light);border-bottom:1px solid var(--border-light);text-transform:uppercase;">${esc(lg)}</div>
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
      const scoreStr=isFin||isLiveNow?`${ah}-${aa}`:'-';
      const colOm=x.omegaPick?.includes('NO BET')?'var(--text-muted)':'var(--text-main)';
      const conf=Math.min(Math.max(safeNum(x.strength),0),100);

      let phtml = '';
      if(x.pp) {
        phtml = `<div class="poisson-grid" style="grid-template-columns: repeat(6, 1fr); gap: 2px; margin-top: 10px; width: 300px; margin-left: auto; margin-right: auto;">`;
        phtml += `<div class="poisson-cell" style="color:var(--text-muted)"></div>`;
        for(let a=0; a<=4; a++) phtml += `<div class="poisson-cell" style="color:var(--accent-blue)">${a}</div>`;
        for(let h=0; h<=4; h++) {
          phtml += `<div class="poisson-cell" style="color:var(--accent-gold)">${h}</div>`;
          for(let a=0; a<=4; a++) {
            const prob = (x.pp.matrix[h][a] * 100);
            phtml += `<div class="poisson-cell" style="background:rgba(56,189,248,${prob/12});color:${prob>6?'#000':'var(--text-main)'}">${prob.toFixed(1)}%</div>`;
          }
        }
        phtml += `</div>`;
      }

      matchRows+=`<tr onclick="toggleMatchDetails('${x.fixId}')" style="cursor:pointer;" title="Πατήστε για να δείτε την ανάλυση">
        <td class="col-match" style="font-weight:600;color:var(--text-main);">${esc(x.ht)} <span style="color:var(--text-muted)">–</span> ${esc(x.at)}</td>
        <td class="col-score data-num" style="color:${isLiveNow?'var(--accent-green)':'var(--text-main)'};">${scoreStr}</td>
        <td class="col-1x2 data-num">${x.outPick}</td>
        <td class="col-o25 data-num">${x.omegaPick.includes('OVER 2')?'🔥':'-'}</td>
        <td class="col-u25 data-num">${x.omegaPick.includes('UNDER 2')?'🔒':'-'}</td>
        <td class="col-btts data-num">${x.omegaPick.includes('GOAL')?'🎯':'-'}</td>
        <td class="col-exact data-num">${x.exact||'?-?'}</td>
        <td class="col-conf data-num" style="color:${conf>=65?'var(--accent-green)':conf>=45?'var(--accent-gold)':'var(--text-muted)'};">${conf.toFixed(0)}%</td>
        <td class="col-signal" style="font-size:0.68rem;color:${colOm};font-weight:800;">${x.omegaPick?.split(' ').slice(0,3).join(' ')||'-'}</td>
      </tr>
      
      <tr id="details-${x.fixId}" style="display:none; background:rgba(0,0,0,0.25);">
        <td colspan="9" style="padding: 20px; text-align:left; border-bottom:1px solid var(--border-light);">
          <div style="display:flex; justify-content:space-around; gap:20px; flex-wrap:wrap;">
            
            <div style="flex:1; min-width:250px; background:var(--bg-base); padding:15px; border-radius:8px; border:1px solid var(--border-light);">
              <h4 style="color:var(--text-muted); margin-bottom:10px; font-size:0.75rem; text-transform:uppercase;">Home vs Away Breakdown</h4>
              <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Form xG</span><span class="data-num">${x.hS?.uiXG} vs ${x.aS?.uiXG}</span></div>
              <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Split xG</span><span class="data-num">${x.hS?.uiSXG} vs ${x.aS?.uiSXG}</span></div>
              <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Exp. Cards</span><span class="data-num">${Number(x.hS?.crd||0).toFixed(1)} vs ${Number(x.aS?.crd||0).toFixed(1)}</span></div>
              <div style="display:flex; justify-content:space-between; margin-bottom:5px; color:var(--text-muted);"><span>H2H (Last 8)</span><span class="data-num">${x.h2h?`${x.h2h.homeWins}W - ${x.h2h.draws}D - ${x.h2h.awayWins}W`:'N/A'}</span></div>
            </div>

            <div style="flex:1; min-width:250px; background:var(--bg-base); padding:15px; border-radius:8px; border:1px solid var(--border-light);">
              <h4 style="color:var(--text-muted); margin-bottom:10px; font-size:0.75rem; text-transform:uppercase;">Game Projections</h4>
              <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Lambda xG</span><span class="data-num" style="color:var(--accent-blue)">${Number(x.hExp).toFixed(2)} - ${Number(x.aExp).toFixed(2)}</span></div>
              <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>xG Diff</span><span class="data-num">${Number(x.xgDiff).toFixed(2)}</span></div>
              <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Poisson O2.5</span><span class="data-num" style="color:var(--accent-blue)">${x.pp ? (x.pp.pO25*100).toFixed(1)+'%' : '—'}</span></div>
              <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Poisson U2.5</span><span class="data-num" style="color:var(--accent-teal)">${x.pp ? (x.pp.pU25*100).toFixed(1)+'%' : '—'}</span></div>
            </div>

            <div style="flex:1; min-width:320px; background:var(--bg-base); padding:15px; border-radius:8px; border:1px solid var(--border-light);">
              <h4 style="color:var(--text-muted); text-align:center; margin-bottom:5px; font-size:0.75rem; text-transform:uppercase;">📊 Poisson Score Matrix</h4>
              ${phtml}
            </div>

          </div>
        </td>
      </tr>`;
    });
    matchRows+=`</tbody></table></div>`;
  }
  sec.innerHTML = matchRows;
}

function rebuildTopLists() {
  const sd = window.scannedMatchesData || [];
  latestTopLists.combo1   = sd.filter(x=>x.omegaPick&&x.omegaPick.includes('⚡')).sort((a,b)=>(b.strength||0)-(a.strength||0)).slice(0,5);
  latestTopLists.outcomes = sd.filter(x=>x.omegaPick&&(x.omegaPick.includes('ΑΣΟΣ')||x.omegaPick.includes('ΔΙΠΛΟ'))).sort((a,b)=>(b.strength||0)-(a.strength||0)).slice(0,5);
  latestTopLists.exact    = [...sd].filter(x=>x.exactConf).sort((a,b)=>(b.exactConf||0)-(a.exactConf||0)).slice(0,5);
  latestTopLists.over25   = sd.filter(x=>x.omegaPick&&x.omegaPick.includes('OVER 2.5')).sort((a,b)=>(b.strength||0)-(a.strength||0)).slice(0,5);
}
function renderTopSections() {
  const t = document.getElementById('topSection'); if(t) t.innerHTML = '';
}

// ================================================================
//  SETTINGS & INIT
// ================================================================
window.loadSettings = function() {
  try { const s=JSON.parse(localStorage.getItem(LS_SETTINGS)); if(s) engineConfig={...DEFAULT_SETTINGS,...s}; } catch {}
  for(const [id,key] of Object.entries(SETTINGS_MAP)) { const el=document.getElementById(id); if(el) el.value=engineConfig[key]; }
}
window.saveSettings = function() {
  for(const [id,key] of Object.entries(SETTINGS_MAP)) { const v=parseFloat(document.getElementById(id)?.value); if(!isNaN(v)) engineConfig[key]=v; }
  try { localStorage.setItem(LS_SETTINGS, JSON.stringify(engineConfig)); } catch {}
  showOk("Global Parameters Saved!");
}

window.addEventListener('DOMContentLoaded', () => {
  const pinInput = document.getElementById('pin');
  if (pinInput) {
    pinInput.addEventListener('input', function() {
      if(this.value === "106014") {
        document.getElementById('auth').style.display = 'none';
        document.getElementById('app').style.display  = 'block';
        if(typeof loadSettings === 'function') loadSettings();
        if(typeof loadBankroll === 'function') loadBankroll();
        if(typeof initCredits === 'function') initCredits();
        if(typeof startAutoSync === 'function') startAutoSync();
      }
    });
  }
});
