// ==========================================================================
// APEX OMEGA v5.5 — MASTER ENGINE · BEST 4 + RADAR EDITION
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
  // ── Βασικοί δείκτες xG ────────────────────────────────────────
  '1X2':      '1X2 — Αγορά αποτελέσματος: 1=νίκη γηπεδούχου, X=ισοπαλία, 2=νίκη φιλοξενούμενου',
  'AH':       'Asian Handicap — Χάντικαπ: η ομάδα ξεκινά με εικονικό μειονέκτημα. AH -1.5 = νίκη με ≥2 γκολ',
  'BTTS':     'Both Teams To Score — Και οι δύο ομάδες να σκοράρουν ≥1 γκολ (= Γκολ/Γκολ)',
  'O2.5':     'Over 2.5 — Σύνολο γκολ αγώνα ≥ 3',
  'O3.5':     'Over 3.5 — Σύνολο γκολ αγώνα ≥ 4',
  'U2.5':     'Under 2.5 — Σύνολο γκολ αγώνα ≤ 2',
  'HT':       'Half-Time — Πρόβλεψη 1ου ημιχρόνου. Χρησιμοποιεί league-specific λ factor + home advantage +2.5%',
  'FT':       'Full-Time — Τελικό αποτέλεσμα (90 λεπτά)',

  // ── xG οικογένεια ─────────────────────────────────────────────
  'xG':       'Expected Goals (Αναμενόμενα Γκολ) — Πιθανότητα (0-1) κάθε σουτ να γίνει γκολ, βάσει θέσης, γωνίας, είδους πάσας. Πιο αξιόπιστο από πραγματικά γκολ για πρόβλεψη επόμενου ματς.',
  'tXG':      'Total xG (Συνολικά Αναμενόμενα Γκολ) — hXG + aXG. Ο "Βασιλιάς" για Over/Under.\n• tXG <2.20 → Under 2.5\n• tXG >2.80 → Over 2.5\n• tXG >3.40 → Over 3.5',
  'xGA':      'xG Against (Αναμενόμενα Γκολ Κατά) — Πόσο επικίνδυνες ευκαιρίες επιτρέπει η ομάδα. Χαμηλό xGA = εξαιρετική άμυνα, ακόμα κι αν έχει δεχτεί γκολ από τύχη.',
  'xG%':      'xG Contribution % — Ποσοστό συνεισφοράς παίκτη στο team xG βάσει GAP (Γκολ + 0.4×Ασίστ)',
  'xG Adj':   'xG Adjusted — Διορθωμένο xG μετά αφαίρεση τραυματισμένων παικτών. Εμφανίζεται σε χρυσό',
  'xG Diff':  'xG Difference (Διαφορά xG) — hXG minus aXG.\n• Θετικό (+0.85): φαβορί η γηπεδούχος\n• Αρνητικό (-1.10): φαβορί η φιλοξενούμενη\n• Κοντά στο 0 (±0.15): ισορροπημένο, μυρίζει X ή GG\nΤο calibration βρίσκει το ελάχιστο xG Diff ανά πρωτάθλημα για ασφαλές σήμα.',

  // ── Στατιστικοί δείκτες ───────────────────────────────────────
  'Conf%':    'Confidence % (Βεβαιότητα Μοντέλου) — Βαθμολογία 0-99% από τις Poisson πιθανότητες.\n• <70%: "ΧΩΡΙΣ ΣΥΣΤΑΣΗ"\n• 70-75%: καλό σήμα\n• >75%: ισχυρό σήμα ("Διαμάντι")',
  'D-C':      'Dixon-Coles Correction — Στατιστική διόρθωση Poisson για χαμηλά σκορ (0-0, 1-0, 0-1, 1-1) με ρ=-0.13. Κάνει τις προβλέψεις Under/Ισοπαλία πιο ρεαλιστικές.',
  'GAP':      'Goal-Assist Points — Γκολ + 0.4×Ασίστ. Composite δείκτης επιθετικής συνεισφοράς παίκτη',
  'H2H':      'Head-to-Head — Ιστορικές απευθείας αναμετρήσεις. 12% blend στο λ του μοντέλου',
  'INJ':      'Injury flag — Τραυματισμένοι παίκτες με σημαντική επίπτωση στο xG (delta < −0.05)',
  'Card%':    'Card Probability % — Πιθανότητα κίτρινης κάρτας: 1−e^(−κάρτες/εμφανίσεις). Poisson μοντέλο',
  'Adj🟨%':   'Adjusted Card % — Διορθωμένη πιθανότητα κάρτας: συνυπολογίζει επιθετικότητα αντιπάλου, αγωνιστική ένταση (xG Diff), league type. ▲=αυξημένος, ▼=μειωμένος κίνδυνος',

  // ── Volatility ────────────────────────────────────────────────
  'Volatility': 'Volatility (Αστάθεια σ) — Τυπική Απόκλιση επιδόσεων τελευταίων αγώνων.\n• STABLE ▼: ομαδα με σταθερή απόδοση → αξιόπιστη πρόβλεψη\n• VOLATILE ▲: μεγάλη διακύμανση (6 γκολ, μετά 0) → αποφυγή σε 1X2\n• HIGH VOL ⚡: επικίνδυνο για στοιχηματισμό',

  // ── Live δείκτες ─────────────────────────────────────────────
  'SQD':      'Shot Quality Differential (Διαφορά Ποιότητας Ευκαιριών) — (Live xG_H/Shots_H) - (Live xG_A/Shots_A).\nΑποκαλύπτει τη "φλύαρη" πίεση:\n• Ομάδα Α: 10 shots, 0.50 xG = 0.05 ανά shot\n• Ομάδα Β: 3 shots, 0.60 xG = 0.20 ανά shot\n→ Ομάδα Β είναι 4× πιο επικίνδυνη!\nSQD >+0.06 = καθαρές φάσεις (τετ-α-τετ). Ποντάρουμε ΠΑΝΤΑτην ομάδα με καλύτερο SQD.',
  'MSI':      'Momentum Shift Index (Δείκτης Μετατόπισης Κυριαρχίας) — Συγκρίνει Live xG share με Pre-match expected share.\nΑν περιμέναμε η HOME να έχει 60% και live έχει 35% → MSI=-25%. Τεράστιο σήμα κινδύνου! Προτείνει στοίχημα κόντρα στο φαβορί ή Cash Out.',
  'Edge':     'Live Edge Score — Composite δείκτης live πλεονεκτήματος: SoT ratio×50% + SQD×30% + GK pressure×20%. >58%=HOME κυριαρχεί, <42%=AWAY κυριαρχεί.',

  // ── Value & Money management ──────────────────────────────────
  'EV%':      'Expected Value % (Αναμενόμενη Αξία) — (Πιθανότητα μοντέλου × Απόδοση book) − 1.\nΠ.χ. μοντέλο δίνει 60%, book δίνει 1.90 → EV% = (0.60×1.90)−1 = +14%.\nΠαίζουμε ΜΟΝΟ θετικό EV (πράσινο). Μακροπρόθεσμα κερδοφόρο.',
  'Kelly':    'Kelly Criterion (Κριτήριο Kelly) — Μαθηματικός τύπος: ποντάρεις ακριβώς το σωστό ποσό βάσει bankroll & EV%.\nΤο APEX χρησιμοποιεί Fractional Kelly 25% — χρυσή τομή: μεγιστοποιείς κέρδη χωρίς χρεοκοπία σε κακό σερί.',
  'Vault':    'Vault — LocalStorage αποθήκη ιστορικών προβλέψεων που τροφοδοτεί το Audit & Auto-Calibration',

  // ── Engine παράμετροι ─────────────────────────────────────────
  'xG Mult':  'xG Multiplier (Πολλαπλασιαστής) — Συντελεστής ανά πρωτάθλημα που βαθμονομεί τα "ωμά" xG.\n• Mult >1.0 (π.χ. Bundesliga 1.12): επιθετικό πρωτάθλημα, τα xG υποεκτιμούν\n• Mult <1.0 (π.χ. Serie A 0.95): αμυντικό, τα xG υπερεκτιμούν\nΡυθμίζεται αυτόματα από το Grid Search Auto-Calibration.',
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
  constructor(maxSize=120, defaultTtlMs=Infinity){
    this._map=new Map(); this._max=maxSize; this._ttl=defaultTtlMs;
  }
  _isExpired(entry){return !!entry && Number.isFinite(entry.expiresAt) && Date.now()>=entry.expiresAt;}
  has(k){
    const e=this._map.get(k);
    if(!e)return false;
    if(this._isExpired(e)){this._map.delete(k);return false;}
    return true;
  }
  get(k){
    const e=this._map.get(k);
    if(!e)return undefined;
    if(this._isExpired(e)){this._map.delete(k);return undefined;}
    this._map.delete(k); this._map.set(k,e); // LRU touch
    return e.value;
  }
  set(k,v,ttlMs=this._ttl){
    if(this._map.has(k))this._map.delete(k);
    else if(this._map.size>=this._max)this._map.delete(this._map.keys().next().value);
    const expiresAt=Number.isFinite(ttlMs)?Date.now()+Math.max(0,ttlMs):Infinity;
    this._map.set(k,{value:v,expiresAt});
    return v;
  }
  delete(k){this._map.delete(k);}
  clear(){this._map.clear();}
  get size(){
    for(const [k,e] of this._map){if(this._isExpired(e))this._map.delete(k);}
    return this._map.size;
  }
}

const CACHE_TTL = Object.freeze({
  TEAM_STATS:      6*60*60*1000,   // team statistics: αργή μεταβολή
  LAST_FIXTURES:   15*60*1000,     // πρόσφατα FT fixtures
  STANDINGS:       60*60*1000,     // standings ~ hourly
  H2H:             12*60*60*1000,  // historical
  LEAGUE_PLAYERS:  60*60*1000,     // scorers / assists / cards
  INJURIES:        2*60*60*1000,
  LIVE_STATS:      45*1000,
  LINEUPS:         5*60*1000,
  FIXTURE_STATS:   12*60*60*1000,  // χρησιμοποιείται κυρίως σε finished recent matches
  ODDS:            30*1000,
  FIXTURE_DAY:     45*1000
});

let teamStatsCache = new BoundedCache(180, CACHE_TTL.TEAM_STATS),
    lastFixCache   = new BoundedCache(180, CACHE_TTL.LAST_FIXTURES),
    standCache     = new BoundedCache(80,  CACHE_TTL.STANDINGS),
    h2hCache       = new BoundedCache(240, CACHE_TTL.H2H),
    scorersCache   = new BoundedCache(80,  CACHE_TTL.LEAGUE_PLAYERS),
    assistsCache   = new BoundedCache(80,  CACHE_TTL.LEAGUE_PLAYERS),
    cardsCache     = new BoundedCache(80,  CACHE_TTL.LEAGUE_PLAYERS),
    injuryCache    = new BoundedCache(240, CACHE_TTL.INJURIES),
    liveStatsCache = new BoundedCache(80,  CACHE_TTL.LIVE_STATS),
    lineupsCache   = new BoundedCache(140, CACHE_TTL.LINEUPS);  // starting XI per fixture
let isRunning = false, currentCredits = null;
let latestTopLists = { best4:[], radar:[], exact:[], combo1:[], outcomes:[], over25:[], over35:[], under25:[], corners:[], offsides:[], bombs:[], players:[], valueBets:[] };
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
const LS_MY_LEAGUES      = 'omega_my_leagues_v5.0';

// ── Dynamic My Leagues ────────────────────────────────────────────────────────
// Επιστρέφει τα επιλεγμένα πρωταθλήματα του χρήστη.
// Προτεραιότητα: localStorage > hardcoded default από leagues.js
function getUserMyLeagues() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_MY_LEAGUES));
    if(Array.isArray(saved) && saved.length > 0) return saved.map(Number);
  } catch {}
  return typeof MY_LEAGUES_IDS !== 'undefined' ? [...MY_LEAGUES_IDS] : [78,88,218,119,103,144,253,262,140,135,197];
}
function saveUserMyLeagues(ids) {
  try { localStorage.setItem(LS_MY_LEAGUES, JSON.stringify(ids.map(Number))); } catch {}
}
// Override runtime: MY_LEAGUES_IDS → χρησιμοποιείται παντού για φιλτράρισμα
function getActiveMyLeagues() { return getUserMyLeagues(); }

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
  // tXG thresholds — βασίζονται σε Poisson ανάλυση για στόχους 75%+:
  // P(O2.5)=62% απαιτεί tXG≥3.1 | P(O3.5)=52% απαιτεί tXG≥3.8
  tXG_O25:3.10,  tXG_O35:3.80,   tXG_U25:1.80,  tBTTS_U25:0.65,
  // xG_Diff >= 0.65 → P(home)~53% (ελάχιστο edge) | tBTTS >= 1.20 → αμφότερες ομάδες ≥1.2 xG
  xG_Diff:0.65,  tBTTS:1.20,     modTrap:0.90,  modTight:0.95,  modGold:1.12,
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
const _apiInflight = new Map();
const _apiResponseCache = new BoundedCache(300, 30*1000);
let _apiDrainTimer = null;
let _nextRequestAt = 0;
let _globalBackoffUntil = 0;

// Adaptive limiter: ξεκινά με ασφαλές Pro-like pace και αυτορυθμίζεται
// από τα X-RateLimit-* headers κάθε πραγματικής API απόκρισης.
const API_RATE = {
  minuteLimit: null,
  minuteRemaining: null,
  dailyLimit: null,
  dailyRemaining: null,
  baseRps: 4.5,
  penalty: 1.0,
  maxConcurrent: 4,
  detected: false,
  last429At: 0,
  lastLatencyMs: null
};

const sleep = ms => new Promise(r=>setTimeout(r,Math.max(0,ms||0)));
const apiClamp = (v,min,max)=>Math.max(min,Math.min(max,v));
function _headerNum(headers,name){
  const raw=headers?.get?.(name);
  if(raw===null||raw===undefined||raw==='')return null;
  const n=Number(raw); return Number.isFinite(n)?n:null;
}
function _effectiveRps(){return apiClamp(API_RATE.baseRps*API_RATE.penalty,0.12,18);}
function _effectiveGapMs(){
  let gap=1000/_effectiveRps();
  if(API_RATE.minuteLimit && API_RATE.minuteRemaining!==null){
    const ratio=API_RATE.minuteRemaining/Math.max(1,API_RATE.minuteLimit);
    if(ratio<0.03)gap*=4;
    else if(ratio<0.08)gap*=2.2;
    else if(ratio<0.15)gap*=1.4;
  }
  return Math.ceil(gap);
}
function _updateApiRateFromHeaders(headers){
  const mLimit=_headerNum(headers,'X-RateLimit-Limit');
  const mRemain=_headerNum(headers,'X-RateLimit-Remaining');
  const dLimit=_headerNum(headers,'x-ratelimit-requests-limit');
  const dRemain=_headerNum(headers,'x-ratelimit-requests-remaining');
  if(mLimit && mLimit>0){
    API_RATE.minuteLimit=mLimit;
    API_RATE.baseRps=apiClamp((mLimit/60)*0.90,0.12,18); // 10% safety margin
    API_RATE.maxConcurrent=API_RATE.baseRps<1 ? 1 : apiClamp(Math.ceil(API_RATE.baseRps*0.75),2,10);
    API_RATE.detected=true;
  }
  if(mRemain!==null)API_RATE.minuteRemaining=mRemain;
  if(dLimit!==null)API_RATE.dailyLimit=dLimit;
  if(dRemain!==null){
    API_RATE.dailyRemaining=dRemain; currentCredits=dRemain;
    const el=document.getElementById('creditDisplay');
    if(el){
      el.textContent=dRemain;
      el.className='credit-value'+(dRemain<50?' low':'');
      const lim=API_RATE.minuteLimit?`${API_RATE.minuteLimit}/min`:'adaptive';
      el.title=`API online · ${lim} · target ${_effectiveRps().toFixed(1)} req/s`;
    }
  }
}
function _scheduleDrain(delay=0){
  if(_apiDrainTimer!==null)return;
  _apiDrainTimer=setTimeout(()=>{_apiDrainTimer=null;_drainQueue();},Math.max(0,Math.ceil(delay)));
}
function _priorityValue(v){return v==='high'||v===0?0:v==='low'||v===2?2:1;}

// Backward-compatible diagnostics aliases (dynamic values)
Object.defineProperty(window,'APEX_API_RATE',{get:()=>({...API_RATE,effectiveRps:_effectiveRps(),gapMs:_effectiveGapMs(),queue:_apiQueue.length,active:_apiActive})});
let _errTimer = null, _okTimer = null;

// ================================================================
//  VERSION & BUILD INFO
// ================================================================
const APP_VERSION   = 'v5.3';
const BUILD_DATE    = '05/09/2026';
const BUILD_TIME    = 'ADAPTIVE API';
const BUILD_LABEL   = `${APP_VERSION} · ${BUILD_DATE} ${BUILD_TIME}`;
function updateLastCalibBadge(ts) {
  const el = document.getElementById('lastCalibBadge');
  if(el && ts) { el.textContent = `⚡ Τελ. Βαθμονόμηση: ${ts}`; el.style.display = 'inline-block'; }
}

// ── Glossary Modal ────────────────────────────────────────────────
const GLOSSARY_GROUPS = [
  { label:'Βασικοί Δείκτες xG', badge:null,      keys:['xG','tXG','xGA','xG%','xG Adj','xG Diff'] },
  { label:'Αγορές & Αποτελέσματα', badge:null,   keys:['1X2','AH','BTTS','O2.5','O3.5','U2.5','HT','FT'] },
  { label:'Στατιστικοί Δείκτες', badge:null,     keys:['Conf%','D-C','GAP','H2H','INJ','Card%','Adj🟨%'] },
  { label:'Live Δείκτες', badge:'live',           keys:['SQD','MSI','Edge','Volatility'] },
  { label:'Engine & Calibration', badge:'engine', keys:['xG Mult','Vault','LRU'] },
  { label:'Value & Χρήματα', badge:'money',       keys:['RADAR','EV%','Kelly'] },
];

// ── Εννοιολογικός Πίνακας — όλοι οι δείκτες με ερμηνεία & action ──
const CONCEPT_TABLE = [
  // [Δείκτης, Τι μετράει, Καλή τιμή, Σήμα / Τι κάνεις]
  // ── xG ──────────────────────────────────────────────────────
  ['xG','Ποιότητα επίθεσης (Αναμ. Γκολ)','> 1.50','Πάνω ≥1.50: ισχυρή επίθεση → Over / 1X2'],
  ['xGA','Ποιότητα άμυνας (Αναμ. Γκολ κατά)','< 1.20','Κάτω <1.20: ισχυρή άμυνα → Under / Νίκη'],
  ['tXG','Συνολικά Αναμ. Γκολ (HOME+AWAY)','2.5–3.5','<2.20 → Under 2.5 | >2.80 → Over 2.5 | >3.40 → Over 3.5'],
  ['xG Diff','Διαφορά επιθετικής ισχύος','>0.60 ή <-0.60','|Diff|>0.60 → 1X2 σήμα | ~0 → Ισοπαλία / BTTS'],
  ['xG Mult','Πολλαπλασιαστής ανά πρωτάθλημα','1.00 (standard)','GOLD×1.12 | Standard×1.00 | TIGHT×0.95 | TRAP×0.90'],
  // ── Αγορές ──────────────────────────────────────────────────
  ['Conf%','Βεβαιότητα μοντέλου (0-99%)','≥70%','<70%: ΧΩΡΙΣ ΣΥΣΤΑΣΗ | 70-79%: Καλό | ≥80%: Ισχυρό'],
  ['O2.5','P(Σύνολο γκολ ≥3)','≥62%','≥62% + tXG≥2.80 → ΠΑΝΩ ΑΠΟ 2.5'],
  ['O3.5','P(Σύνολο γκολ ≥4)','≥52%','≥52% + tXG≥3.40 → ΠΑΝΩ ΑΠΟ 3.5'],
  ['U2.5','P(Σύνολο γκολ ≤2)','≥58%','≥58% + tXG≤1.80 → ΚΑΤΩ ΑΠΟ 2.5'],
  ['BTTS','P(Αμφότερες να σκοράρουν)','≥68%','≥68% + min(hXG,aXG)≥1.10 → GG'],
  ['AH','Asian Handicap -1.5','≥42%','≥42% + |xgDiff|≥0.90 → Handicap νίκη με 2+'],
  ['HT','Πρώτο ημίχρονο προβάδισμα','≥48%','≥48% + xgDiff≥0.80 → Ημιτελικό'],
  // ── Κόρνερ & Κάρτες ─────────────────────────────────────────
  ['Κόρνερ λ','Αναμ. κόρνερ ανά αγώνα','9.0–12.0','<8.5: Under corners | >10.5: Over 8.5 Cor (≥72%)'],
  ['P(>8.5 Cor)','Poisson P(κόρνερ ≥9)','≥72%','≥72%: ΠΑΝΩ ΑΠΟ 8.5 ΚΟΡΝΕΡ σήμα'],
  ['Card% 🟨','Adj. πιθανότητα κίτρινης','> 20%','Μόνο παίκτες >20% εμφανίζονται στο Card Risk'],
  ['Κάρτες λ','Αναμ. κάρτες ανά αγώνα','≥5.5','≥5.5 + |xgDiff|<0.40 → ΠΑΝΩ ΑΠΟ 5.5 ΚΑΡΤΕΣ'],
  // ── Οφσάιντ ─────────────────────────────────────────────────
  ['Offside λ','Αναμ. οφσάιντ ανά αγώνα HOME','1.8–2.5 (HOME), 1.5–2.0 (AWAY)','λ×Poisson → P(≥1), P(≥2), P(≥3) — για bet builder'],
  ['P(≥2 off)','P(ομάδα με ≥2 οφσάιντ)','≥65%','Αξιόπιστο σήμα αν λ>2.0 | AWAY λ χαμηλότερο από HOME'],
  ['P(αμφ. ≥2)','P(ΚΑΙ οι δύο ≥2 οφσάιντ)','≥40%','Χρήσιμο για bet builder combo'],
  // ── Live ────────────────────────────────────────────────────
  ['SQD','xG/Shot Differential — ποιότητα φάσεων','>+0.04','Θετικό → HOME καλύτερες φάσεις | Αρνητικό → AWAY'],
  ['Edge','Composite Live Score (SoT×50%+SQD×30%+GK×20%)','> 58% ή < 42%','>58%: HOME κυριαρχεί | <42%: AWAY κυριαρχεί | 42-58%: Ισόρροπο'],
  ['SoT Ratio','Shots on Target αναλογία','> 60%','Ο πιο αξιόπιστος live predictor (r>0.65 με outcome)'],
  ['GK Saves','Σεβές τερματοφύλακα — κρυφή πίεση','> 2','>2: η αντίπαλη ομάδα ασκεί πίεση που δεν φαίνεται στο σκορ'],
  // ── Volatility ───────────────────────────────────────────────
  ['σ (sigma)','Τυπική απόκλιση επιδόσεων','< 0.8','<0.8: STABLE ▼ αξιόπιστο | >1.2: VOLATILE ▲ αποφυγή'],
  ['ΔΕ₉₅','Διάστημα Εμπιστοσύνης 95%','Στενό εύρος','Πλατύ ΔΕ = αστάθεια = μειωμένος σταθμός Kelly'],
  // ── H2H & Form ───────────────────────────────────────────────
  ['H2H','Ιστορικές απευθείας αναμετρήσεις','≥4 ματς','12% blend στο λ | <4 ματς: αγνοείται'],
  ['Φόρμα','Τελευταία 5-6 ματς (W/D/L)','≥3W τελευταία 5','Βάρη: W1×1.0, W2×0.82, W3×0.67, W4×0.54, W5×0.43'],
  // ── Value ────────────────────────────────────────────────────
  ['RADAR','Composite superiority ranking — καθαρή υπεροχή σήματος','Score ≥72','1/X/2: probability gap+xG | Goals: Poisson+tXG | Corners: P>8.5 | Offsides: Poisson signal'],
  ['EV%','Expected Value = (P×Απόδοση)−1','> 0%','+5%: αξιόπιστο | +10%: εξαιρετικό | <0%: ΜΗΝ παίξεις'],
  ['Kelly','Βέλτιστο ποσό στοιχήματος','Fractional 25%','APEX χρησιμοποιεί Kelly/4 — μεγιστοποιεί χωρίς χρεοκοπία'],
  // ── Calibration ──────────────────────────────────────────────
  ['GOLD','Επιθετικό πρωτάθλημα (mult×1.12)','—','Bundesliga, Eredivisie, MLS, Jupiler Pro, Austrian BL'],
  ['TIGHT','Αμυντικό πρωτάθλημα (mult×0.95)','—','Serie A, La Liga, Super League GR, Champions League, Ligue 1'],
  ['TRAP','Αστάθεια / Δύσκολο (mult×0.90)','—','Championship, League One, 2. Bundesliga, Segunda División'],
  ['CL/EL Cal.','Βαθμονόμηση από 280 ματς','—','CL: mult×0.88, minO25:2.20 | EL: mult×0.90, minO25:2.35'],
];

window.openGlossary = function() {
  const modal = document.getElementById('glossaryModal');
  const content = document.getElementById('glossaryContent');
  if(!modal || !content) return;

  // ── Tab state ─────────────────────────────────────────────────
  let activeTab = 'glossary';

  const renderGlossary = () => GLOSSARY_GROUPS.map(group => {
    const badgeHtml = group.badge
      ? `<span class="gloss-badge ${group.badge}">${group.badge==='live'?'🟢 LIVE':group.badge==='engine'?'⚙️ ENGINE':'💰 VALUE'}</span>`
      : '';
    const items = group.keys.map(key => {
      const desc = ACRONYM_DICT[key];
      if(!desc) return '';
      return `<div class="gloss-item">
        <div class="gloss-term">${key}</div>
        <div class="gloss-desc">${desc.replace(/\\n/g,'\n')}</div>
      </div>`;
    }).filter(Boolean).join('');
    return `<div style="margin-bottom:16px;">
      <div style="font-size:0.65rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;font-family:var(--font-cond);margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid rgba(255,255,255,0.06);">
        ${group.label}${badgeHtml}
      </div>
      ${items}
    </div>`;
  }).join('');

  const renderConceptTable = () => {
    // Group rows by category
    const cats = [
      { label:'📐 xG & Μοντέλο', rows: CONCEPT_TABLE.filter(r=>['xG','xGA','tXG','xG Diff','xG Mult'].includes(r[0])) },
      { label:'🎯 Αγορές & Σήματα', rows: CONCEPT_TABLE.filter(r=>['Conf%','O2.5','O3.5','U2.5','BTTS','AH','HT'].includes(r[0])) },
      { label:'🚩 Κόρνερ & Κάρτες', rows: CONCEPT_TABLE.filter(r=>r[0].includes('Κόρνερ')||r[0].includes('Κάρτες')||r[0].includes('Card%')||r[0].includes('P(>8')) },
      { label:'🚫 Οφσάιντ', rows: CONCEPT_TABLE.filter(r=>r[0].includes('Offside')||r[0].includes('off')||r[0].includes('αμφ')) },
      { label:'📡 Live', rows: CONCEPT_TABLE.filter(r=>['SQD','Edge','SoT Ratio','GK Saves'].includes(r[0])) },
      { label:'📉 Volatility & Φόρμα', rows: CONCEPT_TABLE.filter(r=>['σ (sigma)','ΔΕ₉₅','H2H','Φόρμα'].includes(r[0])) },
      { label:'💰 Value & Calibration', rows: CONCEPT_TABLE.filter(r=>['RADAR','EV%','Kelly','GOLD','TIGHT','TRAP','CL/EL Cal.'].includes(r[0])) },
    ];

    return cats.map(cat => `
      <div style="margin-bottom:18px;">
        <div style="font-size:0.66rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;font-family:var(--font-cond);margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid rgba(255,255,255,0.06);">${cat.label}</div>
        <table style="width:100%;border-collapse:collapse;font-size:0.72rem;">
          <thead>
            <tr style="border-bottom:1px solid var(--border-md);">
              <th style="text-align:left;padding:4px 8px 6px 0;color:var(--text-dim);font-weight:700;font-family:var(--font-cond);font-size:0.60rem;text-transform:uppercase;letter-spacing:0.08em;width:15%;">Δείκτης</th>
              <th style="text-align:left;padding:4px 8px 6px;color:var(--text-dim);font-weight:700;font-family:var(--font-cond);font-size:0.60rem;text-transform:uppercase;letter-spacing:0.08em;width:28%;">Τι μετράει</th>
              <th style="text-align:left;padding:4px 8px 6px;color:var(--text-dim);font-weight:700;font-family:var(--font-cond);font-size:0.60rem;text-transform:uppercase;letter-spacing:0.08em;width:20%;">Καλή τιμή</th>
              <th style="text-align:left;padding:4px 0 6px 8px;color:var(--text-dim);font-weight:700;font-family:var(--font-cond);font-size:0.60rem;text-transform:uppercase;letter-spacing:0.08em;width:37%;">Ερμηνεία / Ενέργεια</th>
            </tr>
          </thead>
          <tbody>
            ${cat.rows.map((r,i) => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.03);${i%2===1?'background:rgba(255,255,255,0.012)':''}">
              <td style="padding:6px 8px 6px 0;font-family:var(--font-mono);font-weight:700;color:var(--blue);font-size:0.68rem;vertical-align:top;">${r[0]}</td>
              <td style="padding:6px 8px;color:var(--text-sub);vertical-align:top;">${r[1]}</td>
              <td style="padding:6px 8px;font-family:var(--font-mono);color:var(--accent-green);font-size:0.68rem;vertical-align:top;">${r[2]}</td>
              <td style="padding:6px 0 6px 8px;color:var(--text-muted);vertical-align:top;font-size:0.68rem;">${r[3]}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');
  };

  const render = () => {
    content.innerHTML = `
      <!-- Tabs -->
      <div style="display:flex;gap:4px;margin-bottom:18px;background:var(--bg-surface);border-radius:8px;padding:3px;">
        <button onclick="window._glossTab('glossary')" id="gtab-glossary"
          style="flex:1;padding:7px 12px;border-radius:6px;border:none;cursor:pointer;font-family:var(--font-cond);font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;transition:all 0.15s;
          background:${activeTab==='glossary'?'var(--bg-raised)':'transparent'};color:${activeTab==='glossary'?'var(--text-main)':'var(--text-muted)'};">
          📚 Γλωσσάριο
        </button>
        <button onclick="window._glossTab('concepts')" id="gtab-concepts"
          style="flex:1;padding:7px 12px;border-radius:6px;border:none;cursor:pointer;font-family:var(--font-cond);font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;transition:all 0.15s;
          background:${activeTab==='concepts'?'var(--bg-raised)':'transparent'};color:${activeTab==='concepts'?'var(--text-main)':'var(--text-muted)'};">
          📊 Εννοιολογικός Πίνακας
        </button>
      </div>
      <!-- Content -->
      <div id="glossary-tab-content">
        ${activeTab==='glossary' ? renderGlossary() : renderConceptTable()}
      </div>`;
  };

  window._glossTab = (tab) => {
    activeTab = tab;
    render();
  };

  render();
  modal.classList.add('open');
};

window.closeGlossary = function() {
  document.getElementById('glossaryModal')?.classList.remove('open');
};

// Κλείσιμο με Escape
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') window.closeGlossary();
});

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

// ── Excel Export ─────────────────────────────────────────────────
window.exportExcel = function() {
  const data = window.scannedMatchesData;
  if(!data?.length) { showErr('Δεν υπάρχουν δεδομένα. Εκτέλεσε Scan πρώτα.'); return; }
  if(typeof XLSX === 'undefined') { showErr('Η βιβλιοθήκη Excel δεν έχει φορτωθεί ακόμα.'); return; }

  // Φίλτρο: μόνο ματς με σήμα (όχι ΧΩΡΙΣ ΣΥΣΤΑΣΗ)
  const withSignal = data.filter(d =>
    d.omegaPick && !d.omegaPick.includes('ΧΩΡΙΣ') && !d.omegaPick.includes('NO BET')
  );
  const allRows   = data; // για το δεύτερο sheet (όλα)

  // ── Helper: μορφοποίηση ──────────────────────────────────────
  const pct = v => v != null ? `${Number(v).toFixed(1)}%` : '—';
  const num = (v, d=1) => v != null ? Number(v).toFixed(d) : '—';
  const off = d => d.offside ? {
    hLambda: num(d.offside.hLambda),
    aLambda: num(d.offside.aLambda),
    totLambda: num(d.offside.totLambda),
    hPOff2: pct(d.offside.hPOff2),
    aPOff2: pct(d.offside.aPOff2),
    pBothOff2: pct(d.offside.pBothOff2),
  } : { hLambda:'—', aLambda:'—', totLambda:'—', hPOff2:'—', aPOff2:'—', pBothOff2:'—' };

  // ── Μετατροπή σε rows ────────────────────────────────────────
  const toRow = d => {
    const o = off(d);
    const hCorN = Number(d.hS?.cor || 5).toFixed(1);
    const aCorN = Number(d.aS?.cor || 5).toFixed(1);
    const totCorN = num(d.expCor);
    return {
      'Ημερομηνία':         d.m?.fixture?.date ? d.m.fixture.date.split('T')[0] : '—',
      'Πρωτάθλημα':         d.lg || '—',
      'Γηπεδούχος':         d.ht || '—',
      'Φιλοξενούμενος':     d.at || '—',
      'Σήμα (Pick)':        d.omegaPick || '—',
      'Σκορ Πρόβλεψη':      d.exact || '—',
      'Alt Σκορ':           d.exact2 || '—',
      'Conf%':              num(d.strength, 0) + '%',
      'tXG':                num(d.tXG, 2),
      'xG HOME':            num(d.hXGfinal, 2),
      'xG AWAY':            num(d.aXGfinal, 2),
      'xG Diff':            num(d.xgDiff, 2),
      'P(O2.5)':            d.pp ? pct(d.pp.pO25 * 100) : '—',
      'P(O3.5)':            d.pp ? pct(d.pp.pO35 * 100) : '—',
      'P(U2.5)':            d.pp ? pct(d.pp.pU25 * 100) : '—',
      'P(GG)':              d.pp ? pct(d.pp.pBTTS * 100) : '—',
      'Κόρνερ HOME (avg)':  hCorN,
      'Κόρνερ AWAY (avg)':  aCorN,
      'Κόρνερ Σύνολο':      totCorN,
      'P(Over 8.5 Cor)':    pct(d.cornerConf),
      'Οφσάιντ HOME (avg)': o.hLambda,
      'Οφσάιντ AWAY (avg)': o.aLambda,
      'Οφσάιντ Σύνολο':     o.totLambda,
      'P HOME ≥2 Οφσάιντ':  o.hPOff2,
      'P AWAY ≥2 Οφσάιντ':  o.aPOff2,
      'P Σύνολο ≥3':        d.offside?.pTotOff25 ?? '',
      'P Σύνολο ≥4':        d.offside?.pTotOff35 ?? '',
      'P Αμφότερες ≥1':     d.offside?.pBothOff1 ?? '',
      'Offside Signal':      d.offside?.bestSignal ?? '',
      'Offside Conf %':      d.offside?.bestProb ?? '',
      'P(HOME ≥2 Off)':     o.hPOff2,
      'P(AWAY ≥2 Off)':     o.aPOff2,
      'P(Αμφότερες ≥2 Off)':o.pBothOff2,
      'Κάρτες HOME (avg)':  num(d.hS?.crd, 1),
      'Κάρτες AWAY (avg)':  num(d.aS?.crd, 1),
      'H2H Ν-Ι-Η':         d.h2h ? `${d.h2h.homeWins}Ν-${d.h2h.draws}Ι-${d.h2h.awayWins}Η` : '—',
      'Θέση HOME (#)':      d.hr && d.hr<99 ? d.hr : '—',
      'Θέση AWAY (#)':      d.ar && d.ar<99 ? d.ar : '—',
    };
  };

  // ── Δημιουργία workbook ──────────────────────────────────────
  const wb = XLSX.utils.book_new();

  // Sheet 1: Ματς με σήμα
  if(withSignal.length) {
    const ws1 = XLSX.utils.json_to_sheet(withSignal.map(toRow));
    // Χρωματισμός header — column widths
    ws1['!cols'] = [
      {wch:12},{wch:20},{wch:22},{wch:22},{wch:26},{wch:12},{wch:10},
      {wch:8},{wch:7},{wch:9},{wch:9},{wch:8},
      {wch:9},{wch:9},{wch:9},{wch:9},
      {wch:14},{wch:14},{wch:14},{wch:14},
      {wch:16},{wch:16},{wch:14},{wch:13},{wch:13},{wch:18},
      {wch:14},{wch:14},{wch:12},{wch:12},{wch:12},
    ];
    XLSX.utils.book_append_sheet(wb, ws1, `Σήματα (${withSignal.length})`);
  }

  // Sheet 2: Όλα τα ματς
  const ws2 = XLSX.utils.json_to_sheet(allRows.map(toRow));
  ws2['!cols'] = [{wch:12},{wch:20},{wch:22},{wch:22},{wch:26},{wch:12},{wch:10},
    {wch:8},{wch:7},{wch:9},{wch:9},{wch:8},{wch:9},{wch:9},{wch:9},{wch:9},
    {wch:14},{wch:14},{wch:14},{wch:14},{wch:16},{wch:16},{wch:14},{wch:13},{wch:13},{wch:18},
    {wch:14},{wch:14},{wch:12},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws2, `Όλα (${allRows.length})`);

  // Sheet 3: Οδηγός κατηγοριών
  const guide = [
    {Κατηγορία:'⭐ GOLD',  'xG Mult':'×1.12', Χαρακτηριστικό:'Επιθετικό, πολλά γκολ, καλό Poisson fit',   'Καλύτερο για':'Over 2.5 · Over 3.5 · GG'},
    {Κατηγορία:'🔒 TIGHT', 'xG Mult':'×0.95', Χαρακτηριστικό:'Αμυντικό, λίγα γκολ, τακτικό ποδόσφαιρο',  'Καλύτερο για':'Under 2.5 · 1X2 · Σκορ'},
    {Κατηγορία:'⚠️ TRAP',  'xG Mult':'×0.90', Χαρακτηριστικό:'Υψηλή αστάθεια, μεγάλες ανατροπές',        'Καλύτερο για':'Αποφυγή — μόνο υψηλής conf.'},
    {Κατηγορία:'⚪ STD',   'xG Mult':'×1.00', Χαρακτηριστικό:'Ισορροπημένο, global ρυθμίσεις',            'Καλύτερο για':'Balanced — όλα τα σήματα'},
    {},
    {Κατηγορία:'Στήλη',   'xG Mult':'Περιγραφή', Χαρακτηριστικό:'', 'Καλύτερο για':''},
    {Κατηγορία:'Conf%',     'xG Mult':'Βεβαιότητα μοντέλου (≥70% = αξιόπιστο σήμα)', Χαρακτηριστικό:'',  'Καλύτερο για':''},
    {Κατηγορία:'tXG',       'xG Mult':'Συνολικά αναμενόμενα γκολ (HOME+AWAY)',         Χαρακτηριστικό:'',  'Καλύτερο για':''},
    {Κατηγορία:'P(O2.5)',   'xG Mult':'Poisson πιθανότητα Over 2.5 γκολ',             Χαρακτηριστικό:'',  'Καλύτερο για':''},
    {Κατηγορία:'P(GG)',     'xG Mult':'Poisson πιθανότητα Γκολ/Γκολ (BTTS)',          Χαρακτηριστικό:'',  'Καλύτερο για':''},
    {Κατηγορία:'P(HOME≥2)', 'xG Mult':'Πιθανότητα HOME να κάνει ≥2 οφσάιντ',          Χαρακτηριστικό:'',  'Καλύτερο για':''},
    {Κατηγορία:'P(Αμφ≥2)',  'xG Mult':'Πιθανότητα ΚΑΙ οι δύο ≥2 οφσάιντ (bet builder)', Χαρακτηριστικό:'','Καλύτερο για':''},
  ];
  const ws3 = XLSX.utils.json_to_sheet(guide);
  ws3['!cols'] = [{wch:16},{wch:42},{wch:42},{wch:32}];
  XLSX.utils.book_append_sheet(wb, ws3, 'Οδηγός');

  // ── Download ─────────────────────────────────────────────────
  const fname = `APEX_OMEGA_${todayISO()}.xlsx`;
  XLSX.writeFile(wb, fname);
  showOk(`📊 Excel exported: ${fname} (${withSignal.length} σήματα + ${allRows.length} συνολικά)`);
};
window.importData=function(ev){
  const file=ev.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const imported=JSON.parse(e.target.result);
      if(!Array.isArray(imported))throw new Error("Invalid format");
      window.scannedMatchesData=imported;

      // Αποθήκευση στο vault + ενημέρωση UI
      saveToVault(imported);
      rebuildTopLists();renderTopSections();renderSummaryTable();tickerRefresh();

      // Βρες με ΑΣΦΑΛΕΙΑ τις ημερομηνίες — είτε d.m.fixture.date είτε d.date
      const dates = imported.map(d => {
        const dt = d.m?.fixture?.date || d.date;
        return dt ? dt.split('T')[0] : null;
      }).filter(Boolean).sort();

      const startD = dates[0]              || todayISO();
      const endD   = dates[dates.length-1] || todayISO();

      syncAuditFromScan(imported, startD, endD);
      showOk(`✅ Import: ${imported.length} αγώνες φορτώθηκαν. Vault ενημερώθηκε.`);
    }catch(err){
      showErr("Σφάλμα αρχείου: " + err.message);
    }
    ev.target.value='';
  };
  reader.readAsText(file);
};

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
function getApiErrorMessage(data){
  const e=data?.errors;
  if(Array.isArray(e) && e.length) return e.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' | ');
  if(e && typeof e==='object' && Object.keys(e).length) return Object.entries(e).map(([k,v])=>`${k}: ${typeof v==='string'?v:JSON.stringify(v)}`).join(' | ');
  if(typeof e==='string' && e.trim()) return e.trim();
  return '';
}
async function apiReq(path,opts={}){
  const priority=_priorityValue(opts.priority);
  const cacheMs=Number(opts.cacheMs)||0;
  if(cacheMs>0){
    const cached=_apiResponseCache.get(path);
    if(cached!==undefined)return cached;
  }
  if(_apiInflight.has(path))return _apiInflight.get(path);

  let wrapped;
  const core=new Promise(resolve=>{
    _apiQueue.push({path,resolve,priority,cacheMs});
    _apiQueue.sort((a,b)=>a.priority-b.priority);
    _scheduleDrain(0);
  });
  wrapped=core.finally(()=>{if(_apiInflight.get(path)===wrapped)_apiInflight.delete(path);});
  _apiInflight.set(path,wrapped);
  return wrapped;
}

function _drainQueue(){
  if(!_apiQueue.length)return;
  const now=Date.now();
  const blockedUntil=Math.max(_nextRequestAt,_globalBackoffUntil);
  if(now<blockedUntil){_scheduleDrain(blockedUntil-now);return;}
  if(_apiActive>=API_RATE.maxConcurrent)return;

  const item=_apiQueue.shift();
  _apiActive++;
  _nextRequestAt=Date.now()+_effectiveGapMs();
  _executeRequest(item.path,item.resolve,item.cacheMs);

  // Launch επόμενο request μόνο όταν ανοίξει το επόμενο rate slot.
  if(_apiQueue.length && _apiActive<API_RATE.maxConcurrent)_scheduleDrain(_effectiveGapMs());
}

async function _executeRequest(path,resolve,cacheMs=0){
  const MAX_RETRIES=3;
  let resolved=false;
  try{
    for(let attempt=0;attempt<=MAX_RETRIES;attempt++){
      const globalWait=_globalBackoffUntil-Date.now();
      if(globalWait>0)await sleep(globalWait);

      const ctrl=new AbortController();
      const timeout=setTimeout(()=>ctrl.abort(),15000);
      const started=performance?.now?.() ?? Date.now();
      try{
        const r=await fetch(`${API_BASE}/${path}`,{
          headers:{'x-apisports-key':API_KEY,'Accept':'application/json'},
          signal:ctrl.signal
        });
        clearTimeout(timeout);
        API_RATE.lastLatencyMs=Math.round((performance?.now?.() ?? Date.now())-started);
        _updateApiRateFromHeaders(r.headers);

        if(r.ok){
          const data=await r.json();
          const apiErr=getApiErrorMessage(data);
          if(apiErr){
            console.error(`[APEX] API error on ${path}:`,apiErr);
            const out={...data,response:data?.response||[],__apiError:apiErr};
            resolve(out); resolved=true; return;
          }
          API_RATE.penalty=Math.min(1,API_RATE.penalty+0.03); // gradual recovery
          if(cacheMs>0)_apiResponseCache.set(path,data,cacheMs);
          resolve(data); resolved=true; return;
        }

        let body=null;
        try{body=await r.json();}catch{}
        const apiErr=getApiErrorMessage(body)||`HTTP ${r.status}`;

        if(r.status===429){
          API_RATE.last429At=Date.now();
          API_RATE.penalty=Math.max(0.45,API_RATE.penalty*0.72);
          const retryAfter=Number(r.headers.get('Retry-After'));
          const wait=Number.isFinite(retryAfter)&&retryAfter>0
            ? retryAfter*1000
            : Math.min(12000,1500*(2**attempt)+Math.random()*500);
          _globalBackoffUntil=Math.max(_globalBackoffUntil,Date.now()+wait);
          console.warn(`[APEX] 429 on ${path} — adaptive backoff ${Math.round(wait)}ms; target ${_effectiveRps().toFixed(1)} req/s`);
          if(attempt<MAX_RETRIES){await sleep(wait);continue;}
        }else if([499,500,502,503,504].includes(r.status) && attempt<MAX_RETRIES){
          const wait=600*(2**attempt)+Math.random()*300;
          await sleep(wait); continue;
        }

        resolve({...(body||{}),response:body?.response||[],__apiError:apiErr,__httpStatus:r.status});
        resolved=true; return;
      }catch(err){
        clearTimeout(timeout);
        const retryable=err?.name==='AbortError'||err instanceof TypeError;
        if(retryable && attempt<MAX_RETRIES){
          const wait=500*(2**attempt)+Math.random()*350;
          await sleep(wait); continue;
        }
        console.warn(`[APEX] Network error: ${path}`,err?.message||err);
        resolve({response:[],__apiError:`Network: ${err?.message||err}`}); resolved=true; return;
      }
    }
    if(!resolved){
      console.warn(`[APEX] Failed after ${MAX_RETRIES} retries: ${path}`);
      resolve({response:[],__apiError:'Request failed after retries'});
    }
  }finally{
    _apiActive=Math.max(0,_apiActive-1);
    _scheduleDrain(Math.max(0,Math.max(_nextRequestAt,_globalBackoffUntil)-Date.now()));
  }
}
window.initCredits=async function(){
  const el=document.getElementById('creditDisplay');
  if(el){el.textContent='SYNC…';el.className='credit-value';el.title='Έλεγχος API status…';}
  try{
    const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),7000);
    const r=await fetch(`${API_BASE}/status`,{headers:{'x-apisports-key':API_KEY,'Accept':'application/json'},signal:ctrl.signal});
    clearTimeout(timer);
    _updateApiRateFromHeaders(r.headers);
    if(!r.ok){
      if(el && currentCredits===null){el.textContent='STATUS ?';el.className='credit-value';el.title=`/status HTTP ${r.status} · το κύριο API θα ελεγχθεί στο scan`;}
      console.warn('[APEX] /status unavailable, main API may still work:',r.status);
      return false;
    }
    const d=await r.json();
    const apiErr=getApiErrorMessage(d);
    if(apiErr){
      if(el && currentCredits===null){el.textContent='STATUS ?';el.className='credit-value';el.title='Το /status επέστρεψε error · το scan θα ελέγξει το κύριο API';}
      console.warn('[APEX] API /status error:',apiErr);
      return false;
    }
    const lim=d.response?.requests?.limit_day;
    const cur=d.response?.requests?.current;
    if(Number.isFinite(Number(lim))&&Number.isFinite(Number(cur))){
      currentCredits=Number(lim)-Number(cur);
      if(el){el.textContent=currentCredits;el.className='credit-value'+(currentCredits<50?' low':'');el.title='API online';}
    }
    return true;
  }catch(err){
    // Το /status μπορεί να αποτύχει ενώ τα κανονικά endpoints λειτουργούν.
    // Δεν εμφανίζουμε πλέον παραπλανητικό OFFLINE.
    if(el && currentCredits===null){el.textContent='STATUS ?';el.className='credit-value';el.title='Το /status δεν απάντησε · το κύριο API θα ελεγχθεί στο πρώτο scan';}
    console.warn('[APEX] API /status unavailable:',err?.message||err);
    return false;
  }
};

async function getTStats(t,lg,s){
  const k=`${t}_${lg}_${s}`;
  if(teamStatsCache.has(k))return teamStatsCache.get(k);
  const d=await apiReq(`teams/statistics?team=${t}&league=${lg}&season=${s}`);
  const res=d?.response||{};
  teamStatsCache.set(k,res);
  return res;
}

async function getLFix(t,lg,s){
  const k=`${t}_${lg}_${s}`;
  if(lastFixCache.has(k))return lastFixCache.get(k);
  // Πρώτα: ζητά season=2026
  const d=await apiReq(`fixtures?team=${t}&league=${lg}&season=${s}&last=20&status=FT`);
  let res=d?.response||[];
  // Αν λίγα ματς στη σεζόν 2026 (αρχές σεζόν), παίρνουμε τα τελευταία 20 cross-season
  if(res.length<6){
    const d2=await apiReq(`fixtures?team=${t}&league=${lg}&last=20&status=FT`);
    const cross=d2?.response||[];
    if(cross.length>res.length) res=cross;
  }
  lastFixCache.set(k,res);
  return res;
}
async function getStand(lg,s){
  const k=`${lg}_${s}`;
  if(standCache.has(k))return standCache.get(k);
  const d=await apiReq(`standings?league=${lg}&season=${s}`);
  const f=Array.isArray(d?.response?.[0]?.league?.standings)?d.response[0].league.standings.flat():[];
  standCache.set(k,f);
  return f;
}
async function getH2H(t1,t2){const k=`${t1}_${t2}`;if(h2hCache.has(k))return h2hCache.get(k);const d=await apiReq(`fixtures/headtohead?h2h=${t1}-${t2}&last=8`);h2hCache.set(k,d?.response||[]);return d?.response||[];}

// 📋 LINEUPS per fixture (1 credit, cached until sub detected)
async function getFixtureLineups(fixtureId) {
  const k = String(fixtureId);
  if(lineupsCache.has(k)) return lineupsCache.get(k);
  const d = await apiReq(`fixtures/lineups?fixture=${fixtureId}`,{priority:'high'});
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
let fixStatsCache = new BoundedCache(260, CACHE_TTL.FIXTURE_STATS);

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

  let tXG=0,tXGA=0,tCor=0,tCorAgainst=0,tCrd=0,tShotsOn=0,tShotsOff=0,tOppShotsOn=0,tOff=0,tw=0;
  let nCor=0,nCrd=0,nShots=0,nOff=0;
  const goalsArr=[],goalsAgainstArr=[],cornersArr=[],cardsArr=[],offsidesArr=[];

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

      // Offsides
      const myOff=extractFixStatFor(st,tId,'Offsides');
      if(myOff!==null){tOff+=myOff*w;offsidesArr.push(myOff);nOff++;}
      else offsidesArr.push(isH?1.8:1.5); // fallback avg
    }else{
      // fallback simulated corners/cards (recency-weighted)
      const simCor=3.5+(myG*1.2)+(opG*0.3);
      const simCrd=1.5+(opG*0.8)+(myG*0.2);
      tCor+=simCor*w;tCrd+=simCrd*w;
      if(cornersArr.length===i)cornersArr.push(simCor);
      if(cardsArr.length===i)cardsArr.push(simCrd);
      const simOff=isH?1.8:1.5; // home teams avg more offsides
      tOff+=simOff*w;offsidesArr.push(simOff);
      nCor++;nCrd++;nOff++;
    }
  }

  const avgXG=tw>0?tXG/tw:1.10,avgXGA=tw>0?tXGA/tw:1.10;
  const avgCor=nCor>0?tCor/nCor:5.0,avgCorA=nCor>0?tCorAgainst/nCor:4.5;
  const avgCrd=nCrd>0?tCrd/nCrd:2.0;
  const avgSOn=nShots>0?tShotsOn/nShots:4.5,avgSOff=nShots>0?tShotsOff/nShots:3.5;
  const avgOppSOn=nShots>0?tOppShotsOn/nShots:4.0;
  const avgOff=nOff>0?tOff/nOff:1.8; // avg offsides per match
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
    off:parseFloat(avgOff.toFixed(2)), // avg offsides per match
    offsidesArr,
    goalsArr,goalsAgainstArr,cornersArr,cardsArr,
    varGoals:variance(goalsArr),sdGoals:stdDev(goalsArr),
    varGoalsAgainst:variance(goalsAgainstArr),sdGoalsAgainst:stdDev(goalsAgainstArr),
    varCorners:variance(cornersArr),sdCorners:stdDev(cornersArr),
    varCards:variance(cardsArr),sdCards:stdDev(cardsArr),
  };
}

function getFormHistory(fixtures,teamId){return fixtures.map(f=>{const my=getTeamGoals(f,teamId),op=getOppGoals(f,teamId);return my>op?{res:'W',cls:'W'}:my<op?{res:'L',cls:'L'}:{res:'D',cls:'D'};}).reverse();}
function getFormRating(hist){if(!hist?.length)return 50;const w=[1,0.8,0.6,0.4,0.2];let score=0,tw=0;hist.slice(0,5).forEach((h,i)=>{const wi=w[i]||0.1,pts=h.res==='W'?100:h.res==='D'?33:0;score+=pts*wi;tw+=wi;});return tw>0?Math.round(score/tw):50;}

// ── buildIntel cache — αποφεύγει duplicate calls για ίδια ομάδα ──
// Key: `${tId}_${lg}_${s}` — αποθηκεύει το Promise (όχι το result)
// ώστε παράλληλα requests για την ίδια ομάδα να μοιραστούν ένα call
const _buildIntelCache = new BoundedCache(80);
const _buildIntelPromises = new Map(); // dedup in-flight requests

async function buildIntel(tId,lg,s,isHome){
  const cacheKey = `${tId}_${lg}_${s}`;

  // Hit: έχουμε ήδη το result
  if(_buildIntelCache.has(cacheKey)) return _buildIntelCache.get(cacheKey);

  // In-flight dedup: αν τρέχει ήδη το ίδιο request, περίμενε το
  if(_buildIntelPromises.has(cacheKey)) return _buildIntelPromises.get(cacheKey);

  // Miss: νέο request
  const promise = _buildIntelImpl(tId, lg, s, isHome).then(result => {
    _buildIntelCache.set(cacheKey, result);
    _buildIntelPromises.delete(cacheKey);
    return result;
  }).catch(err => {
    _buildIntelPromises.delete(cacheKey);
    throw err;
  });

  _buildIntelPromises.set(cacheKey, promise);
  return promise;
}

async function _buildIntelImpl(tId,lg,s,isHome){
  try{
    // Άντληση δεδομένων σεζόν 2026 — cross-season fallback αν λίγα ματς
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

    // ── Bayesian regression to season mean ─────────────────────────
    // Το form xG (από last 6-8 αγώνες) μπορεί να είναι πολύ ακραίο.
    // Blendάρουμε υποχρεωτικά με τον season average για να αποτρέψουμε
    // υπερεκτίμηση σε hot/cold streaks.
    // Weight: n/(n+REG_N) → όσο περισσότερα fixtures, τόσο εμπιστευόμαστε form.
    // REG_N=8: με 8 αγώνες form = 50% trust, με 20 αγώνες = 71% trust.
    const REG_N = 8;
    const formN  = Math.min(fData.goalsArr?.length || 0, 8);
    const formW  = formN > 0 ? formN / (formN + REG_N) : 0.30;
    const seaW   = 1 - formW;

    const rawFormXG  = safeNum(fData.xg,  sXG);
    const rawFormXGA = safeNum(fData.xga, sXGA);
    // Cap: form xG δεν μπορεί να είναι >2× season avg (outlier protection)
    const cappedFormXG  = Math.min(rawFormXG,  sXG  * 2.2);
    const cappedFormXGA = Math.min(rawFormXGA, sXGA * 2.2);
    const blendedFXG  = formW * cappedFormXG  + seaW * sXG;
    const blendedFXGA = formW * cappedFormXGA + seaW * sXGA;

    const rawSFormXG = safeNum(sData.xg, sXG);
    const cappedSXG  = Math.min(rawSFormXG, sXG * 2.2);
    const blendedSXG = formW * cappedSXG + seaW * sXG;

    return{
      fXG:  clamp(blendedFXG,  0.40, 3.50),
      fXGA: clamp(blendedFXGA, 0.40, 3.50),
      sXG:  clamp(blendedSXG,  0.40, 3.50),
      formRating:getFormRating(getFormHistory(gen,tId)),
      corRatio:safeNum(fData.corRatio,0.40),cor:safeNum(fData.cor,5.0),corAgainst:safeNum(fData.corAgainst,4.5),
      shotsCor:safeNum(fData.shotsCor,0.22),crd:safeNum(fData.crd,2.0),
      shotsOn:safeNum(fData.shotsOn,4.5),shotsOff:safeNum(fData.shotsOff,3.5),oppShotsOn:safeNum(fData.oppShotsOn,4.0),
      off:safeNum(fData.off, isHome?1.8:1.5), // avg offsides per match
      uiXG:fData.xg,uiXGA:fData.xga,uiSXG:sData.xg,uiSXGA:sData.xga,
      history:getFormHistory(gen,tId),
      totalTeamGoalsSeason,
      // Last-6 variance (empirical)
      r6:{
        n:r6Data.goalsArr.length,
        sdGoals:r6Data.sdGoals,sdGoalsAgainst:r6Data.sdGoalsAgainst,
        sdCorners:r6Data.sdCorners,sdCards:r6Data.sdCards,
        varGoals:r6Data.varGoals,varCorners:r6Data.varCorners,varCards:r6Data.varCards,
        goalsArr:r6Data.goalsArr,goalsAgainstArr:r6Data.goalsAgainstArr,
        cornersArr:r6Data.cornersArr,cardsArr:r6Data.cardsArr,
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

// ── Βαθμονομημένες παράμετροι ανά πρωτάθλημα ─────────────────────
// Βασίζονται σε ανάλυση ~280 ματς σεζόν 2025-26
// CL avg 2.44 γκολ → χαμηλά thresholds | Προκριματικά avg 3.07 → κανονικά
const LEAGUE_CALIBRATED_PARAMS = {
  2:   { mult:0.88, minXGO25:2.20, minXGO35:3.10, xgDiff:0.55, minBTTS:1.05, maxU25:2.00 }, // Champions League
  3:   { mult:0.90, minXGO25:2.35, minXGO35:3.20, xgDiff:0.55, minBTTS:1.08, maxU25:2.00 }, // Europa League
  848: { mult:0.95, minXGO25:2.60, minXGO35:3.30, xgDiff:0.58, minBTTS:1.10, maxU25:1.90 }, // Conference League
  32:  { mult:0.95, minXGO25:2.60, minXGO35:3.30, xgDiff:0.58, minBTTS:1.10, maxU25:1.90 }, // WC Qualifiers UEFA
  34:  { mult:1.00, minXGO25:2.70, minXGO35:3.40, xgDiff:0.60, minBTTS:1.12, maxU25:1.85 }, // WC Qualifiers CONMEBOL
  1:   { mult:1.05, minXGO25:2.50, minXGO35:3.20, xgDiff:0.58, minBTTS:1.08, maxU25:1.90 }, // World Cup
};

function getLeagueParams(leagueId){
  const lm  = leagueMods[leagueId] || {};
  const cal = LEAGUE_CALIBRATED_PARAMS[leagueId] || {};
  // Calibrated defaults first, then league type, then global settings
  let defMult = cal.mult ?? (
    (typeof GOLD_LEAGUES !=='undefined'&&GOLD_LEAGUES.has(leagueId))  ? engineConfig.modGold  :
    (typeof TRAP_LEAGUES !=='undefined'&&TRAP_LEAGUES.has(leagueId))  ? engineConfig.modTrap  :
    (typeof TIGHT_LEAGUES!=='undefined'&&TIGHT_LEAGUES.has(leagueId)) ? engineConfig.modTight : 1.00
  );
  let defDiff = cal.xgDiff   ?? (TIGHT_LEAGUES?.has(leagueId) ? 0.35 : GOLD_LEAGUES?.has(leagueId) ? 0.65 : engineConfig.xG_Diff);
  let defO25  = cal.minXGO25 ?? engineConfig.tXG_O25;
  let defO35  = cal.minXGO35 ?? engineConfig.tXG_O35;
  let defU25  = cal.maxU25   ?? engineConfig.tXG_U25;
  let defBTTS = cal.minBTTS  ?? engineConfig.tBTTS;
  return {
    mult:     lm.mult     ?? defMult,
    minXGO25: lm.minXGO25 ?? defO25,
    minXGO35: lm.minXGO35 ?? defO35,
    maxU25:   lm.maxU25   ?? defU25,
    minBTTS:  lm.minBTTS  ?? defBTTS,
    xgDiff:   lm.xgDiff   ?? defDiff,
    htFactor: getHTFactor(leagueId),
  };
}

// 🎯 PLAYER PROPS MODEL
// 🎯 PLAYER PROPS MODEL (Dynamic Fallback to Next Best Scorer)
function calculateScorerProb(leagueScorers, teamId, teamLambdaXG, teamTotalGoals, teamProfiles) {
  if(!leagueScorers || leagueScorers.length === 0 || !teamProfiles || teamProfiles.length === 0) return null;

  // Βρίσκουμε τον καλύτερο ΔΙΑΘΕΣΙΜΟ παίκτη από το profile του
  // Διαθέσιμος = ΔΕΝ είναι τραυματίας ΚΑΙ (αν έχουμε lineup) ΕΙΝΑΙ στην ενδεκάδα
  const availablePlayers = teamProfiles.filter(p => {
    if(p.inXI !== undefined) return p.inXI === true && !p.injured;
    return !p.injured;
  });

  if(!availablePlayers.length) return null;

  const topAvailable = availablePlayers[0];
  const playerGoals = topAvailable.goals || 0;

  if(playerGoals === 0) return null;

  let contribution = 0.30;
  if(teamTotalGoals > 0) contribution = Math.min(playerGoals / teamTotalGoals, 0.70);

  const playerXG = teamLambdaXG * contribution;
  const prob = (1 - Math.exp(-playerXG)) * 100;

  return {
    name: topAvailable.name,
    goals: playerGoals,
    photo: topAvailable.photo,
    prob: prob
  };
}

// ── Advanced Corner Model ─────────────────────────────────────────────────────
// NegBin approximation + Bayesian shrinkage + shots-based projection
const LEAGUE_CORNER_MEAN_H=5.1,LEAGUE_CORNER_MEAN_A=4.7,CORNER_OVERDISPERSION=1.35;

// ── Per-league corner multipliers ────────────────────────────────
// Βαθμονομημένα από Post-Match Analysis (global bias ~+38%)
// GOLD leagues = επιθετικό ποδόσφαιρο → περισσότερα κόρνερ
// TIGHT leagues = αμυντικό → λιγότερα κόρνερ
const LEAGUE_CORNER_MULT = {
  // GOLD — υψηλά κόρνερ
  78:  1.42,  // Bundesliga DE
  88:  1.45,  // Eredivisie NL
  218: 1.40,  // Bundesliga AT
  253: 1.38,  // MLS
  262: 1.35,  // Liga MX
  103: 1.38,  // Eliteserien NO
  119: 1.38,  // Superliga DK
  144: 1.40,  // Jupiler Pro BE
  71:  1.35,  // Brasileirao
  164: 1.38,  // Urvalsdeild IS
  // STANDARD
  39:  1.38,  // Premier League — πολλά κόρνερ λόγω έντασης
  113: 1.36,  // Allsvenskan
  179: 1.36,  // Premiership SC
  203: 1.34,  // Süper Lig
  106: 1.35,  // Ekstraklasa PL
  345: 1.34,  // Fortuna Liga CZ
  271: 1.33,  // OTP Bank Liga HU
  // TIGHT — λιγότερα κόρνερ
  135: 1.30,  // Serie A IT — αμυντικό
  140: 1.30,  // La Liga ES
  61:  1.28,  // Ligue 1 FR
  94:  1.30,  // Primeira Liga PT
  197: 1.28,  // Super League GR
  128: 1.28,  // Liga Profesional AR
  283: 1.27,  // SuperLiga RO
  // UEFA
  2:   1.32,  // Champions League
  3:   1.35,  // Europa League
  848: 1.33,  // Conference League
};
const CORNER_MULT_DEFAULT = 1.38; // global fallback (+38% διόρθωση)

function getCornerMult(leagueId) {
  return LEAGUE_CORNER_MULT[leagueId] || CORNER_MULT_DEFAULT;
}

function negativeBinomialCDF_approx(lambda,k_disp,x){
  const variance=lambda+(lambda*lambda)/k_disp;
  const sigma=Math.sqrt(variance);
  if(sigma<=0)return x>=lambda?1:0;
  return normalCDF((x+0.5-lambda)/sigma);
}

function computeCornerConfidence(hS,aS,hXG,aXG,leagueId=0){
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
  // ── Per-league multiplier: διορθώνει το συστηματικό +38% underestimation
  const corMult = getCornerMult(leagueId);
  const totalExpCor=(hExp+aExp+domBonus)*corMult;
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
  // ΣΗΜΑΝΤΙΚΟ: 0.60 αντί 0.78 — οι αντικαταστάτες καλύπτουν περισσότερο
  // από ό,τι υποθέτουμε. Το API επιστρέφει και "doubtful" ως injured.
  const COMPENSATION = 0.60;
  const xGLoss = injuredProfiles.reduce((s, p) => s + p.xGContrib, 0) * COMPENSATION;
  // Floor: ανεβάζουμε από 0.55 σε 0.70 — ακόμα με πολλές απουσίες παράγεται σοβαρό xG
  const factor  = clamp(1 - xGLoss, 0.70, 1.0);
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

  const COMPENSATION = 0.55; // rotation ≠ injury: αντικαταστάτης καλύπτει περισσότερο
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

  // Μόνο αν coverage < 90% εφαρμόζεται ουσιαστική διόρθωση (αυστηρότερο threshold)
  const xGLoss = coverage < 0.90 ? (1 - coverage) * COMPENSATION : 0;
  const factor  = clamp(1 - xGLoss, 0.68, 1.0); // floor 0.68 αντί 0.52
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
function computePick(hXG,aXG,tXG,btts,lp,hS,aS,leagueId=0){
  // hXG/aXG έχουν ήδη βαθμονομηθεί με lp.mult πριν φτάσουν εδώ.
  // ΜΗΝ εφαρμόζεις δεύτερη φορά τον league multiplier.
  const hL=clamp(hXG,0.15,4.0),aL=clamp(aXG,0.15,4.0);
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

  const cornerRes=computeCornerConfidence(hS,aS,hXG,aXG,leagueId);
  const totCards=safeNum(hS.crd,2.1)+safeNum(aS.crd,2.1);

  // ── Offside projection (Poisson model) ──────────────────────────
  // λ = avg offsides per match ανά ομάδα (από batchCalc)
  // Home teams tend to have more offsides (+10%) due to high defensive line
  const hOffLambda = clamp(safeNum(hS.off, 1.8) * 1.05, 0.5, 6.0);
  const aOffLambda = clamp(safeNum(aS.off, 1.5) * 0.95, 0.5, 6.0);
  const totOffLambda = hOffLambda + aOffLambda;
  // P(team ≥ N offsides) via Poisson CDF
  const poissonOffGe = (lambda, n) => {
    let cumP = 0;
    for(let k=0; k<n; k++) cumP += poissonProb(lambda, k);
    return clamp(1 - cumP, 0, 1);
  };
  const hPOff1  = poissonOffGe(hOffLambda, 1);  // P(HOME ≥1)
  const hPOff2  = poissonOffGe(hOffLambda, 2);  // P(HOME ≥2)
  const hPOff3  = poissonOffGe(hOffLambda, 3);  // P(HOME ≥3)
  const aPOff1  = poissonOffGe(aOffLambda, 1);  // P(AWAY ≥1)
  const aPOff2  = poissonOffGe(aOffLambda, 2);  // P(AWAY ≥2)
  const aPOff3  = poissonOffGe(aOffLambda, 3);  // P(AWAY ≥3)
  const pBothOff1 = hPOff1 * aPOff1;            // P(αμφότερες ≥1)
  const pBothOff2 = hPOff2 * aPOff2;            // P(αμφότερες ≥2)
  const pTotOff25 = poissonOffGe(totOffLambda, 3); // P(σύνολο ≥3 = Over 2.5)
  const pTotOff35 = poissonOffGe(totOffLambda, 4); // P(σύνολο ≥4 = Over 3.5)
  const pTotOff45 = poissonOffGe(totOffLambda, 5); // P(σύνολο ≥5 = Over 4.5)

  // Αυτόνομο offside market signal. Δεν αλλάζει το κύριο omegaPick.
  // Δίνει ξεχωριστή ένδειξη μόνο όταν η Poisson πιθανότητα είναι επαρκής.
  const offsideCandidates = [
    { market:'ΣΥΝΟΛΟ OVER 2.5 ΟΦΣΑΪΝΤ', prob:pTotOff25 },
    { market:'HOME OVER 1.5 ΟΦΣΑΪΝΤ',   prob:hPOff2 },
    { market:'AWAY OVER 1.5 ΟΦΣΑΪΝΤ',   prob:aPOff2 },
    { market:'ΑΜΦΟΤΕΡΕΣ ≥1 ΟΦΣΑΪΝΤ',    prob:pBothOff1 },
    { market:'ΣΥΝΟΛΟ OVER 3.5 ΟΦΣΑΪΝΤ', prob:pTotOff35 },
    { market:'ΑΜΦΟΤΕΡΕΣ ≥2 ΟΦΣΑΪΝΤ',    prob:pBothOff2 },
  ].sort((a,b)=>b.prob-a.prob);
  const bestOffside = offsideCandidates[0];
  const offsideConf = bestOffside ? bestOffside.prob*100 : 0;
  const offsideGrade = offsideConf>=82?'A+':offsideConf>=76?'A':offsideConf>=70?'B+':offsideConf>=65?'B':'C';

  const offside = {
    hLambda:parseFloat(hOffLambda.toFixed(2)),
    aLambda:parseFloat(aOffLambda.toFixed(2)),
    totLambda:parseFloat(totOffLambda.toFixed(2)),
    hPOff1:parseFloat((hPOff1*100).toFixed(1)),
    hPOff2:parseFloat((hPOff2*100).toFixed(1)),
    hPOff3:parseFloat((hPOff3*100).toFixed(1)),
    aPOff1:parseFloat((aPOff1*100).toFixed(1)),
    aPOff2:parseFloat((aPOff2*100).toFixed(1)),
    aPOff3:parseFloat((aPOff3*100).toFixed(1)),
    pBothOff1:parseFloat((pBothOff1*100).toFixed(1)),
    pBothOff2:parseFloat((pBothOff2*100).toFixed(1)),
    pTotOff25:parseFloat((pTotOff25*100).toFixed(1)),
    pTotOff35:parseFloat((pTotOff35*100).toFixed(1)),
    pTotOff45:parseFloat((pTotOff45*100).toFixed(1)),
    bestSignal: bestOffside?.market || 'ΧΩΡΙΣ ΣΗΜΑ',
    bestProb: parseFloat(offsideConf.toFixed(1)),
    grade: offsideGrade,
    reliable: offsideConf >= 70,
  };
  
  let omegaPick='ΧΩΡΙΣ ΣΥΣΤΑΣΗ',reason='Δεν υπάρχει σαφές στατιστικό πλεονέκτημα για αυτό το ματς.',pickScore=0;

  // Helper: ανθρώπινη βαθμολόγηση confidence
  const confLabel = s => s>=80?'Πολύ ισχυρό σήμα':s>=72?'Ισχυρό σήμα':'Αξιόπιστο σήμα';

  // 1. ASIAN HANDICAP (-1.5)
  if(pAH_Home >= 0.42 && xgDiff >= 0.90 && hS.formRating >= 50){
    omegaPick='💣 ΑΣΟΣ -1.5 (AH)';pickScore=pAH_Home*100;
    reason=`Ποντάρισμα: Η γηπεδούχος να κερδίσει με 2+ γκολ διαφορά. ${confLabel(pAH_Home*100)} — ξεκάθαρη επιθετική υπεροχή (xG +${xgDiff.toFixed(2)}).`;}
  else if(pAH_Away >= 0.42 && xgDiff <= -0.90 && aS.formRating >= 50){
    omegaPick='💣 ΔΙΠΛΟ -1.5 (AH)';pickScore=pAH_Away*100;
    reason=`Ποντάρισμα: Η φιλοξενούμενη να κερδίσει με 2+ γκολ διαφορά. ${confLabel(pAH_Away*100)} — σαφής υπεροχή φιλοξενούμενης (xG ${xgDiff.toFixed(2)}).`;}

  // 2. HALF-TIME
  else if(ppHT.pHome >= 0.48 && xgDiff >= 0.80){
    omegaPick='⏱️ ΗΜΙΤΕΛΙΚΟ — ΓΗΠΕΔΟΥΧΟΙ';pickScore=ppHT.pHome*100;
    reason=`Ποντάρισμα: Γηπεδούχοι να προηγούνται στο ημίχρονο. Η επίθεσή τους κυριαρχεί από την αρχή (xG +${xgDiff.toFixed(2)}).`;}
  else if(ppHT.pAway >= 0.48 && xgDiff <= -0.80){
    omegaPick='⏱️ ΗΜΙΤΕΛΙΚΟ — ΦΙΛΟΞΕΝΟΥΜΕΝΟΙ';pickScore=ppHT.pAway*100;
    reason=`Ποντάρισμα: Φιλοξενούμενοι να προηγούνται στο ημίχρονο. Παίζουν επιθετικά από τα πρώτα λεπτά (xG ${xgDiff.toFixed(2)}).`;}

  // 3. OVER 3.5
  else if(pp.pO35 >= 0.52 && tXG >= lp.minXGO35 && btts >= 1.30){
    omegaPick='🚀 ΠΑΝΩ ΑΠΟ 3.5 ΓΚΟΛ';pickScore=pp.pO35*100;
    reason=`Ποντάρισμα: Τουλάχιστον 4 γκολ. Και οι δύο ομάδες έχουν ισχυρή επίθεση — αναμένονται ${tXG.toFixed(1)} γκολ συνολικά (${pct(pp.pO35)} πιθανότητα).`;}

  // 4. OVER 2.5
  else if(pp.pO25 >= 0.62 && tXG >= lp.minXGO25 && btts >= 0.90){
    omegaPick='🔥 ΠΑΝΩ ΑΠΟ 2.5 ΓΚΟΛ';pickScore=pp.pO25*100;
    reason=`Ποντάρισμα: Τουλάχιστον 3 γκολ. Ανοιχτό επιθετικό ματς — αναμένονται ${tXG.toFixed(1)} γκολ (${pct(pp.pO25)} πιθανότητα).`;}

  // 5. UNDER 2.5
  else if(pp.pU25 >= 0.58 && tXG <= lp.maxU25 && btts <= engineConfig.tBTTS_U25){
    omegaPick='🔒 ΚΑΤΩ ΑΠΟ 2.5 ΓΚΟΛ';pickScore=pp.pU25*100;
    reason=`Ποντάρισμα: Κάτω από 3 γκολ. Αμυντικό κλειστό ματς — αναμένονται μόλις ${tXG.toFixed(1)} γκολ (${pct(pp.pU25)} πιθανότητα).`;}

  // 6. GOAL/GOAL
  else if(btts >= lp.minBTTS && pp.pBTTS >= 0.68 && hXG >= 1.10 && aXG >= 1.10){
    omegaPick='🎯 ΓΚΟΛ/ΓΚΟΛ (GG)';pickScore=pp.pBTTS*100;
    reason=`Ποντάρισμα: Και οι δύο ομάδες να σκοράρουν. Αμφότερες έχουν επιθετική απειλή (🏠 ${hXG.toFixed(2)} / ✈️ ${aXG.toFixed(2)} xG) — ${pct(pp.pBTTS)} πιθανότητα.`;}

  // 7. STRAIGHT WIN
  else if(outPick !== 'X' && Math.abs(xgDiff) >= lp.xgDiff){
    const isHome   = outPick==='1';
    const outcome  = isHome ? '🏠 ΝΙΚΗ ΓΗΠΕΔΟΥΧΩΝ' : '✈️ ΝΙΚΗ ΦΙΛΟΞΕΝΟΥΜΕΝΩΝ';
    const outProb  = isHome ? pp.pHome : pp.pAway;
    const formOk   = isHome ? hS.formRating >= 40 : aS.formRating >= 40;
    if(outProb >= 0.58 && formOk){
      omegaPick = outProb >= 0.65 ? `⚡ ${outcome}` : outcome;
      pickScore = outProb*100;
      reason = `Ποντάρισμα: Νίκη ${isHome?'γηπεδούχων':'φιλοξενούμενων'}. ${confLabel(outProb*100)} — υπεροχή σε xG (${isHome?'+':''}${xgDiff.toFixed(2)}) και φόρμα. Πιθανότητα νίκης: ${pct(outProb)}.`;
    }
  }

  // 8. PROPS
  else if(cornerRes.conf >= 72){
    omegaPick='🚩 ΠΑΝΩ ΑΠΟ 8.5 ΚΟΡΝΕΡ';pickScore=cornerRes.conf;
    reason=`Ποντάρισμα: Πάνω από 8 κόρνερ. Επιθετικό ματς με πολλές τελικές — αναμένονται ${cornerRes.expCor.toFixed(1)} κόρνερ συνολικά.`;}
  else if(totCards >= engineConfig.minCards && Math.abs(xgDiff) < 0.45){
    omegaPick='🟨 ΠΑΝΩ ΑΠΟ 5.5 ΚΑΡΤΕΣ';pickScore=clamp((totCards-5.0)*20,0,85);
    reason=`Ποντάρισμα: Πάνω από 5 κάρτες. Ισορροπημένο και αγωνιστικό ματς — αναμένονται ${totCards.toFixed(1)} κάρτες συνολικά.`;}
  
  // ── CONFIDENCE THRESHOLD ──────────────────────────────────────
  // Αν το pickScore δεν φτάνει το ελάχιστο κατώφλι → ΧΩΡΙΣ ΣΥΣΤΑΣΗ
  const MIN_CONF = 70;
  if(pickScore < MIN_CONF && !omegaPick.includes('ΧΩΡΙΣ')) {
    omegaPick = 'ΧΩΡΙΣ ΣΥΣΤΑΣΗ';
    reason    = `Το σήμα δεν είναι αρκετά ισχυρό για ποντάρισμα (${pickScore.toFixed(0)}% confidence — χρειάζεται τουλάχιστον ${MIN_CONF}%). Περιμένετε καλύτερη ευκαιρία.`;
    pickScore = 0;
  }

  // exactConf: αθροίζει πιθανότητες Top-1 + Top-2 (Dixon-Coles adjusted) — πιο ρεαλιστικό
  const top1P=pp.bestScore.prob, top2P=pp.secondScore.prob;
  const exactConf=Math.round(clamp((top1P+top2P)*100*4.2,0,99));
  return{omegaPick,reason,pickScore,outPick,
    hG:pp.bestScore.h,aG:pp.bestScore.a,
    hG2:pp.secondScore.h,aG2:pp.secondScore.a,
    hExp:hL,aExp:aL,exactConf,xgDiff,pp,
    cornerConf:cornerRes.conf,expCor:cornerRes.expCor,lambdaTotal:hL+aL,
    offside};
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

    const bttsScore=Math.min(hXGfinal,aXGfinal);const result=computePick(hXGfinal,aXGfinal,tXGfinal,bttsScore,lp,hS,aS,m.league.id);

    // ⏱️ HT ANALYSIS — αυτόνομη ανάλυση ημιχρόνου (league-specific factor + D-C ρ=-0.10)
    const htAnalysis = computeHTAnalysis(result.hExp, result.aExp, lp);
    // Καλείται ΜΕΤΑ το computePick για να έχουμε το result.xgDiff
    // Ταξινομεί τους players κατά adjCardProb DESC
    const cardCtx = { xgDiff: result.xgDiff, leagueId: m.league.id };
    adjustPlayerCardProbs(hPlayers, aS, cardCtx); // home team players: opponent = away stats
    adjustPlayerCardProbs(aPlayers, hS, cardCtx); // away team players: opponent = home stats
    
    const hScorerProb = calculateScorerProb(leagueScorers, m.teams.home.id, result.hExp, hS.totalTeamGoalsSeason, hPlayers);
    const aScorerProb = calculateScorerProb(leagueScorers, m.teams.away.id, result.aExp, aS.totalTeamGoalsSeason, aPlayers);

    let actStats = null;
    if (isFinished(m.fixture.status.short)) {
      const sr = await apiReq(`fixtures/statistics?fixture=${m.fixture.id}`);
      if(sr.response && sr.response.length === 2) {
        const hs = sr.response[0].statistics; const as = sr.response[1].statistics;
        actStats = {
          hPoss: statVal(hs, 'Ball Possession'), aPoss: statVal(as, 'Ball Possession'),
          hCor: statVal(hs, 'Corner Kicks'), aCor: statVal(as, 'Corner Kicks'),
          hCrd: statVal(hs, 'Yellow Cards') + statVal(hs, 'Red Cards'), aCrd: statVal(as, 'Yellow Cards') + statVal(as, 'Red Cards'),
          hOff: statVal(hs, 'Offsides'), aOff: statVal(as, 'Offsides'),
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
      offside: result.offside,   // Offside projection (Poisson model)
    });
  }catch(err){
    console.error('[APEX] Analysis failed:', m?.teams?.home?.name, 'vs', m?.teams?.away?.name, err);
    window.scannedMatchesData.push({m,fixId:m.fixture.id,ht:m.teams.home.name,at:m.teams.away.name,lg:m.league.name,leagueId:m.league.id,omegaPick:'NO BET',reason:`Analysis error: ${err?.message||err}`,strength:0,tXG:0,outPick:'X',exact:'0-0',cornerConf:0});
  }
}

window.runScan=async function(){
  if(isRunning)return;
  const startD=document.getElementById('scanStart').value||todayISO();const endD=document.getElementById('scanEnd').value||startD;
  if(new Date(endD)<new Date(startD)){showErr("Λάθος ημερομηνία.");return;}
  isRunning=true;clearAlerts();setBtnsDisabled(true);setLoader(true,'Initializing Deep Quant...');
  console.log('[APEX] Scan started · adaptive API', window.APEX_API_RATE);
  // Clear team intel cache — fresh data για κάθε scan
  try { _buildIntelPromises.clear(); _buildIntelCache.clear(); } catch {}
  ['topSection','summarySection','advisorSection','auditSection'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='';});
  window.scannedMatchesData=[]; // TTL caches intentionally preserved between scans for speed + stability
  try{
    const selLg=document.getElementById('leagueFilter').value;let all=[];
    for(const date of getDatesInRange(startD,endD)){
      setProgress(5,`Fetching ${date}...`);const res=await apiReq(`fixtures?date=${date}`,{priority:'high',cacheMs:CACHE_TTL.FIXTURE_DAY});
      if(res?.__apiError) throw new Error(`API-Football: ${res.__apiError}`);
      const dm=(res.response||[]).filter(m=>{if(selLg==='WORLD')return true;if(selLg==='ALL')return typeof LEAGUE_IDS!=='undefined'&&LEAGUE_IDS.includes(m.league.id);if(selLg==='MY_LEAGUES')return getActiveMyLeagues().includes(m.league.id);return m.league.id===parseInt(selLg);});
      all.push(...dm);if(all.length>350)break;
    }
    if(!all.length){showErr('Δεν βρέθηκαν αγώνες.');return;}
    if(all.length>350) all=all.slice(0,350);

    // ── Pre-fetch shared data ανά league (1 φορά, όχι ανά match) ──
    // Standings, scorers, assists, cards είναι per-league — cache τα πρώτα
    const leagueSeasonPairs=[...new Map(all.map(m=>[`${m.league.id}_${m.league.season}`,{lid:m.league.id,season:m.league.season}])).values()];
    setProgress(8, `Pre-fetching ${leagueSeasonPairs.length} league/season sets…`);
    await Promise.all(leagueSeasonPairs.map(({lid,season}) => Promise.all([
      getStand(lid, season),
      getLeagueTopScorers(lid, season),
      getLeagueTopAssists(lid, season),
      getLeagueTopCards(lid, season),
    ])));

    // Match concurrency follows detected API capacity. The global queue still
    // enforces the exact request-launch rate, so bigger plans scale automatically.
    const SCAN_BATCH = apiClamp(Math.max(2,Math.ceil(API_RATE.maxConcurrent/2)),2,6);
    console.log(`[APEX] Adaptive profile: ${API_RATE.minuteLimit||'?'} req/min · ${_effectiveRps().toFixed(1)} req/s · batch ${SCAN_BATCH}`);
    for(let i=0; i<all.length; i+=SCAN_BATCH){
      const batch = all.slice(i, i+SCAN_BATCH);
      await Promise.all(batch.map((m,j) => analyzeMatchSafe(m, i+j, all.length)));
    }
    
    saveToVault(window.scannedMatchesData);
    rebuildTopLists();renderTopSections();renderSummaryTable();tickerRefresh();startAutoSync();
    renderBetJournal();
    pushToSheets(window.scannedMatchesData).catch(()=>{});
    // Συγχρονισμός Audit UI με το τρέχον scan
    syncAuditFromScan(window.scannedMatchesData, startD, endD);
    // ── Data quality check ───────────────────────────────────────
    const fallbackCount = window.scannedMatchesData.filter(d =>
      d.hXGfinal && Math.abs(Number(d.hXGfinal) - 1.10) < 0.02 &&
      Math.abs(Number(d.aXGfinal) - 1.10) < 0.02
    ).length;
    if(fallbackCount > 0) {
      const pct = Math.round(fallbackCount / window.scannedMatchesData.length * 100);
      showErr(`⚠️ ${fallbackCount}/${all.length} ματς (${pct}%) φόρτωσαν default τιμές — το API δεν απάντησε εγκαίρως. Δοκίμασε ξανά.`);
    } else {
      showOk(`✅ Scan ολοκληρώθηκε — ${all.length} αγώνες.`);
    }
    // BEST 4 v5.5: price only the strongest RADAR fixtures across all available bookmakers.
    window.refreshBest4({silent:true}).catch(err=>console.warn('[APEX] BEST 4 odds refresh failed:',err?.message||err));
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
  const HOME_ADV = 1.04;
  const totRate  = hRate * HOME_ADV + aRate;
  const pNextHome = clamp((hRate * HOME_ADV) / totRate, 0.05, 0.95);
  const pNextAway = 1 - pNextHome;

  // ── Shot Quality Differential (SQD) ───────────────────────────
  // xG/shot: ποιότητα ευκαιριών, όχι όγκος
  // Αν HOME SQD > 0 → κάθε shot της HOME είναι πιο επικίνδυνο
  const hXGperShot = hTot > 0 ? hLiveXG / hTot : 0;
  const aXGperShot = aTot > 0 ? aLiveXG / aTot : 0;
  const sqd = hXGperShot - aXGperShot; // θετικό = HOME πλεονέκτημα

  // ── Shots on Target Ratio ──────────────────────────────────────
  // Ο πιο αξιόπιστος live predictor (correlation >65% με outcome)
  const totSoT = hSoT + aSoT || 1;
  const hSoTRatio = hSoT / totSoT; // 0.5 = ισόπαλο
  const aSoTRatio = aSoT / totSoT;

  // ── GK Saves Pressure Index ────────────────────────────────────
  // Αν ο GK της HOME κάνει πολλές σεβές → η AWAY ασκεί κρυφή πίεση
  // saves = shots on target που δεν μπήκαν (SoT - goals)
  const hGoals = 0; // δεν το ξέρουμε εδώ, χρησιμοποιούμε saves άμεσα
  const totSaves = hSaves + aSaves || 1;
  // hSaves = σεβές του HOME GK = επίθεση AWAY που σταμάτησε
  const awayPressureViaGK = hSaves / (totSaves); // % της συνολικής πίεσης GK
  const homePressureViaGK = aSaves / (totSaves);

  // ── Composite Live Edge Score (0-100) ─────────────────────────
  // Συνδυάζει SoT ratio (50%), SQD (30%), GK pressure (20%)
  // > 55 = HOME πλεονεκτεί, < 45 = AWAY πλεονεκτεί
  const hLiveEdge = clamp(
    hSoTRatio * 50 +
    clamp(sqd * 200 + 25, 0, 30) +  // SQD mapped 0-30
    homePressureViaGK * 20,
    5, 95
  );
  const aLiveEdge = 100 - hLiveEdge;

  return {
    hLiveXG, aLiveXG, hLiveXGA, aLiveXGA,
    hMomentum, aMomentum,
    pNextHome, pNextAway,
    // SQD & Shot Quality
    hXGperShot, aXGperShot, sqd,
    hSoTRatio, aSoTRatio,
    hSaves, aSaves,
    hLiveEdge, aLiveEdge,
    hSoT, aSoT, hTot, aTot, hCor, aCor,
    hPoss, aPoss, hFouls, aFouls,
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
  const result = computePick(hXGfinal, aXGfinal, tXGfinal, btts, lp, d.hS, d.aS, d.leagueId);
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
    hExp: result.hExp, aExp: result.aExp, pp: result.pp, offside: result.offside,
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
      if(liveTrackerLeagues==='MY_LEAGUES')return getActiveMyLeagues().includes(m.league.id);
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
          const tXG=hXG+aXG;const res2=computePick(hXG,aXG,tXG,Math.min(hXG,aXG),lp,hS,aS,lf.league.id);
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
          return`<div style="flex:1;min-width:55px;background:var(--bg-base);border-radius:6px;padding:6px 8px;text-align:center;"><div style="font-size:0.66rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">${m.lbl}</div><div style="font-size:0.9rem;font-weight:900;font-family:var(--font-mono);color:${p>=65?m.c:'var(--text-muted)'};">${p}%</div></div>`;
        }).join('')}
        ${preMatchPick&&!isNoBet?`<div style="flex:2;min-width:120px;background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.15);border-radius:6px;padding:6px 10px;"><div style="font-size:0.66rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:2px;">Πρό-αγώνα</div><div style="font-size:0.72rem;font-weight:700;color:var(--accent-blue);">${esc(preMatchPick)}</div></div>`:''}
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
        const res = computePick(hA.adjXG, aA.adjXG, hA.adjXG+aA.adjXG, Math.min(hA.adjXG,aA.adjXG), lp, d.hS, d.aS, d.leagueId);
        Object.assign(d,{hXGfinal:hA.adjXG,aXGfinal:aA.adjXG,hInjAdj:hA,aInjAdj:aA,
          outPick:res.outPick,exact:`${res.hG}-${res.aG}`,exact2:`${res.hG2}-${res.aG2}`,
          exactConf:res.exactConf,omegaPick:res.omegaPick,strength:res.pickScore,
          hExp:res.hExp,aExp:res.aExp,pp:res.pp,offside:res.offside});
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
    const result = computePick(hXGfinal, aXGfinal, tXGfinal, btts, lp, d.hS, d.aS, d.leagueId);
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
      hExp:result.hExp, aExp:result.aExp, pp:result.pp, offside:result.offside,
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
//  ODDS ENGINE — Αυτόματη άντληση αποδόσεων + Value Bet ranking
// ================================================================

// Pinnacle bookmaker ID = 8 (sharpest lines, lowest margin)
// Bet365 = 1, Unibet = 12, William Hill = 6
const ODDS_BOOKMAKER_ID   = 8;   // Pinnacle
const ODDS_BOOKMAKER_NAME = 'Pinnacle';
const MIN_EV_THRESHOLD    = 0.015; // ≥1.5% EV για εμφάνιση στο Value Bets
let oddsCache = new BoundedCache(180, CACHE_TTL.ODDS);
let _oddsLoadedFixtures = new Set(); // αποφυγή διπλής φόρτωσης

async function fetchOddsForFixture(fixtureId) {
  const k = String(fixtureId);
  if(oddsCache.has(k)) return oddsCache.get(k);
  const d = await apiReq(`odds?fixture=${fixtureId}&bookmaker=${ODDS_BOOKMAKER_ID}`,{priority:'low',cacheMs:CACHE_TTL.ODDS});
  const result = parseOddsResponse(d?.response || []);
  oddsCache.set(k, result);
  return result;
}

/**
 * Παρσάρει το API odds response και επιστρέφει flat object:
 * { home, draw, away, over25, under25, over35, under35, bttsY, bttsN }
 * Αποδόσεις σε decimal format, null αν δεν υπάρχουν.
 */
function parseOddsResponse(response) {
  const out = { home:null, draw:null, away:null, over25:null, under25:null, over35:null, under35:null, bttsY:null, bttsN:null };
  if(!response?.length) return out;

  const bk = response[0]?.bookmakers?.[0];
  if(!bk) return out;

  bk.bets?.forEach(bet => {
    const name = bet.name?.toLowerCase() || '';

    // Αυστηρός έλεγχος (Exact Match) για να αποφύγουμε αγορές ημιχρόνου
    if(name === 'match winner') {
      bet.values?.forEach(v => {
        const val = v.value?.toLowerCase();
        const odd = parseFloat(v.odd);
        if(isNaN(odd)) return;
        if(val === 'home')      out.home = odd;
        else if(val === 'draw') out.draw = odd;
        else if(val === 'away') out.away = odd;
      });
    }

    // Αυστηρός έλεγχος (Exact Match) για το συνολικό Over/Under του αγώνα
    if(name === 'goals over/under') {
      bet.values?.forEach(v => {
        const val  = v.value?.toLowerCase() || '';
        const odd  = parseFloat(v.odd);
        if(isNaN(odd)) return;
        if(val === 'over 2.5')       out.over25  = odd;
        else if(val === 'under 2.5') out.under25 = odd;
        else if(val === 'over 3.5')  out.over35  = odd;
        else if(val === 'under 3.5') out.under35 = odd;
      });
    }

    // Αυστηρός έλεγχος (Exact Match) για το BTTS
    if(name === 'both teams score') {
      bet.values?.forEach(v => {
        const val = v.value?.toLowerCase();
        const odd = parseFloat(v.odd);
        if(isNaN(odd)) return;
        if(val === 'yes')     out.bttsY = odd;
        else if(val === 'no') out.bttsN = odd;
      });
    }
  });
  return out;
}

/**
 * Για ένα record (post-analyzeMatchSafe) και τις αποδόσεις bookmaker:
 * Υπολογίζει EV% για κάθε αγορά και επιστρέφει array value bets.
 */
function extractValueBets(rec, odds) {
  if(!rec?.pp || !odds) return [];
  const { pp, hXGfinal, aXGfinal, cornerConf, strength, omegaPick } = rec;
  const bankroll = bankrollData.current || 0;
  const bets = [];

  const assess = (market, modelProb, decOdds, label) => {
    if(!decOdds || decOdds <= 1.01 || modelProb <= 0) return;

    const impliedProb = 1 / decOdds;

    // ── Φίλτρο 1: Απόδοση > 15 (implied < 6.7%) — πολύ ακραία, αγνοούμε
    if(impliedProb < 0.067) return;

    // ── Φίλτρο 2: Market-aware max edge cap
    // Το Pinnacle έχει margin ~2%. Ένα αξιόπιστο μοντέλο μπορεί να έχει
    // edge 3-8% πάνω από την αγορά. Πάνω από αυτό = λάθος μοντέλου, όχι edge.
    //
    // Max credible edge ανά odds range:
    //   odds < 2.0  (implied > 50%): ±8pp — πολύ παρατηρούμενη αγορά
    //   odds 2-3.5  (implied 29-50%): ±10pp — καλή ρευστότητα
    //   odds 3.5-6  (implied 17-29%): ±8pp  — λιγότερα δεδομένα
    //   odds 6-15   (implied 7-17%):  ±6pp  — ακραία αγορά, αναξιόπιστα signals
    let maxEdgePP;
    if(decOdds < 2.0)       maxEdgePP = 0.08;
    else if(decOdds < 3.5)  maxEdgePP = 0.10;
    else if(decOdds < 6.0)  maxEdgePP = 0.08;
    else                     maxEdgePP = 0.06;   // odds 6-15

    // Cap the model probability — δεν μπορεί να απέχει > maxEdge από implied
    const cappedModelProb = Math.min(modelProb, impliedProb + maxEdgePP);

    // ── Φίλτρο 3: Μετά το cap, υπολόγισε EV — αν ακόμα δεν είναι positive, drop
    const ev = cappedModelProb * decOdds - 1;
    if(ev < MIN_EV_THRESHOLD) return;

    // ── Φίλτρο 4: Consistency check — το omegaPick του μοντέλου πρέπει να
    // συμφωνεί με τη συγκεκριμένη αγορά για να θεωρηθεί αξιόπιστο σήμα
    const pickStr = omegaPick || '';
    if(label.includes('ΠΑΝΩ ΑΠΟ 3.5') && !pickStr.includes('3.5') && !pickStr.includes('OVER 3')) return;
    if(label.includes('ΠΑΝΩ ΑΠΟ 2.5') && !pickStr.includes('2.5') && !pickStr.includes('3.5')) return;
    if(label.includes('ΚΑΤΩ ΑΠΟ')     && !pickStr.includes('ΚΑΤΩ')) return;
    if(label.includes('ΓΚΟΛ/ΓΚΟΛ')    && !pickStr.includes('ΓΚΟΛ')) return;
    if(label.includes('ΝΙΚΗ ΓΗΠΕΔ')   && !pickStr.includes('ΝΙΚΗ') && !pickStr.includes('ΑΣΟΣ') && !pickStr.includes('⚡') && !pickStr.includes('💣')) return;
    if(label.includes('ΝΙΚΗ ΦΙΛΟΞ')   && !pickStr.includes('ΝΙΚΗ') && !pickStr.includes('ΔΙΠΛΟ') && !pickStr.includes('⚡') && !pickStr.includes('💣')) return;

    const edge  = (cappedModelProb - impliedProb) * 100;
    const kelly = bankroll > 0
      ? clamp((cappedModelProb * (decOdds-1) - (1-cappedModelProb)) / (decOdds-1) * KELLY_FRACTION * bankroll, 0, bankroll * 0.10)
      : 0;

    bets.push({
      fixId:    rec.fixId,
      match:    `${rec.ht} vs ${rec.at}`,
      lg:       rec.lg,
      date:     rec.m?.fixture?.date?.split('T')[0] || '',
      time:     rec.m?.fixture?.date?.split('T')[1]?.slice(0,5) || '',
      market,
      label,
      modelProb:   parseFloat((cappedModelProb*100).toFixed(1)),
      impliedProb: parseFloat((impliedProb*100).toFixed(1)),
      decOdds:     parseFloat(decOdds.toFixed(2)),
      ev:          parseFloat((ev*100).toFixed(2)),
      edge:        parseFloat(edge.toFixed(1)),
      kelly:       parseFloat(kelly.toFixed(2)),
      omegaPick,
      pickConf:    strength || 0,
      bookmaker:   ODDS_BOOKMAKER_NAME,
    });
  };

  assess('1X2',      pp.pHome,  odds.home,    'ΝΙΚΗ ΓΗΠΕΔΟΥΧΩΝ');
  assess('1X2',      pp.pDraw,  odds.draw,    'ΙΣΟΠΑΛΙΑ');
  assess('1X2',      pp.pAway,  odds.away,    'ΝΙΚΗ ΦΙΛΟΞΕΝΟΥΜΕΝΩΝ');
  assess('Πάνω 2.5', pp.pO25,   odds.over25,  'ΠΑΝΩ ΑΠΟ 2.5 ΓΚΟΛ');
  assess('Κάτω 2.5', pp.pU25,   odds.under25, 'ΚΑΤΩ ΑΠΟ 2.5 ΓΚΟΛ');
  assess('Πάνω 3.5', pp.pO35,   odds.over35,  'ΠΑΝΩ ΑΠΟ 3.5 ΓΚΟΛ');
  assess('Κάτω 3.5', 1-pp.pO35, odds.under35, 'ΚΑΤΩ ΑΠΟ 3.5 ΓΚΟΛ');
  assess('ΓΓ',       pp.pBTTS,  odds.bttsY,   'ΓΚΟΛ/ΓΚΟΛ (ΝΑΙ)');
  assess('ΌΧΙ ΓΓ',  1-pp.pBTTS,odds.bttsN,   'ΓΚΟΛ/ΓΚΟΛ (ΟΧΙ)');

  return bets;
}

/**
 * Φέρνει odds για όλους τους αγώνες του scan (parallel, με rate limit)
 * και ενημερώνει τα records + latestTopLists.valueBets
 */
window.fetchAllOdds = async function() {
  const sd = window.scannedMatchesData || [];
  if(!sd.length) { showErr('Εκτελέστε πρώτα scan.'); return; }

  const btn = document.getElementById('btnFetchOdds');
  if(btn) { btn.disabled = true; btn.textContent = '⏳ Φόρτωση Αποδόσεων…'; }
  setLoader(true, `Φόρτωση αποδόσεων ${ODDS_BOOKMAKER_NAME}…`);

  let loaded = 0;
  const total = sd.length;

  try {
    // Φόρτωση σε batches των 5 για rate limit
    const BATCH = 5;
    for(let i = 0; i < sd.length; i += BATCH) {
      const batch = sd.slice(i, i + BATCH);
      await Promise.all(batch.map(async rec => {
        try {
          if(_oddsLoadedFixtures.has(rec.fixId)) { loaded++; return; }
          const odds = await fetchOddsForFixture(rec.fixId);
          rec.odds = odds;
          rec.valueBets = extractValueBets(rec, odds);
          _oddsLoadedFixtures.add(rec.fixId);
          loaded++;
          setProgress((loaded/total)*100, `Αποδόσεις: ${loaded}/${total} αγώνες`);
        } catch { loaded++; }
      }));
    }

    // Rebuild value bets list
    buildValueBetsList();
    renderTopSections();
    showOk(`✅ Αποδόσεις φορτώθηκαν — ${loaded} αγώνες · ${ODDS_BOOKMAKER_NAME}`);
  } catch(e) {
    showErr('Σφάλμα φόρτωσης αποδόσεων: ' + e.message);
  } finally {
    setLoader(false);
    if(btn) { btn.disabled = false; btn.textContent = '💰 Αποδόσεις'; }
  }
};


// ================================================================
//  RADAR ENGINE — σαφής υπεροχή μοντέλου, χωρίς bookmaker odds
// ================================================================
function buildRadarList() {
  const matches = (window.scannedMatchesData || []).filter(rec =>
    rec?.pp &&
    !isFinished(rec.m?.fixture?.status?.short) &&
    !String(rec.reason||'').startsWith('Analysis error')
  );
  const signals = [];

  const gradeFor = score => score >= 90 ? 'A+' : score >= 84 ? 'A' : score >= 78 ? 'B+' : score >= 72 ? 'B' : 'C';
  const add = (rec, signal) => {
    const score = clamp(Number(signal.radarScore)||0, 0, 99);
    if(score < 72) return; // RADAR = μόνο σαφής υπεροχή
    signals.push({
      fixId: rec.fixId,
      ht: rec.ht, at: rec.at, lg: rec.lg,
      date: rec.m?.fixture?.date?.split('T')[0] || '',
      time: rec.m?.fixture?.date?.split('T')[1]?.slice(0,5) || '',
      radarScore: parseFloat(score.toFixed(1)),
      grade: gradeFor(score),
      ...signal,
    });
  };

  matches.forEach(rec => {
    const pp = rec.pp;
    const xgDiff = Number(rec.xgDiff || ((rec.hXGfinal||0) - (rec.aXGfinal||0)) || 0);
    const tXG = Number(rec.tXG || ((rec.hXGfinal||0) + (rec.aXGfinal||0)) || 0);

    // ── 1 / X / 2: μόνο ο πρώτος outcome και μόνο με gap από τον δεύτερο ──
    const outcomes = [
      { key:'1', prob:Number(pp.pHome||0), label:'1 — ΝΙΚΗ ΓΗΠΕΔΟΥΧΩΝ', icon:'🏠' },
      { key:'X', prob:Number(pp.pDraw||0), label:'X — ΙΣΟΠΑΛΙΑ', icon:'🤝' },
      { key:'2', prob:Number(pp.pAway||0), label:'2 — ΝΙΚΗ ΦΙΛΟΞΕΝΟΥΜΕΝΩΝ', icon:'✈️' },
    ].sort((a,b)=>b.prob-a.prob);
    const lead = outcomes[0], second = outcomes[1];
    const gap = Math.max(0, lead.prob - second.prob);

    if(lead.key === '1' && lead.prob >= 0.50 && gap >= 0.10 && xgDiff >= 0.50) {
      const score = lead.prob*100 + gap*65 + Math.min(xgDiff,1.5)*7;
      add(rec, {
        category:'1X2', market:'1', label:lead.label, icon:lead.icon,
        probability:lead.prob*100, dominanceGap:gap*100,
        radarScore:score,
        reason:`Πρώτη πιθανότητα ${pct(lead.prob)} · υπεροχή από 2ο outcome +${(gap*100).toFixed(1)} π.μ. · xG Diff +${xgDiff.toFixed(2)}`,
        metric:`P1 ${(lead.prob*100).toFixed(1)}% · Δ2ου +${(gap*100).toFixed(1)}pp · xG +${xgDiff.toFixed(2)}`
      });
    } else if(lead.key === '2' && lead.prob >= 0.50 && gap >= 0.10 && xgDiff <= -0.50) {
      const score = lead.prob*100 + gap*65 + Math.min(Math.abs(xgDiff),1.5)*7;
      add(rec, {
        category:'1X2', market:'2', label:lead.label, icon:lead.icon,
        probability:lead.prob*100, dominanceGap:gap*100,
        radarScore:score,
        reason:`Πρώτη πιθανότητα ${pct(lead.prob)} · υπεροχή από 2ο outcome +${(gap*100).toFixed(1)} π.μ. · xG Diff ${xgDiff.toFixed(2)}`,
        metric:`P2 ${(lead.prob*100).toFixed(1)}% · Δ2ου +${(gap*100).toFixed(1)}pp · xG ${xgDiff.toFixed(2)}`
      });
    } else if(lead.key === 'X' && lead.prob >= 0.34 && gap >= 0.04 && Math.abs(xgDiff) <= 0.30) {
      // Η ισοπαλία έχει χαμηλότερο φυσιολογικό base-rate, άρα βαθμολογείται σε draw-specific scale.
      const score = 66 + (lead.prob-0.34)*160 + (gap-0.04)*180 + Math.max(0,0.30-Math.abs(xgDiff))*20;
      add(rec, {
        category:'1X2', market:'X', label:lead.label, icon:lead.icon,
        probability:lead.prob*100, dominanceGap:gap*100,
        radarScore:score,
        reason:`Η ισοπαλία είναι το #1 outcome · +${(gap*100).toFixed(1)} π.μ. από το 2ο · ισορροπία xG (${xgDiff>=0?'+':''}${xgDiff.toFixed(2)})`,
        metric:`PX ${(lead.prob*100).toFixed(1)}% · Δ2ου +${(gap*100).toFixed(1)}pp · |xGΔ| ${Math.abs(xgDiff).toFixed(2)}`
      });
    }

    // ── GOALS: επιλέγουμε την πιο απαιτητική γραμμή που περνά το φίλτρο ──
    const pO35 = Number(pp.pO35||0), pO25 = Number(pp.pO25||0);
    if(pO35 >= 0.55 && tXG >= 3.50) {
      add(rec, {
        category:'GOALS', market:'O3.5', label:'OVER 3.5 ΓΚΟΛ', icon:'🚀',
        probability:pO35*100,
        radarScore:pO35*100 + Math.min(Math.max(tXG-3.5,0)*10,12),
        reason:`Poisson O3.5 ${pct(pO35)} · Total xG ${tXG.toFixed(2)} — ισχυρή υπεροχή high-scoring σεναρίου`,
        metric:`P(O3.5) ${(pO35*100).toFixed(1)}% · tXG ${tXG.toFixed(2)}`
      });
    } else if(pO25 >= 0.66 && tXG >= 2.90) {
      add(rec, {
        category:'GOALS', market:'O2.5', label:'OVER 2.5 ΓΚΟΛ', icon:'🔥',
        probability:pO25*100,
        radarScore:pO25*100 + Math.min(Math.max(tXG-2.9,0)*8,12),
        reason:`Poisson O2.5 ${pct(pO25)} · Total xG ${tXG.toFixed(2)} — σαφής κλίση προς ≥3 γκολ`,
        metric:`P(O2.5) ${(pO25*100).toFixed(1)}% · tXG ${tXG.toFixed(2)}`
      });
    }

    // ── CORNERS: η cornerConf είναι ήδη P(Over 8.5) με sample penalty ──
    const corConf = Number(rec.cornerConf||0), expCor = Number(rec.expCor||0);
    if(corConf >= 70 && expCor >= 9.5) {
      add(rec, {
        category:'CORNERS', market:'COR O8.5', label:'OVER 8.5 ΚΟΡΝΕΡ', icon:'🚩',
        probability:corConf,
        radarScore:corConf + Math.min(Math.max(expCor-9.5,0)*3,10),
        reason:`P(Over 8.5 corners) ${corConf.toFixed(1)}% · προβολή ${expCor.toFixed(1)} κόρνερ`,
        metric:`P>8.5 ${corConf.toFixed(1)}% · Exp ${expCor.toFixed(1)}`
      });
    }

    // ── OFFSIDES: αυτόνομο Poisson market ──
    const off = rec.offside;
    if(off && Number(off.bestProb||0) >= 70 && off.bestSignal && !String(off.bestSignal).includes('ΧΩΡΙΣ')) {
      const offProb = Number(off.bestProb||0), lambda = Number(off.totLambda||0);
      add(rec, {
        category:'OFFSIDES', market:'OFFSIDE', label:off.bestSignal, icon:'🚫',
        probability:offProb,
        radarScore:offProb + Math.min(Math.max(lambda-2.0,0)*2.5,8),
        reason:`Offside Poisson ${offProb.toFixed(1)}% · λ HOME ${Number(off.hLambda||0).toFixed(2)} / AWAY ${Number(off.aLambda||0).toFixed(2)}`,
        metric:`P ${offProb.toFixed(1)}% · λ total ${lambda.toFixed(2)}`
      });
    }
  });

  // Κατάταξη συνολικά, αλλά όχι πάνω από 3 signals από τον ίδιο αγώνα.
  const sorted = signals.sort((a,b)=>b.radarScore-a.radarScore);
  const perMatch = new Map();
  latestTopLists.radar = sorted.filter(s => {
    const n = perMatch.get(s.fixId) || 0;
    if(n >= 3) return false;
    perMatch.set(s.fixId, n+1);
    return true;
  }).slice(0,20);
}

function renderRadarTab(signals) {
  if(!signals?.length) {
    return `<div style="text-align:center;color:var(--text-muted);padding:34px 20px;">
      <div style="font-size:2.2rem;margin-bottom:10px;">📡</div>
      <div style="font-weight:800;margin-bottom:6px;">Το RADAR δεν βρήκε σαφή υπεροχή</div>
      <div style="font-size:0.82rem;line-height:1.6;">Εμφανίζονται μόνο 1 / X / 2, Over 2.5, Over 3.5, Corners και Offsides που περνούν αυστηρά thresholds πιθανότητας και επιβεβαίωσης.</div>
    </div>`;
  }

  const catColor = c => c==='1X2'?'var(--accent-blue)':c==='GOALS'?'var(--accent-green)':c==='CORNERS'?'var(--accent-gold)':'var(--accent-red)';
  return `<div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;padding:10px 12px;background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.12);border-radius:8px;">
      <div><strong style="color:var(--accent-blue);">📡 APEX RADAR</strong><div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">Μόνο καθαρή υπεροχή μοντέλου — χωρίς bookmaker odds.</div></div>
      <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-muted);">${signals.length} SIGNALS</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:9px;">
      ${signals.map((r,i)=>{
        const col = catColor(r.category);
        const p = Number(r.probability||0);
        const score = Number(r.radarScore||0);
        return `<div onclick="scrollToMatchAndOpen('row-${r.fixId}')" style="display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 14px;background:var(--bg-base);border:1px solid var(--border-light);border-left:4px solid ${col};border-radius:8px;cursor:pointer;transition:all .15s;" onmouseover="this.style.transform='translateY(-1px)';this.style.borderColor='${col}'" onmouseout="this.style.transform='';this.style.borderColor='var(--border-light)'">
          <div style="font-family:var(--font-mono);font-weight:900;font-size:1rem;color:var(--text-dim);text-align:center;">#${i+1}</div>
          <div style="min-width:0;">
            <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:4px;">
              <span style="font-size:.62rem;font-weight:900;color:${col};background:${col}14;border:1px solid ${col}30;border-radius:5px;padding:2px 7px;">${esc(r.category)}</span>
              <span style="font-size:.65rem;color:var(--text-muted);">${esc(r.lg||'')}</span>
              <span style="font-size:.65rem;color:var(--text-dim);">${esc(r.date||'')} ${esc(r.time||'')}</span>
            </div>
            <div style="font-size:.95rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.ht)} <span style="color:var(--text-muted);font-weight:500;">vs</span> ${esc(r.at)}</div>
            <div style="font-size:.86rem;font-weight:900;color:${col};margin-top:4px;">${r.icon} ${esc(r.label)}</div>
            <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px;line-height:1.45;">${esc(r.reason||'')}</div>
          </div>
          <div style="min-width:118px;text-align:right;">
            <div style="font-family:var(--font-mono);font-size:1.22rem;font-weight:900;color:${col};">${score.toFixed(1)}</div>
            <div style="font-size:.58rem;color:var(--text-dim);text-transform:uppercase;font-weight:800;">RADAR SCORE · ${esc(r.grade)}</div>
            <div style="font-family:var(--font-mono);font-size:.72rem;color:var(--text-sub);margin-top:5px;">P ${p.toFixed(1)}%</div>
            <div style="font-size:.62rem;color:var(--text-muted);margin-top:2px;white-space:nowrap;">${esc(r.metric||'')}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ================================================================
//  BEST 4 ENGINE — market-confirmed elite selections (v5.5)
//  • Uses only strong RADAR signals
//  • Fetches ALL bookmakers available for each fixture
//  • Requires best valid market price >= 1.60
//  • One selection per fixture; never pads to four
// ================================================================
const BEST4_MIN_ODDS = 1.60;
const BEST4_MAX_ODDS = 8.00;
const BEST4_MAX_FIXTURES_TO_PRICE = 18;
let best4OddsCache = new BoundedCache(80, CACHE_TTL.ODDS);
let best4Loading = false;

function _best4Norm(s){
  return String(s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ').trim();
}

function _best4PushQuote(store,key,odd,bkName){
  const o=Number(odd);
  if(!key || !Number.isFinite(o) || o<1.01 || o>BEST4_MAX_ODDS) return;
  if(!store[key]) store[key]=[];
  store[key].push({odd:o, bookmaker:bkName||'Bookmaker'});
}

// Robust best price: when 3+ books exist, reject a single quote >25% above median.
// This protects BEST 4 from stale/malformed outliers while still taking the top valid price.
function _best4ChooseQuote(quotes){
  if(!quotes?.length) return null;
  const q=quotes.filter(x=>Number.isFinite(x.odd)&&x.odd>=1.01&&x.odd<=BEST4_MAX_ODDS).sort((a,b)=>a.odd-b.odd);
  if(!q.length) return null;
  const mid=q[Math.floor(q.length/2)].odd;
  const clean=q.length>=3 ? q.filter(x=>x.odd <= mid*1.25) : q;
  const best=(clean.length?clean:q).sort((a,b)=>b.odd-a.odd)[0];
  return {...best, books:q.length, median:mid};
}

/** Parse ALL bookmakers returned by /odds?fixture=... into best-price market keys. */
function parseBestOddsAcrossBookmakers(response){
  const buckets={};
  (response||[]).forEach(item=>{
    (item?.bookmakers||[]).forEach(bk=>{
      const bkName=bk?.name||`Bookmaker ${bk?.id??''}`;
      (bk?.bets||[]).forEach(bet=>{
        const n=_best4Norm(bet?.name);
        const isHalf = n.includes('half') || n.includes('1st') || n.includes('2nd') || n.includes('1st half') || n.includes('2nd half');
        (bet?.values||[]).forEach(v=>{
          const val=_best4Norm(v?.value);
          const odd=parseFloat(v?.odd);
          if(!Number.isFinite(odd)) return;

          // 1X2 / Match Winner — full time only
          if(!isHalf && (n==='match winner' || n==='winner' || n.includes('match winner'))){
            if(val==='home' || val==='1') _best4PushQuote(buckets,'1',odd,bkName);
            else if(val==='draw' || val==='x') _best4PushQuote(buckets,'X',odd,bkName);
            else if(val==='away' || val==='2') _best4PushQuote(buckets,'2',odd,bkName);
          }

          // Match goals totals
          const isGoalsTotal = !isHalf && !n.includes('corner') && !n.includes('offside') &&
            ((n.includes('goals') && (n.includes('over/under')||n.includes('over under')||n.includes('total'))) || n==='goals over/under');
          if(isGoalsTotal){
            if(val==='over 2.5' || val==='o 2.5') _best4PushQuote(buckets,'O2.5',odd,bkName);
            if(val==='over 3.5' || val==='o 3.5') _best4PushQuote(buckets,'O3.5',odd,bkName);
          }

          // Total corners — accept common provider naming variants
          if(!isHalf && n.includes('corner')){
            if((val==='over 8.5'||val==='o 8.5') && !n.includes('home') && !n.includes('away'))
              _best4PushQuote(buckets,'COR O8.5',odd,bkName);
          }

          // Offsides — availability varies by fixture/bookmaker.
          if(!isHalf && n.includes('offside')){
            const isHome=n.includes('home') || n.includes('team 1');
            const isAway=n.includes('away') || n.includes('team 2');
            if(!isHome && !isAway){
              if(val==='over 2.5'||val==='o 2.5') _best4PushQuote(buckets,'OFF TOT O2.5',odd,bkName);
              if(val==='over 3.5'||val==='o 3.5') _best4PushQuote(buckets,'OFF TOT O3.5',odd,bkName);
            }
            if(isHome && (val==='over 1.5'||val==='o 1.5')) _best4PushQuote(buckets,'OFF HOME O1.5',odd,bkName);
            if(isAway && (val==='over 1.5'||val==='o 1.5')) _best4PushQuote(buckets,'OFF AWAY O1.5',odd,bkName);
          }
        });
      });
    });
  });
  const out={};
  Object.keys(buckets).forEach(k=>{ const best=_best4ChooseQuote(buckets[k]); if(best) out[k]=best; });
  return out;
}

async function fetchBestOddsForFixture(fixtureId){
  const k=String(fixtureId);
  if(best4OddsCache.has(k)) return best4OddsCache.get(k);
  // No bookmaker filter: API returns all available bookmakers for the fixture.
  const d=await apiReq(`odds?fixture=${fixtureId}`,{priority:'low',cacheMs:CACHE_TTL.ODDS});
  const parsed=parseBestOddsAcrossBookmakers(d?.response||[]);
  best4OddsCache.set(k,parsed);
  return parsed;
}

function _best4MarketKey(signal){
  if(!signal) return null;
  if(signal.category==='1X2') return signal.market; // 1 / X / 2
  if(signal.category==='GOALS') return signal.market; // O2.5 / O3.5
  if(signal.category==='CORNERS') return 'COR O8.5';
  if(signal.category==='OFFSIDES'){
    const l=String(signal.label||'').toUpperCase();
    if(l.includes('ΣΥΝΟΛΟ') && l.includes('2.5')) return 'OFF TOT O2.5';
    if(l.includes('ΣΥΝΟΛΟ') && l.includes('3.5')) return 'OFF TOT O3.5';
    if(l.includes('HOME') && l.includes('1.5')) return 'OFF HOME O1.5';
    if(l.includes('AWAY') && l.includes('1.5')) return 'OFF AWAY O1.5';
  }
  return null;
}

function _best4EligibleSignal(s){
  const p=Number(s?.probability||0), r=Number(s?.radarScore||0);
  if(r<80) return false;
  if(s.category==='1X2'){
    if(s.market==='1'||s.market==='2') return p>=62 && Number(s.dominanceGap||0)>=10;
    if(s.market==='X') return p>=38 && Number(s.dominanceGap||0)>=4;
    return false;
  }
  if(s.category==='GOALS' && s.market==='O2.5') return p>=68;
  if(s.category==='GOALS' && s.market==='O3.5') return p>=58;
  if(s.category==='CORNERS') return p>=72;
  if(s.category==='OFFSIDES') return p>=72;
  return false;
}

function _best4ProbQuality(signal){
  const p=Number(signal.probability||0);
  if(signal.category==='1X2' && signal.market==='X') return clamp((p-30)/20*100,0,100);
  if(signal.category==='1X2') return clamp((p-50)/25*100,0,100);
  if(signal.category==='GOALS' && signal.market==='O3.5') return clamp((p-45)/25*100,0,100);
  return clamp((p-55)/25*100,0,100);
}

function _best4DataQuality(rec){
  if(!rec) return 50;
  let q=68;
  if(rec.lineupData?.available) q+=10;
  const hsd=Number(rec.hS?.r6?.sdGoals), asd=Number(rec.aS?.r6?.sdGoals);
  if(Number.isFinite(hsd) && hsd<=1.10) q+=5;
  if(Number.isFinite(asd) && asd<=1.10) q+=5;
  if(rec.hInjAdj && rec.aInjAdj) q+=4;
  const fallback = Math.abs(Number(rec.hXGfinal||0)-1.10)<0.02 && Math.abs(Number(rec.aXGfinal||0)-1.10)<0.02;
  if(fallback) q-=35;
  return clamp(q,0,100);
}

function renderBest4Tab(items){
  if(best4Loading && (!items||!items.length)){
    return `<div style="text-align:center;padding:34px 20px;color:var(--text-muted);"><div style="font-size:2.2rem;margin-bottom:10px;">🏆</div><div style="font-weight:900;color:var(--text-main);">BEST 4 — φόρτωση αποδόσεων αγοράς…</div><div style="font-size:.8rem;margin-top:7px;">Συγκρίνω όλους τους διαθέσιμους bookmakers για τα ισχυρότερα RADAR signals.</div></div>`;
  }
  if(!items?.length){
    return `<div style="text-align:center;padding:34px 20px;color:var(--text-muted);">
      <div style="font-size:2.2rem;margin-bottom:10px;">🏆</div>
      <div style="font-weight:900;color:var(--text-main);margin-bottom:6px;">BEST 4</div>
      <div style="font-size:.82rem;line-height:1.6;max-width:680px;margin:0 auto;">Δεν υπάρχουν ακόμη επιλογές που να περνούν ταυτόχρονα τα αυστηρά φίλτρα του RADAR και πραγματική καλύτερη διαθέσιμη απόδοση ≥ ${BEST4_MIN_ODDS.toFixed(2)}. Το σύστημα δεν συμπληρώνει τεχνητά τέσσερις επιλογές.</div>
      <button class="btn btn-primary" style="margin-top:14px;" onclick="window.refreshBest4()">↻ Έλεγχος αποδόσεων</button>
    </div>`;
  }
  const catColor=c=>c==='1X2'?'var(--accent-blue)':c==='GOALS'?'var(--accent-green)':c==='CORNERS'?'var(--accent-gold)':'var(--accent-red)';
  return `<div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;padding:11px 13px;background:rgba(217,119,6,.06);border:1px solid rgba(217,119,6,.16);border-radius:9px;">
      <div><strong style="color:var(--accent-gold);">🏆 APEX BEST 4</strong><div style="font-size:.72rem;color:var(--text-muted);margin-top:3px;">Ισχυρό RADAR + καλύτερη έγκυρη απόδοση αγοράς ≥ ${BEST4_MIN_ODDS.toFixed(2)} · έως 1 επιλογή ανά αγώνα.</div></div>
      <button class="btn btn-outline" style="height:32px;font-size:.72rem;" onclick="window.refreshBest4()">↻ Refresh Odds</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(285px,1fr));gap:10px;">
    ${items.map((x,i)=>{
      const col=catColor(x.category); const p=Number(x.probability||0); const o=Number(x.bestOdds||0); const fair=Number(x.fairOdds||0);
      return `<div onclick="scrollToMatchAndOpen('row-${x.fixId}')" style="padding:14px;background:var(--bg-base);border:1px solid var(--border-light);border-top:4px solid ${col};border-radius:9px;cursor:pointer;box-shadow:var(--shadow-sm);">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div style="font-family:var(--font-mono);font-size:1.25rem;font-weight:900;color:var(--accent-gold);">#${i+1}</div>
          <div style="text-align:right;"><div style="font-family:var(--font-mono);font-size:1.25rem;font-weight:900;color:${col};">${Number(x.best4Score||0).toFixed(1)}</div><div style="font-size:.56rem;color:var(--text-dim);font-weight:800;">ROBUST SCORE · ${esc(x.grade||'')}</div></div>
        </div>
        <div style="font-size:.94rem;font-weight:900;margin-top:5px;">${esc(x.ht)} <span style="color:var(--text-muted);font-weight:500;">vs</span> ${esc(x.at)}</div>
        <div style="font-size:.70rem;color:var(--text-muted);margin-top:2px;">${esc(x.lg||'')} · ${esc(x.date||'')} ${esc(x.time||'')}</div>
        <div style="font-size:.90rem;font-weight:900;color:${col};margin-top:9px;">${x.icon||'🎯'} ${esc(x.label)}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px;">
          <div style="background:var(--bg-surface);padding:7px;border-radius:6px;text-align:center;"><div style="font-size:.56rem;color:var(--text-dim);">MODEL P</div><b style="font-family:var(--font-mono);">${p.toFixed(1)}%</b></div>
          <div style="background:var(--bg-surface);padding:7px;border-radius:6px;text-align:center;"><div style="font-size:.56rem;color:var(--text-dim);">FAIR ODDS</div><b style="font-family:var(--font-mono);">${fair.toFixed(2)}</b></div>
          <div style="background:rgba(22,163,74,.08);padding:7px;border-radius:6px;text-align:center;border:1px solid rgba(22,163,74,.14);"><div style="font-size:.56rem;color:var(--text-dim);">BEST ODDS</div><b style="font-family:var(--font-mono);color:var(--accent-green);">${o.toFixed(2)}</b></div>
        </div>
        <div style="font-size:.71rem;color:var(--text-muted);margin-top:9px;line-height:1.45;">${esc(x.reason||'')}</div>
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:9px;padding-top:8px;border-top:1px solid var(--border);font-size:.68rem;">
          <span style="color:var(--text-muted);">${esc(x.bookmaker||'Bookmaker')} · ${x.books||1} books</span>
          <span style="font-family:var(--font-mono);font-weight:800;color:${Number(x.marketEdge||0)>0?'var(--accent-green)':'var(--text-muted)'};">Edge ${Number(x.marketEdge||0)>=0?'+':''}${Number(x.marketEdge||0).toFixed(1)}pp</span>
        </div>
      </div>`;
    }).join('')}
    </div>
    ${items.length<4?`<div style="margin-top:10px;font-size:.72rem;color:var(--text-muted);">Μόνο ${items.length} επιλογ${items.length===1?'ή':'ές'} πέρασ${items.length===1?'ε':'αν'} όλα τα φίλτρα σήμερα — δεν συμπληρώνω τεχνητά τη λίστα.</div>`:''}
  </div>`;
}

window.refreshBest4 = async function(opts={}){
  if(best4Loading) return latestTopLists.best4||[];
  const radar=(latestTopLists.radar||[]).filter(_best4EligibleSignal);
  if(!radar.length){ latestTopLists.best4=[]; renderTopSections(); return []; }
  best4Loading=true;
  latestTopLists.best4=[];
  renderTopSections();
  try{
    // Price strongest distinct fixtures first; maximum keeps quota predictable.
    const fixtureIds=[];
    for(const s of radar){ if(!fixtureIds.includes(s.fixId)) fixtureIds.push(s.fixId); if(fixtureIds.length>=BEST4_MAX_FIXTURES_TO_PRICE) break; }
    const priceMap=new Map();
    const batchSize=Math.max(2,Math.min(5,Math.ceil((API_RATE?.maxConcurrent||4)/2)));
    let done=0;
    for(let i=0;i<fixtureIds.length;i+=batchSize){
      const batch=fixtureIds.slice(i,i+batchSize);
      await Promise.all(batch.map(async id=>{ try{ priceMap.set(id,await fetchBestOddsForFixture(id)); }catch{ priceMap.set(id,{}); } finally{done++; if(!opts.silent)setProgress(done/fixtureIds.length*100,`BEST 4 odds ${done}/${fixtureIds.length}`);} }));
    }

    const recMap=new Map((window.scannedMatchesData||[]).map(r=>[r.fixId,r]));
    const priced=[];
    radar.forEach(s=>{
      const key=_best4MarketKey(s); if(!key) return;
      const q=priceMap.get(s.fixId)?.[key]; if(!q || Number(q.odd)<BEST4_MIN_ODDS) return;
      const p=Number(s.probability||0)/100; if(!(p>0)) return;
      const fair=1/p;
      const implied=1/Number(q.odd);
      const edge=(p-implied)*100;
      if(edge<=0) return;
      const rec=recMap.get(s.fixId);
      const dq=_best4DataQuality(rec);
      const pq=_best4ProbQuality(s);
      const robust=clamp(Number(s.radarScore||0)*0.65 + pq*0.25 + dq*0.10,0,99);
      const grade=robust>=90?'A+':robust>=85?'A':robust>=80?'B+':'B';
      priced.push({...s,bestOdds:Number(q.odd),bookmaker:q.bookmaker,books:q.books||1,medianOdds:q.median||null,fairOdds:fair,impliedProb:implied*100,marketEdge:edge,best4Score:robust,grade,dataQuality:dq});
    });

    priced.sort((a,b)=>b.best4Score-a.best4Score || b.probability-a.probability || b.marketEdge-a.marketEdge);
    const chosen=[], seenFix=new Set();
    for(const x of priced){
      if(seenFix.has(x.fixId)) continue;
      chosen.push(x); seenFix.add(x.fixId);
      if(chosen.length===4) break;
    }
    latestTopLists.best4=chosen;
    return chosen;
  } finally{
    best4Loading=false;
    renderTopSections();
  }
};

function buildValueBetsList() {
  const sd = window.scannedMatchesData || [];
  const allBets = [];
  sd.forEach(rec => {
    if(rec.valueBets?.length) allBets.push(...rec.valueBets);
  });
  // Ταξινόμηση κατά EV% DESC → top 10
  latestTopLists.valueBets = allBets
    .sort((a, b) => b.ev - a.ev)
    .slice(0, 10);
}

function renderValueBetsTab(bets) {
  if(!bets?.length) {
    return `<div style="text-align:center;color:var(--text-muted);padding:30px 20px;">
      <div style="font-size:2rem;margin-bottom:10px;">💰</div>
      <div style="font-weight:700;margin-bottom:6px;">Δεν υπάρχουν Value Bets ακόμα</div>
      <div style="font-size:0.82rem;">Πατήστε <b>Αποδόσεις</b> για φόρτωση από ${ODDS_BOOKMAKER_NAME}</div>
    </div>`;
  }

  const rows = bets.map((b, i) => {
    const rankColors = ['var(--accent-gold)', 'rgba(192,192,192,0.9)', 'rgba(205,127,50,0.9)'];
    const rankCol    = rankColors[i] || 'var(--text-dim)';
    const evColor    = b.ev >= 5 ? 'var(--accent-green)' : b.ev >= 2.5 ? 'var(--accent-teal)' : 'var(--accent-blue)';
    const edgeColor  = b.edge >= 8 ? 'var(--accent-green)' : b.edge >= 4 ? 'var(--accent-gold)' : 'var(--text-muted)';
    const kellyStr   = b.kelly > 0 ? `€${b.kelly.toFixed(0)}` : '—';
    const marketBadgeColor = b.market.includes('1X2') ? 'var(--accent-blue)' :
                             b.market.includes('Πάνω') ? 'var(--accent-green)' :
                             b.market.includes('Κάτω') ? 'var(--accent-teal)' : 'var(--accent-gold)';

    return `
    <div onclick="scrollToMatch('row-${b.fixId}')" style="display:flex;align-items:stretch;gap:0;background:var(--bg-base);border:1px solid var(--border-light);border-radius:var(--radius-sm);cursor:pointer;overflow:hidden;transition:border-color 0.15s;" onmouseover="this.style.borderColor='var(--accent-blue)'" onmouseout="this.style.borderColor='var(--border-light)'">

      <!-- Rank -->
      <div style="display:flex;align-items:center;justify-content:center;min-width:44px;background:rgba(255,255,255,0.03);border-right:1px solid var(--border-light);font-family:var(--font-mono);font-size:1.1rem;font-weight:900;color:${rankCol};">#${i+1}</div>

      <!-- Match info -->
      <div style="flex:1;padding:12px 14px;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
          <span style="font-size:0.6rem;font-weight:800;color:${marketBadgeColor};background:${marketBadgeColor}18;border:1px solid ${marketBadgeColor}33;border-radius:4px;padding:1px 7px;white-space:nowrap;">${esc(b.market)}</span>
          <span style="font-size:0.65rem;color:var(--text-muted);">${esc(b.lg)}</span>
          <span style="font-size:0.65rem;color:var(--text-dim);">${b.date} ${b.time}</span>
        </div>
        <div style="font-weight:700;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(b.match)}</div>
        <div style="font-size:0.8rem;color:var(--accent-green);font-weight:600;margin-top:3px;">${esc(b.label)}</div>
        <div style="display:flex;gap:12px;margin-top:6px;font-size:0.68rem;color:var(--text-muted);flex-wrap:wrap;">
          <span>Μοντέλο: <strong style="color:var(--text-main);">${b.modelProb}%</strong></span>
          <span>Implied: <strong>${b.impliedProb}%</strong></span>
          <span>Edge: <strong style="color:${edgeColor};">+${b.edge}%</strong></span>
          <span style="font-size:0.62rem;color:var(--text-muted);">via ${b.bookmaker}</span>
        </div>
      </div>

      <!-- Metrics -->
      <div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:center;padding:12px 16px;gap:6px;min-width:130px;border-left:1px solid var(--border-light);">
        <div style="text-align:right;">
          <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Απόδοση</div>
          <div style="font-family:var(--font-mono);font-size:1.5rem;font-weight:900;color:var(--text-main);line-height:1.1;">${b.decOdds.toFixed(2)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">EV%</div>
          <div style="font-family:var(--font-mono);font-size:1.2rem;font-weight:900;color:${evColor};">+${b.ev.toFixed(1)}%</div>
        </div>
        ${b.kelly > 0 ? `
        <div style="text-align:right;">
          <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Kelly (25%)</div>
          <div style="font-family:var(--font-mono);font-size:0.9rem;font-weight:800;color:var(--accent-gold);">${kellyStr}</div>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');

  // Summary stats
  const totalEV = bets.reduce((s, b) => s + b.ev, 0);
  const avgEV   = bets.length ? (totalEV / bets.length).toFixed(1) : 0;
  const topBet  = bets[0];

  return `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
      <div style="background:var(--bg-base);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:10px;text-align:center;">
        <div style="font-size:0.62rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:3px;">Top EV%</div>
        <div style="font-family:var(--font-mono);font-size:1.4rem;font-weight:900;color:var(--accent-green);">+${topBet?.ev.toFixed(1)||0}%</div>
      </div>
      <div style="background:var(--bg-base);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:10px;text-align:center;">
        <div style="font-size:0.62rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:3px;">Μέσος EV%</div>
        <div style="font-family:var(--font-mono);font-size:1.4rem;font-weight:900;color:var(--accent-teal);">+${avgEV}%</div>
      </div>
      <div style="background:var(--bg-base);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:10px;text-align:center;">
        <div style="font-size:0.62rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:3px;">Bookmaker</div>
        <div style="font-size:0.9rem;font-weight:900;color:var(--text-main);">${ODDS_BOOKMAKER_NAME}</div>
      </div>
    </div>
    <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:12px;padding:8px 12px;background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.15);border-radius:6px;">
      💡 <strong>Value Bet</strong> = αγορά όπου η πιθανότητα του μοντέλου είναι υψηλότερη από την implied probability του bookmaker. EV ≥ +${(MIN_EV_THRESHOLD*100).toFixed(0)}% για εμφάνιση.
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">${rows}</div>`;
}

// ================================================================
//  💣 BOMBS ENGINE — Υψηλή απόδοση + υψηλή πιθανότητα επαλήθευσης
//
//  Κριτήρια επιλογής:
//  1. Implied probability (από Poisson model) ≥ 25%
//  2. Implied odds ≥ 3.80 (αν υπάρχουν bookmaker odds)
//     ή model-derived fair odds ≥ 3.80 (αν ΔΕΝ υπάρχουν odds)
//  3. Composite Bomb Score βάσει:
//     - Model probability (weighted 35%)
//     - Form consistency (25%) — last 6 form rating
//     - Stability (20%) — χαμηλό σ στα γκολ
//     - Lineup quality (10%) — coverage ≥ 90%
//     - Injury impact (10%) — penalty αν key players out
// ================================================================

const BOMB_MIN_PROB  = 0.70;   // ≥70% model prob (aligned με MIN_CONF)
const BOMB_MIN_ODDS  = 3.80;   // ≥3.80 fair odds
const BOMB_MAX_ODDS  = 18.0;   // ≤18.0 (πολύ ακραία odds = ανεπαρκή sample)

function computeBombScore(rec) {
  if(!rec || !rec.pp) return null;

  const pp      = rec.pp;
  const hS      = rec.hS || {};
  const aS      = rec.aS || {};
  const odds    = rec.odds || {};  // bookmaker odds αν υπάρχουν

  // ── Βρίσκουμε ποια αγορά είναι bomb candidate ──────────────────
  const candidates = [];

  const tryCandidate = (market, modelProb, label, icon, bookOdds) => {
    if(modelProb <= 0 || modelProb > 0.95) return;
    const fairOdds = parseFloat((1 / modelProb).toFixed(2));
    // Επιλέγουμε: bookmaker odds αν υπάρχουν, αλλιώς fair odds
    const effectiveOdds = (bookOdds && bookOdds > 1.5 && bookOdds <= BOMB_MAX_ODDS)
      ? bookOdds : fairOdds;

    if(effectiveOdds < BOMB_MIN_ODDS) return;
    if(modelProb < BOMB_MIN_PROB) return;
    if(effectiveOdds > BOMB_MAX_ODDS) return;

    // ── Composite Score ──────────────────────────────────────────
    // 1. Model probability component (0–35)
    const probScore = clamp((modelProb - BOMB_MIN_PROB) / (0.60 - BOMB_MIN_PROB) * 35, 0, 35);

    // 2. Form consistency (0–25): μέσος όρος form rating two teams
    const hForm = safeNum(hS.formRating, 50);
    const aForm = safeNum(aS.formRating, 50);
    const avgForm = (hForm + aForm) / 2;
    const formScore = clamp((avgForm - 30) / 70 * 25, 0, 25);

    // 3. Stability score (0–20): αν σ < 0.83 (STABLE) per team
    const hSD = hS.r6?.sdGoals;
    const aSD = aS.r6?.sdGoals;
    const hStab = hSD !== null && hSD < 0.83 ? 10 : hSD < 1.21 ? 5 : 0;
    const aStab = aSD !== null && aSD < 0.83 ? 10 : aSD < 1.21 ? 5 : 0;
    const stabScore = hStab + aStab; // max 20

    // 4. Lineup quality (0–10)
    const hCov = rec.lineupData?.available ? (rec.hInjAdj?.coverage ?? 0.85) : 0.80;
    const aCov = rec.lineupData?.available ? (rec.aInjAdj?.coverage ?? 0.85) : 0.80;
    const lineupScore = clamp(((hCov + aCov) / 2 - 0.6) / 0.4 * 10, 0, 10);

    // 5. Injury penalty (0 to −10)
    const hInjDelta = rec.hInjAdj?.delta || 0;
    const aInjDelta = rec.aInjAdj?.delta || 0;
    const injPenalty = clamp((hInjDelta + aInjDelta) * 15, -10, 0);

    // 6. DC / Situational bonus (0–5)
    const dcTrust = rec.dcResult?.trust || 0;
    const sitBonus = dcTrust > 0.6 ? 3 : dcTrust > 0.3 ? 1 : 0;
    const derbyPenalty = rec.sitCtx?.isDerby ? -3 : 0; // derbies more unpredictable
    const motBonus = (rec.sitCtx?.hMot > 1.05 || rec.sitCtx?.aMot > 1.05) ? 2 : 0;

    const totalScore = Math.round(
      probScore + formScore + stabScore + lineupScore +
      injPenalty + sitBonus + derbyPenalty + motBonus
    );

    candidates.push({
      market, label, icon, modelProb, fairOdds, effectiveOdds,
      hasBookOdds: !!(bookOdds && bookOdds > 1.5),
      bombScore: clamp(totalScore, 0, 100),
      breakdown: { probScore, formScore, stabScore, lineupScore, injPenalty, sitBonus }
    });
  };

  // Ελέγχουμε κάθε αγορά
  tryCandidate('Πάνω 3.5', pp.pO35, 'ΠΑΝΩ ΑΠΟ 3.5 ΓΚΟΛ',  '🚀', odds.over35);
  tryCandidate('Πάνω 2.5', pp.pO25, 'ΠΑΝΩ ΑΠΟ 2.5 ΓΚΟΛ',  '🔥', odds.over25);
  tryCandidate('Κάτω 2.5', pp.pU25, 'ΚΑΤΩ ΑΠΟ 2.5 ΓΚΟΛ',  '🔒', odds.under25);
  tryCandidate('ΓΓ',       pp.pBTTS,'ΓΚΟΛ/ΓΚΟΛ (GG)',       '🎯', odds.bttsY);
  tryCandidate('Νίκη 🏠',  pp.pHome,'ΝΙΚΗ ΓΗΠΕΔΟΥΧΩΝ',      '🏠', odds.home);
  tryCandidate('Νίκη ✈️',  pp.pAway,'ΝΙΚΗ ΦΙΛΟΞΕΝΟΥΜΕΝΩΝ',  '✈️', odds.away);
  tryCandidate('Ισοπαλία', pp.pDraw,'ΙΣΟΠΑΛΙΑ',             '🤝', odds.draw);

  if(!candidates.length) return null;

  // Ο καλύτερος candidate βάσει bombScore
  const best = candidates.sort((a,b) => b.bombScore - a.bombScore)[0];
  return { ...best, allCandidates: candidates.slice(0,3) };
}

function buildBombsList() {
  const sd = (window.scannedMatchesData || []).filter(x => !isFinished(x.m?.fixture?.status?.short));
  const bombs = [];

  sd.forEach(rec => {
    const bomb = computeBombScore(rec);
    if(!bomb || bomb.bombScore < 35) return; // minimum quality threshold
    bombs.push({
      fixId:    rec.fixId,
      ht:       rec.ht,
      at:       rec.at,
      lg:       rec.lg,
      date:     rec.m?.fixture?.date?.split('T')[0] || '',
      time:     rec.m?.fixture?.date?.split('T')[1]?.slice(0,5) || '',
      hFormRating: rec.hS?.formRating || 50,
      aFormRating: rec.aS?.formRating || 50,
      hSdGoals:    rec.hS?.r6?.sdGoals,
      aSdGoals:    rec.aS?.r6?.sdGoals,
      hasLineup:   rec.lineupData?.available,
      hasInjury:   (rec.hInjAdj?.delta < -0.05 || rec.aInjAdj?.delta < -0.05),
      sitCtx:      rec.sitCtx,
      tXG:         rec.tXG,
      omegaPick:   rec.omegaPick,
      ...bomb
    });
  });

  latestTopLists.bombs = bombs.sort((a,b) => b.bombScore - a.bombScore).slice(0,8);
}

function renderBombsTab(bombs) {
  if(!bombs?.length) return `
    <div style="text-align:center;color:var(--text-muted);padding:36px 20px;">
      <div style="font-size:2.5rem;margin-bottom:10px;">💣</div>
      <div style="font-weight:800;font-size:1rem;margin-bottom:6px;">Δεν βρέθηκαν Bombs</div>
      <div style="font-size:0.8rem;line-height:1.6;">Χρειάζονται αγώνες με model prob ≥70% και fair odds ≥3.80.<br>Ελέγξτε τα Global Engine Parameters ή δοκιμάστε με περισσότερα πρωταθλήματα.</div>
    </div>`;

  const scoreBar = (val, max, color) => {
    const w = clamp(Math.round((val/max)*100), 0, 100);
    return `<div style="background:var(--border-light);border-radius:3px;height:4px;margin-top:2px;"><div style="height:4px;width:${w}%;background:${color};border-radius:3px;"></div></div>`;
  };

  const bombColor = score => score >= 75 ? 'var(--accent-green)' : score >= 55 ? 'var(--accent-gold)' : 'var(--text-muted)';
  const oddsColor = odds => odds >= 7.0 ? 'var(--accent-purple)' : odds >= 5.0 ? 'var(--accent-red)' : odds >= 3.8 ? 'var(--accent-gold)' : 'var(--text-muted)';

  return `
  <div style="margin-bottom:12px;padding:10px 14px;background:rgba(244,63,94,0.06);border:1px solid rgba(244,63,94,0.25);border-radius:8px;font-size:0.75rem;color:var(--text-muted);">
    💣 <strong style="color:var(--accent-red);">Bombs</strong> — Αγορές με model prob ≥ ${(BOMB_MIN_PROB*100).toFixed(0)}% και fair odds ≥ ${BOMB_MIN_ODDS.toFixed(2)}. Βαθμολογία βάσει φόρμας, σταθερότητας, lineup και xG.
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;">
  ${bombs.map((b,i) => {
    const hStabLbl = b.hSdGoals < 0.83 ? '✅ STABLE' : b.hSdGoals < 1.21 ? '➡️ NORMAL' : '⚠️ VOLATILE';
    const aStabLbl = b.aSdGoals < 0.83 ? '✅ STABLE' : b.aSdGoals < 1.21 ? '➡️ NORMAL' : '⚠️ VOLATILE';
    const bCol     = bombColor(b.bombScore);

    return `
    <div style="background:var(--bg-base);border:1px solid ${b.bombScore>=70?'rgba(244,63,94,0.4)':'var(--border-light)'};border-radius:var(--radius-sm);overflow:hidden;${b.bombScore>=70?'box-shadow:0 0 12px rgba(244,63,94,0.15);':''}">

      <!-- Header row -->
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:${b.bombScore>=70?'rgba(244,63,94,0.06)':'transparent'};">
        <div style="font-family:var(--font-mono);font-size:0.9rem;color:var(--text-dim);min-width:26px;text-align:center;">#${i+1}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:0.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(b.ht)} vs ${esc(b.at)}</div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:1px;">${esc(b.lg)} · ${b.date} ${b.time}</div>
        </div>
        <!-- Odds box -->
        <div style="text-align:center;min-width:64px;background:rgba(0,0,0,0.15);border-radius:6px;padding:6px 10px;">
          <div style="font-family:var(--font-mono);font-size:1.4rem;font-weight:900;color:${oddsColor(b.effectiveOdds)};line-height:1;">${b.effectiveOdds.toFixed(2)}</div>
          <div style="font-size:0.62rem;color:var(--text-muted);text-transform:uppercase;margin-top:1px;">${b.hasBookOdds?'PINNACLE':'FAIR ODDS'}</div>
        </div>
        <!-- Bomb score -->
        <div style="text-align:center;min-width:52px;">
          <div style="font-family:var(--font-mono);font-size:1.3rem;font-weight:900;color:${bCol};line-height:1;">${b.bombScore}</div>
          <div style="font-size:0.62rem;color:var(--text-muted);text-transform:uppercase;">SCORE</div>
        </div>
      </div>

      <!-- Pick -->
      <div style="padding:8px 14px;border-top:1px solid var(--border-light);display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-size:0.85rem;font-weight:800;color:var(--accent-green);">${b.icon} ${esc(b.label)}</span>
        <span style="font-size:0.72rem;font-family:var(--font-mono);color:var(--accent-blue);">Πιθ. ${(b.modelProb*100).toFixed(1)}%</span>
        <span style="font-size:0.72rem;font-family:var(--font-mono);color:var(--text-muted);">Fair odds: ${b.fairOdds.toFixed(2)}</span>
      </div>

      <!-- Factors grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:5px;padding:8px 14px;border-top:1px solid var(--border-light);">
        <div style="background:var(--bg-surface);border-radius:5px;padding:6px 8px;">
          <div style="font-size:0.62rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:2px;">Φόρμα 🏠</div>
          <div style="font-size:0.8rem;font-weight:700;font-family:var(--font-mono);color:${b.hFormRating>=65?'var(--accent-green)':b.hFormRating>=40?'var(--accent-gold)':'var(--accent-red)'};">${b.hFormRating}%</div>
          ${scoreBar(b.hFormRating, 100, b.hFormRating>=65?'var(--accent-green)':b.hFormRating>=40?'var(--accent-gold)':'var(--accent-red)')}
        </div>
        <div style="background:var(--bg-surface);border-radius:5px;padding:6px 8px;">
          <div style="font-size:0.62rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:2px;">Φόρμα ✈️</div>
          <div style="font-size:0.8rem;font-weight:700;font-family:var(--font-mono);color:${b.aFormRating>=65?'var(--accent-green)':b.aFormRating>=40?'var(--accent-gold)':'var(--accent-red)'};">${b.aFormRating}%</div>
          ${scoreBar(b.aFormRating, 100, b.aFormRating>=65?'var(--accent-green)':b.aFormRating>=40?'var(--accent-gold)':'var(--accent-red)')}
        </div>
        <div style="background:var(--bg-surface);border-radius:5px;padding:6px 8px;">
          <div style="font-size:0.62rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:2px;">Σταθ. 🏠</div>
          <div style="font-size:0.72rem;font-weight:700;">${b.hSdGoals!==null&&b.hSdGoals!==undefined?hStabLbl:'—'}</div>
        </div>
        <div style="background:var(--bg-surface);border-radius:5px;padding:6px 8px;">
          <div style="font-size:0.62rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:2px;">Σταθ. ✈️</div>
          <div style="font-size:0.72rem;font-weight:700;">${b.aSdGoals!==null&&b.aSdGoals!==undefined?aStabLbl:'—'}</div>
        </div>
        <div style="background:var(--bg-surface);border-radius:5px;padding:6px 8px;">
          <div style="font-size:0.62rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:2px;">xG</div>
          <div style="font-size:0.8rem;font-weight:700;font-family:var(--font-mono);color:var(--accent-blue);">${Number(b.tXG||0).toFixed(2)}</div>
        </div>
        ${b.hasLineup ? `<div style="background:rgba(45,212,191,0.08);border:1px solid rgba(45,212,191,0.2);border-radius:5px;padding:6px 8px;"><div style="font-size:0.72rem;font-weight:700;color:var(--accent-teal);">📋 Lineup ✓</div></div>` : ''}
        ${b.hasInjury ? `<div style="background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.2);border-radius:5px;padding:6px 8px;"><div style="font-size:0.72rem;font-weight:700;color:var(--accent-red);">🏥 Τραυμ.</div></div>` : ''}
        ${b.sitCtx?.isDerby ? `<div style="background:rgba(244,63,94,0.08);border-radius:5px;padding:6px 8px;"><div style="font-size:0.72rem;font-weight:700;color:var(--accent-red);">🔥 Derby</div></div>` : ''}
      </div>

      <!-- Score breakdown -->
      <div style="padding:6px 14px 10px;border-top:1px solid var(--border-light);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:0.65rem;color:var(--text-dim);text-transform:uppercase;font-weight:700;">Bomb Score Breakdown</span>
          <span style="font-size:0.65rem;font-family:var(--font-mono);font-weight:800;color:${bCol};">${b.bombScore}/100</span>
        </div>
        <div style="display:flex;gap:3px;">
          ${[
            {lbl:'Πιθ.', v: b.breakdown.probScore,  max:35, col:'var(--accent-blue)'},
            {lbl:'Φόρμα', v: b.breakdown.formScore, max:25, col:'var(--accent-green)'},
            {lbl:'Σταθ.', v: b.breakdown.stabScore, max:20, col:'var(--accent-teal)'},
            {lbl:'Lineup', v: b.breakdown.lineupScore, max:10, col:'var(--accent-purple)'},
          ].map(s => `<div style="flex:${s.max};background:${s.col}20;border-radius:3px;height:16px;position:relative;overflow:hidden;" title="${s.lbl}: ${s.v.toFixed(0)}/${s.max}">
            <div style="height:16px;width:${clamp(s.v/s.max*100,0,100)}%;background:${s.col};border-radius:3px;"></div>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:0.45rem;color:#fff;font-weight:800;white-space:nowrap;">${s.lbl}</div>
          </div>`).join('')}
        </div>
      </div>

      <!-- Actions -->
      <div style="padding:8px 14px;border-top:1px solid var(--border-light);display:flex;gap:8px;">
        <button onclick="scrollToMatchAndOpen('row-${b.fixId}')" style="flex:1;padding:7px;background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.3);color:var(--accent-red);border-radius:6px;cursor:pointer;font-weight:700;font-size:0.75rem;">💣 Πλήρης Ανάλυση</button>
        <button onclick="window.openLogBetModal('${b.fixId}')" style="padding:7px 14px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:var(--accent-green);border-radius:6px;cursor:pointer;font-weight:700;font-size:0.75rem;">📒</button>
      </div>
    </div>`;
  }).join('')}
  </div>`;
}
function rebuildTopLists(){
  // New scan/re-simulation invalidates the previous BEST 4 until odds are repriced.
  latestTopLists.best4 = [];
  const MIN_CONF = 70;
  const sd = (window.scannedMatchesData||[]).filter(x =>
    !isFinished(x.m?.fixture?.status?.short) &&
    !x.omegaPick?.includes('ΧΩΡΙΣ') &&
    (x.strength||0) >= MIN_CONF
  );
  latestTopLists.combo1   =sd.filter(x=>x.omegaPick?.includes('⚡')||x.omegaPick?.includes('💣')).sort((a,b)=>b.strength-a.strength).slice(0,6);
  latestTopLists.outcomes =sd.filter(x=>x.omegaPick?.includes('ΑΣΟΣ')||x.omegaPick?.includes('ΝΙΚΗ')||x.omegaPick?.includes('ΔΙΠΛΟ')).sort((a,b)=>b.strength-a.strength).slice(0,6);
  latestTopLists.exact    =[...sd].sort((a,b)=>(b.exactConf||0)-(a.exactConf||0)).slice(0,6);
  latestTopLists.over25   =sd.filter(x=>x.omegaPick?.includes('ΠΑΝΩ')).sort((a,b)=>b.strength-a.strength).slice(0,6);
  latestTopLists.corners  =sd.filter(x=>x.omegaPick?.includes('ΚΟΡΝΕΡ')).sort((a,b)=>b.cornerConf-a.cornerConf).slice(0,6);

  // 🚫 OFFSIDES — ανεξάρτητη αγορά από το κύριο omegaPick
  // Περιλαμβάνει όλους τους ενεργούς αγώνες με επαρκή offside confidence.
  latestTopLists.offsides = (window.scannedMatchesData||[])
    .filter(x => !isFinished(x.m?.fixture?.status?.short) && x.offside && (x.offside.bestProb||0) >= 65)
    .sort((a,b) => (b.offside?.bestProb||0) - (a.offside?.bestProb||0))
    .slice(0,12);

  // 📡 RADAR — αυτόνομη κατάταξη σαφών model signals
  buildRadarList();
  // Build bombs
  buildBombsList();

  // ── Σίγουρη Τριάδα: multi-factor certainty score ──────────────────
  const scored = sd.filter(x => x.omegaPick && !x.omegaPick.includes('ΧΩΡΙΣ') && (x.strength||0) >= 70).map(x => {
    const pickProb   = x.strength || 0;
    const hStab      = x.hS?.r6?.sdGoals < 1.10*0.75 ? 15 : x.hS?.r6?.sdGoals < 1.10*1.10 ? 5 : 0;
    const aStab      = x.aS?.r6?.sdGoals < 1.10*0.75 ? 15 : x.aS?.r6?.sdGoals < 1.10*1.10 ? 5 : 0;
    const lineupBonus = x.lineupData?.available ? 8 : 0;
    const injPenalty  = ((x.hInjAdj?.delta||0) + (x.aInjAdj?.delta||0)) * -20;
    const hCons       = Math.abs((x.hS?.fXG||1.2) - (x.hS?.sea?.avgGoals||1.2)) < 0.3 ? 8 : 0;
    const aCons       = Math.abs((x.aS?.fXG||1.2) - (x.aS?.sea?.avgGoals||1.2)) < 0.3 ? 8 : 0;
    return { ...x, _certaintyScore: Math.round(pickProb + hStab + aStab + lineupBonus + injPenalty + hCons + aCons) };
  });
  latestTopLists.top3Certainty = scored.sort((a,b) => b._certaintyScore - a._certaintyScore).slice(0, 3);

  // 👥 PLAYERS
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
  if(!latestTopLists.best4) latestTopLists.best4 = [];
  if(!latestTopLists.radar) latestTopLists.radar = [];
  const best4Count = latestTopLists.best4.length;
  const radarCount = latestTopLists.radar.length;
  const tabs=[
    {id:'best4',    lbl:`🏆 BEST 4`,                                      d:latestTopLists.best4,      sk:'best4Score', sl:'SCORE', special:'best4'},
    {id:'radar',    lbl:`📡 RADAR`,                                      d:latestTopLists.radar,      sk:'radarScore', sl:'SCORE', special:'radar'},
    {id:'bombs',    lbl:`💣 Bombs`,                                        d:latestTopLists.bombs||[], sk:'bombScore',  sl:'SCORE', special:'bombs'},
    {id:'top3',     lbl:'🥇 Τριάδα',                                        d:latestTopLists.top3Certainty||[], sk:'_certaintyScore', sl:'SCORE', special:'top3'},
    {id:'combo1',   lbl:`⚡ Top Picks`,                                    d:latestTopLists.combo1,     sk:'strength',   sl:'CONF'},
    {id:'outcomes', lbl:'🏆 Αποτέλεσμα',                                   d:latestTopLists.outcomes,   sk:'strength',   sl:'CONF'},
    {id:'over25',   lbl:`🔥 Πάνω Γκολ`,                                   d:latestTopLists.over25,     sk:'tXG',        sl:acr('xG')},
    {id:'corners',  lbl:'🚩 Κόρνερ',                                       d:latestTopLists.corners,    sk:'cornerConf', sl:'CONF'},
    {id:'offsides', lbl:'🚫 Οφσάιντ',                                      d:latestTopLists.offsides||[], sk:null,         sl:null, special:'offsides'},
    {id:'exact',    lbl:`🎯 Ακριβές`,                                      d:latestTopLists.exact,      sk:'exactConf',  sl:'CONF'},
    {id:'players',  lbl:'👥 Παίκτες',                                      d:latestTopLists.players,    sk:null,         sl:null}
  ];
  const t=document.getElementById('topSection');if(!t)return;
  let html=`<div class="quant-panel" style="padding:0;overflow:hidden;"><div class="tabs-wrapper">`;
  tabs.forEach((tab,i)=>{
    const isBest4= tab.id==='best4';
    const isRadar= tab.id==='radar';
    const isTop  = tab.id==='top3';
    const isBomb = tab.id==='bombs';
    const bombCount = latestTopLists.bombs?.length || 0;
    const badge = isBest4
      ? `<span style="background:var(--accent-gold);color:#111827;font-size:0.6rem;font-weight:900;padding:1px 6px;border-radius:8px;margin-left:4px;">${best4Loading?'…':best4Count}</span>`
      : isRadar && radarCount > 0
        ? `<span style="background:var(--accent-blue);color:#fff;font-size:0.6rem;font-weight:900;padding:1px 6px;border-radius:8px;margin-left:4px;">${radarCount}</span>`
        : isTop
        ? `<span style="background:var(--accent-gold);color:#000;font-size:0.6rem;font-weight:900;padding:1px 6px;border-radius:8px;margin-left:4px;">3</span>`
        : isBomb && bombCount > 0
          ? `<span style="background:var(--accent-red);color:#fff;font-size:0.6rem;font-weight:900;padding:1px 6px;border-radius:8px;margin-left:4px;">${bombCount}</span>`
          : `<span class="tab-count">${tab.d.length}</span>`;
    html+=`<button class="tab-btn ${i===0?'active':''}" onclick="switchTab('${tab.id}')" id="tab-btn-${tab.id}" style="${isBest4?'color:var(--accent-gold);font-weight:900;':isRadar?'color:var(--accent-blue);font-weight:900;':isTop?'color:var(--accent-gold);font-weight:800;':isBomb?'color:var(--accent-red);font-weight:800;':''}">${tab.lbl} ${badge}</button>`;
  });
  html+=`</div>`;
  tabs.forEach((tab,i)=>{
    html+=`<div class="pred-tab-panel" style="display:${i===0?'block':'none'};padding:14px 18px 18px;" id="tabpanel-${tab.id}">`;
    if(tab.id==='players'){
      html += renderPlayersTab(tab.d);
    } else if(tab.id==='best4'){
      html += renderBest4Tab(tab.d);
    } else if(tab.id==='radar'){
      html += renderRadarTab(tab.d);
    } else if(tab.id==='top3'){
      html += renderTop3Certainty(tab.d);
    } else if(tab.id==='bombs'){
      html += renderBombsTab(tab.d);
    } else if(tab.id==='offsides'){
      html += renderOffsidesTab(tab.d);
    } else if(!tab.d.length){
      html+=`<div style="text-align:center;color:var(--text-muted);padding:22px;font-weight:600;font-size:1.1rem;">Δεν βρέθηκαν σήματα.</div>`;
    } else {
      html+=`<div style="display:flex;flex-direction:column;gap:10px;">`;
      tab.d.forEach((x,j)=>{
        let val = tab.id==='exact'
          ? (x.exact||'?-?')+(x.exact2&&x.exact2!==x.exact?` / ${x.exact2}`:'')
          : Number(x[tab.sk]||0).toFixed(1)+(tab.id==='corners'?'%':'');
        const evBadge = x.ev > 0
          ? `<div style="font-size:0.68rem;color:var(--accent-green);font-weight:700;margin-top:2px;">EV: +${x.ev.toFixed(1)}% @ ${x.odds?.toFixed(2)||''}</div>`
          : '';
        html+=`<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--bg-base);border:1px solid var(--border-light);border-radius:var(--radius-sm);transition:border-color 0.18s;" onmouseover="this.style.borderColor='var(--accent-blue)'" onmouseout="this.style.borderColor='var(--border-light)'">
          <div style="font-family:var(--font-mono);font-size:1.1rem;color:var(--text-dim);min-width:28px;text-align:center;flex-shrink:0;">#${j+1}</div>
          <div style="flex:1;min-width:0;cursor:pointer;" onclick="scrollToMatch('row-${x.fixId}')">
            <div style="font-weight:700;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(x.ht)} <span style="color:var(--text-muted)">vs</span> ${esc(x.at)}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;margin-top:3px;">${esc(x.lg)}</div>
            <div style="font-size:0.82rem;color:var(--accent-green);font-weight:600;margin-top:3px;">${esc(x.omegaPick)}</div>
            ${evBadge}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
            <div style="text-align:right;">
              <div style="font-family:var(--font-mono);font-size:1.2rem;font-weight:800;color:var(--accent-blue);">${val}</div>
              <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;">${tab.sl}</div>
            </div>
            <button onclick="scrollToMatchAndOpen('row-${x.fixId}')" style="font-size:0.65rem;padding:3px 8px;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:var(--accent-blue);border-radius:4px;cursor:pointer;white-space:nowrap;" title="Άνοιγμα ανάλυσης">📊 Ανάλυση</button>
          </div>
        </div>`;
      });
      html+=`</div>`;
    }
    html+=`</div>`;
  });
  html+=`</div>`;t.innerHTML=html;
}

function renderOffsidesTab(matches) {
  if(!matches?.length) return `<div style="text-align:center;color:var(--text-muted);padding:30px;font-weight:600;">Δεν βρέθηκαν offside signals ≥65%. Εκτελέστε Scan ή επιλέξτε περισσότερα πρωταθλήματα.</div>`;

  const rows = matches.map((x, i) => {
    const o = x.offside || {};
    const conf = Number(o.bestProb||0);
    const col = conf>=80?'var(--accent-green)':conf>=70?'var(--accent-gold)':'var(--accent-blue)';
    const reliable = conf>=70;
    return `<div style="background:var(--bg-base);border:1px solid ${reliable?'rgba(45,212,191,0.28)':'var(--border-light)'};border-radius:8px;padding:12px 14px;margin-bottom:9px;">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="font-family:var(--font-mono);font-size:0.95rem;color:var(--text-dim);min-width:24px;">#${i+1}</div>
        <div style="flex:1;min-width:220px;cursor:pointer;" onclick="scrollToMatchAndOpen('row-${x.fixId}')">
          <div style="font-size:0.95rem;font-weight:800;">${esc(x.ht)} <span style="color:var(--text-muted)">vs</span> ${esc(x.at)}</div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px;text-transform:uppercase;">${esc(x.lg||'')}</div>
          <div style="font-size:0.8rem;color:${col};font-weight:800;margin-top:5px;">🚫 ${esc(o.bestSignal||'ΧΩΡΙΣ ΣΗΜΑ')} · ${conf.toFixed(1)}% · Grade ${esc(o.grade||'—')}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(86px,1fr));gap:5px;min-width:300px;">
          <div style="background:var(--bg-surface);border-radius:5px;padding:6px 8px;text-align:center;"><div style="font-size:0.58rem;color:var(--text-dim);">HOME λ</div><div style="font-family:var(--font-mono);font-weight:800;color:var(--accent-gold);">${Number(o.hLambda||0).toFixed(2)}</div></div>
          <div style="background:var(--bg-surface);border-radius:5px;padding:6px 8px;text-align:center;"><div style="font-size:0.58rem;color:var(--text-dim);">AWAY λ</div><div style="font-family:var(--font-mono);font-weight:800;color:var(--accent-blue);">${Number(o.aLambda||0).toFixed(2)}</div></div>
          <div style="background:var(--bg-surface);border-radius:5px;padding:6px 8px;text-align:center;"><div style="font-size:0.58rem;color:var(--text-dim);">TOTAL λ</div><div style="font-family:var(--font-mono);font-weight:800;">${Number(o.totLambda||0).toFixed(2)}</div></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(6,minmax(85px,1fr));gap:5px;margin-top:9px;font-family:var(--font-mono);font-size:0.68rem;">
        <div style="background:var(--bg-surface);padding:5px;border-radius:4px;text-align:center;">H ≥2<br><b>${Number(o.hPOff2||0).toFixed(1)}%</b></div>
        <div style="background:var(--bg-surface);padding:5px;border-radius:4px;text-align:center;">A ≥2<br><b>${Number(o.aPOff2||0).toFixed(1)}%</b></div>
        <div style="background:var(--bg-surface);padding:5px;border-radius:4px;text-align:center;">Tot ≥3<br><b>${Number(o.pTotOff25||0).toFixed(1)}%</b></div>
        <div style="background:var(--bg-surface);padding:5px;border-radius:4px;text-align:center;">Tot ≥4<br><b>${Number(o.pTotOff35||0).toFixed(1)}%</b></div>
        <div style="background:var(--bg-surface);padding:5px;border-radius:4px;text-align:center;">Both ≥1<br><b>${Number(o.pBothOff1||0).toFixed(1)}%</b></div>
        <div style="background:var(--bg-surface);padding:5px;border-radius:4px;text-align:center;">Both ≥2<br><b>${Number(o.pBothOff2||0).toFixed(1)}%</b></div>
      </div>
      <div style="font-size:0.62rem;color:var(--text-dim);margin-top:7px;line-height:1.45;">Poisson projection από πρόσφατο μέσο όρο οφσάιντ της κάθε ομάδας. Το offside signal είναι ανεξάρτητο από το κύριο match pick.</div>
    </div>`;
  }).join('');
  return `<div>${rows}</div>`;
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

// Scroll + αυτόματο άνοιγμα accordion
window.scrollToMatchAndOpen=function(id){
  const el=document.getElementById(id);if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'center'});
  el.style.outline='2px solid var(--accent-gold)';
  setTimeout(()=>{
    // Ο summary table χρησιμοποιεί toggleMatchDetails(fixId)
    const fixId = id.replace('row-','');
    const detailRow = document.getElementById('detail-'+fixId);
    // Αν δεν είναι ήδη ανοιχτό, το ανοίγουμε
    if(!detailRow || detailRow.style.display==='none' || detailRow.style.display==='') {
      if(typeof window.toggleMatchDetails === 'function') window.toggleMatchDetails(fixId);
    }
    setTimeout(()=>el.style.outline='',2500);
  },450);
};

function renderTop3Certainty(bets) {
  if(!bets?.length) return `<div style="text-align:center;color:var(--text-muted);padding:30px;"><div style="font-size:2rem;margin-bottom:8px;">🥇</div><div>Εκτελέστε scan για να εμφανιστεί η Σίγουρη Τριάδα.</div></div>`;
  const rankEmoji = ['🥇','🥈','🥉'];
  const rankColors = ['var(--accent-gold)','rgba(192,192,192,0.9)','rgba(205,127,50,0.9)'];
  return `
  <div style="margin-bottom:12px;padding:10px 14px;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.25);border-radius:8px;font-size:0.75rem;color:var(--text-muted);">
    🎯 <strong style="color:var(--accent-gold);">Σίγουρη Τριάδα</strong> — Οι 3 αγώνες με το υψηλότερο συνδυαστικό σκορ βεβαιότητας (model strength + σταθερότητα + lineup + consistency).
  </div>
  <div style="display:flex;flex-direction:column;gap:14px;">
  ${bets.map((x,i) => {
    const score = x._certaintyScore || 0;
    // Stability breakdown
    const hStab = x.hS?.r6?.sdGoals != null ? (x.hS.r6.sdGoals < 0.83 ? '✅ STABLE' : x.hS.r6.sdGoals < 1.21 ? '➡️ NORMAL' : '⚠️ VOLATILE') : '—';
    const aStab = x.aS?.r6?.sdGoals != null ? (x.aS.r6.sdGoals < 0.83 ? '✅ STABLE' : x.aS.r6.sdGoals < 1.21 ? '➡️ NORMAL' : '⚠️ VOLATILE') : '—';
    const hasLineup = x.lineupData?.available;
    const hasInj = (x.hInjAdj?.delta < -0.05) || (x.aInjAdj?.delta < -0.05);
    const certScore = x._certaintyScore || 0;
    const evLine = x.valueBets?.length
      ? `<div style="font-size:0.72rem;color:var(--accent-green);font-weight:700;margin-top:4px;">💰 Value: +${Math.max(...x.valueBets.map(b=>b.ev)).toFixed(1)}% EV @ ${x.valueBets.find(b=>b.ev===Math.max(...x.valueBets.map(b=>b.ev)))?.decOdds?.toFixed(2)}</div>`
      : '';
    return `
    <div style="background:var(--bg-base);border:2px solid ${rankColors[i]};border-radius:var(--radius-md);overflow:hidden;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,${rankColors[i]}18,transparent);padding:14px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="font-size:2rem;flex-shrink:0;">${rankEmoji[i]}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:800;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(x.ht)} vs ${esc(x.at)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">${esc(x.lg)} · ${x.date||''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-family:var(--font-mono);font-size:1.6rem;font-weight:900;color:${rankColors[i]};line-height:1;">${certScore}</div>
          <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;">SCORE</div>
        </div>
      </div>
      <!-- Pick -->
      <div style="padding:10px 16px;border-top:1px solid var(--border-light);">
        <div style="font-size:1rem;font-weight:800;color:var(--accent-green);">${esc(x.omegaPick)}</div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">${esc(x.reason||'')}</div>
        ${evLine}
      </div>
      <!-- Factors -->
      <div style="padding:10px 16px;border-top:1px solid var(--border-light);display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.7rem;">
        <div style="background:var(--bg-surface);border-radius:5px;padding:6px 8px;">
          <span style="color:var(--text-muted);">Conf: </span><span style="font-family:var(--font-mono);color:var(--accent-blue);font-weight:700;">${(x.strength||0).toFixed(1)}%</span>
        </div>
        <div style="background:var(--bg-surface);border-radius:5px;padding:6px 8px;">
          <span style="color:var(--text-muted);">tXG: </span><span style="font-family:var(--font-mono);color:var(--text-main);font-weight:700;">${Number(x.tXG||0).toFixed(2)}</span>
        </div>
        <div style="background:var(--bg-surface);border-radius:5px;padding:6px 8px;">
          <span style="color:var(--text-muted);">🏠 Σταθ.: </span><span style="font-weight:600;">${hStab}</span>
        </div>
        <div style="background:var(--bg-surface);border-radius:5px;padding:6px 8px;">
          <span style="color:var(--text-muted);">✈️ Σταθ.: </span><span style="font-weight:600;">${aStab}</span>
        </div>
        ${hasLineup ? `<div style="background:rgba(45,212,191,0.1);border-radius:5px;padding:6px 8px;color:var(--accent-teal);font-weight:700;">📋 Lineup ✓</div>` : ''}
        ${hasInj    ? `<div style="background:rgba(244,63,94,0.1);border-radius:5px;padding:6px 8px;color:var(--accent-red);font-weight:700;">🏥 Τραυματίας</div>` : ''}
      </div>
      <!-- Actions -->
      <div style="padding:10px 16px;border-top:1px solid var(--border-light);display:flex;gap:8px;flex-wrap:wrap;">
        <button onclick="scrollToMatchAndOpen('row-${x.fixId}')" style="flex:1;padding:8px;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:var(--accent-blue);border-radius:6px;cursor:pointer;font-weight:700;font-size:0.78rem;">📊 Πλήρης Ανάλυση</button>
        <button onclick="window.openLogBetModal('${x.fixId}')" style="flex:1;padding:8px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:var(--accent-green);border-radius:6px;cursor:pointer;font-weight:700;font-size:0.78rem;">📒 Log Bet</button>
      </div>
    </div>`;
  }).join('')}
  </div>`;
}

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
  const opp      = `<span style="font-size:0.62rem;color:var(--text-muted);margin-left:6px;">αντίπ. ${Number(oppS?.crd||0).toFixed(1)} κάρτ</span>`;
  return {injBadge, factor, fCol, opp};
}
function buildAccordionHTML(x) {
  const formDots=arr=>(arr||[]).slice(0,5).map(h=>`<div class="form-dot form-${h.cls}">${h.res}</div>`).join('');
  const pct = v => (v*100).toFixed(1)+'%';
  const li = x.liveIntel || null; // Live Intelligence data (null αν δεν είναι live)

  // ── Live SQD + Shot Quality panel (μόνο αν είναι live) ──────────
  const liveQualityPanel = li ? (() => {
    const sqd = li.sqd || 0;
    const sqdAbs = Math.abs(sqd);
    const hSide = sqd > 0.01;
    const aSide = sqd < -0.01;
    const neutral = !hSide && !aSide;

    // Shot Quality per team
    const hQual = (li.hXGperShot||0)*100;
    const aQual = (li.aXGperShot||0)*100;
    const maxQual = Math.max(hQual, aQual, 1);

    // SoT Ratio bar
    const hSoTPct = Math.round((li.hSoTRatio||0.5)*100);

    // Edge composite
    const edgeH = li.hLiveEdge || 50;
    const edgeA = li.aLiveEdge || 50;
    const edgeCol = edgeH > 58 ? 'var(--accent-gold)' : edgeH < 42 ? 'var(--accent-blue)' : 'var(--text-muted)';

    return `<div class="accordion-card" style="border-color:rgba(74,222,128,0.35);background:rgba(74,222,128,0.04);">
      <h4 style="color:var(--accent-green);">🔬 Live Quality Index <span style="font-size:0.62rem;color:var(--text-dim);font-weight:400;">${li.elapsed?.toFixed(0)||'?'}' · ${li.xgSource==='provider'?'xG Provider':'xG Model'}</span></h4>

      <!-- Edge Score -->
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;font-size:0.65rem;color:var(--text-muted);margin-bottom:4px;font-weight:700;text-transform:uppercase;">
          <span>Composite Live Edge</span>
          <span style="color:${edgeCol};">${edgeH>58?'HOME':'edgeH<42'?'AWAY':'Ισόρροπο'} ${Math.round(Math.max(edgeH,edgeA))}%</span>
        </div>
        <div style="height:8px;background:var(--border-light);border-radius:4px;overflow:hidden;display:flex;gap:1px;">
          <div style="width:${edgeH}%;background:var(--accent-gold);border-radius:4px 0 0 4px;transition:width 0.5s;"></div>
          <div style="width:${edgeA}%;background:var(--accent-blue);border-radius:0 4px 4px 0;transition:width 0.5s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text-muted);margin-top:3px;">
          <span style="color:var(--accent-gold);">🏠 ${edgeH.toFixed(0)}%</span>
          <span style="font-size:0.55rem;color:var(--text-dim);">SoT×50% + SQD×30% + GK×20%</span>
          <span style="color:var(--accent-blue);">✈️ ${edgeA.toFixed(0)}%</span>
        </div>
      </div>

      <!-- Shot Quality Differential -->
      <div style="background:var(--bg-surface);border-radius:6px;padding:10px 12px;margin-bottom:10px;">
        <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Shot Quality (xG/Shot)</div>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;">
          <div style="text-align:left;">
            <div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:900;color:var(--accent-gold);">${hQual.toFixed(1)}%</div>
            <div style="height:4px;background:var(--border-light);border-radius:2px;margin-top:4px;">
              <div style="height:4px;width:${Math.min(hQual/maxQual*100,100).toFixed(0)}%;background:var(--accent-gold);border-radius:2px;"></div>
            </div>
            <div style="font-size:0.62rem;color:var(--text-muted);margin-top:3px;">${li.hTot||0} shots · ${li.hSoT||0} SoT</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:0.62rem;color:var(--text-muted);margin-bottom:2px;">SQD</div>
            <div style="font-family:var(--font-mono);font-size:0.9rem;font-weight:900;color:${hSide?'var(--accent-gold)':aSide?'var(--accent-blue)':'var(--text-muted)'};">${sqd>=0?'+':''}${sqd.toFixed(3)}</div>
            <div style="font-size:0.55rem;color:${hSide?'var(--accent-gold)':aSide?'var(--accent-blue)':'var(--text-dim)'};">${hSide?'HOME πλεονέκτημα':aSide?'AWAY πλεονέκτημα':'Ισόπαλο'}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:900;color:var(--accent-blue);">${aQual.toFixed(1)}%</div>
            <div style="height:4px;background:var(--border-light);border-radius:2px;margin-top:4px;">
              <div style="height:4px;width:${Math.min(aQual/maxQual*100,100).toFixed(0)}%;background:var(--accent-blue);border-radius:2px;float:right;"></div>
            </div>
            <div style="font-size:0.62rem;color:var(--text-muted);margin-top:3px;">${li.aTot||0} shots · ${li.aSoT||0} SoT</div>
          </div>
        </div>
      </div>

      <!-- SoT Ratio + GK Saves -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="background:var(--bg-surface);border-radius:6px;padding:8px 10px;">
          <div style="font-size:0.6rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:5px;">Shots on Target Ratio</div>
          <div style="height:6px;background:var(--border-light);border-radius:3px;overflow:hidden;display:flex;margin-bottom:4px;">
            <div style="width:${hSoTPct}%;background:var(--accent-gold);border-radius:3px 0 0 3px;"></div>
            <div style="width:${100-hSoTPct}%;background:var(--accent-blue);border-radius:0 3px 3px 0;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.62rem;font-family:var(--font-mono);font-weight:700;">
            <span style="color:var(--accent-gold);">🏠 ${li.hSoT||0}</span>
            <span style="color:var(--accent-blue);">✈️ ${li.aSoT||0}</span>
          </div>
        </div>
        <div style="background:var(--bg-surface);border-radius:6px;padding:8px 10px;">
          <div style="font-size:0.6rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:5px;">GK Saves (πίεση δέχεται)</div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="text-align:center;flex:1;">
              <div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:900;color:${(li.hSaves||0)>2?'var(--accent-red)':'var(--text-main)'};">${li.hSaves||0}</div>
              <div style="font-size:0.58rem;color:var(--text-muted);">HOME GK</div>
            </div>
            <div style="font-size:0.7rem;color:var(--text-dim);">vs</div>
            <div style="text-align:center;flex:1;">
              <div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:900;color:${(li.aSaves||0)>2?'var(--accent-red)':'var(--text-main)'};">${li.aSaves||0}</div>
              <div style="font-size:0.58rem;color:var(--text-muted);">AWAY GK</div>
            </div>
          </div>
          <div style="font-size:0.55rem;color:var(--text-dim);margin-top:4px;">Πολλές σεβές = κρυφή πίεση</div>
        </div>
      </div>

      <!-- ── LIVE VERDICT ─────────────────────────────────────── -->
      ${(() => {
        // Συγκεντρώνουμε όλα τα σήματα και βγάζουμε πόρισμα
        const sqd      = li.sqd || 0;
        const edgeH    = li.hLiveEdge || 50;
        const hSoT     = li.hSoT || 0;
        const aSoT     = li.aSoT || 0;
        const hSaves   = li.hSaves || 0; // σεβές HOME GK = πίεση AWAY
        const aSaves   = li.aSaves || 0; // σεβές AWAY GK = πίεση HOME
        const hXGps    = li.hXGperShot || 0;
        const aXGps    = li.aXGperShot || 0;
        const pNext    = li.pNextHome || 0.5;

        // Ποια ομάδα κυριαρχεί;
        // Σήματα: SQD, SoT ratio, GK saves, Edge
        let homeSignals = 0, awaySignals = 0;
        if(sqd > 0.03)  homeSignals++; else if(sqd < -0.03) awaySignals++;
        if(edgeH > 55)  homeSignals++; else if(edgeH < 45)  awaySignals++;
        if(aSaves > hSaves + 1) homeSignals++; else if(hSaves > aSaves + 1) awaySignals++;
        if(hSoT > aSoT)  homeSignals++; else if(aSoT > hSoT) awaySignals++;

        const dominant = homeSignals > awaySignals ? 'HOME' : awaySignals > homeSignals ? 'AWAY' : 'DRAW';
        const dominantName = dominant === 'HOME' ? esc(x.ht.split(' ')[0])
                           : dominant === 'AWAY' ? esc(x.at.split(' ')[0]) : null;
        const domCol   = dominant === 'HOME' ? 'var(--accent-gold)' : dominant === 'AWAY' ? 'var(--accent-blue)' : 'var(--accent-teal)';
        const signals  = Math.max(homeSignals, awaySignals);
        const strength = signals >= 3 ? 'ΙΣΧΥΡΗ' : signals >= 2 ? 'ΜΕΤΡΙΑ' : 'ΑΣΘΕΝΗΣ';
        const strCol   = signals >= 3 ? 'var(--accent-green)' : signals >= 2 ? 'var(--accent-gold)' : 'var(--text-muted)';

        // Οικοδόμηση αιτιολογίας
        const reasons = [];
        if(Math.abs(sqd) > 0.03)
          reasons.push(`${acr('SQD')} ${sqd>0?'🏠':'✈️'} ${Math.abs(sqd).toFixed(3)} — ${sqd>0?'η HOME':'η AWAY'} βγάζει πιο επικίνδυνες ευκαιρίες ανά σουτ`);
        if(Math.abs(edgeH - 50) > 5)
          reasons.push(`${acr('Edge')} ${edgeH.toFixed(0)}% — ${edgeH>50?'HOME':'AWAY'} κυριαρχεί συνολικά`);
        if(Math.abs(hSaves - aSaves) > 1)
          reasons.push(`GK saves: 🏠${hSaves} vs ✈️${aSaves} — ${hSaves>aSaves?'AWAY ασκεί κρυφή πίεση':'HOME ασκεί κρυφή πίεση'}`);
        if(hSoT !== aSoT)
          reasons.push(`SoT: 🏠${hSoT} vs ✈️${aSoT} — ${hSoT>aSoT?'HOME':'AWAY'} πιο αποτελεσματική`);

        // Σύσταση
        let suggestion = '';
        if(dominant !== 'DRAW' && signals >= 2) {
          const nextPct = dominant === 'HOME' ? Math.round(pNext*100) : Math.round((1-pNext)*100);
          suggestion = `Επόμενο γκολ: <strong style="color:${domCol};">${dominant==='HOME'?'🏠':'✈️'} ${dominantName} ${nextPct}%</strong>`;
        } else {
          suggestion = 'Ισορροπημένος αγώνας — χωρίς ξεκάθαρο πλεονέκτημα';
        }

        return `<div style="margin-top:14px;background:linear-gradient(135deg,rgba(74,222,128,0.06),rgba(0,0,0,0));border:1px solid rgba(74,222,128,0.2);border-radius:8px;padding:14px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:0.68rem;font-weight:800;color:var(--accent-green);font-family:var(--font-cond);text-transform:uppercase;letter-spacing:0.1em;">⚖️ Live Verdict</span>
              <span style="font-size:0.65rem;font-weight:700;padding:2px 8px;border-radius:6px;background:${strCol}18;color:${strCol};border:1px solid ${strCol}44;">${strength} ΕΝΔΕΙΞΗ</span>
            </div>
            ${dominant !== 'DRAW' ? `<span style="font-family:var(--font-mono);font-size:1rem;font-weight:900;color:${domCol};">${dominant==='HOME'?'🏠':'✈️'} ${dominantName}</span>` : `<span style="color:var(--accent-teal);font-weight:700;">⚖️ Ισόρροπο</span>`}
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;">${suggestion}</div>
          ${reasons.length ? `<div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:8px;display:flex;flex-direction:column;gap:4px;">
            ${reasons.map(r=>`<div style="font-size:0.68rem;color:var(--text-sub);display:flex;align-items:flex-start;gap:5px;"><span style="color:var(--accent-green);flex-shrink:0;">▸</span>${r}</div>`).join('')}
          </div>` : ''}
        </div>`;
      })()}
    </div>`;
  })() : '';

  const injXGRow=(label,base,final,adj)=>{
    if(!adj||adj.delta>=-0.05) return `<div class="accordion-row"><span>${label}</span><span class="data-num" style="color:var(--accent-blue)">${Number(final||base||0).toFixed(2)}</span></div>`;
    return `<div class="accordion-row"><span>${label}</span><span class="data-num"><span style="color:var(--text-muted);text-decoration:line-through;font-size:0.85rem;">${Number(base||0).toFixed(2)}</span><span style="color:var(--accent-gold);font-weight:800;margin-left:5px;">${Number(final||0).toFixed(2)}</span><span style="color:var(--accent-red);font-size:0.75rem;margin-left:3px;">(${Number(adj.delta||0).toFixed(2)})</span></span></div>`;
  };
  
  const injuredBanner=(injAdj,teamName)=>{
    if(!injAdj?.injured?.length) return '';
    return `<div style="background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:6px 10px;margin-bottom:8px;font-size:0.78rem;color:var(--accent-red);font-weight:700;">🏥 <b>${esc(teamName.split(' ')[0])}</b>: ${injAdj.injured.map(p=>esc((p.name||'').split(' ').slice(-1)[0])).join(', ')} — xG ×${(injAdj.factor||1).toFixed(2)}</div>`;
  };

  // Προβολές Καρτών και Κόρνερ
  const hCrdExp = x.hS?.crd || 2.1;
  const aCrdExp = x.aS?.crd || 2.1;
  const totalCrd = hCrdExp + aCrdExp;
  
  const hCorExpBase = x.hS?.cor || 4.8;
  const aCorExpBase = x.aS?.cor || 4.8;
  const hCorShare = hCorExpBase / (hCorExpBase + aCorExpBase);
  const hProjCor = (x.expCor || 0) * hCorShare;
  const aProjCor = (x.expCor || 0) * (1 - hCorShare);

  // Helper για Card Risk
  const renderCardRow = (p, rank) => {
    const yProb = p.adjCardProb ?? p.cardProb ?? 0;
    const rProb = p.adjRedCardProb ?? p.redCardProb ?? 0;
    const yCol  = yProb>=40?'var(--accent-red)':yProb>=20?'var(--accent-gold)':'var(--text-muted)';
    const rCol  = rProb>=8 ?'var(--accent-red)':rProb>=3 ?'var(--accent-gold)':'var(--text-dim)';
    const adj   = p.cardAdjFactor>1.05 ? `<span style="font-size:0.6rem;color:var(--accent-red);font-weight:900;">▲</span>` : p.cardAdjFactor<0.95 ? `<span style="font-size:0.6rem;color:var(--accent-teal);font-weight:900;">▼</span>` : '';
    const suspS = p.suspRisk ? ' <span style="font-size:0.68rem;" title="Κίνδυνος αποβολής">🔴</span>' : '';
    const name  = esc((p.name||'').split(' ').pop());
    const injS  = p.injured ? '🏥 ' : '';
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.03);">
      <span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-dim);min-width:14px;text-align:center;font-weight:700;">${rank+1}</span>
      <span style="flex:1;font-size:0.82rem;font-weight:600;color:${p.injured?'var(--accent-red)':'var(--text-main)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${injS}${name}${suspS}</span>
      <span style="font-family:var(--font-mono);font-size:0.82rem;font-weight:800;color:${yCol};min-width:40px;text-align:right;">🟨${yProb.toFixed(0)}%${adj}</span>
      <span style="font-family:var(--font-mono);font-size:0.78rem;font-weight:700;color:${rCol};min-width:34px;text-align:right;">${rProb>=2?'🟥':'  '}${rProb.toFixed(0)}%</span>
    </div>`;
  };

  // 1. Home vs Away Breakdown
  const homeAwayHTML = `
    <div class="accordion-card" style="margin:0; height:100%;">
      <h4>📊 Home vs Away Breakdown</h4>
      <div class="accordion-row"><span>Form xG</span><span class="data-num">${x.hS?.uiXG||'0.00'} vs ${x.aS?.uiXG||'0.00'}</span></div>
      <div class="accordion-row"><span>Form xGA</span><span class="data-num" style="color:var(--text-muted)">${x.hS?.uiXGA||'0.00'} vs ${x.aS?.uiXGA||'0.00'}</span></div>
      <div class="accordion-row"><span>Split xG</span><span class="data-num">${x.hS?.uiSXG||'0.00'} vs ${x.aS?.uiSXG||'0.00'}</span></div>
      <div class="accordion-row"><span>Avg Corners</span><span class="data-num">${Number(x.hS?.cor||0).toFixed(1)} vs ${Number(x.aS?.cor||0).toFixed(1)}</span></div>
      <div class="accordion-row"><span>Avg Cards</span><span class="data-num">${Number(x.hS?.crd||0).toFixed(1)} vs ${Number(x.aS?.crd||0).toFixed(1)}</span></div>
      <div class="accordion-row" style="color:var(--text-muted);"><span>H2H (Last 8)</span><span class="data-num">${x.h2h?`${x.h2h.homeWins}W - ${x.h2h.draws}D - ${x.h2h.awayWins}W`:'N/A'}</span></div>
      <div style="display:flex;gap:4px;margin-top:10px;">${formDots(x.hS?.history)}</div><div style="display:flex;gap:4px;margin-top:6px;">${formDots(x.aS?.history)}</div>
    </div>
  `;

  // 2. Game Projections (Συμμετρικό με το Breakdown)
  const gameProjHTML = `
    <div class="accordion-card" style="margin:0; height:100%;">
      <h4>🎯 Game Projections (Engine)</h4>
      ${injuredBanner(x.hInjAdj, x.ht)}
      ${injuredBanner(x.aInjAdj, x.at)}
      ${injXGRow('🏠 Proj. xG', x.hXGbase, x.hXGfinal, x.hInjAdj)}
      ${injXGRow('✈️ Proj. xG', x.aXGbase, x.aXGfinal, x.aInjAdj)}
      <div class="accordion-row"><span>xG Diff (Match)</span><span class="data-num" style="color:${(x.xgDiff||0)>0?'var(--accent-green)':'var(--accent-red)'}">${(x.xgDiff||0)>0?'+':''}${Number(x.xgDiff||0).toFixed(2)}</span></div>
      <div class="accordion-row"><span>Proj. Corners</span><span class="data-num">${hProjCor.toFixed(1)} vs ${aProjCor.toFixed(1)} <span style="font-size:0.7em;color:var(--text-muted)">(Tot: ${(Number(x.expCor)||0).toFixed(1)})</span></span></div>
      <div class="accordion-row"><span>Proj. Cards</span><span class="data-num">${hCrdExp.toFixed(1)} vs ${aCrdExp.toFixed(1)} <span style="font-size:0.7em;color:var(--text-muted)">(Tot: ${totalCrd.toFixed(1)})</span></span></div>
      <div class="accordion-row"><span>Poisson O2.5</span><span class="data-num" style="color:var(--accent-blue)">${x.pp?pct(x.pp.pO25):'—'}</span></div>
      <div class="accordion-row" style="color:var(--accent-green);"><span>P(Over 8.5 Cor)</span><span class="data-num">${(x.cornerConf||0).toFixed(1)}%</span></div>

      ${x.offside ? `
      <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;">
        <div style="font-size:0.62rem;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;font-family:var(--font-cond);margin-bottom:6px;">🚫 Εκτίμηση Οφσάιντ</div>
        <div class="accordion-row">
          <span>Αναμ. HOME</span>
          <span class="data-num" style="color:var(--accent-gold);">${x.offside.hLambda.toFixed(1)}
            <span style="font-size:0.68rem;color:var(--text-muted);margin-left:4px;">≥2: ${x.offside.hPOff2}%</span>
          </span>
        </div>
        <div class="accordion-row">
          <span>Αναμ. AWAY</span>
          <span class="data-num" style="color:var(--accent-blue);">${x.offside.aLambda.toFixed(1)}
            <span style="font-size:0.68rem;color:var(--text-muted);margin-left:4px;">≥2: ${x.offside.aPOff2}%</span>
          </span>
        </div>
        <div class="accordion-row">
          <span>Σύνολο</span>
          <span class="data-num">${x.offside.totLambda.toFixed(1)}
            <span style="font-size:0.68rem;color:var(--text-muted);margin-left:4px;">≥3: ${x.offside.pTotOff25}% · ≥4: ${x.offside.pTotOff35}% · ≥5: ${x.offside.pTotOff45}%</span>
          </span>
        </div>
        <div class="accordion-row" style="color:${x.offside.pBothOff2>=50?'var(--accent-green)':x.offside.pBothOff2>=35?'var(--accent-gold)':'var(--text-muted)'};">
          <span>Αμφότερες ≥1 / ≥2</span>
          <span class="data-num">${x.offside.pBothOff1}% / ${x.offside.pBothOff2}%</span>
        </div>
        <div style="margin-top:7px;padding:7px 9px;border-radius:6px;background:${x.offside.reliable?'rgba(45,212,191,0.08)':'rgba(77,184,255,0.06)'};border:1px solid ${x.offside.reliable?'rgba(45,212,191,0.22)':'var(--border)'};">
          <div style="font-size:0.6rem;color:var(--text-dim);text-transform:uppercase;font-weight:700;">Καλύτερο Offside Signal</div>
          <div style="font-size:0.78rem;font-weight:800;color:${x.offside.bestProb>=80?'var(--accent-green)':x.offside.bestProb>=70?'var(--accent-gold)':'var(--accent-blue)'};margin-top:2px;">${x.offside.bestSignal} — ${x.offside.bestProb}% · Grade ${x.offside.grade}</div>
        </div>
        <div style="display:flex;gap:4px;margin-top:6px;font-size:0.62rem;font-family:var(--font-mono);">
          <span style="flex:1;text-align:center;background:var(--bg-surface);border-radius:4px;padding:3px;">🏠≥1: ${x.offside.hPOff1}%</span>
          <span style="flex:1;text-align:center;background:var(--bg-surface);border-radius:4px;padding:3px;">🏠≥3: ${x.offside.hPOff3}%</span>
          <span style="flex:1;text-align:center;background:var(--bg-surface);border-radius:4px;padding:3px;">✈️≥1: ${x.offside.aPOff1}%</span>
          <span style="flex:1;text-align:center;background:var(--bg-surface);border-radius:4px;padding:3px;">✈️≥3: ${x.offside.aPOff3}%</span>
        </div>
      </div>` : ''}
    </div>
  `;

  // 3. Volatility Analysis
  const volatilityHTML = `
    <div class="accordion-card" style="min-width:100%; margin-bottom:14px;">
      <h4>📉 Volatility Analysis</h4>
      ${renderVolatilityPanel(x.hS, x.aS, x.ht, x.at)}
    </div>
  `;

  // 4. HT Prediction
  const htHTML = x.htAnalysis ? (() => {
    const ht=x.htAnalysis;
    const hPct=Math.round(ht.pLeadHome*100), dPct=Math.round(ht.pDraw*100), aPct=Math.round(ht.pLeadAway*100);
    const leadCol = ht.pLeadHome>ht.pLeadAway?'var(--accent-gold)':'var(--accent-blue)';
    const leadStr = ht.pLeadHome>ht.pLeadAway+0.05?`🏠 ${hPct}%`:ht.pLeadAway>ht.pLeadHome+0.05?`✈️ ${aPct}%'`:`⚖️ Ισόρροπο`;
    return `<div class="accordion-card" style="min-width:280px;border-color:rgba(45,212,191,0.4);">
      <h4 style="color:var(--accent-teal);">⏱️ HT Prediction
        <span style="font-size:0.68rem;color:var(--text-dim);font-weight:400;margin-left:8px;">λ 🏠${ht.htLambdaH.toFixed(2)} ✈️${ht.htLambdaA.toFixed(2)}</span>
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
        </div>
        <div style="flex:1;background:rgba(168,85,247,0.07);border:1px solid rgba(168,85,247,0.25);border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;font-weight:700;">🥈 Alt Score</div>
          <div style="font-family:var(--font-mono);font-size:1.6rem;font-weight:900;color:var(--accent-purple);">${ht.htSecond.h}-${ht.htSecond.a}</div>
        </div>
      </div>
    </div>`;
  })() : '';

  // 5. Card Risk
  const cardRiskHTML = `
    <div class="accordion-card">
      <h4>🟨🟥 Card Risk</h4>
      <div style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-bottom:6px;">
          <span style="font-size:0.7rem;font-weight:800;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.05em;">🏠 ${esc(x.ht.split(' ').slice(0,2).join(' '))}</span>
          ${(()=>{const f=(x.hPlayers||[]).find(p=>p.cardAdjFactor)?.cardAdjFactor||1;return f!==1?`<span style="font-size:0.62rem;color:${f>1.05?'var(--accent-red)':'var(--accent-teal)'};">αντίπ. ×${f.toFixed(2)}</span>`:''})()}
        </div>
        <div style="font-size:0.62rem;color:var(--text-muted);display:flex;justify-content:space-between;padding-bottom:4px;border-bottom:1px solid var(--border-light);margin-bottom:3px;">
          <span>#&nbsp;&nbsp;Παίκτης</span><span>🟨%&nbsp;&nbsp;&nbsp;🟥%</span>
        </div>
        ${([...(x.hPlayers||[])].sort((a,b)=>(b.adjCardProb??b.cardProb??0)-(a.adjCardProb??a.cardProb??0)).slice(0,5).map((p,i)=>renderCardRow(p,i)).join('')) || '<span style="font-size:0.8rem;color:var(--text-dim)">Δεν υπάρχουν δεδομένα</span>'}
      </div>
      <div style="border-top:1px solid var(--border-light);padding-top:10px;">
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-bottom:6px;">
          <span style="font-size:0.7rem;font-weight:800;color:var(--accent-blue);text-transform:uppercase;letter-spacing:0.05em;">✈️ ${esc(x.at.split(' ').slice(0,2).join(' '))}</span>
          ${(()=>{const f=(x.aPlayers||[]).find(p=>p.cardAdjFactor)?.cardAdjFactor||1;return f!==1?`<span style="font-size:0.62rem;color:${f>1.05?'var(--accent-red)':'var(--accent-teal)'};">αντίπ. ×${f.toFixed(2)}</span>`:''})()}
        </div>
        <div style="font-size:0.62rem;color:var(--text-muted);display:flex;justify-content:space-between;padding-bottom:4px;border-bottom:1px solid var(--border-light);margin-bottom:3px;">
          <span>#&nbsp;&nbsp;Παίκτης</span><span>🟨%&nbsp;&nbsp;&nbsp;🟥%</span>
        </div>
        ${([...(x.aPlayers||[])].sort((a,b)=>(b.adjCardProb??b.cardProb??0)-(a.adjCardProb??a.cardProb??0)).slice(0,5).map((p,i)=>renderCardRow(p,i)).join('')) || '<span style="font-size:0.8rem;color:var(--text-dim)">Δεν υπάρχουν δεδομένα</span>'}
      </div>
    </div>
  `;

  // 6. Context & Strength Ratings
  const contextHTML = (x.sitCtx || x.dcResult) ? `
    <div class="accordion-card" style="min-width:260px;border-color:rgba(251,191,36,0.25);">
      <h4 style="color:var(--accent-gold);">🎯 Context & Strength</h4>
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
        <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Dixon-Coles Ratings</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.72rem;">
          <div style="background:var(--bg-surface);border-radius:5px;padding:8px;"><div style="color:var(--text-muted);margin-bottom:2px;">🏠 Attack</div><div style="font-family:var(--font-mono);font-weight:700;color:${x.dcResult.hAtt>1.1?'var(--accent-green)':x.dcResult.hAtt<0.9?'var(--accent-red)':'var(--text-main)'};">${x.dcResult.hAtt?.toFixed(2)}</div></div>
          <div style="background:var(--bg-surface);border-radius:5px;padding:8px;"><div style="color:var(--text-muted);margin-bottom:2px;">🏠 Defense</div><div style="font-family:var(--font-mono);font-weight:700;color:${x.dcResult.hDef<0.9?'var(--accent-green)':x.dcResult.hDef>1.1?'var(--accent-red)':'var(--text-main)'};">${x.dcResult.hDef?.toFixed(2)}</div></div>
          <div style="background:var(--bg-surface);border-radius:5px;padding:8px;"><div style="color:var(--text-muted);margin-bottom:2px;">✈️ Attack</div><div style="font-family:var(--font-mono);font-weight:700;color:${x.dcResult.aAtt>1.1?'var(--accent-green)':x.dcResult.aAtt<0.9?'var(--accent-red)':'var(--text-main)'};">${x.dcResult.aAtt?.toFixed(2)}</div></div>
          <div style="background:var(--bg-surface);border-radius:5px;padding:8px;"><div style="color:var(--text-muted);margin-bottom:2px;">✈️ Defense</div><div style="font-family:var(--font-mono);font-weight:700;color:${x.dcResult.aDef<0.9?'var(--accent-green)':x.dcResult.aDef>1.1?'var(--accent-red)':'var(--text-main)'};">${x.dcResult.aDef?.toFixed(2)}</div></div>
        </div>
      </div>` : ''}
      <button onclick="window.openLogBetModal('${x.fixId}')" style="margin-top:14px;width:100%;padding:8px;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:var(--accent-blue);border-radius:6px;cursor:pointer;font-weight:700;font-size:0.78rem;">📒 Καταγραφή</button>
      ${renderStabilitySignals(x)}
    </div>` : '';

  // --- FINAL ASSEMBLY ---
  return `
    <td colspan="9" style="padding: 20px; text-align:left; border-bottom:1px solid var(--border-light); background:var(--bg-panel);">

      <!-- LIVE QUALITY INDEX — εμφανίζεται μόνο σε live αγώνες -->
      ${liveQualityPanel}

      <!-- ΓΡΑΜΜΗ 1: Breakdown & Projections Δίπλα-δίπλα -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; margin-bottom: 14px; ${liveQualityPanel ? 'margin-top:14px;' : ''}">
        ${homeAwayHTML}
        ${gameProjHTML}
      </div>

      <!-- ΓΡΑΜΜΗ 2: Volatility Analysis -->
      ${volatilityHTML}

      <!-- ΓΡΑΜΜΗ 3: Τα υπόλοιπα στοιχισμένα -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
        ${htHTML}
        ${cardRiskHTML}
        ${contextHTML}
      </div>
    </td>
  `;
}

// ── Volatility Analysis Panel ─────────────────────────────────────────────────

function volatilityLabel(sd, baseline){
  if(sd === null || sd === undefined || isNaN(sd)) return { lbl:'N/A', col:'var(--text-muted)' };
  const r = sd / baseline;
  if(r < 0.75) return { lbl:'STABLE ▼',   col:'var(--accent-teal)' };
  if(r < 1.10) return { lbl:'NORMAL',      col:'var(--accent-blue)' };
  if(r < 1.40) return { lbl:'VOLATILE ↑',  col:'var(--accent-gold)' };
  return          { lbl:'HIGH VOL ⚡', col:'var(--accent-red)' };
}

// 95% CI — Student t-distribution approximation
// ΣΗΜΑΝΤΙΚΟ: παράμετρος ονομάζεται μ_ για να μην συγκρούεται με οποιοδήποτε outer scope
function ci95(μ_, sd_, n_) {
  if(!sd_ || !n_ || n_ < 2 || isNaN(μ_) || isNaN(sd_)) return null;
  const t = n_ >= 30 ? 1.96 : n_ >= 20 ? 2.09 : n_ >= 15 ? 2.13 : n_ >= 10 ? 2.23 : 2.57;
  const se = sd_ / Math.sqrt(n_);
  return [ Math.max(0, μ_ - t * se), μ_ + t * se ];
}

function arrMean(arr) {
  if(!arr || !arr.length) return null;
  return arr.reduce((s, v) => s + Number(v), 0) / arr.length;
}

function renderVolatilityPanel(hS, aS, ht, at) {
  if(!hS || !aS) return '<div style="color:var(--text-muted);font-size:0.75rem;">Δεν υπάρχουν δεδομένα διακύμανσης.</div>';

  const hr6  = hS.r6  || {};
  const ar6  = aS.r6  || {};
  const hSea = hS.sea || {};
  const aSea = aS.sea || {};

  const BASE = { goals:1.10, goalsAgainst:1.10, corners:2.26, cards:2.03 };

  const f1 = v => (v!=null&&!isNaN(v)) ? Number(v).toFixed(1) : '—';
  const f2 = v => (v!=null&&!isNaN(v)) ? Number(v).toFixed(2) : '—';
  const pf  = v => (v!=null&&!isNaN(v)) ? Number(v).toFixed(0) : '—';

  // ── Helpers ──────────────────────────────────────────────────────
  function vLabel(sd, base) {
    if(sd==null||isNaN(sd)) return {lbl:'N/A', col:'var(--text-dim)', icon:'○'};
    const r = sd/base;
    if(r < 0.75) return {lbl:'STABLE',   col:'var(--accent-teal)',  icon:'▼'};
    if(r < 1.10) return {lbl:'NORMAL',   col:'var(--accent-blue)',  icon:'―'};
    if(r < 1.40) return {lbl:'VOLATILE', col:'var(--accent-gold)',  icon:'▲'};
    return             {lbl:'HIGH VOL',  col:'var(--accent-red)',   icon:'⚡'};
  }

  // Compare two values: returns color for "better" side
  // For goals scored: higher = better (attack). For goals against: lower = better (defense)
  function compareColor(hVal, aVal, higherIsBetter=true) {
    if(hVal==null||aVal==null||isNaN(hVal)||isNaN(aVal)) return ['var(--text-main)','var(--text-main)'];
    const hBetter = higherIsBetter ? hVal>aVal : hVal<aVal;
    const tie = Math.abs(hVal-aVal)<0.05;
    if(tie) return ['var(--text-main)','var(--text-main)'];
    return hBetter
      ? ['var(--accent-green)','var(--text-sub)']
      : ['var(--text-sub)','var(--accent-green)'];
  }

  // Sparkline compact (inline, 5px bars)
  function spark(arr, color) {
    if(!arr?.length) return '<span style="font-size:0.65rem;color:var(--text-dim);">—</span>';
    const mx = Math.max(...arr.map(Number),1);
    const bars = arr.map((v,i)=>{
      const h=Math.max(Math.round((Number(v)/mx)*20),1);
      return `<div style="width:5px;height:${h}px;background:${color};border-radius:1px;opacity:${0.35+(i/arr.length)*0.65};"></div>`;
    }).join('');
    return `<div style="display:inline-flex;align-items:flex-end;gap:1px;height:20px;vertical-align:middle;">${bars}</div>`;
  }

  // CI badge
  function ciBadge(ci) {
    if(!ci) return '';
    return `<div style="font-size:0.62rem;color:var(--text-muted);font-family:var(--font-mono);margin-top:1px;white-space:nowrap;">[${f1(ci[0])} – ${f1(ci[1])}]</div>`;
  }

  // A single data cell for the table
  function cell(val, sd, ciData, arr, color, base, isBetter) {
    const vl = vLabel(sd, base);
    return `<div style="text-align:center;padding:8px 6px;">
      <div style="font-family:var(--font-mono);font-size:1.15rem;font-weight:900;color:${isBetter?color:'var(--text-main)'};">${f1(val)}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:4px;margin:2px 0;">
        ${spark(arr,color)}
      </div>
      <div style="font-size:0.56rem;font-weight:800;color:${vl.col};text-transform:uppercase;letter-spacing:0.04em;">${vl.icon} ${vl.lbl}</div>
      <div style="font-size:0.62rem;color:var(--text-muted);font-family:var(--font-mono);">σ=${f2(sd)}</div>
      ${ciBadge(ciData)}
    </div>`;
  }

  // Season cell (no sparkline)
  function seaCell(mean, sd, ci, color, source) {
    if(mean==null||isNaN(mean)) return `<div style="text-align:center;padding:8px 6px;color:var(--text-dim);font-size:0.75rem;">—</div>`;
    return `<div style="text-align:center;padding:8px 6px;">
      <div style="font-family:var(--font-mono);font-size:1.05rem;font-weight:800;color:var(--text-main);">${f1(mean)}</div>
      <div style="font-size:0.62rem;color:var(--text-muted);margin:2px 0;font-family:var(--font-mono);">σ=${f2(sd)}</div>
      <div style="font-size:0.5rem;color:${source==='empirical'?'var(--accent-green)':'var(--text-dim)'};">●${source==='empirical'?'emp':'Poisson'}</div>
      ${ciBadge(ci)}
    </div>`;
  }

  // ── Build all data ────────────────────────────────────────────────
  const rows = [
    {
      label:'Γκολ ⚽',
      icon:'⚽',
      color:'var(--accent-green)',
      base: BASE.goals,
      higherBetter: true,
      h: { val:arrMean(hr6.goalsArr),  sd:hr6.sdGoals,  arr:hr6.goalsArr,  ci:(arrMean(hr6.goalsArr)!=null&&hr6.sdGoals>0)?ci95(arrMean(hr6.goalsArr),hr6.sdGoals,hr6.goalsArr?.length):null,
           seaMean:hSea.avgGoals, seaSd:hSea.sdGoals, seaCi:(hSea.avgGoals!=null&&hSea.sdGoals>0)?ci95(hSea.avgGoals,hSea.sdGoals,hSea.n):null, seaSrc:hSea.sdGoalsSource||'th' },
      a: { val:arrMean(ar6.goalsArr),  sd:ar6.sdGoals,  arr:ar6.goalsArr,  ci:(arrMean(ar6.goalsArr)!=null&&ar6.sdGoals>0)?ci95(arrMean(ar6.goalsArr),ar6.sdGoals,ar6.goalsArr?.length):null,
           seaMean:aSea.avgGoals, seaSd:aSea.sdGoals, seaCi:(aSea.avgGoals!=null&&aSea.sdGoals>0)?ci95(aSea.avgGoals,aSea.sdGoals,aSea.n):null, seaSrc:aSea.sdGoalsSource||'th' },
    },
    {
      label:'Γκολ Δεχ. 🛡',
      icon:'🛡',
      color:'var(--accent-red)',
      base: BASE.goalsAgainst,
      higherBetter: false,
      h: { val:arrMean(hr6.goalsAgainstArr), sd:hr6.sdGoalsAgainst, arr:hr6.goalsAgainstArr,
           ci:(arrMean(hr6.goalsAgainstArr)!=null&&hr6.sdGoalsAgainst>0)?ci95(arrMean(hr6.goalsAgainstArr),hr6.sdGoalsAgainst,hr6.goalsAgainstArr?.length):null,
           seaMean:hSea.avgGoalsAgainst, seaSd:hSea.sdGoalsAgainst, seaCi:null, seaSrc:'th' },
      a: { val:arrMean(ar6.goalsAgainstArr), sd:ar6.sdGoalsAgainst, arr:ar6.goalsAgainstArr,
           ci:(arrMean(ar6.goalsAgainstArr)!=null&&ar6.sdGoalsAgainst>0)?ci95(arrMean(ar6.goalsAgainstArr),ar6.sdGoalsAgainst,ar6.goalsAgainstArr?.length):null,
           seaMean:aSea.avgGoalsAgainst, seaSd:aSea.sdGoalsAgainst, seaCi:null, seaSrc:'th' },
    },
    {
      label:'Κόρνερ 🚩',
      icon:'🚩',
      color:'var(--accent-teal)',
      base: BASE.corners,
      higherBetter: true,
      h: { val:arrMean(hr6.cornersArr), sd:hr6.sdCorners, arr:hr6.cornersArr,
           ci:(arrMean(hr6.cornersArr)!=null&&hr6.sdCorners>0)?ci95(arrMean(hr6.cornersArr),hr6.sdCorners,hr6.cornersArr?.length):null,
           seaMean:hSea.avgCorners, seaSd:hSea.sdCorners, seaCi:(hSea.avgCorners!=null&&hSea.sdCorners>0)?ci95(hSea.avgCorners,hSea.sdCorners,hSea.n):null, seaSrc:hSea.sdCornersSource||'th' },
      a: { val:arrMean(ar6.cornersArr), sd:ar6.sdCorners, arr:ar6.cornersArr,
           ci:(arrMean(ar6.cornersArr)!=null&&ar6.sdCorners>0)?ci95(arrMean(ar6.cornersArr),ar6.sdCorners,ar6.cornersArr?.length):null,
           seaMean:aSea.avgCorners, seaSd:aSea.sdCorners, seaCi:(aSea.avgCorners!=null&&aSea.sdCorners>0)?ci95(aSea.avgCorners,aSea.sdCorners,aSea.n):null, seaSrc:aSea.sdCornersSource||'th' },
    },
    {
      label:'Κάρτες 🟨',
      icon:'🟨',
      color:'var(--accent-gold)',
      base: BASE.cards,
      higherBetter: false,
      h: { val:arrMean(hr6.cardsArr), sd:hr6.sdCards, arr:hr6.cardsArr,
           ci:(arrMean(hr6.cardsArr)!=null&&hr6.sdCards>0)?ci95(arrMean(hr6.cardsArr),hr6.sdCards,hr6.cardsArr?.length):null,
           seaMean:hSea.avgCards, seaSd:hSea.sdCards, seaCi:(hSea.avgCards!=null&&hSea.sdCards>0)?ci95(hSea.avgCards,hSea.sdCards,hSea.n):null, seaSrc:hSea.sdCardsSource||'th' },
      a: { val:arrMean(ar6.cardsArr), sd:ar6.sdCards, arr:ar6.cardsArr,
           ci:(arrMean(ar6.cardsArr)!=null&&ar6.sdCards>0)?ci95(arrMean(ar6.cardsArr),ar6.sdCards,ar6.cardsArr?.length):null,
           seaMean:aSea.avgCards, seaSd:aSea.sdCards, seaCi:(aSea.avgCards!=null&&aSea.sdCards>0)?ci95(aSea.avgCards,aSea.sdCards,aSea.n):null, seaSrc:aSea.sdCardsSource||'th' },
    },
  ];

  // ── Alert banner ─────────────────────────────────────────────────
  const hSdG = hr6.sdGoals, aSdG = ar6.sdGoals;
  const bothVolatile = hSdG>BASE.goals*1.4 && aSdG>BASE.goals*1.4;
  const bothStable   = hSdG!=null&&aSdG!=null&&!isNaN(hSdG)&&!isNaN(aSdG)&&hSdG<BASE.goals*0.75&&aSdG<BASE.goals*0.75;
  const alertBox = bothVolatile
    ? `<div style="display:flex;align-items:center;gap:8px;background:rgba(251,113,133,0.07);border:1px solid rgba(251,113,133,0.25);border-radius:7px;padding:8px 12px;margin-bottom:12px;font-size:0.72rem;"><span style="font-size:1rem;">⚠️</span><span><strong style="color:var(--accent-red);">Αμοιβαία Αστάθεια</strong> — Μεγαλύτερο εύρος αβεβαιότητας.</span></div>`
    : bothStable
    ? `<div style="display:flex;align-items:center;gap:8px;background:rgba(74,222,128,0.07);border:1px solid rgba(74,222,128,0.22);border-radius:7px;padding:8px 12px;margin-bottom:12px;font-size:0.72rem;"><span style="font-size:1rem;">✅</span><span><strong style="color:var(--accent-green);">Αμοιβαία Σταθερότητα</strong> — Υψηλότερη αξιοπιστία πρόβλεψης.</span></div>`
    : '';

  // ── Team header labels (short) ────────────────────────────────────
  const htShort = esc((ht||'Home').split(' ').slice(0,2).join(' '));
  const atShort = esc((at||'Away').split(' ').slice(0,2).join(' '));

  // ── Build comparative table ───────────────────────────────────────
  // Columns: Μέγεθος | HOME last6 | HOME sea | VS | AWAY last6 | AWAY sea
  const tableRows = rows.map(row => {
    const [hCol, aCol] = compareColor(row.h.val, row.a.val, row.higherBetter);
    const hBetter = hCol === 'var(--accent-green)';
    const aBetter = aCol === 'var(--accent-green)';

    // Volatility label for each
    const hV = vLabel(row.h.sd, row.base);
    const aV = vLabel(row.a.sd, row.base);

    return `
    <tr style="border-bottom:1px solid var(--border-light);">

      <!-- Label -->
      <td style="padding:8px 10px 8px 4px;vertical-align:middle;white-space:nowrap;">
        <div style="font-size:0.78rem;font-weight:700;color:var(--text-sub);font-family:var(--font-cond);text-transform:uppercase;letter-spacing:0.08em;">${row.label}</div>
      </td>

      <!-- HOME last6 -->
      <td style="padding:4px;background:${hBetter?'rgba(74,222,128,0.04)':'transparent'};border-left:1px solid var(--border-light);">
        <div style="text-align:center;">
          <div style="font-family:var(--font-mono);font-size:1.2rem;font-weight:900;color:${hBetter?row.color:'var(--text-main)'};">${f1(row.h.val)}</div>
          <div style="display:flex;justify-content:center;margin:2px 0;">${spark(row.h.arr,row.color)}</div>
          <div style="font-size:0.65rem;font-weight:800;color:${hV.col};text-transform:uppercase;">${hV.icon} ${hV.lbl}</div>
          <div style="font-size:0.5rem;color:var(--text-muted);font-family:var(--font-mono);">σ=${f2(row.h.sd)}</div>
          ${row.h.ci ? `<div style="font-size:0.48rem;color:var(--text-dim);font-family:var(--font-mono);margin-top:1px;">[${f1(row.h.ci[0])}–${f1(row.h.ci[1])}]</div>` : ''}
        </div>
      </td>

      <!-- HOME season -->
      <td style="padding:4px;background:rgba(255,255,255,0.01);border-left:1px solid rgba(255,255,255,0.04);">
        <div style="text-align:center;">
          <div style="font-family:var(--font-mono);font-size:0.9rem;font-weight:700;color:var(--text-sub);">${f1(row.h.seaMean)}</div>
          <div style="font-size:0.5rem;color:var(--text-muted);font-family:var(--font-mono);">σ=${f2(row.h.seaSd)}</div>
          <div style="font-size:0.48rem;color:${row.h.seaSrc==='empirical'?'var(--accent-green)':'var(--text-dim)'};">●${row.h.seaSrc==='empirical'?'emp':'th'}</div>
          ${row.h.seaCi ? `<div style="font-size:0.48rem;color:var(--text-dim);font-family:var(--font-mono);margin-top:1px;">[${f1(row.h.seaCi[0])}–${f1(row.h.seaCi[1])}]</div>` : ''}
        </div>
      </td>

      <!-- VS divider -->
      <td style="padding:0 4px;text-align:center;vertical-align:middle;">
        <div style="font-size:0.6rem;font-weight:800;color:var(--text-dim);font-family:var(--font-cond);">VS</div>
      </td>

      <!-- AWAY season -->
      <td style="padding:4px;background:rgba(255,255,255,0.01);border-right:1px solid rgba(255,255,255,0.04);">
        <div style="text-align:center;">
          <div style="font-family:var(--font-mono);font-size:0.9rem;font-weight:700;color:var(--text-sub);">${f1(row.a.seaMean)}</div>
          <div style="font-size:0.5rem;color:var(--text-muted);font-family:var(--font-mono);">σ=${f2(row.a.seaSd)}</div>
          <div style="font-size:0.48rem;color:${row.a.seaSrc==='empirical'?'var(--accent-green)':'var(--text-dim)'};">●${row.a.seaSrc==='empirical'?'emp':'th'}</div>
          ${row.a.seaCi ? `<div style="font-size:0.48rem;color:var(--text-dim);font-family:var(--font-mono);margin-top:1px;">[${f1(row.a.seaCi[0])}–${f1(row.a.seaCi[1])}]</div>` : ''}
        </div>
      </td>

      <!-- AWAY last6 -->
      <td style="padding:4px;background:${aBetter?'rgba(74,222,128,0.04)':'transparent'};border-left:1px solid var(--border-light);">
        <div style="text-align:center;">
          <div style="font-family:var(--font-mono);font-size:1.2rem;font-weight:900;color:${aBetter?row.color:'var(--text-main)'};">${f1(row.a.val)}</div>
          <div style="display:flex;justify-content:center;margin:2px 0;">${spark(row.a.arr,row.color)}</div>
          <div style="font-size:0.65rem;font-weight:800;color:${aV.col};text-transform:uppercase;">${aV.icon} ${aV.lbl}</div>
          <div style="font-size:0.5rem;color:var(--text-muted);font-family:var(--font-mono);">σ=${f2(row.a.sd)}</div>
          ${row.a.ci ? `<div style="font-size:0.48rem;color:var(--text-dim);font-family:var(--font-mono);margin-top:1px;">[${f1(row.a.ci[0])}–${f1(row.a.ci[1])}]</div>` : ''}
        </div>
      </td>

    </tr>`;
  }).join('');

  return `
  ${alertBox}
  <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
  <table style="width:100%;border-collapse:separate;border-spacing:0;min-width:360px;">

    <!-- HEADER -->
    <thead>
      <tr>
        <th style="padding:0 6px 10px 0;width:26%;text-align:left;font-size:0.62rem;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;font-family:var(--font-cond);border-bottom:2px solid var(--border-md);"></th>
        <th style="padding:0 4px 10px;text-align:center;border-bottom:2px solid rgba(252,211,77,0.4);border-left:2px solid rgba(252,211,77,0.2);">
          <div style="font-size:0.75rem;font-weight:800;color:var(--accent-gold);font-family:var(--font-cond);text-transform:uppercase;letter-spacing:0.1em;">🏠 ${htShort}</div>
        </th>
        <th style="padding:0 4px 10px;width:8%;border-bottom:2px solid var(--border-md);"></th>
        <th style="padding:0 4px 10px;text-align:center;border-bottom:2px solid rgba(77,184,255,0.4);border-right:2px solid rgba(77,184,255,0.2);">
          <div style="font-size:0.75rem;font-weight:800;color:var(--accent-blue);font-family:var(--font-cond);text-transform:uppercase;letter-spacing:0.1em;">✈️ ${atShort}</div>
        </th>
      </tr>
    </thead>

    <tbody>
    ${rows.map(row => {
      const [hCol, aCol] = compareColor(row.h.val, row.a.val, row.higherBetter);
      const hBetter = hCol === 'var(--accent-green)';
      const aBetter = aCol === 'var(--accent-green)';
      const hV = vLabel(row.h.sd, row.base);
      const aV = vLabel(row.a.sd, row.base);

      // Sparkline inline
      const mkSpark = (arr, color) => {
        if(!arr?.length) return '<span style="color:var(--text-dim);font-size:0.6rem;">—</span>';
        const mx = Math.max(...arr.map(Number), 1);
        return `<div style="display:inline-flex;align-items:flex-end;gap:2px;height:22px;vertical-align:middle;">` +
          arr.map((v,i) => {
            const h = Math.max(Math.round((Number(v)/mx)*22), 2);
            return `<div style="width:6px;height:${h}px;background:${color};border-radius:2px 2px 0 0;opacity:${0.35+(i/arr.length)*0.65};"></div>`;
          }).join('') + `</div>`;
      };

      // Stat block: val + spark + volatility chip + σ + CI
      const statBlock = (side, color, isBetter) => `
        <div style="text-align:center;padding:10px 6px;">
          <div style="font-family:var(--font-mono);font-size:1.35rem;font-weight:900;color:${isBetter?color:'var(--text-main)'};line-height:1;margin-bottom:4px;">${f1(side.val)}</div>
          <div style="margin-bottom:5px;">${mkSpark(side.arr, color)}</div>
          <div style="display:inline-flex;align-items:center;gap:3px;background:${hV.col}18;border:1px solid ${isBetter?color+'44':'var(--border-light)'};border-radius:6px;padding:2px 7px;margin-bottom:4px;">
            <span style="font-size:0.6rem;font-weight:800;color:${isBetter?color:hV.col};">${(side===row.h?hV:aV).icon} ${(side===row.h?hV:aV).lbl}</span>
          </div>
          <div style="font-size:0.58rem;color:var(--text-muted);font-family:var(--font-mono);">ΜΟ σεζ: <span style="color:var(--text-sub);">${f1(side.seaMean)}</span></div>
          <div style="font-size:0.56rem;color:var(--text-dim);font-family:var(--font-mono);">σ=${f2(side.sd)}</div>
          ${side.ci ? `<div style="font-size:0.54rem;color:var(--text-dim);font-family:var(--font-mono);margin-top:1px;">ΔΕ₉₅ [${f1(side.ci[0])}–${f1(side.ci[1])}]</div>` : ''}
        </div>`;

      return `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
        <!-- Label -->
        <td style="padding:8px 8px 8px 0;vertical-align:middle;">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-sub);font-family:var(--font-cond);text-transform:uppercase;letter-spacing:0.07em;white-space:nowrap;">${row.label}</div>
        </td>
        <!-- HOME -->
        <td style="background:${hBetter?'rgba(74,222,128,0.04)':'rgba(252,211,77,0.02)'};border-left:2px solid rgba(252,211,77,0.2);">
          ${statBlock(row.h, row.color, hBetter)}
        </td>
        <!-- VS -->
        <td style="text-align:center;vertical-align:middle;padding:0 4px;">
          <div style="font-size:0.55rem;font-weight:800;color:var(--text-dim);font-family:var(--font-cond);letter-spacing:0.1em;">VS</div>
        </td>
        <!-- AWAY -->
        <td style="background:${aBetter?'rgba(74,222,128,0.04)':'rgba(77,184,255,0.02)'};border-right:2px solid rgba(77,184,255,0.2);">
          ${statBlock(row.a, row.color, aBetter)}
        </td>
      </tr>`;
    }).join('')}
    </tbody>

    <tfoot>
      <tr><td colspan="4" style="padding:6px 0 2px;font-size:0.52rem;color:var(--text-dim);font-family:var(--font-mono);">
        ΔΕ₉₅ = Διάστημα Εμπιστοσύνης 95% · σ = τυπ.απόκλιση · <span style="color:var(--accent-green);">πράσινο</span> = ισχυρότερη πλευρά ανά μέγεθος
      </td></tr>
    </tfoot>
  </table>
  </div>`;
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
        const conf=clamp(safeNum(x.strength),0,100);
        const confCol=conf>=70?'var(--accent-green)':conf>=55?'var(--accent-gold)':'var(--accent-red)';
        const hasSignal = conf >= 70 && x.omegaPick && !x.omegaPick.includes('ΧΩΡΙΣ');
        let omCol = hasSignal
          ? (x.omegaPick.includes('💣')||x.omegaPick.includes('⚡') ? 'var(--accent-gold)'
          : x.omegaPick.includes('ΠΑΝΩ ΑΠΟ 3') ? 'var(--accent-purple)'
          : x.omegaPick.includes('ΠΑΝΩ') ? 'var(--accent-green)'
          : x.omegaPick.includes('ΚΑΤΩ') ? 'var(--accent-teal)'
          : x.omegaPick.includes('ΓΚΟΛ') ? 'var(--accent-blue)'
          : 'var(--text-main)')
          : 'var(--text-dim)';
        const liveExtra=live&&x.liveCorners!==undefined?`<div style="font-size:0.65rem;color:var(--accent-teal);margin-top:4px;">🚩${x.liveCorners} 🟨${x.liveYellows||0}</div>`:'';
        
        const hasInjury = (x.hInjAdj?.delta < -0.05) || (x.aInjAdj?.delta < -0.05);
        const injBadge  = hasInjury ? `<span style="background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.65rem;font-weight:800;padding:2px 5px;border-radius:4px;margin-left:6px;">${acr('INJ')}</span>` : '';
        const lineupSrcBadge = x.lineupData?.available
          ? `<span style="background:rgba(45,212,191,0.12);color:var(--accent-teal);font-size:0.62rem;font-weight:800;padding:2px 5px;border-radius:4px;margin-left:5px;">📋 XI</span>`
          : `<span style="font-size:0.62rem;color:var(--text-muted);margin-left:5px;">~XI</span>`;
        // Sub flash pulse badge
        const subFlash = x.subTimestamp && (Date.now()-x.subTimestamp<120000)
          ? `<span class="sub-flash-badge">🔄</span>` : '';

        // Live Intelligence extras
        const li = live ? x.liveIntel : null;
        const elapsed = li?.elapsed || x.m?.fixture?.status?.elapsed || null;

        // Λεπτό αγώνα — φαίνεται πάντα σε live αγώνες
        const minuteBadge = live ? `<div style="display:inline-flex;align-items:center;gap:4px;margin-top:3px;">
          <span style="background:rgba(74,222,128,0.15);color:var(--accent-green);font-family:var(--font-mono);font-size:0.75rem;font-weight:900;padding:2px 7px;border-radius:4px;border:1px solid rgba(74,222,128,0.3);">
            ${elapsed ? elapsed + "'" : sh}
          </span>
        </div>` : '';

        const momentumBar = li ? `<div style="display:flex;height:3px;border-radius:2px;overflow:hidden;margin-top:4px;gap:1px;">
          <div style="width:${li.hMomentum}%;background:var(--accent-gold);border-radius:2px 0 0 2px;"></div>
          <div style="width:${li.aMomentum}%;background:var(--accent-blue);border-radius:0 2px 2px 0;"></div>
        </div>` : '';

        const nextGoalBadge = li ? `<div style="font-size:0.62rem;color:var(--accent-teal);margin-top:2px;font-weight:700;">
          🎯 ${li.pNextHome>li.pNextAway?'🏠':'✈️'} ${Math.round(Math.max(li.pNextHome,li.pNextAway)*100)}%
          &nbsp;·&nbsp; ${acr('xGA')}: ${li.hLiveXGA.toFixed(2)}|${li.aLiveXGA.toFixed(2)}
        </div>` : '';

        // SQD + Live Edge — εμφανίζεται μόλις υπάρχουν shots
        const sqdBadge = li && (li.hTot + li.aTot) >= 2 ? (() => {
          const sqdVal = li.sqd || 0;
          const sqdAbs = Math.abs(sqdVal).toFixed(3);
          const sqdSide = sqdVal > 0.01 ? '🏠' : sqdVal < -0.01 ? '✈️' : '⚖️';
          const sqdCol  = Math.abs(sqdVal) > 0.03 ? (sqdVal > 0 ? 'var(--accent-gold)' : 'var(--accent-blue)') : 'var(--text-muted)';
          const edgeH   = li.hLiveEdge || 50;
          const edgeCol = edgeH > 55 ? 'var(--accent-gold)' : edgeH < 45 ? 'var(--accent-blue)' : 'var(--text-muted)';
          return `<div style="font-size:0.6rem;margin-top:3px;display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
            <span style="color:${sqdCol};font-weight:700;">${acr('SQD')} ${sqdSide} ${sqdAbs}</span>
            <span style="color:var(--text-dim);">·</span>
            <span style="color:${edgeCol};font-weight:700;">${acr('Edge')} 🏠${edgeH.toFixed(0)}%</span>
          </div>`;
        })() : (li ? `<div style="font-size:0.58rem;color:var(--text-dim);margin-top:2px;">Αναμονή shots...</div>` : '');

        rows+=`<tr id="row-${x.fixId}" onclick="toggleMatchDetails('${x.fixId}')" style="cursor:pointer;${live?'background:rgba(16,185,129,0.03)':''}">
          <td class="col-match left-align" style="font-weight:700;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              ${live ? `<span class="live-dot" style="width:7px;height:7px;flex-shrink:0;display:inline-block;"></span>` : ''}
              ${live && elapsed ? `<span style="background:rgba(74,222,128,0.15);color:var(--accent-green);font-family:var(--font-mono);font-size:0.72rem;font-weight:900;padding:1px 6px;border-radius:4px;border:1px solid rgba(74,222,128,0.3);flex-shrink:0;">${elapsed}'</span>` : ''}
              <span style="font-size:0.95rem;">${esc(x.ht)}</span>
              <span style="color:var(--text-dim);font-size:0.8rem;">–</span>
              <span style="font-size:0.95rem;">${esc(x.at)}</span>
              ${injBadge}${lineupSrcBadge}${subFlash}
            </div>
            ${(() => {
              const hPos = x.hr, aPos = x.ar;
              if(!hPos || hPos >= 99) return '';
              const posCol = p => p <= 4 ? 'var(--accent-green)' : p >= 17 ? 'var(--accent-red)' : 'var(--text-muted)';
              return `<div style="display:flex;gap:6px;margin-top:3px;font-size:0.65rem;font-family:var(--font-mono);">
                <span style="color:${posCol(hPos)};">#${hPos}</span>
                <span style="color:var(--text-dim);">vs</span>
                <span style="color:${posCol(aPos)};">#${aPos}</span>
              </div>`;
            })()}
          </td>
          <td class="col-score data-num" style="color:${scoreCol};">${scoreStr}${liveExtra}${momentumBar}${nextGoalBadge}${sqdBadge}</td>
          <td class="col-1x2 data-num" style="font-size:1.1rem;">${x.outPick}</td>
          <td class="col-o25 data-num" style="font-size:1.1rem;">${x.omegaPick?.includes('OVER 2')?'🔥':'-'}</td>
          <td class="col-u25 data-num" style="font-size:1.1rem;">${x.omegaPick?.includes('UNDER 2')?'🔒':'-'}</td>
          <td class="col-btts data-num" style="font-size:1.1rem;">${x.omegaPick?.includes('GOAL')?'🎯':'-'}</td>
          <td class="col-exact data-num" style="font-size:0.95rem; line-height:1.4;">
            <span style="color:var(--accent-blue);font-weight:800;">${x.exact||'?-?'}</span>${x.exact2&&x.exact2!==x.exact?`<br><span style="color:var(--accent-purple);font-size:0.8rem;">${x.exact2}</span>`:''}
            ${x.htAnalysis?`<br><span style="color:var(--accent-teal);font-size:0.75rem;font-weight:700;">⏱ ${x.htAnalysis.htBest.h}-${x.htAnalysis.htBest.a}</span>`:''}
          </td>
          <td class="col-conf data-num" style="color:${confCol}; font-size:1.1rem;">${hasSignal ? conf.toFixed(0)+'%' : `<span style="color:var(--text-dim);font-size:0.8rem;">${conf.toFixed(0)}%</span>`}</td>
          <td class="col-signal" style="color:${omCol};font-weight:800;font-size:0.85rem;">${hasSignal ? (x.omegaPick||'—').split(' ').slice(0,3).join(' ') : '<span style="color:var(--text-dim);font-size:0.75rem;">— χαμηλό conf.</span>'}</td>
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
      const ah = x.m?.goals?.home??0, aa = x.m?.goals?.away??0;
      const aTot = ah+aa, aOut = ah>aa?'1':ah<aa?'2':'X', aBtts = ah>0&&aa>0;

      // ── Πραγματικά στατιστικά (από actStats API)
      const hXGAct  = Number(x.actStats?.hXg||0).toFixed(2);
      const aXGAct  = Number(x.actStats?.aXg||0).toFixed(2);
      const hPoss   = x.actStats?.hPoss||'—';
      const aPoss   = x.actStats?.aPoss||'—';
      const hCorAct = x.actStats?.hCor||0, aCorAct = x.actStats?.aCor||0;
      const hCrdAct = x.actStats?.hCrd||0, aCrdAct = x.actStats?.aCrd||0;
      const hOffAct = x.actStats?.hOff||0, aOffAct = x.actStats?.aOff||0;

      // ── Προβλέψεις μοντέλου
      const hXGPred  = Number(x.hXGfinal||0).toFixed(2);
      const aXGPred  = Number(x.aXGfinal||0).toFixed(2);
      const tXGPred  = (Number(x.hXGfinal||0)+Number(x.aXGfinal||0)).toFixed(2);
      const hCorPred = Number(x.hProjCor||x.expCor/2||0).toFixed(1);
      const aCorPred = Number(x.aProjCor||x.expCor/2||0).toFixed(1);
      const expCorPred = Number(x.expCor||0).toFixed(1);
      // Προβλεπόμενες κάρτες από το μοντέλο
      const hCrdPred = Number(x.hS?.crd||0).toFixed(1);
      const aCrdPred = Number(x.aS?.crd||0).toFixed(1);
      const totCrdPred = (Number(x.hS?.crd||0)+Number(x.aS?.crd||0)).toFixed(1);
      const totCrdAct  = hCrdAct + aCrdAct;
      const crdDev = Math.abs(totCrdAct - Number(totCrdPred));
      const crdCol = crdDev < 1.5 ? 'var(--accent-green)' : crdDev < 3 ? 'var(--accent-gold)' : 'var(--accent-red)';
      const hOffPred = Number(x.offside?.hLambda||0);
      const aOffPred = Number(x.offside?.aLambda||0);
      const totOffPred = hOffPred + aOffPred;
      const totOffAct = hOffAct + aOffAct;
      const offDev = Math.abs(totOffAct - totOffPred);
      const offCol = offDev < 1.0 ? 'var(--accent-green)' : offDev < 2.0 ? 'var(--accent-gold)' : 'var(--accent-red)';

      // ── Σύγκριση: πράσινο αν η πρόβλεψη ήταν εντός ±20%, κόκκινο αν πολύ έξω
      const xgDev = Math.abs((Number(hXGAct)+Number(aXGAct)) - Number(tXGPred));
      const xgCol = xgDev < 0.5 ? 'var(--accent-green)' : xgDev < 1.0 ? 'var(--accent-gold)' : 'var(--accent-red)';
      const corDev = Math.abs((hCorAct+aCorAct) - Number(expCorPred));
      const corCol = corDev < 2 ? 'var(--accent-green)' : corDev < 4 ? 'var(--accent-gold)' : 'var(--accent-red)';

      // ── Result badge
      let hitHtml = `<span style="color:var(--text-muted)">—</span>`;
      const pick = x.omegaPick||'';
      if(pick && !pick.includes('ΧΩΡΙΣ') && !pick.includes('NO BET')) {
        let hit = false;
        if(pick.includes('ΠΑΝΩ ΑΠΟ 3.5'))                          hit = aTot > 3.5;
        else if(pick.includes('ΠΑΝΩ ΑΠΟ 2.5')||pick.includes('OVER 2')) hit = aTot > 2.5;
        else if(pick.includes('ΚΑΤΩ ΑΠΟ 2.5')||pick.includes('UNDER')) hit = aTot < 2.5;
        else if(pick.includes('ΓΚΟΛ/ΓΚΟΛ')||pick.includes('GG'))   hit = aBtts;
        else if(pick.includes('ΑΣΟΣ')&&!pick.includes('AH'))        hit = aOut==='1';
        else if(pick.includes('ΔΙΠΛΟ')&&!pick.includes('AH'))       hit = aOut==='2';
        else if(pick.includes('ΝΙΚΗ ΓΗΠΕΔ'))                        hit = aOut==='1';
        else if(pick.includes('ΝΙΚΗ ΦΙΛΟΞ'))                        hit = aOut==='2';
        else if(pick.includes('ΚΟΡΝΕΡ'))                            hit = (hCorAct+aCorAct)>8.5;
        else if(pick.includes('ΚΑΡΤΕΣ'))                            hit = (hCrdAct+aCrdAct)>5.5;
        else if(pick.includes('AH')){
          if(pick.includes('ΑΣΟΣ'))  hit = (ah-aa)>=2;
          if(pick.includes('ΔΙΠΛΟ')) hit = (aa-ah)>=2;
        }
        hitHtml = hit
          ? `<span style="background:rgba(74,222,128,0.15);color:var(--accent-green);padding:3px 8px;border-radius:5px;font-weight:800;font-size:0.72rem;">✅ WON</span>`
          : `<span style="background:rgba(251,113,133,0.15);color:var(--accent-red);padding:3px 8px;border-radius:5px;font-weight:800;font-size:0.72rem;">❌ LOST</span>`;
      }

      // ── Pred vs Actual cell helper
      const pvA = (pred, actual, col='var(--text-main)') =>
        `<div style="font-family:var(--font-mono);line-height:1.4;">
           <div style="font-size:0.72rem;color:var(--text-muted);">📐 ${pred}</div>
           <div style="font-size:0.92rem;font-weight:800;color:${col};">✔ ${actual}</div>
         </div>`;

      fRows += `
        <tr id="row-${x.fixId}" onclick="toggleMatchDetails('${x.fixId}')" style="cursor:pointer;" onmouseover="this.style.background='rgba(77,184,255,0.04)'" onmouseout="this.style.background=''">
          <td class="left-align" style="font-weight:700;font-size:0.95rem;min-width:140px;">
            ${esc(x.ht)}<span style="color:var(--text-dim);"> vs </span>${esc(x.at)}
            <div style="font-size:0.65rem;color:var(--text-muted);margin-top:1px;">${esc(x.lg||'')}</div>
          </td>
          <td style="text-align:center;">
            <div style="font-family:var(--font-mono);font-size:1.3rem;font-weight:900;color:var(--text-main);">${ah}-${aa}</div>
            <div style="font-size:0.6rem;color:var(--text-muted);">${aTot} γκολ</div>
          </td>
          <td>${pvA(`${hXGPred}–${aXGPred} (${tXGPred})`, `${hXGAct}–${aXGAct}`, xgCol)}</td>
          <td style="text-align:center;font-family:var(--font-mono);">
            <div style="font-size:0.72rem;color:var(--text-muted);">—</div>
            <div style="font-size:0.9rem;font-weight:700;">${hPoss}%–${aPoss}%</div>
          </td>
          <td>${pvA(`${hCorPred}–${aCorPred} (${expCorPred})`, `${hCorAct}–${aCorAct} (${hCorAct+aCorAct})`, corCol)}</td>
          <td>${pvA(`${hCrdPred}–${aCrdPred} (${totCrdPred})`, `${hCrdAct}–${aCrdAct} (${totCrdAct})`, crdCol)}</td>
          <td>${pvA(`${hOffPred.toFixed(1)}–${aOffPred.toFixed(1)} (${totOffPred.toFixed(1)})`, `${hOffAct}–${aOffAct} (${totOffAct})`, offCol)}</td>
          <td style="font-size:0.78rem;font-weight:700;color:${x.strength>=70?'var(--accent-green)':'var(--text-muted)'};max-width:140px;">
            ${esc(pick.split(' ').slice(0,4).join(' ')||'—')}
            ${x.strength>=70?`<div style="font-size:0.6rem;color:var(--text-muted);">${x.strength?.toFixed(0)}% conf</div>`:''}
          </td>
          <td>${hitHtml}</td>
        </tr>
        <tr id="details-${x.fixId}" style="display:none;background:var(--bg-surface);">
          ${buildAccordionHTML(x)}
        </tr>`;
    });

    // ── Model Accuracy Analysis ────────────────────────────────────
    // Μόνο αν έχουμε ≥3 ολοκληρωμένους αγώνες με actStats
    const validForAnalysis = finishedMatches.filter(x =>
      x.actStats && x.hXGfinal && x.aXGfinal
    );

    let accuracyHtml = '';
    if(validForAnalysis.length >= 2) {
      // Συλλογή δεδομένων ανά metric
      const metrics = {
        xGH:   { label:'xG HOME',        pred:[], actual:[], errors:[] },
        xGA:   { label:'xG AWAY',         pred:[], actual:[], errors:[] },
        tXG:   { label:'Total xG',        pred:[], actual:[], errors:[] },
        corners:{ label:'Κόρνερ (Σύν.)', pred:[], actual:[], errors:[] },
        cards:  { label:'Κάρτες (Σύν.)', pred:[], actual:[], errors:[] },
        offsides:{ label:'Οφσάιντ (Σύν.)', pred:[], actual:[], errors:[] },
        goals:  { label:'Γκολ (Σύν.)',   pred:[], actual:[], errors:[] },
      };

      validForAnalysis.forEach(x => {
        const ah = x.m?.goals?.home??0, aa = x.m?.goals?.away??0;
        const hXGAct = Number(x.actStats?.hXg||0);
        const aXGAct = Number(x.actStats?.aXg||0);
        const hCorAct = x.actStats?.hCor||0, aCorAct = x.actStats?.aCor||0;
        const hCrdAct = x.actStats?.hCrd||0, aCrdAct = x.actStats?.aCrd||0;
        const hOffAct = x.actStats?.hOff||0, aOffAct = x.actStats?.aOff||0;
        const hXGPred = Number(x.hXGfinal||0);
        const aXGPred = Number(x.aXGfinal||0);
        const hCorPred = Number(x.hProjCor || x.expCor/2 || 0);
        const aCorPred = Number(x.aProjCor || x.expCor/2 || 0);
        const hCrdPred = Number(x.hS?.crd||0);
        const aCrdPred = Number(x.aS?.crd||0);
        const hOffPred = Number(x.offside?.hLambda||0);
        const aOffPred = Number(x.offside?.aLambda||0);

        metrics.xGH.pred.push(hXGPred);   metrics.xGH.actual.push(hXGAct);
        metrics.xGA.pred.push(aXGPred);   metrics.xGA.actual.push(aXGAct);
        metrics.tXG.pred.push(hXGPred+aXGPred); metrics.tXG.actual.push(hXGAct+aXGAct);
        metrics.corners.pred.push(hCorPred+aCorPred); metrics.corners.actual.push(hCorAct+aCorAct);
        metrics.cards.pred.push(hCrdPred+aCrdPred);   metrics.cards.actual.push(hCrdAct+aCrdAct);
        metrics.offsides.pred.push(hOffPred+aOffPred); metrics.offsides.actual.push(hOffAct+aOffAct);
        metrics.goals.pred.push(hXGPred+aXGPred);     metrics.goals.actual.push(ah+aa);
      });

      // Υπολογισμός MAE (Mean Absolute Error) και Pearson correlation
      const calcMAE = (pred, actual) => {
        const n = pred.length;
        return pred.reduce((s,p,i) => s + Math.abs(p - actual[i]), 0) / n;
      };
      const calcCorr = (pred, actual) => {
        const n = pred.length;
        if(n < 2) return 0;
        const mP = pred.reduce((a,b)=>a+b,0)/n;
        const mA = actual.reduce((a,b)=>a+b,0)/n;
        const cov = pred.reduce((s,p,i)=>s+(p-mP)*(actual[i]-mA),0)/n;
        const sdP = Math.sqrt(pred.reduce((s,p)=>s+(p-mP)**2,0)/n);
        const sdA = Math.sqrt(actual.reduce((s,a)=>s+(a-mA)**2,0)/n);
        return (sdP*sdA) > 0 ? cov/(sdP*sdA) : 0;
      };
      const calcBias = (pred, actual) => {
        // Θετικό = υπερεκτίμηση, Αρνητικό = υποεκτίμηση
        const n = pred.length;
        return pred.reduce((s,p,i)=>s+(p-actual[i]),0)/n;
      };

      // Χτίζουμε metric cards
      const mCards = Object.entries(metrics).map(([key, m]) => {
        const mae  = calcMAE(m.pred, m.actual);
        const corr = calcCorr(m.pred, m.actual);
        const bias = calcBias(m.pred, m.actual);
        const corrPct = (corr*100).toFixed(0);
        const corrCol = corr >= 0.7 ? 'var(--accent-green)' : corr >= 0.4 ? 'var(--accent-gold)' : 'var(--accent-red)';
        const biasCol = Math.abs(bias) < 0.3 ? 'var(--accent-green)' : Math.abs(bias) < 0.7 ? 'var(--accent-gold)' : 'var(--accent-red)';
        const biasStr = bias > 0 ? `+${bias.toFixed(2)} ↑` : `${bias.toFixed(2)} ↓`;
        const barW = Math.min(Math.abs(corr)*100, 100).toFixed(0);

        // Mini scatter: κάθε ζεύγος pred/actual ως dot
        const maxV = Math.max(...m.pred, ...m.actual, 1);
        const dots = m.pred.map((p,i) => {
          const x = (p/maxV*60).toFixed(1);
          const y = (60 - (m.actual[i]/maxV*60)).toFixed(1);
          const dev = Math.abs(p - m.actual[i]);
          const dc = dev < 0.5 ? 'var(--accent-green)' : dev < 1.2 ? 'var(--accent-gold)' : 'var(--accent-red)';
          return `<circle cx="${x}" cy="${y}" r="3.5" fill="${dc}" fill-opacity="0.8"/>`;
        }).join('');
        // Diagonal perfect line
        const diag = `<line x1="0" y1="60" x2="60" y2="0" stroke="rgba(255,255,255,0.15)" stroke-width="0.8" stroke-dasharray="3,2"/>`;

        return `<div style="background:var(--bg-base);border:1px solid var(--border-light);border-radius:8px;padding:12px 14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;">
            <span style="font-size:0.72rem;font-weight:800;color:var(--text-sub);font-family:var(--font-cond);text-transform:uppercase;letter-spacing:0.08em;">${m.label}</span>
            <svg width="66" height="66" style="flex-shrink:0;border:1px solid var(--border-light);border-radius:5px;background:var(--bg-surface);" viewBox="-3 -3 66 66">
              ${diag}${dots}
            </svg>
          </div>
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text-muted);margin-bottom:3px;">
              <span>Συσχέτιση Π→Α</span>
              <span style="color:${corrCol};font-weight:700;">${corrPct}%</span>
            </div>
            <div style="height:4px;background:var(--border-light);border-radius:2px;">
              <div style="height:4px;width:${barW}%;background:${corrCol};border-radius:2px;"></div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:0.68rem;">
            <div style="background:var(--bg-surface);border-radius:4px;padding:4px 6px;">
              <div style="color:var(--text-dim);font-size:0.58rem;margin-bottom:1px;">MAE (Μ. Σφάλμα)</div>
              <div style="font-family:var(--font-mono);font-weight:700;color:var(--text-main);">${mae.toFixed(2)}</div>
            </div>
            <div style="background:var(--bg-surface);border-radius:4px;padding:4px 6px;">
              <div style="color:var(--text-dim);font-size:0.58rem;margin-bottom:1px;">Bias</div>
              <div style="font-family:var(--font-mono);font-weight:700;color:${biasCol};">${biasStr}</div>
            </div>
          </div>
        </div>`;
      }).join('');

      // Correlations ranking — ποιο metric έχει τη μεγαλύτερη συσχέτιση
      const ranked = Object.entries(metrics).map(([key, m]) => ({
        label: m.label, corr: calcCorr(m.pred, m.actual)
      })).sort((a,b)=>b.corr-a.corr);

      const rankHtml = ranked.map((r,i) => {
        const col = r.corr>=0.7?'var(--accent-green)':r.corr>=0.4?'var(--accent-gold)':'var(--accent-red)';
        const medal = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣'][i]||`${i+1}.`;
        return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="font-size:0.9rem;flex-shrink:0;">${medal}</span>
          <span style="font-size:0.72rem;color:var(--text-sub);flex:1;">${r.label}</span>
          <div style="width:80px;height:5px;background:var(--border-light);border-radius:2px;">
            <div style="height:5px;width:${Math.min(Math.abs(r.corr)*100,100).toFixed(0)}%;background:${col};border-radius:2px;"></div>
          </div>
          <span style="font-family:var(--font-mono);font-size:0.72rem;font-weight:700;color:${col};min-width:36px;text-align:right;">${(r.corr*100).toFixed(0)}%</span>
        </div>`;
      }).join('');

      accuracyHtml = `
      <div class="quant-panel" style="margin-top:16px;border-color:rgba(168,85,247,0.3);">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
          <div>
            <div style="font-size:0.85rem;font-weight:800;color:var(--accent-purple);font-family:var(--font-cond);text-transform:uppercase;letter-spacing:1px;">🔬 Model Accuracy Analysis</div>
            <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px;">Βασίζεται σε ${validForAnalysis.length} αγώνες · Scatter: κόκκινο=μεγάλη απόκλιση · πράσινο=καλή πρόβλεψη</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">

          <!-- Metric Cards Grid -->
          <div>
            <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;font-family:var(--font-cond);margin-bottom:8px;">Ακρίβεια ανά Μέγεθος</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">${mCards}</div>
          </div>

          <!-- Correlation Ranking -->
          <div>
            <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;font-family:var(--font-cond);margin-bottom:8px;">Κατάταξη Συσχέτισης Π→Α</div>
            <div style="background:var(--bg-base);border:1px solid var(--border-light);border-radius:8px;padding:12px 14px;margin-bottom:12px;">
              ${rankHtml}
            </div>
            <div style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.2);border-radius:8px;padding:10px 14px;font-size:0.72rem;">
              <div style="font-weight:700;color:var(--accent-purple);margin-bottom:6px;">Ερμηνεία</div>
              <div style="color:var(--text-muted);line-height:1.6;">
                <span style="color:var(--accent-green);">●</span> ≥70%: Ισχυρή συσχέτιση — αξιόπιστη πρόβλεψη<br>
                <span style="color:var(--accent-gold);">●</span> 40-70%: Μέτρια — βοηθητική ένδειξη<br>
                <span style="color:var(--accent-red);">●</span> &lt;40%: Αδύναμη — χρειάζεται βαθμονόμηση<br>
                <span style="color:var(--text-dim);">Bias ↑</span>: Υπερεκτίμηση · <span style="color:var(--text-dim);">Bias ↓</span>: Υποεκτίμηση
              </div>
            </div>
          </div>

        </div>
      </div>`;
    }

    finalHtml += `<div class="quant-panel" style="padding:0;overflow:hidden;margin-top:24px;border-color:rgba(74,222,128,0.35);">
      <div style="background:rgba(74,222,128,0.07);padding:12px 18px;border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span style="font-size:0.82rem;font-weight:800;color:var(--accent-green);text-transform:uppercase;letter-spacing:1px;font-family:var(--font-cond);">🏁 Post-Match Evolution — ${finishedMatches.length} αγώνες</span>
        <span style="font-size:0.65rem;color:var(--text-muted);font-family:var(--font-mono);">📐 = Πρόβλεψη · ✔ = Πραγματικό</span>
      </div>
      <div class="data-table-wrapper" style="border:none;margin:0;">
        <table class="summary-table">
          <thead><tr>
            <th class="left-align">Αγώνας</th>
            <th>Σκορ</th>
            <th>xG (Π→Α)</th>
            <th>Possession</th>
            <th>Κόρνερ (Π→Α)</th>
            <th>Κάρτες (Π→Α)</th>
            <th>Οφσάιντ (Π→Α)</th>
            <th>Signal</th>
            <th>Result</th>
          </tr></thead>
          <tbody>${fRows}</tbody>
        </table>
      </div>
    </div>
    ${accuracyHtml}`;
  }

  sec.innerHTML = finalHtml;
}

// ================================================================
//  AUDIT, VAULT & AI ADVISOR (Auto-Optimization Logic)
// ================================================================
// ================================================================
//  AUDIT ENGINE v3 — Auto-detect + Immediate Calibration
// ================================================================

/**
 * Κύρια audit function.
 * Αν καλείται χωρίς ορίσματα → τρέχει manual με UI dates.
 * Αν καλείται μετά από scan (autoMode=true) → βρίσκει αυτόματα
 * το date range από το vault και τρέχει αμέσως.
 */
window.runCustomAudit = async function(autoMode = false) {
  const store = JSON.parse(localStorage.getItem(LS_PREDS) || '[]');

  if(!store.length) {
    if(!autoMode) showErr('Δεν υπάρχουν δεδομένα στο vault. Τρέξτε scan πρώτα.');
    return;
  }

  // AUTO-DETECT: αν τα πεδία ημερομηνίας είναι κενά → παίρνει όλο το vault
  const sInput = document.getElementById('auditStart')?.value;
  const eInput = document.getElementById('auditEnd')?.value;
  if(!autoMode && (!sInput || !eInput)) {
    autoMode = true;
  }

  let s, e, leagueIds = [];
  if(autoMode) {
    const todayStr = new Date().toISOString().split('T')[0];
    const pastRecs = store.filter(x => {
      const d = (x.date || '').split('T')[0];
      return d && d < todayStr;
    });

    if(!pastRecs.length) {
      if(!sInput) showErr('Δεν υπάρχουν ολοκληρωμένοι αγώνες στο Vault ακόμα.');
      isRunning = false; setBtnsDisabled(false); setLoader(false);
      return;
    }

    const dates = pastRecs.map(x => x.date.split('T')[0]).sort();
    s = dates[0];
    e = dates[dates.length - 1];
    leagueIds = [...new Set(pastRecs.map(x => x.leagueId).filter(Boolean))];

    if(document.getElementById('auditStart')) document.getElementById('auditStart').value = s;
    if(document.getElementById('auditEnd'))   document.getElementById('auditEnd').value   = e;
  } else {
    s = sInput;
    e = eInput;
  }

  if(isRunning) return;
  isRunning = true; setBtnsDisabled(true); setLoader(true, 'Audit σε εξέλιξη…');
  document.getElementById('auditSection').innerHTML = '';

  try {

    const lgFilter = document.getElementById('auditLeague')?.value || 'ALL';

    let cands = store.filter(x => {
      const d = (x.date || '').split('T')[0];
      if(!d) return false;
      return d >= s && d <= e;
    });

    // Φίλτρο πρωταθλήματος — από dropdown (που έχει ήδη οριστεί από syncAuditFromScan)
    if(lgFilter !== 'ALL') {
      cands = cands.filter(x => String(x.leagueId) === String(lgFilter));
    } else if(autoMode && leagueIds.length > 0) {
      cands = cands.filter(x => leagueIds.includes(x.leagueId));
    }

    if(!cands.length) {
      document.getElementById('auditSection').innerHTML =
        `<div class="quant-panel" style="text-align:center;color:var(--text-muted);padding:30px;">Δεν βρέθηκαν δεδομένα για τη χρονική περίοδο που επιλέξατε.</div>`;
      isRunning = false; setBtnsDisabled(false); setLoader(false);
      return;
    }

    // ── Φέρνουμε αποτελέσματα για κάθε fixture ────────────────
    const stats = { games:0, outHit:0, validOut:0, o25T:0, o25H:0, o35T:0, o35H:0, u25T:0, u25H:0, bttsT:0, bttsH:0, exHit:0, corT:0, corH:0 };
    const rows = [], curveData = [], calibRecs = [];
    let settled = 0;

    for(let i = 0; i < cands.length; i++) {
      const p = cands[i];
      setProgress(Math.round(((i+1)/cands.length)*100), `Έλεγχος: ${p.homeTeam} vs ${p.awayTeam}`);

      const fr  = await apiReq(`fixtures?id=${p.fixtureId}`);
      const fix = fr?.response?.[0];
      if(!fix || !isFinished(fix?.fixture?.status?.short)) continue;

      settled++;
      const ah = safeNum(fix.goals.home), aa = safeNum(fix.goals.away);
      const aTot = ah + aa, aExact = `${ah}-${aa}`, aOut = ah>aa?'1':ah<aa?'2':'X', aBtts = ah>0&&aa>0;
      stats.games++;

      // Stats μόνο για records με πραγματικό pick (hasPick)
      const hadPick = p.hasPick || (!!(p.omegaPick && !p.omegaPick.includes('ΧΩΡΙΣ') && (p.strength||0) >= 70));

      let isHit1X2 = false;
      if(hadPick && p.outPick && p.outPick !== '-') {
        isHit1X2 = p.outPick === aOut;
        if(p.omegaPick?.includes('AH')) {
          if(p.omegaPick.includes('ΑΣΟΣ'))  isHit1X2 = (ah - aa) >= 2;
          if(p.omegaPick.includes('ΔΙΠΛΟ')) isHit1X2 = (aa - ah) >= 2;
        }
        if(!p.omegaPick?.includes('ΗΜΙΧΡΟΝΟ')) { stats.validOut++; if(isHit1X2) stats.outHit++; }
      }

      if(hadPick && p.predOver25)  { stats.o25T++; if(aTot > 2.5) stats.o25H++; }
      if(hadPick && p.predOver35)  { stats.o35T++; if(aTot > 3.5) stats.o35H++; }
      if(hadPick && p.predUnder25) { stats.u25T++; if(aTot < 2.5) stats.u25H++; }
      if(hadPick && p.predBTTS)    { stats.bttsT++; if(aBtts)     stats.bttsH++; }
      if(hadPick && p.predCorner)  { stats.corT++;  stats.corH += isHit1X2 ? 1 : 0; }
      if(hadPick && p.exactScorePred === aExact) stats.exHit++;

      curveData.push({ tXG: p.tXG||2.5, hitO25: aTot>2.5 ? 1 : 0 });
      rows.push({ p, ah, aa, aTot, aExact, aOut, aBtts, isHit1X2 });

      // Calibration record — ΠΛΗΡΕΣ με όλα τα fields
      let correct = false;
      const pick = p.omegaPick || '';
      if(pick.includes('ΑΣΟΣ')||pick.includes('ΝΙΚΗ ΓΗΠΕΔ'))        correct = ah > aa;
      else if(pick.includes('ΔΙΠΛΟ')||pick.includes('ΝΙΚΗ ΦΙΛΟΞ'))  correct = aa > ah;
      else if(pick.includes('ΠΑΝΩ ΑΠΟ 3.5'))                        correct = aTot > 3.5;
      else if(pick.includes('ΠΑΝΩ ΑΠΟ 2.5'))                        correct = aTot > 2.5;
      else if(pick.includes('ΚΑΤΩ ΑΠΟ 2.5'))                        correct = aTot < 2.5;
      else if(pick.includes('ΓΚΟΛ/ΓΚΟΛ')||pick.includes('GG'))      correct = aBtts;
      else if(pick.includes('AH'))                                    correct = isHit1X2;

      calibRecs.push({
        leagueId:  p.leagueId,
        predicted: pick,
        actual:    aExact,
        tXG:       p.tXG   || 2.5,
        xgDiff:    p.xgDiff || 0,
        isBomb:    !!(p.isBomb),
        correct,
      });
    }

    if(!settled) {
      document.getElementById('auditSection').innerHTML =
        `<div class="quant-panel" style="text-align:center;color:var(--text-muted);padding:30px;">Οι αγώνες δεν έχουν ολοκληρωθεί ακόμα.</div>`;
      isRunning = false; setBtnsDisabled(false); setLoader(false);
      return;
    }

    // ── Render audit results ──────────────────────────────────
    const rv  = (h,t) => t > 0 ? (h/t*100) : 0;
    const col = v => v >= 75 ? 'var(--accent-green)' : v >= 55 ? 'var(--accent-gold)' : 'var(--accent-red)';

    const statsCards = [
      { lbl:'1X2/ΑΧ',      h:stats.outHit,  t:stats.validOut, target:75 },
      { lbl:'Πάνω 2.5',    h:stats.o25H,    t:stats.o25T,     target:75 },
      { lbl:'Πάνω 3.5',    h:stats.o35H,    t:stats.o35T,     target:75 },
      { lbl:'Κάτω 2.5',    h:stats.u25H,    t:stats.u25T,     target:65 },
      { lbl:'BTTS',         h:stats.bttsH,   t:stats.bttsT,    target:80 },
      { lbl:'Ακριβές',      h:stats.exHit,   t:stats.games,    target:15 },
    ];

    const cardsHtml = statsCards.map(m => {
      const v = rv(m.h, m.t);
      const hitTarget = v >= m.target;
      const barW = m.t > 0 ? Math.min(Math.round(v), 100) : 0;
      const barColor = v >= m.target ? 'var(--accent-green)' : v >= m.target*0.75 ? 'var(--accent-gold)' : 'var(--accent-red)';
      return `<div style="background:var(--bg-base);border:1px solid ${hitTarget?'rgba(74,222,128,0.25)':'var(--border-light)'};border-radius:var(--radius-sm);padding:14px 16px;">
        <div style="font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;font-family:var(--font-cond);letter-spacing:0.08em;margin-bottom:6px;">${m.lbl}</div>
        <div style="font-family:var(--font-mono);font-size:1.8rem;font-weight:900;color:${m.t>0?col(v):'var(--text-muted)'};">${m.t>0?v.toFixed(1)+'%':'N/A'}</div>
        <div style="margin:6px 0 4px;background:var(--border-light);border-radius:2px;height:4px;">
          <div style="height:4px;width:${barW}%;background:${barColor};border-radius:2px;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.62rem;color:var(--text-muted);">
          <span>${m.h}/${m.t}</span><span>στόχος ${m.target}%</span>
        </div>
      </div>`;
    }).join('');

    // Rows table
    let tableRows = '';
    rows.forEach(({ p, ah, aa, aTot, aExact, aOut, aBtts, isHit1X2 }) => {
      const cell = (pred, hit) => pred
        ? `<span style="color:${hit?'var(--accent-green)':'var(--accent-red)'};">${hit?'✅':'❌'}</span>`
        : `<span style="color:var(--text-dim);">—</span>`;
      const exactHit1 = p.exactScorePred === aExact;
      const exactHit2 = p.exactScorePred2 === aExact;
      tableRows += `<tr>
        <td class="left-align" style="font-weight:700;">${esc(p.homeTeam)} vs ${esc(p.awayTeam)}
          <div style="font-size:0.68rem;color:var(--text-muted);">${esc(p.league||'')} · ${p.date?.split('T')[0]||''}</div>
          <div style="font-size:0.72rem;color:var(--accent-blue);margin-top:2px;">${esc(p.omegaPick||'')}</div>
        </td>
        <td class="data-num" style="font-size:1.1rem;font-weight:900;">${ah}-${aa}</td>
        <td>${p.outPick&&p.outPick!=='-'?`<span style="color:${isHit1X2?'var(--accent-green)':'var(--accent-red)'};">${isHit1X2?'✅':'❌'}</span>`:'—'}</td>
        <td>${cell(p.predOver25, aTot>2.5)}</td>
        <td>${cell(p.predOver35, aTot>3.5)}</td>
        <td>${cell(p.predUnder25, aTot<2.5)}</td>
        <td>${cell(p.predBTTS, aBtts)}</td>
        <td style="font-family:var(--font-mono);font-size:0.9rem;">
          <span style="color:${exactHit1?'var(--accent-green)':'var(--text-muted)'};">${p.exactScorePred||'—'}</span>
          ${p.exactScorePred2&&p.exactScorePred2!==p.exactScorePred?`<br><span style="color:${exactHit2?'var(--accent-green)':'var(--text-dim)'};">${p.exactScorePred2}</span>`:''}
        </td>
      </tr>`;
    });

    const html = `<div class="quant-panel">
      <div class="panel-title">📊 Αποτελέσματα Audit — ${settled} αγώνες · ${s} → ${e}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:20px;">${cardsHtml}</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;font-family:var(--font-cond);font-weight:700;">Καμπύλη xG → Over 2.5</div>
      ${buildMiniCurve(engineConfig.tXG_O25, curveData)}
      <div class="data-table-wrapper">
        <table class="summary-table">
          <thead><tr>
            <th class="left-align">Αγώνας</th><th>Σκορ</th>
            <th>1Χ2</th><th>Π2.5</th><th>Π3.5</th><th>Κ2.5</th><th>BTTS</th><th>Ακριβές</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>`;

    document.getElementById('auditSection').innerHTML = html;

    // ── Auto-Calibration: τρέχει αμέσως ──────────────────────
    if(calibRecs.length >= CALIB_MIN_N) {
      setProgress(95, 'Grid Search calibration…');
      window._lastAuditCalibRecs = calibRecs;
      window.runAutoCalibration(calibRecs);

      // Εφαρμόζουμε αμέσως αν βρεθεί βελτίωση — πάντα, όχι μόνο σε autoMode
      if(window._pendingAdjustments) {
        const hasImprovements = Object.values(window._pendingAdjustments)
          .some(d => Object.keys(d.optimized||{}).length > 0);
        if(hasImprovements) {
          window.applyCalibAdjustments(window._pendingAdjustments);
        }
      }

      // Άνοιγμα calibration panel αυτόματα
      const calibBody  = document.getElementById('autoCalibBody');
      const calibArrow = document.getElementById('autoCalibArrow');
      if(calibBody)  calibBody.style.display = 'block';
      if(calibArrow) calibArrow.textContent  = '▲';
      setTimeout(() => {
        const cp = document.getElementById('autoCalibContainer');
        if(cp) cp.scrollIntoView({ behavior:'smooth', block:'start' });
      }, 350);
    }

    showOk(`✅ Audit ολοκληρώθηκε — ${settled} αγώνες αξιολογήθηκαν.`);

  } catch(e) {
    showErr(e.message);
  } finally {
    isRunning = false; setBtnsDisabled(false); setLoader(false);
  }
};
function buildMiniCurve(currentThreshold,data){if(!data.length)return'';let thresholds=[2.0,2.2,2.4,2.6,2.8,3.0,3.2];let bars='';thresholds.forEach(th=>{const valid=data.filter(d=>d.tXG>=th);const hits=valid.filter(d=>d.hitO25===1).length;const rate=valid.length>0?(hits/valid.length)*100:0;const h=Math.max(Math.round((rate/100)*40),2);const isCurrent=Math.abs(th-currentThreshold)<0.1;bars+=`<div title="Thresh: ${th} | Rate: ${rate.toFixed(1)}%" style="display:inline-block; width:12%; height:${h}px; background:${isCurrent?'var(--accent-blue)':'rgba(255,255,255,0.1)'}; margin-right:2px; border-radius:2px 2px 0 0; position:relative;"><span style="position:absolute; bottom:-20px; left:50%; transform:translateX(-50%); font-size:0.65rem; color:var(--text-muted);">${th}</span></div>`;});return`<div style="height:60px; display:flex; align-items:flex-end; border-bottom:1px solid var(--border-light); padding-bottom:5px; margin-bottom:25px;">${bars}</div>`;}
function saveToVault(data){
  try{
    let store=JSON.parse(localStorage.getItem(LS_PREDS)||"[]");
    const map=new Map(store.map(x=>[String(x.fixtureId),x]));
    data.forEach(d=>{
      // Αποθηκεύουμε ΟΛΟΥΣ τους αγώνες — ακόμα και ΧΩΡΙΣ ΣΥΣΤΑΣΗ
      // Το vault χρειάζεται τα raw xG/tXG για calibration
      if(!d.fixId || !d.m) return; // skip invalid records only
      map.set(String(d.fixId),{
        fixtureId:    d.fixId,
        date:         d.m.fixture.date,
        leagueId:     d.leagueId,
        league:       d.lg,
        homeTeam:     d.ht,
        awayTeam:     d.at,
        outPick:      d.outPick,
        exactScorePred:  d.exact,
        exactScorePred2: d.exact2,
        predOver25:   d.omegaPick?.includes('ΠΑΝΩ ΑΠΟ 2') || d.omegaPick?.includes('ΠΑΝΩ ΑΠΟ 3'),
        predOver35:   d.omegaPick?.includes('ΠΑΝΩ ΑΠΟ 3'),
        predUnder25:  d.omegaPick?.includes('ΚΑΤΩ ΑΠΟ 2'),
        predBTTS:     d.omegaPick?.includes('ΓΚΟΛ/ΓΚΟΛ') || d.omegaPick?.includes('GG'),
        predCorner:   d.omegaPick?.includes('ΚΟΡΝΕΡ'),
        omegaPick:    d.omegaPick || 'ΧΩΡΙΣ ΣΥΣΤΑΣΗ',
        tXG:          d.tXG   || 0,
        xgDiff:       d.xgDiff || 0,
        strength:     d.strength || 0,
        isBomb:       !!(d.isBomb),
        hasPick:      !!(d.omegaPick && !d.omegaPick.includes('ΧΩΡΙΣ') && d.strength >= 70),
      });
    });
    localStorage.setItem(LS_PREDS,JSON.stringify(Array.from(map.values())));
  }catch(e){}
}
window.clearVault=function(){if(confirm("Purge all data?")){localStorage.removeItem(LS_PREDS);showOk("Vault Purged.");updateAuditLeagueFilter();}};
function updateAuditLeagueFilter() {
  const store = JSON.parse(localStorage.getItem(LS_PREDS) || '[]');
  const sel = document.getElementById('auditLeague');
  if(!sel) return;
  const known = new Set(store.map(x => x.leagueId));
  sel.innerHTML = '<option value="ALL">🌐 Όλα τα Πρωταθλήματα</option>';
  (typeof LEAGUES_DATA !== 'undefined' ? LEAGUES_DATA : []).forEach(l => {
    if(known.has(l.id))
      sel.innerHTML += `<option value="${l.id}">${l.name}</option>`;
  });
}

/**
 * Καλείται αμέσως μετά το scan.
 * Συγχρονίζει το Audit UI με:
 * - το πρωτάθλημα που μόλις σκαναρίστηκε (επιλέγει αυτόματα)
 * - το date range του scan (από scanStart έως scanEnd)
 * - scroll στο Audit panel
 */
function syncAuditFromScan(scannedData, scanStart, scanEnd) {
  // 1. Ανανέωση dropdown με ΟΛΑ τα νέα πρωταθλήματα από το Vault
  updateAuditLeagueFilter();

  // 2. Βρες τα μοναδικά leagueIds — ΑΛΕΞΙΣΦΑΙΡΟ parsing
  // Το id μπορεί να είναι είτε στο d.leagueId είτε στο d.m.league.id
  const scannedLeagueIds = [...new Set((scannedData || []).map(d => {
    return d.leagueId || d.m?.league?.id;
  }).filter(Boolean))];

  // 3. Επέλεξε αυτόματα: αν ένα πρωτάθλημα → επέλεξέ το, αν πολλά → ALL
  const sel = document.getElementById('auditLeague');
  if(sel) {
    if(scannedLeagueIds.length === 1) {
      sel.value = String(scannedLeagueIds[0]);
      if(!sel.value || sel.value !== String(scannedLeagueIds[0])) sel.value = 'ALL';
    } else {
      sel.value = 'ALL';
    }
  }

  // 4. Συγχρόνισε date range
  const asEl = document.getElementById('auditStart');
  const aeEl = document.getElementById('auditEnd');
  if(asEl && scanStart) asEl.value = scanStart;
  if(aeEl && scanEnd)   aeEl.value = scanEnd;

  // 5. Άνοιγμα Audit panel (αν είναι collapsed)
  const auditBody = document.getElementById('auditPanelBody');
  if(auditBody && auditBody.style.display === 'none') {
    auditBody.style.display = 'block';
    const arrow = document.getElementById('auditPanelArrow');
    if(arrow) arrow.textContent = '▲';
  }

  // 6. Flash στο audit section
  const auditSec = document.getElementById('auditSection');
  if(auditSec) {
    let lgDisplayName = 'Όλα';
    if(scannedLeagueIds.length === 1) {
      lgDisplayName = (typeof LEAGUES_DATA !== 'undefined'
        ? LEAGUES_DATA.find(l => l.id === scannedLeagueIds[0])?.name
        : null) || String(scannedLeagueIds[0]);
    }
    auditSec.innerHTML = `<div style="background:rgba(252,211,77,0.07);border:1px solid rgba(252,211,77,0.25);border-radius:8px;padding:14px 18px;font-size:0.82rem;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <span style="font-size:1.2rem;">📊</span>
      <div style="flex:1;min-width:180px;">
        <div style="font-weight:700;color:var(--accent-gold);margin-bottom:3px;">Audit έτοιμο για εκτέλεση</div>
        <div style="color:var(--text-muted);">Πρωτάθλημα: <strong style="color:var(--text-main);">${esc(lgDisplayName)}</strong> · Περίοδος: <strong style="color:var(--text-main);">${scanStart||'—'} → ${scanEnd||'—'}</strong></div>
        <div style="color:var(--text-muted);font-size:0.72rem;margin-top:4px;">Πατήστε <strong>Run Audit</strong> για αξιολόγηση &amp; βελτιστοποίηση παραμέτρων</div>
      </div>
      <button onclick="runCustomAudit(false)" class="btn btn-purple" style="white-space:nowrap;">▶ Run Audit</button>
    </div>`;
  }
}

// ================================================================
//  LEAGUE MODS MANAGER
// ================================================================
// ================================================================
//  MY LEAGUES MANAGER — Dynamic league selection with localStorage
// ================================================================

// Ομαδοποίηση πρωταθλημάτων ανά περιοχή για εύκολη επιλογή
const LEAGUE_GROUPS = [
  { label: '🏆 UEFA', ids: [2, 3, 848] },
  { label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Αγγλία', ids: [39, 40, 41] },
  { label: '🇩🇪 Γερμανία', ids: [78, 79] },
  { label: '🇪🇸 Ισπανία', ids: [140, 141] },
  { label: '🇮🇹 Ιταλία', ids: [135, 136] },
  { label: '🇫🇷 Γαλλία', ids: [61, 62] },
  { label: '🇳🇱 Ολλανδία', ids: [88] },
  { label: '🇧🇪 Βέλγιο', ids: [144] },
  { label: '🇵🇹 Πορτογαλία', ids: [94] },
  { label: '🇦🇹 Αυστρία', ids: [218] },
  { label: '🇨🇭 Ελβετία', ids: [207] },
  { label: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Σκωτία', ids: [179] },
  { label: '🇹🇷 Τουρκία', ids: [203] },
  { label: '🇬🇷 Ελλάδα', ids: [197] },
  { label: '🇩🇰 Δανία', ids: [119] },
  { label: '🇸🇪 Σουηδία', ids: [113] },
  { label: '🇳🇴 Νορβηγία', ids: [103] },
  { label: '🇫🇮 Φινλανδία', ids: [244] },
  { label: '🇮🇸 Ισλανδία', ids: [164] },
  { label: '🇮🇪 Ιρλανδία', ids: [357, 395] },
  { label: '🇵🇱 Πολωνία', ids: [106] },
  { label: '🇨🇿 Τσεχία', ids: [345] },
  { label: '🇷🇴 Ρουμανία', ids: [283] },
  { label: '🇭🇺 Ουγγαρία', ids: [271] },
  { label: '🇺🇸 USA', ids: [253] },
  { label: '🇲🇽 Μεξικό', ids: [262] },
  { label: '🇧🇷 Βραζιλία', ids: [71] },
  { label: '🇦🇷 Αργεντινή', ids: [128] },
  { label: '🌎 Λατ. Αμερική', ids: [239, 265, 280, 268] },
];

window.renderMyLeaguesPanel = function() {
  const container = document.getElementById('myLeaguesContainer');
  if(!container || typeof LEAGUES_DATA === 'undefined') return;

  const active = getUserMyLeagues();
  const activeSet = new Set(active);
  const leagueMap = new Map(LEAGUES_DATA.map(l => [l.id, l]));

  let html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">`;

  LEAGUE_GROUPS.forEach(group => {
    // Only show groups that have at least one known league
    const validIds = group.ids.filter(id => leagueMap.has(id));
    if(!validIds.length) return;

    const allChecked  = validIds.every(id => activeSet.has(id));
    const someChecked = validIds.some(id => activeSet.has(id));

    html += `<div style="background:var(--bg-base);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:10px 12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border-light);">
        <input type="checkbox" id="grp_${group.ids[0]}"
          ${allChecked ? 'checked' : someChecked ? 'indeterminate_marker' : ''}
          onchange="toggleLeagueGroup([${validIds.join(',')}], this.checked)"
          style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent-blue);">
        <label for="grp_${group.ids[0]}" style="font-size:0.78rem;font-weight:800;color:var(--text-main);cursor:pointer;">${esc(group.label)}</label>
      </div>
      ${validIds.map(id => {
        const l = leagueMap.get(id);
        if(!l) return '';
        const checked = activeSet.has(id);
        const isTrap  = typeof TRAP_LEAGUES  !== 'undefined' && TRAP_LEAGUES.has(id);
        const isGold  = typeof GOLD_LEAGUES  !== 'undefined' && GOLD_LEAGUES.has(id);
        const isTight = typeof TIGHT_LEAGUES !== 'undefined' && TIGHT_LEAGUES.has(id);
        const typeBadge = isGold  ? `<span style="font-size:0.65rem;color:var(--accent-gold);font-weight:800;margin-left:4px;">GOLD</span>`
                        : isTrap  ? `<span style="font-size:0.65rem;color:var(--accent-red);font-weight:800;margin-left:4px;">TRAP</span>`
                        : isTight ? `<span style="font-size:0.65rem;color:var(--accent-teal);font-weight:800;margin-left:4px;">TIGHT</span>` : '';
        return `<div style="display:flex;align-items:center;gap:8px;padding:3px 0;">
          <input type="checkbox" id="lg_${id}" ${checked?'checked':''}
            onchange="toggleLeague(${id}, this.checked)"
            style="width:14px;height:14px;cursor:pointer;accent-color:var(--accent-blue);">
          <label for="lg_${id}" style="font-size:0.75rem;color:var(--text-main);cursor:pointer;flex:1;display:flex;align-items:center;gap:4px;min-width:0;">
            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">${esc(l.name)}</span>
            ${typeBadge}
            <span style="font-size:0.6rem;color:var(--text-dim);font-family:var(--font-mono);flex-shrink:0;">🚩×${(LEAGUE_CORNER_MULT[id]||CORNER_MULT_DEFAULT).toFixed(2)}</span>
          </label>
        </div>`;
      }).join('')}
    </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;

  // Set indeterminate state for partial group selections
  LEAGUE_GROUPS.forEach(group => {
    const validIds = group.ids.filter(id => leagueMap.has(id));
    if(!validIds.length) return;
    const el = document.getElementById(`grp_${group.ids[0]}`);
    if(!el) return;
    const allC = validIds.every(id => activeSet.has(id));
    const someC = validIds.some(id => activeSet.has(id));
    el.indeterminate = !allC && someC;
  });

  updateMyLeaguesBadge();
};

window.selectAllLeagues = function(checked) {
  const allIds = (typeof LEAGUES_DATA !== 'undefined') ? LEAGUES_DATA.map(l=>l.id) : [];
  saveUserMyLeagues(checked ? allIds : []);
  window.renderMyLeaguesPanel();
  updateLeagueFilterOption();
};

window.selectDefaultLeagues = function() {
  const def = typeof MY_LEAGUES_IDS !== 'undefined' ? MY_LEAGUES_IDS : [78,88,218,119,103,144,253,262,140,135,197];
  saveUserMyLeagues(def);
  window.renderMyLeaguesPanel();
  updateLeagueFilterOption();
};

// Μαζική επιλογή ανά κατηγορία (Gold / Tight / Standard / Gold+Tight)
window.selectByType = function(type) {
  if(typeof LEAGUES_DATA === 'undefined') return;
  let ids = [];
  switch(type) {
    case 'GOLD':
      ids = LEAGUES_DATA
        .filter(l => typeof GOLD_LEAGUES!=='undefined' && GOLD_LEAGUES.has(l.id))
        .map(l=>l.id);
      break;
    case 'TIGHT':
      ids = LEAGUES_DATA
        .filter(l => typeof TIGHT_LEAGUES!=='undefined' && TIGHT_LEAGUES.has(l.id))
        .map(l=>l.id);
      break;
    case 'TRAP':
      ids = LEAGUES_DATA
        .filter(l => typeof TRAP_LEAGUES!=='undefined' && TRAP_LEAGUES.has(l.id))
        .map(l=>l.id);
      break;
    case 'STANDARD':
      // Standard = δεν είναι GOLD, TIGHT ή TRAP
      ids = LEAGUES_DATA
        .filter(l => {
          const id = l.id;
          const isGold  = typeof GOLD_LEAGUES !=='undefined' && GOLD_LEAGUES.has(id);
          const isTight = typeof TIGHT_LEAGUES!=='undefined' && TIGHT_LEAGUES.has(id);
          const isTrap  = typeof TRAP_LEAGUES !=='undefined' && TRAP_LEAGUES.has(id);
          return !isGold && !isTight && !isTrap;
        })
        .map(l=>l.id);
      break;
    case 'GOLD+TIGHT':
      // Τα πιο αξιόπιστα: Gold (καλό Poisson fit) + Tight (αμυντικά αλλά σταθερά)
      ids = LEAGUES_DATA
        .filter(l => {
          const id = l.id;
          return (typeof GOLD_LEAGUES !=='undefined' && GOLD_LEAGUES.has(id)) ||
                 (typeof TIGHT_LEAGUES!=='undefined' && TIGHT_LEAGUES.has(id));
        })
        .map(l=>l.id);
      break;
  }
  if(!ids.length) { showErr(`Δεν βρέθηκαν πρωταθλήματα τύπου ${type}.`); return; }
  saveUserMyLeagues(ids);
  window.renderMyLeaguesPanel();
  updateLeagueFilterOption();
  showOk(`✅ ${ids.length} πρωταθλήματα επιλέχτηκαν (${type})`);
};

window.toggleLeague = function(id, checked) {
  const current = getUserMyLeagues();
  const newList = checked
    ? [...new Set([...current, id])]
    : current.filter(x => x !== id);
  saveUserMyLeagues(newList);
  updateMyLeaguesBadge();
  updateLeagueFilterOption();
};

window.toggleLeagueGroup = function(ids, checked) {
  const current = getUserMyLeagues();
  let newList = [...current];
  if(checked) {
    ids.forEach(id => { if(!newList.includes(id)) newList.push(id); });
  } else {
    newList = newList.filter(id => !ids.includes(id));
  }
  saveUserMyLeagues(newList);
  // Update individual checkboxes
  ids.forEach(id => { const el = document.getElementById(`lg_${id}`); if(el) el.checked = checked; });
  updateMyLeaguesBadge();
  updateLeagueFilterOption();
};

function updateMyLeaguesBadge() {
  const active = getUserMyLeagues();
  const el = document.getElementById('activeLeagueCount');
  if(el) el.textContent = `${active.length} πρωταθλήματα επιλεγμένα`;
  const badge = document.getElementById('myLeaguesBadge');
  if(badge) badge.textContent = active.length;
}

function updateLeagueFilterOption() {
  // Ενημερώνει την πρώτη option του leagueFilter με τον τρέχοντα αριθμό
  const count = getUserMyLeagues().length;
  const opt = document.querySelector('#leagueFilter option[value="MY_LEAGUES"]');
  if(opt) opt.textContent = `⭐ My Leagues (${count})`;
  const liveOpt = document.querySelector('#liveTrackerLeague option[value="MY_LEAGUES"]');
  if(liveOpt) liveOpt.textContent = `⭐ My Leagues (${count})`;
}

window.resetMyLeagues = function() {
  localStorage.removeItem(LS_MY_LEAGUES);
  window.renderMyLeaguesPanel();
  updateLeagueFilterOption();
  showOk('My Leagues επαναφέρθηκαν στις default τιμές.');
};

window.selectAllLeagues = function() {
  const allIds = (typeof LEAGUES_DATA !== 'undefined' ? LEAGUES_DATA : []).map(l => l.id);
  saveUserMyLeagues(allIds);
  window.renderMyLeaguesPanel();
  updateLeagueFilterOption();
  showOk(`Όλα τα πρωταθλήματα επιλέχθηκαν (${allIds.length}).`);
};

window.clearAllLeagues = function() {
  saveUserMyLeagues([]);
  window.renderMyLeaguesPanel();
  updateLeagueFilterOption();
  showOk('Όλες οι επιλογές αφαιρέθηκαν.');
};

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

// ================================================================
//  AUTO-CALIBRATION ENGINE v2 — Grid Search + Backtest
//
//  Αντί για gradient descent (αργό, δεν εγγυάται σύγκλιση),
//  χρησιμοποιεί Grid Search πάνω στα ιστορικά audit records:
//
//  Για κάθε παράμετρο → δοκιμάζει N τιμές στο εύρος
//  → υπολογίζει accuracy με κάθε τιμή (pure function, χωρίς API)
//  → κρατάει ακριβώς εκείνη που πλησιάζει περισσότερο τον στόχο
//
//  ΣΤΟΧΟΙ:
//    1X2/AH   ≥ 75% → βελτιστοποίηση xgDiff
//    BTTS     ≥ 80% → βελτιστοποίηση minBTTS
//    Πάνω 2.5 ≥ 75% → βελτιστοποίηση minXGO25
//    Πάνω 3.5 ≥ 75% → βελτιστοποίηση minXGO35
//    Κόρνερ   ≥ 70% → βελτιστοποίηση mult (secondary)
//    Bombs    ≥ 60% → βελτιστοποίηση mult
//
//  GRID: 15 τιμές ανά παράμετρο = πολύ γρήγορο (pure JS, < 50ms)
//  FALLBACK: αν δεν βρεθεί τιμή που χτυπάει τον στόχο,
//            κρατάει εκείνη με την υψηλότερη accuracy.
// ================================================================

const CALIB_TARGETS = {
  outcomes: 0.75,
  btts:     0.80,
  over25:   0.75,
  over35:   0.75,
  corners:  0.70,
  bombs:    0.60,
};
const CALIB_MIN_N  = 8;    // ελάχιστα records ανά market
const CALIB_GRID_N = 20;   // σημεία grid ανά παράμετρο

const PARAM_BOUNDS = {
  mult:     [0.75, 1.45],
  minXGO25: [2.60, 3.80],  // P(O2.5) 55%-78%
  minXGO35: [3.20, 4.50],  // P(O3.5) 48%-72%
  xgDiff:   [0.40, 1.10],  // xG diff για 1X2
  minBTTS:  [0.90, 1.60],  // min(hXG,aXG) για BTTS
  maxU25:   [1.50, 2.20],  // max tXG για Under 2.5
};

const LS_CALIB_LOG = 'omega_calib_log_v5.0';
let calibLog = [];

function loadCalibLog() {
  try { const c = JSON.parse(localStorage.getItem(LS_CALIB_LOG)); if(Array.isArray(c)) calibLog = c; } catch {}
}
function saveCalibLog() {
  try { localStorage.setItem(LS_CALIB_LOG, JSON.stringify(calibLog.slice(0,100))); } catch {}
}

// Δημιουργεί grid τιμών για ένα parameter
function makeGrid(param) {
  const [lo, hi] = PARAM_BOUNDS[param];
  const step = (hi - lo) / (CALIB_GRID_N - 1);
  return Array.from({length: CALIB_GRID_N}, (_, i) =>
    parseFloat((lo + i * step).toFixed(4))
  );
}

// Εφαρμόζει μια παράμετρο και μετρά accuracy σε audit records
// PURE FUNCTION — δεν αλλάζει τίποτα, δεν καλεί API
function backtestParam(records, paramName, paramValue) {
  let hits = 0, n = 0;

  records.forEach(r => {
    if(!r.actual) return;
    const parts = r.actual.split('-');
    if(parts.length < 2) return;
    const ah = parseInt(parts[0]), aa = parseInt(parts[1]);
    if(isNaN(ah) || isNaN(aa)) return;
    const aTot = ah + aa;
    const aBtts = ah > 0 && aa > 0;

    let wouldSignal = false;
    let wouldHit    = false;

    if(paramName === 'xgDiff') {
      // Προσομοίωση 1X2 από raw xgDiff — ΑΝΕΞΑΡΤΗΤΑ από το παλιό pick string
      wouldSignal = Math.abs(r.xgDiff || 0) >= paramValue;
      if(wouldSignal) {
        const predictedOut = (r.xgDiff > 0) ? '1' : '2';
        const actualOut    = ah > aa ? '1' : (ah < aa ? '2' : 'X');
        wouldHit = (predictedOut === actualOut);
      }
    } else if(paramName === 'minXGO25') {
      // Προσομοίωση Over 2.5 από raw tXG
      wouldSignal = (r.tXG || 0) >= paramValue;
      wouldHit    = wouldSignal && (aTot > 2.5);
    } else if(paramName === 'minXGO35') {
      wouldSignal = (r.tXG || 0) >= paramValue;
      wouldHit    = wouldSignal && (aTot > 3.5);
    } else if(paramName === 'minBTTS') {
      const bttsProxy = Math.min((r.tXG || 2.5) * 0.45, 1.5);
      wouldSignal = bttsProxy >= paramValue;
      wouldHit    = wouldSignal && aBtts;
    } else if(paramName === 'mult') {
      const curLPMult = getLeagueParams(r.leagueId || 0).mult || 1.0;
      const adjustedXG = (r.tXG || 2.5) * (paramValue / curLPMult);
      wouldSignal = adjustedXG >= 2.2;
      wouldHit    = wouldSignal && r.correct;
    }

    if(wouldSignal) { n++; if(wouldHit) hits++; }
  });

  return n >= CALIB_MIN_N ? hits / n : null;
}

/**
 * Grid search για ένα πρωτάθλημα — βρίσκει το ΒΕΛΤΙΣΤΟ parameter set
 * που επιτυγχάνει τους στόχους.
 */
function gridSearchLeague(records, leagueId) {
  const results  = {};
  const stats    = {};
  const logLines = [];

  // 1. Κρατάμε ΜΟΝΟ τα ματς που έχουν τελικό αποτέλεσμα (settled)
  const settledRecords = records.filter(r => r.actual);

  // 2. Δοκιμάζουμε thresholds σε ΟΛΑ τα settled ματς — ακόμα και αυτά
  // που ήταν "ΧΩΡΙΣ ΣΥΣΤΑΣΗ". Αν αλλάξει το όριο, μπορεί να πάρουν σήμα.
  const byMarket = {
    outcomes: settledRecords,
    over25:   settledRecords,
    over35:   settledRecords,
    btts:     settledRecords,
    corners:  settledRecords,
    bombs:    settledRecords,
  };

  const marketToParam = {
    outcomes: 'xgDiff',
    over25:   'minXGO25',
    over35:   'minXGO35',
    btts:     'minBTTS',
    corners:  'mult',
    bombs:    'mult',
  };

  const optimized = {};

  Object.entries(CALIB_TARGETS).forEach(([market, target]) => {
    const recs = byMarket[market];
    if(!recs || recs.length < CALIB_MIN_N) return;

    const param  = marketToParam[market];
    const grid   = makeGrid(param);
    const curMod = leagueMods[leagueId] || {};
    const curLP  = getLeagueParams(leagueId);
    const curVal = curMod[param] ?? curLP[param] ?? grid[Math.floor(grid.length/2)];

    // Baseline: accuracy με την τρέχουσα παράμετρο
    const baselineAcc = backtestParam(recs, param, curVal) ?? 0;

    // Grid search
    let bestVal       = curVal;
    let bestAcc       = baselineAcc;
    let bestDist      = Infinity;
    let reachedTarget = baselineAcc >= target;
    const curve       = [];

    grid.forEach(val => {
      const acc = backtestParam(recs, param, val);
      if(acc === null) return;
      curve.push({ val, acc });
      const dist = Math.abs(acc - target);

      if(acc >= target && !reachedTarget) {
        bestVal = val; bestAcc = acc; bestDist = dist; reachedTarget = true;
      } else if(acc >= target && reachedTarget && dist < bestDist) {
        // Επιλέγουμε πιο "κοντά" στον στόχο για να διατηρήσουμε volume
        bestVal = val; bestAcc = acc; bestDist = dist;
      } else if(!reachedTarget && acc > bestAcc) {
        bestVal = val; bestAcc = acc; bestDist = dist;
      }
    });

    const changed  = Math.abs(bestVal - curVal) > 0.001;
    const improved = bestAcc > baselineAcc + 0.01;

    stats[market] = {
      n:            recs.length,
      baselineAcc:  parseFloat((baselineAcc*100).toFixed(1)),
      bestAcc:      parseFloat((bestAcc*100).toFixed(1)),
      target:       target*100,
      reachedTarget,
      curVal,
      bestVal,
      changed,
      improved,
      curve,
    };

    if(changed && improved) {
      if(param === 'mult' && optimized[param] !== undefined) {
        optimized[param] = parseFloat(((optimized[param] + bestVal) / 2).toFixed(4));
      } else {
        optimized[param] = bestVal;
      }
      logLines.push(`${market}: ${(baselineAcc*100).toFixed(0)}%→${(bestAcc*100).toFixed(0)}% (στόχος ${target*100}%) | ${param}: ${curVal.toFixed(3)}→${bestVal.toFixed(3)}`);
    }
  });

  return { optimized, stats, logLines };
}

/**
 * Εφαρμόζει τα βέλτιστα parameters και αποθηκεύει.
 */
window.applyCalibAdjustments = function(adjustmentsByLeague) {
  const applied = [];
  Object.entries(adjustmentsByLeague).forEach(([lid, data]) => {
    const id = parseInt(lid);
    if(!data.optimized || !Object.keys(data.optimized).length) return;
    if(!leagueMods[id]) leagueMods[id] = {};
    Object.assign(leagueMods[id], data.optimized);
    applied.push({ leagueId: id, params: data.optimized, stats: data.stats });
  });

  if(!applied.length) { showErr('Δεν υπάρχουν αλλαγές για εφαρμογή.'); return; }

  try { localStorage.setItem(LS_LGMODS, JSON.stringify(leagueMods)); } catch {}

  const grkNow = new Date().toLocaleString('el-GR', {timeZone:'Europe/Athens',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  try { localStorage.setItem('omega_last_calib_ts', grkNow); } catch {}
  updateLastCalibBadge(grkNow);

  calibLog.unshift({
    date: grkNow,
    applied: applied.map(a => ({
      leagueId: a.leagueId,
      params: a.params,
      markets: Object.entries(a.stats)
        .filter(([,s])=>s.changed && s.improved)
        .map(([m,s])=>`${m}: ${s.baselineAcc}%→${s.bestAcc}%`)
        .join(', ')
    }))
  });
  saveCalibLog();
  renderCalibLog();
  window.resimulateMatches();
  renderLeagueMods();
  showOk(`✅ Βαθμονόμηση εφαρμόστηκε για ${applied.length} πρωτάθλημα.`);
};

/**
 * Κύρια συνάρτηση: τρέχει grid search και εμφανίζει αποτελέσματα.
 */
window.runAutoCalibration = function(auditRecords) {
  const el = document.getElementById('autoCalibPanel');
  if(!el) return;
  if(!auditRecords?.length) {
    el.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:0.8rem;">Εκτελέστε Audit για να εμφανιστεί η ανάλυση βαθμονόμησης.</div>`;
    return;
  }

  // Group by league
  const byLeague = {};
  auditRecords.forEach(r => {
    const id = r.leagueId || 0;
    if(!byLeague[id]) byLeague[id] = [];
    byLeague[id].push(r);
  });

  // Run grid search per league
  const allResults = {};
  let totalLeaguesWithChanges = 0;
  Object.entries(byLeague).forEach(([lid, recs]) => {
    const res = gridSearchLeague(recs, parseInt(lid));
    allResults[lid] = res;
    if(Object.keys(res.optimized).length > 0) totalLeaguesWithChanges++;
  });

  window._pendingAdjustments = allResults;

  // Render results (Πάντα τυπώνουμε τα αποτελέσματα, ακόμα και αν δεν υπάρχουν αλλαγές)
  const rows = Object.entries(allResults).map(([lid, data]) => {
    if(!Object.keys(data.stats).length) return '';
    const lgName = (typeof LEAGUES_DATA!=='undefined' ? LEAGUES_DATA.find(l=>l.id==lid)?.name : null) || `League ${lid}`;
    const hasChanges = Object.keys(data.optimized).length > 0;

    const marketRows = Object.entries(data.stats).map(([m, s]) => {
      const reached = s.reachedTarget;
      const improved = s.improved;
      const barW = Math.min(Math.round(s.bestAcc / s.target * 100), 100);
      const barColor = reached ? 'var(--accent-green)' : improved ? 'var(--accent-gold)' : 'var(--accent-red)';
      const mLabel = {outcomes:'🏆 1X2/AH', btts:'🎯 BTTS', over25:'🔥 O2.5', over35:'🚀 O3.5', corners:'🚩 Κόρνερ', bombs:'💣 Bombs'}[m] || m;
      const statusIcon = reached ? '✅' : improved ? '📈' : '⚠️';
      const paramChange = s.changed && s.improved
        ? `<span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--accent-gold);margin-left:6px;">${m==='outcomes'?'xgDiff':m==='over25'?'minXGO25':m==='over35'?'minXGO35':m==='btts'?'minBTTS':'mult'}: ${s.curVal.toFixed(3)}→<strong>${s.bestVal.toFixed(3)}</strong></span>`
        : `<span style="font-size:0.62rem;color:var(--text-muted);margin-left:6px;">— χωρίς αλλαγή</span>`;

      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.03);flex-wrap:wrap;">
        <span style="min-width:90px;font-size:0.7rem;font-weight:700;">${mLabel}</span>
        <div style="flex:1;min-width:120px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;font-size:0.62rem;font-family:var(--font-mono);">
            <span style="color:var(--text-muted);">τώρα: <span style="color:var(--text-sub);">${s.baselineAcc}%</span></span>
            <span style="color:${barColor};font-weight:700;">${statusIcon} ${s.bestAcc}% / στόχος ${s.target}%</span>
          </div>
          <div style="background:var(--border-light);border-radius:2px;height:5px;">
            <div style="height:5px;width:${barW}%;background:${barColor};border-radius:2px;transition:width 0.4s;"></div>
          </div>
        </div>
        ${paramChange}
        <span style="font-size:0.6rem;color:var(--text-dim);">n=${s.n}</span>
      </div>`;
    }).join('');

    const paramSummary = Object.entries(data.optimized).map(([k,v]) => {
      const cur = (leagueMods[parseInt(lid)]?.[k]) ?? getLeagueParams(parseInt(lid))[k];
      const dir = v > cur ? '▲' : '▼';
      const col = v > cur ? 'var(--accent-gold)' : 'var(--accent-teal)';
      return `<span style="font-size:0.7rem;font-family:var(--font-mono);color:${col};background:${col}15;padding:2px 8px;border-radius:4px;border:1px solid ${col}30;">${k} ${dir} ${v}</span>`;
    }).join('');

    return `<div style="background:var(--bg-base);border:1px solid ${hasChanges?'rgba(252,211,77,0.2)':'var(--border-light)'};border-radius:8px;padding:12px 14px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
        <span style="font-weight:800;font-size:0.85rem;">${esc(lgName)}</span>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">${paramSummary}</div>
      </div>
      ${marketRows}
    </div>`;
  }).filter(Boolean).join('');

  // Header: κουμπί εφαρμογής μόνο αν υπάρχουν αλλαγές, αλλιώς πράσινο μήνυμα
  const headerHtml = totalLeaguesWithChanges > 0
    ? `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px;padding:10px 14px;background:rgba(252,211,77,0.07);border:1px solid rgba(252,211,77,0.22);border-radius:8px;">
        <div style="font-size:0.78rem;color:var(--text-sub);">
          Grid Search ολοκληρώθηκε. <strong style="color:var(--accent-gold);">${totalLeaguesWithChanges} πρωταθλήματα</strong> χρειάζονται βαθμονόμηση.
        </div>
        <button onclick="window.applyCalibAdjustments(window._pendingAdjustments)" class="btn btn-gold" style="height:34px;font-size:0.8rem;">✅ Εφαρμογή & Re-Simulate</button>
      </div>`
    : `<div style="padding:14px;background:rgba(74,222,128,0.07);border:1px solid rgba(74,222,128,0.25);border-radius:8px;font-size:0.8rem;color:var(--accent-green);margin-bottom:14px;">
        ✅ <strong>Το μοντέλο είναι άριστα βαθμονομημένο!</strong> Όλα τα πρωταθλήματα πετυχαίνουν τους στόχους ή δεν επιδέχονται περαιτέρω βελτίωση.
      </div>`;

  el.innerHTML = `
    ${headerHtml}
    ${rows}
    <div style="margin-top:8px;font-size:0.62rem;color:var(--text-muted);">Grid: ${CALIB_GRID_N} τιμές/παράμετρο · Min samples: ${CALIB_MIN_N} · Pure backtest χωρίς API calls</div>`;
};

function renderCalibLog() {
  const el = document.getElementById('calibLogSection');
  if(!el) return;
  if(!calibLog.length) { el.innerHTML = `<div style="font-size:0.75rem;color:var(--text-muted);padding:8px;">Δεν υπάρχει ιστορικό ακόμα.</div>`; return; }
  el.innerHTML = calibLog.slice(0,10).map(entry => `
    <div style="background:var(--bg-base);border:1px solid var(--border-light);border-radius:6px;padding:8px 12px;margin-bottom:6px;">
      <div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-muted);margin-bottom:4px;">${entry.date}</div>
      ${(entry.applied||[]).map(a => {
        const lgName = (typeof LEAGUES_DATA!=='undefined'?LEAGUES_DATA.find(l=>l.id==a.leagueId)?.name:null)||`League ${a.leagueId}`;
        return `<div style="font-size:0.72rem;margin-bottom:3px;">
          <strong style="color:var(--text-sub);">${esc(lgName)}</strong>:
          <span style="color:var(--accent-gold);font-family:var(--font-mono);">
            ${Object.entries(a.params||{}).map(([k,v])=>`${k}=${v}`).join(' · ')}
          </span>
          ${a.markets ? `<div style="font-size:0.62rem;color:var(--text-muted);margin-top:1px;">${esc(a.markets)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`).join('');
}

window.resetCalibration = function() {
  if(!confirm('Επαναφορά ΟΛΩΝ των per-league calibration στις default τιμές;')) return;
  leagueMods = {};
  try { localStorage.removeItem(LS_LGMODS); } catch {}
  window.resimulateMatches();
  renderLeagueMods();
  const el = document.getElementById('autoCalibPanel');
  if(el) el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:0.8rem;">Επαναφορά ολοκληρώθηκε.</div>';
  showOk('Επαναφορά ολοκληρώθηκε.');
};


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
    const res=computePick(hXGfinal,aXGfinal,tXG,btts,lp,d.hS,d.aS,d.leagueId);
    const htAnalysis=computeHTAnalysis(res.hExp,res.aExp,lp);
    Object.assign(d,{
      tXG,btts,hXGbase:hXG,aXGbase:aXG,hXGfinal,aXGfinal,
      hInjAdj:{...d.hInjAdj,adjXG:hXGfinal,delta:hDelta},
      aInjAdj:{...d.aInjAdj,adjXG:aXGfinal,delta:aDelta},
      htAnalysis,
      outPick:res.outPick,xgDiff:res.xgDiff,
      exact:`${res.hG}-${res.aG}`,exact2:`${res.hG2}-${res.aG2}`,exactConf:res.exactConf,
      omegaPick:res.omegaPick,strength:res.pickScore,reason:res.reason,
      hExp:res.hExp,aExp:res.aExp,pp:res.pp,offside:res.offside,
      lambdaTotal:res.lambdaTotal,cornerConf:res.cornerConf,expCor:res.expCor
    });
    // Re-adjust card probabilities με νέο xgDiff
    const cardCtx={xgDiff:res.xgDiff,leagueId:d.leagueId};
    if(d.hPlayers?.length) adjustPlayerCardProbs(d.hPlayers, d.aS, cardCtx);
    if(d.aPlayers?.length) adjustPlayerCardProbs(d.aPlayers, d.hS, cardCtx);
  });
  rebuildTopLists();renderTopSections();renderSummaryTable();showOk('Re-simulated!');
  window.refreshBest4({silent:true}).catch(()=>{});
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
      loadCalibLog();
      renderCalibLog();

      // Version display στο header
      const vtEl = document.getElementById('versionTag');
      if(vtEl) vtEl.textContent = BUILD_LABEL;
      // Auth screen build info
      const authBuild = document.getElementById('authBuildInfo');
      if(authBuild) authBuild.textContent = `Build ${BUILD_DATE} ${BUILD_TIME}`;
      // Last calibration badge
      try {
        const ts = localStorage.getItem('omega_last_calib_ts');
        if(ts) updateLastCalibBadge(ts);
      } catch {}
      // Last-updated badge στο header
      const luBadge = document.getElementById('lastUpdatedBadge');
      const luText  = document.getElementById('lastUpdatedText');
      if(luBadge && luText) {
        luText.textContent = `Αναβαθμίστηκε ${BUILD_DATE} ${BUILD_TIME}`;
        luBadge.style.display = 'flex';
      }
      // My Leagues panel
      window.renderMyLeaguesPanel();
      updateLeagueFilterOption();
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
