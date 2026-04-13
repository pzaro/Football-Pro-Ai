const todayISO = () => new Date().toISOString().split('T')[0];
const esc = str => String(str ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));

window.updateCreditsDisplay = function(val) { document.getElementById('creditDisplay').textContent = val; };

async function runScan() {
  if(isRunning) return; isRunning = true;
  document.getElementById('loader').style.display = 'block';
  const feed = document.getElementById('matchesFeed'); feed.innerHTML = '';

  try {
    const res = await apiReq(`fixtures?date=${document.getElementById('scanStart').value}`);
    const matches = (res.response || []).filter(m => LEAGUE_IDS.includes(m.league.id)).slice(0, 10);
    for(let m of matches) {
      document.getElementById('status').textContent = `Ανάλυση: ${m.teams.home.name}...`;
      const hS = await window.buildIntel(m.teams.home.id, m.league.id, m.league.season);
      const aS = await window.buildIntel(m.teams.away.id, m.league.id, m.league.season);
      const resPick = window.computePick(hS, aS, engineConfig);
      feed.insertAdjacentHTML('beforeend', window.getMatchCardHTML({...resPick, ht:m.teams.home.name, at:m.teams.away.name, lg:m.league.name}));
    }
  } catch(e) { console.error(e); }
  finally { isRunning = false; document.getElementById('loader').style.display = 'none'; }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('pin').addEventListener('input', function() {
    if(this.value === "106014") {
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      apiReq('status').then(d => window.updateCreditsDisplay(d.response?.requests?.limit_day - d.response?.requests?.current || 100));
    }
  });
  document.getElementById('scanStart').value = todayISO();
  document.getElementById('btnPre').onclick = runScan;
});
