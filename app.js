// app.js - UI & CREDIT MANAGEMENT

// UTILS
const clamp = (n, mn, mx) => Math.max(mn, Math.min(mx, n));
const isLive = s => ["1H","2H","HT","LIVE","ET","BT","P"].includes(s);
const isFinished = s => ["FT","AET","PEN"].includes(s);
const todayISO = () => new Date().toISOString().split('T')[0];
const esc = str => String(str ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));

function getDatesInRange(s, e) {
  const d = []; let c = new Date(s), end = new Date(e);
  while(c <= end) { d.push(c.toISOString().split('T')[0]); c.setDate(c.getDate()+1); }
  return d;
}

// CREDITS
window.initCredits = async function() {
  try {
    const res = await fetch(`${API_BASE}/status`, { headers: { 'x-apisports-key': API_KEY } });
    const data = await res.json();
    if (data.response?.requests?.current !== undefined) {
      currentCredits = (data.response.requests.limit_day || 100) - data.response.requests.current;
    } else {
        const subRes = await fetch(`${API_BASE}/subscription`, { headers: { 'x-apisports-key': API_KEY } });
        const subData = await subRes.json();
        currentCredits = subData.response?.quota_remaining ?? 100;
    }
  } catch { currentCredits = 100; }
  finally { window.updateCreditsDisplay(currentCredits); }
};

window.updateCreditsDisplay = function(val) {
  const el = document.getElementById('creditDisplay');
  if (el) { el.textContent = val ?? '—'; if (val < 100) el.classList.add('low'); else el.classList.remove('low'); }
};

window.updateCredits = function(newVal) {
  currentCredits = newVal; window.updateCreditsDisplay(newVal);
};

// UI CONTROL
function togglePanel(pId, aId) {
  const p = document.getElementById(pId), a = document.getElementById(aId);
  if (p.style.display === 'none') { p.style.display = 'block'; if (a) a.innerText = '▲'; }
  else { p.style.display = 'none'; if (a) a.innerText = '▼'; }
}

function setLoader(show, text='') {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = show ? 'block' : 'none';
  const status = document.getElementById('status');
  if (status) status.textContent = text;
}

function setProgress(pct, text='') {
  const bar = document.getElementById('bar');
  if (bar) bar.style.width = Math.round(clamp(pct, 0, 100)) + '%';
  const status = document.getElementById('status');
  if (status) status.textContent = text + (window._apiActiveCount > 0 ? ` [${window._apiActiveCount} active]` : '');
}

function setBtnsDisabled(d) { ["btnPre","leagueFilter","auditLeague"].forEach(id => { const el = document.getElementById(id); if(el) el.disabled = d; }); }
function showErr(msg) { const b = document.getElementById('errorBox'); if(b) { b.innerHTML = `<div>⚠️ ${esc(msg)}</div>`; setTimeout(() => b.innerHTML = '', 8000); } }
function showOk(msg) { const b = document.getElementById('successBox'); if(b) { b.innerHTML = `<div>✓ ${esc(msg)}</div>`; setTimeout(() => b.innerHTML = '', 4000); } }
function flashElement(el) { if(!el) return; const old = el.style.background; el.style.background = 'rgba(14, 165, 233, 0.2)'; setTimeout(() => el.style.background = old, 800); }

// SETTINGS & BANKROLL
function loadSettings() {
  try { const s = JSON.parse(localStorage.getItem(LS_SETTINGS)); if(s) engineConfig = {...DEFAULT_SETTINGS, ...s}; } catch {}
  syncUIFromSettings(); 
  const modBody = document.getElementById('leagueModBody');
  if(modBody) buildLeagueModTable();
}
function syncUIFromSettings() { for(const [id, key] of Object.entries(SETTINGS_MAP)) { const el = document.getElementById(id); if(el) el.value = engineConfig[key]; } }
function saveSettings() {
  for(const [id, key] of Object.entries(SETTINGS_MAP)) { const v = parseFloat(document.getElementById(id).value); if(!isNaN(v)) engineConfig[key] = v; }
  localStorage.setItem(LS_SETTINGS, JSON.stringify(engineConfig)); showOk("Settings Saved!");
}
function loadBankroll() { try { const b = JSON.parse(localStorage.getItem(LS_BANKROLL)); if(b) bankrollData = b; } catch {} updateBankrollDisplay(); }
function updateBankrollDisplay() { const el = document.getElementById('bankrollDisplay'); if(el) el.textContent = bankrollData.current > 0 ? `€${bankrollData.current.toFixed(2)}` : 'Set'; }

// SCANNER
async function runScan() {
  if(isRunning) return;
  const start = document.getElementById('scanStart').value, end = document.getElementById('scanEnd').value;
  isRunning = true; setBtnsDisabled(true); setLoader(true, 'Starting...');
  window.scannedMatchesData = [];
  
  try {
    const dates = getDatesInRange(start, end);
    let allMatches = [];
    for(const d of dates) {
      const res = await apiReq(`fixtures?date=${d}`);
      allMatches.push(...(res.response || []));
    }
    
    allMatches = allMatches.filter(m => LEAGUE_IDS.includes(m.league.id)).slice(0, 50);

    for(let i=0; i<allMatches.length; i++) {
        const m = allMatches[i];
        setProgress((i/allMatches.length)*100, `Analyzing ${m.teams.home.name}...`);
        const hS = await buildIntel(m.teams.home.id, m.league.id, m.league.season, true);
        const aS = await buildIntel(m.teams.away.id, m.league.id, m.league.season, false);
        const lp = { mult: 1.0, xgDiff: engineConfig.xG_Diff, minXGO25: engineConfig.tXG_O25, minBTTS: engineConfig.tBTTS };
        const res = computePick(hS.fXG, aS.fXG, hS.fXG+aS.fXG, Math.min(hS.fXG, aS.fXG), 10, 4, lp, hS, aS, null);
        
        window.scannedMatchesData.push({
            fixId: m.fixture.id, ht: m.teams.home.name, at: m.teams.away.name, lg: m.league.name,
            omegaPick: res.omegaPick, strength: res.pickScore, tXG: hS.fXG+aS.fXG, m: m
        });
    }
    renderSummaryTable(); filterFeed(); showOk("Scan Complete!");
  } catch(e) { showErr(e.message); }
  finally { isRunning = false; setLoader(false); setBtnsDisabled(false); }
}

function renderSummaryTable() {
    const sec = document.getElementById('summarySection');
    if(sec) sec.innerHTML = `<div class="quant-panel">Summary Ready: ${window.scannedMatchesData.length} matches</div>`;
}

function filterFeed() {
    const feed = document.getElementById('matchesFeed');
    if(feed) feed.innerHTML = window.scannedMatchesData.map(d => getMatchCardHTML(d)).join('');
}

// INIT
window.addEventListener('DOMContentLoaded', () => {
  const pinInput = document.getElementById('pin');
  if(pinInput) {
    pinInput.addEventListener('input', function() {
      if(this.value === "106014") {
        document.getElementById('auth').style.display = 'none';
        document.getElementById('app').style.display  = 'block';
        window.initCredits(); loadSettings(); loadBankroll();
      }
    });
  }
  document.getElementById('scanStart').value = todayISO();
  document.getElementById('scanEnd').value   = todayISO();
});
