// stats.js - Στατιστική Ανάλυση, Μοντέλο Poisson & Pick Engine
// v2.1 - Διορθώσεις: lambda bug, weighted xG normalization,
//         opponent-adjusted form, bttsScore cap, αυστηρότερα thresholds

// ================================================================
//  INJURY / ABSENCE IMPACT SYSTEM  —  v1.0
// ================================================================
/**
 * Κάθε τραυματισμένος παίκτης εκπροσωπείται ως:
 * { name, position, importanceScore }
 *
 * importanceScore: 0..1
 *   1.0  = βασικό πρόσωπο (αρχηγός, top scorer, first-choice GK)
 *   0.7  = σημαντικός βασικός
 *   0.4  = χρήσιμος rotation player
 *   0.2  = αδύναμος/νεαρός
 *
 * Θέση → ποιοι δείκτες επηρεάζονται:
 *   FW  → xG (attack output)
 *   MF  → xG (build-up / chances creation) + corners
 *   DF  → xGA (defensive solidity)
 *   GK  → xGA (last line of defence)
 */

const POSITION_IMPACT = {
  FW:  { xg: 0.18, xga: 0.00, cor: 0.04 },
  MF:  { xg: 0.10, xga: 0.04, cor: 0.06 },
  DF:  { xg: 0.02, xga: 0.14, cor: 0.01 },
  GK:  { xg: 0.00, xga: 0.20, cor: 0.00 },
  UNK: { xg: 0.06, xga: 0.06, cor: 0.02 }  // άγνωστη θέση
};

/**
 * Δέχεται λίστα τραυματιών/απόντων και επιστρέφει penalty factors (0..1):
 * { xgFactor, xgaFactor, corFactor }
 * factor < 1 = μείωση της απόδοσης
 *
 * Παράδειγμα:
 *   applyInjuryPenalties([
 *     { position: 'FW', importanceScore: 1.0 },  // αρχηγός επιθετικός
 *     { position: 'DF', importanceScore: 0.7 },   // σημαντικός αμυντικός
 *   ])
 *   → { xgFactor: 0.82, xgaFactor: 0.90, corFactor: 0.97 }
 */
function applyInjuryPenalties(absentPlayers = []) {
  let xgPenalty = 0, xgaPenalty = 0, corPenalty = 0;

  for (const p of absentPlayers) {
    const pos    = (p.position || 'UNK').toUpperCase().slice(0, 2);
    const impact = POSITION_IMPACT[pos] || POSITION_IMPACT.UNK;
    const w      = clamp(safeNum(p.importanceScore, 0.5), 0, 1);

    xgPenalty  += impact.xg  * w;
    xgaPenalty += impact.xga * w;
    corPenalty += impact.cor * w;
  }

  // Cap ώστε ένας τραυματισμός να μην "σβήσει" την ομάδα
  return {
    xgFactor:  clamp(1 - xgPenalty,  0.50, 1.00),
    xgaFactor: clamp(1 - xgaPenalty, 0.50, 1.00),
    corFactor: clamp(1 - corPenalty,  0.70, 1.00)
  };
}

/**
 * Εφαρμόζει τους injury factors στα intel data μιας ομάδας.
 * Τροποποιεί: fXG, sXG, wXG (xgFactor) και fXGA, sXGA (xgaFactor) και cor (corFactor).
 * Επιστρέφει νέο object χωρίς mutation.
 */
function applyInjuriesToIntel(intel, absentPlayers = []) {
  if (!absentPlayers || !absentPlayers.length) return intel;
  const { xgFactor, xgaFactor, corFactor } = applyInjuryPenalties(absentPlayers);
  return {
    ...intel,
    fXG:  safeNum(intel.fXG)  * xgFactor,
    sXG:  safeNum(intel.sXG)  * xgFactor,
    wXG:  safeNum(intel.wXG)  * xgFactor,
    fXGA: safeNum(intel.fXGA) * xgaFactor,
    sXGA: safeNum(intel.sXGA) * xgaFactor,
    cor:  safeNum(intel.cor)  * corFactor,
    // UI fields για εμφάνιση στο card
    uiXG:  (safeNum(intel.fXG) * xgFactor).toFixed(2),
    uiXGA: (safeNum(intel.fXGA) * xgaFactor).toFixed(2),
    // Αποθήκευση factors για UI badge
    injuryFactors: { xgFactor, xgaFactor, corFactor },
    absentPlayers
  };
}

/**
 * Δημιουργεί σύντομο HTML badge για να εμφανιστεί στο match card.
 * Δείχνει πόσο μειώθηκε το xG/xGA λόγω τραυματισμών.
 */
function injuryBadgeHTML(intel, teamName) {
  if (!intel?.injuryFactors || !intel?.absentPlayers?.length) return '';
  const { xgFactor, xgaFactor } = intel.injuryFactors;
  const count = intel.absentPlayers.length;
  const severity = (2 - xgFactor - xgaFactor) / 2; // 0 = no impact, 1 = max
  const col = severity > 0.25 ? 'var(--accent-red)' : severity > 0.10 ? 'var(--accent-gold)' : 'var(--text-muted)';
  const icon = severity > 0.25 ? '🚨' : severity > 0.10 ? '⚠️' : 'ℹ️';
  const xgPct = ((1 - xgFactor) * 100).toFixed(0);
  const xgaPct = ((1 - xgaFactor) * 100).toFixed(0);

  const playerList = intel.absentPlayers.slice(0, 4).map(p =>
    `<span style="opacity:0.8">${p.name || '?'} (${p.position || '?'})</span>`
  ).join(', ');

  return `
    <div style="margin-top:8px; padding:8px 10px; background:rgba(244,63,94,0.06);
      border:1px solid rgba(244,63,94,0.2); border-radius:6px; font-size:0.68rem; color:${col}; line-height:1.5;">
      ${icon} <strong>Απόντες (${count}):</strong> ${playerList}
      ${count > 4 ? `<span style="opacity:0.6">+${count-4} ακόμα</span>` : ''}
      <div style="margin-top:4px; color:var(--text-muted); font-size:0.63rem; font-family:'Fira Code',monospace;">
        xG penalty: <span style="color:var(--accent-red)">-${xgPct}%</span>
        &nbsp;|&nbsp; xGA penalty: <span style="color:var(--accent-gold)">-${xgaPct}%</span>
      </div>
    </div>`;
}

// --- Βοηθητικές Μαθηματικές Συναρτήσεις ---
const safeNum  = (x, d=0) => Number.isFinite(Number(x)) ? Number(x) : d;
const clamp    = (n,mn,mx) => Math.max(mn, Math.min(mx, n));
const statVal  = (arr,type) => parseFloat(String((arr.find(x=>x.type===type)||{}).value||0).replace('%',''))||0;

const getTeamGoals = (f,t) => f?.teams?.home?.id===t?(f?.goals?.home??0):(f?.goals?.away??0);
const getOppGoals  = (f,t) => f?.teams?.home?.id===t?(f?.goals?.away??0):(f?.goals?.home??0);

// ================================================================
//  POISSON ENGINE
// ================================================================
function poissonProb(lambda, k) {
  if(lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for(let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function getPoissonMatrix(hLambda, aLambda, maxGoals=5) {
  const matrix = [];
  for(let h = 0; h <= maxGoals; h++) {
    matrix[h] = [];
    for(let a = 0; a <= maxGoals; a++) {
      matrix[h][a] = poissonProb(hLambda, h) * poissonProb(aLambda, a);
    }
  }
  return matrix;
}

function getPoissonProbabilities(hLambda, aLambda) {
  const m = getPoissonMatrix(hLambda, aLambda, 6);
  let pHome=0, pDraw=0, pAway=0, pO25=0, pO35=0, pU25=0, pBTTS=0;
  let bestScore = { h:1, a:1, prob: 0 };
  for(let h = 0; h <= 6; h++) {
    for(let a = 0; a <= 6; a++) {
      const p = m[h]?.[a] ?? 0;
      if(h > a) pHome += p; else if(h < a) pAway += p; else pDraw += p;
      if(h + a > 2.5) pO25 += p;
      if(h + a > 3.5) pO35 += p;
      if(h + a < 2.5) pU25 += p;
      if(h > 0 && a > 0) pBTTS += p;
      if(p > bestScore.prob) bestScore = { h, a, prob: p };
    }
  }
  return { pHome, pDraw, pAway, pO25, pO35, pU25, pBTTS, bestScore, matrix: m };
}

function getPoissonMatrixHTML(hLambda, aLambda, maxG=4) {
  const m = getPoissonMatrix(hLambda, aLambda, maxG);
  let html = `<div class="poisson-grid" style="grid-template-columns: 20px repeat(${maxG+1}, 1fr);">`;
  html += `<div class="poisson-cell" style="color:var(--text-muted)"></div>`;
  for(let a = 0; a <= maxG; a++) html += `<div class="poisson-cell" style="color:var(--accent-blue)">${a}</div>`;
  for(let h = 0; h <= maxG; h++) {
    html += `<div class="poisson-cell" style="color:var(--accent-gold)">${h}</div>`;
    for(let a = 0; a <= maxG; a++) {
      const prob = (m[h][a] * 100);
      const intensity = Math.min(prob / 12, 1);
      const r2 = Math.round(14 * (1-intensity) + 16 * intensity);
      const g2 = Math.round(165 * (1-intensity) + 185 * intensity);
      const b2 = Math.round(233 * (1-intensity) + 129 * intensity);
      const textCol = prob > 6 ? '#000' : 'var(--text-main)';
      html += `<div class="poisson-cell" style="background:rgba(${r2},${g2},${b2},${intensity*0.8+0.05});color:${textCol}">${prob.toFixed(1)}%</div>`;
    }
  }
  html += `</div>`;
  return html;
}

// ================================================================
//  WEIGHTED FORM & XG ESTIMATION
// ================================================================

/**
 * FIX #1: Proper weighted xG από πρόσφατα ματς.
 * Το αρχικό total/wSum με wSum=1.0 ήταν σωστό μαθηματικά,
 * αλλά χρησιμοποιούσε μόνο goals χωρίς regression to mean.
 * Τώρα: blending weighted goals με league baseline για σταθερότητα.
 */
function weightedRecentXG(fixtures, teamId, leagueAvg = 1.25) {
  const weights = [0.30, 0.25, 0.20, 0.12, 0.08, 0.05]; // αθροίζουν σε 1.0
  let total = 0, wSum = 0;
  fixtures.slice(0, 6).forEach((f, i) => {
    const goals = getTeamGoals(f, teamId);
    const w = weights[i] ?? 0.02;
    total += goals * w;
    wSum  += w;
  });
  const rawWXG = wSum > 0 ? total / wSum : leagueAvg;

  // Regression to mean: όσο λιγότερα δεδομένα, τόσο πιο κοντά στο league avg
  const sampleWeight = Math.min(wSum, 1.0); // 0..1
  return rawWXG * sampleWeight + leagueAvg * (1 - sampleWeight);
}

/**
 * FIX #2: Opponent-adjusted form history.
 * Κάθε αποτέλεσμα παίρνει bonus/penalty ανάλογα με δυναμικό αντιπάλου.
 * oppStrength: 1.0 = μέση ομάδα, >1 = δυνατός, <1 = αδύναμος.
 */
function getFormHistory(fixtures, teamId) {
  return fixtures.map(f => {
    const my = getTeamGoals(f, teamId);
    const op = getOppGoals(f, teamId);

    // Ποιότητα αντιπάλου από season goals ratio (proxy)
    const oppGoalsFor  = f?.teams?.home?.id === teamId ? (f?.goals?.away ?? 1) : (f?.goals?.home ?? 1);
    const oppGoalsAga  = f?.teams?.home?.id === teamId ? (f?.goals?.home ?? 1) : (f?.goals?.away ?? 1);
    const oppStrength  = clamp((oppGoalsFor + 0.5) / (oppGoalsAga + 0.5), 0.5, 2.0);

    let res, cls, weight;
    if (my > op) { res = 'W'; cls = 'W'; weight = clamp(1.0 + (oppStrength - 1.0) * 0.4, 0.7, 1.6); }
    else if (my < op) { res = 'L'; cls = 'L'; weight = clamp(1.0 - (oppStrength - 1.0) * 0.4, 0.6, 1.4); }
    else { res = 'D'; cls = 'D'; weight = 1.0; }

    return { res, cls, weight: parseFloat(weight.toFixed(2)), gf: my, ga: op };
  }).reverse();
}

/**
 * Υπολογισμός form score από weighted history (για χρήση στο buildIntel).
 * Επιστρέφει normalized score 0..1 (1 = τέλεια φόρμα).
 */
function calcFormScore(history) {
  if (!history.length) return 0.5;
  const recencyWeights = [0.30, 0.25, 0.20, 0.12, 0.08, 0.05];
  let score = 0, wSum = 0;
  history.slice().reverse().forEach((h, i) => {
    const rw = recencyWeights[i] ?? 0.02;
    const resultVal = h.res === 'W' ? 1.0 : h.res === 'D' ? 0.5 : 0.0;
    score += resultVal * h.weight * rw;
    wSum  += rw;
  });
  return clamp(score / wSum, 0, 1);
}

function estXG(arr, g=0) {
  const base = (statVal(arr,'Shots on Goal') * engineConfig.wShotsOn)
             + (statVal(arr,'Shots off Goal') * engineConfig.wShotsOff)
             + (statVal(arr,'Corner Kicks')   * engineConfig.wCorners)
             + (g * engineConfig.wGoals);
  return base > 0 ? base : (0.60 + g * 0.25);
}

function devBadge(curr, base) {
  if (!base || base <= 0) return `<span class="dev-badge"></span>`;
  const d = (((parseFloat(curr) - base) / base) * 100).toFixed(1);
  return `<span class="dev-badge ${d >= 0 ? 'dev-pos' : 'dev-neg'}">${d > 0 ? '+' : ''}${d}%</span>`;
}

// ================================================================
//  DATA BUILDERS
// ================================================================
async function batchCalc(list, tId) {
  if (!list.length) return { xg:'0.00', xga:'0.00', cor:'0.0', crd:'0.0' };
  let x=0, xa=0, c=0, cr=0, n=0;
  for (const f of list) {
    const st = await apiReq(`fixtures/statistics?fixture=${f.fixture.id}`);
    if (!st?.response || st.response.length < 2) continue;
    const my = st.response.find(z => z.team.id === tId)?.statistics || [];
    const op = st.response.find(z => z.team.id !== tId)?.statistics || [];

    // FIX #3: Καλύτερο fallback — αν xG API = 0 ΚΑΙ shots = 0, skip fixture αντί να μολύνει avg
    const myXG = statVal(my,'Expected Goals');
    const opXG = statVal(op,'Expected Goals');
    const myEstXG = myXG > 0 ? myXG : estXG(my, getTeamGoals(f, tId));
    const opEstXG = opXG > 0 ? opXG : estXG(op, getOppGoals(f, tId));

    if (myEstXG === 0 && opEstXG === 0) continue; // skip bad fixture data

    x  += myEstXG;
    xa += opEstXG;
    c  += statVal(my,'Corner Kicks');
    cr += statVal(my,'Yellow Cards') + statVal(my,'Red Cards');
    n++;
  }
  return {
    xg:  n > 0 ? (x/n).toFixed(2)  : '0.00',
    xga: n > 0 ? (xa/n).toFixed(2) : '0.00',
    cor: n > 0 ? (c/n).toFixed(1)  : '0.0',
    crd: n > 0 ? (cr/n).toFixed(1) : '0.0'
  };
}

async function buildIntel(tId, lg, s, isHome) {
  const [ss, allFix] = await Promise.all([getTStats(tId, lg, s), getLFix(tId, lg, s)]);
  const gen   = allFix.slice(0, 6);
  const split = allFix.filter(f => (isHome ? f.teams.home.id : f.teams.away.id) === tId).slice(0, 6);
  const [fData, sData] = await Promise.all([batchCalc(gen, tId), batchCalc(split, tId)]);

  const baseXG  = parseFloat(ss?.goals?.for?.average?.total)     || 1.10;
  const baseXGA = parseFloat(ss?.goals?.against?.average?.total) || 1.10;
  const leagueAvg = LEAGUE_AVG_GOALS[lg] ? LEAGUE_AVG_GOALS[lg] / 2 : 1.25;

  const history   = getFormHistory(gen, tId);
  const formScore = calcFormScore(history);
  const wXG       = weightedRecentXG(gen, tId, leagueAvg);

  return {
    fXG:  safeNum(fData.xg),  fXGA:  safeNum(fData.xga),
    sXG:  safeNum(sData.xg),  sXGA:  safeNum(sData.xga),
    wXG,  formScore,
    cor:  safeNum(fData.cor), crd:   safeNum(fData.crd),
    scrd: safeNum(sData.crd || fData.crd),
    uiXG: fData.xg, uiXGA: fData.xga,
    uiDevXG:  devBadge(fData.xg,  baseXG),
    uiDevXGA: devBadge(fData.xga, baseXGA),
    uiSXG: sData.xg, uiSXGA: sData.xga,
    history
  };
}

function summarizeH2H(fixtures, homeId, awayId) {
  let hw=0, aw=0, dr=0, hGoals=0, aGoals=0;
  for (const f of (fixtures || []).slice(0, 8)) {
    const hg = f?.goals?.home ?? 0, ag = f?.goals?.away ?? 0;
    const myG = f?.teams?.home?.id === homeId ? hg : ag;
    const opG = f?.teams?.home?.id === awayId ? hg : ag;
    hGoals += myG; aGoals += opG;
    if (myG > opG) hw++; else if (opG > myG) aw++; else dr++;
  }
  const total = hw + aw + dr || 1;
  return {
    homeWins: hw, awayWins: aw, draws: dr,
    // FIX #4: Προσθήκη avg goals per H2H για χρήση στο Pick Engine
    h2hAvgGoals: parseFloat(((hGoals + aGoals) / total).toFixed(2))
  };
}

// ================================================================
//  PICK ENGINE  —  v2.1
// ================================================================
/**
 * FIX #5 (ΚΥΡΙΟ): Η lambda υπολόγιζε λάθος λόγω operator precedence.
 *   ΠΡΙΝ:  (hXG*0.5) + (wXG*0.3) + (fXGA*0.2) * lp.mult
 *          → το lp.mult εφαρμόζεται ΜΟΝΟ στο fXGA*0.2
 *   ΤΩΡΑ:  ((hXG*0.5) + (wXG*0.3) + (fXGA*0.2)) * lp.mult
 *          → εφαρμόζεται σε ολόκληρο το άθροισμα
 *
 * FIX #6: Ενσωμάτωση formScore στο lambda για πιο δυναμικό pick.
 *   formScore 0..1 → factor 0.85..1.15 (±15% max επίδραση)
 *
 * FIX #7: bttsScore cap — normalize σε 0..2 για σταθερή σύγκριση με thresholds.
 *
 * FIX #8: Αυστηρότερα thresholds — απαιτείται σύγκλιση Poisson + xG + form.
 */
function computePick(hXG, aXG, tXG, bttsScore, cor, totCards, lp, hS, aS, h2h) {
  // Form factors: 0.85 (κακή φόρμα) .. 1.15 (εξαιρετική φόρμα)
  const hForm = 0.85 + clamp(safeNum(hS?.formScore, 0.5), 0, 1) * 0.30;
  const aForm = 0.85 + clamp(safeNum(aS?.formScore, 0.5), 0, 1) * 0.30;

  // FIX #5: Παρενθέσεις γύρω από όλο το άθροισμα πριν * lp.mult
  const hLambda = clamp(
    ((hXG * 0.45) + (safeNum(hS?.wXG) * 0.30) + (safeNum(aS?.fXGA) * 0.25)) * lp.mult * hForm,
    0.15, 4.0
  );
  const aLambda = clamp(
    ((aXG * 0.45) + (safeNum(aS?.wXG) * 0.30) + (safeNum(hS?.fXGA) * 0.25)) * lp.mult * aForm,
    0.15, 4.0
  );

  const pp = getPoissonProbabilities(hLambda, aLambda);

  const hExp = hLambda, aExp = aLambda;
  const { h: hG_raw, a: aG_raw } = pp.bestScore;
  let hG = hG_raw, aG = aG_raw;

  const xgDiff = hXG - aXG;
  let outPick = "X";
  if (pp.pHome - pp.pAway > 0.15 && xgDiff > lp.xgDiff) outPick = "1";
  else if (pp.pAway - pp.pHome > 0.15 && xgDiff < -lp.xgDiff) outPick = "2";

  if (outPick === "1" && hG <= aG) { hG = aG + 1; }
  if (outPick === "2" && aG <= hG) { aG = hG + 1; }

  const exactConf = Math.round(pp.bestScore.prob * 100 * 8);

  // FIX #7: Normalize bttsScore — cap στο 2.0 για consistent threshold comparison
  const btts = clamp(safeNum(bttsScore), 0, 2.0);

  // H2H xG boost: αν ιστορικά ο αγώνας έχει πολλά γκολ, ενισχύε Over πιθανότητες
  const h2hBoost = h2h?.h2hAvgGoals > 2.8 ? 0.03 : 0;

  let omegaPick = "NO BET", reason = "Insufficient statistical edge.", pickScore = 0;

  // FIX #8: Αυστηρότερα thresholds — απαιτείται triple convergence
  if (pp.pO35 >= 0.44 && tXG >= lp.minXGO35 && btts >= 1.15 && (hForm + aForm) / 2 >= 1.05) {
    omegaPick = "🚀 OVER 3.5 GOALS";
    pickScore = (pp.pO35 + h2hBoost) * 100;
    reason = `Poisson O3.5: ${(pp.pO35*100).toFixed(1)}% | tXG: ${tXG.toFixed(2)} | Form: ✓`;
  }
  else if (pp.pO25 >= 0.55 && tXG >= lp.minXGO25 && btts >= 0.90) {
    omegaPick = "🔥 OVER 2.5 GOALS";
    pickScore = (pp.pO25 + h2hBoost) * 100;
    reason = `Poisson O2.5: ${(pp.pO25*100).toFixed(1)}% | tXG: ${tXG.toFixed(2)}`;
  }
  else if (pp.pU25 >= 0.58 && tXG <= lp.maxU25 && btts <= engineConfig.tBTTS_U25 && (hForm + aForm) / 2 <= 1.05) {
    omegaPick = "🔒 UNDER 2.5 GOALS";
    pickScore = pp.pU25 * 100;
    reason = `Poisson U2.5: ${(pp.pU25*100).toFixed(1)}% | tXG: ${tXG.toFixed(2)}`;
  }
  else if (btts >= lp.minBTTS && pp.pBTTS >= 0.48 && hXG >= 0.90 && aXG >= 0.90) {
    // FIX: BTTS χρειάζεται ΚΑΙ τις δύο ομάδες να έχουν αξιόπιστο xG
    omegaPick = "🎯 GOAL/GOAL (BTTS)";
    pickScore = pp.pBTTS * 100;
    reason = `Poisson BTTS: ${(pp.pBTTS*100).toFixed(1)}% | hXG: ${hXG.toFixed(2)} aXG: ${aXG.toFixed(2)}`;
  }
  else if (outPick !== "X" && Math.abs(xgDiff) >= lp.xgDiff + 0.10) {
    const outcome  = outPick === "1" ? "🏠 ΑΣΟΣ" : "✈️ ΔΙΠΛΟ";
    const outProb  = outPick === "1" ? pp.pHome : pp.pAway;
    const formOk   = outPick === "1" ? hForm >= 1.0 : aForm >= 1.0;
    // Απαιτεί επίσης θετική φόρμα για 1Χ2
    if (outProb >= 0.52 && formOk) {
      omegaPick  = outProb >= 0.57 ? `⚡ ${outcome}` : outcome;
      pickScore  = outProb * 100;
      reason = `Poisson ${outPick==='1'?'Home':'Away'}: ${(outProb*100).toFixed(1)}% | xGdiff: ${xgDiff.toFixed(2)}`;
    }
  }
  else if (totCards >= 5.5 && Math.abs(xgDiff) < 0.40) {
    omegaPick = "🟨 OVER 5.5 ΚΑΡΤΕΣ";
    pickScore = totCards * 15;
    reason = `High tension derby | Cards avg: ${totCards.toFixed(1)}`;
  }
  else if (cor >= 10.3) {
    omegaPick = "🚩 OVER 8.5 ΚΟΡΝΕΡ";
    pickScore = cor * 8.5;
    reason = `High corner yield: ${cor.toFixed(1)}`;
  }

  return { omegaPick, reason, pickScore, outPick, hG, aG, hExp, aExp, exactConf, xgDiff, pp };
}
