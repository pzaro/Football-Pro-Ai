// app.js - UI & FLOW

const esc = str => String(str ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));
const todayISO = () => new Date().toISOString().split('T')[0];

window.updateCreditsDisplay = function(val) {
  const el = document.getElementById('creditDisplay');
  if(el) el.textContent = val;
};

async function runScan() {
  if(isRunning) return;
  isRunning = true;
  const feed = document.getElementById('matchesFeed');
  const loader = document.getElementById('loader');
  const bar = document.getElementById('bar');
  
  loader.style.display = 'block';
  feed.innerHTML = ''; 
  window.scannedMatchesData = [];

  try {
    const date = document.getElementById('scanStart').value;
    const res = await apiReq(`fixtures?date=${date}`);
    const matches = (res.response || []).filter(m => LEAGUE_IDS.includes(m.league.id));

    for(let i=0; i < matches.length; i++) {
      const m = matches[i];
      const pct = ((i+1)/matches.length)*100;
      bar.style.width = pct + '%';
      document.getElementById('status').textContent = `Ανάλυση: ${m.teams.home.name}...`;

      const hS = await window.buildIntel(m.teams.home.id, m.league.id, m.league.season);
      const aS = await window.buildIntel(m.teams.away.id, m.league.id, m.league.season);
      
      const result = window.computePick(hS, aS, engineConfig);

      if(result.pick !== "NO BET") {
        const cardHTML = `
          <div class="match-card">
            <div class="match-league">${esc(m.league.name)}</div>
            <div style="display:flex; justify-content:space-between; padding:10px 0;">
              <div class="team-name">${esc(m.teams.home.name)}</div>
              <div class="score-display">${result.hG} - ${result.aG}</div>
              <div class="team-name" style="text-align:right;">${esc(m.teams.away.name)}</div>
            </div>
            <div class="signal-box signal-hit">
              <div class="signal-value">${result.pick}</div>
              <div class="signal-desc">Πιθανότητα: ${result.strength.toFixed(1)}% | xG: ${(hS.fXG + aS.fXG).toFixed(2)}</div>
            </div>
          </div>`;
        feed.insertAdjacentHTML('beforeend', cardHTML);
      }
    }
    document.getElementById('status').textContent = "Η σάρωση ολοκληρώθηκε!";
  } catch(e) {
    document.getElementById('status').textContent = "Σφάλμα κατά τη σάρωση.";
  } finally {
    isRunning = false;
    loader.style.display = 'none';
  }
}

// LOGIN & INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
  const pinInput = document.getElementById('pin');
  pinInput.addEventListener('input', function() {
    if(this.value === "106014") {
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      // Αρχικοποίηση Credits
      apiReq('status').then(d => {
        const rem = d.response?.requests?.limit_day - d.response?.requests?.current;
        window.updateCreditsDisplay(rem || 100);
      });
    }
  });

  document.getElementById('scanStart').value = todayISO();
  document.getElementById('btnPre').onclick = runScan;
});
