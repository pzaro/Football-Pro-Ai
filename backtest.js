'use strict';
/*
 * APEX OMEGA — Ιστορικός έλεγχος (walk-forward backtest)
 * -------------------------------------------------------
 * Τρέχει το ΠΡΑΓΜΑΤΙΚΟ μοντέλο (stats.js, analyzeMatchSafe) με τις τρέχουσες ρυθμίσεις
 * πάνω σε παλιούς αγώνες. Για κάθε αγώνα το μοντέλο βλέπει ΜΟΝΟ δεδομένα πριν από την ημέρα
 * του αγώνα (point-in-time): τελευταίοι αγώνες, στατιστικά σεζόν, βαθμολογία, H2H,
 * στατιστικά αγώνων (κόρνερ/σουτ). Τίποτα από το μέλλον.
 *
 * ΔΕΝ αλλάζει τίποτα στην εφαρμογή: διαβάζει το data/apex.sqlite μόνο για ανάγνωση
 * (ρυθμίσεις μοντέλου) και γράφει μόνο στον φάκελο data/backtest/.
 *
 * Περιορισμοί (γράφονται και στην αναφορά):
 *  - Τραυματισμοί, συνθέσεις, top scorers: δεν υπάρχουν ιστορικά → ουδέτερα (όπως όταν λείπουν live).
 *  - Αποδόσεις αγοράς: δεν υπάρχουν για παλιούς αγώνες → καθαρό μοντέλο, χωρίς μείγμα αγοράς.
 *  - Αγώνες κυπέλλων/άλλων διοργανώσεων που δεν κατέβηκαν δεν μετρούν στη «φόρμα».
 *
 * Χρήση:  node backtest.js            (ή RUN_BACKTEST.bat)
 *         node backtest.js --report   (μόνο αναφορά από όσα έχουν υπολογιστεί)
 * Ρυθμίσεις (.env ή μεταβλητές περιβάλλοντος):
 *   BACKTEST_LEAGUES=39,140,...   πρωταθλήματα (προεπιλογή: όσα σαρώνει η μηχανή)
 *   BACKTEST_MAX_CALLS=40000      μέγιστες κλήσεις API ανά εκτέλεση
 *   BACKTEST_RESERVE=25000        κλήσεις που μένουν ελεύθερες για την κανονική εφαρμογή
 *   BACKTEST_MIN_SEASON=2010      παλαιότερη σεζόν (προεπιλογή: η παλαιότερη που δίνει το API)
 *   BACKTEST_STATS=1              κατέβασμα στατιστικών αγώνων (κόρνερ/σουτ). 0 = χωρίς (πολύ λιγότερες κλήσεις)
 *   BACKTEST_PORT=8799
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const BT_DIR = path.join(DATA_DIR, 'backtest');
const CACHE_DIR = path.join(BT_DIR, 'cache');
const PRED_FILE = path.join(BT_DIR, 'predictions.jsonl');
const STATE_FILE = path.join(BT_DIR, 'state.json');
const LOG_FILE = path.join(BT_DIR, 'backtest.log');
for (const d of [BT_DIR, CACHE_DIR, path.join(CACHE_DIR, 'leagues'), path.join(CACHE_DIR, 'fixtures'), path.join(CACHE_DIR, 'stats')]) fs.mkdirSync(d, { recursive: true });

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i < 1) continue;
    const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv(path.join(ROOT, '.env'));

const API_BASE = 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY || '';
const PORT = Number(process.env.BACKTEST_PORT || 8799);
let ACTIVE_PORT = PORT;
const MAX_CALLS = Number(process.env.BACKTEST_MAX_CALLS || 40000);
const RESERVE = Number(process.env.BACKTEST_RESERVE || 25000);
const MIN_SEASON = Number(process.env.BACKTEST_MIN_SEASON || 0);
const WANT_STATS = !['0', 'false', 'no'].includes(String(process.env.BACKTEST_STATS ?? '1').toLowerCase());
const OFFLINE = ['1', 'true', 'yes'].includes(String(process.env.BACKTEST_OFFLINE || '').toLowerCase());
const REPORT_ONLY = process.argv.includes('--report');
const FINISHED = new Set(['FT', 'AET', 'PEN']);
const DAY = 86400000;

function log(...a) {
  const line = `[${new Date().toISOString()}] ${a.join(' ')}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}
const readJson = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
// Ασφαλής εγγραφή: στα Windows το Dropbox/antivirus κλειδώνει στιγμιαία αρχεία (EPERM/EBUSY) — ξαναδοκιμάζει, αλλιώς γράφει απευθείας.
const _pause = ms => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch {} };
const writeJson = (f, o) => {
  const data = JSON.stringify(o), tmp = f + '.tmp';
  try { fs.writeFileSync(tmp, data); } catch { _pause(200); fs.writeFileSync(tmp, data); }
  for (let i = 0; i < 8; i++) {
    try { fs.renameSync(tmp, f); return; }
    catch (e) { if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e; _pause(150 * (i + 1)); }
  }
  for (let i = 0; i < 5; i++) {
    try { fs.writeFileSync(f, data); try { fs.unlinkSync(tmp); } catch {} return; }
    catch (e) { if (i === 4) throw e; _pause(500); }
  }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────
// Ρυθμίσεις μοντέλου από το data/apex.sqlite (ΜΟΝΟ ανάγνωση)
// ─────────────────────────────────────────────────────────────
const MODEL_KEYS = ['omega_settings_v5.0', 'omega_lgmods_v5.0', 'omega_my_leagues_v5.0'];
function readAppState() {
  const out = {};
  const file = path.join(DATA_DIR, 'apex.sqlite');
  if (!fs.existsSync(file)) return out;
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(file, { readOnly: true });
    const st = db.prepare('SELECT value FROM kv_state WHERE key = ?');
    for (const k of [...MODEL_KEYS, '__engine_config__']) {
      const r = st.get(k); if (r && typeof r.value === 'string') out[k] = r.value;
    }
    db.close();
  } catch (e) { log('Προειδοποίηση: δεν διαβάστηκε το apex.sqlite:', e.message); }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Πραγματικό API (μόνο για ιστορικά δεδομένα, με όριο κλήσεων)
// ─────────────────────────────────────────────────────────────
let callsUsed = 0, budget = MAX_CALLS, budgetHit = false;
const API_GAP_MS = Number(process.env.BACKTEST_API_GAP_MS || 220);  // ~270 κλήσεις/λεπτό: αφήνει χώρο και στην εφαρμογή
class BudgetError extends Error {}

// Ενιαίος «διαχειριστής ρυθμού»: όλες οι κλήσεις περνούν μία-μία με σταθερό κενό,
// και όταν το API πει «πολλά αιτήματα» σταματούν ΟΛΕΣ μαζί μέχρι το επόμενο λεπτό.
let _slot = Promise.resolve(), _nextAt = 0, _pauseUntil = 0;
function takeSlot() {
  const mine = _slot.then(async () => {
    const now = Date.now();
    const at = Math.max(_nextAt, _pauseUntil, now);
    if (at > now) await sleep(at - now);
    _nextAt = Date.now() + API_GAP_MS;
  });
  _slot = mine.catch(() => {});
  return mine;
}
function pauseToNextMinute(extraMs = 1500) {
  const now = Date.now();
  const until = Math.ceil((now + 1) / 60000) * 60000 + extraMs;
  if (until > _pauseUntil) { _pauseUntil = until; log(`Όριο ανά λεπτό — παύση ${Math.round((until - now) / 1000)}s`); }
}

async function realApi(p) {
  if (OFFLINE) throw new BudgetError('offline');
  for (let attempt = 0; attempt < 5; attempt++) {
    if (callsUsed >= budget) { budgetHit = true; throw new BudgetError('budget'); }
    await takeSlot();
    callsUsed++;
    let r, data;
    try {
      r = await fetch(`${API_BASE}/${p}`, { headers: { 'x-apisports-key': API_KEY, Accept: 'application/json' } });
      data = await r.json().catch(() => null);
    } catch (e) { log('Σφάλμα δικτύου', p, e.message); await sleep(3000 * (attempt + 1)); continue; }
    const rem = parseInt(r.headers.get('x-ratelimit-requests-remaining') || '', 10);
    if (Number.isFinite(rem) && rem <= RESERVE) { budget = Math.min(budget, callsUsed); }
    const perMin = parseInt(r.headers.get('x-ratelimit-remaining') || '', 10);
    if (Number.isFinite(perMin) && perMin <= 5) pauseToNextMinute();
    const errs = data?.errors && (Array.isArray(data.errors) ? data.errors.length : Object.keys(data.errors).length) ? JSON.stringify(data.errors) : '';
    if (r.status === 429 || /rate|too many/i.test(errs)) { pauseToNextMinute(); continue; }
    if (/limit|quota|subscription|key|token/i.test(errs) || r.status === 401 || r.status === 403) {
      budgetHit = true; budget = callsUsed; throw new BudgetError(`API: ${errs || r.status}`);
    }
    if (!r.ok) { await sleep(2000); continue; }
    return data || { response: [] };
  }
  throw new Error(`API απέτυχε: ${p}`);
}

async function apiStatus() {
  const d = await realApi('status');
  const req = d?.response?.requests || {};
  return { current: Number(req.current || 0), limit: Number(req.limit_day || 0), plan: d?.response?.subscription?.plan || '' };
}

// ─────────────────────────────────────────────────────────────
// Τοπική κρυφή μνήμη ιστορικών δεδομένων
// ─────────────────────────────────────────────────────────────
async function getLeagueInfo(L) {
  const f = path.join(CACHE_DIR, 'leagues', `${L}.json`);
  const c = readJson(f);
  if (c && Date.now() - (c._at || 0) < 30 * DAY) return c.data;
  const d = await realApi(`leagues?id=${L}`);
  const info = d?.response?.[0] || null;
  writeJson(f, { _at: Date.now(), data: info });
  return info;
}
function seasonComplete(info, season) {
  const s = (info?.seasons || []).find(x => Number(x.year) === Number(season));
  return s && s.end && Date.parse(s.end) + 3 * DAY < Date.now();
}
async function getSeasonFixtures(L, S, info) {
  const f = path.join(CACHE_DIR, 'fixtures', `${L}_${S}.json`);
  const c = readJson(f);
  // Ολοκληρωμένες σεζόν δεν ξανακατεβαίνουν. Η τρέχουσα ανανεώνεται ανά 12 ώρες.
  if (c && (c.final || Date.now() - (c._at || 0) < 12 * 3600000)) return c.data;
  const d = await realApi(`fixtures?league=${L}&season=${S}`);
  const arr = Array.isArray(d?.response) ? d.response : [];
  writeJson(f, { _at: Date.now(), final: seasonComplete(info, S), data: arr });
  return arr;
}
const statsMem = new Map();
function statsFile(id) { return path.join(CACHE_DIR, 'stats', `${Math.floor(Number(id) / 10000)}`, `${id}.json`); }
function cachedStats(id) {
  if (statsMem.has(id)) return statsMem.get(id);
  const c = readJson(statsFile(id));
  if (c) statsMem.set(id, c.data);
  return c ? c.data : undefined;
}
async function fetchStats(id) {
  const d = await realApi(`fixtures/statistics?fixture=${id}`);
  const arr = Array.isArray(d?.response) ? d.response : [];
  const f = statsFile(id); fs.mkdirSync(path.dirname(f), { recursive: true });
  writeJson(f, { _at: Date.now(), data: arr });
  statsMem.set(id, arr);
  return arr;
}

// Μαζικό κατέβασμα στατιστικών: fixtures?ids=a-b-... (έως 20 αγώνες ανά κλήση, μαζί με statistics)
async function prefetchStats(ids) {
  const need = [...new Set(ids)].filter(id => cachedStats(id) === undefined);
  let got = 0;
  for (let i = 0; i < need.length; i += 20) {
    const chunk = need.slice(i, i + 20);
    let d;
    try { d = await realApi(`fixtures?ids=${chunk.join('-')}`); }
    catch (e) { if (e instanceof BudgetError) { budgetHit = true; return got; } log('Μαζικά στατιστικά:', e.message); continue; }
    const seen = new Set();
    for (const f of d?.response || []) {
      const id = f?.fixture?.id; if (!id) continue; seen.add(id);
      const arr = Array.isArray(f.statistics) ? f.statistics : [];
      const file = statsFile(id); fs.mkdirSync(path.dirname(file), { recursive: true });
      writeJson(file, { _at: Date.now(), data: arr }); statsMem.set(id, arr); got++;
    }
    for (const id of chunk) if (!seen.has(id)) { const file = statsFile(id); fs.mkdirSync(path.dirname(file), { recursive: true }); writeJson(file, { _at: Date.now(), data: [] }); statsMem.set(id, []); }
  }
  return got;
}

// ─────────────────────────────────────────────────────────────
// Δείκτες δεδομένων (όλοι οι αγώνες που κατέβηκαν)
// ─────────────────────────────────────────────────────────────
const FX = new Map();          // id → fixture
const BY_TEAM = new Map();     // teamId → [fixtures] (φθίνουσα χρονολογικά)
const BY_LS = new Map();       // `${L}_${S}` → [fixtures]
const STATS_COVERAGE = new Map(); // `${L}_${S}` → bool
function indexFixtures(L, S, arr) {
  const key = `${L}_${S}`;
  BY_LS.set(key, arr);
  for (const f of arr) {
    const id = f?.fixture?.id; if (!id) continue;
    FX.set(id, f);
  }
}
function rebuildTeamIndex() {
  BY_TEAM.clear();
  for (const f of FX.values()) {
    for (const t of [f?.teams?.home?.id, f?.teams?.away?.id]) {
      if (!t) continue;
      if (!BY_TEAM.has(t)) BY_TEAM.set(t, []);
      BY_TEAM.get(t).push(f);
    }
  }
  for (const a of BY_TEAM.values()) a.sort((x, y) => (y.fixture.timestamp || 0) - (x.fixture.timestamp || 0));
}
const ts = f => Number(f?.fixture?.timestamp || 0) * 1000;
const isFT = f => f?.fixture?.status?.short === 'FT';
const isDone = f => FINISHED.has(f?.fixture?.status?.short);

// ─────────────────────────────────────────────────────────────
// Point-in-time προσομοιωτής API: απαντά ΜΟΝΟ με δεδομένα πριν το CUTOFF
// ─────────────────────────────────────────────────────────────
let CUTOFF = 0;          // ms — αρχή της ημέρας των αγώνων-στόχων (UTC)
let unknownPaths = new Map();

function teamAgg(arr, teamId) {
  const z = () => ({ home: 0, away: 0, total: 0 });
  const played = z(), wins = z(), draws = z(), loses = z(), gf = z(), ga = z();
  for (const f of arr) {
    if (!isDone(f)) continue;
    const isH = f.teams.home.id === teamId; if (!isH && f.teams.away.id !== teamId) continue;
    const side = isH ? 'home' : 'away';
    const my = Number(isH ? f.goals.home : f.goals.away) || 0, op = Number(isH ? f.goals.away : f.goals.home) || 0;
    played[side]++; played.total++;
    gf[side] += my; gf.total += my; ga[side] += op; ga.total += op;
    if (my > op) { wins[side]++; wins.total++; } else if (my < op) { loses[side]++; loses.total++; } else { draws[side]++; draws.total++; }
  }
  const avg = (g, p) => ({ home: p.home ? (g.home / p.home).toFixed(1) : '0.0', away: p.away ? (g.away / p.away).toFixed(1) : '0.0', total: p.total ? (g.total / p.total).toFixed(1) : '0.0' });
  return { played, wins, draws, loses, gf, ga, avgF: avg(gf, played), avgA: avg(ga, played) };
}

function emulate(apiPath) {
  const u = new URL('http://x/' + apiPath.replace(/^\/+/, ''));
  const ep = u.pathname.replace(/^\/+/, '');
  const q = Object.fromEntries(u.searchParams.entries());
  const ok = response => ({ errors: [], results: Array.isArray(response) ? response.length : 1, response });
  const before = f => ts(f) < CUTOFF;

  if (ep === 'status') return ok({ requests: { current: 0, limit_day: 999999 }, subscription: { plan: 'Backtest', active: true } });

  if (ep === 'fixtures' && q.team) {
    const T = Number(q.team);
    let arr = (BY_TEAM.get(T) || []).filter(before);
    if (q.league) arr = arr.filter(f => String(f.league.id) === String(q.league));
    if (q.season) arr = arr.filter(f => String(f.league.season) === String(q.season));
    if (q.status) { const want = new Set(String(q.status).split('-')); arr = arr.filter(f => want.has(f.fixture.status.short)); }
    else arr = arr.filter(isDone);
    if (q.last) arr = arr.slice(0, Number(q.last));
    return ok(arr);
  }
  if (ep === 'fixtures/headtohead' && q.h2h) {
    const [a, b] = String(q.h2h).split('-').map(Number);
    let arr = (BY_TEAM.get(a) || []).filter(f => before(f) && isDone(f) && (f.teams.home.id === b || f.teams.away.id === b));
    if (q.last) arr = arr.slice(0, Number(q.last));
    return ok(arr);
  }
  if (ep === 'teams/statistics' && q.team && q.league && q.season) {
    const T = Number(q.team);
    const arr = (BY_LS.get(`${q.league}_${q.season}`) || []).filter(before);
    const g = teamAgg(arr, T);
    if (!g.played.total) return ok({});
    return ok({
      league: { id: Number(q.league), season: Number(q.season) }, team: { id: T },
      fixtures: { played: g.played, wins: g.wins, draws: g.draws, loses: g.loses },
      goals: { for: { total: g.gf, average: g.avgF }, against: { total: g.ga, average: g.avgA } },
    });
  }
  if (ep === 'standings' && q.league && q.season) {
    const arr = (BY_LS.get(`${q.league}_${q.season}`) || []).filter(f => before(f) && isDone(f));
    const teams = new Map();
    for (const f of arr) for (const t of [f.teams.home, f.teams.away]) if (!teams.has(t.id)) teams.set(t.id, t);
    // Ομάδες της σεζόν που δεν έχουν παίξει ακόμη (για σωστό πλήθος θέσεων)
    for (const f of (BY_LS.get(`${q.league}_${q.season}`) || [])) for (const t of [f.teams.home, f.teams.away]) if (!teams.has(t.id)) teams.set(t.id, t);
    if (!arr.length) return ok([]);
    const rows = [...teams.values()].map(t => {
      const g = teamAgg(arr, t.id);
      const sideObj = s => ({ played: g.played[s], win: g.wins[s], draw: g.draws[s], lose: g.loses[s], goals: { for: g.gf[s], against: g.ga[s] } });
      const last5 = arr.filter(f => f.teams.home.id === t.id || f.teams.away.id === t.id).sort((x, y) => ts(y) - ts(x)).slice(0, 5)
        .map(f => { const h = f.teams.home.id === t.id; const my = h ? f.goals.home : f.goals.away, op = h ? f.goals.away : f.goals.home; return my > op ? 'W' : my < op ? 'L' : 'D'; }).reverse().join('');
      return { team: { id: t.id, name: t.name, logo: t.logo }, points: g.wins.total * 3 + g.draws.total, goalsDiff: g.gf.total - g.ga.total, gf: g.gf.total, group: '', form: last5,
        all: sideObj('total'), home: sideObj('home'), away: sideObj('away') };
    }).sort((a, b) => b.points - a.points || b.goalsDiff - a.goalsDiff || b.gf - a.gf).map((r, i) => { r.rank = i + 1; delete r.gf; return r; });
    return ok([{ league: { id: Number(q.league), season: Number(q.season), standings: [rows] } }]);
  }
  if (ep === 'fixtures/statistics' && q.fixture) {
    const id = Number(q.fixture);
    const f = FX.get(id);
    if (!f || !before(f)) return ok([]);           // ποτέ στατιστικά από το μέλλον
    const c = cachedStats(id);
    if (c !== undefined) return ok(c);
    return { __needStats: id };
  }
  // Δεν υπάρχουν ιστορικά (point-in-time) → ουδέτερη απάντηση, όπως όταν λείπουν live
  if (['players/topscorers', 'players/topassists', 'players/topyellowcards', 'injuries', 'fixtures/lineups', 'odds', 'odds/live', 'predictions', 'fixtures/events', 'fixtures/players'].includes(ep)) return ok([]);
  unknownPaths.set(ep, (unknownPaths.get(ep) || 0) + 1);
  return ok([]);
}

async function handleFootball(apiPath) {
  const r = emulate(apiPath);
  if (r && r.__needStats) {
    const id = r.__needStats; const f = FX.get(id);
    const cov = STATS_COVERAGE.get(`${f.league.id}_${f.league.season}`);
    if (!WANT_STATS || OFFLINE || cov === false) return { errors: [], results: 0, response: [] };
    try { const arr = await fetchStats(id); return { errors: [], results: arr.length, response: arr }; }
    catch (e) { if (e instanceof BudgetError) budgetHit = true; return { errors: [], results: 0, response: [] }; }
  }
  return r;
}

// ─────────────────────────────────────────────────────────────
// Τοπικός server: σερβίρει την εφαρμογή + τον προσομοιωτή
// ─────────────────────────────────────────────────────────────
function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' })[ext] || 'application/octet-stream';
}
function startServer(appState) {
  const boot = {};
  for (const k of MODEL_KEYS) if (appState[k]) boot[k] = { value: appState[k] };
  const bootScript = `<script>try{localStorage.clear();const s=${JSON.stringify(boot).replace(/</g, '\\u003c')};for(const [k,r] of Object.entries(s))localStorage.setItem(k,r.value);}catch(e){}window.__APEX_BACKTEST__=true;</script>`;
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      const p = decodeURIComponent(u.pathname);
      if (p.startsWith('/api/football/')) {
        const data = await handleFootball(p.slice('/api/football/'.length) + u.search);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify(data));
      }
      if (p.startsWith('/api/')) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"backtest: disabled"}'); }
      if (p === '/' || p === '/index.html') {
        const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace('<!--APEX_SERVER_STATE-->', bootScript)
          .replace(/<script src="background-bridge\.js[^"]*"><\/script>/, '');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html);
      }
      const rel = p.replace(/^\/+/, '');
      if (!/^[\w.-]+\.(js|css|png|svg|ico)$/.test(rel) || rel === 'backtest.js' || rel === 'server.js') { res.writeHead(404); return res.end(); }
      const file = path.join(ROOT, rel);
      if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    } catch (e) { res.writeHead(500); res.end(String(e.message)); }
  });
  // Αν η θύρα είναι πιασμένη (π.χ. παλιό παράθυρο backtest ακόμη ανοιχτό), δοκιμάζει τις επόμενες.
  return new Promise((resolve, reject) => {
    let port = PORT;
    const tryListen = () => {
      server.once('error', e => { if (e.code === 'EADDRINUSE' && port < PORT + 20) { port++; tryListen(); } else reject(e); });
      server.listen(port, '127.0.0.1', () => { ACTIVE_PORT = port; resolve(server); });
    };
    tryListen();
  });
}

function findChrome() {
  const c = [];
  if (process.env.APEX_CHROME_PATH) c.push(process.env.APEX_CHROME_PATH);
  if (process.platform === 'win32') {
    const pf = process.env.PROGRAMFILES || 'C:\\Program Files', pfx = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', la = process.env.LOCALAPPDATA || '';
    c.push(path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(pfx, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(la, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(pfx, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  } else c.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
  return c.find(p => p && fs.existsSync(p)) || null;
}

// ─────────────────────────────────────────────────────────────
// Εκτέλεση του μοντέλου μέσα στη σελίδα
// ─────────────────────────────────────────────────────────────
async function openPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => log('Σφάλμα σελίδας:', e.message));
  await page.goto(`http://127.0.0.1:${ACTIVE_PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => typeof analyzeMatchSafe === 'function' && typeof computePick === 'function', null, { timeout: 90000 });
  await page.evaluate(() => {
    try { window.loadSettings?.(); } catch {}
    try { API_START_GAP_MS = 0; } catch {}
    window.setProgress = () => {};
    try { setProgress = () => {}; } catch {}
  });
  return { ctx, page };
}

async function analyzeDay(page, fixtures) {
  return page.evaluate(async (list) => {
    for (const c of [teamStatsCache, lastFixCache, standCache, h2hCache, scorersCache, assistsCache, cardsCache, injuryCache, lineupsCache, primaryCompetitionCache, _buildIntelCache]) { try { c.clear(); } catch {} }
    try { _buildIntelPromises.clear(); } catch {}
    window.scannedMatchesData = [];
    const B = 8;
    for (let i = 0; i < list.length; i += B) await Promise.all(list.slice(i, i + B).map((m, j) => analyzeMatchSafe(m, i + j, list.length)));
    const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);
    return (window.scannedMatchesData || []).map(r => {
      let signals = [];
      try { signals = collectConfirmedMarketSignals(r).map(s => ({ key: s.key, selection: s.selection || null, scores: s.scores || null, confidence: num(s.confidence) })); } catch {}
      const pp = r.pp || {};
      return {
        fixId: r.fixId, error: r.analysisError || null,
        pHome: num(pp.pHome), pDraw: num(pp.pDraw), pAway: num(pp.pAway),
        pO25: num(pp.pO25), pO35: num(pp.pO35), pU25: num(pp.pU25), pBTTS: num(pp.pBTTS),
        hXG: num(r.hXGfinal), aXG: num(r.aXGfinal), tXG: num(r.tXG),
        outPick: r.outPick || null, outcomeMarket: r.outcomeMarket || null, outcomeProb: num(r.outcomeProb),
        omegaPick: r.omegaPick || null, strength: num(r.strength), exact: r.exact || null, exact2: r.exact2 || null, exactConf: num(r.exactConf),
        signals,
      };
    });
  }, fixtures);
}

// ─────────────────────────────────────────────────────────────
// Αναφορά
// ─────────────────────────────────────────────────────────────
function wilsonLB(k, n, z = 1.96) { if (!n) return 0; const p = k / n, d = 1 + z * z / n; return (p + z * z / (2 * n) - z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d; }
function outcomeOf(h, a) { return h > a ? '1' : h < a ? '2' : 'X'; }
function settle(sig, h, a) {
  const t = h + a, o = outcomeOf(h, a);
  switch (sig.key) {
    case 'OUT_1': return o === '1'; case 'OUT_X': return o === 'X'; case 'OUT_2': return o === '2';
    case 'OUT_1X': return o !== '2'; case 'OUT_X2': return o !== '1'; case 'OUT_12': return o !== 'X';
    case 'O25': return t >= 3; case 'O35': return t >= 4; case 'U25': return t <= 2; case 'BTTS': return h > 0 && a > 0;
    case 'EXACT': return (sig.scores || []).includes(`${h}-${a}`);
    default: return null;
  }
}
function metrics(rows) {
  let n = 0, brier = 0, ll = 0, acc = 0; const bins = Array.from({ length: 10 }, () => ({ n: 0, conf: 0, hit: 0 }));
  const sel = { 0.5: [0, 0], 0.6: [0, 0], 0.7: [0, 0] };
  for (const r of rows) {
    const p = { '1': r.pHome, 'X': r.pDraw, '2': r.pAway };
    if (![p['1'], p['X'], p['2']].every(Number.isFinite)) continue;
    const s = p['1'] + p['X'] + p['2']; if (!(s > 0)) continue;
    for (const k of ['1', 'X', '2']) p[k] /= s;
    const o = outcomeOf(r.gh, r.ga); n++;
    for (const k of ['1', 'X', '2']) brier += (p[k] - (k === o ? 1 : 0)) ** 2;
    ll += -Math.log(Math.max(1e-12, p[o]));
    const best = ['1', 'X', '2'].reduce((a, b) => p[b] > p[a] ? b : a, '1'); const pm = p[best]; const hit = best === o;
    acc += hit;
    const b = Math.min(9, Math.floor(pm * 10)); bins[b].n++; bins[b].conf += pm; bins[b].hit += hit;
    for (const t of Object.keys(sel)) if (pm >= Number(t)) { sel[t][0]++; sel[t][1] += hit; }
  }
  const ece = n ? bins.reduce((s, b) => s + (b.n ? Math.abs(b.hit / b.n - b.conf / b.n) * b.n / n : 0), 0) : null;
  return { n, brier: n ? brier / n : null, logloss: n ? ll / n : null, ece, acc: n ? acc / n : null, sel, bins };
}
const pct = (x, d = 1) => (x === null || x === undefined || !Number.isFinite(x)) ? '—' : (x * 100).toFixed(d) + '%';
const f3 = x => (x === null || !Number.isFinite(x)) ? '—' : x.toFixed(4);

function buildReport() {
  if (!fs.existsSync(PRED_FILE)) { log('Δεν υπάρχουν ακόμη προβλέψεις για αναφορά.'); return null; }
  const rows = []; const seen = new Set();
  for (const line of fs.readFileSync(PRED_FILE, 'utf8').split(/\n/)) {
    if (!line.trim()) continue; let r; try { r = JSON.parse(line); } catch { continue; }
    if (seen.has(r.fixId) || r.error || !Number.isFinite(r.gh) || !Number.isFinite(r.ga)) continue; seen.add(r.fixId); rows.push(r);
  }
  rows.sort((a, b) => a.ts - b.ts);
  const all = metrics(rows);
  const groupBy = (keyFn) => { const m = new Map(); for (const r of rows) { const k = keyFn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
  const byLeague = [...groupBy(r => `${r.league}|${r.leagueId}`).entries()].map(([k, v]) => ({ k: k.split('|')[0], ...metrics(v) })).sort((a, b) => b.n - a.n);
  const bySeason = [...groupBy(r => String(r.season)).entries()].map(([k, v]) => ({ k, ...metrics(v) })).sort((a, b) => Number(b.k) - Number(a.k));
  // Βάση σύγκρισης: πρόβλεψη με τα ποσοστά 1/Χ/2 του ίδιου πρωταθλήματος σε ΠΡΟΗΓΟΥΜΕΝΟΥΣ αγώνες
  const base = []; const cnt = new Map();
  for (const r of rows) {
    const c = cnt.get(r.leagueId) || { '1': 1, 'X': 1, '2': 1, n: 3 };
    base.push({ pHome: c['1'] / c.n, pDraw: c['X'] / c.n, pAway: c['2'] / c.n, gh: r.gh, ga: r.ga });
    c[outcomeOf(r.gh, r.ga)]++; c.n++; cnt.set(r.leagueId, c);
  }
  const baseM = metrics(base);
  // Σήματα αγορών
  const sigAgg = new Map();
  const ev = { O25: r => r.gh + r.ga >= 3, O35: r => r.gh + r.ga >= 4, U25: r => r.gh + r.ga <= 2, BTTS: r => r.gh > 0 && r.ga > 0, OUT_1: r => r.gh > r.ga, OUT_X: r => r.gh === r.ga, OUT_2: r => r.gh < r.ga, OUT_1X: r => r.gh >= r.ga, OUT_X2: r => r.gh <= r.ga, OUT_12: r => r.gh !== r.ga };
  for (const r of rows) for (const s of r.signals || []) {
    const h = settle(s, r.gh, r.ga); if (h === null) continue;
    const g = sigAgg.get(s.key) || { n: 0, k: 0 }; g.n++; g.k += h; sigAgg.set(s.key, g);
  }
  const sigRows = [...sigAgg.entries()].map(([key, g]) => ({ key, ...g, rate: g.k / g.n, wil: wilsonLB(g.k, g.n), base: ev[key] ? rows.filter(ev[key]).length / rows.length : null })).sort((a, b) => b.n - a.n);
  // Κανόνας ισοπαλιών: 3 μεγαλύτερες p(X) ανά ημέρα
  const byDay = groupBy(r => new Date(r.ts).toISOString().slice(0, 10)); let dn = 0, dk = 0;
  for (const v of byDay.values()) for (const r of [...v].sort((a, b) => b.pDraw - a.pDraw).slice(0, 3)) { dn++; dk += r.gh === r.ga; }
  const drawBase = rows.filter(r => r.gh === r.ga).length / (rows.length || 1);
  const xArg = rows.filter(r => r.pDraw >= r.pHome && r.pDraw >= r.pAway); const xArgK = xArg.filter(r => r.gh === r.ga).length;
  const range = rows.length ? `${new Date(rows[0].ts).toISOString().slice(0, 10)} → ${new Date(rows[rows.length - 1].ts).toISOString().slice(0, 10)}` : '—';
  const SIGN = { OUT_1: 'Σημείο 1', OUT_X: 'Σημείο Χ', OUT_2: 'Σημείο 2', OUT_1X: 'Διπλή 1Χ', OUT_X2: 'Διπλή Χ2', OUT_12: 'Διπλή 12', O25: 'Over 2.5', O35: 'Over 3.5', U25: 'Under 2.5', BTTS: 'Goal-Goal', EXACT: 'Ακριβές σκορ (2 σκορ)' };

  const summary = { generatedAt: new Date().toISOString(), range, n: all.n, model: { brier: all.brier, logloss: all.logloss, ece: all.ece, acc: all.acc, sel: all.sel }, baseline: { brier: baseM.brier, logloss: baseM.logloss, acc: baseM.acc }, signals: sigRows, draws: { top3PerDay: { n: dn, k: dk }, base: drawBase, argmax: { n: xArg.length, k: xArgK } }, byLeague: byLeague.map(({ bins, ...r }) => r), bySeason: bySeason.map(({ bins, ...r }) => r) };
  writeJson(path.join(BT_DIR, 'summary.json'), summary);

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const tr = cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
  const mrow = (name, m) => tr([esc(name), m.n, f3(m.brier), f3(m.logloss), f3(m.ece), pct(m.acc), `${pct(m.sel['0.6'][0] ? m.sel['0.6'][1] / m.sel['0.6'][0] : null)} <small>(κάλυψη ${pct(m.n ? m.sel['0.6'][0] / m.n : null, 0)})</small>`]);
  const html = `<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>APEX OMEGA — Ιστορικός έλεγχος</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;background:#0f1419;color:#e6e6e6;margin:0;padding:16px;max-width:1100px;margin:auto}h1{font-size:1.4rem}h2{font-size:1.1rem;margin-top:28px;color:#7cc4ff}table{border-collapse:collapse;width:100%;font-size:.85rem;margin-top:8px}td,th{border-bottom:1px solid #2a3340;padding:6px 8px;text-align:left}th{color:#9aa7b4;font-weight:600}.good{background:#1e8e3e;color:#fff;padding:2px 6px;border-radius:4px}.box{background:#18202a;border-radius:8px;padding:12px 16px;margin-top:12px}small{color:#9aa7b4}.wrap{overflow-x:auto}</style></head><body>
<h1>APEX OMEGA — Ιστορικός έλεγχος (backtest)</h1>
<div class="box">Αγώνες: <b>${all.n}</b> · Περίοδος: <b>${range}</b> · Ενημέρωση: ${new Date().toLocaleString('el-GR')}<br>
<small>Σημερινές ρυθμίσεις μοντέλου, μόνο δεδομένα πριν από κάθε αγώνα. Χωρίς τραυματισμούς/συνθέσεις και χωρίς αποδόσεις αγοράς (δεν υπάρχουν ιστορικά). Brier: μέσο τετραγωνικό σφάλμα πιθανοτήτων (μικρότερο = καλύτερο, τυχαίο 0.667). Log Loss: λογαριθμική απώλεια (τυχαίο 1.099). ECE: σφάλμα βαθμονόμησης (0 = τέλειο).</small></div>
<h2>Συνολικά 1Χ2</h2><div class="wrap"><table><tr><th></th><th>Αγώνες</th><th>Brier</th><th>Log Loss</th><th>ECE</th><th>Ευστοχία</th><th>Ευστοχία όταν p≥60%</th></tr>
${mrow('APEX', all)}${tr(['Απλή βάση (ποσοστά 1/Χ/2 πρωταθλήματος)', baseM.n, f3(baseM.brier), f3(baseM.logloss), f3(baseM.ece), pct(baseM.acc), '—'])}</table></div>
<h2>Επιλεκτική ευστοχία (μόνο όταν το APEX είναι σίγουρο)</h2><div class="wrap"><table><tr><th>Όριο</th><th>Αγώνες</th><th>Κάλυψη</th><th>Ευστοχία</th><th>Wilson 95% (κάτω όριο)</th></tr>
${Object.entries(all.sel).map(([t, [n, k]]) => tr([`p ≥ ${Math.round(t * 100)}%`, n, pct(all.n ? n / all.n : null, 0), pct(n ? k / n : null), pct(wilsonLB(k, n))])).join('')}</table></div>
<h2>Ανά είδος στοιχήματος (σήματα της εφαρμογής)</h2><div class="wrap"><table><tr><th>Σήμα</th><th>Πλήθος</th><th>Σωστά</th><th>Ευστοχία</th><th>Wilson 95%</th><th>Συχνότητα γενικά</th></tr>
${sigRows.map(s => { const good = s.base !== null && s.n >= 100 && s.wil > s.base; return tr([esc(SIGN[s.key] || s.key), s.n, s.k, good ? `<span class="good">${pct(s.rate)}</span>` : pct(s.rate), pct(s.wil), s.base === null ? '—' : pct(s.base)]); }).join('')}</table>
<small>Πράσινο = ≥100 σήματα και ακόμη και το κάτω όριο Wilson είναι πάνω από τη γενική συχνότητα (πραγματικό πλεονέκτημα).</small></div>
<h2>Ισοπαλίες</h2><div class="box">3 μεγαλύτερες p(Χ) ανά ημέρα: <b>${dk}/${dn} (${pct(dn ? dk / dn : null)})</b>, Wilson ${pct(wilsonLB(dk, dn))} · γενικά ισοπαλίες ${pct(drawBase)}<br>Όταν το Χ ήταν το πιθανότερο σημείο: ${xArgK}/${xArg.length} (${pct(xArg.length ? xArgK / xArg.length : null)})</div>
<h2>Βαθμονόμηση (μέγιστη πιθανότητα 1Χ2)</h2><div class="wrap"><table><tr><th>Πιθανότητα APEX</th><th>Αγώνες</th><th>Μέση πιθανότητα</th><th>Πραγματική ευστοχία</th></tr>
${all.bins.map((b, i) => b.n ? tr([`${i * 10}–${i * 10 + 10}%`, b.n, pct(b.conf / b.n), pct(b.hit / b.n)]) : '').join('')}</table></div>
<h2>Ανά πρωτάθλημα</h2><div class="wrap"><table><tr><th>Πρωτάθλημα</th><th>Αγώνες</th><th>Brier</th><th>Log Loss</th><th>ECE</th><th>Ευστοχία</th><th>Ευστοχία p≥60%</th></tr>${byLeague.map(m => mrow(m.k, m)).join('')}</table></div>
<h2>Ανά σεζόν</h2><div class="wrap"><table><tr><th>Σεζόν</th><th>Αγώνες</th><th>Brier</th><th>Log Loss</th><th>ECE</th><th>Ευστοχία</th><th>Ευστοχία p≥60%</th></tr>${bySeason.map(m => mrow(m.k, m)).join('')}</table></div>
</body></html>`;
  const out = path.join(BT_DIR, 'BACKTEST_REPORT.html');
  fs.writeFileSync(out, html);
  log(`Αναφορά: ${out} (${all.n} αγώνες, Brier ${f3(all.brier)}, Log Loss ${f3(all.logloss)}, ευστοχία ${pct(all.acc)})`);
  return out;
}

// ─────────────────────────────────────────────────────────────
// Κύρια ροή
// ─────────────────────────────────────────────────────────────
async function main() {
  if (REPORT_ONLY) { buildReport(); return; }
  if (!API_KEY && !OFFLINE) throw new Error('Λείπει το API_FOOTBALL_KEY από το .env');
  const appState = readAppState();
  let leagues = String(process.env.BACKTEST_LEAGUES || '').split(',').map(Number).filter(Boolean);
  if (!leagues.length) { try { leagues = JSON.parse(appState.__engine_config__ || '{}').leagueIds || []; } catch {} }
  if (!leagues.length) { try { leagues = JSON.parse(appState['omega_my_leagues_v5.0'] || '[]'); } catch {} }
  if (!leagues.length) throw new Error('Δεν βρέθηκαν πρωταθλήματα (BACKTEST_LEAGUES).');

  if (!OFFLINE) {
    const st = await apiStatus();
    if (st.limit) budget = Math.max(0, Math.min(MAX_CALLS, st.limit - st.current - RESERVE));
    log(`API: πλάνο ${st.plan || '?'}, χρησιμοποιημένες σήμερα ${st.current}/${st.limit}. Όριο αυτής της εκτέλεσης: ${budget} κλήσεις.`);
    if (budget <= 0) { log('Δεν περισσεύουν κλήσεις σήμερα (κρατάμε απόθεμα για την εφαρμογή). Αύριο συνεχίζει.'); buildReport(); return; }
  }

  // 1) Λίστα σεζόν και κατέβασμα αγώνων ανά σεζόν (1 κλήση ανά σεζόν)
  const plan = [];
  for (const L of leagues) {
    let info = null;
    try { info = await getLeagueInfo(L); } catch (e) { if (e instanceof BudgetError) break; log('Πρωτάθλημα', L, e.message); continue; }
    if (!info) continue;
    const seasons = (info.seasons || []).filter(s => s.coverage?.fixtures && Number(s.year) >= MIN_SEASON && Date.parse(s.start || 0) < Date.now())
      .sort((a, b) => b.year - a.year);
    for (const s of seasons) STATS_COVERAGE.set(`${L}_${s.year}`, !!s.coverage?.fixtures?.statistics_fixtures);
    plan.push({ L, name: info.league?.name || String(L), seasons: seasons.map(s => Number(s.year)), info });
  }
  // Πρώτα οι πιο πρόσφατες σεζόν όλων των πρωταθλημάτων (πιο χρήσιμες), μετά όλο και παλαιότερες
  const maxDepth = Math.max(0, ...plan.map(p => p.seasons.length));
  const loaded = new Set();
  outer: for (let d = 0; d < maxDepth; d++) {
    for (const p of plan) {
      const S = p.seasons[d]; if (S === undefined) continue;
      try { const arr = await getSeasonFixtures(p.L, S, p.info); indexFixtures(p.L, S, arr); loaded.add(`${p.L}_${S}`); }
      catch (e) { if (e instanceof BudgetError) break outer; log('Σεζόν', p.L, S, e.message); }
    }
  }
  // Ό,τι υπάρχει ήδη στην κρυφή μνήμη φορτώνεται επίσης (για H2H/φόρμα)
  for (const f of fs.readdirSync(path.join(CACHE_DIR, 'fixtures'))) {
    const m = f.match(/^(\d+)_(\d+)\.json$/); if (!m || loaded.has(`${m[1]}_${m[2]}`)) continue;
    const c = readJson(path.join(CACHE_DIR, 'fixtures', f)); if (c?.data) { indexFixtures(Number(m[1]), Number(m[2]), c.data); loaded.add(`${m[1]}_${m[2]}`); }
  }
  rebuildTeamIndex();
  log(`Φορτώθηκαν ${FX.size} αγώνες από ${loaded.size} σεζόν.`);

  // 2) Στόχοι: τελειωμένοι αγώνες σεζόν που έχουν και την ΠΡΟΗΓΟΥΜΕΝΗ σεζόν φορτωμένη (ιστορικό φόρμας)
  // Έκδοση μοντέλου: αν άλλαξε το stats.js, οι παλιές προβλέψεις αρχειοθετούνται και ξαναϋπολογίζονται
  // (τα ιστορικά δεδομένα είναι ήδη στην κρυφή μνήμη, οπότε δεν ξοδεύονται ξανά κλήσεις API).
  // Έκδοση μοντέλου = MODEL_VERSION από το stats.js (αλλαγές μόνο εμφάνισης δεν προκαλούν επανυπολογισμό).
  const statsSrc = fs.readFileSync(path.join(ROOT, 'stats.js'), 'utf8');
  const mv = statsSrc.match(/const MODEL_VERSION\s*=\s*['"]([^'"]+)['"]/);
  const modelHash = mv ? mv[1] : require('node:crypto').createHash('sha1').update(statsSrc).digest('hex').slice(0, 10);
  const SAME_MODEL = { '68f2e3d595': '2026-10-11-cal1' }; // ίδιο μοντέλο, πριν μπει το MODEL_VERSION
  let state = readJson(STATE_FILE, { done: {} });
  if (state.modelHash && SAME_MODEL[state.modelHash] === modelHash) state.modelHash = modelHash;
  if (Object.keys(state.done || {}).length && state.modelHash !== modelHash) {
    const arch = path.join(BT_DIR, `predictions_${state.modelHash || 'v0'}.jsonl`);
    if (fs.existsSync(PRED_FILE)) { let ok = false; for (let i = 0; i < 8 && !ok; i++) { try { fs.renameSync(PRED_FILE, arch); ok = true; } catch (e) { _pause(300 * (i + 1)); } } if (!ok) { fs.copyFileSync(PRED_FILE, arch); fs.writeFileSync(PRED_FILE, ''); } }
    log(`Νέα έκδοση μοντέλου (${state.modelHash} → ${modelHash}). Οι παλιές προβλέψεις κρατήθηκαν στο ${path.basename(arch)} και ξαναϋπολογίζονται όλες.`);
    state = { done: {} };
  }
  state.modelHash = modelHash;
  const done = new Set(Object.keys(state.done || {}).map(Number));
  const targets = [];
  for (const key of loaded) {
    const [L, S] = key.split('_').map(Number);
    if (!loaded.has(`${L}_${S - 1}`)) continue;
    for (const f of BY_LS.get(key) || []) if (isDone(f) && f.goals?.home !== null && !done.has(f.fixture.id) && ts(f) < Date.now() - 3 * 3600000) targets.push(f);
  }
  // Ομαδοποίηση ανά ημέρα (UTC), νεότερες ημέρες πρώτα
  const days = new Map();
  for (const f of targets) { const d = Math.floor(ts(f) / DAY) * DAY; if (!days.has(d)) days.set(d, []); days.get(d).push(f); }
  const dayKeys = [...days.keys()].sort((a, b) => b - a);
  log(`Αγώνες προς υπολογισμό: ${targets.length} σε ${dayKeys.length} ημέρες (ήδη έτοιμοι: ${done.size}).`);
  if (!dayKeys.length) { buildReport(); return; }

  // 3) Server + headless browser με την πραγματική εφαρμογή
  const server = await startServer(appState);
  let playwright; try { playwright = require('playwright-core'); } catch { throw new Error('Λείπει το playwright-core. Τρέξε INSTALL_WINDOWS.bat.'); }
  const exe = findChrome(); if (!exe) throw new Error('Δεν βρέθηκε Chrome/Edge. Όρισε APEX_CHROME_PATH στο .env.');
  const browser = await playwright.chromium.launch({ headless: true, executablePath: exe });
  let { ctx, page } = await openPage(browser);
  let processed = 0, daysDone = 0; const t0 = Date.now();
  try {
    for (const d of dayKeys) {
      if (budgetHit) break;
      CUTOFF = d; // μόνο δεδομένα ΠΡΙΝ την αρχή της ημέρας
      const list = days.get(d).map(f => ({
        fixture: { ...f.fixture, status: { long: 'Not Started', short: 'NS', elapsed: null } },
        league: f.league, teams: { home: { ...f.teams.home, winner: null }, away: { ...f.teams.away, winner: null } },
        goals: { home: null, away: null }, score: { halftime: { home: null, away: null }, fulltime: { home: null, away: null } },
      }));
      if (WANT_STATS && !OFFLINE) {
        const ids = [];
        for (const f of days.get(d)) for (const t of [f.teams.home.id, f.teams.away.id]) {
          for (const g of (BY_TEAM.get(t) || []).filter(x => ts(x) < CUTOFF && isDone(x)).slice(0, 20))
            if (STATS_COVERAGE.get(`${g.league.id}_${g.league.season}`) !== false) ids.push(g.fixture.id);
        }
        await prefetchStats(ids);
        if (budgetHit) { log('Τέλος ορίου κλήσεων — συνέχεια στην επόμενη εκτέλεση.'); break; }
      }
      const res = await analyzeDay(page, list);
      if (budgetHit) { log('Τέλος ορίου κλήσεων στη μέση της ημέρας — η ημέρα θα ξαναγίνει αύριο.'); break; }
      const lines = [];
      for (const r of res) {
        const f = FX.get(r.fixId); if (!f) continue;
        lines.push(JSON.stringify({ ...r, model: modelHash, ts: ts(f), leagueId: f.league.id, league: f.league.name, season: f.league.season, home: f.teams.home.name, away: f.teams.away.name,
          gh: Number(f.goals.home), ga: Number(f.goals.away), htH: f.score?.halftime?.home ?? null, htA: f.score?.halftime?.away ?? null, status: f.fixture.status.short }));
        state.done[r.fixId] = 1;
      }
      if (lines.length) { const txt = lines.join('\n') + '\n'; for (let i = 0; i < 6; i++) { try { fs.appendFileSync(PRED_FILE, txt); break; } catch (e) { if (i === 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e; _pause(300 * (i + 1)); } } }
      processed += lines.length; daysDone++;
      if (daysDone % 10 === 0) {
        writeJson(STATE_FILE, state);
        log(`Πρόοδος: ${processed} αγώνες, ${daysDone}/${dayKeys.length} ημέρες, κλήσεις API ${callsUsed}/${budget}, ${((Date.now() - t0) / 60000).toFixed(1)} λεπτά.`);
      }
      if (daysDone % 150 === 0) { await ctx.close(); ({ ctx, page } = await openPage(browser)); }
    }
  } finally {
    try { writeJson(STATE_FILE, state); } catch (e) { log('Προειδοποίηση: δεν γράφτηκε το state.json:', e.message); }
    try { await browser.close(); } catch {}
    try { server.close(); } catch {}
  }
  if (unknownPaths.size) log('Αιτήματα χωρίς ιστορικά δεδομένα (ουδέτερη απάντηση):', [...unknownPaths.entries()].map(([k, v]) => `${k}×${v}`).join(', '));
  log(`Ολοκληρώθηκε η εκτέλεση: ${processed} νέοι αγώνες, κλήσεις API ${callsUsed}.${budgetHit ? ' Συνεχίζει στην επόμενη εκτέλεση.' : ''}`);
  buildReport();
}

if (require.main === module) {
  main().catch(e => { log('ΣΦΑΛΜΑ:', e.stack || e.message); process.exitCode = 1; })
    .finally(() => setTimeout(() => process.exit(process.exitCode || 0), 3000).unref());
}
module.exports = { emulate, buildReport, metrics, indexFixtures, rebuildTeamIndex, setCutoff: v => { CUTOFF = v; }, realApi, prefetchStats, cachedStats };
