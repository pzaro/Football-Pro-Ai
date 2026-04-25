const API_BASE = "https://v3.football.api-sports.io";
let API_KEY = "956cbd05f9e9bf934df78d9b72d9a3a0";

const LS_SETTINGS = "omega_settings_v5.0";
const LS_BANKROLL = "omega_bankroll_v5.0";

let teamStatsCache = new Map(), lastFixCache = new Map(), standCache = new Map();
let isRunning = false, currentCredits = null;
window.scannedMatchesData = [];
let bankrollData = { current: 0, history: [] };

const engineConfig = {
  wShotsOn:0.14, wShotsOff:0.04, wCorners:0.02, wGoals:0.20,
  tXG_O25:2.70, tXG_O35:3.25, tXG_U25:1.80, tBTTS_U25:0.65,
  xG_Diff:0.55, tBTTS:1.10, modGold:1.15, minCorners: 10.5, minCards: 5.8
};

// --- Utilities ---
const safeNum = (x, d=0) => Number.isFinite(Number(x)) ? Number(x) : d;
const clamp = (n,mn,mx) => Math.max(mn, Math.min(mx, n));
const getTeamGoals = (f,t) => f?.teams?.home?.id===t?(f?.goals?.home??0):(f?.goals?.away??0);
const getOppGoals = (f,t) => f?.teams?.home?.id===t?(f?.goals?.away??0):(f?.goals?.home??0);
const isLive = s => ["1H","2H","HT","LIVE"].includes(s);
const isFinished = s => ["FT","AET","PEN"].includes(s);
const esc = str => String(str??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const todayISO = () => new Date().toISOString().split('T')[0];

// --- API Logic ---
async function apiReq(path) {
  try {
    const r = await fetch(`${API_BASE}/${path}`, { headers: { 'x-apisports-key': API_KEY, 'Accept': 'application/json' } });
    const d = await r.json();
    if (d.response && typeof currentCredits === 'number') {
      currentCredits--; document.getElementById('creditDisplay').textContent = currentCredits;
    }
    return d;
  } catch (e) { return { response: [] }; }
}

async function initCredits() {
  const d = await apiReq('status');
  currentCredits = (d.response?.requests?.limit_day || 500) - (d.response?.requests?.current || 0);
  document.getElementById('creditDisplay').textContent = currentCredits;
}

// --- Data Fetching ---
async function getTStats(t,lg,s){const k=`${t}_${lg}_${s}`;if(teamStatsCache.has(k))return teamStatsCache.get(k);const d=await apiReq(`teams/statistics?team=${t}&league=${lg}&season=${s}`);teamStatsCache.set(k,d?.response||{});return d?.response||{};}
async function getLFix(t,lg,s){const k=`${t}_${lg}_${s}`;if(lastFixCache.has(k))return lastFixCache.get(k);const d=await apiReq(`fixtures?team=${t}&league=${lg}&season=${s}&last=20&status=FT`);lastFixCache.set(k,d?.response||[]);return d?.response||[];}
async function getStand(lg,s){const k=`${lg}_${s}`;if(standCache.has(k))return standCache.get(k);const d=await apiReq(`standings?league=${lg}&season=${s}`);const f=Array.isArray(d?.response?.[0]?.league?.standings)?d.response[0].league.standings.flat():[];standCache.set(k,f);return f;}

// --- Math Engines ---
function poissonProb(lambda, k) {
  if(lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for(let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function getPoissonProbabilities(hL, aL) {
  let pHome=0, pDraw=0, pAway=0, pO25=0, pU25=0;
  let best = { h:1, a:1, prob: 0 };
  for(let h=0; h<=5; h++) {
    for(let a=0; a<=5; a++) {
      const p = poissonProb(hL, h) * poissonProb(aL, a);
      if(h>a) pHome+=p; else if(a>h) pAway+=p; else pDraw+=p;
      if(h+a > 2.5) pO25+=p; else pU25+=p;
      if(p > best.prob) best = { h, a, prob: p };
    }
  }
  return { pHome, pDraw, pAway, pO25, pU25, best };
}

// --- Intel Builder ---
async function buildIntel(tId, lg, s, isHome) {
  const [ss, allFix] = await Promise.all([getTStats(tId, lg, s), getLFix(tId, lg, s)]);
  const gen = allFix.slice(0, 6);
  let x=0, n=0;
  gen.forEach(f => { x += getTeamGoals(f, tId)*1.1; n++; });
  const fXG = n > 0 ? (x/n) : 1.35;
  return { 
    fXG, 
    uiXG: fXG.toFixed(2), 
    history: gen.map(f=>getTeamGoals(f,tId)>getOppGoals(f,tId)?'W':(getTeamGoals(f,tId)<getOppGoals(f,tId)?'L':'D')).reverse() 
  };
}

// --- Main Scan ---
window.runScan = async function() {
  if(isRunning) return; isRunning=true; setBtnsDisabled(true); setLoader(true, "Scanning...");
  window.scannedMatchesData = [];
  const start = document.getElementById('scanStart').value || todayISO();
  const res = await apiReq(`fixtures?date=${start}`);
  const filter = document.getElementById('leagueFilter').value;
  const matches = (res.response || []).filter(m => filter==='ALL' ? LEAGUE_IDS.includes(m.league.id) : MY_LEAGUES_IDS.includes(m.league.id));

  for (let i=0; i<matches.length; i++) {
    const m = matches[i];
    setProgress(((i+1)/matches.length)*100, `Analyzing ${m.teams.home.name}`);
    const [hS, aS, stand] = await Promise.all([buildIntel(m.teams.home.id, m.league.id, m.league.season, true), buildIntel(m.teams.away.id, m.league.id, m.league.season, false), getStand(m.league.id, m.league.season)]);
    
    const lpMult = GOLD_LEAGUES.has(m.league.id) ? engineConfig.modGold : 1.0;
    const hL = hS.fXG * lpMult;
    const aL = aS.fXG * lpMult;
    const pp = getPoissonProbabilities(hL, aL);
    
    window.scannedMatchesData.push({ m, ht:m.teams.home.name, at:m.teams.away.name, hS, aS, hL, aL, pp, tXG: hL+aL });
  }
  renderSummaryTable(); setLoader(false); setBtnsDisabled(false); isRunning=false;
};

// --- UI Rendering & Accordion ---
window.toggleMatchDetails = id => {
  const el = document.getElementById('details-'+id);
  if(el) el.style.display = el.style.display==='none' ? 'block' : 'none';
};

function renderSummaryTable() {
  let html = `<div class="data-table-wrapper"><table class="summary-table"><thead><tr><th>Match</th><th>xG</th><th>Poisson O2.5</th><th>Best Score</th></tr></thead><tbody>`;
  window.scannedMatchesData.forEach(d => {
    html += `<tr onclick="toggleMatchDetails('${d.m.fixture.id}')" style="cursor:pointer">
      <td class="left-align"><strong>${d.ht} - ${d.at}</strong></td>
      <td class="data-num">${d.tXG.toFixed(2)}</td>
      <td class="data-num">${(d.pp.pO25*100).toFixed(1)}%</td>
      <td class="data-num">${d.pp.best.h}-${d.pp.best.a}</td>
    </tr>
    <tr id="details-${d.m.fixture.id}" style="display:none; background:rgba(0,0,0,0.2)">
      <td colspan="4" style="padding:20px">
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-box-title">Form xG Analysis</div>
            <div class="stat-row"><span>Home Form xG:</span><span class="stat-val">${d.hS.uiXG}</span></div>
            <div class="stat-row"><span>Away Form xG:</span><span class="stat-val">${d.aS.uiXG}</span></div>
          </div>
          <div class="stat-box">
            <div class="stat-box-title">Probabilities</div>
            <div class="stat-row"><span>Home Win:</span><span>${(d.pp.pHome*100).toFixed(1)}%</span></div>
            <div class="stat-row"><span>Away Win:</span><span>${(d.pp.pAway*100).toFixed(1)}%</span></div>
          </div>
        </div>
      </td>
    </tr>`;
  });
  document.getElementById('summarySection').innerHTML = html + `</tbody></table></div>`;
}

// --- PIN Logic ---
document.getElementById('pin').addEventListener('input', function() {
  if(this.value === "106014") {
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    initCredits();
  }
});

function setLoader(s,t){ document.getElementById('loader').style.display=s?'block':'none'; document.getElementById('status').textContent=t; }
function setProgress(p,t){ document.getElementById('bar').style.width=p+'%'; document.getElementById('status').textContent=t; }
function setBtnsDisabled(d){ document.getElementById('btnPre').disabled=d; }
function openBankroll(){ document.getElementById('bankrollModal').style.display='flex'; }
function closeBankroll(){ document.getElementById('bankrollModal').style.display='none'; }
function saveBankroll(){ const v=document.getElementById('bankrollInput').value; bankrollData.current=parseFloat(v); document.getElementById('bankrollDisplay').textContent='€'+v; closeBankroll(); }
