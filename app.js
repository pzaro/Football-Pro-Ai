// app.js - UI & CREDIT MANAGEMENT
const clamp = (n, mn, mx) => Math.max(mn, Math.min(mx, n));
const todayISO = () => new Date().toISOString().split('T')[0];
const esc = str => String(str ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));

function getDatesInRange(s, e) {
  const d = []; let c = new Date(s), end = new Date(e);
  while(c <= end) { d.push(c.toISOString().split('T')[0]); c.setDate(c.getDate()+1); }
  return d;
}

window.initCredits = async function() {
  try {
    const res = await fetch(`${API_BASE}/status`, { headers: { 'x-apisports-key': API_KEY } });
    const data = await res.json();
    if (data.response?.requests?.current !== undefined) {
      currentCredits = (data.response.requests.limit_day || 100) - data.response.requests.current;
    }
  } catch { currentCredits = 100; }
  finally { window.updateCreditsDisplay(currentCredits); }
}

window.updateCreditsDisplay = function(val) {
  const el = document.getElementById('creditDisplay');
  if (el) el.textContent = val ?? '—';
}

window.updateCredits = function(newVal) {
  currentCredits = newVal; window.updateCreditsDisplay(newVal);
}

function setProgress(pct, text='') {
  const bar = document.getElementById('bar');
  if (bar) bar.style.width = Math.round(clamp(pct, 0, 100)) + '%';
  const status = document.getElementById('status');
  if (status) status.textContent = text;
}

async function runScan() {
  if(isRunning) return;
  isRunning = true;
  document.getElementById('loader').style.display = 'block';
  window.scannedMatchesData = [];
  
  try {
    const dates = getDatesInRange(document.getElementById('scanStart').value, document.getElementById('scanEnd').value);
    for(const d of dates) {
      const res = await apiReq(`fixtures?date=${d}`);
      const matches = (res.response || []).filter(m => LEAGUE_IDS.includes(m.league.id)).slice(0, 20);
      
      for(let i=0; i<matches.length; i++) {
        const m = matches[i];
        setProgress((i/matches.length)*100, `Analyzing ${m.teams.home.name}...`);
        const hS = await buildIntel(m.teams.home.id, m.league.id, m.league.season, true);
        const aS = await buildIntel(m.teams.away.id, m.league.id, m.league.season, false);
        const resPick = computePick(hS.fXG, aS.fXG, hS.fXG+aS.fXG, Math.min(hS.fXG, aS.fXG), {mult:1.0, minXGO25:2.7, minBTTS:1.1});
        
        window.scannedMatchesData.push({
          fixId: m.fixture.id, ht: m.teams.home.name, at: m.teams.away.name, lg: m.league.name,
          omegaPick: resPick.omegaPick, strength: resPick.pickScore, tXG: hS.fXG+aS.fXG, m: m
        });
      }
    }
    document.getElementById('matchesFeed').innerHTML = window.scannedMatchesData.map(d => getMatchCardHTML(d)).join('');
  } catch(e) { console.error(e); }
  finally { isRunning = false; document.getElementById('loader').style.display = 'none'; }
}

window.addEventListener('DOMContentLoaded', () => {
  const pinInput = document.getElementById('pin');
  pinInput.addEventListener('input', function() {
    if(this.value === "106014") {
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').style.display  = 'block';
      window.initCredits();
    }
  });
});
