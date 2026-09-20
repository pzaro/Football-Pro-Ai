'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { URL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const LOG_DIR = path.join(ROOT, 'logs');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const txt = fs.readFileSync(file, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv(path.join(ROOT, '.env'));

const PORT = Number(process.env.APEX_PORT || 8787);
const HOST = process.env.APEX_HOST || '127.0.0.1';
const API_BASE = 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY || '';
const HEADLESS_ENABLED = !['0', 'false', 'no'].includes(String(process.env.APEX_HEADLESS || '1').toLowerCase());
const BG_PIN = process.env.APEX_PIN || '106014';

const LS_PREDS = 'omega_preds_v5.0';
const SYNC_KEYS = [
  'omega_preds_v5.0',
  'omega_settings_v5.0',
  'omega_lgmods_v5.0',
  'omega_bankroll_v5.0',
  'omega_postmatch_range_v5.0',
  'omega_live_alerts_v5.0',
  'omega_my_leagues_v5.0',
  'omega_adaptive_precision_model_v5.5',
  'omega_adaptive_precision_settings_v5.5',
  'omega_adaptive_precision_log_v5.5',
  'omega_betjournal_v5.0',
  'omega_sheets_url_v5.0',
  'omega_calib_log_v5.0',
  'omega_self_improve_state_v5.0',
  'omega_last_calib_ts'
];

const db = new DatabaseSync(path.join(DATA_DIR, 'apex.sqlite'));
db.exec(`
  PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS kv_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS engine_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    payload TEXT,
    created_at INTEGER NOT NULL
  );
`);

const stmtGet = db.prepare('SELECT value, updated_at FROM kv_state WHERE key = ?');
const stmtAll = db.prepare('SELECT key, value, updated_at FROM kv_state');
const stmtSet = db.prepare(`INSERT INTO kv_state(key,value,updated_at) VALUES(?,?,?)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`);
const stmtDelete = db.prepare('DELETE FROM kv_state WHERE key = ?');
const stmtEvent = db.prepare('INSERT INTO engine_events(type,payload,created_at) VALUES(?,?,?)');

function nowMs() { return Date.now(); }
function stateGet(key, fallback = null) {
  const row = stmtGet.get(key);
  if (!row) return fallback;
  return row.value;
}
function stateSet(key, value) {
  if (value === null || value === undefined) {
    stmtDelete.run(key);
    return;
  }
  stmtSet.run(key, String(value), nowMs());
}
function stateAll() {
  const out = {};
  for (const row of stmtAll.all()) out[row.key] = { value: row.value, updatedAt: row.updated_at };
  return out;
}
function jsonGet(key, fallback) {
  try { return JSON.parse(stateGet(key, '')); } catch { return fallback; }
}
function jsonSet(key, value) { stateSet(key, JSON.stringify(value)); }
function logEvent(type, payload = {}) {
  try { stmtEvent.run(type, JSON.stringify(payload), nowMs()); } catch {}
}
function logLine(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')}\n`;
  fs.appendFileSync(path.join(LOG_DIR, 'apex-background.log'), line);
  process.stdout.write(line);
}

const DEFAULT_ENGINE_CONFIG = {
  enabled: true,
  autoScanEnabled: false,
  scanIntervalMinutes: 180,
  resultsIntervalSeconds: 60,
  oddsIntervalMinutes: 10,
  learnIntervalMinutes: 60,
  scanMode: 'REMAINING',
  scanStart: '',
  scanStartTime: '',
  scanEnd: '',
  scanEndTime: '23:59',
  leagueIds: [],
  updatedAt: null
};
function engineConfig() {
  return { ...DEFAULT_ENGINE_CONFIG, ...jsonGet('__engine_config__', {}) };
}
function saveEngineConfig(patch) {
  const cfg = { ...engineConfig(), ...patch, updatedAt: new Date().toISOString() };
  cfg.scanIntervalMinutes = Math.max(15, Math.min(1440, Number(cfg.scanIntervalMinutes) || 180));
  cfg.resultsIntervalSeconds = Math.max(60, Math.min(3600, Number(cfg.resultsIntervalSeconds) || 60));
  cfg.oddsIntervalMinutes = Math.max(5, Math.min(360, Number(cfg.oddsIntervalMinutes) || 10));
  cfg.learnIntervalMinutes = Math.max(30, Math.min(1440, Number(cfg.learnIntervalMinutes) || 60));
  cfg.leagueIds = Array.isArray(cfg.leagueIds) ? cfg.leagueIds.map(Number).filter(Number.isFinite) : [];
  jsonSet('__engine_config__', cfg);
  return cfg;
}
if (!stateGet('__engine_config__')) saveEngineConfig(DEFAULT_ENGINE_CONFIG);

const runtime = {
  startedAt: new Date().toISOString(),
  headless: { available: false, running: false, browser: null, lastError: null, lastReadyAt: null },
  jobs: { results: null, scan: null, odds: null, learn: null },
  currentJob: null,
  lastError: null,
  api: { lastHttp: null, lastPath: null, lastAt: null }
};

function publicRuntimeStatus() {
  return {
    online: true,
    pid: process.pid,
    startedAt: runtime.startedAt,
    headless: {
      available: runtime.headless.available,
      running: runtime.headless.running,
      browser: runtime.headless.browser,
      lastError: runtime.headless.lastError,
      lastReadyAt: runtime.headless.lastReadyAt
    },
    jobs: runtime.jobs,
    currentJob: runtime.currentJob,
    lastError: runtime.lastError,
    config: engineConfig(),
    api: runtime.api,
    currentScanCount: (jsonGet('__current_scan__', []) || []).length,
    vaultCount: (jsonGet(LS_PREDS, []) || []).length
  };
}

function readBody(req, max = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', c => {
      n += c.length;
      if (n > max) { reject(new Error('Payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
  res.end(body);
}
function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({ '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.ico':'image/x-icon', '.png':'image/png', '.svg':'image/svg+xml' })[ext] || 'application/octet-stream';
}
function safeScriptJson(x) { return JSON.stringify(x).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e'); }

async function footballRequest(apiPath) {
  if (!API_KEY) throw new Error('API_FOOTBALL_KEY is missing from .env');
  const clean = String(apiPath || '').replace(/^\/+/, '');
  const url = `${API_BASE}/${clean}`;
  const r = await fetch(url, { headers: { 'x-apisports-key': API_KEY, 'Accept': 'application/json' } });
  const txt = await r.text();
  let data = null;
  try { data = JSON.parse(txt); } catch { data = { response: [], errors: { proxy: 'Invalid JSON from API-Football' } }; }
  runtime.api = { lastHttp: r.status, lastPath: clean, lastAt: new Date().toISOString() };
  if (!r.ok) {
    const e = new Error(`API-Football HTTP ${r.status}`);
    e.status = r.status;
    e.data = data;
    throw e;
  }
  return { data, headers: r.headers, status: r.status };
}

function isFinishedStatus(s) { return ['FT','AET','PEN','AWD','WO'].includes(String(s || '').toUpperCase()); }
function statVal(stats, type) {
  const row = (stats || []).find(x => String(x?.type || '').toLowerCase() === String(type).toLowerCase());
  let v = row?.value;
  if (typeof v === 'string') v = v.replace('%','').trim();
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function buildActStats(statResponse, goals) {
  const arr = Array.isArray(statResponse) ? statResponse : [];
  const h = arr[0]?.statistics || [], a = arr[1]?.statistics || [];
  const gh = Number(goals?.home), ga = Number(goals?.away);
  const out = {
    hPoss: statVal(h,'Ball Possession'), aPoss: statVal(a,'Ball Possession'),
    hCor: statVal(h,'Corner Kicks'), aCor: statVal(a,'Corner Kicks'),
    hCrd: statVal(h,'Yellow Cards') + statVal(h,'Red Cards'),
    aCrd: statVal(a,'Yellow Cards') + statVal(a,'Red Cards'),
    hXg: statVal(h,'expected_goals'), aXg: statVal(a,'expected_goals'),
    hOff: statVal(h,'Offsides'), aOff: statVal(a,'Offsides'),
    hSoT: statVal(h,'Shots on Goal'), aSoT: statVal(a,'Shots on Goal'),
    hFoul: statVal(h,'Fouls'), aFoul: statVal(a,'Fouls')
  };
  out.totCor = out.hCor + out.aCor;
  out.totCrd = out.hCrd + out.aCrd;
  out.totOff = out.hOff + out.aOff;
  out.totGoals = (Number.isFinite(gh)?gh:0) + (Number.isFinite(ga)?ga:0);
  out.btts = gh > 0 && ga > 0;
  return out;
}

let resultSyncBusy = false;
async function syncVaultResults() {
  if (resultSyncBusy) return { skipped: true };
  resultSyncBusy = true;
  runtime.currentJob = 'results';
  try {
    const store = jsonGet(LS_PREDS, []);
    if (!Array.isArray(store) || !store.length) return { updated: 0, finished: 0 };
    const now = Date.now();
    const due = store.filter(r => {
      if (!r?.fixtureId) return false;
      if (isFinishedStatus(r.pmStatus) && Number.isFinite(Number(r.pmActualHome)) && Number.isFinite(Number(r.pmActualAway))) return false;
      const t = Date.parse(r.date || '');
      return Number.isFinite(t) && t <= now + 10 * 60 * 1000 && t >= now - 5 * 86400000;
    });
    if (!due.length) return { updated: 0, finished: 0 };
    const dates = [...new Set(due.map(r => String(r.date || '').slice(0,10)).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)))].slice(-5);
    const fresh = new Map();
    for (const date of dates) {
      const { data } = await footballRequest(`fixtures?date=${encodeURIComponent(date)}`);
      for (const f of data?.response || []) fresh.set(String(f?.fixture?.id), f);
    }
    let updated = 0, finished = 0;
    const finalStats = new Map();
    for (const r of store) {
      const f = fresh.get(String(r.fixtureId));
      if (!f) continue;
      const st = f?.fixture?.status?.short || r.pmStatus || '';
      if (st) r.pmStatus = st;
      if (isFinishedStatus(st)) {
        const h = Number(f?.goals?.home), a = Number(f?.goals?.away);
        if (Number.isFinite(h) && Number.isFinite(a)) {
          const wasSettled = Number.isFinite(Number(r.pmActualHome)) && Number.isFinite(Number(r.pmActualAway));
          r.pmActualHome = h; r.pmActualAway = a; r.pmActualScore = `${h}-${a}`;
          r.actualResult = h > a ? '1' : h < a ? '2' : 'X';
          r.pmSettledAt = r.pmSettledAt || new Date().toISOString();
          updated++;
          if (!wasSettled) {
            finished++;
            try {
              const stats = await footballRequest(`fixtures/statistics?fixture=${encodeURIComponent(r.fixtureId)}`);
              r.pmActStats = buildActStats(stats.data?.response || [], f.goals || {});
              finalStats.set(String(r.fixtureId), r.pmActStats);
            } catch (e) { logLine('Final stats warning', r.fixtureId, e.message); }
          } else if (r.pmActStats) finalStats.set(String(r.fixtureId), r.pmActStats);
        }
      }
    }
    if (updated || finished) {
      jsonSet(LS_PREDS, store);
      // Keep the persisted dashboard cards in sync as well. This is what makes
      // FT score + settled-market colors visible immediately when the UI is reopened.
      const current = jsonGet('__current_scan__', []);
      if (Array.isArray(current) && current.length) {
        let scanChanged = 0;
        for (const d of current) {
          const id = String(d?.fixId ?? d?.m?.fixture?.id ?? '');
          const f = fresh.get(id);
          if (!f || !d?.m?.fixture) continue;
          d.m.fixture.status = f.fixture?.status || d.m.fixture.status;
          d.m.goals = f.goals || d.m.goals;
          if (f.score) d.m.score = f.score;
          const act = finalStats.get(id); if (act) d.actStats = act;
          scanChanged++;
        }
        if (scanChanged) jsonSet('__current_scan__', current);
      }
      logEvent('result_sync', { updated, finished });
      logLine(`Result sync: ${updated} updated, ${finished} newly finished`);
    }
    runtime.jobs.results = { at: new Date().toISOString(), ok: true, updated, finished };
    return { updated, finished };
  } catch (e) {
    runtime.lastError = e.message;
    runtime.jobs.results = { at: new Date().toISOString(), ok: false, error: e.message };
    logLine('Result sync ERROR', e.message);
    return { error: e.message };
  } finally {
    resultSyncBusy = false;
    runtime.currentJob = null;
  }
}

function findChromeExecutable() {
  const candidates = [];
  if (process.env.APEX_CHROME_PATH) candidates.push(process.env.APEX_CHROME_PATH);
  if (process.platform === 'win32') {
    const pf = process.env.PROGRAMFILES || 'C:\\Program Files';
    const pfx = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const la = process.env.LOCALAPPDATA || '';
    candidates.push(
      path.join(pf, 'Google','Chrome','Application','chrome.exe'),
      path.join(pfx, 'Google','Chrome','Application','chrome.exe'),
      path.join(la, 'Google','Chrome','Application','chrome.exe'),
      path.join(pf, 'Microsoft','Edge','Application','msedge.exe'),
      path.join(pfx, 'Microsoft','Edge','Application','msedge.exe')
    );
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else {
    candidates.push('/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/microsoft-edge');
  }
  return candidates.find(p => p && fs.existsSync(p)) || null;
}

let browserContext = null;
let bgPage = null;
let headlessStarting = null;
async function ensureHeadless() {
  if (!HEADLESS_ENABLED) return null;
  if (bgPage && !bgPage.isClosed()) return bgPage;
  if (headlessStarting) return headlessStarting;
  headlessStarting = (async () => {
    try {
      let playwright;
      try { playwright = require('playwright-core'); }
      catch { throw new Error('playwright-core is not installed. Run INSTALL_WINDOWS.bat / npm install.'); }
      const exe = findChromeExecutable();
      if (!exe) throw new Error('Chrome/Edge executable not found. Set APEX_CHROME_PATH in .env.');
      browserContext = await playwright.chromium.launchPersistentContext(path.join(DATA_DIR, 'headless-profile'), {
        headless: true,
        executablePath: exe,
        viewport: { width: 1440, height: 1100 },
        args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']
      });
      bgPage = browserContext.pages()[0] || await browserContext.newPage();
      bgPage.on('console', msg => {
        if (['error','warning'].includes(msg.type())) logLine(`Headless console ${msg.type()}:`, msg.text());
      });
      bgPage.on('pageerror', err => logLine('Headless page error:', err.message));
      await bgPage.goto(`http://127.0.0.1:${PORT}/?background=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await bgPage.waitForFunction(() => typeof window.runScan === 'function' && !!document.getElementById('pin'), { timeout: 60000 });
      await bgPage.evaluate(pin => {
        const el = document.getElementById('pin');
        el.value = pin;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, BG_PIN);
      await bgPage.waitForFunction(() => document.getElementById('app')?.style.display !== 'none', { timeout: 30000 });
      await bgPage.waitForFunction(() => !!window.APEX_BG, { timeout: 30000 });
      try { await bgPage.evaluate(() => window.APEX_BG.restoreCurrentScan?.()); } catch {}
      runtime.headless = { available: true, running: true, browser: path.basename(exe), lastError: null, lastReadyAt: new Date().toISOString() };
      logLine('Headless engine ready:', exe);
      return bgPage;
    } catch (e) {
      runtime.headless.available = false;
      runtime.headless.running = false;
      runtime.headless.lastError = e.message;
      logLine('Headless engine unavailable:', e.message);
      try { if (browserContext) await browserContext.close(); } catch {}
      browserContext = null; bgPage = null;
      return null;
    } finally { headlessStarting = null; }
  })();
  return headlessStarting;
}

async function applyConfigToHeadless(page, cfg) {
  await page.evaluate(async cfg => {
    const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) { el.value = String(val); el.dispatchEvent(new Event('change', { bubbles: true })); } };
    set('scanMode', cfg.scanMode || 'REMAINING');
    set('scanStart', cfg.scanStart || '');
    set('scanStartTime', cfg.scanStartTime || '');
    set('scanEnd', cfg.scanEnd || '');
    set('scanEndTime', cfg.scanEndTime || '23:59');
    window.onScanModeChange?.(false);
    await window.refreshScanLeagueOptions?.(true);
    const wanted = new Set((cfg.leagueIds || []).map(Number));
    const boxes = [...document.querySelectorAll('#scanLeagueCheckboxes input[type="checkbox"]')];
    if (wanted.size) {
      for (const b of boxes) b.checked = wanted.has(Number(b.value));
    } else {
      for (const b of boxes) b.checked = true;
    }
  }, cfg);
}

let headlessJobBusy = false;
async function runHeadlessJob(kind, fn) {
  if (headlessJobBusy) return { skipped: true, reason: 'headless busy' };
  const page = await ensureHeadless();
  if (!page) return { skipped: true, reason: runtime.headless.lastError || 'headless unavailable' };
  headlessJobBusy = true;
  runtime.currentJob = kind;
  try {
    const result = await fn(page);
    runtime.jobs[kind] = { at: new Date().toISOString(), ok: true };
    return result || { ok: true };
  } catch (e) {
    runtime.jobs[kind] = { at: new Date().toISOString(), ok: false, error: e.message };
    runtime.lastError = e.message;
    logLine(`Headless ${kind} ERROR:`, e.message);
    return { error: e.message };
  } finally {
    headlessJobBusy = false;
    runtime.currentJob = null;
  }
}

async function backgroundScan(force=false) {
  const cfg = engineConfig();
  if (!cfg.enabled || (!cfg.autoScanEnabled && !force)) return { skipped: true, reason: 'auto scan disabled' };
  return runHeadlessJob('scan', async page => {
    await applyConfigToHeadless(page, cfg);
    logLine('Background scan started', { mode: cfg.scanMode, end: `${cfg.scanEnd} ${cfg.scanEndTime}`, leagues: cfg.leagueIds.length });
    await page.evaluate(async () => { await window.runScan(); await window.APEX_BG?.flushState?.(); });
    const n = await page.evaluate(() => (window.scannedMatchesData || []).length);
    logLine('Background scan completed', n, 'matches');
    return { ok: true, matches: n };
  });
}

async function backgroundOdds() {
  const cfg = engineConfig();
  if (!cfg.enabled) return { skipped: true };
  return runHeadlessJob('odds', async page => {
    await page.evaluate(async () => { await window.APEX_BG?.restoreCurrentScan?.(); await window.fetchAllOdds?.(true); await window.APEX_BG?.flushState?.(); });
    return { ok: true };
  });
}

async function backgroundLearn() {
  const cfg = engineConfig();
  if (!cfg.enabled) return { skipped: true };
  return runHeadlessJob('learn', async page => {
    await page.evaluate(async () => { await window.runHourlySelfImprove?.(false); await window.APEX_BG?.flushState?.(); });
    return { ok: true };
  });
}

const timers = {};
function scheduleJobs() {
  const clear = k => { if (timers[k]) clearInterval(timers[k]); timers[k] = null; };
  ['results','scan','odds','learn'].forEach(clear);
  const cfg = engineConfig();
  timers.results = setInterval(syncVaultResults, cfg.resultsIntervalSeconds * 1000);
  timers.scan = setInterval(backgroundScan, cfg.scanIntervalMinutes * 60000);
  timers.odds = setInterval(backgroundOdds, cfg.oddsIntervalMinutes * 60000);
  timers.learn = setInterval(backgroundLearn, cfg.learnIntervalMinutes * 60000);
  setTimeout(syncVaultResults, 3500);
  if (cfg.enabled) {
    setTimeout(() => ensureHeadless().catch(()=>{}), 2500);
    if (cfg.autoScanEnabled) setTimeout(backgroundScan, 12000);
  }
}

async function serveIndex(res) {
  const file = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const all = stateAll();
  const syncState = {};
  for (const k of SYNC_KEYS) if (all[k]) syncState[k] = all[k];
  const boot = { state: syncState, engine: publicRuntimeStatus(), generatedAt: Date.now() };
  const script = `<script>window.__APEX_SERVER_BOOT__=${safeScriptJson(boot)};try{for(const [k,r] of Object.entries(window.__APEX_SERVER_BOOT__.state||{})){if(r&&typeof r.value==='string')localStorage.setItem(k,r.value);}}catch(e){console.warn('[APEX BG] boot hydrate',e);}</script>`;
  html = html.replace('<!--APEX_SERVER_STATE-->', script);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

async function handler(req, res) {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(u.pathname);
  try {
    if (pathname === '/api/engine/status' && req.method === 'GET') return sendJson(res, 200, publicRuntimeStatus());
    if (pathname === '/api/engine/config' && req.method === 'GET') return sendJson(res, 200, engineConfig());
    if (pathname === '/api/engine/config' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req) || '{}');
      const cfg = saveEngineConfig(body || {});
      scheduleJobs();
      return sendJson(res, 200, { ok: true, config: cfg });
    }
    if (pathname === '/api/engine/run-now' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req) || '{}');
      const job = body.job || 'scan';
      let r;
      if (job === 'results') r = await syncVaultResults();
      else if (job === 'odds') r = await backgroundOdds();
      else if (job === 'learn') r = await backgroundLearn();
      else r = await backgroundScan(true);
      return sendJson(res, 200, { ok: !r?.error, result: r, status: publicRuntimeStatus() });
    }
    if (pathname === '/api/state' && req.method === 'GET') {
      const all = stateAll(); const out = {};
      for (const k of SYNC_KEYS) if (all[k]) out[k] = all[k];
      return sendJson(res, 200, { state: out, now: Date.now() });
    }
    if (pathname === '/api/state/key' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req) || '{}');
      const k = String(body.key || '');
      if (!SYNC_KEYS.includes(k)) return sendJson(res, 400, { error: 'Key not allowed' });
      if (body.value === null) stateSet(k, null); else stateSet(k, String(body.value ?? ''));
      return sendJson(res, 200, { ok: true, updatedAt: Date.now() });
    }
    if (pathname === '/api/state/bulk' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req) || '{}');
      for (const [k,v] of Object.entries(body.state || {})) if (SYNC_KEYS.includes(k)) stateSet(k, v === null ? null : String(v));
      return sendJson(res, 200, { ok: true });
    }
    if (pathname === '/api/current-scan' && req.method === 'GET') {
      return sendJson(res, 200, { data: jsonGet('__current_scan__', []), updatedAt: Number(stateAll().__current_scan__?.updatedAt || 0) });
    }
    if (pathname === '/api/current-scan' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req, 80 * 1024 * 1024) || '{}');
      if (!Array.isArray(body.data)) return sendJson(res, 400, { error: 'data must be an array' });
      jsonSet('__current_scan__', body.data);
      return sendJson(res, 200, { ok: true, count: body.data.length });
    }
    if (pathname.startsWith('/api/football/') && req.method === 'GET') {
      const apiPath = pathname.slice('/api/football/'.length) + u.search;
      try {
        const r = await footballRequest(apiPath);
        const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
        for (const h of ['x-ratelimit-requests-remaining','x-ratelimit-remaining']) {
          const v = r.headers.get(h); if (v) headers[h] = v;
        }
        res.writeHead(200, headers); res.end(JSON.stringify(r.data)); return;
      } catch (e) {
        return sendJson(res, e.status || 502, e.data || { errors: { proxy: e.message }, response: [] });
      }
    }
    if (pathname === '/' || pathname === '/index.html') return await serveIndex(res);

    const rel = pathname.replace(/^\/+/, '');
    const file = path.resolve(ROOT, rel || 'index.html');
    if (!file.startsWith(path.resolve(ROOT) + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': /\.(js|css)$/.test(file) ? 'no-cache' : 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    logLine('HTTP error', pathname, e.message);
    sendJson(res, 500, { error: e.message });
  }
}

const server = http.createServer(handler);
server.listen(PORT, HOST, () => {
  fs.writeFileSync(path.join(DATA_DIR, 'apex.pid'), String(process.pid));
  logLine(`APEX OMEGA v6.0 Background Engine listening on http://${HOST}:${PORT}`);
  scheduleJobs();
});

async function shutdown(signal) {
  logLine('Shutdown', signal);
  for (const t of Object.values(timers)) if (t) clearInterval(t);
  try { if (browserContext) await browserContext.close(); } catch {}
  try { fs.unlinkSync(path.join(DATA_DIR, 'apex.pid')); } catch {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', e => { runtime.lastError = e.message; logLine('uncaughtException', e.stack || e.message); });
process.on('unhandledRejection', e => { runtime.lastError = String(e?.message || e); logLine('unhandledRejection', e?.stack || e); });
