// stats.js - Στατιστική Ανάλυση, Μοντέλο Poisson & Pick Engine

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
function weightedRecentXG(fixtures, teamId) {
  const weights = [0.30, 0.25, 0.20, 0.12, 0.08, 0.05];
  let total = 0, wSum = 0;
  fixtures.slice(0, 6).forEach((f, i) => {
    const goals = getTeamGoals(f, teamId);
    total += goals * (weights[i] || 0.02);
    wSum += (weights[i] || 0.02);
  });
  return wSum > 0 ? total / wSum : 0;
}

function estXG(arr,g=0){
  return(statVal(arr,'Shots on Goal')*engineConfig.wShotsOn)+(statVal(arr,'Shots off Goal')*engineConfig.wShotsOff)+(statVal(arr,'Corner Kicks')*engineConfig.wCorners)+(g*engineConfig.wGoals)||0.60+g*0.25;
}

function getFormHistory(fixtures,teamId){
  return fixtures.map(f=>{
    const my=getTeamGoals(f,teamId),op=getOppGoals(f,teamId);
    return my>op?{res:'W',cls:'W'}:(my<op?{res:'L',cls:'L'}:{res:'D',cls:'D'});
  }).reverse();
}

function devBadge(curr,base){
  if(!base||base<=0)return`<span class="dev-badge"></span>`;
  const d=(((parseFloat(curr)-base)/base)*100).toFixed(1);
  return`<span class="dev-badge ${d>=0?'dev-pos':'dev-neg'}">${d>0?'+':''}${d}%</span>`;
}

// ================================================================
//  DATA BUILDERS (Χρησιμοποιούν τις API συναρτήσεις του index.html)
// ================================================================
async function batchCalc(list,tId){
  if(!list.length) return{xg:'0.00',xga:'0.00',cor:'0.0',crd:'0.0',scrd:'0.0'};
  let x=0,xa=0,c=0,cr=0,n=0;
  for(const f of list){
    const st=await apiReq(`fixtures/statistics?fixture=${f.fixture.id}`);
    if(!st?.response||st.response.length<2)continue;
    const my=st.response.find(z=>z.team.id===tId)?.statistics||[];
    const op=st.response.find(z=>z.team.id!==tId)?.statistics||[];
    x+=(statVal(my,'Expected Goals')||estXG(my,getTeamGoals(f,tId)));
    xa+=(statVal(op,'Expected Goals')||estXG(op,getOppGoals(f,tId)));
    c+=statVal(my,'Corner Kicks');cr+=statVal(my,'Yellow Cards')+statVal(my,'Red Cards');n++;
  }
  return{xg:n>0?(x/n).toFixed(2):'0.00',xga:n>0?(xa/n).toFixed(2):'0.00',cor:n>0?(c/n).toFixed(1):'0.0',crd:n>0?(cr/n).toFixed(1):'0.0'};
}

async function buildIntel(tId,lg,s,isHome){
  const[ss,allFix]=await Promise.all([getTStats(tId,lg,s),getLFix(tId,lg,s)]);
  const gen=allFix.slice(0,6);const split=allFix.filter(f=>(isHome?f.teams.home.id:f.teams.away.id)===tId).slice(0,6);
  const[fData,sData]=await Promise.all([batchCalc(gen,tId),batchCalc(split,tId)]);
  const baseXG=parseFloat(ss?.goals?.for?.average?.total)||1.10;const baseXGA=parseFloat(ss?.goals?.against?.average?.total)||1.10;
  const wXG = weightedRecentXG(gen, tId);
  return{
    fXG:safeNum(fData.xg), fXGA:safeNum(fData.xga), sXG:safeNum(sData.xg), sXGA:safeNum(sData.xga),
    wXG,
    cor:safeNum(fData.cor), crd:safeNum(fData.crd), scrd:safeNum(sData.crd||fData.crd),
    uiXG:fData.xg, uiXGA:fData.xga, uiDevXG:devBadge(fData.xg,baseXG), uiDevXGA:devBadge(fData.xga,baseXGA),
    uiSXG:sData.xg, uiSXGA:sData.xga, history:getFormHistory(gen,tId)
  };
}

function summarizeH2H(fixtures,homeId,awayId){
  let hw=0,aw=0,dr=0;
  for(const f of (fixtures||[]).slice(0,8)){
    const hg=f?.goals?.home??0,ag=f?.goals?.away??0,myG=f?.teams?.home?.id===homeId?hg:ag,opG=f?.teams?.home?.id===awayId?hg:ag;
    if(myG>opG)hw++;else if(opG>myG)aw++;else dr++;
  }
  return{homeWins:hw,awayWins:aw,draws:dr};
}

// ================================================================
//  PICK ENGINE
// ================================================================
function computePick(hXG, aXG, tXG, bttsScore, cor, totCards, lp, hS, aS) {
  const hLambda = clamp((hXG * 0.5) + (safeNum(hS?.wXG) * 0.3) + (safeNum(aS?.fXGA) * 0.2) * lp.mult, 0.15, 4.0);
  const aLambda = clamp((aXG * 0.5) + (safeNum(aS?.wXG) * 0.3) + (safeNum(hS?.fXGA) * 0.2) * lp.mult, 0.15, 4.0);
  const pp = getPoissonProbabilities(hLambda, aLambda);
  
  const hExp = hLambda, aExp = aLambda;
  const { h: hG_raw, a: aG_raw } = pp.bestScore;
  let hG = hG_raw, aG = aG_raw;

  const xgDiff = hXG - aXG;
  let outPick = "X";
  if(pp.pHome - pp.pAway > 0.15 && xgDiff > lp.xgDiff) outPick = "1";
  else if(pp.pAway - pp.pHome > 0.15 && xgDiff < -lp.xgDiff) outPick = "2";

  if(outPick === "1" && hG <= aG) { hG = aG + 1; }
  if(outPick === "2" && aG <= hG) { aG = hG + 1; }
  
  const exactConf = Math.round(pp.bestScore.prob * 100 * 8);

  let omegaPick = "NO BET", reason = "Insufficient statistical edge.", pickScore = 0;
  
  if(pp.pO35 >= 0.42 && tXG >= lp.minXGO35 && bttsScore >= 1.20)  { omegaPick = "🚀 OVER 3.5 GOALS"; pickScore = pp.pO35 * 100; reason = `Poisson O3.5: ${(pp.pO35*100).toFixed(1)}%`; }
  else if(pp.pO25 >= 0.52 && tXG >= lp.minXGO25 && bttsScore >= 0.85) { omegaPick = "🔥 OVER 2.5 GOALS"; pickScore = pp.pO25 * 100; reason = `Poisson O2.5: ${(pp.pO25*100).toFixed(1)}%`; }
  else if(pp.pU25 >= 0.55 && tXG <= lp.maxU25 && bttsScore <= engineConfig.tBTTS_U25) { omegaPick = "🔒 UNDER 2.5 GOALS"; pickScore = pp.pU25 * 100; reason = `Poisson U2.5: ${(pp.pU25*100).toFixed(1)}%`; }
  else if(bttsScore >= lp.minBTTS && pp.pBTTS >= 0.45)              { omegaPick = "🎯 GOAL/GOAL (BTTS)"; pickScore = pp.pBTTS * 100; reason = `Poisson BTTS: ${(pp.pBTTS*100).toFixed(1)}%`; }
  else if(outPick !== "X" && Math.abs(xgDiff) >= lp.xgDiff + 0.10) {
    const outcome = outPick === "1" ? "🏠 ΑΣΟΣ" : "✈️ ΔΙΠΛΟ";
    const outProb = outPick === "1" ? pp.pHome : pp.pAway;
    omegaPick = outProb >= 0.55 ? `⚡ ${outcome}` : outcome;
    pickScore = outProb * 100;
    reason = `Poisson ${outPick==='1'?'Home':'Away'}: ${(outProb*100).toFixed(1)}%`;
  }
  else if(totCards >= 5.5 && Math.abs(xgDiff) < 0.40) { omegaPick = "🟨 OVER 5.5 ΚΑΡΤΕΣ"; pickScore = totCards * 15; reason = `High tension derby.`; }
  else if(cor >= 10.3) { omegaPick = "🚩 OVER 8.5 ΚΟΡΝΕΡ"; pickScore = cor * 8.5; reason = `High corner yield: ${cor.toFixed(1)}`; }

  return { omegaPick, reason, pickScore, outPick, hG, aG, hExp, aExp, exactConf, xgDiff, pp };
}
