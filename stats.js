// ==========================================================================
// APEX OMEGA v5.0 — MASTER ENGINE (ULTIMATE EDITION)
// Poisson · xG · Corners · Scorers · Asian Handicap · HT · AI Advisor
// ==========================================================================

const API_BASE = "https://v3.football.api-sports.io";
let API_KEY    = "956cbd05f9e9bf934df78d9b72d9a3a0";

const LS_PREDS    = "omega_preds_v5.0";
const LS_SETTINGS = "omega_settings_v5.0";
const LS_LGMODS   = "omega_lgmods_v5.0";
const LS_BANKROLL = "omega_bankroll_v5.0";

// ================================================================
//  ACRONYM DICTIONARY — κλικ πάνω σε ακρώνυμο → tooltip
// ================================================================
const ACRONYM_DICT = {
  '1X2':      '1X2 — Αγορά αποτελέσματος: 1 = νίκη γηπεδούχου, Χ = ισοπαλία, 2 = νίκη φιλοξενούμενου',
  'AH':       'Asian Handicap — Χάντικαπ αγορά: η ομάδα ξεκινά με εικονικό μειονέκτημα γκολ. AH -1.5 = νίκη με ≥2 γκολ',
  'BTTS':     'Both Teams To Score — Και οι δύο ομάδες να σκοράρουν τουλάχιστον 1 γκολ (= Γκολ/Γκολ)',
  'O2.5':     'Over 2.5 — Σύνολο γκολ αγώνα ≥ 3',
  'O3.5':     'Over 3.5 — Σύνολο γκολ αγώνα ≥ 4',
  'U2.5':     'Under 2.5 — Σύνολο γκολ αγώνα ≤ 2',
  'HT':       'Half-Time — Πρόβλεψη αποτελέσματος & σκορ 1ου ημιχρόνου. Χρησιμοποιεί league-specific λ factor + home advantage +2.5%',
  'FT':       'Full-Time — Τελικό αποτέλεσμα (90 λεπτά)',
  'xG':       'Expected Goals — Αναμενόμενα γκολ βάσει ποιότητας ευκαιριών. Πιο αξιόπιστο από πραγματικά γκολ για πρόβλεψη',
  'tXG':      'Total xG — Άθροισμα xG και των δύο ομάδων. Βάση για Over/Under αγορές',
  'xGA':      'xG Against — Αναμενόμενα γκολ που δέχεται η ομάδα. Μετράει αδυναμία άμυνας',
  'xG%':      'xG Contribution % — Ποσοστό συνεισφοράς παίκτη στο team xG βάσει GAP (Γκολ + 0.4 × Ασίστ)',
  'xG Adj':   'xG Adjusted — Διορθωμένο xG μετά αφαίρεση τραυματισμένων παικτών. Εμφανίζεται σε χρυσό χρώμα',
  'xG Diff':  'xG Difference — Διαφορά αναμενόμενων γκολ μεταξύ γηπεδούχου/φιλοξενούμενου. Κατώφλι για σήματα 1Χ2 (default: 0.48). Όσο μεγαλύτερο, τόσο πιο ξεκάθαρο το φαβορί.',
  'GAP':      'Goal-Assist Points — Γκολ + 0.4 × Ασίστ. Composite δείκτης επιθετικής συνεισφοράς παίκτη',
  'H2H':      'Head-to-Head — Ιστορικές απευθείας αναμετρήσεις. Χρησιμοποιείται για 12% blend στο λ',
  'D-C':      'Dixon-Coles — Στατιστική διόρθωση Poisson για χαμηλά σκορ (0-0, 1-0, 0-1, 1-1) με ρ = −0.13',
  'INJ':      'Injury flag — Τραυματισμένοι παίκτες με σημαντική επίπτωση στο xG (delta < −0.05)',
  'Conf%':    'Confidence % — Εσωτερική βαθμολογία εμπιστοσύνης σήματος (0–99%). Βάσει Poisson πιθανοτήτων',
  'Card%':    'Card Probability % — Πιθανότητα κίτρινης κάρτας: 1 − e^(−κάρτες/εμφανίσεις). Poisson μοντέλο',
  'Adj🟨%':   'Adjusted Card % — Διορθωμένη πιθανότητα κάρτας που συνυπολογίζει: (1) επιθετικότητα αντιπάλου, (2) αγωνιστική ένταση (Διαφορά xG), (3) league type. ▲ = αυξημένος κίνδυνος, ▼ = μειωμένος',
  'Vault':    'Vault — LocalStorage αποθήκη ιστορικών προβλέψεων που τροφοδοτεί το Audit',
  'Kelly':    'Kelly Criterion — Μαθηματικός τύπος βέλτιστου ποσού στοιχήματος βάσει bankroll & πλεονεκτήματος',
  'LRU':      'Least Recently Used — Στρατηγική cache: αφαιρείται πρώτο το παλαιότερο/ανενεργό entry',
};

/**
 * Τυλίγει ένα ακρώνυμο σε <span class="acr"> για tooltip.
 * Χρησιμοποιείται inline στα template literals του UI.
 */
function acr(term) {
  const tip = ACRONYM_DICT[term];
  if (!tip) return term;
  const safeT = tip.replace(/"/g, '&quot;');
  return `<span class="acr" data-tip="${safeT}">${term}</span>`;
}

// ----------------------------------------------------------------
// LRU Cache με size cap — αποτρέπει memory leaks σε μεγάλα sessions
// Όταν γεμίσει, διαγράφει το παλαιότερο entry (FIFO approximation)
// ----------------------------------------------------------------
class BoundedCache {
  constructor(maxSize=120){this._map=new Map();this._max=maxSize;}
  has(k){return this._map.has(k);}
  get(k){if(!this._map.has(k))return undefined;const v=this._map.get(k);this._map.delete(k);this._map.set(k,v);return v;}
  set(k,v){if(this._map.has(k))this._map.delete(k);else if(this._map.size>=this._max)this._map.delete(this._map.keys().next().value);this._map.set(k,v);}
  clear(){this._map.clear();}
  get size(){return this._map.size;}
}

let teamStatsCache = new BoundedCache(150),
    lastFixCache   = new BoundedCache(150),
    standCache     = new BoundedCache(60),
    h2hCache       = new BoundedCache(200),
    scorersCache   = new BoundedCache(60),
    assistsCache   = new BoundedCache(60),
    cardsCache     = new BoundedCache(60),
    injuryCache    = new BoundedCache(200),
    liveStatsCache = new BoundedCache(50),
    lineupsCache   = new BoundedCache(100);  // starting XI per fixture (invalidated on sub)
let isRunning = false, currentCredits = null;
let latestTopLists = { exact:[], combo1:[], outcomes:[], over25:[], over35:[], under25:[], corners:[], bombs:[], players:[] };
window.scannedMatchesData = [];
let bankrollData = { current: 0, history: [] };

// ── Live Tracker State ──────────────────────────────────────────────────────
let liveTrackerInterval  = null;
let isLiveTracking       = false;
let liveTrackerLeagues   = 'MY_LEAGUES';
let liveMatchesState     = {};
let liveAlerts           = [];
const LIVE_POLL_MS       = 60000;
const LS_LIVE_ALERTS     = 'omega_live_alerts_v5.0';

// 🎯 CALIBRATED ENGINE DEFAULTS
// HT_LAMBDA: global fallback (~43.5% των συνολικών γκολ στο 1ο ημίχρονο)
const HT_LAMBDA = 0.435;

// HT_LEAGUE_FACTORS: φορτώνεται από leagues.js (LEAGUES_HT_FACTORS) αν διαθέσιμο,
// αλλιώς χρησιμοποιεί inline fallback για τα βασικά πρωταθλήματα
const HT_LEAGUE_FACTORS = (typeof LEAGUES_HT_FACTORS !== 'undefined')
  ? LEAGUES_HT_FACTORS
  : {
      78:0.420, 79:0.425, 39:0.440, 40:0.435, 41:0.435,
      135:0.440,136:0.435,140:0.430,141:0.430,
      61:0.430, 62:0.435, 88:0.440, 144:0.435,
      94:0.432, 218:0.442,207:0.435,179:0.438,
      203:0.438,197:0.435,
      113:0.430,103:0.440,119:0.438,244:0.435,164:0.445,
      357:0.438,395:0.435,
      106:0.435,345:0.435,283:0.432,271:0.437,
      253:0.450,262:0.445,71:0.440,128:0.435,
      2:0.430,  3:0.430,  848:0.432,
    };
function getHTFactor(leagueId) {
  return HT_LEAGUE_FACTORS[leagueId] ?? HT_LAMBDA;
}

const DEFAULT_SETTINGS = {
  wShotsOn:0.14, wShotsOff:0.04, wCorners:0.02, wGoals:0.20,
  tXG_O25:2.80,  tXG_O35:3.40,   tXG_U25:1.80,  tBTTS_U25:0.65,
  xG_Diff:0.48,  tBTTS:1.10,     modTrap:0.90,  modTight:0.95,  modGold:1.12,
  minCorners:11.0, minCards:6.1 
};
let engineConfig = { ...DEFAULT_SETTINGS };
let leagueMods   = {};

const SETTINGS_MAP = {
  cfg_wShotsOn:'wShotsOn', cfg_wShotsOff:'wShotsOff', cfg_wCorners:'wCorners', cfg_wGoals:'wGoals',
  cfg_tXG_O25:'tXG_O25',   cfg_tXG_O35:'tXG_O35',     cfg_tXG_U25:'tXG_U25',  cfg_tBTTS_U25:'tBTTS_U25',
  cfg_xG_Diff:'xG_Diff',   cfg_tBTTS:'tBTTS',         cfg_minCorners:'minCorners', cfg_minCards:'minCards',
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

// Dixon-Coles τροποποίηση πιθανότητας για χαμηλά σκορ (0-0,1-0,0-1,1-1)
// Rho ≈ -0.13: διορθώνει την ανεξαρτησία του Poisson στα χαμηλά σκορ
function dixonColesCorr(h,a,lH,lA,rho=-0.13){
  if(h===0&&a===0)return 1-lH*lA*rho;
  if(h===1&&a===0)return 1+lA*rho;
  if(h===0&&a===1)return 1+lH*rho;
  if(h===1&&a===1)return 1-rho;
  return 1;
}

function getPoissonProbabilities(hL,aL,rho=-0.13){
  let pHome=0,pDraw=0,pAway=0,pO25=0,pO35=0,pU25=0,pBTTS=0;
  const matrix=[]; const scoreList=[];
  for(let h=0;h<=6;h++){
    matrix[h]=[];
    for(let a=0;a<=6;a++){
      let p=poissonProb(hL,h)*poissonProb(aL,a);
      // Dixon-Coles correction με configurable rho (FT: -0.13, HT: -0.10)
      if(h<=1&&a<=1) p*=Math.max(dixonColesCorr(h,a,hL,aL,rho),0);
      matrix[h][a]=p;
      scoreList.push({h,a,prob:p});
      if(h>a)pHome+=p;else if(h<a)pAway+=p;else pDraw+=p;
      if(h+a>2.5)pO25+=p;if(h+a>3.5)pO35+=p;if(h+a<2.5)pU25+=p;if(h>0&&a>0)pBTTS+=p;
    }
  }
  scoreList.sort((x,y)=>y.prob-x.prob);
  const best=scoreList[0]||{h:1,a:1,prob:0};
  const second=scoreList[1]||{h:1,a:0,prob:0};
  return{pHome,pDraw,pAway,pO25,pO35,pU25,pBTTS,bestScore:best,secondScore:second,matrix};
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
//  API FETCHING & CACHING
// ================================================================
async function apiReq(path){return new Promise(resolve=>{_apiQueue.push({path,resolve});_drainQueue();});}
async function _drainQueue(){while(_apiActive<MAX_CONCURRENT&&_apiQueue.length>0){const{path,resolve}=_apiQueue.shift();_apiActive++;_executeRequest(path,resolve);}}
async function _executeRequest(path,resolve){
  await new Promise(r=>setTimeout(r,Math.random()*80));
  const MAX_RETRIES=2;
  let resolved=false;
  try{
    for(let attempt=0;attempt<=MAX_RETRIES;attempt++){
      try{
        const r=await fetch(`${API_BASE}/${path}`,{headers:{'x-apisports-key':API_KEY,'Accept':'application/json'}});
        if(r.ok){
          const data=await r.json();
          if(data.response&&typeof currentCredits==='number'){
            currentCredits--;
            const el=document.getElementById('creditDisplay');
            if(el){el.textContent=currentCredits;el.className='credit-value'+(currentCredits<50?' low':'');}
          }
          resolve(data); resolved=true; return;
        }
        // HTTP error (429, 5xx) — retry με exponential backoff
        if(attempt<MAX_RETRIES){await new Promise(r=>setTimeout(r,600*(attempt+1)));continue;}
      }catch(err){
        if(attempt<MAX_RETRIES){await new Promise(r=>setTimeout(r,800*(attempt+1)));continue;}
        console.warn(`[APEX] API failed after ${MAX_RETRIES+1} attempts: ${path}`,err);
      }
    }
    if(!resolved)resolve({response:[]});
  }finally{
    await new Promise(r=>setTimeout(r,REQUEST_GAP_MS));
    _apiActive--;_drainQueue();
  }
}
window.initCredits=async function(){try{const r=await fetch(`${API_BASE}/status`,{headers:{'x-apisports-key':API_KEY}});if(!r.ok)return;const d=await r.json();currentCredits=(d.response?.requests?.limit_day||500)-(d.response?.requests?.current||0);const el=document.getElementById('creditDisplay');if(el){el.textContent=currentCredits;el.className='credit-value'+(currentCredits<50?' low':'');}}catch{}};

async function getTStats(t,lg,s){const k=`${t}_${lg}_${s}`;if(teamStatsCache.has(k))return teamStatsCache.get(k);const d=await apiReq(`teams/statistics?team=${t}&league=${lg}&season=${s}`);teamStatsCache.set(k,d?.response||{});return d?.response||{};}
async function getLFix(t,lg,s){const k=`${t}_${lg}_${s}`;if(lastFixCache.has(k))return lastFixCache.get(k);const d=await apiReq(`fixtures?team=${t}&league=${lg}&season=${s}&last=20&status=FT`);lastFixCache.set(k,d?.response||[]);return d?.response||[];}
async function getStand(lg,s){const k=`${lg}_${s}`;if(standCache.has(k))return standCache.get(k);const d=await apiReq(`standings?league=${lg}&season=${s}`);const f=Array.isArray(d?.response?.[0]?.league?.standings)?d.response[0].league.standings.flat():[];standCache.set(k,f);return f;}
async function getH2H(t1,t2){const k=`${t1}_${t2}`;if(h2hCache.has(k))return h2hCache.get(k);const d=await apiReq(`fixtures/headtohead?h2h=${t1}-${t2}&last=8`);h2hCache.set(k,d?.response||[]);return d?.response||[];}

// 📋 LINEUPS per fixture (1 credit, cached until sub detected)
async function getFixtureLineups(fixtureId) {
  const k = String(fixtureId);
  if(lineupsCache.has(k)) return lineupsCache.get(k);
  const d = await apiReq(`fixtures/lineups?fixture=${fixtureId}`);
  const result = parseLineup(d?.response || []);
  if(result.available) lineupsCache.set(k, result);
  return result;
}

/**
 * Επεξεργάζεται το API lineup response.
 * Επιστρέφει { available, home: {teamId, xi:[{id,name,pos,number}], subs:[...]}, away: {...} }
 */
function parseLineup(response) {
  if(!response?.length) return { available: false };
  const parse = (team) => {
    const xi = (team.startXI || []).map(p => ({
      id:     p.player.id,
      name:   p.player.name,
      pos:    p.player.pos || '?',
      number: p.player.number
    }));
    const subs = (team.substitutes || []).map(p => ({
      id:     p.player.id,
      name:   p.player.name,
      pos:    p.player.pos || '?',
      number: p.player.number
    }));
    return { teamId: team.team.id, formation: team.formation || '?-?-?', xi, subs, xiIds: new Set(xi.map(p=>p.id)) };
  };
  return {
    available: true,
    home: parse(response[0]),
    away: parse(response[1])
  };
}

// 🎯 TOP SCORERS CACHE
async function getLeagueTopScorers(lg, s) {
  const k = `${lg}_${s}`;
  if(scorersCache.has(k)) return scorersCache.get(k);
  const d = await apiReq(`players/topscorers?league=${lg}&season=${s}`);
  const scorers = d?.response || [];
  scorersCache.set(k, scorers);
  return scorers;
}

// 🅰️ TOP ASSISTS (cached per league — 1 credit per league)
async function getLeagueTopAssists(lg, s) {
  const k = `${lg}_${s}`;
  if(assistsCache.has(k)) return assistsCache.get(k);
  const d = await apiReq(`players/topassists?league=${lg}&season=${s}`);
  assistsCache.set(k, d?.response || []);
  return d?.response || [];
}

// 🟨 TOP YELLOW CARDS (cached per league — 1 credit per league)
async function getLeagueTopCards(lg, s) {
  const k = `${lg}_${s}`;
  if(cardsCache.has(k)) return cardsCache.get(k);
  const d = await apiReq(`players/topyellowcards?league=${lg}&season=${s}`);
  cardsCache.set(k, d?.response || []);
  return d?.response || [];
}

// 🏥 INJURIES per team (cached per team+league+season — 2 credits per match, shared via cache)
async function getTeamInjuries(teamId, lg, s) {
  const k = `${teamId}_${lg}_${s}`;
  if(injuryCache.has(k)) return injuryCache.get(k);
  const d = await apiReq(`injuries?league=${lg}&season=${s}&team=${teamId}`);
  injuryCache.set(k, d?.response || []);
  return d?.response || [];
}
const getTeamRank=(st,tId)=>{const r=(st||[]).find(x=>String(x?.team?.id)===String(tId));return r?.rank??null;};

// ================================================================
//  INTEL BUILDER
// ================================================================
// ── Variance helpers ─────────────────────────────────────────────────────────
function variance(arr){if(!arr||arr.length<2)return null;const mean=arr.reduce((a,b)=>a+b,0)/arr.length;return arr.reduce((s,x)=>s+(x-mean)**2,0)/arr.length;}
function stdDev(arr){const v=variance(arr);return v!==null?Math.sqrt(v):null;}

// Cache for fixture statistics (corners/cards/shots per game)
let fixStatsCache = new BoundedCache(200);

async function getFixStats(fixtureId){
  const k=String(fixtureId);
  if(fixStatsCache.has(k))return fixStatsCache.get(k);
  const d=await apiReq(`fixtures/statistics?fixture=${fixtureId}`);
  const r=d?.response||[];
  fixStatsCache.set(k,r);
  return r;
}

function extractFixStatFor(statsArr,teamId,statType){
  const teamStats=statsArr.find(s=>s?.team?.id===teamId);
  if(!teamStats)return null;
  const entry=(teamStats.statistics||[]).find(s=>s.type===statType);
  const v=entry?.value;
  if(v===null||v===undefined||v==='')return null;
  return parseFloat(String(v).replace('%',''))||0;
}

async function batchCalc(fixtures,tId){
  if(!fixtures?.length)return{
    xg:'1.10',xga:'1.10',cor:5.0,corAgainst:4.5,corRatio:0.40,
    shotsCor:0.22,crd:2.0,shotsOn:4.5,shotsOff:3.5,oppShotsOn:4.0,
    goalsArr:[],goalsAgainstArr:[],cornersArr:[],cardsArr:[],
    varGoals:null,sdGoals:null,varGoalsAgainst:null,sdGoalsAgainst:null,
    varCorners:null,sdCorners:null,varCards:null,sdCards:null
  };

  // Recency decay: most recent match has weight 1.0
  const DECAY=[1.00,0.82,0.67,0.54,0.43,0.35,0.27,0.20];
  const recent=fixtures.slice(0,8);
  const statsPerFix=await Promise.all(recent.map(f=>getFixStats(f.fixture.id)));

  let tXG=0,tXGA=0,tCor=0,tCorAgainst=0,tCrd=0,tShotsOn=0,tShotsOff=0,tOppShotsOn=0,tw=0;
  let nCor=0,nCrd=0,nShots=0;
  const goalsArr=[],goalsAgainstArr=[],cornersArr=[],cardsArr=[];

  for(let i=0;i<recent.length;i++){
    const f=recent[i],st=statsPerFix[i];
    const w=DECAY[i]??0.15;
    const isH=f.teams?.home?.id===tId;
    const oppId=isH?f.teams?.away?.id:f.teams?.home?.id;
    const myG=getTeamGoals(f,tId),opG=getOppGoals(f,tId);
    goalsArr.push(myG);goalsAgainstArr.push(opG);
    tXG+=(myG>0?myG*1.10:0.42)*w;tXGA+=(opG>0?opG*1.10:0.42)*w;tw+=w;

    if(st&&st.length){
      const myCor=extractFixStatFor(st,tId,'Corner Kicks');
      const oppCor=extractFixStatFor(st,oppId,'Corner Kicks');
      if(myCor!==null){tCor+=myCor*w;cornersArr.push(myCor);nCor++;}
      if(oppCor!==null)tCorAgainst+=oppCor*w;

      const myY=extractFixStatFor(st,tId,'Yellow Cards')??0;
      const myR=extractFixStatFor(st,tId,'Red Cards')??0;
      const totalCards=myY+myR;
      cardsArr.push(totalCards);tCrd+=totalCards*w;nCrd++;

      const mySOn=extractFixStatFor(st,tId,'Shots on Goal');
      const mySOff=extractFixStatFor(st,tId,'Shots off Goal');
      const oppSOn=extractFixStatFor(st,oppId,'Shots on Goal');
      if(mySOn!==null){tShotsOn+=mySOn*w;nShots++;}
      if(mySOff!==null)tShotsOff+=mySOff*w;
      if(oppSOn!==null)tOppShotsOn+=oppSOn*w;
    }else{
      // fallback simulated corners/cards (recency-weighted)
      const simCor=3.5+(myG*1.2)+(opG*0.3);
      const simCrd=1.5+(opG*0.8)+(myG*0.2);
      tCor+=simCor*w;tCrd+=simCrd*w;
      if(cornersArr.length===i)cornersArr.push(simCor);
      if(cardsArr.length===i)cardsArr.push(simCrd);
      nCor++;nCrd++;
    }
  }

  const avgXG=tw>0?tXG/tw:1.10,avgXGA=tw>0?tXGA/tw:1.10;
  const avgCor=nCor>0?tCor/nCor:5.0,avgCorA=nCor>0?tCorAgainst/nCor:4.5;
  const avgCrd=nCrd>0?tCrd/nCrd:2.0;
  const avgSOn=nShots>0?tShotsOn/nShots:4.5,avgSOff=nShots>0?tShotsOff/nShots:3.5;
  const avgOppSOn=nShots>0?tOppShotsOn/nShots:4.0;
  const totalShots=avgSOn+avgSOff;
  const corRatio=totalShots>0?avgCor/totalShots:0.40;
  const shotsCor=totalShots>0?clamp(avgCor/(totalShots*2.5),0.05,0.60):0.22;

  return{
    xg:avgXG.toFixed(2),xga:avgXGA.toFixed(2),
    cor:parseFloat(avgCor.toFixed(2)),corAgainst:parseFloat(avgCorA.toFixed(2)),
    corRatio:parseFloat(corRatio.toFixed(3)),shotsCor:parseFloat(shotsCor.toFixed(3)),
    crd:parseFloat(avgCrd.toFixed(2)),
    shotsOn:parseFloat(avgSOn.toFixed(2)),shotsOff:parseFloat(avgSOff.toFixed(2)),
    oppShotsOn:parseFloat(avgOppSOn.toFixed(2)),
    goalsArr,goalsAgainstArr,cornersArr,cardsArr,
    varGoals:variance(goalsArr),sdGoals:stdDev(goalsArr),
    varGoalsAgainst:variance(goalsAgainstArr),sdGoalsAgainst:stdDev(goalsAgainstArr),
    varCorners:variance(cornersArr),sdCorners:stdDev(cornersArr),
    varCards:variance(cardsArr),sdCards:stdDev(cardsArr),
  };
}

function getFormHistory(fixtures,teamId){return fixtures.map(f=>{const my=getTeamGoals(f,teamId),op=getOppGoals(f,teamId);return my>op?{res:'W',cls:'W'}:my<op?{res:'L',cls:'L'}:{res:'D',cls:'D'};}).reverse();}
function getFormRating(hist){if(!hist?.length)return 50;const w=[1,0.8,0.6,0.4,0.2];let score=0,tw=0;hist.slice(0,5).forEach((h,i)=>{const wi=w[i]||0.1,pts=h.res==='W'?100:h.res==='D'?33:0;score+=pts*wi;tw+=wi;});return tw>0?Math.round(score/tw):50;}

async function buildIntel(tId,lg,s,isHome){
  try{
    const[ss,allFix]=await Promise.all([getTStats(tId,lg,s),getLFix(tId,lg,s)]);
    const gen=allFix.slice(0,8);
    const split=allFix.filter(f=>(isHome?f.teams.home.id:f.teams.away.id)===tId).slice(0,6);
    const recent6=allFix.slice(0,6);
    const[fData,sData,r6Data]=await Promise.all([batchCalc(gen,tId),batchCalc(split,tId),batchCalc(recent6,tId)]);
    const sXG=parseFloat(ss?.goals?.for?.average?.total)||1.35,sXGA=parseFloat(ss?.goals?.against?.average?.total)||1.35;
    const totalTeamGoalsSeason=parseInt(ss?.goals?.for?.total?.total)||0;
    const seaPlayed=safeNum(ss?.fixtures?.played?.total,0);
    const seaGF=safeNum(ss?.goals?.for?.total?.total,0);
    const seaGA=safeNum(ss?.goals?.against?.total?.total,0);
    const seaLambdaGF=seaPlayed>0?seaGF/seaPlayed:sXG;
    const seaLambdaGA=seaPlayed>0?seaGA/seaPlayed:sXGA;
    const LEAGUE_CORNER_MEAN_H=5.1,LEAGUE_CORNER_MEAN_A=4.7;

    // ── Season variance για κόρνερ και κάρτες ─────────────────────
    // Το teams/statistics API δεν δίνει κόρνερ/κάρτες ανά αγώνα.
    // Χρησιμοποιούμε τα fixture statistics arrays ως empirical proxy.

    const seaCornersArr = fData.cornersArr?.length >= 3 ? fData.cornersArr : null;
    const seaCardsArr   = fData.cardsArr?.length   >= 3 ? fData.cardsArr   : null;

    // ── Season σ ΚΟΡΝΕΡ ──────────────────────────────────────────
    // 1. Empirical αν ≥3 αγώνες με δεδομένα
    // 2. Poisson √(μέσος ομάδας) — χρησιμοποιεί τον ΠΡΑΓΜΑΤΙΚΟ μέσο, όχι league avg
    // 3. Fallback league mean
    const seaAvgCorners = fData.cor > 0 ? safeNum(fData.cor, LEAGUE_CORNER_MEAN_H) : LEAGUE_CORNER_MEAN_H;
    const seaSdCorners = seaCornersArr
      ? stdDev(seaCornersArr)
      : parseFloat(Math.sqrt(seaAvgCorners).toFixed(2));

    // ── Season σ ΚΑΡΤΕΣ ──────────────────────────────────────────
    // ΣΗΜΑΝΤΙΚΟ: fData.crd είναι weighted ΜΕΣΟΣ ΟΡΟΣ καρτών/αγώνα (~1.5–3.0)
    // ΔΕΝ είναι count → Math.sqrt(fData.crd) ΔΕΝ είναι Poisson σ.
    //
    // Σωστή μεθοδολογία:
    // 1. Empirical stdDev από cardsArr (ιδανικό — πραγματικές παρατηρήσεις)
    // 2. Negative Binomial approximation: Var = μ + μ²/k (k≈2.5 για κάρτες)
    //    Οι κάρτες είναι overdispersed (πολλά 0, μερικά 5+) → NegBin > Poisson
    // 3. Fallback league avg
    const CARD_OVERDISPERSION = 2.5; // k parameter NegBin για κάρτες
    const seaAvgCards = fData.crd > 0 ? safeNum(fData.crd, 2.2) : 2.2;
    const seaSdCards = seaCardsArr
      ? stdDev(seaCardsArr)
      : parseFloat(Math.sqrt(seaAvgCards + (seaAvgCards * seaAvgCards) / CARD_OVERDISPERSION).toFixed(2));

    return{
      fXG:Math.max(safeNum(fData.xg,sXG),0.80),fXGA:Math.max(safeNum(fData.xga,sXGA),0.80),sXG:Math.max(safeNum(sData.xg,sXG),0.80),
      formRating:getFormRating(getFormHistory(gen,tId)),
      corRatio:safeNum(fData.corRatio,0.40),cor:safeNum(fData.cor,5.0),corAgainst:safeNum(fData.corAgainst,4.5),
      shotsCor:safeNum(fData.shotsCor,0.22),crd:safeNum(fData.crd,2.0),
      shotsOn:safeNum(fData.shotsOn,4.5),shotsOff:safeNum(fData.shotsOff,3.5),oppShotsOn:safeNum(fData.oppShotsOn,4.0),
      uiXG:fData.xg,uiXGA:fData.xga,uiSXG:sData.xg,uiSXGA:sData.xga,
      history:getFormHistory(gen,tId),
      totalTeamGoalsSeason,
      // Last-6 variance (empirical)
      r6:{
        n:r6Data.goalsArr.length,
        sdGoals:r6Data.sdGoals,sdGoalsAgainst:r6Data.sdGoalsAgainst,
        sdCorners:r6Data.sdCorners,sdCards:r6Data.sdCards,
        varGoals:r6Data.varGoals,varCorners:r6Data.varCorners,varCards:r6Data.varCards,
        goalsArr:r6Data.goalsArr,cornersArr:r6Data.cornersArr,cardsArr:r6Data.cardsArr,
      },
      // Season variance (empirical από fixture stats όπου διαθέσιμο, αλλιώς Poisson θεωρητικό)
      sea:{
        n:seaPlayed,
        avgGoals:parseFloat(seaLambdaGF.toFixed(2)),avgGoalsAgainst:parseFloat(seaLambdaGA.toFixed(2)),
        sdGoals:parseFloat(Math.sqrt(seaLambdaGF).toFixed(2)),sdGoalsAgainst:parseFloat(Math.sqrt(seaLambdaGA).toFixed(2)),
        avgCorners:parseFloat(seaAvgCorners.toFixed(2)),
        sdCorners:seaSdCorners !== null ? parseFloat(seaSdCorners.toFixed(2)) : null,
        sdCornersSource: seaCornersArr ? 'empirical' : 'poisson',
        avgCards:parseFloat(seaAvgCards.toFixed(2)),
        sdCards:seaSdCards !== null ? parseFloat(seaSdCards.toFixed(2)) : null,
        sdCardsSource: seaCardsArr ? 'empirical' : 'poisson',
      }
    };
  }catch{
    return{
      fXG:1.35,fXGA:1.35,sXG:1.35,formRating:50,corRatio:0.40,cor:5.0,corAgainst:4.5,
      shotsCor:0.22,crd:2.0,shotsOn:4.5,shotsOff:3.5,oppShotsOn:4.0,
      uiXG:'1.35',uiXGA:'1.35',uiSXG:'1.35',uiSXGA:'1.35',history:[],totalTeamGoalsSeason:0,
      r6:{n:0,sdGoals:null,sdGoalsAgainst:null,sdCorners:null,sdCards:null,goalsArr:[],cornersArr:[],cardsArr:[]},
      // Fallback: Poisson για goals (σ=√λ), NegBin για κάρτες (σ=√(μ+μ²/k)), Poisson για κόρνερ
      sea:{n:0,avgGoals:1.35,avgGoalsAgainst:1.35,sdGoals:1.16,sdGoalsAgainst:1.16,
           avgCorners:5.1,sdCorners:2.26,sdCornersSource:'poisson',
           avgCards:2.2,sdCards:parseFloat(Math.sqrt(2.2+(2.2*2.2)/2.5).toFixed(2)),sdCardsSource:'poisson'}
    };
  }
}

function summarizeH2H(fixtures,homeId,awayId){
  let hw=0,aw=0,dr=0,hG=0,aG=0;
  for(const f of(fixtures||[]).slice(0,8)){const myG=f?.teams?.home?.id===homeId?f?.goals?.home??0:f?.goals?.away??0;const opG=f?.teams?.home?.id===awayId?f?.goals?.home??0:f?.goals?.away??0;hG+=myG;aG+=opG;if(myG>opG)hw++;else if(opG>myG)aw++;else dr++;}
  const t=hw+aw+dr||1;return{homeWins:hw,awayWins:aw,draws:dr,h2hAvgGoals:((hG+aG)/t).toFixed(2)};
}

function getLeagueParams(leagueId){
  const lm=leagueMods[leagueId]||{};
  let defDiff=engineConfig.xG_Diff,defMult=1.00, defO25=engineConfig.tXG_O25;
  if(typeof TIGHT_LEAGUES!=='undefined'&&TIGHT_LEAGUES.has(leagueId))defDiff=0.35;
  else if(typeof GOLD_LEAGUES!=='undefined'&&GOLD_LEAGUES.has(leagueId))defDiff=0.65;
  if(typeof GOLD_LEAGUES!=='undefined'&&GOLD_LEAGUES.has(leagueId))defMult=engineConfig.modGold;
  else if(typeof TRAP_LEAGUES!=='undefined'&&TRAP_LEAGUES.has(leagueId))defMult=engineConfig.modTrap;
  else if(typeof TIGHT_LEAGUES!=='undefined'&&TIGHT_LEAGUES.has(leagueId))defMult=engineConfig.modTight;
  return{mult:lm.mult??defMult,minXGO25:lm.minXGO25??defO25,minXGO35:lm.minXGO35??engineConfig.tXG_O35,maxU25:lm.maxU25??engineConfig.tXG_U25,minBTTS:lm.minBTTS??engineConfig.tBTTS,xgDiff:lm.xgDiff??defDiff,htFactor:getHTFactor(leagueId)};
}

// 🎯 PLAYER PROPS MODEL
function calculateScorerProb(leagueScorers, teamId, teamLambdaXG, teamTotalGoals) {
  if(!leagueScorers || leagueScorers.length === 0) return null;
  const playerInfo = leagueScorers.find(p => p.statistics.some(s => String(s.team.id) === String(teamId)));
  if(!playerInfo) return null;
  
  const pStat = playerInfo.statistics.find(s => String(s.team.id) === String(teamId));
  const playerGoals = pStat?.goals?.total || 0;
  if(playerGoals === 0) return null;

  let contribution = 0.30;
  if(teamTotalGoals > 0) contribution = Math.min(playerGoals / teamTotalGoals, 0.70);
  
  const playerXG = teamLambdaXG * contribution;
  const prob = (1 - Math.exp(-playerXG)) * 100;
  
  return { name: playerInfo.player.name, goals: playerGoals, photo: playerInfo.player.photo, prob: prob };
}

// ── Advanced Corner Model ─────────────────────────────────────────────────────
// NegBin approximation + Bayesian shrinkage + shots-based projection
const LEAGUE_CORNER_MEAN_H=5.1,LEAGUE_CORNER_MEAN_A=4.7,CORNER_OVERDISPERSION=1.35;

function negativeBinomialCDF_approx(lambda,k_disp,x){
  const variance=lambda+(lambda*lambda)/k_disp;
  const sigma=Math.sqrt(variance);
  if(sigma<=0)return x>=lambda?1:0;
  return normalCDF((x+0.5-lambda)/sigma);
}

function computeCornerConfidence(hS,aS,hXG,aXG){
  const hN=hS.shotsOn>0?6:2,aN=aS.shotsOn>0?6:2;
  const hProjShotsOn=hS.shotsOn>0?hS.shotsOn:hXG*4.2;
  const hProjShotsOff=hS.shotsOff>0?hS.shotsOff:hXG*3.1;
  const aProjShotsOn=aS.shotsOn>0?aS.shotsOn:aXG*4.2;
  const aProjShotsOff=aS.shotsOff>0?aS.shotsOff:aXG*3.1;
  const hShotsBased=(hProjShotsOn+hProjShotsOff)*(hS.corRatio>0?hS.corRatio:0.40);
  const aShotsBased=(aProjShotsOn+aProjShotsOff)*(aS.corRatio>0?aS.corRatio:0.38);
  const hHistCor=safeNum(hS.cor,LEAGUE_CORNER_MEAN_H),aHistCor=safeNum(aS.cor,LEAGUE_CORNER_MEAN_A);
  const hOppCor=safeNum(hS.corAgainst,LEAGUE_CORNER_MEAN_A),aOppCor=safeNum(aS.corAgainst,LEAGUE_CORNER_MEAN_H);
  const hW=clamp(hN/(hN+4),0.2,0.85),aW=clamp(aN/(aN+4),0.2,0.85);
  const hShrunk=hW*hHistCor+(1-hW)*LEAGUE_CORNER_MEAN_H;
  const aShrunk=aW*aHistCor+(1-aW)*LEAGUE_CORNER_MEAN_A;
  const hOppAdj=(hOppCor+LEAGUE_CORNER_MEAN_A)/2,aOppAdj=(aOppCor+LEAGUE_CORNER_MEAN_H)/2;
  const hExp=0.40*hShotsBased+0.35*hShrunk+0.25*hOppAdj;
  const aExp=0.40*aShotsBased+0.35*aShrunk+0.25*aOppAdj;
  const xgDiff=Math.abs(hXG-aXG);
  const domBonus=xgDiff>0.6?clamp((xgDiff-0.6)*1.2,0,1.8):0;
  const totalExpCor=hExp+aExp+domBonus;
  const pOver85=1-negativeBinomialCDF_approx(totalExpCor,CORNER_OVERDISPERSION,8);
  let score=pOver85*100;
  const samplePenalty=(hN<4||aN<4)?12:0;
  score-=samplePenalty;
  hS._expCorners=parseFloat(totalExpCor.toFixed(1));
  hS._pOver85=parseFloat((pOver85*100).toFixed(1));
  return{conf:clamp(score,0,99),expCor:totalExpCor};
}

// ================================================================
//  PLAYER INTELLIGENCE — xG Contribution, Card Probability, Injuries
// ================================================================

/**
 * Χτίζει το player profile για κάθε ομάδα:
 * - xG contribution = (goals + 0.4*assists) / team total GAP
 * - Card probability per match = Poisson(yellowCards / appearances)
 * - Suspension risk flag (κοντά σε threshold: 4, 9, 14 yellows)
 */
function buildPlayerProfiles(teamId, scorers, assists, cards, teamTotalGoals) {
  const players = new Map();

  const ensurePlayer = (p, stat) => {
    if(!p || !stat) return null;
    const id = p.id;
    if(!players.has(id)) {
      players.set(id, {
        id, name: p.name, photo: p.photo||'',
        goals:0, assists:0, yellowCards:0, redCards:0,
        apps: Math.max(safeNum(stat.games?.appearences,1), 1)
      });
    }
    return players.get(id);
  };

  // Goals
  (scorers||[]).forEach(entry => {
    const stat = entry.statistics?.find(s => String(s.team?.id) === String(teamId));
    if(!stat) return;
    const pl = ensurePlayer(entry.player, stat);
    if(!pl) return;
    pl.goals = safeNum(stat.goals?.total);
    pl.apps  = Math.max(safeNum(stat.games?.appearences,1), pl.apps);
  });

  // Assists
  (assists||[]).forEach(entry => {
    const stat = entry.statistics?.find(s => String(s.team?.id) === String(teamId));
    if(!stat) return;
    const pl = ensurePlayer(entry.player, stat);
    if(!pl) return;
    pl.assists = safeNum(stat.goals?.assists);
    pl.apps = Math.max(safeNum(stat.games?.appearences,1), pl.apps);
  });

  // Yellow/Red Cards
  (cards||[]).forEach(entry => {
    const stat = entry.statistics?.find(s => String(s.team?.id) === String(teamId));
    if(!stat) return;
    const pl = ensurePlayer(entry.player, stat);
    if(!pl) return;
    pl.yellowCards = safeNum(stat.cards?.yellow);
    pl.redCards    = safeNum(stat.cards?.red);
    pl.apps = Math.max(safeNum(stat.games?.appearences,1), pl.apps);
  });

  // Υπολογισμός derived metrics
  const allPl = Array.from(players.values());
  const totalGAP = allPl.reduce((s, p) => s + p.goals + 0.4 * p.assists, 0) || 1;
  const totalGoals = teamTotalGoals || allPl.reduce((s,p)=>s+p.goals,0) || 1;

  return allPl
    .map(p => {
      const gap = p.goals + 0.4 * p.assists;
      const xGContrib = gap / totalGAP;           // % συνεισφοράς στο xG
      const xGShare   = p.goals / totalGoals;     // % μόνο από γκολ
      // Card probability: Poisson model — P(≥1 κάρτα σε επόμενο ματς)
      const cardRate     = p.apps > 0 ? p.yellowCards / p.apps : 0;
      const redCardRate  = p.apps > 0 ? p.redCards    / p.apps : 0;
      const cardProb     = (1 - Math.exp(-cardRate))    * 100;
      const redCardProb  = (1 - Math.exp(-redCardRate)) * 100;
      const suspRisk     = p.yellowCards > 0 && (p.yellowCards % 5 === 4);
      return { ...p, gap, xGContrib, xGShare, cardRate, redCardRate, cardProb, redCardProb, suspRisk, injured: false };
    })
    .filter(p => p.gap > 0 || p.yellowCards > 0)  // κρατάμε μόνο παίκτες με επίδραση
    .sort((a, b) => (b.xGContrib - a.xGContrib) || (b.yellowCards - a.yellowCards));
}

/**
 * Εφαρμόζει injury adjustment στο baseXG μιας ομάδας.
 * Επιστρέφει:
 *   adjXG   — διορθωμένο xG
 *   delta   — η διαφορά (αρνητική όταν υπάρχουν τραυματισμοί)
 *   factor  — αποθηκεύεται για reuse στο resimulate
 *   injured — λίστα των επηρεαζόμενων players (από profiles)
 *
 * Compensation factor 0.78: οι τραυματισμένοι αντικαθίστανται μερικώς
 * από εφεδρείες, οπότε δεν χάνεται ολόκληρο το contribution τους.
 */
function applyInjuryAdjustment(baseXG, playerProfiles, rawInjuries) {
  if(!rawInjuries?.length || !playerProfiles?.length) {
    return { adjXG: baseXG, delta: 0, factor: 1.0, injured: [] };
  }

  // Τα API injuries επιστρέφουν {player:{id,name}, injury:{type,reason}, ...}
  const injuredIds = new Set(rawInjuries.map(i => i.player?.id).filter(Boolean));
  const injuredProfiles = [];

  playerProfiles.forEach(p => {
    if(injuredIds.has(p.id)) {
      p.injured = true;
      injuredProfiles.push(p);
    }
  });

  if(!injuredProfiles.length) return { adjXG: baseXG, delta: 0, factor: 1.0, injured: [] };

  // Συνολική xG απώλεια × compensation factor
  const COMPENSATION = 0.78; // αντικαθίσταται το 78% από εφεδρεία
  const xGLoss = injuredProfiles.reduce((s, p) => s + p.xGContrib, 0) * COMPENSATION;
  // Floor: ακόμα και με πολλές απουσίες, η ομάδα παράγει min 55% του base xG
  const factor  = clamp(1 - xGLoss, 0.55, 1.0);
  const adjXG   = baseXG * factor;
  const delta   = adjXG - baseXG;

  return { adjXG, delta, factor, injured: injuredProfiles };
}

/**
 * LINEUP-BASED xG ADJUSTMENT — κύρια πηγή αλήθειας όταν υπάρχει lineup.
 *
 * Λογική:
 *   1. Υπολόγισε το GAP (xG contribution) ΜΟΝΟ για τους παίκτες που παίζουν (XI)
 *   2. "GAP coverage" = ποσοστό του συνολικού team GAP που εκπροσωπείται
 *   3. Αν κάποιος key player δεν είναι στο XI → εφαρμόζεται παρόμοια
 *      injury-style correction (compensation factor 0.72 — χαμηλότερο από injury
 *      γιατί η απόφαση να μη βγει ξεκούραστος παίκτης είναι διαφορετική από τραυματισμό)
 *   4. Η injury list επιβεβαιώνει / ενισχύει τη διόρθωση αλλά ΔΕΝ είναι απαραίτητη
 *
 * Επιστρέφει:
 *   adjXG, delta, factor, source ('lineup'|'injury'|'base')
 *   xiPlayers  — οι παίκτες που ξεκινούν (με enriched profile)
 *   outPlayers — key players εκτός XI (με contribution%)
 */
function applyLineupAdjustment(baseXG, allPlayers, lineupXI, rawInjuries) {
  // Fallback σε injury adjustment αν δεν υπάρχει lineup
  if(!lineupXI?.xiIds?.size) {
    const injAdj = applyInjuryAdjustment(baseXG, allPlayers, rawInjuries);
    return { ...injAdj, source: 'injury', xiPlayers: [], outPlayers: [] };
  }

  const COMPENSATION = 0.72; // χαμηλότερο από injury (0.78): rotation ≠ injury
  const injuredIds = new Set((rawInjuries||[]).map(i=>i.player?.id).filter(Boolean));

  const xiPlayers  = [];
  const outPlayers = [];

  allPlayers.forEach(p => {
    const inXI     = lineupXI.xiIds.has(p.id);
    const isInjured = injuredIds.has(p.id);
    p.inXI     = inXI;
    p.injured  = isInjured; // override από injury API αν διαθέσιμο
    if(inXI) xiPlayers.push(p);
    else if(p.gap > 0) outPlayers.push(p); // μόνο key players εκτός XI
  });

  // GAP coverage: τι % του συνολικού team attack παίζει
  const totalGAP = allPlayers.reduce((s,p) => s + p.gap, 0) || 1;
  const xiGAP    = xiPlayers.reduce((s,p)  => s + p.gap, 0);
  const coverage = clamp(xiGAP / totalGAP, 0.30, 1.0);

  // Μόνο αν coverage < 95% εφαρμόζεται ουσιαστική διόρθωση
  const xGLoss = coverage < 0.95 ? (1 - coverage) * COMPENSATION : 0;
  const factor  = clamp(1 - xGLoss, 0.52, 1.0);
  const adjXG   = baseXG * factor;
  const delta   = adjXG - baseXG;

  return {
    adjXG, delta, factor,
    source: 'lineup',
    coverage,
    xiPlayers,
    outPlayers: outPlayers.sort((a,b) => b.gap - a.gap).slice(0, 5),
    // backward-compat: injured = out players (for INJ badge)
    injured: outPlayers.filter(p => injuredIds.has(p.id))
  };
}

/**
 * Διορθώνει την πιθανότητα κάρτας κάθε παίκτη λαμβάνοντας υπόψη:
 *
 *  1. Αντίπαλη ομάδα (oppStats.crd):
 *     Αν ο αντίπαλος παίζει φυσικό/επιθετικό ποδόσφαιρο (>avg κάρτες),
 *     δημιουργεί περισσότερα duels → αυξάνει τον κίνδυνο κάρτας.
 *
 *  2. Αγωνιστική ένταση (|xgDiff|):
 *     Ισορροπημένα ματς (μικρή διαφορά xG) είναι πιο contested →
 *     περισσότερες κάρτες από referee intervention.
 *
 *  3. League type (Trap/Tight/Gold):
 *     Trap leagues (Championship κτλ) δομικά πιο card-heavy.
 *     Tight leagues (Ligue 1, Serie A) πιο tactical, λιγότερες κάρτες.
 *
 * Αποτέλεσμα: players ταξινομημένοι κατά adjCardProb DESC
 */
function adjustPlayerCardProbs(players, oppStats, matchCtx) {
  if(!players?.length) return players;

  const AVG_CRD = 3.2; // Ευρωπαϊκός μέσος όρος κίτρινων καρτών ανά ομάδα/αγώνα
  const oppCrd  = safeNum(oppStats?.crd, AVG_CRD);

  // 1. Επιθετικότητα αντιπάλου
  //    Κάθε +1 κάρτα/αγώνα πάνω από τον μέσο = +15% πιθανότητα
  const oppAggrFactor = clamp(1.0 + (oppCrd - AVG_CRD) * 0.15, 0.80, 1.40);

  // 2. Αγωνιστική ένταση
  //    Διαφορά xG < 0.55 → contested ματς → +8% per 0.1 unit κάτω από threshold
  const absDiff       = Math.abs(safeNum(matchCtx?.xgDiff, 0.5));
  const tightnessFactor = clamp(1.0 + (0.55 - absDiff) * 0.08, 0.92, 1.12);

  // 3. League type factor
  const lgId = matchCtx?.leagueId;
  const isTrap  = typeof TRAP_LEAGUES  !== 'undefined' && TRAP_LEAGUES.has(lgId);
  const isTight = typeof TIGHT_LEAGUES !== 'undefined' && TIGHT_LEAGUES.has(lgId);
  const isGold  = typeof GOLD_LEAGUES  !== 'undefined' && GOLD_LEAGUES.has(lgId);
  const leagueFactor = isTrap ? 1.10 : isTight ? 0.92 : isGold ? 0.95 : 1.0;

  const combinedFactor = clamp(oppAggrFactor * tightnessFactor * leagueFactor, 0.65, 1.65);

  // Εφαρμογή in-place + ταξινόμηση κατά adjCardProb
  players.forEach(p => {
    p.adjCardRate    = p.cardRate    * combinedFactor;
    p.adjCardProb    = clamp((1 - Math.exp(-p.adjCardRate))    * 100, 0, 99);
    // Κόκκινες: ηπιότερη διόρθωση (0.6× factor) — πιο τυχαίο event
    p.adjRedCardRate = p.redCardRate * clamp(combinedFactor * 0.6, 0.5, 1.3);
    p.adjRedCardProb = clamp((1 - Math.exp(-p.adjRedCardRate)) * 100, 0, 99);
    p.cardAdjFactor  = combinedFactor;
  });

  players.sort((a, b) => b.adjCardProb - a.adjCardProb);
  return players;
}

// ================================================================
//  PICK ENGINE (Με Asian Handicap & Half-Time)
// ================================================================
function computePick(hXG,aXG,tXG,btts,lp,hS,aS){
  const hL=clamp(hXG*lp.mult,0.15,4.0),aL=clamp(aXG*lp.mult,0.15,4.0);
  const pp=getPoissonProbabilities(hL,aL);const xgDiff=hXG-aXG;
  let outPick='X';
  if(pp.pHome-pp.pAway>0.15&&xgDiff>lp.xgDiff)outPick='1';
  else if(pp.pAway-pp.pHome>0.15&&xgDiff<-lp.xgDiff)outPick='2';
  
  // --- ASIAN HANDICAP (-1.5) CALCULATION ---
  let pAH_Home = 0, pAH_Away = 0;
  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      if (h - a >= 2) pAH_Home += pp.matrix[h][a];
      if (a - h >= 2) pAH_Away += pp.matrix[h][a];
    }
  }

  // --- HALF-TIME APPROXIMATION ---
  // League-specific HT factor + μικρό home advantage (away teams παίζουν πιο αμυντικά στο 1ο ημίχρονο)
  // D-C rho=-0.10 (λιγότερη correction για HT όπου τα χαμηλά σκορ είναι ακόμα πιο συχνά)
  const htF = lp.htFactor ?? HT_LAMBDA;
  const ppHT = getPoissonProbabilities(hL * htF * 1.025, aL * htF * 0.975, -0.10);

  const cornerRes=computeCornerConfidence(hS,aS,hXG,aXG);
  const totCards=safeNum(hS.crd,2.1)+safeNum(aS.crd,2.1);
  
  let omegaPick='ΧΩΡΙΣ ΣΥΣΤΑΣΗ',reason='Ανεπαρκής στατιστικό πλεονέκτημα.',pickScore=0;
  
  // 1. ASIAN HANDICAP (-1.5)
  if(pAH_Home >= 0.38 && xgDiff >= 0.90 && hS.formRating >= 50){omegaPick='💣 ΑΣΟΣ -1.5 (AH)';pickScore=pAH_Home*100;reason=`Χάντικαπ -1.5 Πιθ.: ${pct(pAH_Home)} | Διαφ. xG: +${xgDiff.toFixed(2)}`;}
  else if(pAH_Away >= 0.38 && xgDiff <= -0.90 && aS.formRating >= 50){omegaPick='💣 ΔΙΠΛΟ -1.5 (AH)';pickScore=pAH_Away*100;reason=`Χάντικαπ -1.5 Πιθ.: ${pct(pAH_Away)} | Διαφ. xG: ${xgDiff.toFixed(2)}`;}

  // 2. HALF-TIME WINNER
  else if(ppHT.pHome >= 0.45 && xgDiff >= 0.75){omegaPick='⏱️ ΗΜΙΤΕΛΙΚΟ — ΓΗΠΕΔΟΥΧΟΙ';pickScore=ppHT.pHome*100;reason=`Πιθ. Προβάδισμα Ημιτ.: ${pct(ppHT.pHome)} | xG Διαφ.: +${xgDiff.toFixed(2)}`;}
  else if(ppHT.pAway >= 0.45 && xgDiff <= -0.75){omegaPick='⏱️ ΗΜΙΤΕΛΙΚΟ — ΦΙΛΟΞΕΝΟΥΜΕΝΟΙ';pickScore=ppHT.pAway*100;reason=`Πιθ. Προβάδισμα Ημιτ.: ${pct(ppHT.pAway)} | xG Διαφ.: ${xgDiff.toFixed(2)}`;}

  // 3. OVER / UNDER
  else if(pp.pO35>=0.45&&tXG>=lp.minXGO35&&btts>=1.20){omegaPick='🚀 ΠΑΝΩ ΑΠΟ 3.5 ΓΚΟΛ';pickScore=pp.pO35*100;reason=`Poisson Πάνω 3.5: ${pct(pp.pO35)} | Συν. xG: ${tXG.toFixed(2)}`;}
  else if(pp.pO25>=0.54&&tXG>=lp.minXGO25&&btts>=0.90){omegaPick='🔥 ΠΑΝΩ ΑΠΟ 2.5 ΓΚΟΛ';pickScore=pp.pO25*100;reason=`Poisson Πάνω 2.5: ${pct(pp.pO25)} | Συν. xG: ${tXG.toFixed(2)}`;}
  else if(pp.pU25>=0.55&&tXG<=lp.maxU25&&btts<=engineConfig.tBTTS_U25){omegaPick='🔒 ΚΑΤΩ ΑΠΟ 2.5 ΓΚΟΛ';pickScore=pp.pU25*100;reason=`Poisson Κάτω 2.5: ${pct(pp.pU25)} | Συν. xG: ${tXG.toFixed(2)}`;}
  
  // 4. GOAL / GOAL
  else if(btts>=lp.minBTTS&&pp.pBTTS>=0.50&&hXG>=0.95&&aXG>=0.95){omegaPick='🎯 ΓΚΟΛ/ΓΚΟΛ (GG)';pickScore=pp.pBTTS*100;reason=`Πιθ. ΓΓ: ${pct(pp.pBTTS)} | xG: ${hXG.toFixed(2)} – ${aXG.toFixed(2)}`;}
  
  // 5. STRAIGHT WIN (1X2)
  else if(outPick!=='X'&&Math.abs(xgDiff)>=lp.xgDiff){
    const outcome=outPick==='1'?'🏠 ΝΙΚΗ ΓΗΠΕΔΟΥΧΩΝ':'✈️ ΝΙΚΗ ΦΙΛΟΞΕΝΟΥΜΕΝΩΝ';const outProb=outPick==='1'?pp.pHome:pp.pAway;const formOk=outPick==='1'?hS.formRating>=40:aS.formRating>=40;
    if(outProb>=0.50&&formOk){omegaPick=outProb>=0.58?`⚡ ${outcome}`:outcome;pickScore=outProb*100;reason=`Poisson ${outPick==='1'?'Γηπεδ.':'Φιλοξ.'}: ${pct(outProb)} | Διαφ. xG: ${xgDiff.toFixed(2)}`;}
  }
  
  // 6. PROPS
  else if(cornerRes.conf>=72){omegaPick='🚩 ΠΑΝΩ ΑΠΟ 8.5 ΚΟΡΝΕΡ';pickScore=cornerRes.conf;reason=`Μοντέλο Κόρνερ: ${cornerRes.conf.toFixed(1)}% | Αναμ.: ${cornerRes.expCor.toFixed(1)}`;}
  else if(totCards>=engineConfig.minCards&&Math.abs(xgDiff)<0.45){omegaPick='🟨 ΠΑΝΩ ΑΠΟ 5.5 ΚΑΡΤΕΣ';pickScore=clamp((totCards-5.0)*20,0,85);reason=`Μέσος Καρτών: ${totCards.toFixed(1)} | Ισορροπημένος αγώνας`;}
  
  // exactConf: αθροίζει πιθανότητες Top-1 + Top-2 (Dixon-Coles adjusted) — πιο ρεαλιστικό
  const top1P=pp.bestScore.prob, top2P=pp.secondScore.prob;
  const exactConf=Math.round(clamp((top1P+top2P)*100*4.2,0,99));
  return{omegaPick,reason,pickScore,outPick,
    hG:pp.bestScore.h,aG:pp.bestScore.a,
    hG2:pp.secondScore.h,aG2:pp.secondScore.a,
    hExp:hL,aExp:aL,exactConf,xgDiff,pp,
    cornerConf:cornerRes.conf,expCor:cornerRes.expCor,lambdaTotal:hL+aL};
}

// ================================================================
//  HT ANALYSIS — πλήρης ημιχρόνια ανάλυση
// ================================================================

/**
 * Υπολογίζει ολοκληρωμένη ανάλυση ημιχρόνου (HT) με:
 *
 * 1. League-specific HT factor (από HT_LEAGUE_FACTORS)
 * 2. Home advantage correction (+2.5% για home, -2.5% για away):
 *    Τα φιλοξενούμενα παίζουν πιο αμυντικά στο 1ο ημίχρονο
 * 3. Ειδικό Dixon-Coles rho = -0.10 (χαμηλότερο από FT=-0.13):
 *    Στο HT η πιθανότητα 0-0 είναι ακόμα πιο υψηλή, χρειάζεται ηπιότερη διόρθωση
 *
 * Επιστρέφει:
 *   pLeadHome, pDraw, pLeadAway — πιθανότητες ημιχρόνιου αποτελέσματος
 *   htBest, htSecond            — Top-2 πιθανότερα σκορ ημιχρόνου (D-C adjusted)
 *   htConf                      — Combined confidence (htBest + htSecond prob × 4.2)
 *   htLambdaH, htLambdaA        — Τελικά lambdas που χρησιμοποιήθηκαν
 *   htFactor                    — League factor που εφαρμόστηκε
 */
function computeHTAnalysis(hExp, aExp, lp) {
  const htF  = lp?.htFactor ?? HT_LAMBDA;
  // Home advantage στο HT: home +2.5%, away -2.5%
  const htH  = clamp(hExp * htF * 1.025, 0.06, 2.8);
  const htA  = clamp(aExp * htF * 0.975, 0.06, 2.8);

  // HT-specific Poisson με D-C ρ = -0.10
  const ppHT = getPoissonProbabilities(htH, htA, -0.10);

  const htConf = Math.round(clamp((ppHT.bestScore.prob + ppHT.secondScore.prob) * 100 * 4.2, 0, 99));

  return {
    pLeadHome: ppHT.pHome,
    pDraw:     ppHT.pDraw,
    pLeadAway: ppHT.pAway,
    htBest:    ppHT.bestScore,
    htSecond:  ppHT.secondScore,
    htConf,
    htLambdaH: htH,
    htLambdaA: htA,
    htFactor:  htF,
    ppHT
  };
}

// ================================================================
//  SCANNER MAIN LOOP
// ================================================================
async function analyzeMatchSafe(m,index,total){
  try{
    setProgress(10+((index+1)/total)*88,`Processing ${index+1}/${total}: ${m.teams.home.name}`);
    
    const[hS, aS, stand, h2hFix, leagueScorers, leagueAssists, leagueCards, hInjuries, aInjuries, lineupData] = await Promise.all([
      buildIntel(m.teams.home.id, m.league.id, m.league.season, true),
      buildIntel(m.teams.away.id, m.league.id, m.league.season, false),
      getStand(m.league.id, m.league.season),
      getH2H(m.teams.home.id, m.teams.away.id),
      getLeagueTopScorers(m.league.id, m.league.season),
      getLeagueTopAssists(m.league.id, m.league.season),
      getLeagueTopCards(m.league.id, m.league.season),
      getTeamInjuries(m.teams.home.id, m.league.id, m.league.season),
      getTeamInjuries(m.teams.away.id, m.league.id, m.league.season),
      getFixtureLineups(m.fixture.id)        // 📋 Starting XI — primary source of truth
    ]);
    
    const lp=getLeagueParams(m.league.id);
    
    // ── DIXON-COLES ΛΑΜΒΔΑ — blended με form-based xG ──────────────
    const dcResult = computeDCLambdas(hS, aS, m.league.id);
    
    // H2H Lambda Blend: αν υπάρχουν >= 4 H2H αγώνες, μεταθέτουμε 12% του λ προς το H2H avg goals
    const h2hSummary=summarizeH2H(h2hFix,m.teams.home.id,m.teams.away.id);
    const h2hGames=h2hSummary.homeWins+h2hSummary.awayWins+h2hSummary.draws;
    let hXG=Number(hS.fXG)*lp.mult, aXG=Number(aS.fXG)*lp.mult;
    if(h2hGames>=4){
      const h2hAvg=parseFloat(h2hSummary.h2hAvgGoals)||0;
      const modelAvg=hXG+aXG;
      if(modelAvg>0&&h2hAvg>0){
        const scale=h2hAvg/modelAvg; const blend=0.12;
        hXG=hXG*(1-blend)+(hXG*scale)*blend;
        aXG=aXG*(1-blend)+(aXG*scale)*blend;
      }
    }

    // Blend DC with form-based
    const blended = blendLambdas(hXG, aXG, dcResult.dcH, dcResult.dcA, dcResult.trust);
    hXG = blended.blendH; aXG = blended.blendA;

    // ── SITUATIONAL CONTEXT ──────────────────────────────────────────
    const sitCtx = computeSituationalContext(stand, m.teams.home.id, m.teams.away.id, m.league.id);
    hXG *= sitCtx.hMot;
    aXG *= sitCtx.aMot;
    
    const tXG=hXG+aXG; // base, pre-injury

    // 🏥 PLAYER PROFILES — xG contribution + card probability per player
    const hPlayers = buildPlayerProfiles(m.teams.home.id, leagueScorers, leagueAssists, leagueCards, hS.totalTeamGoalsSeason);
    const aPlayers = buildPlayerProfiles(m.teams.away.id, leagueScorers, leagueAssists, leagueCards, aS.totalTeamGoalsSeason);

    // ⚠️ ADJUSTMENT — Lineup-first: αν υπάρχει XI → lineup-based, αλλιώς injury-based
    const hXI = lineupData?.available ? lineupData.home : null;
    const aXI = lineupData?.available ? lineupData.away  : null;
    const hInjAdj = applyLineupAdjustment(hXG, hPlayers, hXI, hInjuries);
    const aInjAdj = applyLineupAdjustment(aXG, aPlayers, aXI, aInjuries);
    const hXGfinal = hInjAdj.adjXG;
    const aXGfinal = aInjAdj.adjXG;
    const tXGfinal = hXGfinal + aXGfinal;

    const bttsScore=Math.min(hXGfinal,aXGfinal);const result=computePick(hXGfinal,aXGfinal,tXGfinal,bttsScore,lp,hS,aS);

    // ⏱️ HT ANALYSIS — αυτόνομη ανάλυση ημιχρόνου (league-specific factor + D-C ρ=-0.10)
    const htAnalysis = computeHTAnalysis(result.hExp, result.aExp, lp);
    // Καλείται ΜΕΤΑ το computePick για να έχουμε το result.xgDiff
    // Ταξινομεί τους players κατά adjCardProb DESC
    const cardCtx = { xgDiff: result.xgDiff, leagueId: m.league.id };
    adjustPlayerCardProbs(hPlayers, aS, cardCtx); // home team players: opponent = away stats
    adjustPlayerCardProbs(aPlayers, hS, cardCtx); // away team players: opponent = home stats
    
    const hScorerProb = calculateScorerProb(leagueScorers, m.teams.home.id, result.hExp, hS.totalTeamGoalsSeason);
    const aScorerProb = calculateScorerProb(leagueScorers, m.teams.away.id, result.aExp, aS.totalTeamGoalsSeason);

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
      tXG:tXGfinal,btts:bttsScore,outPick:result.outPick,xgDiff:result.xgDiff,
      hXGbase:hXG, aXGbase:aXG, hXGfinal, aXGfinal,
      hInjAdj, aInjAdj,
      hPlayers, aPlayers,
      htAnalysis,
      lineupData,
      exact:`${result.hG}-${result.aG}`,exact2:`${result.hG2}-${result.aG2}`,exactConf:result.exactConf,
      omegaPick:result.omegaPick,strength:result.pickScore,reason:result.reason,hExp:result.hExp,aExp:result.aExp,pp:result.pp,
      lambdaTotal:result.lambdaTotal,cornerConf:result.cornerConf,expCor:result.expCor,
      hr:getTeamRank(stand,m.teams.home.id)??99,ar:getTeamRank(stand,m.teams.away.id)??99,
      hS,aS,h2h:h2hSummary,
      actStats, isBomb:result.omegaPick.includes('💣'), hScorerProb, aScorerProb,
      sitCtx,    // Situational context (motivation flags, derby)
      dcResult,  // Dixon-Coles attack/defense strengths
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
  window.scannedMatchesData=[];teamStatsCache.clear();lastFixCache.clear();standCache.clear();h2hCache.clear();scorersCache.clear();assistsCache.clear();cardsCache.clear();injuryCache.clear();
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
    renderBetJournal();
    // Push to Google Sheets (non-blocking)
    pushToSheets(window.scannedMatchesData).catch(()=>{});
    showOk(`✅ Scan ολοκληρώθηκε — ${all.length} αγώνες.`);
  }catch(e){showErr(e.message);}finally{isRunning=false;setLoader(false);setBtnsDisabled(false);}
};

// ================================================================
//  LIVE SYNC & TICKER
// ================================================================
// ================================================================
//  LIVE INTELLIGENCE — xGA, Momentum, Next Goal Probability
// ================================================================

/**
 * Υπολογίζει live xG, xGA, momentum και P(επόμενο γκολ)
 * από τα live statistics ενός αγώνα.
 *
 * Μοντέλο xG:
 *   - Αν ο provider δίνει expected_goals → χρησιμοποιούμε αυτό (πηγή: 'provider')
 *   - Αλλιώς composite model:
 *       insideBox shots × 0.22 + outsideBox shots × 0.07
 *       + blocked shots × 0.08 + corners × 0.04
 *
 * P(next goal) = λ_team / (λ_home + λ_away) με μικρό home advantage ×1.04
 */
function computeLiveIntelligence(hStatsArr, aStatsArr, elapsed) {
  if (!hStatsArr?.length || !aStatsArr?.length) return null;
  const el = Math.max(safeNum(elapsed, 1), 1);

  // ── Raw stats ──────────────────────────────────────────────────
  const hSoT   = statVal(hStatsArr, 'Shots on Goal');
  const aSoT   = statVal(aStatsArr, 'Shots on Goal');
  const hTot   = statVal(hStatsArr, 'Total Shots');
  const aTot   = statVal(aStatsArr, 'Total Shots');
  const hInB   = statVal(hStatsArr, 'Shots insidebox');
  const aInB   = statVal(aStatsArr, 'Shots insidebox');
  const hBlk   = statVal(hStatsArr, 'Blocked Shots');
  const aBlk   = statVal(aStatsArr, 'Blocked Shots');
  const hCor   = statVal(hStatsArr, 'Corner Kicks');
  const aCor   = statVal(aStatsArr, 'Corner Kicks');
  const hPoss  = statVal(hStatsArr, 'Ball Possession') || 50;
  const aPoss  = statVal(aStatsArr, 'Ball Possession') || (100 - hPoss);
  const hSaves = statVal(hStatsArr, 'Goalkeeper Saves');
  const aSaves = statVal(aStatsArr, 'Goalkeeper Saves');
  const hFouls = statVal(hStatsArr, 'Fouls');
  const aFouls = statVal(aStatsArr, 'Fouls');
  // Provider xG (quando available from opta/stats-perform)
  const hXGprov = statVal(hStatsArr, 'expected_goals');
  const aXGprov = statVal(aStatsArr, 'expected_goals');

  // ── Live xG ───────────────────────────────────────────────────
  let hLiveXG, aLiveXG, xgSource;
  if (hXGprov > 0 || aXGprov > 0) {
    hLiveXG = Math.max(hXGprov, 0.05);
    aLiveXG = Math.max(aXGprov, 0.05);
    xgSource = 'provider';
  } else {
    // Composite model: inside/outside box shots + blocked + corners
    const hOutB = Math.max(hTot - hInB, 0);
    const aOutB = Math.max(aTot - aInB, 0);
    hLiveXG = Math.max(hInB * 0.22 + hOutB * 0.07 + hBlk * 0.08 + hCor * 0.04, 0.05);
    aLiveXG = Math.max(aInB * 0.22 + aOutB * 0.07 + aBlk * 0.08 + aCor * 0.04, 0.05);
    xgSource = 'model';
  }
  // xGA = αυτό που δέχεται η ομάδα = xG του αντιπάλου
  const hLiveXGA = aLiveXG;
  const aLiveXGA = hLiveXG;

  // ── Momentum (composite pressure index 0–100) ─────────────────
  // Βάρη: shots on target > total shots > corners > possession
  const hPress = hSoT * 4.0 + (hTot - hSoT) * 1.5 + hCor * 2.0 + (hPoss / 100) * 22;
  const aPress = aSoT * 4.0 + (aTot - aSoT) * 1.5 + aCor * 2.0 + (aPoss / 100) * 22;
  const totPress = hPress + aPress || 1;
  const hMomentum = Math.round(clamp((hPress / totPress) * 100, 5, 95));
  const aMomentum = 100 - hMomentum;

  // ── P(Next Goal) — βάσει xG rates per minute ──────────────────
  const hRate = hLiveXG / el;
  const aRate = aLiveXG / el;
  const HOME_ADV = 1.04; // μικρό home advantage
  const totRate  = hRate * HOME_ADV + aRate;
  const pNextHome = clamp((hRate * HOME_ADV) / totRate, 0.05, 0.95);
  const pNextAway = 1 - pNextHome;

  return {
    hLiveXG, aLiveXG, hLiveXGA, aLiveXGA,
    hMomentum, aMomentum,
    pNextHome, pNextAway,
    hSoT, aSoT, hTot, aTot, hCor, aCor,
    hPoss, aPoss, hSaves, aSaves, hFouls, aFouls,
    xgSource, elapsed: el
  };
}

// ================================================================
//  SUBSTITUTION ENGINE — live αντικατάσταση → recalculate metrics
// ================================================================

/**
 * Εντοπίζει αντικαταστάσεις συγκρίνοντας το stored XI με το νέο
 * και επανυπολογίζει xG, exact scores, HT, picks για αυτό το match.
 *
 * Επιστρέφει τα changed fields για flash animation.
 */
function applySubstitution(d, newLineupData) {
  if(!newLineupData?.available || !d.lineupData?.available) return null;

  const prevHxi = d.lineupData.home.xiIds;
  const prevAxi = d.lineupData.away.xiIds;
  const newHxi  = newLineupData.home.xiIds;
  const newAxi  = newLineupData.away.xiIds;

  // Βρες ποιοι παίκτες αλλαξαν (subbed out)
  const hSubbed = [...prevHxi].filter(id => !newHxi.has(id));
  const aSubbed = [...prevAxi].filter(id => !newAxi.has(id));
  const hSubbedIn  = [...newHxi].filter(id => !prevHxi.has(id));
  const aSubbedIn  = [...newAxi].filter(id => !prevAxi.has(id));

  if(!hSubbed.length && !aSubbed.length) return null; // δεν έγινε αντικατάσταση

  // Ενημέρωση lineupData
  d.lineupData = newLineupData;
  lineupsCache.set(String(d.fixId), newLineupData);

  // Ποιοι παίκτες αλλαξαν (για display)
  const subEvents = [];
  const getName = (players, id) => players.find(p=>p.id===id)?.name || `#${id}`;

  hSubbed.forEach((id, i) => {
    const out = getName([...d.hPlayers], id);
    const inP = d.hPlayers.find(p=>p.id===hSubbedIn[i]);
    const inName = inP?.name || getName([...d.lineupData?.home?.subs||[]], hSubbedIn[i]);
    subEvents.push({ team:'home', out, in: inName, outId:id, inId:hSubbedIn[i] });
  });
  aSubbed.forEach((id, i) => {
    const out = getName([...d.aPlayers], id);
    const inP = d.aPlayers.find(p=>p.id===aSubbedIn[i]);
    const inName = inP?.name || getName([...d.lineupData?.away?.subs||[]], aSubbedIn[i]);
    subEvents.push({ team:'away', out, in: inName, outId:id, inId:aSubbedIn[i] });
  });

  // Recalculate adjustment με νέο XI
  const lp = getLeagueParams(d.leagueId);
  const prevHXGfinal = d.hXGfinal, prevAXGfinal = d.aXGfinal;

  const newHAdj = applyLineupAdjustment(d.hXGbase, d.hPlayers, newLineupData.home, []);
  const newAAdj = applyLineupAdjustment(d.aXGbase, d.aPlayers, newLineupData.away, []);
  const hXGfinal = newHAdj.adjXG, aXGfinal = newAAdj.adjXG;
  const tXGfinal = hXGfinal + aXGfinal;
  const btts = Math.min(hXGfinal, aXGfinal);
  const result = computePick(hXGfinal, aXGfinal, tXGfinal, btts, lp, d.hS, d.aS);
  const htAnalysis = computeHTAnalysis(result.hExp, result.aExp, lp);

  // Παρακολούθηση changed fields (για flash)
  const changed = {};
  if(Math.abs(hXGfinal - prevHXGfinal) > 0.02) changed.hXGfinal = { prev: prevHXGfinal, next: hXGfinal };
  if(Math.abs(aXGfinal - prevAXGfinal) > 0.02) changed.aXGfinal = { prev: prevAXGfinal, next: aXGfinal };
  if(result.omegaPick !== d.omegaPick)          changed.omegaPick = { prev: d.omegaPick, next: result.omegaPick };
  if(`${result.hG}-${result.aG}` !== d.exact)   changed.exact = { prev: d.exact, next:`${result.hG}-${result.aG}` };

  // Apply updates
  Object.assign(d, {
    hXGfinal, aXGfinal, tXG: tXGfinal, btts,
    hInjAdj: newHAdj, aInjAdj: newAAdj, htAnalysis,
    outPick: result.outPick, xgDiff: result.xgDiff,
    exact: `${result.hG}-${result.aG}`, exact2: `${result.hG2}-${result.aG2}`,
    exactConf: result.exactConf, omegaPick: result.omegaPick,
    strength: result.pickScore, reason: result.reason,
    hExp: result.hExp, aExp: result.aExp, pp: result.pp,
    lambdaTotal: result.lambdaTotal, cornerConf: result.cornerConf, expCor: result.expCor,
    lastSubEvents: subEvents,   // για accordion display
    subChanged: changed,        // για flash animation
    subTimestamp: Date.now()
  });

  return { subEvents, changed };
}

// ═══════════════════════════════════════════════════════════════════
// IN-PLAY xG ADJUSTMENT ENGINE
// ═══════════════════════════════════════════════════════════════════
function inPlayLambdaAdjust(baseLambda,goalsScored,goalsAgainst,elapsed){
  const remaining=clamp((90-(elapsed||0))/90,0,1);
  const goalBoost=goalsScored*0.15;
  return Math.max((baseLambda+goalBoost)*remaining,0.05);
}

function inPlayMarketDecay(pp,elapsed,hGoals,aGoals){
  const totGoals=hGoals+aGoals,e=elapsed||0;
  let dO25=pp.pO25,dO35=pp.pO35,dU25=pp.pU25,dBTTS=pp.pBTTS;
  if(totGoals>=3){dO25=1.0;dO35=totGoals>=4?1.0:pp.pO35;}
  if(totGoals>=4)dO35=1.0;
  if(totGoals<=2&&e>=85)dU25=totGoals<3?1.0:0.0;
  if(hGoals>=1&&aGoals>=1)dBTTS=1.0;
  if(totGoals<3&&e>60){const er=clamp((e-60)/30,0,0.7);dO25*=(1-er*0.6);dO35*=(1-er*0.8);}
  if(totGoals===0&&e>70){const bo=clamp((e-70)/20,0,0.9);dU25=Math.min(dU25+bo*0.4,0.98);}
  if(aGoals===0&&e>75){const fa=clamp((e-75)/15,0,0.8);dBTTS*=(1-fa*0.5);}
  if(hGoals===0&&e>75){const fa=clamp((e-75)/15,0,0.8);dBTTS*=(1-fa*0.5);}
  return{pO25:clamp(dO25,0,1),pO35:clamp(dO35,0,1),pU25:clamp(dU25,0,1),pBTTS:clamp(dBTTS,0,1)};
}

function computeInPlayPick(baseRec,liveFixture){
  if(!baseRec||!liveFixture)return null;
  const hGoals=liveFixture.goals?.home??0,aGoals=liveFixture.goals?.away??0;
  const elapsed=liveFixture.fixture?.status?.elapsed??0;
  const status=liveFixture.fixture?.status?.short??'';
  if(!isLive(status))return null;
  const lp=getLeagueParams(baseRec.leagueId);
  const hLambdaAdj=inPlayLambdaAdjust(baseRec.hExp||1.1,hGoals,aGoals,elapsed);
  const aLambdaAdj=inPlayLambdaAdjust(baseRec.aExp||1.1,aGoals,hGoals,elapsed);
  const ppAdj=getPoissonProbabilities(hLambdaAdj,aLambdaAdj);
  const decayed=inPlayMarketDecay(ppAdj,elapsed,hGoals,aGoals);
  const totGoals=hGoals+aGoals;
  let inPlayPick='ΧΩΡΙΣ ΣΥΣΤΑΣΗ ⏱',inPlayConf=0,inPlayReason='';
  if(totGoals>=3||decayed.pO35>=0.70){inPlayPick='🚀 ΠΑΝΩ ΑΠΟ 3.5 ΓΚΟΛ';inPlayConf=decayed.pO35*100;inPlayReason=`${totGoals>=4?'4+ γκολ':'Πιθ. Πάνω 3.5: '+(decayed.pO35*100).toFixed(0)+'%'} · ${elapsed}'`;}
  else if(totGoals>=2||decayed.pO25>=0.72){inPlayPick='🔥 ΠΑΝΩ ΑΠΟ 2.5 ΓΚΟΛ';inPlayConf=decayed.pO25*100;inPlayReason=`${totGoals===2?'2 γκολ':'Πιθ. Πάνω 2.5: '+(decayed.pO25*100).toFixed(0)+'%'} · ${elapsed}'`;}
  else if(decayed.pU25>=0.72&&elapsed>=60){inPlayPick='🔒 ΚΑΤΩ ΑΠΟ 2.5 ΓΚΟΛ';inPlayConf=decayed.pU25*100;inPlayReason=`${totGoals} γκολ · ${elapsed}' · Πιθ. Κάτω 2.5: ${(decayed.pU25*100).toFixed(0)}%`;}
  else if(decayed.pBTTS>=0.68&&hGoals===1&&aGoals===0&&elapsed<=70){inPlayPick='🎯 ΓΚΟΛ/ΓΚΟΛ (Οι φιλοξ. να σκοράρουν)';inPlayConf=decayed.pBTTS*100;inPlayReason=`Γηπεδ. προηγούνται 1-0 · ${elapsed}'`;}
  else if(decayed.pBTTS>=0.68&&aGoals===1&&hGoals===0&&elapsed<=70){inPlayPick='🎯 ΓΚΟΛ/ΓΚΟΛ (Οι γηπεδ. να σκοράρουν)';inPlayConf=decayed.pBTTS*100;inPlayReason=`Φιλοξ. προηγούνται 1-0 · ${elapsed}'`;}
  else if(elapsed<30){const decay=1-(elapsed/90)*0.3;inPlayPick=baseRec.omegaPick||'ΧΩΡΙΣ ΣΥΣΤΑΣΗ ⏱';inPlayConf=(baseRec.strength||0)*decay;inPlayReason=`Σήμα pre-match · Παρέλ.: ${elapsed}'`;}
  else{inPlayReason=`Ανεπαρκής στατιστικό πλεονέκτημα στο ${elapsed}'`;}
  return{inPlayPick,inPlayConf:clamp(inPlayConf,0,99),inPlayReason,hGoals,aGoals,elapsed,status,decayed,ppAdj};
}

// ── Live Tracker Engine ───────────────────────────────────────────────────────
window.startLiveTracker=async function(){
  if(isLiveTracking)return;
  const lgEl=document.getElementById('liveTrackerLeague');
  liveTrackerLeagues=lgEl?.value||'MY_LEAGUES';
  isLiveTracking=true;_updateLiveTrackerUI();
  await _liveTrackerTick();
  liveTrackerInterval=setInterval(_liveTrackerTick,LIVE_POLL_MS);
};
window.stopLiveTracker=function(){
  if(liveTrackerInterval){clearInterval(liveTrackerInterval);liveTrackerInterval=null;}
  isLiveTracking=false;_updateLiveTrackerUI();
  const s=document.getElementById('liveTrackerStatus');if(s)s.textContent='Tracker stopped.';
};

async function _liveTrackerTick(){
  const statusEl=document.getElementById('liveTrackerStatus'),lastEl=document.getElementById('liveTrackerLastPoll'),countEl=document.getElementById('liveMatchCount');
  if(statusEl)statusEl.textContent='Polling live fixtures...';
  try{
    const res=await apiReq('fixtures?live=all');
    const all=(res.response||[]).filter(m=>{
      if(liveTrackerLeagues==='ALL')return typeof LEAGUE_IDS!=='undefined'&&LEAGUE_IDS.includes(m.league.id);
      if(liveTrackerLeagues==='MY_LEAGUES')return typeof MY_LEAGUES_IDS!=='undefined'&&MY_LEAGUES_IDS.includes(m.league.id);
      return m.league.id===parseInt(liveTrackerLeagues);
    });
    if(countEl)countEl.textContent=all.length;
    const liveRecs=[];
    for(const lf of all){
      const fixId=lf.fixture.id;
      const preMatch=(window.scannedMatchesData||[]).find(r=>r.fixId===fixId);
      let inPlay=null;
      if(preMatch){inPlay=computeInPlayPick(preMatch,lf);}
      else{
        try{
          const[hS,aS]=await Promise.all([buildIntel(lf.teams.home.id,lf.league.id,lf.league.season,true),buildIntel(lf.teams.away.id,lf.league.id,lf.league.season,false)]);
          const lp=getLeagueParams(lf.league.id);const hXG=Number(hS.fXG)*lp.mult,aXG=Number(aS.fXG)*lp.mult;
          const tXG=hXG+aXG;const res2=computePick(hXG,aXG,tXG,Math.min(hXG,aXG),lp,hS,aS);
          const syn={fixId,ht:lf.teams.home.name,at:lf.teams.away.name,lg:lf.league.name,leagueId:lf.league.id,hExp:res2.hExp,aExp:res2.aExp,omegaPick:res2.omegaPick,strength:res2.pickScore,tXG,hS,aS};
          inPlay=computeInPlayPick(syn,lf);
        }catch{}
      }
      const prev=liveMatchesState[fixId];
      if(prev&&inPlay&&prev.inPlayPick!==inPlay.inPlayPick){
        const alert={time:new Date().toLocaleTimeString('el-GR'),fixId,ht:lf.teams.home.name,at:lf.teams.away.name,elapsed:lf.fixture.status.elapsed,from:prev.inPlayPick,to:inPlay.inPlayPick,score:`${lf.goals.home}-${lf.goals.away}`};
        liveAlerts.unshift(alert);if(liveAlerts.length>20)liveAlerts.pop();
        _flashSignalAlert(alert);
        try{localStorage.setItem(LS_LIVE_ALERTS,JSON.stringify(liveAlerts.slice(0,20)));}catch{}
      }
      liveMatchesState[fixId]={...inPlay,lf};liveRecs.push({lf,inPlay,preMatch});
    }
    _renderLiveDashboard(liveRecs);_renderLiveAlerts();
    if(statusEl)statusEl.textContent=`Ενεργό — poll σε ${LIVE_POLL_MS/1000}s`;
    if(lastEl)lastEl.textContent=new Date().toLocaleTimeString('el-GR');
  }catch(e){if(statusEl)statusEl.textContent=`Poll error: ${e.message}`;}
}

function _updateLiveTrackerUI(){
  const startBtn=document.getElementById('liveStartBtn'),stopBtn=document.getElementById('liveStopBtn'),dot=document.getElementById('liveStatusDot');
  if(startBtn)startBtn.disabled=isLiveTracking;if(stopBtn)stopBtn.disabled=!isLiveTracking;
  if(dot){dot.style.background=isLiveTracking?'var(--accent-green)':'var(--accent-red)';dot.style.boxShadow=isLiveTracking?'0 0 8px var(--accent-green)':'none';}
}

function _flashSignalAlert(alert){
  const box=document.getElementById('liveAlertFlash');if(!box)return;
  box.innerHTML=`<div class="live-flip-alert">🔔 <strong>ΑΛΛΑΓΗ ΣΗΜΑΤΟΣ</strong> · ${esc(alert.ht)} εναντίον ${esc(alert.at)} · ${alert.elapsed}' · Σκορ: ${esc(alert.score)}<br><span style="color:var(--accent-red)">${esc(alert.from)}</span> → <span style="color:var(--accent-green)">${esc(alert.to)}</span></div>`;
  setTimeout(()=>{if(box)box.innerHTML='';},8000);
  const logSec=document.getElementById('liveAlertSection');if(logSec)logSec.style.display='block';
}

function _renderLiveAlerts(){
  const el=document.getElementById('liveAlertLog');if(!el||!liveAlerts.length)return;
  el.innerHTML=liveAlerts.map(a=>`<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border-light);font-size:0.7rem;flex-wrap:wrap;"><span style="color:var(--text-muted);font-family:var(--font-mono);min-width:55px;">${a.time}</span><span style="font-weight:700;color:var(--text-main);">${esc(a.ht)} εναντίον ${esc(a.at)}</span><span style="color:var(--text-muted);">${a.elapsed}' · ${a.score}</span><span style="color:var(--accent-red);">${esc(a.from)}</span><span style="color:var(--text-muted);">→</span><span style="color:var(--accent-green);">${esc(a.to)}</span></div>`).join('');
}

function _renderLiveDashboard(liveRecs){
  const el=document.getElementById('liveDashboard');if(!el)return;
  if(!liveRecs.length){el.innerHTML=`<div style="text-align:center;color:var(--text-muted);padding:32px 0;font-size:0.8rem;">Δεν υπάρχουν live αγώνες για τα επιλεγμένα πρωταθλήματα.</div>`;return;}
  liveRecs.sort((a,b)=>{
    const aF=a.inPlay&&liveMatchesState[a.lf.fixture.id]?.inPlayPick!==a.preMatch?.omegaPick?1:0;
    const bF=b.inPlay&&liveMatchesState[b.lf.fixture.id]?.inPlayPick!==b.preMatch?.omegaPick?1:0;
    if(bF!==aF)return bF-aF;
    return(b.lf.fixture.status.elapsed||0)-(a.lf.fixture.status.elapsed||0);
  });
  el.innerHTML=liveRecs.map(({lf,inPlay,preMatch})=>{
    const hG=lf.goals?.home??0,aG=lf.goals?.away??0,el_min=lf.fixture.status.elapsed||0,status=lf.fixture.status.short;
    const conf=inPlay?clamp(inPlay.inPlayConf,0,99):0;
    const confColor=conf>=70?'var(--accent-green)':conf>=45?'var(--accent-gold)':'var(--accent-red)';
    const pick=inPlay?.inPlayPick||'NO BET ⏱',reason=inPlay?.inPlayReason||'';
    const isNoBet=pick.includes('ΧΩΡΙΣ ΣΥΣΤΑΣΗ');
    const pickColor=isNoBet?'var(--text-muted)':pick.includes('ΚΑΤΩ')?'var(--accent-teal)':pick.includes('ΠΑΝΩ ΑΠΟ 3.5')?'var(--accent-purple)':pick.includes('ΓΚΟΛ/ΓΚΟΛ')?'var(--accent-gold)':'var(--accent-green)';
    const preMatchPick=preMatch?.omegaPick||'';
    const isFlip=inPlay&&!isNoBet&&preMatchPick&&preMatchPick!==pick&&!preMatchPick.includes('ΧΩΡΙΣ ΣΥΣΤΑΣΗ');
    const flipBadge=isFlip?`<span style="font-size:0.6rem;background:rgba(251,191,36,0.2);color:var(--accent-gold);border:1px solid var(--accent-gold);border-radius:4px;padding:1px 6px;font-weight:700;margin-left:6px;">ΑΛΛΑΓΗ</span>`:'';
    const timeProgress=status==='HT'?50:clamp(el_min/90*100,0,100);
    const d=inPlay?.decayed;
    // Ισχυρή σύσταση: conf >= 75 και όχι ΧΩΡΙΣ ΣΥΣΤΑΣΗ
    const isStrong = !isNoBet && conf >= 75;
    const cardBorder = isFlip ? 'var(--accent-gold)' : isStrong ? 'var(--accent-green)' : isNoBet ? 'var(--border-light)' : 'rgba(16,185,129,0.25)';
    return`<div class="match-card${isStrong?' live-strong-signal':''}" id="live-card-${lf.fixture.id}" style="border-color:${cardBorder};${isStrong?'border-width:2px;':''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <div class="match-league"><span class="live-dot"></span><span class="league-badge">${esc(status)}</span><span style="color:var(--text-muted);font-size:0.65rem;margin-left:4px;">${esc(lf.league.name)}</span></div>
          <div style="font-weight:700;font-size:0.95rem;margin:6px 0 2px;">${esc(lf.teams.home.name)}</div>
          <div style="font-weight:600;font-size:0.85rem;color:var(--text-muted);">${esc(lf.teams.away.name)}</div>
        </div>
        <div style="text-align:center;min-width:80px;">
          <div style="font-size:2rem;font-weight:900;font-family:var(--font-mono);color:var(--accent-green);line-height:1;">${hG} - ${aG}</div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px;">${status==='HT'?'ΗΜ/ΝΙΟ':`${el_min}'`}</div>
          <div style="margin-top:6px;background:var(--bg-base);border-radius:4px;overflow:hidden;height:4px;"><div style="height:4px;width:${timeProgress}%;background:var(--accent-green);border-radius:4px;"></div></div>
        </div>
        <div style="flex:1;min-width:160px;text-align:right;">
          <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Σήμα Live${flipBadge}</div>
          <div class="${isStrong?'live-pick-pulse':''}" style="font-size:0.85rem;font-weight:800;color:${pickColor};">${esc(pick)}</div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:3px;">${esc(reason)}</div>
          <div style="margin-top:6px;">
            <div style="display:flex;justify-content:flex-end;align-items:center;gap:6px;font-size:0.65rem;"><span style="color:var(--text-muted);">Βεβαιότητα</span><span style="font-family:var(--font-mono);color:${confColor};font-weight:700;">${conf.toFixed(0)}%</span></div>
            <div style="background:var(--bg-base);border-radius:3px;height:5px;margin-top:3px;"><div style="height:5px;width:${conf}%;background:${confColor};border-radius:3px;"></div></div>
          </div>
          ${isStrong?`<div class="live-strong-badge">🔔 ΙΣΧΥΡΗ ΣΥΣΤΑΣΗ</div>`:''}
        </div>
      </div>
      ${d?`<div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">
        ${[{lbl:'Πάνω 2.5',v:d.pO25,c:'var(--accent-green)'},{lbl:'Πάνω 3.5',v:d.pO35,c:'var(--accent-purple)'},{lbl:'Κάτω 2.5',v:d.pU25,c:'var(--accent-teal)'},{lbl:'ΓΓ',v:d.pBTTS,c:'var(--accent-gold)'}].map(m=>{
          const p=Math.round(m.v*100);
          return`<div style="flex:1;min-width:55px;background:var(--bg-base);border-radius:6px;padding:6px 8px;text-align:center;"><div style="font-size:0.58rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">${m.lbl}</div><div style="font-size:0.9rem;font-weight:900;font-family:var(--font-mono);color:${p>=65?m.c:'var(--text-muted)'};">${p}%</div></div>`;
        }).join('')}
        ${preMatchPick&&!isNoBet?`<div style="flex:2;min-width:120px;background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.15);border-radius:6px;padding:6px 10px;"><div style="font-size:0.58rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:2px;">Πρό-αγώνα</div><div style="font-size:0.72rem;font-weight:700;color:var(--accent-blue);">${esc(preMatchPick)}</div></div>`:''}
      </div>`:''}
    </div>`;
  }).join('');
}

function _renderLiveAlerts(){
  const el=document.getElementById('liveAlertLog');if(!el||!liveAlerts.length)return;
  el.innerHTML=liveAlerts.map(a=>`<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border-light);font-size:0.7rem;flex-wrap:wrap;"><span style="color:var(--text-muted);font-family:var(--font-mono);min-width:55px;">${a.time}</span><span style="font-weight:700;color:var(--text-main);">${esc(a.ht)} vs ${esc(a.at)}</span><span style="color:var(--text-muted);">${a.elapsed}' · ${a.score}</span><span style="color:var(--accent-red);">${esc(a.from)}</span><span style="color:var(--text-muted);">→</span><span style="color:var(--accent-green);">${esc(a.to)}</span></div>`).join('');
}

window.syncLiveScores=async function(){
  if(isRunning)return;const btn=document.getElementById('btnSyncLive');if(btn){btn.innerText='Syncing…';btn.disabled=true;}
  try{
    const res=await apiReq('fixtures?live=all');const liveArr=res.response||[];
    if(!liveArr.length){showOk('Δεν υπάρχουν live αγώνες.');return;}
    const liveMap=new Map(liveArr.map(f=>[f.fixture.id,f]));

    // 1. Score + events (1 credit)
    let n=0;
    window.scannedMatchesData.forEach(d=>{
      if(!liveMap.has(d.fixId))return;const ld=liveMap.get(d.fixId);
      d.m.goals=ld.goals;d.m.fixture.status=ld.fixture.status;
      const evts=ld.events||[];let cor=0,yel=0,red=0;
      evts.forEach(ev=>{const t=(ev.type||'').toLowerCase(),det=(ev.detail||'').toLowerCase();
        if(t==='corner')cor++;
        else if(t==='card'){if(det.includes('yellow'))yel++;else if(det.includes('red')&&!det.includes('yellow'))red++;}
      });
      if(evts.length>0){d.liveCorners=cor;d.liveYellows=yel;d.liveReds=red;}n++;
    });

    const liveTracked=window.scannedMatchesData.filter(d=>liveMap.has(d.fixId));
    if(!liveTracked.length){renderSummaryTable();tickerRefresh();showOk(`✅ 1 Credit · Synced ${n} αγώνες`);return;}

    // 2. Live Stats + Lineups (parallel per match)
    let subCount=0, liveIntelCount=0;
    await Promise.all(liveTracked.map(async d=>{
      try{
        const[srStats, srLineup] = await Promise.all([
          apiReq(`fixtures/statistics?fixture=${d.fixId}`),
          apiReq(`fixtures/lineups?fixture=${d.fixId}`)
        ]);
        // Live stats → liveIntel
        if(srStats.response?.length>=2){
          const elapsed=d.m?.fixture?.status?.elapsed||45;
          d.liveIntel=computeLiveIntelligence(srStats.response[0].statistics, srStats.response[1].statistics, elapsed);
          liveStatsCache.set(String(d.fixId),{h:srStats.response[0].statistics,a:srStats.response[1].statistics,ts:Date.now()});
          liveIntelCount++;
        }
        // Lineups → substitution detection & recalculation
        const newLineup = parseLineup(srLineup?.response||[]);
        if(newLineup.available){
          const subResult = applySubstitution(d, newLineup);
          if(subResult){
            subCount++;
            flashMatchUpdate(d.fixId, subResult);
          } else {
            // Ακόμα και χωρίς sub, store νέο lineup
            d.lineupData = newLineup;
          }
        }
      }catch(e){ console.warn('[APEX] live sync error fix',d.fixId,e.message); }
    }));

    renderSummaryTable();tickerRefresh();
    const credits = 1 + liveTracked.length * 2;
    showOk(`✅ ~${credits} Credits · ${n} live · Intel: ${liveIntelCount} · Αντικαταστάσεις: ${subCount}`);
  }catch(e){showErr('Sync error: '+e.message);}
  finally{if(btn){btn.innerText='Live Sync';btn.disabled=false;}}
};

/**
 * Εφαρμόζει flash animation στη summary table row και τα accordion cells
 * που άλλαξαν λόγω αντικατάστασης.
 */
function flashMatchUpdate(fixId, subResult){
  if(!subResult) return;
  const row = document.getElementById(`row-${fixId}`);
  if(!row) return;

  // Flash ολόκληρης γραμμής (CSS class)
  row.classList.remove('row-flash');
  void row.offsetWidth; // reflow για restart animation
  row.classList.add('row-flash');

  // Flash cells που άλλαξαν
  const changed = subResult.changed || {};
  const cellMap = { exact:'.col-exact', omegaPick:'.col-signal' };
  Object.keys(changed).forEach(field=>{
    const cell = row.querySelector(cellMap[field]||'');
    if(!cell) return;
    cell.classList.remove('cell-flash');
    void cell.offsetWidth;
    cell.classList.add('cell-flash');
  });

  // Sub toast
  const subLines = (subResult.subEvents||[]).map(s=>
    `${s.team==='home'?'🏠':'✈️'} <b>${(s.out||'').split(' ').slice(-1)[0]}</b> → ${(s.in||'').split(' ').slice(-1)[0]}`
  ).join(' · ');
  if(subLines) showOk(`🔄 ${subLines}`);
}

/**
 * Fetch lineups για ΟΛΑ τα scanned matches που δεν έχουν ακόμα επιβεβαιωμένη ενδεκάδα
 */
window.fetchAllLineups = async function() {
  const pending = (window.scannedMatchesData||[]).filter(d=>!d.lineupData?.available);
  if(!pending.length){ showOk('Όλες οι ενδεκάδες είναι ήδη διαθέσιμες.'); return; }
  const btn = document.getElementById('btnFetchLineups');
  if(btn){ btn.disabled=true; btn.textContent=`⏳ Fetching…`; }
  let confirmed=0, unavailable=0;
  for(const d of pending){
    try{
      const sr = await apiReq(`fixtures/lineups?fixture=${d.fixId}`);
      const nl = parseLineup(sr?.response||[]);
      if(nl.available){
        d.lineupData = nl;
        lineupsCache.set(String(d.fixId), nl);
        const lp = getLeagueParams(d.leagueId);
        const hA = applyLineupAdjustment(d.hXGbase||d.hXGfinal, d.hPlayers, nl.home, []);
        const aA = applyLineupAdjustment(d.aXGbase||d.aXGfinal, d.aPlayers, nl.away, []);
        const res = computePick(hA.adjXG, aA.adjXG, hA.adjXG+aA.adjXG, Math.min(hA.adjXG,aA.adjXG), lp, d.hS, d.aS);
        Object.assign(d,{hXGfinal:hA.adjXG,aXGfinal:aA.adjXG,hInjAdj:hA,aInjAdj:aA,
          outPick:res.outPick,exact:`${res.hG}-${res.aG}`,exact2:`${res.hG2}-${res.aG2}`,
          exactConf:res.exactConf,omegaPick:res.omegaPick,strength:res.pickScore,
          hExp:res.hExp,aExp:res.aExp,pp:res.pp});
        confirmed++;
      } else { unavailable++; }
    }catch(_){ unavailable++; }
  }
  if(btn){ btn.disabled=false; btn.textContent=`📋 Fetch Lineups`; }
  renderSummaryTable();
  showOk(`📋 ${confirmed} ενδεκάδες επιβεβαιώθηκαν · ${unavailable} εκκρεμείς`);
};

/**
 * Fetch lineup για ένα συγκεκριμένο match (από το Fetch XI button)
 */
window.fetchLineupForMatch = async function(fixId) {
  const d = (window.scannedMatchesData||[]).find(x=>String(x.fixId)===String(fixId));
  if(!d){ showErr('Match not found'); return; }
  try{
    const sr = await apiReq(`fixtures/lineups?fixture=${fixId}`);
    const newLineup = parseLineup(sr?.response||[]);
    if(!newLineup.available){ showErr('Ενδεκάδα δεν είναι ακόμα διαθέσιμη.'); return; }
    // Store + re-apply adjustment
    d.lineupData = newLineup;
    lineupsCache.set(String(fixId), newLineup);
    const lp = getLeagueParams(d.leagueId);
    const newHAdj = applyLineupAdjustment(d.hXGbase, d.hPlayers, newLineup.home, []);
    const newAAdj = applyLineupAdjustment(d.aXGbase, d.aPlayers, newLineup.away, []);
    const hXGfinal = newHAdj.adjXG, aXGfinal = newAAdj.adjXG;
    const tXGfinal = hXGfinal + aXGfinal;
    const btts = Math.min(hXGfinal, aXGfinal);
    const result = computePick(hXGfinal, aXGfinal, tXGfinal, btts, lp, d.hS, d.aS);
    const htAnalysis = computeHTAnalysis(result.hExp, result.aExp, lp);
    const cardCtx = {xgDiff: result.xgDiff, leagueId: d.leagueId};
    adjustPlayerCardProbs(d.hPlayers, d.aS, cardCtx);
    adjustPlayerCardProbs(d.aPlayers, d.hS, cardCtx);
    Object.assign(d, {
      hXGfinal, aXGfinal, tXG:tXGfinal, btts,
      hInjAdj:newHAdj, aInjAdj:newAAdj, htAnalysis,
      outPick:result.outPick, xgDiff:result.xgDiff,
      exact:`${result.hG}-${result.aG}`, exact2:`${result.hG2}-${result.aG2}`,
      exactConf:result.exactConf, omegaPick:result.omegaPick,
      strength:result.pickScore, reason:result.reason,
      hExp:result.hExp, aExp:result.aExp, pp:result.pp,
      lambdaTotal:result.lambdaTotal, cornerConf:result.cornerConf, expCor:result.expCor,
    });
    // Refresh the open accordion row
    const detailRow = document.getElementById(`details-${fixId}`);
    if(detailRow?.style.display !== 'none'){
      const td = detailRow.querySelector('td');
      if(td) td.innerHTML = buildAccordionHTML(d).replace(/^<td[^>]*>|<\/td>$/g,'');
    }
    renderSummaryTable();
    flashMatchUpdate(fixId, {subEvents:[], changed:{exact:{}}});
    showOk(`✅ Ενδεκάδα επιβεβαιώθηκε · ${d.ht} (${newLineup.home.formation}) vs ${d.at} (${newLineup.away.formation})`);
  }catch(e){ showErr('Lineup fetch error: '+e.message); }
};

let _autoSyncTimer=null;
function startAutoSync(){if(_autoSyncTimer)clearInterval(_autoSyncTimer);_autoSyncTimer=setInterval(()=>{const hasLive=(window.scannedMatchesData||[]).some(d=>isLive(d.m?.fixture?.status?.short));if(hasLive&&!isRunning)syncLiveScores();},90000);}

let _tickerRaf=null,_tickerPx=45;
function tickerRefresh(){
  const bar=document.getElementById('tickerBar'),inner=document.getElementById('tickerInner');if(!bar||!inner)return;
  const data=window.scannedMatchesData||[];if(!data.length)return;
  
  const liveMatches = data.filter(d => isLive(d.m?.fixture?.status?.short || ''));
  if(!liveMatches.length){bar.style.display='none'; if(_tickerRaf)cancelAnimationFrame(_tickerRaf); return;}
  
  const items=liveMatches.map(d=>{
    const gh=d.m?.goals?.home??'0',ga=d.m?.goals?.away??'0';
    const elapsed = d.m?.fixture?.status?.elapsed ? `${d.m.fixture.status.elapsed}'` : 'LIVE';
    const scoreHtml=`<span class="t-score t-live">${gh}-${ga} <small style="color:var(--accent-green);font-size:0.5em">${elapsed}</small></span>`;
    const pickHtml=!d.omegaPick?.includes('NO BET')?`<span class="t-pick">${esc((d.omegaPick||'').split(' ').slice(0,2).join(' '))}</span>`:'';
    const corHtml=d.liveCorners!==undefined?`<span class="t-cor">🚩${d.liveCorners}</span>`:'';
    // Next Goal probability in ticker
    let nextGoalHtml='';
    if(d.liveIntel){
      const li=d.liveIntel;
      const favTeam=li.pNextHome>li.pNextAway?'🏠':'✈️';
      const favPct=Math.round(Math.max(li.pNextHome,li.pNextAway)*100);
      const momColor=li.hMomentum>60?'var(--accent-gold)':li.aMomentum>60?'var(--accent-blue)':'var(--accent-teal)';
      nextGoalHtml=`<span style="color:${momColor};font-size:0.85em;">🎯${favTeam}${favPct}%</span>`;
    }
    return `<div class="ticker-item"><span class="live-dot" style="width:5px;height:5px;"></span>${esc(d.ht)} <span style="opacity:0.4">vs</span> ${esc(d.at)} ${scoreHtml}${pickHtml}${corHtml}${nextGoalHtml}</div>`;
  }).join('');
  
  inner.innerHTML=items+items;bar.style.display='flex';
  
  if(_tickerRaf)cancelAnimationFrame(_tickerRaf);
  let pos=0,last=null;
  function step(ts){if(last===null)last=ts;const dt=Math.min((ts-last)/1000,0.1);last=ts;pos+=_tickerPx*dt;const half=inner.scrollWidth/2;if(pos>=half)pos=0;inner.style.transform=`translateX(-${pos.toFixed(1)}px)`;_tickerRaf=requestAnimationFrame(step);}
  _tickerRaf=requestAnimationFrame(step);
}

// ================================================================
//  TOP LISTS & TABS
// ================================================================
function rebuildTopLists(){
  const sd = (window.scannedMatchesData||[]).filter(x => !isFinished(x.m?.fixture?.status?.short));
  latestTopLists.combo1   =sd.filter(x=>x.omegaPick?.includes('⚡')||x.omegaPick?.includes('💣')).sort((a,b)=>b.strength-a.strength).slice(0,6);
  latestTopLists.outcomes =sd.filter(x=>x.omegaPick?.includes('ΑΣΟΣ')||x.omegaPick?.includes('ΔΙΠΛΟ')).sort((a,b)=>b.strength-a.strength).slice(0,6);
  latestTopLists.exact    =[...sd].sort((a,b)=>(b.exactConf||0)-(a.exactConf||0)).slice(0,6);
  latestTopLists.over25   =sd.filter(x=>x.omegaPick?.includes('OVER 2.5')).sort((a,b)=>b.strength-a.strength).slice(0,6);
  latestTopLists.corners  =sd.filter(x=>x.omegaPick?.includes('ΚΟΡΝΕΡ')).sort((a,b)=>b.cornerConf-a.cornerConf).slice(0,6);
  // 👥 PLAYERS — flatten all players, enrich with match context
  const seen = new Set();
  const allP  = [];
  sd.forEach(d => {
    const addSide = (players, teamName) => (players||[]).forEach(p => {
      const key = `${p.id}_${d.fixId}`;
      if(seen.has(key)) return; seen.add(key);
      if((p.xGContrib||0)<0.005 && (p.adjCardProb||0)<2 && (p.adjRedCardProb||0)<1) return;
      allP.push({ ...p, matchId:d.fixId, matchLabel:`${d.ht} vs ${d.at}`, teamName, lg:d.lg });
    });
    addSide(d.hPlayers, d.ht);
    addSide(d.aPlayers, d.at);
  });
  latestTopLists.players = allP;
}

function renderTopSections(){
  const tabs=[
    {id:'combo1',  lbl:`⚡ Top Picks (${acr('1X2')}/${acr('AH')})`, d:latestTopLists.combo1,  sk:'strength',   sl:'CONF'},
    {id:'outcomes',lbl:'Match Odds',                                   d:latestTopLists.outcomes,sk:'strength',   sl:'CONF'},
    {id:'over25',  lbl:`${acr('O2.5')}`,                              d:latestTopLists.over25,  sk:'tXG',        sl:acr('xG')},
    {id:'corners', lbl:'🚩 Top Corners',                               d:latestTopLists.corners, sk:'cornerConf', sl:'CONF'},
    {id:'exact',   lbl:`Exact (${acr('D-C')})`,                       d:latestTopLists.exact,   sk:'exactConf',  sl:'CONF'},
    {id:'players', lbl:'👥 Players',                                   d:latestTopLists.players, sk:null,         sl:null}
  ];
  const t=document.getElementById('topSection');if(!t)return;
  let html=`<div class="quant-panel" style="padding:0;overflow:hidden;"><div class="tabs-wrapper">`;
  tabs.forEach((tab,i)=>{html+=`<button class="tab-btn ${i===0?'active':''}" onclick="switchTab('${tab.id}')" id="tab-btn-${tab.id}">${tab.lbl} <span class="tab-count">${tab.d.length}</span></button>`;});
  html+=`</div>`;
  tabs.forEach((tab,i)=>{
    html+=`<div class="pred-tab-panel" style="display:${i===0?'block':'none'};padding:14px 18px 18px;" id="tabpanel-${tab.id}">`;
    if(tab.id==='players'){
      html += renderPlayersTab(tab.d);
    } else if(!tab.d.length){
      html+=`<div style="text-align:center;color:var(--text-muted);padding:22px;font-weight:600;font-size:1.1rem;">Δεν βρέθηκαν σήματα.</div>`;
    } else {
      html+=`<div style="display:flex;flex-direction:column;gap:10px;">`;
      tab.d.forEach((x,j)=>{
        let val=tab.id==='exact'?(x.exact||'?-?')+(x.exact2&&x.exact2!==x.exact?` / ${x.exact2}`:''):Number(x[tab.sk]||0).toFixed(1)+(tab.id==='corners'?'%':'');
        html+=`<div onclick="scrollToMatch('row-${x.fixId}')" style="display:flex;align-items:center;gap:14px;padding:14px 18px;background:var(--bg-base);border:1px solid var(--border-light);border-radius:var(--radius-sm);cursor:pointer;transition:border-color 0.18s;">
          <div style="font-family:var(--font-mono);font-size:1.2rem;color:var(--text-dim);min-width:30px;text-align:center;">#${j+1}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(x.ht)} <span style="color:var(--text-muted)">vs</span> ${esc(x.at)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;margin-top:4px;">${esc(x.lg)}</div>
            <div style="font-size:0.85rem;color:var(--accent-green);font-weight:600;margin-top:4px;">${esc(x.omegaPick)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-family:var(--font-mono);font-size:1.3rem;font-weight:800;color:var(--accent-blue);">${val}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;">${tab.sl}</div>
          </div>
        </div>`;
      });
      html+=`</div>`;
    }
    html+=`</div>`;
  });
  html+=`</div>`;t.innerHTML=html;
}

// ── Sort state για Players tab ──────────────────────────────
let _playerSort = 'xg'; // 'xg' | 'yellow' | 'red'

window.setPlayerSort = function(mode) {
  _playerSort = mode;
  const panel = document.getElementById('tabpanel-players');
  if(panel) panel.innerHTML = renderPlayersTab(latestTopLists.players);
  // Update active sort button
  ['xg','yellow','red'].forEach(m => {
    const btn = document.getElementById(`psort-${m}`);
    if(btn) btn.classList.toggle('active', m === mode);
  });
};

function renderPlayersTab(players) {
  if(!players?.length) return `<div style="text-align:center;color:var(--text-muted);padding:30px;font-weight:600;">Εκτελέστε πρώτα Scan για να φορτωθούν τα player stats.</div>`;

  // Sort
  const sorted = [...players].sort((a,b) => {
    if(_playerSort==='yellow') return (b.adjCardProb||b.cardProb||0)-(a.adjCardProb||a.cardProb||0);
    if(_playerSort==='red')    return (b.adjRedCardProb||b.redCardProb||0)-(a.adjRedCardProb||a.redCardProb||0);
    return (b.xGContrib||0)-(a.xGContrib||0); // default: xG
  });

  const top = sorted.slice(0, 40); // max 40 rows

  // Sort button builder
  const sortBtn = (mode, label, col) => `<button id="psort-${mode}" onclick="window.setPlayerSort('${mode}')"
    style="font-size:0.72rem;font-weight:700;padding:4px 12px;border-radius:14px;border:1px solid ${_playerSort===mode?col:'var(--border-light)'};background:${_playerSort===mode?`rgba(${mode==='xg'?'56,189,248':mode==='yellow'?'251,191,36':'248,113,113'},0.12)`:'var(--bg-surface)'};color:${_playerSort===mode?col:'var(--text-muted)'};cursor:pointer;transition:all 0.18s;">
    ${label}
  </button>`;

  // Table rows
  const rows = top.map((p,i) => {
    const yProb   = p.adjCardProb    ?? p.cardProb    ?? 0;
    const rProb   = p.adjRedCardProb ?? p.redCardProb ?? 0;
    const xgPct   = (p.xGContrib * 100).toFixed(1);
    const xgBar   = Math.min(Math.round(p.xGContrib * 100 * 3), 100);
    const yCol    = yProb>=40?'var(--accent-red)':yProb>=20?'var(--accent-gold)':'var(--text-muted)';
    const rCol    = rProb>=8 ?'var(--accent-red)':rProb>=3 ?'var(--accent-gold)':'var(--text-dim)';
    const adjArrow= p.cardAdjFactor>1.05?`<span style="color:var(--accent-red);font-size:0.6rem;font-weight:900;">▲</span>`:p.cardAdjFactor<0.95?`<span style="color:var(--accent-teal);font-size:0.6rem;font-weight:900;">▼</span>`:'';
    const suspS   = p.suspRisk?'<span style="color:var(--accent-red);font-size:0.7rem;margin-left:3px;" title="Κοντά σε threshold αποβολής">🔴</span>':'';
    const injS    = p.injured ?'<span style="font-size:0.7rem;margin-left:2px;">🏥</span>':'';
    const highlightCol = _playerSort==='xg'
      ? `background:rgba(56,189,248,${Math.min(p.xGContrib*1.5,0.10).toFixed(2)})`
      : _playerSort==='yellow'
        ? `background:rgba(251,191,36,${Math.min(yProb/500,0.10).toFixed(2)})`
        : `background:rgba(248,113,113,${Math.min(rProb/100,0.10).toFixed(2)})`;
    const rankCol = i<3?'var(--accent-gold)':i<10?'var(--text-sub)':'var(--text-dim)';
    const name    = esc((p.name||'Unknown').split(' ').slice(-1)[0]);
    const teamShort = esc((p.teamName||'').split(' ').slice(0,2).join(' '));

    return `<tr style="${highlightCol};transition:background 0.2s;" onclick="scrollToMatch('row-${p.matchId}')">
      <td style="text-align:center;font-family:var(--font-mono);font-size:0.75rem;color:${rankCol};font-weight:800;padding:9px 6px;">${i+1}</td>
      <td style="padding:9px 8px;min-width:110px;">
        <div style="font-weight:700;font-size:0.88rem;color:var(--text-main);">${injS}${name}${suspS}</div>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:1px;">${teamShort}</div>
      </td>
      <td style="padding:9px 8px;min-width:140px;max-width:180px;">
        <div style="font-size:0.72rem;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.matchLabel||'')}</div>
        <div style="font-size:0.65rem;color:var(--text-dim);margin-top:1px;">${esc(p.lg||'')}</div>
      </td>
      <td style="padding:9px 8px;min-width:100px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;height:5px;background:var(--bg-raised);border-radius:3px;max-width:60px;">
            <div style="width:${xgBar}%;height:100%;background:var(--accent-blue);border-radius:3px;"></div>
          </div>
          <span style="font-family:var(--font-mono);font-size:0.82rem;font-weight:700;color:var(--accent-blue);min-width:34px;">${xgPct}%</span>
        </div>
      </td>
      <td style="padding:9px 10px;text-align:center;">
        <span style="font-family:var(--font-mono);font-size:0.92rem;font-weight:800;color:${yCol};">${yProb>=1?'🟨 ':' '}${yProb.toFixed(1)}%</span>
        ${adjArrow}
      </td>
      <td style="padding:9px 10px;text-align:center;">
        <span style="font-family:var(--font-mono);font-size:0.92rem;font-weight:800;color:${rCol};">${rProb>=2?'🟥 ':' '}${rProb.toFixed(1)}%</span>
      </td>
    </tr>`;
  }).join('');

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
      <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);">
        ${players.length} παίκτες από ${new Set(players.map(p=>p.matchId)).size} αγώνες
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <span style="font-size:0.7rem;color:var(--text-dim);margin-right:4px;">Ταξινόμηση:</span>
        ${sortBtn('xg',   `${acr('xG')} Contribution`,    'var(--accent-blue)')}
        ${sortBtn('yellow','🟨 Κίτρινη κάρτα', 'var(--accent-gold)')}
        ${sortBtn('red',   '🟥 Κόκκινη κάρτα', 'var(--accent-red)')}
      </div>
    </div>
    <div class="data-table-wrapper">
      <table class="summary-table" style="font-size:0.85rem;">
        <thead>
          <tr>
            <th style="width:36px;">#</th>
            <th class="left-align">Παίκτης</th>
            <th class="left-align">Αγώνας</th>
            <th class="left-align" style="cursor:pointer;" onclick="window.setPlayerSort('xg')">${acr('xG')}% ↕</th>
            <th style="cursor:pointer;" onclick="window.setPlayerSort('yellow')">🟨 Κίτρινη ↕</th>
            <th style="cursor:pointer;" onclick="window.setPlayerSort('red')">🟥 Κόκκινη ↕</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:8px;font-size:0.67rem;color:var(--text-dim);display:flex;gap:16px;flex-wrap:wrap;">
      <span>🟨 Adj. yellow card % (Poisson · αντίπαλος · league)</span>
      <span>🟥 Red card % (ηπιότερη διόρθωση ×0.6)</span>
      <span>▲▼ = διόρθωση αντιπάλου</span>
      <span>🔴 = κίνδυνος αποβολής</span>
      <span>Κλικ σε γραμμή → μεταβαίνει στον αγώνα</span>
    </div>`;
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

// 🌟 RESPONSIVE ACCORDION
// ─── helper: renders one player row (xG bar + card prob) ───────────
// ── xG Contribution row ─────────────────────────────────────
function renderXGRow(p, rank) {
  const pct  = (p.xGContrib * 100).toFixed(1);
  const barW = Math.min(Math.round(p.xGContrib * 100 * 3), 100);
  const injS = p.injured ? '🏥' : '';
  const name = esc((p.name||'').split(' ').pop());
  const rCol = rank===0?'var(--accent-gold)':rank===1?'var(--text-sub)':rank===2?'rgba(205,127,50,0.9)':'var(--text-dim)';
  return `<div style="display:flex;align-items:center;gap:7px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.03);">
    <span style="font-family:var(--font-mono);font-size:0.65rem;color:${rCol};min-width:14px;text-align:center;font-weight:800;">${rank+1}</span>
    <span style="flex:1;font-size:0.83rem;font-weight:600;color:${p.injured?'var(--accent-red)':'var(--text-main)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${injS} ${name}</span>
    <div style="width:44px;height:4px;background:var(--bg-raised);border-radius:2px;flex-shrink:0;">
      <div style="width:${barW}%;height:100%;background:${p.injured?'var(--accent-red)':'var(--accent-blue)'};border-radius:2px;transition:width 0.3s;"></div>
    </div>
    <span style="font-family:var(--font-mono);font-size:0.82rem;font-weight:800;color:var(--accent-blue);min-width:34px;text-align:right;">${pct}%</span>
  </div>`;
}

// ── Card Risk row ────────────────────────────────────────────
function renderCardRow(p, rank) {
  const yProb = p.adjCardProb    ?? p.cardProb    ?? 0;
  const rProb = p.adjRedCardProb ?? p.redCardProb ?? 0;
  const yCol  = yProb>=40?'var(--accent-red)':yProb>=20?'var(--accent-gold)':'var(--text-muted)';
  const rCol  = rProb>=8 ?'var(--accent-red)':rProb>=3 ?'var(--accent-gold)':'var(--text-dim)';
  const adj   = p.cardAdjFactor>1.05
    ? `<span style="font-size:0.6rem;color:var(--accent-red);font-weight:900;">▲</span>`
    : p.cardAdjFactor<0.95
    ? `<span style="font-size:0.6rem;color:var(--accent-teal);font-weight:900;">▼</span>` : '';
  const suspS = p.suspRisk ? ' <span style="font-size:0.68rem;" title="Κίνδυνος αποβολής">🔴</span>' : '';
  const name  = esc((p.name||'').split(' ').pop());
  const injS  = p.injured ? '🏥 ' : '';
  return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.03);">
    <span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-dim);min-width:14px;text-align:center;font-weight:700;">${rank+1}</span>
    <span style="flex:1;font-size:0.82rem;font-weight:600;color:${p.injured?'var(--accent-red)':'var(--text-main)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${injS}${name}${suspS}</span>
    <span style="font-family:var(--font-mono);font-size:0.82rem;font-weight:800;color:${yCol};min-width:40px;text-align:right;">🟨${yProb.toFixed(0)}%${adj}</span>
    <span style="font-family:var(--font-mono);font-size:0.78rem;font-weight:700;color:${rCol};min-width:34px;text-align:right;">${rProb>=2?'🟥':'  '}${rProb.toFixed(0)}%</span>
  </div>`;
}

// ── Team block helper (shared between both cards) ────────────
function teamBlock(players, teamName, teamColor, isHome, oppS) {
  const injCount = (players||[]).filter(p=>p.injured).length;
  const factor   = (players||[]).find(p=>p.cardAdjFactor)?.cardAdjFactor || 1;
  const fCol     = factor>1.05?'var(--accent-red)':factor<0.95?'var(--accent-teal)':'var(--text-dim)';
  const injBadge = injCount>0
    ? `<span style="font-size:0.65rem;color:var(--accent-red);font-weight:700;margin-left:5px;">⚠️ ${injCount} OUT</span>` : '';
  const opp      = `<span style="font-size:0.62rem;color:var(--text-dim);margin-left:6px;">αντίπ. ${Number(oppS?.crd||0).toFixed(1)} κάρτ</span>`;
  return {injBadge, factor, fCol, opp};
}
function buildAccordionHTML(x) {
  const formDots=arr=>(arr||[]).slice(0,5).map(h=>`<div class="form-dot form-${h.cls}">${h.res}</div>`).join('');
  const pHtml=x.pp?getPoissonMatrixHTML(x.hExp,x.aExp,4):'';

  // Injury-adjusted xG row με visual διαφορά
  const hHasInj=(x.hInjAdj?.delta||0)<-0.05, aHasInj=(x.aInjAdj?.delta||0)<-0.05;
  const injXGRow=(label,base,final,adj)=>{
    if(!adj||adj.delta>=-0.05) return `<div class="accordion-row"><span>${label} xG</span><span class="data-num" style="color:var(--accent-blue)">${Number(final||base||0).toFixed(2)}</span></div>`;
    return `<div class="accordion-row"><span>${label} xG</span><span class="data-num"><span style="color:var(--text-muted);text-decoration:line-through;font-size:0.85rem;">${Number(base||0).toFixed(2)}</span><span style="color:var(--accent-gold);font-weight:800;margin-left:5px;">${Number(final||0).toFixed(2)}</span><span style="color:var(--accent-red);font-size:0.75rem;margin-left:3px;">(${Number(adj.delta||0).toFixed(2)})</span></span></div>`;
  };
  const injuredBanner=(injAdj,teamName)=>{
    if(!injAdj?.injured?.length) return '';
    return `<div style="background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:6px 10px;margin-bottom:8px;font-size:0.78rem;color:var(--accent-red);font-weight:700;">🏥 <b>${esc(teamName)}</b>: ${injAdj.injured.map(p=>esc((p.name||'').split(' ').slice(-1)[0])).join(', ')} — xG ×${(injAdj.factor||1).toFixed(2)}</div>`;
  };

  // Live Intelligence card builder (εμφανίζεται μόνο για live αγώνες)
  const li = x.liveIntel;
  const liveIntelCard = li ? `
    <div class="accordion-card" style="border-color:rgba(239,68,68,0.35);min-width:320px;">
      <h4 style="color:var(--accent-red);">🔴 Live Intelligence
        <span style="font-size:0.75rem;font-weight:400;color:var(--text-muted);margin-left:8px;">${li.elapsed}'  ·  ${li.xgSource==='provider'?'Official xG':'Model xG'}</span>
      </h4>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px 6px;font-size:0.8rem;margin-bottom:14px;text-align:center;">
        <span style="color:var(--text-dim);font-size:0.7rem;text-transform:uppercase;"></span>
        <span style="color:var(--accent-gold);font-weight:700;">🏠 ${esc(x.ht.split(' ')[0])}</span>
        <span style="color:var(--accent-blue);font-weight:700;">✈️ ${esc(x.at.split(' ')[0])}</span>

        <span style="color:var(--text-muted);text-align:left;">Shots OT</span>
        <span class="data-num">${li.hSoT}</span><span class="data-num">${li.aSoT}</span>

        <span style="color:var(--text-muted);text-align:left;">Total Shots</span>
        <span class="data-num">${li.hTot}</span><span class="data-num">${li.aTot}</span>

        <span style="color:var(--text-muted);text-align:left;">Corners</span>
        <span class="data-num">${li.hCor}</span><span class="data-num">${li.aCor}</span>

        <span style="color:var(--text-muted);text-align:left;">Possession</span>
        <span class="data-num">${li.hPoss}%</span><span class="data-num">${li.aPoss}%</span>

        <span style="color:var(--text-muted);text-align:left;">GK Saves</span>
        <span class="data-num">${li.hSaves}</span><span class="data-num">${li.aSaves}</span>

        <span style="color:var(--text-muted);text-align:left;font-weight:700;">${acr('xG')} Live</span>
        <span class="data-num" style="color:var(--accent-gold);font-weight:800;">${li.hLiveXG.toFixed(2)}</span>
        <span class="data-num" style="color:var(--accent-blue);font-weight:800;">${li.aLiveXG.toFixed(2)}</span>

        <span style="color:var(--text-muted);text-align:left;font-weight:700;">${acr('xGA')} Live</span>
        <span class="data-num" style="color:${li.hLiveXGA>1.2?'var(--accent-red)':li.hLiveXGA>0.8?'var(--accent-gold)':'var(--accent-green)'};">${li.hLiveXGA.toFixed(2)}</span>
        <span class="data-num" style="color:${li.aLiveXGA>1.2?'var(--accent-red)':li.aLiveXGA>0.8?'var(--accent-gold)':'var(--accent-green)'};">${li.aLiveXGA.toFixed(2)}</span>
      </div>

      <div style="margin-bottom:12px;">
        <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:5px;">Momentum</div>
        <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;gap:1px;">
          <div style="width:${li.hMomentum}%;background:var(--accent-gold);transition:width 0.5s;"></div>
          <div style="width:${li.aMomentum}%;background:var(--accent-blue);transition:width 0.5s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-muted);margin-top:4px;">
          <span style="color:var(--accent-gold);font-weight:700;">🏠 ${li.hMomentum}%</span>
          <span style="color:var(--accent-blue);font-weight:700;">${li.aMomentum}% ✈️</span>
        </div>
      </div>

      <div style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.2);border-radius:8px;padding:12px;">
        <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;text-align:center;margin-bottom:8px;">🎯 Επόμενο Γκολ</div>
        <div style="display:flex;justify-content:space-around;align-items:center;">
          <div style="text-align:center;">
            <div style="font-family:var(--font-mono);font-size:1.6rem;font-weight:900;color:${li.pNextHome>0.55?'var(--accent-gold)':'var(--text-main)'};">${Math.round(li.pNextHome*100)}%</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">🏠 ${esc(x.ht.split(' ')[0])}</div>
          </div>
          <div style="color:var(--text-dim);font-size:0.85rem;">vs</div>
          <div style="text-align:center;">
            <div style="font-family:var(--font-mono);font-size:1.6rem;font-weight:900;color:${li.pNextAway>0.55?'var(--accent-blue)':'var(--text-main)'};">${Math.round(li.pNextAway*100)}%</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">✈️ ${esc(x.at.split(' ')[0])}</div>
          </div>
        </div>
        <div style="margin-top:8px;display:flex;height:4px;border-radius:2px;overflow:hidden;gap:1px;">
          <div style="width:${Math.round(li.pNextHome*100)}%;background:var(--accent-gold);"></div>
          <div style="width:${Math.round(li.pNextAway*100)}%;background:var(--accent-blue);"></div>
        </div>
      </div>
    </div>` : '';

  return `
    <td colspan="9" style="padding: 20px; text-align:left; border-bottom:1px solid var(--border-light); background:var(--bg-panel);">
      <div class="accordion-grid">

        <div class="accordion-card">
          <h4>Home vs Away Breakdown</h4>
          <div class="accordion-row"><span>Form ${acr('xG')}</span><span class="data-num">${x.hS?.uiXG||'0.00'} vs ${x.aS?.uiXG||'0.00'}</span></div>
          <div class="accordion-row"><span>Form ${acr('xGA')}</span><span class="data-num" style="color:var(--text-muted)">${x.hS?.uiXGA||'0.00'} vs ${x.aS?.uiXGA||'0.00'}</span></div>
          <div class="accordion-row"><span>Split ${acr('xG')}</span><span class="data-num">${x.hS?.uiSXG||'0.00'} vs ${x.aS?.uiSXG||'0.00'}</span></div>
          <div class="accordion-row"><span>Exp. Cards</span><span class="data-num">${Number(x.hS?.crd||0).toFixed(1)} vs ${Number(x.aS?.crd||0).toFixed(1)}</span></div>
          <div class="accordion-row" style="color:var(--text-muted);"><span>${acr('H2H')} (Last 8)</span><span class="data-num">${x.h2h?`${x.h2h.homeWins}W - ${x.h2h.draws}D - ${x.h2h.awayWins}W`:'N/A'}</span></div>
          <div style="display:flex;gap:4px;margin-top:10px;">${formDots(x.hS?.history)}</div><div style="display:flex;gap:4px;margin-top:6px;">${formDots(x.aS?.history)}</div>
        </div>

        ${liveIntelCard}

        ${(()=>{
          const ld = x.lineupData;
          const confirmed = ld?.available === true;

          // ── projected XI από players όταν δεν υπάρχει lineup ──
          const estimatePos = p => p.xGContrib>0.14?'F':p.xGContrib>0.07?'M':p.xGContrib>0.02?'D':'G';
          const projectedXI = (players, adj) => {
            if(!players?.length) return {xi:[], formation:'', xiIds:new Set()};
            const injIds = new Set((adj?.injured||[]).map(p=>p.id));
            const avail = [...players].filter(p=>!injIds.has(p.id)).sort((a,b)=>b.xGContrib-a.xGContrib);
            const xi = avail.slice(0,11).map(p=>({id:p.id,name:p.name,pos:p.pos||estimatePos(p),number:''}));
            return {xi, formation:'', xiIds:new Set(xi.map(p=>p.id))};
          };

          const hTeam = confirmed ? ld.home : projectedXI(x.hPlayers, x.hInjAdj);
          const aTeam = confirmed ? ld.away : projectedXI(x.aPlayers, x.aInjAdj);

          // ── pitch-style column: groups players by position ──────
          const pitchCol = (team, adj, sideColor) => {
            const xi = team?.xi || [];
            if(!xi.length) return `<div style="text-align:center;padding:20px 0;color:var(--text-dim);font-size:0.8rem;">Δεν υπάρχουν δεδομένα</div>`;

            const posOrder = {G:0,D:1,M:2,F:3};
            const groups = {G:[],D:[],M:[],F:[]};
            [...xi].sort((a,b)=>(posOrder[a.pos]??2)-(posOrder[b.pos]??2))
                   .forEach(p => (groups[p.pos in groups ? p.pos : 'M']).push(p));

            const posLabel = {G:'Τερ.',D:'Αμυν.',M:'Μεσ.',F:'Επιθ.'};
            const posColor = {G:'var(--text-dim)',D:'var(--accent-blue)',M:'var(--accent-teal)',F:'var(--accent-gold)'};

            const playerChip = (p) => {
              const prof = (adj?.xiPlayers||[]).find(pp=>pp.id===p.id);
              const cProb = prof?.adjCardProb ?? prof?.cardProb ?? 0;
              const xgW = prof ? Math.min(Math.round(prof.xGContrib*100*2.5),100) : 0;
              const cCol = cProb>=40?'var(--accent-red)':cProb>=20?'var(--accent-gold)':'var(--text-dim)';
              const surname = (p.name||'?').split(' ').pop();
              const isOut = (adj?.outPlayers||[]).some(op=>op.id===p.id);
              return `<div style="display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:5px;background:var(--bg-surface);border:1px solid ${isOut?'rgba(248,113,113,0.25)':'var(--border)'};margin-bottom:3px;${isOut?'opacity:0.6':''};">
                <span style="font-size:0.72rem;font-weight:700;color:${posColor[p.pos]||'var(--text-muted)'};min-width:12px;">${p.pos||'?'}</span>
                <span style="flex:1;font-size:0.83rem;font-weight:600;color:${isOut?'var(--accent-red)':'var(--text-main)'};${isOut?'text-decoration:line-through;':''}white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(surname)}</span>
                ${xgW>0?`<div style="width:28px;height:3px;background:var(--bg-raised);border-radius:2px;flex-shrink:0;"><div style="width:${xgW}%;height:100%;background:var(--accent-blue);border-radius:2px;"></div></div>`:''}
                ${cProb>=5?`<span style="font-size:0.68rem;color:${cCol};font-weight:700;min-width:26px;text-align:right;">${cProb.toFixed(0)}%</span>`:''}
              </div>`;
            };

            return Object.entries(groups)
              .filter(([,arr])=>arr.length>0)
              .map(([pos,arr])=>`
                <div style="margin-bottom:8px;">
                  <div style="font-size:0.62rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${posColor[pos]};margin-bottom:4px;padding-left:2px;">${posLabel[pos]}</div>
                  ${arr.map(playerChip).join('')}
                </div>`).join('');
          };

          // ── Coverage badge ───────────────────────────────────────
          const covBadge = (adj) => {
            if(adj?.coverage == null) return '';
            const pct = Math.round(adj.coverage*100);
            const col = pct>=90?'var(--accent-green)':pct>=72?'var(--accent-gold)':'var(--accent-red)';
            const bg  = pct>=90?'rgba(52,211,153,0.1)':pct>=72?'rgba(251,191,36,0.1)':'rgba(248,113,113,0.1)';
            return `<div style="font-size:0.68rem;font-weight:700;color:${col};background:${bg};padding:1px 7px;border-radius:10px;border:1px solid ${col}33;margin-top:4px;">GAP ${pct}%</div>`;
          };

          // ── Status bar ───────────────────────────────────────────
          const statusBar = confirmed
            ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:8px 12px;background:rgba(45,212,191,0.06);border:1px solid rgba(45,212,191,0.2);border-radius:8px;">
                <span style="width:7px;height:7px;background:var(--accent-teal);border-radius:50%;flex-shrink:0;box-shadow:0 0 6px var(--accent-teal);"></span>
                <span style="font-size:0.72rem;font-weight:700;color:var(--accent-teal);">Επιβεβαιωμένη Ενδεκάδα</span>
                <span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-muted);margin-left:auto;">${ld.home?.formation||''} vs ${ld.away?.formation||''}</span>
              </div>`
            : `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:8px 12px;background:rgba(255,255,255,0.03);border:1px dashed var(--border-md);border-radius:8px;">
                <span style="width:7px;height:7px;background:var(--text-dim);border-radius:50%;flex-shrink:0;animation:pulseRed 2.5s infinite;"></span>
                <span style="font-size:0.72rem;font-weight:600;color:var(--text-muted);">Εκτιμώμενη σύνθεση · Αναμονή επίσημης ανακοίνωσης (~60' πριν)</span>
                <button onclick="window.fetchLineupForMatch('${x.fixId}')" style="margin-left:auto;font-size:0.68rem;font-weight:700;padding:3px 10px;background:var(--bg-raised);color:var(--text-sub);border:1px solid var(--border-md);border-radius:8px;cursor:pointer;white-space:nowrap;transition:all 0.15s;" onmouseover="this.style.borderColor='var(--accent-teal)';this.style.color='var(--accent-teal)'" onmouseout="this.style.borderColor='var(--border-md)';this.style.color='var(--text-sub)'">↻ Fetch XI</button>
              </div>`;

          // ── Substitution log ─────────────────────────────────────
          const subLog = (x.lastSubEvents||[]).length ? `
            <div style="margin-top:12px;padding:8px 10px;background:rgba(251,191,36,0.04);border-left:2px solid var(--accent-gold);border-radius:0 6px 6px 0;">
              <div style="font-size:0.65rem;font-weight:800;color:var(--accent-gold);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.08em;">🔄 Αντικαταστάσεις</div>
              ${x.lastSubEvents.map(s=>`
                <div style="display:flex;align-items:center;gap:6px;font-size:0.8rem;padding:2px 0;">
                  <span style="font-size:0.75rem;">${s.team==='home'?'🏠':'✈️'}</span>
                  <span style="color:var(--accent-red);opacity:0.75;text-decoration:line-through;">${esc((s.out||'').split(' ').pop())}</span>
                  <span style="color:var(--text-dim);font-size:0.7rem;">→</span>
                  <span style="color:var(--accent-green);font-weight:700;">${esc((s.in||'').split(' ').pop())}</span>
                </div>`).join('')}
            </div>` : '';

          return `<div class="accordion-card" style="border-color:${confirmed?'rgba(45,212,191,0.28)':'rgba(255,255,255,0.06)'};">
            <h4 style="color:${confirmed?'var(--accent-teal)':'var(--text-muted)'};margin-bottom:10px;">
              📋 ${confirmed?'Starting XI':'XI'}
            </h4>
            ${statusBar}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
              <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <span style="font-size:0.72rem;font-weight:800;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.04em;">🏠 ${esc(x.ht.split(' ').slice(0,2).join(' '))}</span>
                  ${covBadge(x.hInjAdj)}
                </div>
                ${pitchCol(hTeam, x.hInjAdj, 'var(--accent-gold)')}
              </div>
              <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <span style="font-size:0.72rem;font-weight:800;color:var(--accent-blue);text-transform:uppercase;letter-spacing:0.04em;">✈️ ${esc(x.at.split(' ').slice(0,2).join(' '))}</span>
                  ${covBadge(x.aInjAdj)}
                </div>
                ${pitchCol(aTeam, x.aInjAdj, 'var(--accent-blue)')}
              </div>
            </div>
            ${subLog}
            <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;font-size:0.63rem;color:var(--text-dim);">
              <span><b style="color:var(--accent-gold)">F</b> Επίθ.</span>
              <span><b style="color:var(--accent-teal)">M</b> Μεσ.</span>
              <span><b style="color:var(--accent-blue)">D</b> Αμυν.</span>
              <span><b style="color:var(--text-dim)">G</b> Τερ.</span>
              <span>bar = xG%</span>
              <span>% = 🟨 prob</span>
              ${confirmed?'':'<span style="color:var(--text-dim)">~ = εκτίμηση</span>'}
            </div>
          </div>`;
        })()}

        ${x.htAnalysis ? (() => {
          const ht=x.htAnalysis;
          const hPct=Math.round(ht.pLeadHome*100), dPct=Math.round(ht.pDraw*100), aPct=Math.round(ht.pLeadAway*100);
          const leadCol = ht.pLeadHome>ht.pLeadAway?'var(--accent-gold)':'var(--accent-blue)';
          const leadStr = ht.pLeadHome>ht.pLeadAway+0.05?`🏠 ${hPct}%`:ht.pLeadAway>ht.pLeadHome+0.05?`✈️ ${aPct}%'`:`⚖️ Ισόρροπο`;
          return `<div class="accordion-card" style="min-width:280px;border-color:rgba(45,212,191,0.4);">
          <h4 style="color:var(--accent-teal);">⏱️ HT Prediction
            <span style="font-size:0.68rem;color:var(--text-dim);font-weight:400;margin-left:8px;">λ 🏠${ht.htLambdaH.toFixed(2)} ✈️${ht.htLambdaA.toFixed(2)} · ×${ht.htFactor}</span>
          </h4>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px;">
            <div style="text-align:center;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,${ht.pLeadHome>0.38?'0.40':'0.18'});border-radius:8px;padding:10px 4px;">
              <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:4px;font-weight:700;text-transform:uppercase;">🏠 Προηγείται</div>
              <div style="font-family:var(--font-mono);font-size:1.35rem;font-weight:900;color:${ht.pLeadHome>0.35?'var(--accent-gold)':'var(--text-main)'};">${hPct}%</div>
            </div>
            <div style="text-align:center;background:rgba(255,255,255,0.03);border:1px solid var(--border-light);border-radius:8px;padding:10px 4px;">
              <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:4px;font-weight:700;text-transform:uppercase;">⚖️ Ισοπαλία</div>
              <div style="font-family:var(--font-mono);font-size:1.35rem;font-weight:900;color:${ht.pDraw>0.42?'var(--accent-teal)':'var(--text-main)'};">${dPct}%</div>
            </div>
            <div style="text-align:center;background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,${ht.pLeadAway>0.38?'0.40':'0.18'});border-radius:8px;padding:10px 4px;">
              <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:4px;font-weight:700;text-transform:uppercase;">✈️ Προηγείται</div>
              <div style="font-family:var(--font-mono);font-size:1.35rem;font-weight:900;color:${ht.pLeadAway>0.35?'var(--accent-blue)':'var(--text-main)'};">${aPct}%</div>
            </div>
          </div>

          <div style="height:6px;border-radius:3px;overflow:hidden;display:flex;gap:1px;margin-bottom:12px;">
            <div style="width:${hPct}%;background:var(--accent-gold);"></div>
            <div style="width:${dPct}%;background:rgba(255,255,255,0.18);"></div>
            <div style="width:${aPct}%;background:var(--accent-blue);"></div>
          </div>

          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <div style="flex:1;background:rgba(45,212,191,0.07);border:1px solid rgba(45,212,191,0.30);border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;font-weight:700;">🥇 HT Score</div>
              <div style="font-family:var(--font-mono);font-size:1.6rem;font-weight:900;color:var(--accent-teal);">${ht.htBest.h}-${ht.htBest.a}</div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:3px;">${pct(ht.htBest.prob)} D-C</div>
            </div>
            <div style="flex:1;background:rgba(168,85,247,0.07);border:1px solid rgba(168,85,247,0.25);border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;font-weight:700;">🥈 Alt Score</div>
              <div style="font-family:var(--font-mono);font-size:1.6rem;font-weight:900;color:var(--accent-purple);">${ht.htSecond.h}-${ht.htSecond.a}</div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:3px;">${pct(ht.htSecond.prob)} D-C</div>
            </div>
          </div>
          <div style="background:rgba(45,212,191,0.06);border:1px solid rgba(45,212,191,0.20);border-radius:6px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Conf</span>
            <span style="font-family:var(--font-mono);font-size:1.1rem;font-weight:900;color:${ht.htConf>=45?'var(--accent-teal)':ht.htConf>=25?'var(--accent-gold)':'var(--text-muted)'};">${ht.htConf}%</span>
            <span style="font-size:0.72rem;color:${leadCol};font-weight:700;">${leadStr}</span>
          </div>
          <div style="margin-top:8px;font-size:0.65rem;color:var(--text-dim);">D-C ρ=−0.10 · home +2.5% · away −2.5% λ</div>
        </div>`;})() : ''}

        <div class="accordion-card">
          <h4>🎯 Top Scorer Projections</h4>
          <div style="margin-bottom:15px;">
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">🏠 Home Team Scorer</div>
            ${x.hScorerProb ? `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-weight:700; font-size:0.95rem;">${esc(x.hScorerProb.name)} <span style="color:var(--accent-gold); font-size:0.75rem;">(${x.hScorerProb.goals}G)</span></span><span style="color:${x.hScorerProb.prob >= 40 ? 'var(--accent-green)' : 'var(--text-main)'}; font-family:var(--font-mono); font-weight:800; font-size:1.1rem;">${x.hScorerProb.prob.toFixed(1)}%</span></div>` : `<span style="font-size:0.85rem; color:var(--text-dim);">No data available</span>`}
          </div>
          <div style="border-top:1px solid var(--border-light); padding-top:15px;">
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">✈️ Away Team Scorer</div>
            ${x.aScorerProb ? `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-weight:700; font-size:0.95rem;">${esc(x.aScorerProb.name)} <span style="color:var(--accent-gold); font-size:0.75rem;">(${x.aScorerProb.goals}G)</span></span><span style="color:${x.aScorerProb.prob >= 40 ? 'var(--accent-green)' : 'var(--text-main)'}; font-family:var(--font-mono); font-weight:800; font-size:1.1rem;">${x.aScorerProb.prob.toFixed(1)}%</span></div>` : `<span style="font-size:0.85rem; color:var(--text-dim);">No data available</span>`}
          </div>
        </div>

        <div class="accordion-card">
          <h4>Game Projections</h4>
          ${injuredBanner(x.hInjAdj, x.ht)}
          ${injuredBanner(x.aInjAdj, x.at)}
          ${injXGRow('🏠', x.hXGbase, x.hXGfinal, x.hInjAdj)}
          ${injXGRow('✈️', x.aXGbase, x.aXGfinal, x.aInjAdj)}
          <div class="accordion-row"><span>${acr('xG')} Diff</span><span class="data-num" style="color:${(x.xgDiff||0)>0?'var(--accent-green)':'var(--accent-red)'}">${(x.xgDiff||0)>0?'+':''}${Number(x.xgDiff||0).toFixed(2)}</span></div>
          <div class="accordion-row"><span>Poisson ${acr('O2.5')}</span><span class="data-num" style="color:var(--accent-blue)">${x.pp?pct(x.pp.pO25):'—'}</span></div>
          <div class="accordion-row" style="margin-top:10px;border-top:1px solid var(--border-light);padding-top:10px;color:var(--accent-gold);"><span>Exp. Corners (Tot)</span><span class="data-num">${(Number(x.expCor)||0).toFixed(1)}</span></div>
          <div class="accordion-row" style="color:var(--accent-green);"><span>P(Over 8.5 Cor)</span><span class="data-num">${(x.cornerConf||0).toFixed(1)}%</span></div>
        </div>

        <!-- ── xG Contribution card ───────────────────────── -->
        <div class="accordion-card">
          <h4>${acr('xG')} Contribution <span style="font-size:0.65rem;color:var(--text-dim);font-weight:500;">↓ φθίνουσα</span></h4>

          <!-- Home -->
          <div style="margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:6px;">
              <span style="font-size:0.7rem;font-weight:800;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.05em;">🏠 ${esc(x.ht.split(' ').slice(0,2).join(' '))}</span>
              ${hHasInj?`<span style="font-size:0.65rem;color:var(--accent-red);">⚠️ ${(x.hInjAdj?.injured||[]).length} OUT</span>`:''}
            </div>
            <div style="font-size:0.62rem;color:var(--text-dim);display:flex;justify-content:space-between;padding-bottom:4px;border-bottom:1px solid var(--border-light);margin-bottom:3px;">
              <span>#&nbsp;&nbsp;Παίκτης</span><span>bar&nbsp;&nbsp;xG%</span>
            </div>
            ${([...(x.hPlayers||[])].sort((a,b)=>b.xGContrib-a.xGContrib).slice(0,7).map((p,i)=>renderXGRow(p,i)).join('')) || '<span style="font-size:0.8rem;color:var(--text-dim)">Δεν υπάρχουν δεδομένα</span>'}
          </div>

          <!-- Away -->
          <div style="border-top:1px solid var(--border-light);padding-top:10px;">
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:6px;">
              <span style="font-size:0.7rem;font-weight:800;color:var(--accent-blue);text-transform:uppercase;letter-spacing:0.05em;">✈️ ${esc(x.at.split(' ').slice(0,2).join(' '))}</span>
              ${aHasInj?`<span style="font-size:0.65rem;color:var(--accent-red);">⚠️ ${(x.aInjAdj?.injured||[]).length} OUT</span>`:''}
            </div>
            <div style="font-size:0.62rem;color:var(--text-dim);display:flex;justify-content:space-between;padding-bottom:4px;border-bottom:1px solid var(--border-light);margin-bottom:3px;">
              <span>#&nbsp;&nbsp;Παίκτης</span><span>bar&nbsp;&nbsp;xG%</span>
            </div>
            ${([...(x.aPlayers||[])].sort((a,b)=>b.xGContrib-a.xGContrib).slice(0,7).map((p,i)=>renderXGRow(p,i)).join('')) || '<span style="font-size:0.8rem;color:var(--text-dim)">Δεν υπάρχουν δεδομένα</span>'}
          </div>
          <div style="margin-top:8px;font-size:0.62rem;color:var(--text-dim);">xG% = συνεισφορά στο team xG (GAP: γκολ + 0.4×ασίστ) · 🏥 τραυματίας</div>
        </div>

        <!-- ── Card Risk card ─────────────────────────────── -->
        <div class="accordion-card">
          <h4>🟨🟥 Card Risk <span style="font-size:0.65rem;color:var(--text-dim);font-weight:500;">↓ φθίνουσα</span></h4>

          <!-- Home -->
          <div style="margin-bottom:12px;">
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-bottom:6px;">
              <span style="font-size:0.7rem;font-weight:800;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.05em;">🏠 ${esc(x.ht.split(' ').slice(0,2).join(' '))}</span>
              ${(()=>{const f=(x.hPlayers||[]).find(p=>p.cardAdjFactor)?.cardAdjFactor||1;return f!==1?`<span style="font-size:0.62rem;color:${f>1.05?'var(--accent-red)':'var(--accent-teal)'};">αντίπ. ×${f.toFixed(2)}</span>`:''})()}
            </div>
            <div style="font-size:0.62rem;color:var(--text-dim);display:flex;justify-content:space-between;padding-bottom:4px;border-bottom:1px solid var(--border-light);margin-bottom:3px;">
              <span>#&nbsp;&nbsp;Παίκτης</span><span>🟨%&nbsp;&nbsp;&nbsp;🟥%</span>
            </div>
            ${([...(x.hPlayers||[])].sort((a,b)=>(b.adjCardProb??b.cardProb??0)-(a.adjCardProb??a.cardProb??0)).slice(0,7).map((p,i)=>renderCardRow(p,i)).join('')) || '<span style="font-size:0.8rem;color:var(--text-dim)">Δεν υπάρχουν δεδομένα</span>'}
          </div>

          <!-- Away -->
          <div style="border-top:1px solid var(--border-light);padding-top:10px;">
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-bottom:6px;">
              <span style="font-size:0.7rem;font-weight:800;color:var(--accent-blue);text-transform:uppercase;letter-spacing:0.05em;">✈️ ${esc(x.at.split(' ').slice(0,2).join(' '))}</span>
              ${(()=>{const f=(x.aPlayers||[]).find(p=>p.cardAdjFactor)?.cardAdjFactor||1;return f!==1?`<span style="font-size:0.62rem;color:${f>1.05?'var(--accent-red)':'var(--accent-teal)'};">αντίπ. ×${f.toFixed(2)}</span>`:''})()}
            </div>
            <div style="font-size:0.62rem;color:var(--text-dim);display:flex;justify-content:space-between;padding-bottom:4px;border-bottom:1px solid var(--border-light);margin-bottom:3px;">
              <span>#&nbsp;&nbsp;Παίκτης</span><span>🟨%&nbsp;&nbsp;&nbsp;🟥%</span>
            </div>
            ${([...(x.aPlayers||[])].sort((a,b)=>(b.adjCardProb??b.cardProb??0)-(a.adjCardProb??a.cardProb??0)).slice(0,7).map((p,i)=>renderCardRow(p,i)).join('')) || '<span style="font-size:0.8rem;color:var(--text-dim)">Δεν υπάρχουν δεδομένα</span>'}
          </div>
          <div style="margin-top:8px;font-size:0.62rem;color:var(--text-dim);">🟨 Adj. card% (Poisson · αντίπαλος · league) · 🟥 Red card% · 🔴 κίνδυνος αποβολής · ▲▼ διόρθωση</div>
        </div>

        <div class="accordion-card">
          <h4>🎯 Exact Score Duo (${acr('D-C')})</h4>
            <div style="flex:1; background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.3); border-radius:8px; padding:14px; text-align:center;">
              <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px; font-weight:700;">🥇 Top Pick</div>
              <div style="font-family:var(--font-mono); font-size:1.8rem; font-weight:900; color:var(--accent-blue);">${x.exact||'?-?'}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:6px;">${x.pp?pct(x.pp.bestScore.prob):'—'} Prob (D-C)</div>
            </div>
            <div style="flex:1; background:rgba(168,85,247,0.08); border:1px solid rgba(168,85,247,0.3); border-radius:8px; padding:14px; text-align:center;">
              <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px; font-weight:700;">🥈 Alt Pick</div>
              <div style="font-family:var(--font-mono); font-size:1.8rem; font-weight:900; color:var(--accent-purple);">${x.exact2||'?-?'}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:6px;">${x.pp?pct(x.pp.secondScore.prob):'—'} Prob (D-C)</div>
            </div>
          </div>
          <div style="background:var(--bg-dark); border-radius:6px; padding:10px; text-align:center;">
            <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Combined Conf</span>
            <span style="font-family:var(--font-mono); font-size:1.2rem; font-weight:800; color:${(x.exactConf||0)>=50?'var(--accent-green)':(x.exactConf||0)>=30?'var(--accent-gold)':'var(--text-muted)'}; margin-left:10px;">${x.exactConf||0}%</span>
          </div>
        </div>

        <div class="accordion-card" style="min-width:280px;">
          <h4>📉 Volatility Analysis</h4>
          ${renderVolatilityPanel(x.hS, x.aS, x.ht, x.at)}
        </div>

        ${x.sitCtx || x.dcResult ? `
        <div class="accordion-card" style="min-width:260px;border-color:rgba(251,191,36,0.25);">
          <h4 style="color:var(--accent-gold);">🎯 Context & Strength Ratings</h4>
          ${x.sitCtx ? `
          <div style="margin-bottom:12px;">
            <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Situational Flags</div>
            ${x.sitCtx.flags?.length
              ? x.sitCtx.flags.map(f=>`<div style="font-size:0.75rem;padding:3px 8px;background:rgba(251,191,36,0.1);border-radius:4px;margin-bottom:3px;color:var(--accent-gold);">⚑ ${esc(f)}</div>`).join('')
              : `<div style="font-size:0.72rem;color:var(--text-muted);">Κανένα ιδιαίτερο context.</div>`
            }
            <div style="display:flex;gap:8px;margin-top:8px;font-size:0.72rem;">
              <div>🏠 Mot: <span style="font-family:var(--font-mono);color:${x.sitCtx.hMot>=1.05?'var(--accent-green)':x.sitCtx.hMot<=0.92?'var(--accent-red)':'var(--text-muted)'};">${x.sitCtx.hMot?.toFixed(2)}</span></div>
              <div>✈️ Mot: <span style="font-family:var(--font-mono);color:${x.sitCtx.aMot>=1.05?'var(--accent-green)':x.sitCtx.aMot<=0.92?'var(--accent-red)':'var(--text-muted)'};">${x.sitCtx.aMot?.toFixed(2)}</span></div>
              ${x.sitCtx.isDerby?`<span style="color:var(--accent-red);font-weight:700;">🔥 DERBY</span>`:''}
            </div>
          </div>` : ''}
          ${x.dcResult ? `
          <div>
            <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Dixon-Coles Ratings (trust: ${(x.dcResult.trust*100).toFixed(0)}%)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.72rem;">
              <div style="background:var(--bg-surface);border-radius:5px;padding:8px;"><div style="color:var(--text-muted);margin-bottom:2px;">🏠 Attack</div><div style="font-family:var(--font-mono);font-weight:700;color:${x.dcResult.hAtt>1.1?'var(--accent-green)':x.dcResult.hAtt<0.9?'var(--accent-red)':'var(--text-main)'};">${x.dcResult.hAtt?.toFixed(2)}</div></div>
              <div style="background:var(--bg-surface);border-radius:5px;padding:8px;"><div style="color:var(--text-muted);margin-bottom:2px;">🏠 Defense</div><div style="font-family:var(--font-mono);font-weight:700;color:${x.dcResult.hDef<0.9?'var(--accent-green)':x.dcResult.hDef>1.1?'var(--accent-red)':'var(--text-main)'};">${x.dcResult.hDef?.toFixed(2)}</div></div>
              <div style="background:var(--bg-surface);border-radius:5px;padding:8px;"><div style="color:var(--text-muted);margin-bottom:2px;">✈️ Attack</div><div style="font-family:var(--font-mono);font-weight:700;color:${x.dcResult.aAtt>1.1?'var(--accent-green)':x.dcResult.aAtt<0.9?'var(--accent-red)':'var(--text-main)'};">${x.dcResult.aAtt?.toFixed(2)}</div></div>
              <div style="background:var(--bg-surface);border-radius:5px;padding:8px;"><div style="color:var(--text-muted);margin-bottom:2px;">✈️ Defense</div><div style="font-family:var(--font-mono);font-weight:700;color:${x.dcResult.aDef<0.9?'var(--accent-green)':x.dcResult.aDef>1.1?'var(--accent-red)':'var(--text-main)'};">${x.dcResult.aDef?.toFixed(2)}</div></div>
            </div>
            <div style="margin-top:8px;font-size:0.68rem;color:var(--text-muted);">DC λ: 🏠 ${x.dcResult.dcH?.toFixed(2)} | ✈️ ${x.dcResult.dcA?.toFixed(2)} · League avg: ${x.dcResult.lgAvg?.toFixed(2)}</div>
          </div>` : ''}
          <button onclick="window.openLogBetModal('${x.fixId}')" style="margin-top:14px;width:100%;padding:8px;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:var(--accent-blue);border-radius:6px;cursor:pointer;font-weight:700;font-size:0.78rem;">📒 Καταγραφή Στοιχήματος</button>
          ${renderStabilitySignals(x)}
        </div>` : ''}

        <div class="accordion-card" style="min-width: 320px;">
          <h4 style="text-align:center;">📊 Poisson Score Matrix (${acr('D-C')})</h4>
          ${pHtml}
        </div>
      </div>
    </td>
  `;
}

// ── Volatility Analysis Panel ─────────────────────────────────────────────────
function volatilityLabel(sd,baseline){
  if(sd===null||sd===undefined)return{lbl:'N/A',col:'var(--text-muted)'};
  const r=sd/baseline;
  if(r<0.75)return{lbl:'STABLE ▼',col:'var(--accent-teal)'};
  if(r<1.10)return{lbl:'NORMAL',col:'var(--accent-blue)'};
  if(r<1.40)return{lbl:'VOLATILE ↑',col:'var(--accent-gold)'};
  return{lbl:'HIGH VOL ⚡',col:'var(--accent-red)'};
}

function miniSparkline(arr,color='var(--accent-blue)'){
  if(!arr||!arr.length)return'<span style="color:var(--text-muted);font-size:0.65rem;">No data</span>';
  const max=Math.max(...arr,1);
  return`<div style="display:flex;align-items:flex-end;gap:2px;height:28px;">`+arr.map((v,i)=>{const h=Math.max(Math.round((v/max)*28),2);return`<div title="${v}" style="flex:1;height:${h}px;background:${color};border-radius:2px 2px 0 0;opacity:${0.5+(i/arr.length)*0.5};min-width:6px;"></div>`;}).join('')+`</div>`;
}

function renderVolatilityPanel(hS,aS,ht,at){
  if(!hS||!aS)return'<div style="color:var(--text-muted);font-size:0.75rem;">Δεν υπάρχουν δεδομένα διακύμανσης.</div>';
  const hr6=hS.r6||{},ar6=aS.r6||{},hSea=hS.sea||{},aSea=aS.sea||{};
  const BASE_GOALS=1.10,BASE_CORNERS=2.26,BASE_CARDS=1.48;
  const fmt=v=>v!==null&&v!==undefined?Number(v).toFixed(2):'—';
  const teamBlock=(label,r6,sea,isHome)=>{
    const col=isHome?'var(--accent-gold)':'var(--accent-blue)';
    const gV=volatilityLabel(r6.sdGoals,BASE_GOALS),gaV=volatilityLabel(r6.sdGoalsAgainst,BASE_GOALS);
    const cV=volatilityLabel(r6.sdCorners,BASE_CORNERS),cdV=volatilityLabel(r6.sdCards,BASE_CARDS);
    return`<div style="flex:1;min-width:220px;">
      <div style="font-size:0.68rem;font-weight:800;color:${col};text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border-light);">${esc(label)}</div>
      <div style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Γκολ Σκοραρίσματος</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        <div style="background:var(--bg-surface);border-radius:6px;padding:8px;"><div style="font-size:0.58rem;color:var(--text-muted);margin-bottom:2px;">Last 6 · σ</div><div style="font-size:1.1rem;font-weight:900;font-family:var(--font-mono);color:${gV.col};">${fmt(r6.sdGoals)}</div><div style="font-size:0.58rem;font-weight:700;color:${gV.col};">${gV.lbl}</div></div>
        <div style="background:var(--bg-surface);border-radius:6px;padding:8px;"><div style="font-size:0.58rem;color:var(--text-muted);margin-bottom:2px;">Season · σ</div><div style="font-size:1.1rem;font-weight:900;font-family:var(--font-mono);color:var(--text-main);">${fmt(sea.sdGoals)}</div><div style="font-size:0.58rem;color:var(--text-muted);">n=${sea.n||'?'}</div></div>
      </div>
      <div style="margin-bottom:10px;">${miniSparkline(r6.goalsArr,col)}<div style="font-size:0.58rem;color:var(--text-muted);margin-top:2px;">Γκολ ανά αγώνα (last ${r6.goalsArr?.length||0})</div></div>
      <div style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Γκολ Δεχόμενα</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        <div style="background:var(--bg-surface);border-radius:6px;padding:8px;"><div style="font-size:0.58rem;color:var(--text-muted);margin-bottom:2px;">Last 6 · σ</div><div style="font-size:1.1rem;font-weight:900;font-family:var(--font-mono);color:${gaV.col};">${fmt(r6.sdGoalsAgainst)}</div><div style="font-size:0.58rem;font-weight:700;color:${gaV.col};">${gaV.lbl}</div></div>
        <div style="background:var(--bg-surface);border-radius:6px;padding:8px;"><div style="font-size:0.58rem;color:var(--text-muted);margin-bottom:2px;">Season · σ</div><div style="font-size:1.1rem;font-weight:900;font-family:var(--font-mono);color:var(--text-main);">${fmt(sea.sdGoalsAgainst)}</div></div>
      </div>
      <div style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Κόρνερ</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        <div style="background:var(--bg-surface);border-radius:6px;padding:8px;"><div style="font-size:0.58rem;color:var(--text-muted);margin-bottom:2px;">Last 6 · σ</div><div style="font-size:1.1rem;font-weight:900;font-family:var(--font-mono);color:${cV.col};">${fmt(r6.sdCorners)}</div><div style="font-size:0.58rem;font-weight:700;color:${cV.col};">${cV.lbl}</div></div>
        <div style="background:var(--bg-surface);border-radius:6px;padding:8px;"><div style="font-size:0.58rem;color:var(--text-muted);margin-bottom:2px;">Σεζόν · σ <span style="color:${sea.sdCornersSource==='empirical'?'var(--accent-green)':'var(--text-dim)'};font-size:0.5rem;">${sea.sdCornersSource==='empirical'?'●emp':'●th'}</span></div><div style="font-size:1.1rem;font-weight:900;font-family:var(--font-mono);color:var(--text-main);">${fmt(sea.sdCorners)}</div><div style="font-size:0.55rem;color:var(--text-dim);">μ=${fmt(sea.avgCorners)}</div></div>
      </div>
      <div style="margin-bottom:10px;">${miniSparkline(r6.cornersArr,'var(--accent-teal)')}<div style="font-size:0.58rem;color:var(--text-muted);margin-top:2px;">Κόρνερ ανά αγώνα (last ${r6.cornersArr?.length||0})</div></div>
      <div style="font-size:0.62rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Κάρτες</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        <div style="background:var(--bg-surface);border-radius:6px;padding:8px;"><div style="font-size:0.58rem;color:var(--text-muted);margin-bottom:2px;">Last 6 · σ</div><div style="font-size:1.1rem;font-weight:900;font-family:var(--font-mono);color:${cdV.col};">${fmt(r6.sdCards)}</div><div style="font-size:0.58rem;font-weight:700;color:${cdV.col};">${cdV.lbl}</div></div>
        <div style="background:var(--bg-surface);border-radius:6px;padding:8px;"><div style="font-size:0.58rem;color:var(--text-muted);margin-bottom:2px;">Σεζόν · σ <span style="color:${sea.sdCardsSource==='empirical'?'var(--accent-green)':'var(--text-dim)'};font-size:0.5rem;">${sea.sdCardsSource==='empirical'?'●emp':'●th'}</span></div><div style="font-size:1.1rem;font-weight:900;font-family:var(--font-mono);color:var(--text-main);">${fmt(sea.sdCards)}</div><div style="font-size:0.55rem;color:var(--text-dim);">μ=${fmt(sea.avgCards)}</div></div>
      </div>
      <div>${miniSparkline(r6.cardsArr,'var(--accent-gold)')}<div style="font-size:0.58rem;color:var(--text-muted);margin-top:2px;">Κάρτες ανά αγώνα (last ${r6.cardsArr?.length||0})</div></div>
    </div>`;
  };
  const hSdG=hr6.sdGoals,aSdG=ar6.sdGoals;
  const bothVolatile=hSdG>BASE_GOALS*1.4&&aSdG>BASE_GOALS*1.4;
  const bothStable=hSdG!==null&&aSdG!==null&&hSdG<BASE_GOALS*0.75&&aSdG<BASE_GOALS*0.75;
  const alertBox=bothVolatile?`<div style="background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.3);border-radius:6px;padding:8px 12px;font-size:0.7rem;margin-bottom:14px;">⚠️ <strong>Υψηλή αμοιβαία διακύμανση</strong> — Μεγαλύτερο εύρος αβεβαιότητας.</div>`:bothStable?`<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:8px 12px;font-size:0.7rem;margin-bottom:14px;">✅ <strong>Σταθερές αποδόσεις</strong> — Υψηλότερη αξιοπιστία πρόβλεψης.</div>`:'';
  return alertBox+`<div style="display:flex;gap:20px;flex-wrap:wrap;">${teamBlock(ht,hr6,hSea,true)}${teamBlock(at,ar6,aSea,false)}</div>`;
}

function renderSummaryTable() {
  const sec = document.getElementById('summarySection'); if(!sec) return;
  const sd = window.scannedMatchesData || []; if(!sd.length) { sec.innerHTML=''; return; }
  
  const activeMatches = sd.filter(d => !isFinished(d.m?.fixture?.status?.short));
  const finishedMatches = sd.filter(d => isFinished(d.m?.fixture?.status?.short));

  let finalHtml = '';

  // 1. ACTIVE MATCHES
  if (activeMatches.length > 0) {
    const grouped={}; activeMatches.forEach(d=>{ if(!grouped[d.lg]) grouped[d.lg]=[]; grouped[d.lg].push(d); });
    let rows='';
    for(const[lg,matches] of Object.entries(grouped)){
      rows+=`<div style="background:rgba(56,189,248,0.05);padding:10px 16px;font-weight:800;font-size:0.85rem;color:var(--accent-blue);border-top:1px solid var(--border-light);border-bottom:1px solid var(--border-light);text-transform:uppercase;letter-spacing:1px;">${esc(lg)}</div>
      <div class="data-table-wrapper" style="border:none;border-radius:0;margin-bottom:0;"><table class="summary-table">
      <thead><tr><th class="col-match">Match</th><th class="col-score">Score</th><th class="col-1x2">${acr('1X2')}</th><th class="col-o25">${acr('O2.5')}</th><th class="col-u25">${acr('U2.5')}</th><th class="col-btts">${acr('BTTS')}</th><th class="col-exact">FT / ${acr('HT')}</th><th class="col-conf">${acr('Conf%')}</th><th class="col-signal">Signal</th></tr></thead><tbody>`;
      matches.forEach(x=>{
        const sh=x.m?.fixture?.status?.short||'', live=isLive(sh);
        const ah=x.m?.goals?.home??0, aa=x.m?.goals?.away??0;
        const scoreStr=live?`${ah}-${aa}`:'-'; const scoreCol=live?'var(--accent-green)':'var(--text-muted)';
        const conf=clamp(safeNum(x.strength),0,100); const confCol=conf>=65?'var(--accent-green)':conf>=45?'var(--accent-gold)':'var(--text-muted)';
        let omCol=x.omegaPick?.includes('NO BET')?'var(--text-muted)':'var(--text-main)';
        const liveExtra=live&&x.liveCorners!==undefined?`<div style="font-size:0.65rem;color:var(--accent-teal);margin-top:4px;">🚩${x.liveCorners} 🟨${x.liveYellows||0}</div>`:'';
        
        const hasInjury = (x.hInjAdj?.delta < -0.05) || (x.aInjAdj?.delta < -0.05);
        const injBadge  = hasInjury ? `<span style="background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.65rem;font-weight:800;padding:2px 5px;border-radius:4px;margin-left:6px;">${acr('INJ')}</span>` : '';
        const lineupSrcBadge = x.lineupData?.available
          ? `<span style="background:rgba(45,212,191,0.12);color:var(--accent-teal);font-size:0.62rem;font-weight:800;padding:2px 5px;border-radius:4px;margin-left:5px;">📋 XI</span>`
          : `<span style="font-size:0.62rem;color:var(--text-dim);margin-left:5px;">~XI</span>`;
        // Sub flash pulse badge
        const subFlash = x.subTimestamp && (Date.now()-x.subTimestamp<120000)
          ? `<span class="sub-flash-badge">🔄</span>` : '';

        // Live Intelligence extras
        const li = live ? x.liveIntel : null;
        const momentumBar = li ? `<div style="display:flex;height:3px;border-radius:2px;overflow:hidden;margin-top:4px;gap:1px;">
          <div style="width:${li.hMomentum}%;background:var(--accent-gold);border-radius:2px 0 0 2px;"></div>
          <div style="width:${li.aMomentum}%;background:var(--accent-blue);border-radius:0 2px 2px 0;"></div>
        </div>` : '';
        const nextGoalBadge = li ? `<div style="font-size:0.62rem;color:var(--accent-teal);margin-top:3px;font-weight:700;">
          🎯 ${li.pNextHome>li.pNextAway?'🏠':'✈️'} ${Math.round(Math.max(li.pNextHome,li.pNextAway)*100)}%
          &nbsp;·&nbsp; ${acr('xGA')}: ${li.hLiveXGA.toFixed(2)}|${li.aLiveXGA.toFixed(2)}
        </div>` : '';

        rows+=`<tr id="row-${x.fixId}" onclick="toggleMatchDetails('${x.fixId}')" style="cursor:pointer;${live?'background:rgba(16,185,129,0.03)':''}">
          <td class="col-match left-align" style="font-weight:700; font-size:1.05rem;">${live?'<span class="live-dot" style="width:8px;height:8px;margin-right:6px;display:inline-block;"></span>':''}${esc(x.ht)} <span style="color:var(--text-muted)">–</span> ${esc(x.at)}${injBadge}${lineupSrcBadge}${subFlash}</td>
          <td class="col-score data-num" style="color:${scoreCol}; font-size:1.1rem;">${scoreStr}${liveExtra}${momentumBar}${nextGoalBadge}</td>
          <td class="col-1x2 data-num" style="font-size:1.1rem;">${x.outPick}</td>
          <td class="col-o25 data-num" style="font-size:1.1rem;">${x.omegaPick?.includes('OVER 2')?'🔥':'-'}</td>
          <td class="col-u25 data-num" style="font-size:1.1rem;">${x.omegaPick?.includes('UNDER 2')?'🔒':'-'}</td>
          <td class="col-btts data-num" style="font-size:1.1rem;">${x.omegaPick?.includes('GOAL')?'🎯':'-'}</td>
          <td class="col-exact data-num" style="font-size:0.95rem; line-height:1.4;">
            <span style="color:var(--accent-blue);font-weight:800;">${x.exact||'?-?'}</span>${x.exact2&&x.exact2!==x.exact?`<br><span style="color:var(--accent-purple);font-size:0.8rem;">${x.exact2}</span>`:''}
            ${x.htAnalysis?`<br><span style="color:var(--accent-teal);font-size:0.75rem;font-weight:700;">⏱ ${x.htAnalysis.htBest.h}-${x.htAnalysis.htBest.a}</span>`:''}
          </td>
          <td class="col-conf data-num" style="color:${confCol}; font-size:1.1rem;">${conf.toFixed(0)}%</td>
          <td class="col-signal" style="color:${omCol};font-weight:800;font-size:0.85rem;">${(x.omegaPick||'—').split(' ').slice(0,3).join(' ')}</td>
        </tr>
        <tr id="details-${x.fixId}" style="display:none; background:var(--bg-surface);">
          ${buildAccordionHTML(x)}
        </tr>`;
      });
      rows+=`</tbody></table></div>`;
    }
    finalHtml += `<div class="quant-panel" style="padding:0;overflow:hidden;">
      <div style="padding:15px 20px;border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:0.95rem;font-weight:800;color:var(--accent-blue);text-transform:uppercase;letter-spacing:1px;">📊 Match Dashboard (Active) — ${activeMatches.length} αγώνες</span>
      </div>${rows}</div>`;
  }

  // 2. FINISHED MATCHES
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
          else if(x.omegaPick.includes('ΑΣΟΣ') && !x.omegaPick.includes('AH')) hit = aOut === '1';
          else if(x.omegaPick.includes('ΔΙΠΛΟ') && !x.omegaPick.includes('AH')) hit = aOut === '2';
          else if(x.omegaPick.includes('ΚΟΡΝΕΡ')) hit = (hCor+aCor) > 8.5;
          else if(x.omegaPick.includes('ΚΑΡΤΕΣ')) hit = (hCrd+aCrd) > 5.5;
          else if(x.omegaPick.includes('AH')) { 
            if(x.omegaPick.includes('ΑΣΟΣ')) hit = (ah - aa) >= 2;
            if(x.omegaPick.includes('ΔΙΠΛΟ')) hit = (aa - ah) >= 2;
          }
          hitHtml = hit ? `<span style="background:rgba(16,185,129,0.15);color:var(--accent-green);padding:4px 8px;border-radius:4px;font-weight:800;font-size:0.75rem;">✅ WON</span>` : `<span style="background:rgba(244,63,94,0.15);color:var(--accent-red);padding:4px 8px;border-radius:4px;font-weight:800;font-size:0.75rem;">❌ LOST</span>`;
      }

      fRows += `<tr id="row-${x.fixId}" onclick="toggleMatchDetails('${x.fixId}')" style="cursor:pointer;">
        <td class="left-align" style="font-weight:700; font-size:1.05rem;">${esc(x.ht)} - ${esc(x.at)}</td>
        <td class="data-num" style="color:var(--text-main); font-size:1.1rem;">${ah}-${aa}</td>
        <td class="data-num" style="font-size:1.1rem;">${hXGAct} - ${aXGAct}</td>
        <td class="data-num" style="font-size:1.1rem;">${hPoss}% - ${aPoss}%</td>
        <td class="data-num" style="font-size:1.1rem;">${hCor} - ${aCor}</td>
        <td class="data-num" style="font-size:1.1rem;">${hCrd} - ${aCrd}</td>
        <td style="font-size:0.85rem;font-weight:800;color:var(--text-main);">${(x.omegaPick||'—').split(' ').slice(0,3).join(' ')}</td>
        <td>${hitHtml}</td>
      </tr>
      <tr id="details-${x.fixId}" style="display:none; background:var(--bg-surface);">
        ${buildAccordionHTML(x)}
      </tr>`;
    });

    finalHtml += `<div class="quant-panel" style="padding:0;overflow:hidden;margin-top:30px;border-color:rgba(16,185,129,0.5);">
      <div style="background:rgba(16,185,129,0.1);padding:15px 20px;border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:0.95rem;font-weight:800;color:var(--accent-green);text-transform:uppercase;letter-spacing:1px;">🏁 Post-Match Evolution (Finished) — ${finishedMatches.length} αγώνες</span>
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
//  AUDIT, VAULT & AI ADVISOR (Auto-Optimization Logic)
// ================================================================
window.runCustomAudit=async function(){
  const s=document.getElementById('auditStart').value,e=document.getElementById('auditEnd').value;
  if(!s||!e){showErr('Επιλέξτε ημερομηνίες.');return;}
  if(isRunning)return;isRunning=true;setBtnsDisabled(true);setLoader(true,'Running AI Audit...');
  document.getElementById('auditSection').innerHTML='';
  
  try{
    const store=JSON.parse(localStorage.getItem(LS_PREDS)||'[]');
    const endD=new Date(e);endD.setDate(endD.getDate()+1);
    const lgFilter=document.getElementById('auditLeague')?.value||'ALL';
    
    let cands=store.filter(x=>{const d=new Date(x.date);return d>=new Date(s)&&d<endD;});
    if(lgFilter!=='ALL') cands=cands.filter(x=>String(x.leagueId)===lgFilter);
    
    if(!cands.length){
      document.getElementById('auditSection').innerHTML=`<div class="quant-panel" style="text-align:center;color:var(--text-muted);padding:30px;font-size:1.1rem;">Δεν υπάρχουν δεδομένα για Audit.</div>`;
      return;
    }
    
    let stats={games:0,outHit:0,validOut:0,o25T:0,o25H:0,o35T:0,o35H:0,u25T:0,u25H:0,bttsT:0,bttsH:0,exHit:0};
    const rows=[],curveData=[];
    
    for(let i=0;i<cands.length;i++){
      const p=cands[i];
      setProgress(Math.round(((i+1)/cands.length)*100),`Auditing: ${p.homeTeam}`);
      const fr=await apiReq(`fixtures?id=${p.fixtureId}`);
      const fix=fr?.response?.[0];
      if(!fix||!isFinished(fix?.fixture?.status?.short))continue;
      
      const ah=safeNum(fix.goals.home),aa=safeNum(fix.goals.away);
      const aTot=ah+aa,aExact=`${ah}-${aa}`,aOut=ah>aa?'1':ah<aa?'2':'X',aBtts=ah>0&&aa>0;
      stats.games++;
      
      let isHit1X2 = false;
      if (p.outPick && p.outPick !== '-') {
          isHit1X2 = p.outPick === aOut;
          if(p.omegaPick && p.omegaPick.includes('AH')) {
              if(p.omegaPick.includes('ΑΣΟΣ')) isHit1X2 = (ah - aa) >= 2;
              if(p.omegaPick.includes('ΔΙΠΛΟ')) isHit1X2 = (aa - ah) >= 2;
          }
          if(!p.omegaPick?.includes('ΗΜΙΧΡΟΝΟ')) {
              stats.validOut++;
              if(isHit1X2) stats.outHit++;
          }
      }

      if(p.predOver25){stats.o25T++;if(aTot>2.5)stats.o25H++;}
      if(p.predOver35){stats.o35T++;if(aTot>3.5)stats.o35H++;}
      if(p.predUnder25){stats.u25T++;if(aTot<2.5)stats.u25H++;}
      if(p.predBTTS){stats.bttsT++;if(aBtts)stats.bttsH++;}
      if(p.exactScorePred===aExact)stats.exHit++;
      curveData.push({tXG:p.tXG||2.5,hitO25:aTot>2.5?1:0});
      rows.push({p,ah,aa,aTot,aExact,aOut,aBtts,isHit1X2});
    }
    
    const rv=(h,t)=>t>0?h/t*100:0;
    const col=v=>v>=80?'var(--accent-green)':v>=60?'var(--accent-gold)':'var(--accent-red)';
    
    // --- 🤖 AI ADVISOR LOGIC ---
    let advisorHTML = '';
    const recs = [];
    const rO25 = rv(stats.o25H, stats.o25T);
    const rO35 = rv(stats.o35H, stats.o35T);
    const r1X2 = rv(stats.outHit, stats.validOut);

    if(stats.o25T >= 10 && rO25 < 55) {
      recs.push(`⚠️ Το <b>Πάνω 2.5</b> χάνει (Ποσοστό: ${rO25.toFixed(1)}%). Προτείνεται αύξηση του <i>Ελάχ. xG (Πάνω 2.5)</i> κατά <b>+0.10</b> στα Καθολικές Ρυθμίσεις.`);
    } else if(stats.o25T >= 10 && rO25 > 70) {
      recs.push(`💡 Το <b>Πάνω 2.5</b> αποδίδει εξαιρετικά (${rO25.toFixed(1)}%). Προτείνεται μείωση του <i>Ελάχ. xG (Πάνω 2.5)</i> κατά <b>-0.05</b> για περισσότερα σήματα.`);
    }

    if(stats.o35T >= 8 && rO35 < 50) {
      recs.push(`⚠️ Το <b>Πάνω 3.5</b> υστερεί (${rO35.toFixed(1)}%). Προτείνεται αυστηροποίηση του <i>Ελάχ. xG (Πάνω 3.5)</i> κατά <b>+0.15</b>.`);
    }

    if(stats.validOut >= 8 && r1X2 < 50) {
      recs.push(`⚠️ Χαμηλό ποσοστό στα <b>Αποτελέσματα (1Χ2/ΑΧ)</b> (${r1X2.toFixed(1)}%). Προτείνεται αύξηση του απαιτούμενου <i>Διαφορά xG</i> κατά <b>+0.05</b> (π.χ. από 0.48 σε 0.53).`);
    }

    if(recs.length > 0) {
      advisorHTML = `<div style="background:rgba(251,191,36,0.1); border:1px solid var(--accent-gold); border-radius:var(--radius-sm); padding:15px; margin-bottom:20px;">
        <h4 style="color:var(--accent-gold); margin-bottom:10px; font-size:0.9rem; text-transform:uppercase; display:flex; align-items:center; gap:8px;">🤖 Προτάσεις AI Σύμβουλου</h4>
        <ul style="color:var(--text-main); font-size:0.85rem; padding-left:20px; line-height:1.6;">
          ${recs.map(r => `<li style="margin-bottom:5px;">${r}</li>`).join('')}
        </ul>
      </div>`;
    } else if (stats.games > 0) {
       advisorHTML = `<div style="background:rgba(16,185,129,0.1); border:1px solid var(--accent-green); border-radius:var(--radius-sm); padding:15px; margin-bottom:20px; text-align:center;">
        <span style="color:var(--accent-green); font-weight:700;">✅ Το σύστημα είναι άριστα βαθμονομημένο. Δεν προτείνονται αλλαγές!</span>
      </div>`;
    }

    const statsCards=[{lbl:acr('1X2')+' / '+acr('AH'),h:stats.outHit,t:stats.validOut},{lbl:acr('O2.5'),h:stats.o25H,t:stats.o25T},{lbl:acr('O3.5'),h:stats.o35H,t:stats.o35T},{lbl:acr('U2.5'),h:stats.u25H,t:stats.u25T},{lbl:acr('BTTS'),h:stats.bttsH,t:stats.bttsT},{lbl:'Exact',h:stats.exHit,t:stats.games},];
    
    let html=`<div class="quant-panel">
      <div class="panel-title">📊 Αποτελέσματα Αξιολόγησης — ${cands.length} προβλέψεις</div>
      ${advisorHTML}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:15px;margin-bottom:20px;">
        ${statsCards.map(m=>{const v=rv(m.h,m.t);return`<div style="background:var(--bg-base);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:20px;text-align:center;"><div style="font-size:0.85rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">${m.lbl}</div><div style="font-size:1.8rem;font-weight:900;font-family:var(--font-mono);color:${m.t>0?col(v):'var(--text-muted)'};">${m.t>0?v.toFixed(1)+'%':'N/A'}</div><div style="font-size:0.75rem;color:var(--text-muted);margin-top:5px;">${m.h}/${m.t}</div></div>`;}).join('')}
      </div>
      <div style="font-size:0.85rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:10px;">xG Threshold Optimization Curve (Over 2.5)</div>
      ${buildMiniCurve(engineConfig.tXG_O25,curveData)}
      <div class="data-table-wrapper"><table class="summary-table" style="font-size:0.9rem;"><thead><tr><th class="left-align">Fixture</th><th>Score</th><th>${acr('1X2')} / ${acr('AH')}</th><th>${acr('O2.5')}</th><th>${acr('O3.5')}</th><th>${acr('U2.5')}</th><th>${acr('BTTS')}</th><th>Exact</th></tr></thead><tbody>`;
      
    rows.forEach(({p,ah,aa,aTot,aExact,aOut,aBtts,isHit1X2})=>{
      const cell=(pred,hit)=>pred?`<span class="${hit?'audit-omega-hit':'audit-omega-miss'}">${hit?'✅':'❌'}</span>`:'<span style="color:var(--text-dim)">—</span>';
      
      let outHitHtml = '—';
      if (p.outPick && p.outPick !== '-') {
         if(p.omegaPick && p.omegaPick.includes('ΗΜΙΧΡΟΝΟ')) {
             outHitHtml = `<span style="color:var(--text-dim)">HT (Skipped)</span>`;
         } else {
             outHitHtml = `<span class="${isHit1X2?'audit-omega-hit':'audit-omega-miss'}">${isHit1X2?'✅':'❌'}</span>`;
         }
      }

      // Exact: hit αν πετύχει το Top-1 ή το Top-2 σκορ
      const exactHit1 = p.exactScorePred === aExact;
      const exactHit2 = p.exactScorePred2 === aExact;
      const exactHit = exactHit1 || exactHit2;
      const exactCell = p.exactScorePred
        ? `<span class="${exactHit1?'audit-omega-hit':'audit-omega-miss'}">${p.exactScorePred}</span>`
          + (p.exactScorePred2 && p.exactScorePred2 !== p.exactScorePred
            ? `<br><span class="${exactHit2?'audit-omega-hit':'audit-omega-miss'}" style="font-size:0.85rem;">${p.exactScorePred2}</span>` : '')
        : '—';
      
      html+=`<tr><td class="left-align" style="font-weight:700;font-size:1rem;">${esc(p.homeTeam)} vs ${esc(p.awayTeam)}<div style="font-size:0.75rem;color:var(--text-muted)">${p.league}</div></td><td class="data-num" style="font-size:1.1rem;">${ah}-${aa}</td><td style="font-size:1.1rem;">${outHitHtml}</td><td>${cell(p.predOver25,aTot>2.5)}</td><td>${cell(p.predOver35,aTot>3.5)}</td><td>${cell(p.predUnder25,aTot<2.5)}</td><td>${cell(p.predBTTS,aBtts)}</td><td style="font-size:1.1rem;">${exactCell}</td></tr>`;
    });
    
    html+=`</tbody></table></div></div>`;
    document.getElementById('auditSection').innerHTML=html;
    showOk('Audit & AI Analysis ολοκληρώθηκε.');
  }catch(e){showErr(e.message);}finally{isRunning=false;setLoader(false);setBtnsDisabled(false);}
};
function buildMiniCurve(currentThreshold,data){if(!data.length)return'';let thresholds=[2.0,2.2,2.4,2.6,2.8,3.0,3.2];let bars='';thresholds.forEach(th=>{const valid=data.filter(d=>d.tXG>=th);const hits=valid.filter(d=>d.hitO25===1).length;const rate=valid.length>0?(hits/valid.length)*100:0;const h=Math.max(Math.round((rate/100)*40),2);const isCurrent=Math.abs(th-currentThreshold)<0.1;bars+=`<div title="Thresh: ${th} | Rate: ${rate.toFixed(1)}%" style="display:inline-block; width:12%; height:${h}px; background:${isCurrent?'var(--accent-blue)':'rgba(255,255,255,0.1)'}; margin-right:2px; border-radius:2px 2px 0 0; position:relative;"><span style="position:absolute; bottom:-20px; left:50%; transform:translateX(-50%); font-size:0.65rem; color:var(--text-muted);">${th}</span></div>`;});return`<div style="height:60px; display:flex; align-items:flex-end; border-bottom:1px solid var(--border-light); padding-bottom:5px; margin-bottom:25px;">${bars}</div>`;}
function saveToVault(data){try{let store=JSON.parse(localStorage.getItem(LS_PREDS)||"[]");const map=new Map(store.map(x=>[String(x.fixtureId),x]));data.forEach(d=>{if(d.omegaPick==="NO BET")return;map.set(String(d.fixId),{fixtureId:d.fixId,date:d.m.fixture.date,leagueId:d.leagueId,league:d.lg,homeTeam:d.ht,awayTeam:d.at,outPick:d.outPick,exactScorePred:d.exact,exactScorePred2:d.exact2,predOver25:d.omegaPick.includes('OVER 2')||d.omegaPick.includes('OVER 3'),predOver35:d.omegaPick.includes('OVER 3'),predUnder25:d.omegaPick.includes('UNDER 2'),predBTTS:d.omegaPick.includes('GOAL'),omegaPick:d.omegaPick,tXG:d.tXG});});localStorage.setItem(LS_PREDS,JSON.stringify(Array.from(map.values())));}catch(e){}}
window.clearVault=function(){if(confirm("Purge all data?")){localStorage.removeItem(LS_PREDS);showOk("Vault Purged.");updateAuditLeagueFilter();}};
function updateAuditLeagueFilter(){const store=JSON.parse(localStorage.getItem(LS_PREDS)||'[]');const sel=document.getElementById('auditLeague');if(!sel)return;const known=new Set(store.map(x=>x.leagueId));sel.innerHTML='<option value="ALL">Global (All)</option>';(typeof LEAGUES_DATA!=='undefined'?LEAGUES_DATA:[]).forEach(l=>{if(known.has(l.id))sel.innerHTML+=`<option value="${l.id}">${l.name}</option>`;});}

// ================================================================
//  LEAGUE MODS MANAGER
// ================================================================
window.renderLeagueMods = function() {
  const container = document.getElementById('leagueModsContainer');
  if(!container || typeof LEAGUES_DATA === 'undefined') return;
  
  let html = `<table class="summary-table" style="font-size:0.85rem;">
    <thead style="position:sticky; top:0; z-index:1;">
      <tr><th class="left-align">League</th><th>xG Multiplier</th><th>Διαφορά xG (1X2)</th><th>Min xG (O2.5)</th></tr>
    </thead><tbody>`;
    
  LEAGUES_DATA.forEach(l => {
    const mods = leagueMods[l.id] || {};
    html += `<tr>
      <td class="left-align" style="font-weight:700; color:var(--text-main); font-size:0.95rem;">${l.name}</td>
      <td><input type="number" step="0.01" class="quant-input" style="width:90px; padding:8px; text-align:center; font-size:0.95rem;" id="mod_mult_${l.id}" value="${mods.mult || ''}" placeholder="Def"></td>
      <td><input type="number" step="0.05" class="quant-input" style="width:90px; padding:8px; text-align:center; font-size:0.95rem;" id="mod_diff_${l.id}" value="${mods.xgDiff || ''}" placeholder="Def"></td>
      <td><input type="number" step="0.05" class="quant-input" style="width:90px; padding:8px; text-align:center; font-size:0.95rem;" id="mod_o25_${l.id}" value="${mods.minXGO25 || ''}" placeholder="Def"></td>
    </tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
};

window.saveLeagueMods = function() {
  if(typeof LEAGUES_DATA === 'undefined') return;
  LEAGUES_DATA.forEach(l => {
    const mVal = parseFloat(document.getElementById(`mod_mult_${l.id}`)?.value);
    const dVal = parseFloat(document.getElementById(`mod_diff_${l.id}`)?.value);
    const oVal = parseFloat(document.getElementById(`mod_o25_${l.id}`)?.value);
    
    if(!isNaN(mVal) || !isNaN(dVal) || !isNaN(oVal)) {
      leagueMods[l.id] = {};
      if(!isNaN(mVal)) leagueMods[l.id].mult = mVal;
      if(!isNaN(dVal)) leagueMods[l.id].xgDiff = dVal;
      if(!isNaN(oVal)) leagueMods[l.id].minXGO25 = oVal;
    } else {
      delete leagueMods[l.id];
    }
  });
  try{ localStorage.setItem(LS_LGMODS, JSON.stringify(leagueMods)); }catch{}
  showOk('Saved League Mods!');
  if(window.scannedMatchesData.length > 0) window.resimulateMatches();
};

// ================================================================
//  SETTINGS & INIT
// ================================================================
window.loadSettings=function(){try{const s=JSON.parse(localStorage.getItem(LS_SETTINGS));if(s)engineConfig={...DEFAULT_SETTINGS,...s};}catch{}try{const lm=JSON.parse(localStorage.getItem(LS_LGMODS));if(lm)leagueMods=lm;}catch{}for(const[id,key]of Object.entries(SETTINGS_MAP)){const el=document.getElementById(id);if(el)el.value=engineConfig[key];}};
window.saveSettings=function(){for(const[id,key]of Object.entries(SETTINGS_MAP)){const v=parseFloat(document.getElementById(id)?.value);if(!isNaN(v))engineConfig[key]=v;}try{localStorage.setItem(LS_SETTINGS,JSON.stringify(engineConfig));}catch{}showOk('Saved Καθολικές Ρυθμίσεις!');};
// ================================================================
//  DIXON-COLES ATTACK/DEFENSE RATINGS
//  Υπολογίζει attack strength / defense strength από season totals.
//  att = goals_for / league_avg_for
//  def = goals_against / league_avg_against (lower = better defense)
//  λ_home = att_h × def_a × league_avg × HOME_ADV
//  λ_away = att_a × def_h × league_avg
// ================================================================
const HOME_ADVANTAGE = 1.10; // ~10% boost για γηπεδούχους (διεθνής μέσος όρος)

function computeDCLambdas(hS, aS, leagueId) {
  const lgAvg = (typeof LEAGUE_AVG_GOALS !== 'undefined' && LEAGUE_AVG_GOALS[leagueId])
    ? LEAGUE_AVG_GOALS[leagueId] : 2.65;
  const lgAvgH = lgAvg * 0.54; // ~54% των γκολ σκοράρει η γηπεδούχος
  const lgAvgA = lgAvg * 0.46;

  // Attack / Defense strengths (regression to 1.0 αν δεν υπάρχουν season data)
  const hAtt = hS.sea?.avgGoals        > 0 ? hS.sea.avgGoals        / lgAvgH : 1.0;
  const hDef = hS.sea?.avgGoalsAgainst > 0 ? hS.sea.avgGoalsAgainst / lgAvgA : 1.0;
  const aAtt = aS.sea?.avgGoals        > 0 ? aS.sea.avgGoals        / lgAvgA : 1.0;
  const aDef = aS.sea?.avgGoalsAgainst > 0 ? aS.sea.avgGoalsAgainst / lgAvgH : 1.0;

  const n = Math.min(hS.sea?.n || 0, aS.sea?.n || 0);
  // Bayesian shrinkage: με λίγα παιχνίδια → blend προς 1.0
  const trust = clamp(n / 20, 0.1, 1.0);
  const shrink = (v) => trust * v + (1 - trust) * 1.0;

  const dcH = clamp(shrink(hAtt) * shrink(aDef) * lgAvgH * HOME_ADVANTAGE, 0.30, 4.5);
  const dcA = clamp(shrink(aAtt) * shrink(hDef) * lgAvgA,                   0.20, 4.0);
  return { dcH, dcA, hAtt: shrink(hAtt), aDef: shrink(aDef), aAtt: shrink(aAtt), hDef: shrink(hDef), lgAvg, trust };
}

// Blends DC λ με form-based λ — αν trust χαμηλό, form κυριαρχεί
function blendLambdas(formH, formA, dcH, dcA, trust) {
  const dcW = clamp(trust * 0.55, 0.10, 0.55); // max 55% DC weight
  const fmW = 1 - dcW;
  return {
    blendH: formH * fmW + dcH * dcW,
    blendA: formA * fmW + dcA * dcW,
  };
}

// ================================================================
//  SITUATIONAL CONTEXT ENGINE
//  Εντοπίζει ομάδες χωρίς κίνητρο (nothing-to-play-for) και derby.
//  Επιστρέφει multiplier 0.75–1.25 που εφαρμόζεται στο lambda.
// ================================================================
function computeSituationalContext(stand, homeId, awayId, leagueId) {
  if(!stand?.length) return { hMot: 1.0, aMot: 1.0, flags: [], isDerby: false };

  const getEntry = (tId) => stand.find(x => String(x?.team?.id) === String(tId));
  const hEntry = getEntry(homeId);
  const aEntry = getEntry(awayId);
  const total  = stand.length;
  const flags  = [];
  let hMot = 1.0, aMot = 1.0;

  const assess = (entry, label) => {
    if(!entry) return 1.0;
    const rank = entry.rank ?? 99;
    const pts  = entry.points ?? 0;
    const gd   = entry.goalsDiff ?? 0;
    const won  = entry.all?.win  ?? 0;
    const played = entry.all?.played ?? 1;

    // Τίτλος: top 3 και κοντά στην κορυφή → extra motivation
    if(rank <= 3 && total >= 16) { flags.push(`${label}: τίτλος`); return 1.08; }

    // Champions League: θέσεις 4-5 (ανάλογα league) — high motivation
    if(rank <= 5 && rank >= 4)   { flags.push(`${label}: CL race`); return 1.05; }

    // Υποβιβασμός: τελευταία 3 + κοντά στο όριο → must-win
    if(rank >= total - 2)        { flags.push(`${label}: relegation`); return 1.12; }

    // Nothing-to-play-for: μεσαία — ούτε τίτλο, ούτε CL, ούτε υποβιβασμό
    // και > 70% της σεζόν έχει παιχτεί
    if(rank > 5 && rank < total - 2 && played > 0.70 * 38) {
      flags.push(`${label}: nothing-to-play-for`);
      return 0.88;
    }

    return 1.0;
  };

  hMot = assess(hEntry, 'Home');
  aMot = assess(aEntry, 'Away');

  // Derby detection: αν και οι δύο στην κορυφή 6 → ανεβαίνει η ένταση
  const isDerby = (hEntry?.rank <= 6 && aEntry?.rank <= 6) ||
    (Math.abs((hEntry?.rank||10) - (aEntry?.rank||10)) <= 2 && total >= 14);
  if(isDerby) { flags.push('Derby/Rivalry'); hMot *= 1.04; aMot *= 1.04; }

  return {
    hMot: clamp(hMot, 0.75, 1.20),
    aMot: clamp(aMot, 0.75, 1.20),
    flags,
    isDerby,
    hRank: hEntry?.rank, aRank: aEntry?.rank,
    hPts:  hEntry?.points, aPts: aEntry?.points
  };
}

// ================================================================
//  VALUE MODEL — EV% + KELLY CRITERION
//  Χρησιμοποιεί τις model probabilities για να υπολογίσει αν
//  υπάρχει θετικό Expected Value σε δεδομένες αποδόσεις bookmaker.
//
//  EV% = (model_prob × decimal_odds) − 1
//  Kelly fraction = EV / (decimal_odds − 1)
//  Fractional Kelly (25%) για μείωση variance
// ================================================================
const KELLY_FRACTION = 0.25; // 25% Kelly — συντηρητικό
const MIN_EV_PCT     = 0.02; // Minimum 2% EV για signal
const LS_BETJOURNAL  = 'omega_betjournal_v5.0';

let betJournalData = [];

function computeEV(modelProb, decimalOdds) {
  if(!decimalOdds || decimalOdds <= 1.0) return null;
  const ev = modelProb * decimalOdds - 1;
  return parseFloat(ev.toFixed(4));
}

function computeKellyStake(modelProb, decimalOdds, bankroll) {
  const b = decimalOdds - 1; // net odds
  if(b <= 0 || modelProb <= 0 || modelProb >= 1) return 0;
  const f = (modelProb * b - (1 - modelProb)) / b; // full Kelly
  const frac = Math.max(f * KELLY_FRACTION, 0); // fractional Kelly
  return parseFloat((frac * bankroll).toFixed(2));
}

// Δίνει το implied probability αφαιρώντας το margin (overround removal)
function removeMargin(impliedProbs) {
  const total = impliedProbs.reduce((s, p) => s + p, 0);
  if(total <= 0) return impliedProbs;
  return impliedProbs.map(p => p / total);
}

// Κύρια συνάρτηση: για ένα record (post-computePick) δίνει EV, Kelly, recommended
function enrichWithValue(rec, manualOdds) {
  if(!manualOdds || !rec.pp) return rec;
  const { omegaPick, pp, hExp, aExp } = rec;
  const bankroll = bankrollData.current || 0;

  let marketProb = 0, impliedProb = 0, odds = 0;

  if(omegaPick.includes('OVER 2.5') || omegaPick.includes('OVER 3')) {
    marketProb  = omegaPick.includes('OVER 3') ? pp.pO35 : pp.pO25;
    odds        = manualOdds.over || 0;
    impliedProb = odds > 1 ? 1 / odds : 0;
  } else if(omegaPick.includes('UNDER 2.5')) {
    marketProb  = pp.pU25;
    odds        = manualOdds.under || 0;
    impliedProb = odds > 1 ? 1 / odds : 0;
  } else if(omegaPick.includes('BTTS') || omegaPick.includes('GOAL')) {
    marketProb  = pp.pBTTS;
    odds        = manualOdds.btts || 0;
    impliedProb = odds > 1 ? 1 / odds : 0;
  } else if(omegaPick.includes('ΑΣΟΣ') || omegaPick.includes('1 ΗΜΙΧΡΟΝΟ')) {
    marketProb  = pp.pHome;
    odds        = manualOdds.home || 0;
    impliedProb = odds > 1 ? 1 / odds : 0;
  } else if(omegaPick.includes('ΔΙΠΛΟ') || omegaPick.includes('2 ΗΜΙΧΡΟΝΟ')) {
    marketProb  = pp.pAway;
    odds        = manualOdds.away || 0;
    impliedProb = odds > 1 ? 1 / odds : 0;
  }

  if(!odds || odds <= 1.0 || marketProb <= 0) return rec;

  const ev     = computeEV(marketProb, odds);
  const kelly  = bankroll > 0 ? computeKellyStake(marketProb, odds, bankroll) : 0;
  const hasValue = ev >= MIN_EV_PCT;
  const edge   = (marketProb - impliedProb) * 100;

  return { ...rec, ev, kelly, hasValue, odds, marketProb, impliedProb, edge: parseFloat(edge.toFixed(1)) };
}

// ================================================================
//  BET JOURNAL — καταγραφή, P&L, ROI%
// ================================================================
window.loadBetJournal = function() {
  try { const j = JSON.parse(localStorage.getItem(LS_BETJOURNAL)); if(Array.isArray(j)) betJournalData = j; } catch {}
};

window.logBet = function(fixId, pick, odds, stake, result) {
  // result: 'pending' | 'won' | 'lost' | 'void'
  const rec = (window.scannedMatchesData||[]).find(r=>r.fixId===fixId);
  const entry = {
    id:       Date.now(),
    date:     todayISO(),
    fixId,
    match:    rec ? `${rec.ht} vs ${rec.at}` : String(fixId),
    league:   rec?.lg || '',
    pick,
    odds:     parseFloat(odds),
    stake:    parseFloat(stake),
    result:   result || 'pending',
    pnl:      result === 'won'  ? parseFloat(((odds-1)*stake).toFixed(2))
             : result === 'lost' ? -parseFloat(stake)
             : 0,
    ev:       rec?.ev ?? null,
    kelly:    rec?.kelly ?? null,
    closingOdds: null, // υπολογίζεται αργότερα → CLV
    clv:      null,
  };
  betJournalData.unshift(entry);
  if(betJournalData.length > 500) betJournalData = betJournalData.slice(0, 500);
  try { localStorage.setItem(LS_BETJOURNAL, JSON.stringify(betJournalData)); } catch {}
  return entry;
};

window.updateBetResult = function(betId, result, closingOdds) {
  const b = betJournalData.find(x => x.id === betId);
  if(!b) return;
  b.result = result;
  b.pnl    = result === 'won'  ? parseFloat(((b.odds-1)*b.stake).toFixed(2))
           : result === 'lost' ? -b.stake : 0;
  if(closingOdds) {
    b.closingOdds = parseFloat(closingOdds);
    b.clv = parseFloat(((b.odds / closingOdds - 1) * 100).toFixed(2)); // CLV%
  }
  try { localStorage.setItem(LS_BETJOURNAL, JSON.stringify(betJournalData)); } catch {}
  renderBetJournal();
};

function getBetJournalStats() {
  const settled = betJournalData.filter(b => b.result !== 'pending' && b.result !== 'void');
  const won     = settled.filter(b => b.result === 'won').length;
  const totalStaked = settled.reduce((s,b) => s + b.stake, 0);
  const totalPnl    = settled.reduce((s,b) => s + b.pnl,   0);
  const roi         = totalStaked > 0 ? (totalPnl / totalStaked) * 100 : 0;
  const clvBets     = settled.filter(b => b.clv !== null);
  const avgClv      = clvBets.length > 0 ? clvBets.reduce((s,b) => s + b.clv, 0) / clvBets.length : null;
  // Drawdown: running max PnL minus current PnL
  let runningPnl = 0, peak = 0, maxDD = 0;
  [...settled].reverse().forEach(b => { runningPnl += b.pnl; if(runningPnl > peak) peak = runningPnl; const dd = peak - runningPnl; if(dd > maxDD) maxDD = dd; });
  return { total: settled.length, won, hitRate: settled.length > 0 ? (won/settled.length*100) : 0, totalStaked, totalPnl, roi, avgClv, maxDD };
}

function renderBetJournal() {
  const el = document.getElementById('betJournalSection');
  if(!el) return;
  const stats = getBetJournalStats();
  const pnlColor = stats.totalPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
  const roiColor = stats.roi >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

  const rows = betJournalData.slice(0, 50).map(b => {
    const pnlCol = b.pnl > 0 ? 'var(--accent-green)' : b.pnl < 0 ? 'var(--accent-red)' : 'var(--text-muted)';
    const resultBadge = b.result === 'won'    ? `<span style="color:var(--accent-green);font-weight:800;">✅ WON</span>`
                      : b.result === 'lost'   ? `<span style="color:var(--accent-red);font-weight:800;">❌ LOST</span>`
                      : b.result === 'void'   ? `<span style="color:var(--text-muted);">VOID</span>`
                      : `<span style="color:var(--accent-gold);">⏳ Pending</span>`;
    const clvBadge = b.clv !== null ? `<span style="font-size:0.65rem;color:${b.clv>0?'var(--accent-green)':'var(--accent-red)'};">${b.clv>0?'+':''}${b.clv}%</span>` : '';
    const evBadge  = b.ev !== null  ? `<span style="font-size:0.65rem;color:${b.ev>0?'var(--accent-teal)':'var(--text-muted)'};">EV:${b.ev>0?'+':''}${(b.ev*100).toFixed(1)}%</span>` : '';
    return `<tr>
      <td style="font-size:0.72rem;color:var(--text-muted);">${b.date}</td>
      <td class="left-align" style="font-size:0.82rem;font-weight:600;">${esc(b.match)}<div style="font-size:0.65rem;color:var(--text-muted);">${esc(b.league)}</div></td>
      <td style="font-size:0.78rem;color:var(--accent-blue);font-weight:700;">${esc(b.pick)}</td>
      <td class="data-num" style="font-family:var(--font-mono);">${b.odds.toFixed(2)}</td>
      <td class="data-num" style="font-family:var(--font-mono);">€${b.stake.toFixed(0)}</td>
      <td>${resultBadge} ${clvBadge} ${evBadge}</td>
      <td class="data-num" style="font-family:var(--font-mono);color:${pnlCol};font-weight:800;">${b.pnl>=0?'+':''}€${b.pnl.toFixed(2)}</td>
      <td><button onclick="openUpdateBetModal(${b.id})" style="font-size:0.65rem;padding:2px 6px;border:1px solid var(--border-light);background:var(--bg-surface);color:var(--text-muted);border-radius:4px;cursor:pointer;">Edit</button></td>
    </tr>`;
  }).join('');

  el.innerHTML = `
  <div class="quant-panel" style="border-color:rgba(56,189,248,0.3);">
    <div class="panel-title clickable" style="color:var(--accent-blue);" onclick="togglePanel('betJournalBody','betJournalArrow')">
      <span>📒 Bet Journal & P&L Tracker <span style="font-size:0.7rem;color:var(--text-muted);">(${betJournalData.length} bets)</span></span>
      <span id="betJournalArrow" class="arrow">▼</span>
    </div>
    <div id="betJournalBody" style="display:none;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:18px;">
        ${[
          {lbl:'Total P&L',   val:`${stats.totalPnl>=0?'+':''}€${stats.totalPnl.toFixed(2)}`,  col:pnlColor},
          {lbl:'ROI%',        val:`${stats.roi>=0?'+':''}${stats.roi.toFixed(1)}%`,              col:roiColor},
          {lbl:'Hit Rate',    val:`${stats.hitRate.toFixed(1)}%`,                                col:'var(--text-main)'},
          {lbl:'Settled',     val:`${stats.won}/${stats.total}`,                                 col:'var(--text-main)'},
          {lbl:'Avg CLV',     val:stats.avgClv!==null?`${stats.avgClv>0?'+':''}${stats.avgClv.toFixed(1)}%`:'N/A', col:stats.avgClv>0?'var(--accent-green)':'var(--accent-red)'},
          {lbl:'Max Drawdown',val:`€${stats.maxDD.toFixed(0)}`,                                  col:'var(--accent-red)'},
        ].map(m=>`<div style="background:var(--bg-base);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:12px;text-align:center;">
          <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:4px;">${m.lbl}</div>
          <div style="font-size:1.2rem;font-weight:900;font-family:var(--font-mono);color:${m.col};">${m.val}</div>
        </div>`).join('')}
      </div>
      ${betJournalData.length ? `
      <div class="data-table-wrapper">
        <table class="summary-table" style="font-size:0.82rem;">
          <thead><tr><th>Ημ/νία</th><th class="left-align">Match</th><th>Pick</th><th>Odds</th><th>Stake</th><th>Αποτ.</th><th>P&L</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>` : `<div style="text-align:center;color:var(--text-muted);padding:24px;">Δεν υπάρχουν bets ακόμα. Πάτα "Log Bet" σε οποιοδήποτε signal.</div>`}
    </div>
  </div>
  <div id="betUpdateModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;align-items:center;justify-content:center;"></div>`;
}

window.openUpdateBetModal = function(betId) {
  const b = betJournalData.find(x => x.id === betId);
  if(!b) return;
  const modal = document.getElementById('betUpdateModal');
  if(!modal) return;
  modal.style.display = 'flex';
  modal.innerHTML = `<div style="background:var(--bg-panel);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:24px;min-width:320px;max-width:420px;">
    <div style="font-size:1rem;font-weight:800;color:var(--text-main);margin-bottom:16px;">📝 Update Bet</div>
    <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:14px;">${esc(b.match)} · ${esc(b.pick)}</div>
    <div style="margin-bottom:12px;"><label class="input-label">Αποτέλεσμα</label>
      <select id="betResultSel" class="quant-input">
        <option value="pending" ${b.result==='pending'?'selected':''}>⏳ Pending</option>
        <option value="won"     ${b.result==='won'?'selected':''}>✅ Won</option>
        <option value="lost"    ${b.result==='lost'?'selected':''}>❌ Lost</option>
        <option value="void"    ${b.result==='void'?'selected':''}>Void</option>
      </select></div>
    <div style="margin-bottom:16px;"><label class="input-label">Closing Odds (για CLV)</label>
      <input type="number" id="betCloseOdds" class="quant-input" step="0.01" placeholder="π.χ. 1.85" value="${b.closingOdds||''}"></div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-primary" style="flex:1;" onclick="window.updateBetResult(${betId},document.getElementById('betResultSel').value,document.getElementById('betCloseOdds').value||null);document.getElementById('betUpdateModal').style.display='none';">Αποθήκευση</button>
      <button class="btn btn-outline" onclick="document.getElementById('betUpdateModal').style.display='none';">Κλείσιμο</button>
    </div>
  </div>`;
};

// Log Bet button — εμφανίζεται inline στα match cards
window.openLogBetModal = function(fixId) {
  const rec = (window.scannedMatchesData||[]).find(r=>r.fixId==fixId);
  if(!rec) return;
  const existing = document.getElementById('quickLogModal');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'quickLogModal';
  modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;align-items:center;justify-content:center;';
  const kelly = rec.kelly || 0;
  const ev = rec.ev != null ? `EV: ${rec.ev>0?'+':''}${(rec.ev*100).toFixed(1)}%` : '';
  modal.innerHTML = `<div style="background:var(--bg-panel);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:24px;min-width:340px;max-width:440px;">
    <div style="font-size:1rem;font-weight:800;color:var(--text-main);margin-bottom:4px;">📒 Log Bet</div>
    <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:16px;">${esc(rec.ht)} vs ${esc(rec.at)}</div>
    <div style="margin-bottom:10px;"><label class="input-label">Pick</label>
      <input id="logPick" class="quant-input" value="${esc(rec.omegaPick)}"></div>
    <div style="margin-bottom:10px;"><label class="input-label">Decimal Odds</label>
      <input type="number" id="logOdds" class="quant-input" step="0.01" placeholder="π.χ. 1.85"></div>
    <div style="margin-bottom:10px;"><label class="input-label">Stake (€) ${kelly>0?`<span style="color:var(--accent-green);font-size:0.7rem;">Kelly suggest: €${kelly}</span>`:''}</label>
      <input type="number" id="logStake" class="quant-input" step="1" value="${kelly>0?kelly:''}" placeholder="€"></div>
    ${ev?`<div style="font-size:0.75rem;color:var(--accent-teal);margin-bottom:12px;">${ev}</div>`:''}
    <div style="display:flex;gap:10px;">
      <button class="btn btn-primary" style="flex:1;" onclick="(()=>{const o=parseFloat(document.getElementById('logOdds').value),s=parseFloat(document.getElementById('logStake').value),p=document.getElementById('logPick').value;if(!o||!s){showErr('Συμπλήρωσε odds και stake');return;}window.logBet(${fixId},p,o,s,'pending');renderBetJournal();document.getElementById('quickLogModal').remove();showOk('Bet logged!');})()">✅ Log</button>
      <button class="btn btn-outline" onclick="document.getElementById('quickLogModal').remove()">Άκυρο</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
};

// ================================================================
//  GOOGLE SHEETS PUSH
//  Αποστέλλει δεδομένα στο Apps Script webhook μετά κάθε scan.
//  Endpoint: ορίζεται από τον χρήστη στο UI (αποθηκεύεται localStorage)
// ================================================================
const LS_SHEETS_URL = 'omega_sheets_url_v5.0';

async function pushToSheets(data) {
  const url = localStorage.getItem(LS_SHEETS_URL);
  if(!url || !data?.length) return;

  // Batch rows για team stats + προβλέψεις
  const teamRows = [];
  const predRows = [];

  data.forEach(d => {
    if(!d.hS || !d.aS) return;

    // Team stats rows (home & away)
    [[d.ht, d.hS, true], [d.at, d.aS, false]].forEach(([name, s, isHome]) => {
      teamRows.push({
        date:         todayISO(),
        team:         name,
        league:       d.lg,
        leagueId:     d.leagueId,
        isHome:       isHome ? 1 : 0,
        fXG:          parseFloat(Number(s.fXG).toFixed(3)),
        fXGA:         parseFloat(Number(s.fXGA).toFixed(3)),
        sXG:          parseFloat(Number(s.sXG).toFixed(3)),
        formRating:   s.formRating || 0,
        avgCorners:   parseFloat(Number(s.cor).toFixed(2)),
        avgCards:     parseFloat(Number(s.crd).toFixed(2)),
        shotsOn:      parseFloat(Number(s.shotsOn||0).toFixed(2)),
        shotsOff:     parseFloat(Number(s.shotsOff||0).toFixed(2)),
        sdGoals_6:    s.r6?.sdGoals   != null ? parseFloat(s.r6.sdGoals.toFixed(3))   : '',
        sdCorners_6:  s.r6?.sdCorners != null ? parseFloat(s.r6.sdCorners.toFixed(3)) : '',
        sdCards_6:    s.r6?.sdCards   != null ? parseFloat(s.r6.sdCards.toFixed(3))   : '',
        sdGoals_sea:  s.sea?.sdGoals  != null ? parseFloat(s.sea.sdGoals.toFixed(3))  : '',
        seaPlayed:    s.sea?.n || 0,
      });
    });

    // Prediction rows
    predRows.push({
      date:         todayISO(),
      fixtureId:    d.fixId,
      home:         d.ht,
      away:         d.at,
      league:       d.lg,
      leagueId:     d.leagueId,
      omegaPick:    d.omegaPick,
      confidence:   parseFloat(Number(d.strength||0).toFixed(1)),
      tXG:          parseFloat(Number(d.tXG||0).toFixed(3)),
      hXG:          parseFloat(Number(d.hXGfinal||d.hExp||0).toFixed(3)),
      aXG:          parseFloat(Number(d.aXGfinal||d.aExp||0).toFixed(3)),
      xgDiff:       parseFloat(Number(d.xgDiff||0).toFixed(3)),
      exactScore:   d.exact || '',
      htScore:      d.htAnalysis ? `${d.htAnalysis.htBest.h}-${d.htAnalysis.htBest.a}` : '',
      pO25:         d.pp ? parseFloat((d.pp.pO25*100).toFixed(1)) : '',
      pO35:         d.pp ? parseFloat((d.pp.pO35*100).toFixed(1)) : '',
      pU25:         d.pp ? parseFloat((d.pp.pU25*100).toFixed(1)) : '',
      pBTTS:        d.pp ? parseFloat((d.pp.pBTTS*100).toFixed(1)) : '',
      cornerConf:   parseFloat(Number(d.cornerConf||0).toFixed(1)),
      ev:           d.ev != null ? parseFloat((d.ev*100).toFixed(2)) : '',
      kelly:        d.kelly || '',
      sitFlags:     d.sitCtx?.flags?.join(', ') || '',
      hasLineup:    d.lineupData?.available ? 1 : 0,
      hasInjury:    (d.hInjAdj?.delta < -0.05 || d.aInjAdj?.delta < -0.05) ? 1 : 0,
    });
  });

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamRows, predRows, sentAt: new Date().toISOString() }),
    });
    if(resp.ok) showOk(`📊 Sheets: ${predRows.length} προβλέψεις + ${teamRows.length} team rows pushed.`);
    else showErr('Sheets push failed: ' + resp.status);
  } catch(e) {
    showErr('Sheets push error: ' + e.message);
  }
}

// ================================================================
//  STABILITY SIGNALS ENGINE
//  Αναλύει τη διακύμανση κάθε ομάδας και παράγει σαφή σήματα
//  ποντάρίσματος βάσει σταθερότητας σε γκολ, κόρνερ, κάρτες.
// ================================================================

const STABILITY_THRESHOLDS = {
  goals:   { stable: 0.82, volatile: 1.30 },
  corners: { stable: 0.75, volatile: 1.35 },
  cards:   { stable: 0.80, volatile: 1.40 },
};
// Baseline σ για σύγκριση (league average):
// goals:   Poisson √1.35 ≈ 1.16
// corners: Poisson √5.1  ≈ 2.26
// cards:   NegBin √(2.2 + 2.2²/2.5) = √(2.2 + 1.936) = √4.136 ≈ 2.03
//          (overdispersion k=2.5 γιατί κάρτες δεν ακολουθούν Poisson)
const BASE_SD = { goals: 1.16, corners: 2.26, cards: 2.03 };

function assessStability(sd, metric) {
  if(sd === null || sd === undefined) return 'unknown';
  const ratio = sd / BASE_SD[metric];
  if(ratio < STABILITY_THRESHOLDS[metric].stable)   return 'stable';
  if(ratio < STABILITY_THRESHOLDS[metric].volatile)  return 'normal';
  return 'volatile';
}

function computeStabilitySignals(rec) {
  const { hS, aS, omegaPick, tXG, pp, cornerConf, strength } = rec;
  if(!hS || !aS) return [];
  const signals = [];

  const hr6 = hS.r6 || {}, ar6 = aS.r6 || {};

  // ── Γκολ Σταθερότητα ────────────────────────────────────────────
  const hGoalStab  = assessStability(hr6.sdGoals,         'goals');
  const aGoalStab  = assessStability(ar6.sdGoals,         'goals');
  const hDefStab   = assessStability(hr6.sdGoalsAgainst,  'goals');
  const aDefStab   = assessStability(ar6.sdGoalsAgainst,  'goals');

  // Και οι δύο σταθερές επίθεση + xG υπoστηρίζει Over
  if(hGoalStab==='stable' && aGoalStab==='stable' &&
     hDefStab!=='stable'  && aDefStab!=='stable'  && tXG >= 2.5) {
    signals.push({
      type: 'goals_over', strength: 'strong',
      icon: '🔥', color: 'var(--accent-green)',
      title: 'Σταθερή Επίθεση — Υπέρ ΠΑΝΩ 2.5',
      text: `Αμφότερες οι ομάδες παρουσιάζουν σταθερή επιθετική παραγωγή (σ < ${(BASE_SD.goals*STABILITY_THRESHOLDS.goals.stable).toFixed(2)}). Ευνοεί ποντάρισμα σε ΠΑΝΩ 2.5.`,
    });
  }

  // Και οι δύο σταθερή άμυνα + χαμηλό xG → Under
  if(hDefStab==='stable' && aDefStab==='stable' && tXG <= 2.2 &&
     pp && pp.pU25 >= 0.52) {
    signals.push({
      type: 'goals_under', strength: 'strong',
      icon: '🔒', color: 'var(--accent-teal)',
      title: 'Σταθερή Άμυνα — Υπέρ ΚΑΤΩ 2.5',
      text: `Αμφότερες παρουσιάζουν χαμηλή αστάθεια στα γκολ που δέχονται. Σε συνδυασμό με χαμηλό xG (${tXG.toFixed(2)}), ευνοεί ΚΑΤΩ 2.5.`,
    });
  }

  // Μία ομάδα πολύ πιο σταθερή σε επίθεση → 1X2 εμπιστοσύνη
  if(hGoalStab==='stable' && aGoalStab==='volatile' && pp && pp.pHome >= 0.52) {
    signals.push({
      type: 'home_stable', strength: 'medium',
      icon: '🏠', color: 'var(--accent-blue)',
      title: 'Γηπεδούχοι Σταθεροί — Υπέρ Νίκης',
      text: `Οι γηπεδούχοι έχουν σταθερή επιθετική παραγωγή ενώ οι φιλοξενούμενοι παρουσιάζουν αστάθεια. Ενισχύει την πρόβλεψη νίκης γηπεδούχων.`,
    });
  }
  if(aGoalStab==='stable' && hGoalStab==='volatile' && pp && pp.pAway >= 0.52) {
    signals.push({
      type: 'away_stable', strength: 'medium',
      icon: '✈️', color: 'var(--accent-blue)',
      title: 'Φιλοξενούμενοι Σταθεροί — Υπέρ Νίκης',
      text: `Οι φιλοξενούμενοι έχουν σταθερή επιθετική παραγωγή ενώ οι γηπεδούχοι παρουσιάζουν αστάθεια. Ενισχύει την πρόβλεψη νίκης φιλοξενούμενων.`,
    });
  }

  // ── Κόρνερ Σταθερότητα ──────────────────────────────────────────
  const hCorStab = assessStability(hr6.sdCorners, 'corners');
  const aCorStab = assessStability(ar6.sdCorners, 'corners');

  if(hCorStab==='stable' && aCorStab==='stable' && cornerConf >= 60) {
    signals.push({
      type: 'corners_stable', strength: 'strong',
      icon: '🚩', color: 'var(--accent-teal)',
      title: 'Σταθερά Κόρνερ — Υψηλή Βεβαιότητα',
      text: `Και οι δύο ομάδες παρουσιάζουν σταθερή παραγωγή κόρνερ (σ < ${(BASE_SD.corners*STABILITY_THRESHOLDS.corners.stable).toFixed(2)}). Η εκτίμηση ΠΑΝΩ 8.5 κόρνερ έχει αυξημένη αξιοπιστία.`,
    });
  }
  if(hCorStab==='volatile' || aCorStab==='volatile') {
    signals.push({
      type: 'corners_volatile', strength: 'warn',
      icon: '⚠️', color: 'var(--accent-gold)',
      title: 'Αστάθεια Κόρνερ — Προσοχή στο Πόνταρισμα',
      text: `${hCorStab==='volatile'?rec.ht:rec.at} παρουσιάζει υψηλή αστάθεια σε κόρνερ. Μειωμένη αξιοπιστία για αγορές κόρνερ.`,
    });
  }

  // ── Κάρτες Σταθερότητα ──────────────────────────────────────────
  const hCrdStab = assessStability(hr6.sdCards, 'cards');
  const aCrdStab = assessStability(ar6.sdCards, 'cards');

  if(hCrdStab==='stable' && aCrdStab==='stable' &&
     (safeNum(hS.crd,0)+safeNum(aS.crd,0)) >= 5.5) {
    signals.push({
      type: 'cards_stable', strength: 'medium',
      icon: '🟨', color: 'var(--accent-gold)',
      title: 'Σταθερές Κάρτες — Υπέρ ΠΑΝΩ 5.5',
      text: `Αμφότερες παρουσιάζουν σταθερή τάση σε κάρτες. Ο μέσος όρος επιβεβαιώνει πόνταρισμα ΠΑΝΩ 5.5 καρτών.`,
    });
  }

  // ── Σήμα Volatility Alert (αποθάρρυνση) ─────────────────────────
  const hVolatile = (hGoalStab==='volatile'||hCorStab==='volatile'||hCrdStab==='volatile');
  const aVolatile = (aGoalStab==='volatile'||aCorStab==='volatile'||aCrdStab==='volatile');
  if(hVolatile && aVolatile) {
    signals.push({
      type: 'both_volatile', strength: 'warn',
      icon: '🌪️', color: 'var(--accent-red)',
      title: 'Αμοιβαία Αστάθεια — Υψηλό Ρίσκο',
      text: `Και οι δύο ομάδες παρουσιάζουν αστάθεια σε πολλές μεtrικές. Ο αγώνας είναι δύσκολα προβλέψιμος. Προτείνεται αποχή ή μικρό stake.`,
    });
  }

  return signals;
}

function renderStabilitySignals(rec) {
  const signals = computeStabilitySignals(rec);
  if(!signals.length) return '';

  return `<div style="margin-top:14px;">
    <div style="font-size:0.65rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📊 Σήματα Σταθερότητας</div>
    ${signals.map(s => `
    <div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:${s.strength==='warn'?'rgba(251,191,36,0.06)':s.strength==='strong'?'rgba(16,185,129,0.07)':'rgba(56,189,248,0.05)'};border:1px solid ${s.strength==='warn'?'rgba(251,191,36,0.25)':s.strength==='strong'?'rgba(16,185,129,0.25)':'rgba(56,189,248,0.2)'};border-radius:8px;margin-bottom:6px;">
      <span style="font-size:1.1rem;flex-shrink:0;">${s.icon}</span>
      <div style="flex:1;">
        <div style="font-size:0.75rem;font-weight:800;color:${s.color};margin-bottom:3px;">${esc(s.title)}</div>
        <div style="font-size:0.7rem;color:var(--text-muted);line-height:1.5;">${esc(s.text)}</div>
      </div>
      ${s.strength==='strong'?`<span style="font-size:0.62rem;background:rgba(16,185,129,0.15);color:var(--accent-green);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:2px 8px;font-weight:700;white-space:nowrap;align-self:center;">ΙΣΧΥΡΟ</span>`:''}
    </div>`).join('')}
  </div>`;
}

window.resimulateMatches=function(){
  if(!window.scannedMatchesData.length)return;
  window.scannedMatchesData.forEach(d=>{
    if(!d.hS)return;
    const lp=getLeagueParams(d.leagueId);
    let hXG=Number(d.hS.fXG)*lp.mult, aXG=Number(d.aS.fXG)*lp.mult;
    // Re-apply H2H blend αν υπάρχει
    if(d.h2h){
      const h2hGames=d.h2h.homeWins+d.h2h.awayWins+d.h2h.draws;
      if(h2hGames>=4){const h2hAvg=parseFloat(d.h2h.h2hAvgGoals)||0,modelAvg=hXG+aXG;if(modelAvg>0&&h2hAvg>0){const scale=h2hAvg/modelAvg,blend=0.12;hXG=hXG*(1-blend)+(hXG*scale)*blend;aXG=aXG*(1-blend)+(aXG*scale)*blend;}}
    }
    // Re-apply injury factor (stored από το αρχικό scan — δεν ξανακαλεί API)
    const hFactor=d.hInjAdj?.factor??1.0, aFactor=d.aInjAdj?.factor??1.0;
    const hXGfinal=hXG*hFactor, aXGfinal=aXG*aFactor;
    const hDelta=hXGfinal-hXG, aDelta=aXGfinal-aXG;
    const tXG=hXGfinal+aXGfinal,btts=Math.min(hXGfinal,aXGfinal);
    const res=computePick(hXGfinal,aXGfinal,tXG,btts,lp,d.hS,d.aS);
    const htAnalysis=computeHTAnalysis(res.hExp,res.aExp,lp);
    Object.assign(d,{
      tXG,btts,hXGbase:hXG,aXGbase:aXG,hXGfinal,aXGfinal,
      hInjAdj:{...d.hInjAdj,adjXG:hXGfinal,delta:hDelta},
      aInjAdj:{...d.aInjAdj,adjXG:aXGfinal,delta:aDelta},
      htAnalysis,
      outPick:res.outPick,xgDiff:res.xgDiff,
      exact:`${res.hG}-${res.aG}`,exact2:`${res.hG2}-${res.aG2}`,exactConf:res.exactConf,
      omegaPick:res.omegaPick,strength:res.pickScore,reason:res.reason,
      hExp:res.hExp,aExp:res.aExp,pp:res.pp,
      lambdaTotal:res.lambdaTotal,cornerConf:res.cornerConf,expCor:res.expCor
    });
    // Re-adjust card probabilities με νέο xgDiff
    const cardCtx={xgDiff:res.xgDiff,leagueId:d.leagueId};
    if(d.hPlayers?.length) adjustPlayerCardProbs(d.hPlayers, d.aS, cardCtx);
    if(d.aPlayers?.length) adjustPlayerCardProbs(d.aPlayers, d.hS, cardCtx);
  });
  rebuildTopLists();renderTopSections();renderSummaryTable();showOk('Re-simulated!');
};

window.addEventListener('DOMContentLoaded',()=>{

  // ── Tooltip CSS ──────────────────────────────────────────────
  const tipStyle = document.createElement('style');
  tipStyle.textContent = `
    .acr {
      border-bottom: 1px dashed rgba(56,189,248,0.55);
      color: var(--accent-blue);
      cursor: help;
      font-weight: inherit;
      transition: opacity 0.15s;
    }
    .acr:hover { opacity: 0.75; }

    /* ── Αναβόσβησμα ισχυρής live σύστασης ── */
    @keyframes strongPulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); border-color: rgba(16,185,129,0.4); }
      50%      { box-shadow: 0 0 18px 4px rgba(16,185,129,0.35); border-color: rgba(16,185,129,0.9); }
    }
    .live-strong-signal {
      animation: strongPulse 1.8s ease-in-out infinite;
    }

    /* ── Αναλαμπή κειμένου για ισχυρές συστάσεις ── */
    @keyframes pickPulse {
      0%,100% { opacity: 1; }
      50%      { opacity: 0.65; }
    }
    .live-pick-pulse {
      animation: pickPulse 1.4s ease-in-out infinite;
    }

    /* ── Badge ισχυρής σύστασης ── */
    .live-strong-badge {
      display: inline-block;
      margin-top: 8px;
      font-size: 0.65rem;
      font-weight: 800;
      color: #000;
      background: var(--accent-green);
      padding: 3px 10px;
      border-radius: 10px;
      letter-spacing: 0.5px;
      animation: pickPulse 1.2s ease-in-out infinite;
    }

    /* ── Alert αλλαγής σήματος ── */
    @keyframes flipBlink {
      0%,100% { background: rgba(251,191,36,0.15); border-color: var(--accent-gold); }
      40%      { background: rgba(251,191,36,0.35); border-color: rgba(251,191,36,0.9); }
    }
    .live-flip-alert {
      background: rgba(251,191,36,0.15);
      border: 1px solid var(--accent-gold);
      border-radius: var(--radius-sm);
      padding: 10px 14px;
      font-size: 0.75rem;
      animation: flipBlink 0.9s ease-in-out 6;
    }

    /* ── Substitution flash animation ── */
    @keyframes subPulse {
      0%,100% { opacity:1; transform:scale(1); }
      50%      { opacity:0.5; transform:scale(1.3); }
    }
    .sub-flash-badge {
      font-size: 0.75rem;
      margin-left: 5px;
      display: inline-block;
      animation: subPulse 1.2s ease-in-out 3;
    }
    @keyframes flashCell {
      0%   { background: rgba(251,191,36,0.30); }
      100% { background: transparent; }
    }
    .cell-flash { animation: flashCell 2s ease-out forwards; }
    @keyframes flashRow {
      0%   { background: rgba(251,191,36,0.15); }
      100% { background: transparent; }
    }
    .row-flash { animation: flashRow 2.5s ease-out forwards; }
    #apex-tip {
      position: fixed;
      z-index: 999999;
      background: var(--bg-panel);
      border: 1px solid rgba(56,189,248,0.4);
      border-radius: 10px;
      padding: 12px 16px;
      max-width: 300px;
      min-width: 160px;
      font-size: 0.82rem;
      line-height: 1.55;
      color: var(--text-main);
      box-shadow: 0 10px 30px rgba(0,0,0,0.45), 0 0 0 1px rgba(56,189,248,0.08);
      pointer-events: none;
      display: none;
      font-family: var(--font-sans);
      backdrop-filter: blur(8px);
    }
    #apex-tip .tip-term {
      font-family: var(--font-mono);
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--accent-blue);
      margin-bottom: 5px;
      display: block;
    }
    #apex-tip .tip-full {
      color: var(--text-muted);
      font-size: 0.78rem;
      font-weight: 600;
      display: block;
      margin-bottom: 3px;
    }
    #apex-tip .tip-desc {
      color: var(--text-main);
    }
  `;
  document.head.appendChild(tipStyle);

  // ── Tooltip DOM element ──────────────────────────────────────
  const tipEl = document.createElement('div');
  tipEl.id = 'apex-tip';
  document.body.appendChild(tipEl);

  // ── Click handler (event delegation) ────────────────────────
  document.addEventListener('click', function(e) {
    const el = e.target.closest('.acr');
    if (!el) { tipEl.style.display = 'none'; return; }
    e.stopPropagation();

    const raw = el.dataset.tip || ACRONYM_DICT[el.textContent] || '';
    if (!raw) return;

    // Parse "TERM — Description" format
    const dashIdx = raw.indexOf(' — ');
    const termFull = dashIdx > -1 ? raw.slice(0, dashIdx) : el.textContent;
    const descText = dashIdx > -1 ? raw.slice(dashIdx + 3) : raw;

    tipEl.innerHTML =
      `<span class="tip-term">${el.textContent}</span>` +
      (termFull !== el.textContent ? `<span class="tip-full">${termFull}</span>` : '') +
      `<span class="tip-desc">${descText}</span>`;

    // Position: below the element, stay within viewport
    tipEl.style.display = 'block';
    const r = el.getBoundingClientRect();
    const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    let top = r.bottom + 8, left = r.left;
    if (left + tw > window.innerWidth - 12) left = window.innerWidth - tw - 12;
    if (left < 8) left = 8;
    if (top + th > window.innerHeight - 12) top = r.top - th - 8;
    tipEl.style.top  = top  + 'px';
    tipEl.style.left = left + 'px';
  });
  document.getElementById('pin')?.addEventListener('input',function(){
    if(this.value==='106014'){
      document.getElementById('auth').style.display='none';document.getElementById('app').style.display='block';
      loadSettings();loadBankroll();initCredits();updateAuditLeagueFilter();
      renderLeagueMods();
      window.loadBetJournal();
      // Bet Journal + Sheets config section
      const advSec=document.getElementById('advisorSection');
      if(advSec){
        // Sheets URL config panel
        const sheetsPanel=document.createElement('div');
        sheetsPanel.className='quant-panel';sheetsPanel.style.borderColor='rgba(52,211,153,0.3)';
        const savedUrl=localStorage.getItem(LS_SHEETS_URL)||'';
        sheetsPanel.innerHTML=`<div class="panel-title clickable" style="color:var(--accent-green);" onclick="togglePanel('sheetsCfgBody','sheetsCfgArrow')">
          <span>📊 Google Sheets Integration</span><span id="sheetsCfgArrow" class="arrow">▼</span>
        </div>
        <div id="sheetsCfgBody" style="display:none;">
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px;line-height:1.6;">
            Εισάγετε το Apps Script Web App URL για αυτόματο push στατιστικών μετά κάθε scan.<br>
            <a href="https://script.google.com" target="_blank" style="color:var(--accent-blue);font-size:0.75rem;">→ Google Apps Script</a>
          </div>
          <div class="toolbar">
            <div class="input-group" style="flex:3;"><label class="input-label">Apps Script URL</label>
              <input type="url" id="sheetsUrlInput" class="quant-input" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(savedUrl)}"></div>
            <button class="btn btn-primary" onclick="(()=>{const u=document.getElementById('sheetsUrlInput').value.trim();if(u){localStorage.setItem(LS_SHEETS_URL,u);showOk('Sheets URL αποθηκεύτηκε.');}else{localStorage.removeItem(LS_SHEETS_URL);showOk('Sheets URL αφαιρέθηκε.');}})()">💾 Αποθήκευση</button>
            <button class="btn btn-outline" onclick="pushToSheets(window.scannedMatchesData)" style="color:var(--accent-green);border-color:rgba(52,211,153,0.4);">▶ Push Now</button>
          </div>
          <div style="margin-top:14px;font-size:0.72rem;color:var(--text-muted);">
            <strong style="color:var(--text-main);">Apps Script (αντίγραψε στο Google Drive):</strong><br>
            <pre style="background:var(--bg-base);border:1px solid var(--border-light);border-radius:6px;padding:10px;font-size:0.65rem;overflow-x:auto;white-space:pre-wrap;line-height:1.5;">function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Sheet: Predictions
  var pred = ss.getSheetByName('προβλέψεις') || ss.insertSheet('προβλέψεις');
  if(pred.getLastRow()===0) pred.appendRow(['date','fixtureId','home','away','league','leagueId','pick','conf%','tXG','hXG','aXG','xgDiff','exact','htScore','pO25','pO35','pU25','pBTTS','cornerConf','ev%','kelly','sitFlags','hasLineup','hasInjury']);
  (data.predRows||[]).forEach(function(r){ pred.appendRow([r.date,r.fixtureId,r.home,r.away,r.league,r.leagueId,r.omegaPick,r.confidence,r.tXG,r.hXG,r.aXG,r.xgDiff,r.exactScore,r.htScore,r.pO25,r.pO35,r.pU25,r.pBTTS,r.cornerConf,r.ev,r.kelly,r.sitFlags,r.hasLineup,r.hasInjury]); });

  // Sheet: Team Stats
  var ts = ss.getSheetByName('team_stats') || ss.insertSheet('team_stats');
  if(ts.getLastRow()===0) ts.appendRow(['date','team','league','leagueId','isHome','fXG','fXGA','sXG','formRating','avgCorners','avgCards','shotsOn','shotsOff','sdGoals_6','sdCorners_6','sdCards_6','sdGoals_sea','seaPlayed']);
  (data.teamRows||[]).forEach(function(r){ ts.appendRow([r.date,r.team,r.league,r.leagueId,r.isHome,r.fXG,r.fXGA,r.sXG,r.formRating,r.avgCorners,r.avgCards,r.shotsOn,r.shotsOff,r.sdGoals_6,r.sdCorners_6,r.sdCards_6,r.sdGoals_sea,r.seaPlayed]); });

  return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
}</pre>
          </div>
        </div>`;
        advSec.appendChild(sheetsPanel);
        // Bet Journal section
        const bjSection=document.createElement('div');bjSection.id='betJournalSection';
        advSec.appendChild(bjSection);
        renderBetJournal();
      }
      // League filter with country
      const sel=document.getElementById('leagueFilter');
      if(sel&&typeof LEAGUES_DATA!=='undefined'){LEAGUES_DATA.forEach(l=>{if(![...sel.options].some(o=>o.value==l.id))sel.innerHTML+=`<option value="${l.id}">${l.name}</option>`;});}
      // Build Live Tracker Panel in advisorSection (reuse advSec from above)
      if(advSec&&!document.getElementById('liveTrackerBody')){
        const ltPanel=document.createElement('div');
        ltPanel.className='quant-panel';ltPanel.style.borderColor='rgba(16,185,129,0.5)';
        ltPanel.innerHTML=`<div class="panel-title clickable" style="color:var(--accent-green);" onclick="togglePanel('liveTrackerBody','liveTrackerArrow')">
          <span style="display:flex;align-items:center;gap:10px;">
            <span id="liveStatusDot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--accent-red);flex-shrink:0;transition:background 0.3s,box-shadow 0.3s;"></span>
            📡 Live Tracker — In-Play Signal Monitor
            <span id="liveMatchCount" style="font-family:var(--font-mono);font-size:0.75rem;background:rgba(16,185,129,0.15);color:var(--accent-green);padding:2px 8px;border-radius:10px;border:1px solid rgba(16,185,129,0.3);">0</span>
            <span style="font-size:0.65rem;color:var(--text-muted);">live now</span>
          </span>
          <span id="liveTrackerArrow" class="arrow">▼</span>
        </div>
        <div id="liveTrackerBody" style="display:none;">
          <div class="toolbar" style="margin-bottom:16px;">
            <div class="input-group" style="flex:2;"><label class="input-label">Πρωταθλήματα</label>
              <select id="liveTrackerLeague" class="quant-input">
                <option value="MY_LEAGUES">⭐ MY LEAGUES</option>
                <option value="ALL">🌐 All Top Leagues</option>
                ${(typeof LEAGUES_DATA!=='undefined'?LEAGUES_DATA:[]).map(l=>`<option value="${l.id}">${l.name}</option>`).join('')}
              </select>
            </div>
            <button id="liveStartBtn" class="btn btn-primary" onclick="startLiveTracker()" style="height:38px;background:var(--accent-green);border-color:var(--accent-green);color:#000;font-weight:800;">▶ Start</button>
            <button id="liveStopBtn" class="btn btn-outline" onclick="stopLiveTracker()" style="height:38px;" disabled>⏹ Stop</button>
            <div style="display:flex;flex-direction:column;justify-content:center;gap:2px;">
              <div style="font-size:0.65rem;color:var(--text-muted);">Status: <span id="liveTrackerStatus" style="color:var(--accent-blue);">Inactive</span></div>
              <div style="font-size:0.65rem;color:var(--text-muted);">Last poll: <span id="liveTrackerLastPoll" style="font-family:var(--font-mono);">—</span></div>
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
        </div>`;
        advSec.prepend(ltPanel);
      }
      // Load saved live alerts
      try{const la=JSON.parse(localStorage.getItem(LS_LIVE_ALERTS));if(Array.isArray(la))liveAlerts=la;}catch{}
    }
  });
  const today=todayISO();const ss=document.getElementById('scanStart'),se=document.getElementById('scanEnd');if(ss)ss.value=today;if(se)se.value=today;
  const d15=new Date();d15.setDate(d15.getDate()-15);const as=document.getElementById('auditStart'),ae=document.getElementById('auditEnd');if(as)as.value=d15.toISOString().split('T')[0];if(ae)ae.value=today;
});
