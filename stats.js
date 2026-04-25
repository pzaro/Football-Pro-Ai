// ==========================================================================
// APEX OMEGA v5.0 — MASTER ENGINE (All Features + Post-Match Evolution)
// Poisson · xG · Corners · Live Sync · Audit · Bankroll · Evolution Tracker
// ==========================================================================

const API_BASE = "https://v3.football.api-sports.io";
let API_KEY    = "956cbd05f9e9bf934df78d9b72d9a3a0";

const LS_PREDS    = "omega_preds_v5.0";
const LS_SETTINGS = "omega_settings_v5.0";
const LS_LGMODS   = "omega_lgmods_v5.0";
const LS_BANKROLL = "omega_bankroll_v5.0";

let teamStatsCache = new Map(), lastFixCache = new Map(),
    standCache = new Map(), h2hCache = new Map();
let isRunning = false, currentCredits = null;
let latestTopLists = { exact:[], combo1:[], outcomes:[], over25:[], over35:[], under25:[], corners:[], bombs:[] };
window.scannedMatchesData = [];
let bankrollData = { current: 0, history: [] };

const DEFAULT_SETTINGS = {
  wShotsOn:0.14, wShotsOff:0.04, wCorners:0.02, wGoals:0.20,
  tXG_O25:2.70,  tXG_O35:3.25,   tXG_U25:1.80,  tBTTS_U25:0.65,
  xG_Diff:0.55,  tBTTS:1.10,     modTrap:0.90,  modTight:0.95,  modGold:1.15,
  minCorners:10.5, minCards:5.8
};
let engineConfig = { ...DEFAULT_SETTINGS };
let leagueMods   = {};

const SETTINGS_MAP = {
  cfg_wShotsOn:'wShotsOn', cfg_wShotsOff:'wShotsOff', cfg_wCorners:'wCorners', cfg_wGoals:'wGoals',
  cfg_tXG_O25:'tXG_O25',   cfg_tXG_O35:'tXG_O35',     cfg_tXG_U25:'tXG_U25',  cfg_tBTTS_U25:'tBTTS_U25',
  cfg_xG_Diff:'xG_Diff',   cfg_tBTTS:'tBTTS',         cfg_minCorners:'minCorners',
  cfg_modTrap:'modTrap',   cfg_modTight:'modTight',   cfg_modGold:'modGold'
};

const _apiQueue = []; let _apiActive = 0;
const MAX_CONCURRENT = 5, REQUEST_GAP_MS = 300;
let _errTimer = null, _okTimer = null;

// ================================================================
//  UTILITIES
// ================================================================
const safeNum  = (x,d=0) => Number.isFinite(Number(x))?Number(x):d;
const clamp    = (n,mn,mx) => Math.max(mn,Math.min(mx,n));
const statVal  = (arr,type) => {
  const v = (arr.find(x=>x.type===type)||{}).value;
  if(v===null||v===undefined) return 0;
  return parseFloat(String(v).replace('%',''))||0;
};
const getTeamGoals = (f,t) => f?.teams?.home?.id===t?(f?.goals?.home??0):(f?.goals?.away??0);
const getOppGoals  = (f,t) => f?.teams?.home?.id===t?(f?.goals?.away??0):(f?.goals?.home??0);
const isLive     = s => ["1H","2H","HT","LIVE","ET","BT","P"].includes(s);
const isFinished = s => ["FT","AET","PEN"].includes(s);
const esc = s => String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const todayISO = () => new Date().toISOString().split('T')[0];
const pct = v => (v*100).toFixed(1)+'%';

function getDatesInRange(s,e){const d=[];let c=new Date(s),end=new Date(e);while(c<=end){d.push(c.toISOString().split('T')[0]);c.setDate(c.getDate()+1);}return d;}

window.togglePanel = function(panelId,arrowId){
  const p=document.getElementById(panelId),a=document.getElementById(arrowId);
  if(!p)return;const open=p.style.display==='none';
  p.style.display=open?'block':'none';if(a)a.innerText=open?'▲':'▼';
};
function setLoader(show,text=''){
  const l=document.getElementById('loader'),s=document.getElementById('status'),b=document.getElementById('bar');
  if(l)l.style.display=show?'block':'none';if(s)s.textContent=text;if(!show&&b)b.style.width='0%';
}
function setProgress(p,text=''){
  const b=document.getElementById('bar'),s=document.getElementById('status');
  if(b)b.style.width=Math.round(clamp(p,0,100))+'%';
  if(s)s.textContent=text+(_apiActive>0?` [${_apiActive} req]`:'');
}
function setBtnsDisabled(d){['btnPre','leagueFilter','btnSyncLive'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=d;});}
function showErr(msg){clearTimeout(_errTimer);const box=document.getElementById('errorBox');if(!box)return;box.innerHTML=`<div>⚠️ ${esc(msg)}</div>`;_errTimer=setTimeout(()=>box.innerHTML='',6000);}
function showOk(msg){clearTimeout(_okTimer);const box=document.getElementById('successBox');if(!box)return;box.innerHTML=`<div>✓ ${esc(msg)}</div>`;_okTimer=setTimeout(()=>box.innerHTML='',4000);}
function clearAlerts(){const e=document.getElementById('errorBox'),s=document.getElementById('successBox');if(e)e.innerHTML='';if(s)s.innerHTML='';}

// ================================================================
//  BANKROLL & EXPORT
// ================================================================
window.loadBankroll=function(){try{const b=JSON.parse(localStorage.getItem(LS_BANKROLL));if(b)bankrollData=b;}catch{}updateBankrollDisplay();};
function updateBankrollDisplay(){const el=document.getElementById('bankrollDisplay');if(el)el.textContent=bankrollData.current>0?`€${bankrollData.current.toFixed(2)}`:'Set';}
window.openBankroll=function(){document.getElementById('bankrollModal').style.display='flex';document.getElementById('bankrollInput').value=bankrollData.current||'';renderBankrollHistory();};
window.closeBankroll=function(){document.getElementById('bankrollModal').style.display='none';};
window.saveBankroll=function(){
  const val=parseFloat(document.getElementById('bankrollInput').value);
  if(isNaN(val)||val<=0){showErr('Εισάγετε έγκυρο ποσό.');return;}
  if(bankrollData.current!==val){bankrollData.history.unshift({date:todayISO(),amount:val,prev:bankrollData.current});if(bankrollData.history.length>20)bankrollData.history=bankrollData.history.slice(0,20);}
  bankrollData.current=val;try{localStorage.setItem(LS_BANKROLL,JSON.stringify(bankrollData));}catch{}
  updateBankrollDisplay();renderBankrollHistory();showOk(`Bankroll: €${val.toFixed(2)}`);
};
function renderBankrollHistory(){
  const div=document.getElementById('bankrollHistory');if(!div)return;
  if(!bankrollData.history.length){div.innerHTML='';return;}
  let html=`<table class="bk-table"><thead><tr><th>Ημερομηνία</th><th>Πριν</th><th>Νέο</th><th>Δ</th></tr></thead><tbody>`;
  bankrollData.history.slice(0,8).forEach(h=>{const diff=h.amount-h.prev,col=diff>=0?'var(--accent-green)':'var(--accent-red)';html+=`<tr><td>${h.date}</td><td>€${Number(h.prev).toFixed(2)}</td><td>€${Number(h.amount).toFixed(2)}</td><td style="color:${col}">${diff>=0?'+':''}€${diff.toFixed(2)}</td></tr>`;});
  div.innerHTML=html+`</tbody></table>`;
}

window.exportData=function(){if(!window.scannedMatchesData?.length){showErr("Δεν υπάρχουν δεδομένα.");return;}const blob=new Blob([JSON.stringify(window.scannedMatchesData)],{type:'application/json'});const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:`apex_export_${todayISO()}.json`});a.click();URL.revokeObjectURL(a.href);showOk("Export OK!");};
window.importData=function(ev){const file=ev.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=e=>{try{const imported=JSON.parse(e.target.result);if(!Array.isArray(imported))throw new Error("Invalid");window.scannedMatchesData=imported;rebuildTopLists();renderTopSections();renderSummaryTable();tickerRefresh();showOk(`Imported ${imported.length} αγώνες.`);}catch{showErr("Σφάλμα αρχείου.");}ev.target.value='';};reader.readAsText(file);};

// ================================================================
//  MATH / POISSON
// ================================================================
function normalCDF(z){if(z<-6)return 0;if(z>6)return 1;const t=1/(1+0.2316419*Math.abs(z));const poly=t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));const pdf=Math.exp(-0.5*z*z)/Math.sqrt(2*Math.PI);return z>=0?1-pdf*poly:pdf*poly;}
function poissonProb(lambda,k){if(lambda<=0)return k===0?1:0;let logP=-lambda+k*Math.log(lambda);for(let i=1;i<=k;i++)logP-=Math.log(i);return Math.exp(logP);}
function getPoissonProbabilities(hL,aL){
  let pHome=0,pDraw=0,pAway=0,pO25=0,pO35=0,pU25=0,pBTTS=0;let best={h:1,a:1,prob:0};const matrix=[];
  for(let h=0;h<=6;h++){matrix[h]=[];for(let a=0;a<=6;a++){const p=poissonProb(hL,h)*poissonProb(aL,a);matrix[h][a]=p;if(h>a)pHome+=p;else if(h<a)pAway+=p;else pDraw+=p;if(h+a>2.5)pO25+=p;if(h+a>3.5)pO35+=p;if(h+a<2.5)pU25+=p;if(h>0&&a>0)pBTTS+=p;if(p>best.prob)best={h,a,prob:p};}}
  return{pHome,pDraw,pAway,pO25,pO35,pU25,pBTTS,bestScore:best,matrix};
}
function getPoissonMatrixHTML(hL,aL,maxGoals=4){
  let html=`<div class="poisson-grid" style="grid-template-columns:repeat(${maxGoals+2},1fr);">`;
  html+=`<div class="poisson-cell" style="color:var(--text-muted)"></div>`;
  for(let a=0;a<=maxGoals;a++)html+=`<div class="poisson-cell" style="color:var(--accent-blue)">${a}</div>`;
  for(let h=0;h<=maxGoals;h++){
    html+=`<div class="poisson-cell" style="color:var(--accent-gold)">${h}</div>`;
    for(let a=0;a<=maxGoals;a++){const p=poissonProb(hL,h)*poissonProb(aL,a)*100;html+=`<div class="poisson-cell" style="background:rgba(56,189,248,${(p/12).toFixed(2)});color:${p>6?'#000':'var(--text-main)'}">${p.toFixed(1)}%</div>`;}
  }
  return html+`</div>`;
}

// ================================================================
//  API FETCHING
// ================================================================
async function apiReq(path){return new Promise(resolve=>{_apiQueue.push({path,resolve});_drainQueue();});}
async function _drainQueue(){while(_apiActive<MAX_CONCURRENT&&_apiQueue.length>0){const{path,resolve}=_apiQueue.shift();_apiActive++;_executeRequest(path,resolve);}}
async function _executeRequest(path,resolve){
  await new Promise(r=>setTimeout(r,Math.random()*80));
  try{const r=await fetch(`${API_BASE}/${path}`,{headers:{'x-apisports-key':API_KEY,'Accept':'application/json'}});
    if(r.ok){const data=await r.json();if(data.response&&typeof currentCredits==='number'){currentCredits--;const el=document.getElementById('creditDisplay');if(el){el.textContent=currentCredits;el.className='credit-value'+(currentCredits<50?' low':'');}}resolve(data);}else resolve({response:[]});
  }catch{resolve({response:[]});}finally{await new Promise(r=>setTimeout(r,REQUEST_GAP_MS));_apiActive--;_drainQueue();}
}
window.initCredits=async function(){try{const r=await fetch(`${API_BASE}/status`,{headers:{'x-apisports-key':API_KEY}});if(!r.ok)return;const d=await r.json();currentCredits=(d.response?.requests?.limit_day||500)-(d.response?.requests?.current||0);const el=document.getElementById('creditDisplay');if(el){el.textContent=currentCredits;el.className='credit-value'+(currentCredits<50?' low':'');}}catch{}};

async function getTStats(t,lg,s){const k=`${t}_${lg}_${s}`;if(teamStatsCache.has(k))return teamStatsCache.get(k);const d=await apiReq(`teams/statistics?team=${t}&league=${lg}&season=${s}`);teamStatsCache.set(k,d?.response||{});return d?.response||{};}
async function getLFix(t,lg,s){const k=`${t}_${lg}_${s}`;if(lastFixCache.has(k))return lastFixCache.get(k);const d=await apiReq(`fixtures?team=${t}&league=${lg}&season=${s}&last=20&status=FT`);lastFixCache.set(k,d?.response||[]);return d?.response||[];}
async function getStand(lg,s){const k=`${lg}_${s}`;if(standCache.has(k))return standCache.get(k);const d=await apiReq(`standings?league=${lg}&season=${s}`);const f=Array.isArray(d?.response?.[0]?.league?.standings)?d.response[0].league.standings.flat():[];standCache.set(k,f);return f;}
async function getH2H(t1,t2){const k=`${t1}_${t2}`;if(h2hCache.has(k))return h2hCache.get(k);const d=await apiReq(`fixtures/headtohead?h2h=${t1}-${t2}&last=8`);h2hCache.set(k,d?.response||[]);return d?.response||[];}
const getTeamRank=(st,tId)=>{const r=(st||[]).find(x=>String(x?.team?.id)===String(tId));return r?.rank??null;};

// ================================================================
//  INTEL BUILDER
// ================================================================
async function batchCalc(list,tId){
  if(!list?.length)return{xg:'1.10',xga:'1.10',cor:'4.5',crd:'2.0',corRatio:'3.5'};
  let tXG=0,tXGA=0,tCor=0,tCrd=0,n=0;
  for(const f of list){
    const myG=getTeamGoals(f,tId), opG=getOppGoals(f,tId);
    tXG+=myG>0?myG*1.10:0.42; tXGA+=opG>0?opG*1.10:0.42;
    const simCor=3.5+(myG*1.2)+(opG*0.3); const simCrd=1.5+(opG*0.8)+(myG*0.2);
    tCor+=simCor; tCrd+=simCrd; n++;
  }
  const avgXG=n>0?tXG/n:1.10; const avgCor=n>0?tCor/n:4.5; const ratio=avgXG>0?avgCor/Math.max(avgXG,0.5):3.5;
  return{xg:avgXG.toFixed(2),xga:n>0?(tXGA/n).toFixed(2):'1.10',cor:avgCor.toFixed(1),crd:n>0?(tCrd/n).toFixed(1):'2.0',corRatio:clamp(ratio,2.0,5.5).toFixed(2)};
}

function getFormHistory(fixtures,teamId){return fixtures.map(f=>{const my=getTeamGoals(f,teamId),op=getOppGoals(f,teamId);return my>op?{res:'W',cls:'W'}:my<op?{res:'L',cls:'L'}:{res:'D',cls:'D'};}).reverse();}
function getFormRating(hist){if(!hist?.length)return 50;const w=[1,0.8,0.6,0.4,0.2];let score=0,tw=0;hist.slice(0,5).forEach((h,i)=>{const wi=w[i]||0.1,pts=h.res==='W'?100:h.res==='D'?33:0;score+=pts*wi;tw+=wi;});return tw>0?Math.round(score/tw):50;}

async function buildIntel(tId,lg,s,isHome){
  try{
    const[ss,allFix]=await Promise.all([getTStats(tId,lg,s),getLFix(tId,lg,s)]);
    const gen=allFix.slice(0,6);const split=allFix.filter(f=>(isHome?f.teams.home.id:f.teams.away.id)===tId).slice(0,6);
    const[fData,sData]=await Promise.all([batchCalc(gen,tId),batchCalc(split,tId)]);
    const sXG=parseFloat(ss?.goals?.for?.average?.total)||1.35, sXGA=parseFloat(ss?.goals?.against?.average?.total)||1.35;
    return{
      fXG:Math.max(safeNum(fData.xg,sXG),0.80), fXGA:Math.max(safeNum(fData.xga,sXGA),0.80), sXG:Math.max(safeNum(sData.xg,sXG),0.80),
      formRating:getFormRating(getFormHistory(gen,tId)),
      corRatio:safeNum(fData.corRatio, 3.5), cor:safeNum(fData.cor, 4.8), crd:safeNum(fData.crd, 2.1),
      uiXG:fData.xg, uiXGA:fData.xga, uiSXG:sData.xg, uiSXGA:sData.xga,
      history:getFormHistory(gen,tId)
    };
  }catch{return{fXG:1.35,fXGA:1.35,sXG:1.35,formRating:50,corRatio:3.5,cor:4.8,crd:2.1,uiXG:'1.35',uiXGA:'1.35',uiSXG:'1.35',uiSXGA:'1.35',history:[]};}
}

function summarizeH2H(fixtures,homeId,awayId){
  let hw=0,aw=0,dr=0,hG=0,aG=0;
  for(const f of(fixtures||[]).slice(0,8)){const myG=f?.teams?.home?.id===homeId?f?.goals?.home??0:f?.goals?.away??0;const opG=f?.teams?.home?.id===awayId?f?.goals?.home??0:f?.goals?.away??0;hG+=myG;aG+=opG;if(myG>opG)hw++;else if(opG>myG)aw++;else dr++;}
  const t=hw+aw+dr||1;return{homeWins:hw,awayWins:aw,draws:dr,h2hAvgGoals:((hG+aG)/t).toFixed(2)};
}

function getLeagueParams(leagueId){
  const lm=leagueMods[leagueId]||{};
  let defDiff=engineConfig.xG_Diff,defMult=1.00;
  if(typeof TIGHT_LEAGUES!=='undefined'&&TIGHT_LEAGUES.has(leagueId))defDiff=0.35;
  else if(typeof GOLD_LEAGUES!=='undefined'&&GOLD_LEAGUES.has(leagueId))defDiff=0.65;
  if(typeof GOLD_LEAGUES!=='undefined'&&GOLD_LEAGUES.has(leagueId))defMult=engineConfig.modGold;
  else if(typeof TRAP_LEAGUES!=='undefined'&&TRAP_LEAGUES.has(leagueId))defMult=engineConfig.modTrap;
  else if(typeof TIGHT_LEAGUES!=='undefined'&&TIGHT_LEAGUES.has(leagueId))defMult=engineConfig.modTight;
  return{mult:lm.mult??defMult,minXGO25:lm.minXGO25??engineConfig.tXG_O25,minXGO35:lm.minXGO35??engineConfig.tXG_O35,maxU25:lm.maxU25??engineConfig.tXG_U25,minBTTS:lm.minBTTS??engineConfig.tBTTS,xgDiff:lm.xgDiff??defDiff};
}

function computeCornerConfidence(hS,aS,hXG,aXG){
  const expH=hXG*safeNum(hS.corRatio,3.5),expA=aXG*safeNum(aS.corRatio,3.5);
  let expCor=expH+expA;const xgD=Math.abs(hXG-aXG);
  if(xgD>0.8)expCor+=clamp((xgD-0.8)*1.5,0,2.0);
  const z=(8.5-expCor)/(Math.sqrt(Math.max(expCor,0.1))*0.85);
  let score=(1-normalCDF(z))*100;
  const baseCor=safeNum(hS.cor,4.8)+safeNum(aS.cor,4.8);
  if(baseCor<engineConfig.minCorners)score-=(engineConfig.minCorners-baseCor)*8;
  return { conf: clamp(score,0,99), expCor };
}

// ================================================================
//  PICK ENGINE
// ================================================================
function computePick(hXG,aXG,tXG,btts,lp,hS,aS){
  const hL=clamp(hXG*lp.mult,0.15,4.0),aL=clamp(aXG*lp.mult,0.15,4.0);
  const pp=getPoissonProbabilities(hL,aL);const xgDiff=hXG-aXG;
  let outPick='X';
  if(pp.pHome-pp.pAway>0.15&&xgDiff>lp.xgDiff)outPick='1';
  else if(pp.pAway-pp.pHome>0.15&&xgDiff<-lp.xgDiff)outPick='2';
  
  const cornerRes=computeCornerConfidence(hS,aS,hXG,aXG);
  const totCards=safeNum(hS.crd,2.1)+safeNum(aS.crd,2.1);
  
  let omegaPick='NO BET',reason='Insufficient statistical edge.',pickScore=0;
  if(pp.pO35>=0.42&&tXG>=lp.minXGO35&&btts>=1.20){omegaPick='🚀 OVER 3.5 GOALS';pickScore=pp.pO35*100;reason=`Poisson O3.5: ${pct(pp.pO35)} | tXG:${tXG.toFixed(2)}`;}
  else if(pp.pO25>=0.52&&tXG>=lp.minXGO25&&btts>=0.85){omegaPick='🔥 OVER 2.5 GOALS';pickScore=pp.pO25*100;reason=`Poisson O2.5: ${pct(pp.pO25)} | tXG:${tXG.toFixed(2)}`;}
  else if(pp.pU25>=0.55&&tXG<=lp.maxU25&&btts<=engineConfig.tBTTS_U25){omegaPick='🔒 UNDER 2.5 GOALS';pickScore=pp.pU25*100;reason=`Poisson U2.5: ${pct(pp.pU25)} | tXG:${tXG.toFixed(2)}`;}
  else if(btts>=lp.minBTTS&&pp.pBTTS>=0.48&&hXG>=0.90&&aXG>=0.90){omegaPick='🎯 GOAL/GOAL (BTTS)';pickScore=pp.pBTTS*100;reason=`BTTS: ${pct(pp.pBTTS)}`;}
  else if(outPick!=='X'&&Math.abs(xgDiff)>=lp.xgDiff+0.10){
    const outcome=outPick==='1'?'🏠 ΑΣΟΣ':'✈️ ΔΙΠΛΟ';const outProb=outPick==='1'?pp.pHome:pp.pAway;const formOk=outPick==='1'?hS.formRating>=40:aS.formRating>=40;
    if(outProb>=0.52&&formOk){omegaPick=outProb>=0.60?`⚡ ${outcome}`:outcome;pickScore=outProb*100;reason=`Poisson ${outPick==='1'?'Home':'Away'}: ${pct(outProb)}`;}
  }
  else if(cornerRes.conf>=65){omegaPick='🚩 OVER 8.5 ΚΟΡΝΕΡ';pickScore=cornerRes.conf;reason=`Corner Model: ${cornerRes.conf.toFixed(1)}%`;}
  else if(totCards>=engineConfig.minCards&&Math.abs(xgDiff)<0.45){omegaPick='🟨 OVER 5.5 ΚΑΡΤΕΣ';pickScore=clamp((totCards-5.0)*20,0,85);reason=`Avg Cards: ${totCards.toFixed(1)}`;}
  
  const exactConf=Math.round(clamp(pp.bestScore.prob*100*8,0,99));
  return{omegaPick,reason,pickScore,outPick,hG:pp.bestScore.h,aG:pp.bestScore.a,hExp:hL,aExp:aL,exactConf,xgDiff,pp,cornerConf:cornerRes.conf,expCor:cornerRes.expCor,lambdaTotal:hL+aL};
}

// ================================================================
//  SCANNER MAIN LOOP
// ================================================================
async function analyzeMatchSafe(m,index,total){
  try{
    setProgress(10+((index+1)/total)*88,`Processing ${index+1}/${total}: ${m.teams.home.name}`);
    const[hS,aS,stand,h2hFix]=await Promise.all([buildIntel(m.teams.home.id,m.league.id,m.league.season,true),buildIntel(m.teams.away.id,m.league.id,m.league.season,false),getStand(m.league.id,m.league.season),getH2H(m.teams.home.id,m.teams.away.id)]);
    const lp=getLeagueParams(m.league.id);const hXG=Number(hS.fXG)*lp.mult,aXG=Number(aS.fXG)*lp.mult;
    const tXG=hXG+aXG,bttsScore=Math.min(hXG,aXG);const result=computePick(hXG,aXG,tXG,bttsScore,lp,hS,aS);
    
    // FETCH ACTUAL STATS IF MATCH IS FINISHED (FOR POST-MATCH EVOLUTION)
    let actStats = null;
    if (isFinished(m.fixture.status.short)) {
      const sr = await apiReq(`fixtures/statistics?fixture=${m.fixture.id}`);
      if(sr.response && sr.response.length === 2) {
        const hs = sr.response[0].statistics; const as = sr.response[1].statistics;
        actStats = {
          hPoss: statVal(hs, 'Ball Possession'), aPoss: statVal(as, 'Ball Possession'),
          hCor: statVal(hs, 'Corner Kicks'), aCor: statVal(as, 'Corner Kicks'),
          hCrd: statVal(hs, 'Yellow Cards') + statVal(hs, 'Red Cards'), aCrd: statVal(as, 'Yellow Cards') + statVal(as, 'Red Cards'),
          hXg: statVal(hs, 'expected_goals'), aXg: statVal(as, 'expected_goals')
        };
      }
    }

    window.scannedMatchesData.push({
      m,fixId:m.fixture.id,ht:m.teams.home.name,at:m.teams.away.name,lg:m.league.name,leagueId:m.league.id,
      tXG,btts:bttsScore,outPick:result.outPick,xgDiff:result.xgDiff,exact:`${result.hG}-${result.aG}`,exactConf:result.exactConf,
      omegaPick:result.omegaPick,strength:result.pickScore,reason:result.reason,hExp:result.hExp,aExp:result.aExp,pp:result.pp,
      lambdaTotal:result.lambdaTotal,cornerConf:result.cornerConf,expCor:result.expCor,hr:getTeamRank(stand,m.teams.home.id)??99,ar:getTeamRank(stand,m.teams.away.id)??99,hS,aS,h2h:summarizeH2H(h2hFix,m.teams.home.id,m.teams.away.id),
      actStats, isBomb:false
    });
  }catch(err){
    window.scannedMatchesData.push({m,fixId:m.fixture.id,ht:m.teams.home.name,at:m.teams.away.name,lg:m.league.name,leagueId:m.league.id,omegaPick:'NO BET',reason:'Analysis error',strength:0,tXG:0,outPick:'X',exact:'0-0',cornerConf:0});
  }
}

window.runScan=async function(){
  if(isRunning)return;
  const startD=document.getElementById('scanStart').value||todayISO();const endD=document.getElementById('scanEnd').value||startD;
  if(new Date(endD)<new Date(startD)){showErr("Λάθος ημερομηνία.");return;}
  isRunning=true;clearAlerts();setBtnsDisabled(true);setLoader(true,'Initializing Deep Quant...');
  ['topSection','summarySection','advisorSection','auditSection'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='';});
  window.scannedMatchesData=[];teamStatsCache.clear();lastFixCache.clear();standCache.clear();h2hCache.clear();
  try{
    const selLg=document.getElementById('leagueFilter').value;let all=[];
    for(const date of getDatesInRange(startD,endD)){
      setProgress(5,`Fetching ${date}...`);const res=await apiReq(`fixtures?date=${date}`);
      const dm=(res.response||[]).filter(m=>{if(selLg==='WORLD')return true;if(selLg==='ALL')return typeof LEAGUE_IDS!=='undefined'&&LEAGUE_IDS.includes(m.league.id);if(selLg==='MY_LEAGUES')return typeof MY_LEAGUES_IDS!=='undefined'&&MY_LEAGUES_IDS.includes(m.league.id);return m.league.id===parseInt(selLg);});
      all.push(...dm);if(all.length>350)break;
    }
    if(!all.length){showErr('Δεν βρέθηκαν αγώνες.');return;}
    if(all.length>350) all=all.slice(0,350);
    for(let i=0;i<all.length;i++) await analyzeMatchSafe(all[i],i,all.length);
    
    saveToVault(window.scannedMatchesData);
    rebuildTopLists();renderTopSections();renderSummaryTable();tickerRefresh();startAutoSync();updateAuditLeagueFilter();
    showOk(`✅ Scan ολοκληρώθηκε — ${all.length} αγώνες.`);
  }catch(e){showErr(e.message);}finally{isRunning=false;setLoader(false);setBtnsDisabled(false);}
};

// ================================================================
//  LIVE SYNC & TICKER (ONLY LIVE MATCHES)
// ================================================================
window.syncLiveScores=async function(){
  if(isRunning)return;const btn=document.getElementById('btnSyncLive');if(btn){btn.innerText='Syncing…';btn.disabled=true;}
  try{
    const res=await apiReq('fixtures?live=all');const liveArr=res.response||[];
    if(!liveArr.length){showOk('Δεν υπάρχουν live αγώνες.');return;}
    const liveMap=new Map(liveArr.map(f=>[f.fixture.id,f]));let n=0;
    window.scannedMatchesData.forEach(d=>{
      if(!liveMap.has(d.fixId))return;const ld=liveMap.get(d.fixId);
      d.m.goals=ld.goals;d.m.fixture.status=ld.fixture.status;
      const evts=ld.events||[];let cor=0,yel=0,red=0;
      evts.forEach(ev=>{const t=(ev.type||'').toLowerCase(),det=(ev.detail||'').toLowerCase();if(t==='corner')cor++;else if(t==='card'){if(det.includes('yellow'))yel++;else if(det.includes('red')&&!det.includes('yellow'))red++;}});
      if(evts.length>0){d.liveCorners=cor;d.liveYellows=yel;d.liveReds=red;}n++;
    });
    renderSummaryTable();tickerRefresh();showOk(`✅ 1 Credit · Synced ${n} live αγώνες`);
  }catch(e){showErr('Sync error: '+e.message);}finally{if(btn){btn.innerText='Live Sync';btn.disabled=false;}}
};

let _autoSyncTimer=null;
function startAutoSync(){if(_autoSyncTimer)clearInterval(_autoSyncTimer);_autoSyncTimer=setInterval(()=>{const hasLive=(window.scannedMatchesData||[]).some(d=>isLive(d.m?.fixture?.status?.short));if(hasLive&&!isRunning)syncLiveScores();},90000);}

let _tickerRaf=null,_tickerPx=45;
function tickerRefresh(){
  const bar=document.getElementById('tickerBar'),inner=document.getElementById('tickerInner');if(!bar||!inner)return;
  const data=window.scannedMatchesData||[];if(!data.length)return;
  
  // LIVE ONLY FILTER
  const liveMatches = data.filter(d => isLive(d.m?.fixture?.status?.short || ''));
  if(!liveMatches.length){bar.style.display='none'; if(_tickerRaf)cancelAnimationFrame(_tickerRaf); return;}
  
  const items=liveMatches.map(d=>{
    const gh=d.m?.goals?.home??'0',ga=d.m?.goals?.away??'0';
    const elapsed = d.m?.fixture?.status?.elapsed ? `${d.m.fixture.status.elapsed}'` : 'LIVE';
    const scoreHtml=`<span class="t-score t-live">${gh}-${ga} <small style="color:var(--accent-green);font-size:0.5em">${elapsed}</small></span>`;
    const pickHtml=!d.omegaPick?.includes('NO BET')?`<span class="t-pick">${esc((d.omegaPick||'').split(' ').slice(0,2).join(' '))}</span>`:'';
    const corHtml=d.liveCorners!==undefined?`<span class="t-cor">🚩${d.liveCorners}</span>`:'';
    return `<div class="ticker-item"><span class="live-dot" style="width:5px;height:5px;"></span>${esc(d.ht)} <span style="opacity:0.4">vs</span> ${esc(d.at)} ${scoreHtml}${pickHtml}${corHtml}</div>`;
  }).join('');
  
  inner.innerHTML=items+items;bar.style.display='flex';
  
  if(_tickerRaf)cancelAnimationFrame(_tickerRaf);
  let pos=0,last=null;
  function step(ts){if(last===null)last=ts;const dt=Math.min((ts-last)/1000,0.1);last=ts;pos+=_tickerPx*dt;const half=inner.scrollWidth/2;if(pos>=half)pos=0;inner.style.transform=`translateX(-${pos.toFixed(1)}px)`;_tickerRaf=requestAnimationFrame(step);}
  _tickerRaf=requestAnimationFrame(step);
}
window.setTickerSpeed=v=>{_tickerPx=parseFloat(v);};

// ================================================================
//  TOP LISTS & TABS (ONLY ACTIVE MATCHES)
// ================================================================
function rebuildTopLists(){
  const sd = (window.scannedMatchesData||[]).filter(x => !isFinished(x.m?.fixture?.status?.short));
  latestTopLists.combo1   =sd.filter(x=>x.omegaPick?.includes('⚡')).sort((a,b)=>b.strength-a.strength).slice(0,6);
  latestTopLists.outcomes =sd.filter(x=>x.omegaPick?.includes('ΑΣΟΣ')||x.omegaPick?.includes('ΔΙΠΛΟ')).sort((a,b)=>b.strength-a.strength).slice(0,6);
  latestTopLists.exact    =[...sd].sort((a,b)=>(b.exactConf||0)-(a.exactConf||0)).slice(0,6);
  latestTopLists.over25   =sd.filter(x=>x.omegaPick?.includes('OVER 2.5')).sort((a,b)=>b.strength-a.strength).slice(0,6);
  latestTopLists.corners  =sd.filter(x=>x.omegaPick?.includes('ΚΟΡΝΕΡ')).sort((a,b)=>b.cornerConf-a.cornerConf).slice(0,6);
}

function renderTopSections(){
  const tabs=[
    {id:'combo1',  lbl:'⚡ High Conf 1X2', d:latestTopLists.combo1,  sk:'strength', sl:'CONF'},
    {id:'outcomes',lbl:'Match Odds',        d:latestTopLists.outcomes,sk:'strength', sl:'CONF'},
    {id:'over25',  lbl:'Over 2.5',          d:latestTopLists.over25,  sk:'tXG',      sl:'xG'},
    {id:'corners', lbl:'🚩 Top Corners',    d:latestTopLists.corners, sk:'cornerConf',sl:'CONF'},
    {id:'exact',   lbl:'Exact Score',       d:latestTopLists.exact,   sk:'exactConf',sl:'CONF'}
  ];
  const t=document.getElementById('topSection');if(!t)return;
  let html=`<div class="quant-panel" style="padding:0;overflow:hidden;"><div class="tabs-wrapper">`;
  tabs.forEach((tab,i)=>{html+=`<button class="tab-btn ${i===0?'active':''}" onclick="switchTab('${tab.id}')" id="tab-btn-${tab.id}">${tab.lbl} <span class="tab-count">${tab.d.length}</span></button>`;});
  html+=`</div>`;
  tabs.forEach((tab,i)=>{
    html+=`<div class="pred-tab-panel" style="display:${i===0?'block':'none'};padding:14px 18px 18px;" id="tabpanel-${tab.id}">`;
    if(!tab.d.length){html+=`<div style="text-align:center;color:var(--text-muted);padding:22px;font-weight:600;">Δεν βρέθηκαν σήματα.</div>`;}
    else{
      html+=`<div style="display:flex;flex-direction:column;gap:8px;">`;
      tab.d.forEach((x,j)=>{
        let val=tab.id==='exact'?x.exact||'?-?':Number(x[tab.sk]||0).toFixed(1)+(tab.id==='corners'?'%':'');
        html+=`<div onclick="scrollToMatch('row-${x.fixId}')" style="display:flex;align-items:center;gap:14px;padding:11px 14px;background:var(--bg-base);border:1px solid var(--border-light);border-radius:var(--radius-sm);cursor:pointer;transition:border-color 0.18s;">
          <div style="font-family:var(--font-mono);font-size:1.05rem;color:var(--text-dim);min-width:26px;text-align:center;">#${j+1}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(x.ht)} <span style="color:var(--text-muted)">vs</span> ${esc(x.at)}</div>
            <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;margin-top:2px;">${esc(x.lg)}</div>
            <div style="font-size:0.7rem;color:var(--accent-green);font-weight:600;margin-top:2px;">${esc(x.omegaPick)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:800;color:var(--accent-blue);">${val}</div>
            <div style="font-size:0.58rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;">${tab.sl}</div>
          </div>
        </div>`;
      });
      html+=`</div>`;
    }
    html+=`</div>`;
  });
  html+=`</div>`;t.innerHTML=html;
}

window.switchTab=function(id){document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.pred-tab-panel').forEach(p=>p.style.display='none');document.getElementById('tab-btn-'+id)?.classList.add('active');const panel=document.getElementById('tabpanel-'+id);if(panel)panel.style.display='block';};
window.scrollToMatch=function(id){const el=document.getElementById(id);if(!el)return;el.scrollIntoView({behavior:'smooth',block:'center'});el.style.outline='2px solid var(--accent-blue)';setTimeout(()=>el.style.outline='',2000);};

// ================================================================
//  SUMMARY TABLE (ACTIVE) & POST-MATCH (FINISHED)
// ================================================================
window.toggleMatchDetails = function(id) {
  const el = document.getElementById('details-' + id);
  if(el) el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
};

function renderSummaryTable() {
  const sec = document.getElementById('summarySection'); if(!sec) return;
  const sd = window.scannedMatchesData || []; if(!sd.length) { sec.innerHTML=''; return; }
  
  // Διαχωρισμός Ενεργών / Τελειωμένων
  const activeMatches = sd.filter(d => !isFinished(d.m?.fixture?.status?.short));
  const finishedMatches = sd.filter(d => isFinished(d.m?.fixture?.status?.short));

  let finalHtml = '';
  const formDots=arr=>(arr||[]).slice(0,5).map(h=>`<div class="form-dot form-${h.cls}">${h.res}</div>`).join('');

  // --- 1. ACTIVE MATCHES (Upcoming & Live) ---
  if (activeMatches.length > 0) {
    const grouped={}; activeMatches.forEach(d=>{ if(!grouped[d.lg]) grouped[d.lg]=[]; grouped[d.lg].push(d); });
    let rows='';
    for(const[lg,matches] of Object.entries(grouped)){
      rows+=`<div style="background:rgba(56,189,248,0.05);padding:7px 16px;font-weight:700;font-size:0.7rem;color:var(--accent-blue);border-top:1px solid var(--border-light);border-bottom:1px solid var(--border-light);text-transform:uppercase;letter-spacing:1px;">${esc(lg)}</div>
      <div class="data-table-wrapper" style="border:none;border-radius:0;margin-bottom:0;"><table class="summary-table">
      <thead><tr><th class="col-match">Match</th><th class="col-score">Score</th><th class="col-1x2">1X2</th><th class="col-o25">O2.5</th><th class="col-u25">U2.5</th><th class="col-btts">BTTS</th><th class="col-exact">Exact</th><th class="col-conf">Conf%</th><th class="col-signal">Signal</th></tr></thead><tbody>`;
      matches.forEach(x=>{
        const sh=x.m?.fixture?.status?.short||'', live=isLive(sh);
        const ah=x.m?.goals?.home??0, aa=x.m?.goals?.away??0;
        const scoreStr=live?`${ah}-${aa}`:'-'; const scoreCol=live?'var(--accent-green)':'var(--text-muted)';
        const conf=clamp(safeNum(x.strength),0,100); const confCol=conf>=65?'var(--accent-green)':conf>=45?'var(--accent-gold)':'var(--text-muted)';
        let omCol=x.omegaPick?.includes('NO BET')?'var(--text-muted)':'var(--text-main)';
        const liveExtra=live&&x.liveCorners!==undefined?`<div style="font-size:0.56rem;color:var(--accent-teal);margin-top:2px;">🚩${x.liveCorners} 🟨${x.liveYellows||0}</div>`:'';
        const pHtml=x.pp?getPoissonMatrixHTML(x.hExp,x.aExp,4):'';
        
        rows+=`<tr id="row-${x.fixId}" onclick="toggleMatchDetails('${x.fixId}')" style="cursor:pointer;${live?'background:rgba(16,185,129,0.03)':''}">
          <td class="col-match left-align" style="font-weight:600;">${live?'<span class="live-dot" style="width:6px;height:6px;margin-right:4px;display:inline-block;"></span>':''}${esc(x.ht)} <span style="color:var(--text-muted)">–</span> ${esc(x.at)}</td>
          <td class="col-score data-num" style="color:${scoreCol};">${scoreStr}${liveExtra}</td>
          <td class="col-1x2 data-num">${x.outPick}</td>
          <td class="col-o25 data-num">${x.omegaPick?.includes('OVER 2')?'🔥':'-'}</td>
          <td class="col-u25 data-num">${x.omegaPick?.includes('UNDER 2')?'🔒':'-'}</td>
          <td class="col-btts data-num">${x.omegaPick?.includes('GOAL')?'🎯':'-'}</td>
          <td class="col-exact data-num">${x.exact||'?-?'}</td>
          <td class="col-conf data-num" style="color:${confCol};">${conf.toFixed(0)}%</td>
          <td class="col-signal" style="color:${omCol};font-weight:800;font-size:0.7rem;">${(x.omegaPick||'—').split(' ').slice(0,3).join(' ')}</td>
        </tr>
        
        <tr id="details-${x.fixId}" style="display:none; background:var(--bg-surface);">
          <td colspan="9" style="padding: 20px; text-align:left; border-bottom:1px solid var(--border-light);">
            <div style="display:flex; justify-content:space-around; gap:20px; flex-wrap:wrap;">
              <div style="flex:1; min-width:250px; background:var(--bg-base); padding:15px; border-radius:8px; border:1px solid var(--border-light);">
                <h4 style="color:var(--text-muted); margin-bottom:10px; font-size:0.75rem; text-transform:uppercase;">Home vs Away Breakdown</h4>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Form xG</span><span class="data-num">${x.hS?.uiXG||'0.00'} vs ${x.aS?.uiXG||'0.00'}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Split xG</span><span class="data-num">${x.hS?.uiSXG||'0.00'} vs ${x.aS?.uiSXG||'0.00'}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Exp. Cards</span><span class="data-num">${Number(x.hS?.crd||0).toFixed(1)} vs ${Number(x.aS?.crd||0).toFixed(1)}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; color:var(--text-muted);"><span>H2H (Last 8)</span><span class="data-num">${x.h2h?`${x.h2h.homeWins}W - ${x.h2h.draws}D - ${x.h2h.awayWins}W`:'N/A'}</span></div>
                <div style="display:flex;gap:2px;margin-top:6px;">${formDots(x.hS?.history)}</div><div style="display:flex;gap:2px;margin-top:3px;">${formDots(x.aS?.history)}</div>
              </div>
              <div style="flex:1; min-width:250px; background:var(--bg-base); padding:15px; border-radius:8px; border:1px solid var(--border-light);">
                <h4 style="color:var(--text-muted); margin-bottom:10px; font-size:0.75rem; text-transform:uppercase;">🚩 Advanced Corner Model</h4>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Home Avg / Ratio</span><span class="data-num">${Number(x.hS?.cor||0).toFixed(1)} | ${(Number(x.hS?.corRatio)||3.5).toFixed(2)}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Away Avg / Ratio</span><span class="data-num">${Number(x.aS?.cor||0).toFixed(1)} | ${(Number(x.aS?.corRatio)||3.5).toFixed(2)}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; border-top:1px solid var(--border-light); padding-top:5px; color:var(--accent-gold);"><span>Exp. Corners (Tot)</span><span class="data-num">${(Number(x.expCor)||0).toFixed(1)}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; color:var(--accent-green);"><span>P(Over 8.5)</span><span class="data-num">${(x.cornerConf||0).toFixed(1)}%</span></div>
              </div>
              <div style="flex:1; min-width:250px; background:var(--bg-base); padding:15px; border-radius:8px; border:1px solid var(--border-light);">
                <h4 style="color:var(--text-muted); margin-bottom:10px; font-size:0.75rem; text-transform:uppercase;">Game Projections</h4>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Lambda xG</span><span class="data-num" style="color:var(--accent-blue)">${Number(x.hExp||0).toFixed(2)} – ${Number(x.aExp||0).toFixed(2)}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>xG Diff</span><span class="data-num" style="color:${(x.xgDiff||0)>0?'var(--accent-green)':'var(--accent-red)'}">${(x.xgDiff||0)>0?'+':''}${Number(x.xgDiff||0).toFixed(2)}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Poisson O2.5</span><span class="data-num" style="color:var(--accent-blue)">${x.pp?pct(x.pp.pO25):'—'}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Poisson U2.5</span><span class="data-num" style="color:var(--accent-teal)">${x.pp?pct(x.pp.pU25):'—'}</span></div>
              </div>
              <div style="flex:1; min-width:320px; background:var(--bg-base); padding:15px; border-radius:8px; border:1px solid var(--border-light);">
                <h4 style="color:var(--text-muted); text-align:center; margin-bottom:5px; font-size:0.75rem; text-transform:uppercase;">📊 Poisson Score Matrix</h4>
                ${pHtml}
              </div>
            </div>
          </td>
        </tr>`;
      });
      rows+=`</tbody></table></div>`;
    }
    finalHtml += `<div class="quant-panel" style="padding:0;overflow:hidden;">
      <div style="padding:13px 18px;border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:0.78rem;font-weight:800;color:var(--accent-blue);text-transform:uppercase;letter-spacing:1px;">📊 Match Dashboard (Active) — ${activeMatches.length} αγώνες</span>
      </div>${rows}</div>`;
  }

  // --- 2. FINISHED MATCHES (Post-Match Evolution) ---
  if (finishedMatches.length > 0) {
    let fRows = '';
    finishedMatches.forEach(x => {
      const ah = x.m?.goals?.home??0, aa = x.m?.goals?.away??0, aTot = ah+aa, aOut = ah>aa?'1':ah<aa?'2':'X', aBtts = ah>0&&aa>0;
      const hXGAct = Number(x.actStats?.hXg||0).toFixed(2), aXGAct = Number(x.actStats?.aXg||0).toFixed(2);
      const hPoss = x.actStats?.hPoss||'-', aPoss = x.actStats?.aPoss||'-';
      const hCor = x.actStats?.hCor||0, aCor = x.actStats?.aCor||0;
      const hCrd = x.actStats?.hCrd||0, aCrd = x.actStats?.aCrd||0;
      
      let hitHtml = `<span style="color:var(--text-muted)">-</span>`;
      if(x.omegaPick && !x.omegaPick.includes('NO BET')) {
          let hit = false;
          if(x.omegaPick.includes('OVER 2.5')||x.omegaPick.includes('OVER 3')) hit = aTot > 2.5;
          else if(x.omegaPick.includes('UNDER 2.5')) hit = aTot < 2.5;
          else if(x.omegaPick.includes('GOAL')) hit = aBtts;
          else if(x.omegaPick.includes('ΑΣΟΣ')) hit = aOut === '1';
          else if(x.omegaPick.includes('ΔΙΠΛΟ')) hit = aOut === '2';
          else if(x.omegaPick.includes('ΚΟΡΝΕΡ')) hit = (hCor+aCor) > 8.5;
          else if(x.omegaPick.includes('ΚΑΡΤΕΣ')) hit = (hCrd+aCrd) > 5.5;
          hitHtml = hit ? `<span style="background:rgba(16,185,129,0.15);color:var(--accent-green);padding:2px 6px;border-radius:4px;font-weight:800;font-size:0.65rem;">✅ WON</span>` : `<span style="background:rgba(244,63,94,0.15);color:var(--accent-red);padding:2px 6px;border-radius:4px;font-weight:800;font-size:0.65rem;">❌ LOST</span>`;
      }

      fRows += `<tr>
        <td class="left-align" style="font-weight:600;">${esc(x.ht)} - ${esc(x.at)}</td>
        <td class="data-num" style="color:var(--text-main);">${ah}-${aa}</td>
        <td class="data-num">${hXGAct} - ${aXGAct}</td>
        <td class="data-num">${hPoss}% - ${aPoss}%</td>
        <td class="data-num">${hCor} - ${aCor}</td>
        <td class="data-num">${hCrd} - ${aCrd}</td>
        <td style="font-size:0.65rem;font-weight:800;color:var(--text-main);">${(x.omegaPick||'—').split(' ').slice(0,3).join(' ')}</td>
        <td>${hitHtml}</td>
      </tr>`;
    });

    finalHtml += `<div class="quant-panel" style="padding:0;overflow:hidden;margin-top:24px;border-color:rgba(16,185,129,0.3);">
      <div style="background:rgba(16,185,129,0.1);padding:13px 18px;border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:0.78rem;font-weight:800;color:var(--accent-green);text-transform:uppercase;letter-spacing:1px;">🏁 Post-Match Evolution (Finished) — ${finishedMatches.length} αγώνες</span>
      </div>
      <div class="data-table-wrapper" style="border:none;margin:0;">
        <table class="summary-table">
          <thead><tr><th class="left-align">Match</th><th>Score</th><th>Act. xG</th><th>Possession</th><th>Corners</th><th>Cards</th><th>Signal</th><th>Result</th></tr></thead>
          <tbody>${fRows}</tbody>
        </table>
      </div>
    </div>`;
  }

  sec.innerHTML = finalHtml;
}

// ================================================================
//  AUDIT & VAULT
// ================================================================
window.runCustomAudit=async function(){const s=document.getElementById('auditStart').value,e=document.getElementById('auditEnd').value;if(!s||!e){showErr('Επιλέξτε ημερομηνίες.');return;}if(isRunning)return;isRunning=true;setBtnsDisabled(true);setLoader(true,'Running Audit...');document.getElementById('auditSection').innerHTML='';try{const store=JSON.parse(localStorage.getItem(LS_PREDS)||'[]');const endD=new Date(e);endD.setDate(endD.getDate()+1);const lgFilter=document.getElementById('auditLeague')?.value||'ALL';let cands=store.filter(x=>{const d=new Date(x.date);return d>=new Date(s)&&d<endD;});if(lgFilter!=='ALL')cands=cands.filter(x=>String(x.leagueId)===lgFilter);if(!cands.length){document.getElementById('auditSection').innerHTML=`<div class="quant-panel" style="text-align:center;color:var(--text-muted);padding:30px;">Δεν υπάρχουν δεδομένα.</div>`;return;}let stats={games:0,outHit:0,validOut:0,o25T:0,o25H:0,o35T:0,o35H:0,u25T:0,u25H:0,bttsT:0,bttsH:0,exHit:0};const rows=[],curveData=[];for(let i=0;i<cands.length;i++){const p=cands[i];setProgress(Math.round(((i+1)/cands.length)*100),`Auditing: ${p.homeTeam}`);const fr=await apiReq(`fixtures?id=${p.fixtureId}`);const fix=fr?.response?.[0];if(!fix||!isFinished(fix?.fixture?.status?.short))continue;const ah=safeNum(fix.goals.home),aa=safeNum(fix.goals.away);const aTot=ah+aa,aExact=`${ah}-${aa}`,aOut=ah>aa?'1':ah<aa?'2':'X',aBtts=ah>0&&aa>0;stats.games++;if(p.outPick==='1'||p.outPick==='2'){stats.validOut++;if(p.outPick===aOut)stats.outHit++;}if(p.predOver25){stats.o25T++;if(aTot>2.5)stats.o25H++;}if(p.predOver35){stats.o35T++;if(aTot>3.5)stats.o35H++;}if(p.predUnder25){stats.u25T++;if(aTot<2.5)stats.u25H++;}if(p.predBTTS){stats.bttsT++;if(aBtts)stats.bttsH++;}if(p.exactScorePred===aExact)stats.exHit++;curveData.push({tXG:p.tXG||2.5,hitO25:aTot>2.5?1:0});rows.push({p,ah,aa,aTot,aExact,aOut,aBtts});}const rv=(h,t)=>t>0?h/t*100:0;const col=v=>v>=80?'var(--accent-green)':v>=60?'var(--accent-gold)':'var(--accent-red)';const statsCards=[{lbl:'1X2',h:stats.outHit,t:stats.validOut},{lbl:'O2.5',h:stats.o25H,t:stats.o25T},{lbl:'O3.5',h:stats.o35H,t:stats.o35T},{lbl:'U2.5',h:stats.u25H,t:stats.u25T},{lbl:'BTTS',h:stats.bttsH,t:stats.bttsT},{lbl:'Exact',h:stats.exHit,t:stats.games},];let html=`<div class="quant-panel"><div class="panel-title">📊 Audit Results — ${cands.length} predictions</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;margin-bottom:20px;">${statsCards.map(m=>{const v=rv(m.h,m.t);return`<div style="background:var(--bg-panel);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:14px;text-align:center;"><div style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">${m.lbl}</div><div style="font-size:1.5rem;font-weight:900;font-family:var(--font-mono);color:${m.t>0?col(v):'var(--text-muted)'};">${m.t>0?v.toFixed(1)+'%':'N/A'}</div><div style="font-size:0.6rem;color:var(--text-muted);margin-top:3px;">${m.h}/${m.t}</div></div>`;}).join('')}</div><div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:10px;">xG Threshold Optimization Curve</div>${buildMiniCurve(engineConfig.tXG_O25,curveData)}<div class="data-table-wrapper"><table class="summary-table" style="font-size:0.78rem;"><thead><tr><th class="left-align">Fixture</th><th>Score</th><th>1X2</th><th>O2.5</th><th>O3.5</th><th>U2.5</th><th>BTTS</th><th>Exact</th></tr></thead><tbody>`;rows.forEach(({p,ah,aa,aTot,aExact,aOut,aBtts})=>{const cell=(pred,hit)=>pred?`<span class="${hit?'audit-omega-hit':'audit-omega-miss'}">${hit?'✅':'❌'}</span>`:'<span style="color:var(--text-dim)">—</span>';html+=`<tr><td class="left-align" style="font-weight:600;">${esc(p.homeTeam)} vs ${esc(p.awayTeam)}<div style="font-size:0.6rem;color:var(--text-muted)">${p.league}</div></td><td class="data-num">${ah}-${aa}</td><td>${p.outPick&&p.outPick!=='-'?`<span class="${p.outPick===aOut?'audit-omega-hit':'audit-omega-miss'}">${p.outPick}</span>`:'—'}</td><td>${cell(p.predOver25,aTot>2.5)}</td><td>${cell(p.predOver35,aTot>3.5)}</td><td>${cell(p.predUnder25,aTot<2.5)}</td><td>${cell(p.predBTTS,aBtts)}</td><td>${p.exactScorePred?`<span class="${p.exactScorePred===aExact?'audit-omega-hit':'audit-omega-miss'}">${p.exactScorePred}</span>`:'—'}</td></tr>`;});html+=`</tbody></table></div></div>`;document.getElementById('auditSection').innerHTML=html;showOk('Audit ολοκληρώθηκε.');}catch(e){showErr(e.message);}finally{isRunning=false;setLoader(false);setBtnsDisabled(false);}};
function buildMiniCurve(currentThreshold,data){if(!data.length)return'';let thresholds=[2.0,2.2,2.4,2.6,2.8,3.0,3.2];let bars='';thresholds.forEach(th=>{const valid=data.filter(d=>d.tXG>=th);const hits=valid.filter(d=>d.hitO25===1).length;const rate=valid.length>0?(hits/valid.length)*100:0;const h=Math.max(Math.round((rate/100)*40),2);const isCurrent=Math.abs(th-currentThreshold)<0.1;bars+=`<div title="Thresh: ${th} | Rate: ${rate.toFixed(1)}%" style="display:inline-block; width:12%; height:${h}px; background:${isCurrent?'var(--accent-blue)':'rgba(255,255,255,0.1)'}; margin-right:2px; border-radius:2px 2px 0 0; position:relative;"><span style="position:absolute; bottom:-16px; left:50%; transform:translateX(-50%); font-size:0.5rem; color:var(--text-muted);">${th}</span></div>`;});return`<div style="height:60px; display:flex; align-items:flex-end; border-bottom:1px solid var(--border-light); padding-bottom:2px; margin-bottom:15px;">${bars}</div>`;}
function saveToVault(data){try{let store=JSON.parse(localStorage.getItem(LS_PREDS)||"[]");const map=new Map(store.map(x=>[String(x.fixtureId),x]));data.forEach(d=>{if(d.omegaPick==="NO BET")return;map.set(String(d.fixId),{fixtureId:d.fixId,date:d.m.fixture.date,leagueId:d.leagueId,league:d.lg,homeTeam:d.ht,awayTeam:d.at,outPick:d.outPick,exactScorePred:d.exact,predOver25:d.omegaPick.includes('OVER 2')||d.omegaPick.includes('OVER 3'),predBTTS:d.omegaPick.includes('GOAL'),omegaPick:d.omegaPick,tXG:d.tXG});});localStorage.setItem(LS_PREDS,JSON.stringify(Array.from(map.values())));}catch(e){}}
window.clearVault=function(){if(confirm("Purge all data?")){localStorage.removeItem(LS_PREDS);showOk("Vault Purged.");updateAuditLeagueFilter();}};
function updateAuditLeagueFilter(){const store=JSON.parse(localStorage.getItem(LS_PREDS)||'[]');const sel=document.getElementById('auditLeague');if(!sel)return;const known=new Set(store.map(x=>x.leagueId));sel.innerHTML='<option value="ALL">Global (All)</option>';(typeof LEAGUES_DATA!=='undefined'?LEAGUES_DATA:[]).forEach(l=>{if(known.has(l.id))sel.innerHTML+=`<option value="${l.id}">${l.name}</option>`;});}

// SETTINGS & INIT
window.loadSettings=function(){try{const s=JSON.parse(localStorage.getItem(LS_SETTINGS));if(s)engineConfig={...DEFAULT_SETTINGS,...s};}catch{}for(const[id,key]of Object.entries(SETTINGS_MAP)){const el=document.getElementById(id);if(el)el.value=engineConfig[key];}};
window.saveSettings=function(){for(const[id,key]of Object.entries(SETTINGS_MAP)){const v=parseFloat(document.getElementById(id)?.value);if(!isNaN(v))engineConfig[key]=v;}try{localStorage.setItem(LS_SETTINGS,JSON.stringify(engineConfig));}catch{}showOk('Saved!');};
window.resimulateMatches=function(){if(!window.scannedMatchesData.length)return;window.scannedMatchesData.forEach(d=>{if(!d.hS)return;const lp=getLeagueParams(d.leagueId);const hXG=Number(d.hS.fXG)*lp.mult,aXG=Number(d.aS.fXG)*lp.mult;const tXG=hXG+aXG,btts=Math.min(hXG,aXG);const res=computePick(hXG,aXG,tXG,btts,lp,d.hS,d.aS);Object.assign(d,{tXG,btts,outPick:res.outPick,xgDiff:res.xgDiff,exact:`${res.hG}-${res.aG}`,exactConf:res.exactConf,omegaPick:res.omegaPick,strength:res.pickScore,reason:res.reason,hExp:res.hExp,aExp:res.aExp,pp:res.pp,lambdaTotal:res.lambdaTotal,cornerConf:res.cornerConf,expCor:res.expCor});});rebuildTopLists();renderTopSections();renderSummaryTable();showOk('Re-simulated!');};

window.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('pin')?.addEventListener('input',function(){
    if(this.value==='106014'){
      document.getElementById('auth').style.display='none';document.getElementById('app').style.display='block';
      loadSettings();loadBankroll();initCredits();updateAuditLeagueFilter();
      const sel=document.getElementById('leagueFilter');
      if(sel&&typeof LEAGUES_DATA!=='undefined'){LEAGUES_DATA.forEach(l=>{if(![...sel.options].some(o=>o.value==l.id))sel.innerHTML+=`<option value="${l.id}">${l.name}</option>`;});}
    }
  });
  const today=todayISO();const ss=document.getElementById('scanStart'),se=document.getElementById('scanEnd');if(ss)ss.value=today;if(se)se.value=today;
  const d15=new Date();d15.setDate(d15.getDate()-15);const as=document.getElementById('auditStart'),ae=document.getElementById('auditEnd');if(as)as.value=d15.toISOString().split('T')[0];if(ae)ae.value=today;
});
