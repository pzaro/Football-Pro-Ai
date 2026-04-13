// app.js

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
  wShotsOn:0.14,wShotsOff:0.04,wCorners:0.02,wGoals:0.20,
  tXG_O25:2.70,tXG_O35:3.25,tXG_U25:1.80,tBTTS_U25:0.65,
  xG_Diff:0.55,tBTTS:1.10,modTrap:0.90,modTight:0.95,modGold:1.15,
  minCorners: 10.5, minCards: 5.8
};
let engineConfig = {...DEFAULT_SETTINGS};
let leagueMods = {};
const SETTINGS_MAP = {
  cfg_wShotsOn:'wShotsOn', cfg_wShotsOff:'wShotsOff', cfg_wCorners:'wCorners', cfg_wGoals:'wGoals',
  cfg_tXG_O25:'tXG_O25',   cfg_tXG_O35:'tXG_O35',     cfg_tXG_U25:'tXG_U25',  cfg_tBTTS_U25:'tBTTS_U25',
  cfg_xG_Diff:'xG_Diff',   cfg_tBTTS:'tBTTS', cfg_minCorners:'minCorners', cfg_minCards:'minCards'
};

// UI UTILS
const isLive = s => ["1H","2H","HT","LIVE","ET","BT","P"].includes(s);
const isFinished = s => ["FT","AET","PEN"].includes(s);
const todayISO = () => new Date().toISOString().split('T')[0];

function togglePanel(panelId,arrowId) {
  const p=document.getElementById(panelId),a=document.getElementById(arrowId);
  if(p.style.display==='none'){p.style.display='block';if(a)a.innerText='▲';}
  else{p.style.display='none';if(a)a.innerText='▼';}
}
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
let _errTimer=null, _okTimer=null;
function showErr(msg) { clearTimeout(_errTimer); const box=document.getElementById('errorBox'); box.innerHTML=`<div>⚠️ ${esc(msg)}</div>`; _errTimer=setTimeout(()=>box.innerHTML='',8000); }
function showOk(msg) { clearTimeout(_okTimer); const box=document.getElementById('successBox'); box.innerHTML=`<div>✓ ${esc(msg)}</div>`; _okTimer=setTimeout(()=>box.innerHTML='',4000); }
function clearAlerts() { document.getElementById('errorBox').innerHTML=''; document.getElementById('successBox').innerHTML=''; }
function abortScan(msg) { if(msg)showErr(msg); isRunning=false; setBtnsDisabled(false); setLoader(false); }
function flashElement(el) { if(!el) return; const original = el.style.background; el.style.background = 'rgba(14, 165, 233, 0.2)'; setTimeout(() => el.style.background = original, 800); }

// SETTINGS & MODS
function loadSettings() {
  try { const s = JSON.parse(localStorage.getItem(LS_SETTINGS)); if(s) engineConfig = {...DEFAULT_SETTINGS,...s}; } catch {}
  try { const lm = JSON.parse(localStorage.getItem(LS_LGMODS)); if(lm) leagueMods = { ...leagueMods, ...lm }; } catch {}
  syncUIFromSettings();
  buildLeagueModTable();
}
function syncUIFromSettings() { for(const [id,key] of Object.entries(SETTINGS_MAP)) { const el = document.getElementById(id); if(el) el.value = engineConfig[key]; } }
function saveSettings() {
  for(const [id,key] of Object.entries(SETTINGS_MAP)) { const v = parseFloat(document.getElementById(id)?.value); if(!isNaN(v)) engineConfig[key] = v; }
  try { localStorage.setItem(LS_SETTINGS, JSON.stringify(engineConfig)); } catch {}
  showOk("Global Parameters Saved!"); buildLeagueModTable();
}
function resetSettings() { engineConfig = {...DEFAULT_SETTINGS}; syncUIFromSettings(); try { localStorage.setItem(LS_SETTINGS, JSON.stringify(engineConfig)); } catch {} showOk("Restored Defaults."); buildLeagueModTable(); }
function getLeagueParams(leagueId) {
  const lm = leagueMods[leagueId] || {};
  let defaultXgDiff = engineConfig.xG_Diff;
  if (TIGHT_LEAGUES.has(leagueId)) defaultXgDiff = 0.35;
  else if (GOLD_LEAGUES.has(leagueId)) defaultXgDiff = 0.65;
  return {
    mult:     lm.mult     !== undefined ? lm.mult     : defaultLeagueMult(leagueId),
    minXGO25: lm.minXGO25 !== undefined ? lm.minXGO25 : engineConfig.tXG_O25,
    minXGO35: lm.minXGO35 !== undefined ? lm.minXGO35 : engineConfig.tXG_O35,
    maxU25:   lm.maxU25   !== undefined ? lm.maxU25   : engineConfig.tXG_U25,
    minBTTS:  lm.minBTTS  !== undefined ? lm.minBTTS  : engineConfig.tBTTS,
    xgDiff:   lm.xgDiff   !== undefined ? lm.xgDiff   : defaultXgDiff
  };
}
function buildLeagueModTable(auditStats={}) {
  const tbody = document.getElementById('leagueModBody'); if(!tbody) return; tbody.innerHTML='';
  LEAGUES_DATA.forEach(l => {
    const mod=leagueMods[l.id]||{}, stats=auditStats[l.id];
    let statsHtml='<span style="color:var(--text-muted)">—</span>';
    if(stats) {
      const c=(v,t)=>v>=t?'var(--accent-green)':v>=(t-10)?'var(--accent-gold)':'var(--accent-red)';
      statsHtml=`<span style="color:${c(stats.out,80)}">${stats.out.toFixed(0)}%</span> | <span style="color:${c(stats.o25,80)}">${stats.o25.toFixed(0)}%</span> | <span style="color:${c(stats.o35,70)}">${stats.o35.toFixed(0)}%</span> | <span style="color:${c(stats.btts,70)}">${stats.btts.toFixed(0)}%</span>`;
    }
    let placeholderDiff = engineConfig.xG_Diff.toFixed(2);
    if(TIGHT_LEAGUES.has(l.id)) placeholderDiff = "0.35";
    else if(GOLD_LEAGUES.has(l.id)) placeholderDiff = "0.65";

    tbody.innerHTML += `<tr>
      <td class="left-align" style="font-weight:700;color:var(--text-main);font-size:0.8rem">${l.name}</td>
      <td><input type="number" step="0.01" value="${mod.mult??''}" placeholder="${defaultLeagueMult(l.id).toFixed(2)}" class="league-mod-input" id="lm_mult_${l.id}"></td>
      <td><input type="number" step="0.05" value="${mod.minXGO25??''}" placeholder="${engineConfig.tXG_O25.toFixed(2)}" class="league-mod-input" id="lm_minO25_${l.id}"></td>
      <td><input type="number" step="0.05" value="${mod.minXGO35??''}" placeholder="${engineConfig.tXG_O35.toFixed(2)}" class="league-mod-input" id="lm_minO35_${l.id}"></td>
      <td><input type="number" step="0.05" value="${mod.maxU25??''}" placeholder="${engineConfig.tXG_U25.toFixed(2)}" class="league-mod-input" id="lm_maxU25_${l.id}"></td>
      <td><input type="number" step="0.05" value="${mod.minBTTS??''}" placeholder="${engineConfig.tBTTS.toFixed(2)}" class="league-mod-input" id="lm_minBTTS_${l.id}"></td>
      <td><input type="number" step="0.05" value="${mod.xgDiff??''}" placeholder="${placeholderDiff}" class="league-mod-input" id="lm_xgDiff_${l.id}"></td>
      <td class="mono" style="font-size:0.72rem">${statsHtml}</td>
    </tr>`;
  });
}
function defaultLeagueMult(id) { if(GOLD_LEAGUES.has(id)) return engineConfig.modGold; if(TRAP_LEAGUES.has(id)) return engineConfig.modTrap; if(TIGHT_LEAGUES.has(id)) return engineConfig.modTight; return 1.00; }

// BANKROLL
function loadBankroll() { try { const b = JSON.parse(localStorage.getItem(LS_BANKROLL)); if(b) bankrollData = b; } catch {} updateBankrollDisplay(); }
function updateBankrollDisplay() { const el = document.getElementById('bankrollDisplay'); if(el) el.textContent = bankrollData.current > 0 ? `€${bankrollData.current.toFixed(2)}` : 'Set'; }
function openBankroll()  { document.getElementById('bankrollModal').style.display = 'flex'; document.getElementById('bankrollInput').value = bankrollData.current || ''; renderBankrollHistory(); }
function closeBankroll() { document.getElementById('bankrollModal').style.display = 'none'; }
function saveBankroll() {
  const val = parseFloat(document.getElementById('bankrollInput').value);
  if(isNaN(val) || val <= 0) { showErr('Μη έγκυρο ποσό.'); return; }
  if(bankrollData.current !== val) {
    bankrollData.history.unshift({ date: todayISO(), amount: val, prev: bankrollData.current });
    if(bankrollData.history.length > 20) bankrollData.history = bankrollData.history.slice(0,20);
  }
  bankrollData.current = val;
  try { localStorage.setItem(LS_BANKROLL, JSON.stringify(bankrollData)); } catch {}
  updateBankrollDisplay(); renderBankrollHistory(); showOk(`Bankroll: €${val.toFixed(2)}`);
}
function renderBankrollHistory() {
  const div = document.getElementById('bankrollHistory');
  if(!bankrollData.history.length) { div.innerHTML=''; return; }
  let html = `<table class="bk-table"><thead><tr><th>Ημ/νία</th><th>Πριν</th><th>Νέο</th><th>Δ</th></tr></thead><tbody>`;
  bankrollData.history.slice(0,8).forEach(h => {
    const diff = h.amount - h.prev, col = diff >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    html += `<tr><td>${h.date}</td><td>€${Number(h.prev).toFixed(2)}</td><td>€${Number(h.amount).toFixed(2)}</td><td style="color:${col}">${diff>=0?'+':''}€${diff.toFixed(2)}</td></tr>`;
  });
  html += `</tbody></table>`; div.innerHTML = html;
}
function kellyStake(winProb, odds, fraction=0.25) {
  if(!bankrollData.current || bankrollData.current<=0 || !winProb || !odds || odds<=1) return null;
  const b=odds-1, p=Math.min(Math.max(winProb,0.01),0.99), q=1-p;
  const kelly = (b*p - q) / b;
  if(kelly<=0) return null;
  const stake = bankrollData.current * kelly * fraction;
  return Math.max(0.5, Math.min(stake, bankrollData.current*0.20));
}

// CORE EXECUTION
async function analyzeMatchSafe(m, index, total) {
  try {
    setProgress(10+((index+1)/total)*88, `Processing ${index+1}/${total}: ${m.teams.home.name}`);

    const[hS,aS,stand,h2hFix,injRes]=await Promise.all([
      buildIntel(m.teams.home.id,m.league.id,m.league.season,true),
      buildIntel(m.teams.away.id,m.league.id,m.league.season,false),
      getStand(m.league.id,m.league.season),
      getHeadToHead(m.teams.home.id,m.teams.away.id,m.league.id,m.league.season),
      apiReq(`injuries?fixture=${m.fixture.id}`)
    ]);

    let hInj=0,aInj=0;
    (injRes?.response||[]).forEach(inj=>{
      if(inj.team?.id===m.teams.home.id) hInj++;
      else if(inj.team?.id===m.teams.away.id) aInj++;
    });

    const lp=getLeagueParams(m.league.id);
    const h2h=summarizeH2H(h2hFix,m.teams.home.id,m.teams.away.id);
    const hXG=Number(hS.fXG)*lp.mult, aXG=Number(aS.fXG)*lp.mult;
    const tXG=hXG+aXG, bttsScore=Math.min(hXG,aXG);
    const cor=Number(hS.cor)+Number(aS.cor), totCards=Number(hS.crd)+Number(aS.crd);

    const result=computePick(hXG,aXG,tXG,bttsScore,cor,totCards,lp,hS,aS,h2h,hInj,aInj,m.league.id);

    const totCorExp=clamp((cor*0.78)+((Number(hS.sXG)+Number(aS.sXG))*0.72),5,15);
    const hShare=clamp((result.hExp+Number(hS.sXG)+0.25)/Math.max(result.hExp+result.aExp+Number(hS.sXG)+Number(aS.sXG)+0.5,0.1),0.38,0.62);
    const hCors=Math.max(2,Math.round(totCorExp*hShare)), aCors=Math.max(2,Math.round(totCorExp-hCors));

    const rec={
      m, fixId:m.fixture.id, ht:m.teams.home.name, at:m.teams.away.name,
      lg:m.league.name, leagueId:m.league.id, scanDate:todayISO(),
      tXG, btts:bttsScore, cor, outPick:result.outPick, xgDiff:result.xgDiff,
      exact:`${result.hG}-${result.aG}`, exactConf:result.exactConf,
      omegaPick:result.omegaPick, strength:result.pickScore, reason:result.reason,
      hExp:result.hExp, aExp:result.aExp, pp:result.pp,
      hr:getTeamRank(stand,m.teams.home.id)??99, ar:getTeamRank(stand,m.teams.away.id)??99,
      hCors, aCors, totCors:hCors+aCors, totCards, hS, aS, h2h, hInj, aInj, isBomb:false,
      isLockO25:tXG>=(lp.minXGO25+0.15)&&bttsScore>=1.00,
      isLockBTTS:bttsScore>=(lp.minBTTS+0.05)&&tXG>=2.50,
      isLockU25:tXG<=(lp.maxU25-0.20)&&bttsScore<=(engineConfig.tBTTS_U25-0.10)
    };
    window.scannedMatchesData.push(rec);
  } catch(err) {
    console.error(`Failed: ${m.teams.home.name}`, err);
    window.scannedMatchesData.push({
      m, fixId:m.fixture.id, ht:m.teams.home.name, at:m.teams.away.name,
      lg:m.league.name, leagueId:m.league.id, omegaPick:"NO BET",
      reason:"Analysis error", strength:0, tXG:0, outPick:"X", exact:"0-0", hInj:0, aInj:0
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

async function runScan() {
  if(isRunning) return;
  const startD=document.getElementById('scanStart').value||todayISO();
  const endD=document.getElementById('scanEnd').value||startD;

  if(new Date(endD)<new Date(startD)){ showErr("Η ημ/νία 'To' πρέπει να είναι >= 'From'."); return; }

  const daysCount=getDatesInRange(startD,endD).length;
  const estCost=daysCount*30*5;
  if(currentCredits!==null&&estCost>currentCredits){
    if(!confirm(`⚠️ Χρειάζονται ~${estCost} credits, έχεις ${currentCredits}. Συνέχεια;`)) return;
  }

  isRunning=true; clearAlerts(); setBtnsDisabled(true);
  setLoader(true,'Initializing Deep Quant...');
  ['topSection','summarySection','wallbetSection','matchesFeed','advisorSection'].forEach(id=>document.getElementById(id).innerHTML='');
  window.scannedMatchesData=[];
  teamStatsCache.clear(); lastFixCache.clear(); standCache.clear(); h2hCache.clear();

  try {
    const selLg=document.getElementById('leagueFilter').value;
    let all=await fetchFixturesForDates(getDatesInRange(startD,endD),selLg);
    if(!all.length){showErr('Δεν βρέθηκαν αγώνες.');return;}
    if(all.length>350){showOk('Περιορίστηκε σε 350 αγώνες.');all=all.slice(0,350);}

    for(let i=0;i<all.length;i++) await analyzeMatchSafe(all[i],i,all.length);

    const toSave=window.scannedMatchesData.filter(d=>d.fixId).map(d=>buildSaveRecord(d,{outPick:d.outPick}));
    bulkSavePredictions(toSave);
    
    // RENDER FUNCTIONS CALLED HERE
    rebuildTopLists(); 
    renderTopSections(); 
    renderWallBets(); 
    renderSummaryTable();
    
    document.getElementById('feedFilterSection').style.display='block'; 
    window.filterFeed();
    
    showOk(`Scan ολοκληρώθηκε. ${all.length} αγώνες αναλύθηκαν.`);
  } catch(e){ showErr(e.message); }
  finally { isRunning=false; setLoader(false); setBtnsDisabled(false); }
}

window.resimulateMatches = function() {
  if(!window.scannedMatchesData.length){showErr("Δεν υπάρχουν δεδομένα. Κάνε Scan πρώτα.");return;}
  clearAlerts();
  try {
    const toSave=[];
    window.scannedMatchesData.forEach(d=>{
      if(!d.leagueId) return;
      const lp=getLeagueParams(d.leagueId);
      
      const fallback = d.tXG && d.tXG > 0 ? d.tXG/2 : 1.35;
      const hXG=Math.max(Number(d.hS?.fXG||fallback), 0.85)*lp.mult;
      const aXG=Math.max(Number(d.aS?.fXG||fallback), 0.85)*lp.mult;
      const hS_safe={...d.hS, wXG:Math.max(Number(d.hS?.wXG||0),0.85), fXGA:Math.max(Number(d.hS?.fXGA||0),0.85)};
      const aS_safe={...d.aS, wXG:Math.max(Number(d.aS?.wXG||0),0.85), fXGA:Math.max(Number(d.aS?.fXGA||0),0.85)};
      
      const tXG=hXG+aXG, bttsScore=Math.min(hXG,aXG);
      const cor=Number(d.hS?.cor||d.cor/2||4.5)+Number(d.aS?.cor||d.cor/2||4.5);
      const totCards=Number(d.hS?.crd||d.totCards/2||2.5)+Number(d.aS?.crd||d.totCards/2||2.5);
      
      const result=computePick(hXG,aXG,tXG,bttsScore,cor,totCards,lp,hS_safe,aS_safe,d.h2h,d.hInj||0,d.aInj||0,d.leagueId);

      const totCorExp=clamp((cor*0.78)+((Number(hS_safe.sXG)+Number(aS_safe.sXG))*0.72),5,15);
      const hShare=clamp((result.hExp+Number(hS_safe.sXG)+0.25)/Math.max(result.hExp+result.aExp+Number(hS_safe.sXG)+Number(aS_safe.sXG)+0.5,0.1),0.38,0.62);
      const hCors=Math.max(2,Math.round(totCorExp*hShare)), aCors=Math.max(2,Math.round(totCorExp-hCors));
      
      Object.assign(d,{tXG,btts:bttsScore,outPick:result.outPick,xgDiff:result.xgDiff,exact:`${result.hG}-${result.aG}`,exactConf:result.exactConf,omegaPick:result.omegaPick,strength:result.pickScore,reason:result.reason,hExp:result.hExp,aExp:result.aExp,pp:result.pp,hCors,aCors,totCards,
        isLockO25:tXG>=(lp.minXGO25+0.15)&&bttsScore>=1.00,
        isLockBTTS:bttsScore>=(lp.minBTTS+0.05)&&tXG>=2.50,
        isLockU25:tXG<=(lp.maxU25-0.20)&&bttsScore<=(engineConfig.tBTTS_U25-0.10)
      });
      toSave.push(buildSaveRecord(d,result));
    });
    bulkSavePredictions(toSave);
    rebuildTopLists(); renderTopSections(); renderWallBets(); renderSummaryTable(); window.filterFeed();
    showOk("Re-simulation complete (0 Credits).");
  } catch(e){ showErr(e.message); }
};

function buildSaveRecord(d,result) {
  return stripForStorage({
    fixtureId:d.fixId, date:d.m?.fixture?.date, scanDate:d.scanDate||todayISO(),
    league:d.lg, leagueId:d.leagueId, homeTeam:d.ht, awayTeam:d.at,
    outPick:result?.outPick||d.outPick,
    predOver25:!!(d.omegaPick?.includes('OVER 2')||d.omegaPick?.includes('OVER 3')),
    predOver35:!!d.omegaPick?.includes('OVER 3'),
    predUnder25:!!d.omegaPick?.includes('UNDER 2.5'),
    predBTTS:!!d.omegaPick?.includes('GOAL'),
    exactScorePred:d.exact, omegaPick:d.omegaPick, savedAt:new Date().toISOString()
  });
}

function stripForStorage(rec) {
  const { pp, hS, aS, aTot, aCor, aCards, ...rest } = rec;
  const stripTeam = t => t ? { fXG:t.fXG, fXGA:t.fXGA, sXG:t.sXG, sXGA:t.sXGA, wXG:t.wXG, formRating:t.formRating, cor:t.cor, crd:t.crd, uiXG:t.uiXG, uiXGA:t.uiXGA, uiDevXG:t.uiDevXG, uiDevXGA:t.uiDevXGA, uiSXG:t.uiSXG } : undefined;
  return { ...rest, hS: stripTeam(hS), aS: stripTeam(aS) };
}
function getPredStore()  { try{return JSON.parse(localStorage.getItem(LS_PREDS)||"[]");}catch{return [];} }

function bulkSavePredictions(newRecords) {
  try {
    const store=getPredStore();
    const map=new Map(store.map(x=>[String(x.fixtureId),x]));
    newRecords.forEach(rec=>map.set(String(rec.fixtureId), stripForStorage(rec)));
    localStorage.setItem(LS_PREDS, JSON.stringify(Array.from(map.values())));
    updateAuditLeagueFilter();
  } catch(e) {
    if(e.name==='QuotaExceededError') showErr('Storage full. Κάνε Purge Data.');
    else showErr(e.message);
  }
}
function clearVault() { if(confirm("Διαγραφή όλου του ιστορικού;")){localStorage.removeItem(LS_PREDS);showOk("Vault Cleared.");updateAuditLeagueFilter();} }
function updateAuditLeagueFilter() {
  const store=getPredStore(), leagues=new Set(store.map(x=>x.leagueId));
  const sel=document.getElementById('auditLeague'); if(!sel) return;
  sel.innerHTML='<option value="ALL">Global (All Leagues)</option>';
  const known=new Set(LEAGUE_IDS);
  LEAGUES_DATA.forEach(l=>{if(leagues.has(l.id))sel.innerHTML+=`<option value="${l.id}">${l.name}</option>`;});
  store.forEach(x=>{if(!known.has(x.leagueId)&&x.leagueId){sel.innerHTML+=`<option value="${x.leagueId}">${x.league}</option>`;known.add(x.leagueId);}});
}

// EXPORT / IMPORT
window.exportData = function() {
  if(!window.scannedMatchesData?.length){showErr("Δεν υπάρχουν δεδομένα.");return;}
  const blob=new Blob([JSON.stringify(window.scannedMatchesData.map(stripForStorage))],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`apex_omega_${todayISO()}.json`; a.click();
  URL.revokeObjectURL(url); showOk("Export ολοκληρώθηκε!");
};
window.importData = function(event) {
  const file=event.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=function(e) {
    try {
      const imported=JSON.parse(e.target.result);
      if(!Array.isArray(imported)) throw new Error("Invalid format");
      
      window.scannedMatchesData = imported.map(d => ({
         ...d, tXG: d.tXG || 0, strength: d.strength || 0, exactConf: d.exactConf || 0,
      }));
      
      rebuildTopLists(); renderTopSections(); renderWallBets(); renderSummaryTable();
      document.getElementById('feedFilterSection').style.display='block'; filterFeed();
      showOk(`Import: ${imported.length} αγώνες (Offline Mode).`);
    } catch { showErr("Μη έγκυρο αρχείο JSON."); }
    event.target.value='';
  };
  reader.readAsText(file);
};

function authenticate() {
  const pin=document.getElementById('pin').value;
  const apiInput=document.getElementById('apiInput').value.trim();
  if(pin==="106014") {
    if(apiInput){API_KEY=apiInput;localStorage.setItem('omega_api_key',API_KEY);}
    if(!API_KEY){document.getElementById('authError').innerText="Παρακαλώ εισάγετε το API-Sports Key.";return;}
    document.getElementById('apiKeyModal').style.display='none';
    document.getElementById('app').style.display='block';
    initCredits(); updateAuditLeagueFilter(); loadSettings(); loadBankroll();
  } else {
    document.getElementById('authError').innerText="Λάθος PIN.";
  }
}

function getMatchCardHTML(d) {
  const isUnder=d.omegaPick?.includes('UNDER'), isNoBet=d.omegaPick?.includes('NO BET');
  let signalClass=isNoBet?'signal-warn':isUnder?'signal-under':'signal-hit';
  let pickColor=isNoBet?'var(--accent-red)':isUnder?'var(--accent-teal)':d.omegaPick?.includes('ΚΑΡΤΕΣ')?'var(--accent-gold)':'var(--accent-green)';
  if(d.isBomb){signalClass='signal-hit';pickColor='var(--accent-purple)';}

  let lockHtml='';
  if(d.isLockO25)  lockHtml+=`<span class="lock-badge lock-o25">💎 HIGH CONF O2.5</span>`;
  if(d.isLockBTTS) lockHtml+=`<span class="lock-badge lock-btts">🎯 HIGH CONF BTTS</span>`;
  if(d.isLockU25)  lockHtml+=`<span class="lock-badge lock-under">🔒 HIGH CONF U2.5</span>`;

  let scoreHtml='';
  if(d.m?.goals?.home!=null){
    const live=isLive(d.m.fixture.status.short), col=live?'var(--accent-green)':'var(--text-main)';
    const el=live?`<span style="font-size:0.72rem;color:var(--accent-green);margin-left:3px;">${d.m.fixture.status.elapsed}'</span>`:'';
    scoreHtml=`<div class="score-display" style="color:${col}">${d.m.goals.home} - ${d.m.goals.away}${el}</div>`;
  }

  let liveStatsBadges = '';
  if (d.liveCorners !== undefined) {
    liveStatsBadges = `
    <div style="margin-top:6px; display:flex; gap:5px; justify-content:flex-end; flex-wrap:wrap;">
      <span class="live-stat-badge" style="background:rgba(20,184,166,0.1); border-color:rgba(20,184,166,0.3); color:var(--accent-teal);">
        🚩 COR: ${d.liveCorners}
      </span>
      <span class="live-stat-badge" style="background:rgba(245,158,11,0.1); border-color:rgba(245,158,11,0.3); color:var(--accent-gold);">
        🟨 ${d.liveYellows}${d.liveReds > 0 ? ` 🟥${d.liveReds}` : ''}
      </span>
    </div>`;
  }

  const rankBadge=r=>r&&r!==99?`<span class="team-rank">#${r}</span>`:'';
  const formHtml=hist=>`<div style="display:flex;gap:3px;margin-top:2px;">${(hist||[]).slice(0,5).map(h=>`<div class="form-dot form-${h.cls}">${h.res}</div>`).join('')}</div>`;

  let h2hStr='H2H: N/A', biasHtml='';
  if(d.h2h){
    if(d.h2h.homeWins-d.h2h.awayWins>=3) biasHtml=`<span class="h2h-bias-badge" style="color:var(--accent-green)">🔥 HOME DOM.</span>`;
    else if(d.h2h.awayWins-d.h2h.homeWins>=3) biasHtml=`<span class="h2h-bias-badge" style="color:var(--accent-blue)">🔥 AWAY DOM.</span>`;
    h2hStr=`H2H (8): ${d.h2h.homeWins}W-${d.h2h.draws}D-${d.h2h.awayWins}W`;
  }

  const conf=Math.min(Math.max(safeNum(d.strength),0),100);
  const confColor=conf>=70?'var(--accent-green)':conf>=50?'var(--accent-gold)':'var(--accent-red)';

  let kellyHtml='';
  if(bankrollData.current>0&&!isNoBet){
    const prob=safeNum(d.strength)/100, impliedOdds=prob>0?1/prob:2.0;
    const est_odds=Math.max(1.5,Math.min(impliedOdds*1.1,5.0));
    const stake=kellyStake(prob,est_odds);
    if(stake) kellyHtml=`<div class="kelly-box"><div><div class="kelly-label">Kelly Stake (25%)</div><div style="font-size:0.62rem;color:var(--text-muted);">Bankroll: €${bankrollData.current.toFixed(0)}</div></div><div class="kelly-val">€${stake.toFixed(2)}</div></div>`;
  }

  const poissonHtml=d.pp?getPoissonMatrixHTML(safeNum(d.hExp),safeNum(d.aExp),4):'';
  const hFormC=d.hS?.formRating>=70?'var(--accent-green)':d.hS?.formRating<=30?'var(--accent-red)':'var(--accent-gold)';
  const aFormC=d.aS?.formRating>=70?'var(--accent-green)':d.aS?.formRating<=30?'var(--accent-red)':'var(--accent-gold)';
  const hInjHtml=d.hInj>0?`<span style="color:var(--accent-red);margin-left:5px;font-size:0.68rem;" title="${d.hInj} Missing">🏥${d.hInj}</span>`:'';
  const aInjHtml=d.aInj>0?`<span style="color:var(--accent-red);margin-left:5px;font-size:0.68rem;" title="${d.aInj} Missing">🏥${d.aInj}</span>`:'';
  const isMatchLive = isLive(d.m?.fixture?.status?.short);
  const liveIndicator = isMatchLive ? `<span class="live-dot"></span>` : '';

  return `
  <div class="match-card" id="card-${d.fixId}">
    <div class="match-header">
      <div style="flex:1;min-width:0;">
        <div class="match-league">
          ${liveIndicator}<span class="league-badge">${esc(d.m?.fixture?.status?.short||'FT')}</span> ${esc(d.lg)}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <div class="team-name">${esc(d.ht)}${rankBadge(d.hr)}</div>
            <div style="font-size:0.62rem;color:var(--text-muted);display:flex;align-items:center;gap:7px;">
              Form: <span style="color:${hFormC};font-family:var(--font-mono);font-weight:700;">${d.hS?.formRating||50}%</span>${hInjHtml}
            </div>
            ${formHtml(d.hS?.history)}
          </div>
          <div>
            <div class="team-name" style="color:var(--text-muted)">${esc(d.at)}${rankBadge(d.ar)}</div>
            <div style="font-size:0.62rem;color:var(--text-muted);display:flex;align-items:center;gap:7px;">
              Form: <span style="color:${aFormC};font-family:var(--font-mono);font-weight:700;">${d.aS?.formRating||50}%</span>${aInjHtml}
            </div>
            ${formHtml(d.aS?.history)}
          </div>
        </div>
      </div>
      <div class="score-box" style="margin-left:16px;">
        ${scoreHtml}
        <div class="total-xg-badge">xG: ${Number(d.tXG||0).toFixed(2)}</div>
        ${liveStatsBadges}
      </div>
    </div>

    ${lockHtml?`<div style="margin-bottom:11px;display:flex;flex-wrap:wrap;gap:4px;">${lockHtml}</div>`:''}

    <div class="signal-box ${signalClass}">
      <div style="font-size:0.6rem;font-weight:700;color:${pickColor};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:3px;">System Output Signal</div>
      <div class="signal-value" style="color:${pickColor}">${esc(d.omegaPick)}</div>
      <div class="signal-desc">${esc(d.reason)}</div>
      <div class="conf-bar-wrap" style="margin-top:9px;">
        <div class="conf-bar-label">
          <span>Confidence</span>
          <span style="color:${confColor};font-family:var(--font-mono)">${conf.toFixed(1)}%</span>
        </div>
        <div class="conf-bar-track"><div class="conf-bar-fill" style="width:${conf}%;background:${confColor};"></div></div>
      </div>
    </div>
    ${kellyHtml}

    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-box-title">Game Projections</div>
        <div class="stat-row"><span class="stat-lbl">Exact Score (Poisson)</span><span class="stat-val stat-highlight">${esc(d.exact||'?-?')}</span></div>
        <div class="stat-row"><span class="stat-lbl">Lambda xG</span><span class="stat-val" style="color:var(--accent-blue)">${Number(d.hExp||0).toFixed(2)} – ${Number(d.aExp||0).toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-lbl">xG Diff</span><span class="stat-val" style="color:${(d.xgDiff||0)>0?'var(--accent-green)':'var(--accent-red)'}">${(d.xgDiff||0)>0?'+':''}${Number(d.xgDiff||0).toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-lbl">BTTS Rating</span><span class="stat-val">${Number(d.btts||0).toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-lbl">Poisson O2.5</span><span class="stat-val" style="color:var(--accent-blue)">${d.pp?(d.pp.pO25*100).toFixed(1)+'%':'—'}</span></div>
        <div class="stat-row"><span class="stat-lbl">Poisson U2.5</span><span class="stat-val" style="color:var(--accent-teal)">${d.pp?(d.pp.pU25*100).toFixed(1)+'%':'—'}</span></div>
      </div>
      <div class="stat-box">
        <div class="stat-box-title">Home vs Away Breakdown</div>
        <div class="stat-row"><span class="stat-lbl">Form xG</span><span class="stat-val">${d.hS?.uiXG||'0.00'}${d.hS?.uiDevXG||''} <span style="color:var(--text-muted)">vs</span> ${d.aS?.uiXG||'0.00'}${d.aS?.uiDevXG||''}</span></div>
        <div class="stat-row"><span class="stat-lbl">Weighted xG</span><span class="stat-val">${Number(d.hS?.wXG||0).toFixed(2)} <span style="color:var(--text-muted)">vs</span> ${Number(d.aS?.wXG||0).toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-lbl">Split xG</span><span class="stat-val">${d.hS?.uiSXG||'0.00'} <span style="color:var(--text-muted)">vs</span> ${d.aS?.uiSXG||'0.00'}</span></div>
        <div class="stat-row"><span class="stat-lbl">Proj Corners</span><span class="stat-val">${Number(d.hCors||0).toFixed(0)} <span style="color:var(--text-muted)">vs</span> ${Number(d.aCors||0).toFixed(0)}</span></div>
        <div class="stat-row"><span class="stat-lbl">Exp. Cards</span><span class="stat-val">${Number(d.hS?.crd||0).toFixed(1)} <span style="color:var(--text-muted)">vs</span> ${Number(d.aS?.crd||0).toFixed(1)}</span></div>
      </div>
    </div>
    ${poissonHtml?`<div class="stat-box" style="margin-top:10px;"><div class="stat-box-title">📊 Poisson Matrix (Home↓ Away→)</div>${poissonHtml}</div>`:''}
    <div class="h2h-footer">${h2hStr} ${biasHtml}</div>
  </div>`;
}

function renderSummaryTable() {
  const sec = document.getElementById('summarySection');
  if(!sec) return;
  const sd = window.scannedMatchesData;
  if(!sd.length) { sec.innerHTML=''; return; }

  const lgMap = {};
  sd.forEach(d => {
    if(!d.lg) return;
    if(!lgMap[d.lg]) lgMap[d.lg]={ name:d.lg, count:0, o25:0, o35:0, u25:0, btts:0, outcome:0, corner:0 };
    lgMap[d.lg].count++;
    if(d.omegaPick?.includes('OVER 2.5')) lgMap[d.lg].o25++;
    if(d.omegaPick?.includes('OVER 3.5')) lgMap[d.lg].o35++;
    if(d.omegaPick?.includes('UNDER 2.5')) lgMap[d.lg].u25++;
    if(d.omegaPick?.includes('GOAL')) lgMap[d.lg].btts++;
    if(d.omegaPick?.includes('ΑΣΟΣ')||d.omegaPick?.includes('ΔΙΠΛΟ')||d.omegaPick?.includes('⚡')) lgMap[d.lg].outcome++;
    if(d.omegaPick?.includes('ΚΟΡΝΕΡ')) lgMap[d.lg].corner++;
  });

  const rows = Object.values(lgMap).sort((a,b)=>b.count-a.count);

  let matchRows = '';
  const grouped={};
  sd.forEach((d,i)=>{ if(!grouped[d.lg]) grouped[d.lg]=[]; grouped[d.lg].push({...d,originalIndex:i}); });
  
  for(const[lg,matches] of Object.entries(grouped)){
    matchRows+=`<div style="background:rgba(56,189,248,0.04);padding:7px 16px;font-weight:700;font-size:0.72rem;color:var(--accent-blue);border-top:1px solid var(--border-light);border-bottom:1px solid var(--border-light);text-transform:uppercase;letter-spacing:1px;">${esc(lg)}</div>
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

      const isO25=x.omegaPick?.includes('OVER 2.5')||x.omegaPick?.includes('OVER 3.5')?'🔥':'-';
      const isU25=x.omegaPick?.includes('UNDER 2.5')?'🔒':'-';
      const isBtts=x.omegaPick?.includes('GOAL')?'🎯':'-';

      let colO25=isO25==='🔥'?'var(--accent-gold)':'var(--text-muted)';
      let colU25=isU25==='🔒'?'var(--accent-teal)':'var(--text-muted)';
      let colBtts=isBtts==='🎯'?'var(--accent-purple)':'var(--text-muted)';

      if(isFin){
        if(isO25!=='-') colO25=aTot>=3?'var(--accent-green)':'var(--accent-red)';
        if(isU25!=='-') colU25=aTot<3?'var(--accent-green)':'var(--accent-red)';
        if(isBtts!=='-') colBtts=aBtts?'var(--accent-green)':'var(--accent-red)';
      }

      let colOut=x.outPick==='X'?'var(--text-muted)':'var(--text-main)';
      if(isFin&&x.outPick!=='X') colOut=x.outPick===aOut?'var(--accent-green)':'var(--accent-red)';
      let colEx='var(--text-main)';
      if(isFin) colEx=x.exact===`${ah}-${aa}`?'var(--accent-green)':'var(--accent-red)';

      let colOm=x.omegaPick?.includes('NO BET')?'var(--text-muted)':'var(--text-main)';
      if((isFin||isLiveNow)&&x.omegaPick&&!x.omegaPick.includes('NO BET')){
        let hit=null;
        if(x.omegaPick.includes('OVER 2.5')) hit=aTot>=3;
        else if(x.omegaPick.includes('OVER 3.5')) hit=aTot>=4;
        else if(x.omegaPick.includes('UNDER 2.5')) hit=aTot<3;
        else if(x.omegaPick.includes('GOAL')) hit=aBtts;
        else if(x.omegaPick.includes('ΑΣΟΣ')&&isFin) hit=aOut==='1';
        else if(x.omegaPick.includes('ΔΙΠΛΟ')&&isFin) hit=aOut==='2';
        if(hit!==null) colOm=hit?'var(--accent-green)':(isFin?'var(--accent-red)':colOm);
      }

      const conf=Math.min(Math.max(safeNum(x.strength),0),100);
      const liveExtra = isLiveNow && x.liveCorners !== undefined ? `<div style="font-size:0.6rem;color:var(--accent-teal);margin-top:2px;">🚩${x.liveCorners} 🟨${x.liveYellows}</div>` : '';

      matchRows+=`<tr onclick="scrollToMatch('card-${x.fixId}')" style="cursor:pointer;${isLiveNow?'background:rgba(52,211,153,0.04);':''}" title="${esc(x.ht)} vs ${esc(x.at)}">
        <td class="col-match" style="font-weight:600;color:var(--text-main);">
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${isLiveNow?'<span class="live-dot"></span>':''}${esc(x.ht)} <span style="color:var(--text-muted)">–</span> ${esc(x.at)}</div>
        </td>
        <td class="col-score mono" style="color:${scoreCol};">${scoreStr}${liveExtra}</td>
        <td class="col-1x2 mono" style="color:${colOut};">${x.outPick}</td>
        <td class="col-o25 mono" style="color:${colO25};">${isO25}</td>
        <td class="col-u25 mono" style="color:${colU25};">${isU25}</td>
        <td class="col-btts mono" style="color:${colBtts};">${isBtts}</td>
        <td class="col-exact mono" style="color:${colEx};">${x.exact||'?-?'}</td>
        <td class="col-conf mono" style="color:${conf>=65?'var(--accent-green)':conf>=45?'var(--accent-gold)':'var(--text-muted)'};">${conf.toFixed(0)}%</td>
        <td class="col-signal" style="font-size:0.68rem;color:${colOm};font-weight:800;font-family:var(--font-body);">${x.omegaPick?.split(' ').slice(0,3).join(' ')||'-'}</td>
      </tr>`;
    });
    matchRows+=`</tbody></table></div>`;
  }

  sec.innerHTML = `
    <div class="quant-panel" style="padding:0;overflow:hidden;">
      <div class="toolbar" style="padding:14px 18px;border-bottom:1px solid var(--border-light);margin:0;">
        <div class="panel-title" style="margin:0;color:var(--accent-blue);">📊 Summary Dashboard</div>
        <div style="margin-left:auto;"><button id="btnSyncLive" onclick="syncLiveScores()" class="btn btn-outline" style="padding:6px 12px;font-size:0.68rem;"><span class="live-dot"></span>Live Sync</button></div>
      </div>
      <div class="data-table-wrapper" style="border:none;border-radius:0;margin-bottom:0;">
        <table class="summary-table">
          <thead><tr>
            <th>League Distribution</th><th>Matches</th>
            <th style="color:var(--accent-green)">O2.5</th>
            <th style="color:var(--accent-blue)">O3.5</th>
            <th style="color:var(--accent-teal)">U2.5</th>
            <th style="color:var(--accent-purple)">BTTS</th>
            <th style="color:var(--accent-gold)">1X2</th>
            <th style="color:var(--accent-blue)">COR</th>
          </tr></thead>
          <tbody>
            ${rows.map(r=>`<tr>
              <td style="font-weight:700;">${esc(r.name)}</td>
              <td style="font-family:var(--font-mono);">${r.count}</td>
              <td style="color:var(--accent-green);font-family:var(--font-mono);">${r.o25||'—'}</td>
              <td style="color:var(--accent-blue);font-family:var(--font-mono);">${r.o35||'—'}</td>
              <td style="color:var(--accent-teal);font-family:var(--font-mono);">${r.u25||'—'}</td>
              <td style="color:var(--accent-purple);font-family:var(--font-mono);">${r.btts||'—'}</td>
              <td style="color:var(--accent-gold);font-family:var(--font-mono);">${r.outcome||'—'}</td>
              <td style="color:var(--accent-blue);font-family:var(--font-mono);">${r.corner||'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${matchRows}
    </div>`;
}

function rebuildTopLists() {
  latestTopLists.combo1   = window.scannedMatchesData.filter(x=>x.omegaPick&&x.omegaPick.includes('⚡')).sort((a,b)=>(b.strength||0)-(a.strength||0)).slice(0,5);
  latestTopLists.outcomes = window.scannedMatchesData.filter(x=>x.omegaPick&&(x.omegaPick.includes('ΑΣΟΣ')||x.omegaPick.includes('ΔΙΠΛΟ'))).sort((a,b)=>(b.strength||0)-(a.strength||0)).slice(0,5);
  latestTopLists.exact    = [...window.scannedMatchesData].filter(x=>x.exactConf).sort((a,b)=>(b.exactConf||0)-(a.exactConf||0)).slice(0,5);
  latestTopLists.over25   = window.scannedMatchesData.filter(x=>x.omegaPick&&x.omegaPick.includes('OVER 2.5')).sort((a,b)=>(b.strength||0)-(a.strength||0)).slice(0,5);
  latestTopLists.over35   = window.scannedMatchesData.filter(x=>x.omegaPick&&x.omegaPick.includes('OVER 3.5')).sort((a,b)=>(b.strength||0)-(a.strength||0)).slice(0,5);
  latestTopLists.under25  = window.scannedMatchesData.filter(x=>x.omegaPick&&x.omegaPick.includes('UNDER 2.5')).sort((a,b)=>(b.strength||0)-(a.strength||0)).slice(0,5);
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
  tabs.forEach((t,i)=>{
    html+=`<button class="tab-btn ${i===0?'active':''}" onclick="switchTab('${t.id}')" id="tab-btn-${t.id}">${t.lbl} <span class="tab-count">${t.d.length}</span></button>`;
  });
  html+=`</div>`;
  tabs.forEach((t,i)=>{
    html+=`<div class="pred-tab-panel" style="display:${i===0?'block':'none'}" id="tabpanel-${t.id}">
      <div style="padding:0 20px 20px 20px; display:flex; flex-direction:column; gap:8px;">`;
    if(!t.d.length) html+=`<div style="text-align:center;color:var(--text-muted);padding:20px 0;font-weight:600;">No high-confidence signals found.</div>`;
    t.d.forEach((x,j)=>{
      const rawVal = t.id === 'exact' ? x.exact : Number(x[t.sk] || 0);
      const val = t.id === 'exact' ? rawVal : rawVal.toFixed(1);
      html+=`
      <div onclick="scrollToMatch('card-${x.fixId}')" style="display:flex; align-items:center; gap:16px; padding:12px; background:var(--bg-base); border:1px solid var(--border-light); border-radius:var(--radius-sm); cursor:pointer; transition:border-color 0.2s;">
        <div class="mono" style="color:var(--text-muted); font-size:1.2rem;">#${j+1}</div>
        <div style="flex:1;">
          <div style="font-weight:700; font-size:0.9rem;">${esc(x.ht)} <span style="color:var(--text-muted)">vs</span> ${esc(x.at)}</div>
          <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">${esc(x.lg)}</div>
          <div style="font-size:0.7rem; color:var(--accent-green); font-weight:600; margin-top:2px;">${esc(x.omegaPick)}</div>
        </div>
        <div style="text-align:right;">
          <div class="mono" style="color:var(--accent-blue); font-size:1.1rem;">${val}</div>
          <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">${t.sl}</div>
        </div>
      </div>`;
    });
    html+=`</div></div>`;
  });
  html+=`</div>`;
  document.getElementById('topSection').innerHTML=html;
}

window.filterFeed = function(){
  const filter=document.getElementById('marketFilter').value; let html=''; let n=0;
  window.scannedMatchesData.forEach(d=>{
    let show=false; const pick=d.omegaPick || "";
    if(filter==='ALL')show=true;
    else if(filter==='COMBO'&&(pick.includes('👑')||pick.includes('⚡')))show=true;
    else if(filter==='1X2'&&(pick.includes('ΑΣΟΣ')||pick.includes('ΔΙΠΛΟ')))show=true;
    else if(filter==='O25'&&pick.includes('OVER 2.5'))show=true;
    else if(filter==='O35'&&pick.includes('OVER 3.5'))show=true;
    else if(filter==='U25'&&pick.includes('UNDER 2.5'))show=true;
    else if(filter==='BTTS'&&pick.includes('GOAL'))show=true;
    else if(filter==='CARDS'&&pick.includes('ΚΑΡΤΕΣ'))show=true;
    else if(filter==='COR'&&pick.includes('ΚΟΡΝΕΡ'))show=true;
    else if(filter==='BOMB'&&pick.includes('ΒΟΜΒΑ'))show=true;
    if(show){html+=getMatchCardHTML(d);n++;}
  });
  document.getElementById('matchesFeed').innerHTML=html;
  document.getElementById('feedCount').innerText=n;
};

// 12. SMART AUDIT
async function runCustomAudit() {
  if(isRunning) return;
  const s=document.getElementById('auditStart').value, e=document.getElementById('auditEnd').value;
  const lgFilter=document.getElementById('auditLeague').value;
  if(!s||!e){showErr('Επίλεξε εύρος ημερομηνιών.');return;}
  if(new Date(e)<new Date(s)){showErr("Η ημ/νία 'To' πρέπει να είναι >= 'From'.");return;}

  isRunning=true; clearAlerts(); setBtnsDisabled(true); setLoader(true,'Running AI Audit...');
  ['topSection','summarySection','wallbetSection','matchesFeed','advisorSection'].forEach(id=>document.getElementById(id).innerHTML='');

  try {
    const endD=new Date(e); endD.setDate(endD.getDate()+1);
    let cands=getPredStore().filter(x=>{const d=new Date(x.date);return d>=new Date(s)&&d<endD;});
    if(lgFilter!=='ALL') cands=cands.filter(x=>String(x.leagueId)===lgFilter);
    if(!cands.length){document.getElementById('auditSection').innerHTML=`<div class="quant-panel">Δεν υπάρχουν ιστορικά δεδομένα.</div>`;return;}

    const BATCH=20;
    const fixtureResultMap=new Map();
    for(let i=0;i<cands.length;i+=BATCH){
      const batch=cands.slice(i,i+BATCH);
      const ids=batch.map(x=>x.fixtureId).join('-');
      setProgress(Math.round(((i+BATCH)/cands.length)*100),`Auditing batch ${Math.floor(i/BATCH)+1}...`);
      const fr=await apiReq(`fixtures?ids=${ids}`);
      (fr?.response||[]).forEach(fix=>fixtureResultMap.set(fix.fixture.id,fix));
    }

    let rows=[], stats={games:0,outHit:0,validOut:0,o25Tot:0,o25Hit:0,o35Tot:0,o35Hit:0,u25Tot:0,u25Hit:0,exHit:0,bttsTot:0,bttsHit:0, corTot:0, corHit:0, cardTot:0, cardHit:0};
    const perLgStats={};

    for(const p of cands){
      const fix=fixtureResultMap.get(p.fixtureId);
      if(!fix||!isFinished(fix?.fixture?.status?.short)) continue;
      const ah=safeNum(fix.goals.home), aa=safeNum(fix.goals.away);
      const atot=ah+aa, aExact=`${ah}-${aa}`, aOut=ah>aa?'1':(ah<aa?'2':'X'), aBtts=ah>0&&aa>0;
      const pOut=p.outPick||'-', pEx=p.exactScorePred||'-', pOmega=p.omegaPick||'-';
      const hitOut=pOut===aOut, hitEx=pEx===aExact;
      
      let aCor = '-', aCards = '-';
      if (pOmega.includes('ΚΟΡΝΕΡ') || pOmega.includes('ΚΑΡΤΕΣ')) {
          const st = await apiReq(`fixtures/statistics?fixture=${p.fixtureId}`);
          if(st?.response?.length >= 2) {
              const hSt = st.response[0].statistics;
              const aSt = st.response[1].statistics;
              aCor = statVal(hSt, 'Corner Kicks') + statVal(aSt, 'Corner Kicks');
              aCards = statVal(hSt, 'Yellow Cards') + statVal(hSt, 'Red Cards') + statVal(aSt, 'Yellow Cards') + statVal(aSt, 'Red Cards');
          }
          if (pOmega.includes('ΚΟΡΝΕΡ')) {
              stats.corTot++;
              if (aCor !== '-' && aCor > 8.5) stats.corHit++;
          }
          if (pOmega.includes('ΚΑΡΤΕΣ')) {
              stats.cardTot++;
              if (aCards !== '-' && aCards > 5.5) stats.cardHit++;
          }
      }

      stats.games++;
      if(pOut==='1'||pOut==='2'){stats.validOut++;if(hitOut)stats.outHit++;}
      if(hitEx) stats.exHit++;
      if(p.predOver25){stats.o25Tot++;if(atot>2.5)stats.o25Hit++;}
      if(p.predOver35){stats.o35Tot++;if(atot>3.5)stats.o35Hit++;}
      if(p.predUnder25){stats.u25Tot++;if(atot<2.5)stats.u25Hit++;}
      if(p.predBTTS){stats.bttsTot++;if(aBtts)stats.bttsHit++;}

      if(p.leagueId){
        if(!perLgStats[p.leagueId]) perLgStats[p.leagueId]={o25T:0,o25H:0,o35T:0,o35H:0,u25T:0,u25H:0,bttsT:0,bttsH:0,outT:0,outH:0};
        const ls=perLgStats[p.leagueId];
        if(p.predOver25){ls.o25T++;if(atot>2.5)ls.o25H++;}
        if(p.predOver35){ls.o35T++;if(atot>3.5)ls.o35H++;}
        if(p.predUnder25){ls.u25T++;if(atot<2.5)ls.u25H++;}
        if(p.predBTTS){ls.bttsT++;if(aBtts)ls.bttsH++;}
        if(pOut==='1'||pOut==='2'){ls.outT++;if(hitOut)ls.outH++;}
      }
      rows.push({date:p.date?.slice(0,10),lg:p.league,match:`${p.homeTeam} vs ${p.awayTeam}`,pOut,aOut,hitOut,pO25:p.predOver25,aO25:atot>2.5,pO35:p.predOver35,aO35:atot>3.5,pU25:p.predUnder25,aU25:atot<2.5,pBtts:p.predBTTS,aBtts,pEx,aEx:aExact,hitEx,omega:pOmega, aTot:atot, aCor, aCards});
    }

    if(!stats.games){document.getElementById('auditSection').innerHTML=`<div class="quant-panel">Δεν βρέθηκαν ολοκληρωμένοι αγώνες.</div>`;return;}

    const finalLgRates={};
    for(const lid in perLgStats){
      const ls=perLgStats[lid];
      finalLgRates[lid]={
        o25:ls.o25T>0?(ls.o25H/ls.o25T)*100:0, o35:ls.o35T>0?(ls.o35H/ls.o35T)*100:0,
        btts:ls.bttsT>0?(ls.bttsH/ls.bttsT)*100:0, out:ls.outT>0?(ls.outH/ls.outT)*100:0
      };
    }
    buildLeagueModTable(finalLgRates);

    const rate=(h,t)=>t>0?(h/t)*100:0;
    const outRate=rate(stats.outHit,stats.validOut), o25Rate=rate(stats.o25Hit,stats.o25Tot);
    const o35Rate=rate(stats.o35Hit,stats.o35Tot), u25Rate=rate(stats.u25Hit,stats.u25Tot);
    const bttsRate=rate(stats.bttsHit,stats.bttsTot), exRate=rate(stats.exHit,stats.games);
    const corRate=rate(stats.corHit,stats.corTot), cardRate=rate(stats.cardHit,stats.cardTot);

    const TARGET_1X2=80, TARGET_O25=80, TARGET_O35=70, TARGET_BTTS=70, TARGET_U25=70;
    let suggestions=[];
    const currentO25  = lgFilter!=='ALL'&&leagueMods[lgFilter]?.minXGO25!==undefined?Number(leagueMods[lgFilter].minXGO25):Number(engineConfig.tXG_O25);
    const currentO35  = lgFilter!=='ALL'&&leagueMods[lgFilter]?.minXGO35!==undefined?Number(leagueMods[lgFilter].minXGO35):Number(engineConfig.tXG_O35);
    const currentBTTS = lgFilter!=='ALL'&&leagueMods[lgFilter]?.minBTTS!==undefined?Number(leagueMods[lgFilter].minBTTS):Number(engineConfig.tBTTS);
    const currentDiff = lgFilter!=='ALL'&&leagueMods[lgFilter]?.xgDiff!==undefined?Number(leagueMods[lgFilter].xgDiff):Number(engineConfig.xG_Diff);

    const nextDiff = Math.min(currentDiff + 0.05, 0.70); 
    const nextO25 = Math.min(currentO25 + 0.10, 3.00);   
    const nextO35 = Math.min(currentO35 + 0.10, 3.80);   
    const nextBTTS = Math.min(currentBTTS + 0.05, 1.35); 

    if(stats.validOut > 0 && outRate < TARGET_1X2 && currentDiff < 0.70)  
      suggestions.push({key:'xG_Diff', label:'xG Diff (1X2)', rate:outRate, tgt:TARGET_1X2, oldV:currentDiff, newV:nextDiff.toFixed(2)});
    if(stats.o25Tot > 0 && o25Rate < TARGET_O25 && currentO25 < 3.00)    
      suggestions.push({key:'tXG_O25', label:'Min xG (O2.5)', rate:o25Rate, tgt:TARGET_O25, oldV:currentO25, newV:nextO25.toFixed(2)});
    if(stats.o35Tot > 0 && o35Rate < TARGET_O35 && currentO35 < 3.80)    
      suggestions.push({key:'tXG_O35', label:'Min xG (O3.5)', rate:o35Rate, tgt:TARGET_O35, oldV:currentO35, newV:nextO35.toFixed(2)});
    if(stats.bttsTot > 0 && bttsRate < TARGET_BTTS && currentBTTS < 1.35) 
      suggestions.push({key:'tBTTS',   label:'Min xG (BTTS)', rate:bttsRate, tgt:TARGET_BTTS, oldV:currentBTTS, newV:nextBTTS.toFixed(2)});

    let advisorHtml='';
    if(suggestions.length>0){
      advisorHtml=`<div class="quant-panel" style="border-color:rgba(167,139,250,0.35);"><div class="panel-title" style="color:var(--accent-purple)">🤖 AI CALIBRATION: ${lgFilter==='ALL'?'GLOBAL':esc(rows[0]?.lg||'')}</div>`;
      suggestions.forEach(sg=>advisorHtml+=`<div class="adv-card"><div class="adv-icon">🔧</div><div class="adv-content"><div class="adv-title">${sg.label} <span style="color:var(--accent-red)">(${Number(sg.rate).toFixed(1)}% vs ${sg.tgt}%)</span></div><div class="adv-desc">Αλλαγή: <span class="mono">${Number(sg.oldV).toFixed(2)}</span> → <span style="color:var(--accent-blue);font-weight:700;" class="mono">${sg.newV}</span></div></div><button class="btn btn-primary" onclick="applyAdvisorItem('${sg.key}','${sg.newV}','${lgFilter}')">Apply</button></div>`);
      const pairs=suggestions.map(sg=>`${sg.key},${sg.newV}`).join('|');
      advisorHtml+=`<button class="btn btn-gold" style="margin-top:8px;width:100%;" onclick="applyAllAdvisor('${pairs}','${lgFilter}')">Apply All</button></div>`;
    } else {
      advisorHtml=`<div class="quant-panel" style="border-color:rgba(52,211,153,0.3)"><div class="panel-title" style="color:var(--accent-green)">🤖 AI STATUS: ${lgFilter==='ALL'?'GLOBAL':esc(rows[0]?.lg||'')}</div><div style="font-size:0.8rem;color:var(--accent-green);margin-top:8px;">✓ Όλα τα metrics πληρούν τους στόχους. Δεν απαιτείται επανακαθορισμός.</div></div>`;
    }
    document.getElementById('advisorSection').innerHTML=advisorHtml;

    const fmtR=(r,tgt)=>{const c=r>=tgt?'var(--accent-green)':r>=(tgt-10)?'var(--accent-gold)':'var(--accent-red)';return`<span style="color:${c};">${Number(r).toFixed(1)}%</span>`;};
    
    const prBox = (pred, isTrue, resVal, hitCondition) => {
        if (!pred || pred === '-' || pred === 'X' && hitCondition === undefined) return '<span class="icon-neutral">—</span>';
        let hitClass = isTrue ? 'icon-hit' : 'icon-miss';
        let hitIcon = isTrue ? '✓' : '✗';
        return `<div class="pred-res-box" title="Pred: ${pred} | Actual: ${resVal}">
            <div class="pr-val pr-pred"><span style="font-size:0.5rem;opacity:0.6;margin-right:2px">P:</span>${pred}</div>
            <div class="${hitClass}">${hitIcon}</div>
            <div class="pr-val pr-res"><span style="font-size:0.5rem;opacity:0.6;margin-right:2px">A:</span>${resVal}</div>
        </div>`;
    };

    document.getElementById('auditSection').innerHTML=`
      <div class="quant-panel">
        <div class="panel-title">📊 Audit Telemetry (${s} → ${e})</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:18px;text-align:center;">
          <div class="stat-box"><div class="stat-val" style="font-size:1.2rem;">${fmtR(outRate,80)}</div><div class="stat-lbl">1X2<br>${stats.validOut} σήματα</div></div>
          <div class="stat-box"><div class="stat-val" style="font-size:1.2rem;">${fmtR(o25Rate,80)}</div><div class="stat-lbl">O2.5<br>${stats.o25Tot} σήματα</div></div>
          <div class="stat-box"><div class="stat-val" style="font-size:1.2rem;">${fmtR(o35Rate,70)}</div><div class="stat-lbl">O3.5<br>${stats.o35Tot} σήματα</div></div>
          <div class="stat-box"><div class="stat-val" style="font-size:1.2rem;">${fmtR(u25Rate,70)}</div><div class="stat-lbl">U2.5<br>${stats.u25Tot} σήματα</div></div>
          <div class="stat-box"><div class="stat-val" style="font-size:1.2rem;">${fmtR(bttsRate,70)}</div><div class="stat-lbl">BTTS<br>${stats.bttsTot} σήματα</div></div>
          <div class="stat-box"><div class="stat-val" style="font-size:1.2rem;color:var(--accent-blue)">${Number(exRate).toFixed(1)}%</div><div class="stat-lbl">EXACT<br>${stats.games} αγώνες</div></div>
          ${stats.corTot>0?`<div class="stat-box"><div class="stat-val" style="font-size:1.2rem;">${fmtR(corRate,80)}</div><div class="stat-lbl">CORNERS<br>${stats.corTot} σήματα</div></div>`:''}
          ${stats.cardTot>0?`<div class="stat-box"><div class="stat-val" style="font-size:1.2rem;">${fmtR(cardRate,75)}</div><div class="stat-lbl">CARDS<br>${stats.cardTot} σήματα</div></div>`:''}
        </div>
        <div class="data-table-wrapper">
          <table class="audit-table">
            <thead><tr>
              <th class="audit-match-col" style="width:28%">Αγώνας / Ημ.</th>
              <th style="width:16%">Signal</th>
              <th style="width:11%">1X2</th>
              <th style="width:11%">O2.5</th>
              <th style="width:11%">U2.5</th>
              <th style="width:11%">BTTS</th>
              <th style="width:12%">Exact</th>
            </tr></thead>
            <tbody>
            ${rows.map(r=>`<tr>
              <td class="audit-match-col">
                <span class="audit-match-name">${esc(r.match)}</span> <span class="audit-match-score">ΤΕΛΙΚΟ: ${r.aEx}</span>
                <span class="audit-date">${r.date} · ${esc(r.lg)}</span>
              </td>
              <td class="audit-signal-col" style="color:${r.omega.includes('NO BET')?'var(--text-muted)':r.omega.includes('UNDER')?'var(--accent-teal)':'var(--accent-green)'};">${esc(r.omega)}</td>
              <td>${prBox(r.pOut, r.hitOut, r.aOut, r.hitOut)}</td>
              <td>${r.pO25 ? prBox('O2.5', r.aO25, r.aTot) : '<span class="icon-neutral">—</span>'}</td>
              <td>${r.pU25 ? prBox('U2.5', r.aU25, r.aTot) : '<span class="icon-neutral">—</span>'}</td>
              <td>${r.pBtts ? prBox('BTTS', r.aBtts, r.aBtts ? 'Y' : 'N') : '<span class="icon-neutral">—</span>'}</td>
              <td>${prBox(r.pEx, r.hitEx, r.aEx, true)}</td>
            </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    showOk('Audit ολοκληρώθηκε.');
  } catch(e){ showErr(e.message); }
  finally { isRunning=false; setLoader(false); setBtnsDisabled(false); }
}

// 13. INIT
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('scanStart').value = todayISO();
  document.getElementById('scanEnd').value   = todayISO();
  const d30=new Date(); d30.setDate(d30.getDate()-15);
  document.getElementById('auditStart').value=d30.toISOString().split('T')[0];
  document.getElementById('auditEnd').value  =todayISO();
  updateAuditLeagueFilter();
  const sel=document.getElementById('leagueFilter');
  LEAGUES_DATA.forEach(l=>sel.innerHTML+=`<option value="${l.id}">${l.name}</option>`);
});
</script>
</body>
</html>