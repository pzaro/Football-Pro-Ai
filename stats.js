// stats.js - Στατιστική Ανάλυση, Μοντέλο Poisson & Pick Engine

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
  cfg_xG_Diff:'xG_Diff',   cfg_tBTTS:'tBTTS', cfg_minCorners:'minCorners', cfg_minCards:'minCards'
};

const _apiQueue=[]; let _apiActiveCount=0; const MAX_CONCURRENT=8; const REQUEST_GAP_MS=260;
let _errTimer=null, _okTimer=null;

// --- Βοηθητικές Μαθηματικές Συναρτήσεις ---
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

// UI Helpers
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
function setBtnsDisabled(d) { ["btnPre","leagueFilter"].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=d;}); }
function showErr(msg) { clearTimeout(_errTimer); const box=document.getElementById('errorBox'); box.innerHTML=`<div style="background:var(--accent-red); color:#fff; padding:12px; border-radius:var(--radius-sm); margin-bottom:15px; font-weight:600; box-shadow:0 4px 12px rgba(244,63,94,0.3);">⚠️ ${esc(msg)}</div>`; _errTimer=setTimeout(()=>box.innerHTML='',8000); }
function showOk(msg) { clearTimeout(_okTimer); const box=document.getElementById('successBox'); box.innerHTML=`<div style="background:var(--accent-green); color:#000; padding:12px; border-radius:var(--radius-sm); margin-bottom:15px; font-weight:600; box-shadow:0 4px 12px rgba(16,185,129,0.3);">✓ ${esc(msg)}</div>`; _okTimer=setTimeout(()=>box.innerHTML='',4000); }
function clearAlerts() { document.getElementById('errorBox').innerHTML=''; document.getElementById('successBox').innerHTML=''; }

// Settings
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
window.saveLeagueMods = function() { showOk("League Mods saved locally (mock)."); }
function buildLeagueModTable() {
  const tbody = document.getElementById('leagueModBody'); if(!tbody) return; tbody.innerHTML='';
  LEAGUES_DATA.forEach(l => {
    let placeholderDiff = engineConfig.xG_Diff.toFixed(2);
    if(TIGHT_LEAGUES.has(l.id)) placeholderDiff = "0.35";
    else if(GOLD_LEAGUES.has(l.id)) placeholderDiff = "0.65";
    tbody.innerHTML += `<tr><td class="left-align" style="font-weight:700;color:var(--text-main);font-size:0.8rem">${l.name}</td><td><input type="number" step="0.01" placeholder="${engineConfig.modGold.toFixed(2)}" class="league-mod-input"></td><td><input type="number" step="0.05" placeholder="${engineConfig.tXG_O25.toFixed(2)}" class="league-mod-input"></td><td><input type="number" step="0.05" placeholder="${engineConfig.tXG_O35.toFixed(2)}" class="league-mod-input"></td><td><input type="number" step="0.05" placeholder="${engineConfig.tXG_U25.toFixed(2)}" class="league-mod-input"></td><td><input type="number" step="0.05" placeholder="${engineConfig.tBTTS.toFixed(2)}" class="league-mod-input"></td><td><input type="number" step="0.05" placeholder="${placeholderDiff}" class="league-mod-input"></td><td>—</td></tr>`;
  });
}

// Bankroll
window.loadBankroll = function() { try { const b = JSON.parse(localStorage.getItem(LS_BANKROLL)); if(b) bankrollData = b; } catch {} updateBankrollDisplay(); }
function updateBankrollDisplay() { const el = document.getElementById('bankrollDisplay'); if(el) el.textContent = bankrollData.current > 0 ? `€${bankrollData.current.toFixed(2)}` : 'Set'; }
window.openBankroll = function() { document.getElementById('bankrollModal').style.display = 'flex'; document.getElementById('bankrollInput').value = bankrollData.current || ''; }
window.closeBankroll = function() { document.getElementById('bankrollModal').style.display = 'none'; }
window.saveBankroll = function() {
  const val = parseFloat(document.getElementById('bankrollInput').value);
  if(isNaN(val) || val <= 0) { showErr('Μη έγκυρο ποσό.'); return; }
  bankrollData.current = val;
  try { localStorage.setItem(LS_BANKROLL, JSON.stringify(bankrollData)); } catch {}
  updateBankrollDisplay(); closeBankroll(); showOk(`Bankroll: €${val.toFixed(2)}`);
}
function kellyStake(winProb, odds) {
  if(!bankrollData.current || bankrollData.current<=0 || !winProb || !odds || odds<=1) return null;
  const b=odds-1, p=Math.min(Math.max(winProb,0.01),0.99), q=1-p;
  const kelly = (b*p - q) / b;
  if(kelly<=0) return null;
  const stake = bankrollData.current * kelly * 0.25;
  return Math.max(0.5, Math.min(stake, bankrollData.current*0.20));
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
      if(h > a) pHome += p;
      else if(h < a) pAway += p;
      else pDraw += p;
      
      if(h + a > 2.5) pO25 += p;
      if(h + a > 3.5) pO35 += p;
      if(h + a < 2.5) pU25 += p;
      if(h > 0 && a > 0) pBTTS += p;
      
      if(p > bestScore.prob) {
        bestScore = { h, a, prob: p };
      }
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

// API QUEUE SYSTEM
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
    const r=await fetch(`${API_BASE}/${path}`,{headers:{'x-apisports-key':API_KEY}});
    if(typeof currentCredits==='number'){currentCredits--; document.getElementById('creditDisplay').textContent=currentCredits;}
    resolve(r.ok ? await r.json() : {response:[]});
  } catch { resolve({response:[]}); }
  finally { await new Promise(r=>setTimeout(r,REQUEST_GAP_MS)); _apiActiveCount--; _drainQueue(); }
}

window.initCredits = async function() {
  try {
    const r=await fetch(`${API_BASE}/status`,{headers:{'x-apisports-key':API_KEY}});
    const d=await r.json();
    currentCredits=(d.response?.requests?.limit_day||500)-(d.response?.requests?.current||0);
    document.getElementById('creditDisplay').textContent=currentCredits;
  } catch {}
}

async function getLFix(t,lg,s){const k=`${t}_${lg}_${s}`;if(lastFixCache.has(k))return lastFixCache.get(k);const d=await apiReq(`fixtures?team=${t}&league=${lg}&season=${s}&last=20&status=FT`);lastFixCache.set(k,d?.response||[]);return d?.response||[];}
async function getStand(lg,s){const k=`${lg}_${s}`;if(standCache.has(k))return standCache.get(k);const d=await apiReq(`standings?league=${lg}&season=${s}`);const f=Array.isArray(d?.response?.[0]?.league?.standings)?d.response[0].league.standings.flat():[];standCache.set(k,f);return f;}
const getTeamRank =(st,tId)=>{const r=(st||[]).find(x=>String(x?.team?.id)===String(tId));return r?.rank??null;};

// ----------------------------------------------------------------
// Το νέο σύστημα Στάθμισης Κόρνερ ανά xG
// ----------------------------------------------------------------
async function batchCalc(list, tId) {
  if (!list.length) return { xg:'0.00', xga:'0.00', cor:'4.5', crd:'2.0', corRatio: '3.5' };
  let x=0, xa=0, c=0, n=0;
  for (const f of list) {
    const myGoals = getTeamGoals(f, tId);
    const oppGoals = getOppGoals(f, tId);
    const myXG = myGoals > 0 ? myGoals * 1.10 : 0.40; 
    const oppXG = oppGoals > 0 ? oppGoals * 1.10 : 0.40;
    
    // Επειδή τρέχουμε fast-scan, δίνουμε στατικό corner estimation
    c += 4.8;
    x += myXG; xa += oppXG; n++;
  }
  
  const avgXG = n > 0 ? x / n : 0;
  const avgCor = n > 0 ? c / n : 0;
  const corRatio = avgXG > 0 ? avgCor / Math.max(avgXG, 0.5) : 3.5;

  return {
    xg:  n > 0 ? avgXG.toFixed(2)  : '1.10',
    xga: n > 0 ? (xa/n).toFixed(2) : '1.10',
    cor: '4.8',
    crd: '2.1',
    corRatio: corRatio.toFixed(2) 
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
    const allFix = await getLFix(tId,lg,s);
    const gen = allFix.slice(0,6);
    const split = allFix.filter(f=>(isHome?f.teams.home.id:f.teams.away.id)===tId).slice(0,6);
    const [fData,sData] = await Promise.all([batchCalc(gen,tId),batchCalc(split,tId)]);
    
    const seasonXG = 1.35; const seasonXGA = 1.35;
    const history = getFormHistory(gen,tId);
    const formRating = getFormRating(history);
    
    const final_fXG = Math.max(fData.xg !== null ? safeNum(fData.xg) : seasonXG, 0.85);
    const final_fXGA = Math.max(fData.xga !== null ? safeNum(fData.xga) : seasonXGA, 0.85);

    return {
      fXG: final_fXG, fXGA: final_fXGA, formRating,
      corRatio: safeNum(fData.corRatio, 3.5), // Φέρνουμε το νέο ratio
      cor: safeNum(fData.cor, 4.5), crd: safeNum(fData.crd, 2.0),
      history
    };
  } catch {
    return {fXG:1.35,fXGA:1.35,formRating:50,cor:4.5,crd:2.0,corRatio:3.5,history:[]};
  }
}

function getLeagueParams(leagueId) {
  const lm = leagueMods[leagueId] || {};
  let defaultXgDiff = engineConfig.xG_Diff;
  if (TIGHT_LEAGUES.has(leagueId)) defaultXgDiff = 0.35;
  else if (GOLD_LEAGUES.has(leagueId)) defaultXgDiff = 0.65;
  return {
    mult:     lm.mult     !== undefined ? lm.mult     : (GOLD_LEAGUES.has(leagueId) ? engineConfig.modGold : TRAP_LEAGUES.has(leagueId) ? engineConfig.modTrap : TIGHT_LEAGUES.has(leagueId) ? engineConfig.modTight : 1.00),
    minXGO25: lm.minXGO25 !== undefined ? lm.minXGO25 : engineConfig.tXG_O25,
    minXGO35: lm.minXGO35 !== undefined ? lm.minXGO35 : engineConfig.tXG_O35,
    maxU25:   lm.maxU25   !== undefined ? lm.maxU25   : engineConfig.tXG_U25,
    minBTTS:  lm.minBTTS  !== undefined ? lm.minBTTS  : engineConfig.tBTTS,
    xgDiff:   lm.xgDiff   !== undefined ? lm.xgDiff   : defaultXgDiff
  };
}

function computeCornerConfidence(hS, aS, hXG, aXG) {
  const expectedHomeCorners = hXG * safeNum(hS.corRatio, 3.5);
  const expectedAwayCorners = aXG * safeNum(aS.corRatio, 3.5);
  let expCor = expectedHomeCorners + expectedAwayCorners;

  const xgDiff = Math.abs(hXG - aXG);
  const dominanceBonus = xgDiff > 0.8 ? clamp((xgDiff - 0.8) * 1.5, 0, 2.0) : 0;
  expCor += dominanceBonus;

  const mean = expCor;
  const stdv = Math.sqrt(mean) * 0.85; 
  const z = (8.5 - mean) / stdv; 
  const pAbove = 1 - normalCDF(z);
  
  let score = pAbove * 100;
  
  const baseCor = safeNum(hS.cor, 4.5) + safeNum(aS.cor, 4.5);
  if (baseCor < engineConfig.minCorners) {
    score -= (engineConfig.minCorners - baseCor) * 8;
  }
  
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

  // Νέα στάθμιση κόρνερ
  const cornerConf = computeCornerConfidence(hS, aS, hXG, aXG);

  if (pp.pO35 >= 0.42 && tXG >= lp.minXGO35 && btts >= 1.20) {
    omegaPick = "🚀 OVER 3.5 GOALS";
    pickScore = pp.pO35 * 100;
    reason = `Poisson O3.5: ${(pp.pO35*100).toFixed(1)}% | tXG: ${tXG.toFixed(2)}`;
  }
  else if (pp.pO25 >= 0.52 && tXG >= lp.minXGO25 && btts >= 0.85) {
    omegaPick = "🔥 OVER 2.5 GOALS";
    pickScore = pp.pO25 * 100;
    reason = `Poisson O2.5: ${(pp.pO25*100).toFixed(1)}% | tXG: ${tXG.toFixed(2)}`;
  }
  else if (pp.pU25 >= 0.55 && tXG <= lp.maxU25 && btts <= engineConfig.tBTTS_U25) {
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
    const formOk   = outPick === "1" ? hS.formRating >= 1.0 : aS.formRating >= 1.0;
    
    if (outProb >= 0.52 && formOk) {
      omegaPick = outProb >= 0.60 ? `⚡ ${outcome}` : outcome;
      pickScore = outProb * 100;
      reason = `Poisson ${outPick==='1'?'Home':'Away'}: ${(outProb*100).toFixed(1)}% | xG Diff: ${xgDiff.toFixed(2)}`;
    }
  }
  else if(cornerConf>=65) {
    omegaPick="🚩 OVER 8.5 ΚΟΡΝΕΡ"; pickScore=cornerConf; reason=`Corners/xG Model: ${cornerConf.toFixed(1)}%`;
  }

  let hG = pp.bestScore.h, aG = pp.bestScore.a;
  const exactConf = Math.round(pp.bestScore.prob * 100 * 8);

  return { omegaPick, reason, pickScore, outPick, hG, aG, hExp:hLambda, aExp:aLambda, exactConf, xgDiff, pp };
}

async function analyzeMatchSafe(m, index, total) {
  try {
    setProgress(10+((index+1)/total)*88, `Processing ${index+1}/${total}: ${m.teams.home.name}`);

    const [hS,aS,stand] = await Promise.all([
      buildIntel(m.teams.home.id,m.league.id,m.league.season,true),
      buildIntel(m.teams.away.id,m.league.id,m.league.season,false),
      getStand(m.league.id,m.league.season)
    ]);

    const lp=getLeagueParams(m.league.id);
    const hXG=Number(hS.fXG)*lp.mult, aXG=Number(aS.fXG)*lp.mult;
    const tXG=hXG+aXG, bttsScore=Math.min(hXG,aXG);
    const cor=Number(hS.cor)+Number(aS.cor), totCards=Number(hS.crd)+Number(aS.crd);

    const result=computePick(hXG,aXG,tXG,bttsScore, lp, hS, aS);

    const rec={
      m, fixId:m.fixture.id, ht:m.teams.home.name, at:m.teams.away.name,
      lg:m.league.name, leagueId:m.league.id, scanDate:todayISO(),
      tXG, btts:bttsScore, cor, outPick:result.outPick, xgDiff:result.xgDiff,
      exact:`${result.hG}-${result.aG}`, exactConf:result.exactConf,
      omegaPick:result.omegaPick, strength:result.pickScore, reason:result.reason,
      hExp:result.hExp, aExp:result.aExp, pp:result.pp,
      hr:getTeamRank(stand,m.teams.home.id)??99, ar:getTeamRank(stand,m.teams.away.id)??99,
      isBomb:false
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
      if(selLg==='ALL')   return LEAGUE_IDS.includes(m.league.id);
      if(selLg==='MY_LEAGUES') return MY_LEAGUES_IDS.includes(m.league.id);
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
  ['topSection','summarySection'].forEach(id=>document.getElementById(id).innerHTML='');
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

// RENDERING
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
  document.getElementById('topSection').innerHTML=html;
}

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
