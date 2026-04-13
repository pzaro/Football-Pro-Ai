// core.js

// Εργαλεία
const safeNum = (x,d=0) => Number.isFinite(Number(x))?Number(x):d;
const clamp = (n,mn,mx) => Math.max(mn,Math.min(mx,n));
const statVal = (arr,type)=>parseFloat(String((arr.find(x=>x.type===type)||{}).value||0).replace('%',''))||0;

// Μαθηματικά Poisson & Normal CDF
function poissonProb(lambda, k) {
  if(lambda<=0) return k===0?1:0;
  let logP = -lambda + k*Math.log(lambda);
  for(let i=1;i<=k;i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function getPoissonMatrix(hL, aL, maxG=5) {
  const m=[];
  for(let h=0;h<=maxG;h++) { m[h]=[]; for(let a=0;a<=maxG;a++) m[h][a]=poissonProb(hL,h)*poissonProb(aL,a); }
  return m;
}

function getPoissonProbabilities(hL, aL) {
  const m = getPoissonMatrix(hL,aL,6);
  let pHome=0,pDraw=0,pAway=0,pO25=0,pO35=0,pU25=0,pBTTS=0;
  let bestScore = {h:1,a:1,prob:0};
  for(let h=0;h<=6;h++) for(let a=0;a<=6;a++) {
    const p = m[h]?.[a]??0;
    if(h>a) pHome+=p; else if(h<a) pAway+=p; else pDraw+=p;
    if(h+a>2.5) pO25+=p; if(h+a>3.5) pO35+=p; if(h+a<2.5) pU25+=p;
    if(h>0&&a>0) pBTTS+=p;
    if(p>bestScore.prob) bestScore={h,a,prob:p};
  }
  return {pHome,pDraw,pAway,pO25,pO35,pU25,pBTTS,bestScore,matrix:m};
}

function getPoissonMatrixHTML(hL, aL, maxG=4) {
  const m = getPoissonMatrix(hL,aL,maxG);
  let html = `<div class="poisson-grid" style="grid-template-columns:22px repeat(${maxG+1},1fr);">`;
  html += `<div class="poisson-cell" style="color:var(--text-muted)"></div>`;
  for(let a=0;a<=maxG;a++) html+=`<div class="poisson-cell" style="color:var(--accent-blue);font-size:0.6rem">${a}</div>`;
  for(let h=0;h<=maxG;h++) {
    html += `<div class="poisson-cell" style="color:var(--accent-gold);font-size:0.6rem">${h}</div>`;
    for(let a=0;a<=maxG;a++) {
      const prob=m[h][a]*100, intensity=Math.min(prob/12,1);
      const r=Math.round(56*(1-intensity)+45*intensity), g=Math.round(189*(1-intensity)+212*intensity), b=Math.round(248*(1-intensity)+191*intensity);
      const textCol = prob>6?'#020e1a':'var(--text-main)';
      html += `<div class="poisson-cell" style="background:rgba(${r},${g},${b},${intensity*0.85+0.05});color:${textCol}">${prob.toFixed(1)}%</div>`;
    }
  }
  html += `</div>`; return html;
}

function normalCDF(z) {
  if(z < -6) return 0; if(z > 6) return 1;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t*(0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429))));
  const pdf  = Math.exp(-0.5*z*z)/Math.sqrt(2*Math.PI);
  const p    = 1 - pdf * poly;
  return z >= 0 ? p : 1 - p;
}

// API Queue & Request Engine
let _apiQueue = [], _apiActiveCount = 0;
const MAX_CONCURRENT = 5;
const REQUEST_GAP_MS = 150;

async function apiReq(path) {
  return new Promise(resolve=>{ _apiQueue.push({path,resolve}); _drainQueue(); });
}
async function _drainQueue() {
  while(_apiActiveCount<MAX_CONCURRENT && _apiQueue.length>0) {
    const {path,resolve}=_apiQueue.shift();
    _apiActiveCount++; _executeRequest(path,resolve);
  }
}
async function _executeRequest(path,resolve) {
  await new Promise(r=>setTimeout(r,Math.random()*100));
  try {
    const r=await fetch(`${API_BASE}/${path}`,{headers:{'x-apisports-key':API_KEY}});
    // CREDIT MANAGEMENT LINK
    if(typeof currentCredits==='number'){
      currentCredits--; 
      if(typeof window.updateCredits === 'function') window.updateCredits(currentCredits);
    }
    resolve(r.ok ? await r.json() : {response:[]});
  } catch { resolve({response:[]}); }
  finally { await new Promise(r=>setTimeout(r,REQUEST_GAP_MS)); _apiActiveCount--; _drainQueue(); }
}

// Statistics Fetchers
async function getTStats(t,lg,s){const k=`${t}_${lg}_${s}`;if(teamStatsCache.has(k))return teamStatsCache.get(k);const d=await apiReq(`teams/statistics?team=${t}&league=${lg}&season=${s}`);teamStatsCache.set(k,d?.response||{});return d?.response||{};}
async function getLFix(t,lg,s){const k=`${t}_${lg}_${s}`;if(lastFixCache.has(k))return lastFixCache.get(k);const d=await apiReq(`fixtures?team=${t}&league=${lg}&season=${s}&last=20&status=FT`);lastFixCache.set(k,d?.response||[]);return d?.response||[];}
async function getStand(lg,s){const k=`${lg}_${s}`;if(standCache.has(k))return standCache.get(k);const d=await apiReq(`standings?league=${lg}&season=${s}`);const f=Array.isArray(d?.response?.[0]?.league?.standings)?d.response[0].league.standings.flat():[];standCache.set(k,f);return f;}
async function getHeadToHead(t1,t2,lg,s){const k=`${t1}_${t2}_${lg||'a'}_${s||'a'}`;if(h2hCache.has(k))return h2hCache.get(k);const d=await apiReq(`fixtures/headtohead?h2h=${t1}-${t2}${lg&&s?`&league=${lg}&season=${s}`:''}`);h2hCache.set(k,d?.response||[]);return d?.response||[];}

// Data Processors
window.getTeamRank =(st,tId)=>{const r=(st||[]).find(x=>String(x?.team?.id)===String(tId));return r?.rank??null;};
const getTeamGoals=(f,t)=>{if(!f?.teams)return 0;return f.teams.home?.id===t?(f.goals?.home??0):(f.goals?.away??0);};
const getOppGoals =(f,t)=>{if(!f?.teams)return 0;return f.teams.home?.id===t?(f.goals?.away??0):(f.goals?.home??0);};

window.summarizeH2H = function(fixtures,homeId,awayId) {
  let hw=0,aw=0,dr=0,totGoals=0,bttsCount=0,n=0;
  for(const f of (fixtures||[]).slice(0,10)) {
    const hg=f?.goals?.home??0,ag=f?.goals?.away??0;
    const myG=f?.teams?.home?.id===homeId?hg:ag,opG=f?.teams?.home?.id===awayId?hg:ag;
    if(myG>opG)hw++;else if(opG>myG)aw++;else dr++;
    totGoals+=hg+ag;
    if(hg>0&&ag>0)bttsCount++;
    n++;
  }
  return{ homeWins:hw,awayWins:aw,draws:dr, avgGoals: n>0 ? totGoals/n : null, bttsRate: n>0 ? bttsCount/n : null, n };
}

function getFormHistory(fixtures,teamId) {
  return fixtures.map(f=>{ const my=getTeamGoals(f,teamId),op=getOppGoals(f,teamId); return my>op?{res:'W',cls:'W'}:(my<op?{res:'L',cls:'L'}:{res:'D',cls:'D'}); }).reverse();
}

function devBadge(curr,base) {
  if(!base||base<=0) return '';
  const d=(((parseFloat(curr)-base)/base)*100).toFixed(1);
  return `<span class="dev-badge ${d>=0?'dev-pos':'dev-neg'}">${d>0?'+':''}${d}%</span>`;
}

function estXG(arr,g=0) {
  const nativeXG = statVal(arr,'Expected Goals');
  if(nativeXG > 0) return nativeXG;
  return (statVal(arr,'Shots on Goal')*engineConfig.wShotsOn)
        +(statVal(arr,'Shots off Goal')*engineConfig.wShotsOff)
        +(statVal(arr,'Corner Kicks')*engineConfig.wCorners)
        +(g*engineConfig.wGoals)||0.60+g*0.25;
}

function weightedRecentXG(fixtures,teamId) {
  const weights=[0.30,0.25,0.20,0.12,0.08,0.05]; let total=0,wSum=0;
  fixtures.slice(0,6).forEach((f,i)=>{
    const goals=getTeamGoals(f,teamId);
    total+=goals*(weights[i]||0.02); wSum+=(weights[i]||0.02);
  });
  return wSum>0?total/wSum:0;
}

function getFormRating(hist) {
  if(!hist||!hist.length) return 50;
  const weights=[1,0.8,0.6,0.4,0.2]; let score=0,totalWeight=0;
  hist.slice(0,5).forEach((h,i)=>{
    const w=weights[i]||0.1,pts=h.res==='W'?100:(h.res==='D'?33:0);
    score+=pts*w; totalWeight+=w;
  });
  return totalWeight>0?Math.round(score/totalWeight):50;
}

async function batchCalc(list,tId) {
  if(!list.length) return{xg:null,xga:null,cor:null,crd:null};
  let x=0,xa=0,c=0,cr=0,n=0;
  for(const f of list) {
    try {
      const st=await apiReq(`fixtures/statistics?fixture=${f.fixture.id}`);
      if(!st?.response||st.response.length<2) continue;
      const my=st.response.find(z=>z.team.id===tId)?.statistics||[];
      const op=st.response.find(z=>z.team.id!==tId)?.statistics||[];
      x+=(statVal(my,'Expected Goals')||estXG(my,getTeamGoals(f,tId)));
      xa+=(statVal(op,'Expected Goals')||estXG(op,getOppGoals(f,tId)));
      c+=statVal(my,'Corner Kicks');
      cr+=statVal(my,'Yellow Cards')+statVal(my,'Red Cards');
      n++;
    } catch { continue; }
  }
  return{ xg: n>0 ? (x/n).toFixed(2) : null, xga: n>0 ? (xa/n).toFixed(2) : null, cor: n>0 ? (c/n).toFixed(1) : null, crd: n>0 ? (cr/n).toFixed(1) : null };
}

window.buildIntel = async function(tId,lg,s,isHome) {
  try {
    const[ss,allFix]=await Promise.all([getTStats(tId,lg,s),getLFix(tId,lg,s)]);
    const gen=allFix.slice(0,6);
    const split=allFix.filter(f=>(isHome?f.teams.home.id:f.teams.away.id)===tId).slice(0,6);
    const[fData,sData]=await Promise.all([batchCalc(gen,tId),batchCalc(split,tId)]);
    
    const seasonXG = parseFloat(ss?.goals?.for?.average?.total) || 1.35;
    const seasonXGA = parseFloat(ss?.goals?.against?.average?.total) || 1.35;
    const wXG = weightedRecentXG(gen,tId);
    const history = getFormHistory(gen,tId);
    const formRating = getFormRating(history);
    
    const final_fXG = Math.max(fData.xg !== null ? safeNum(fData.xg) : seasonXG, 0.85);
    const final_fXGA = Math.max(fData.xga !== null ? safeNum(fData.xga) : seasonXGA, 0.85);
    const final_sXG = Math.max(sData.xg !== null ? safeNum(sData.xg) : seasonXG, 0.85);
    const final_sXGA = Math.max(sData.xga !== null ? safeNum(sData.xga) : seasonXGA, 0.85);
    const final_wXG = Math.max(wXG > 0 ? wXG : seasonXG, 0.85);

    return {
      fXG: final_fXG, fXGA: final_fXGA, sXG: final_sXG, sXGA: final_sXGA, wXG: final_wXG, formRating,
      cor: fData.cor !== null ? safeNum(fData.cor) : 4.5, crd: fData.crd !== null ? safeNum(fData.crd) : 2.0,
      uiXG: fData.xg !== null ? fData.xg : seasonXG.toFixed(2), uiXGA: fData.xga !== null ? fData.xga : seasonXGA.toFixed(2),
      uiDevXG: devBadge(final_fXG, seasonXG), uiDevXGA: devBadge(final_fXGA, seasonXGA),
      uiSXG: sData.xg !== null ? sData.xg : seasonXG.toFixed(2), uiSXGA: sData.xga !== null ? sData.xga : seasonXGA.toFixed(2),
      history
    };
  } catch {
    return {fXG:1.35,fXGA:1.35,sXG:1.35,sXGA:1.35,wXG:1.35,formRating:50,cor:4.5,crd:2.0,uiXG:'1.35',uiXGA:'1.35',uiDevXG:'',uiDevXGA:'',uiSXG:'1.35',uiSXGA:'1.35',history:[]};
  }
}

function computeOverConfidence(hXG, aXG, pp, h2h, leagueId, hFormRating, aFormRating) {
  const tXG = hXG + aXG;
  const leagueAvg = 2.60;
  let score = pp.pO25 * 100;
  if(h2h?.avgGoals != null && h2h.n >= 4) {
    const h2hBonus = (h2h.avgGoals - leagueAvg) * 5;
    score += clamp(h2hBonus, -10, 12);
  }
  const combinedForm = (hFormRating + aFormRating) / 2;
  if(combinedForm > 65) score += (combinedForm - 65) * 0.15;
  const margin = tXG - 2.70;
  if(margin < 0.20) score -= (0.20 - margin) * 15;
  return clamp(score, 0, 99);
}

function computeCornerConfidence(hCorAvg, aCorAvg, hXG, aXG, h2h) {
  const combinedCor = hCorAvg + aCorAvg;
  const stdv = Math.sqrt(combinedCor) * 0.90;
  const z = (8.5 - combinedCor) / stdv; 
  const pAbove = 1 - normalCDF(z);
  let score = pAbove * 100;
  const tXG = hXG + aXG;
  if(tXG > 2.80) score += (tXG - 2.80) * 8;
  return clamp(score, 0, 99);
}

window.computePick = function(hXG,aXG,tXG,bttsScore,cor,totCards,lp,hS,aS,h2h,hInj=0,aInj=0,leagueId=0) {
  let h2hBiasHome=0, h2hBiasAway=0;
  if(h2h) {
    if(h2h.homeWins-h2h.awayWins>=3){ h2hBiasHome=0.15; h2hBiasAway=-0.10; }
    else if(h2h.awayWins-h2h.homeWins>=3){ h2hBiasAway=0.15; h2hBiasHome=-0.10; }
  }
  const hInjPen=Math.min(hInj*0.03,0.15), aInjPen=Math.min(aInj*0.03,0.15);

  const safeHXG = Math.max(hXG, 0.80); const safeAXG = Math.max(aXG, 0.80);
  const safeHWXG = Math.max(safeNum(hS?.wXG), 0.80); const safeAWXG = Math.max(safeNum(aS?.wXG), 0.80);
  const safeHFxGA = Math.max(safeNum(hS?.fXGA), 0.80); const safeAFxGA = Math.max(safeNum(aS?.fXGA), 0.80);

  const hLambda=clamp(((safeHXG*0.45)+(safeHWXG*0.30)+(safeAFxGA*0.25))*lp.mult*(1+h2hBiasHome-hInjPen),0.50,4.0);
  const aLambda=clamp(((safeAXG*0.45)+(safeAWXG*0.30)+(safeHFxGA*0.25))*lp.mult*(1+h2hBiasAway-aInjPen),0.50,4.0);

  const pp=getPoissonProbabilities(hLambda,aLambda);
  const xgDiff=hXG-aXG;
  
  const hFormRating = safeNum(hS?.formRating, 50);
  const aFormRating = safeNum(aS?.formRating, 50);

  const overConf25 = computeOverConfidence(safeHXG, safeAXG, pp, h2h, leagueId, hFormRating, aFormRating);
  const overConf35 = pp.pO35 * 100;
  const cornerConf = computeCornerConfidence(safeNum(hS?.cor,4.5), safeNum(aS?.cor,4.5), safeHXG, safeAXG, h2h);
  const combinedCor = safeNum(hS?.cor,4.5) + safeNum(aS?.cor,4.5);
  
  let outPick="X";
  if(pp.pHome-pp.pAway>0.15 && xgDiff>lp.xgDiff) outPick="1";
  else if(pp.pAway-pp.pHome>0.15 && xgDiff<-lp.xgDiff) outPick="2";

  let omegaPick="NO BET",reason="Insufficient statistical edge.",pickScore=0;

  const safe_tXG = safeHXG + safeAXG;
  const safe_bttsScore = Math.min(safeHXG, safeAXG);

  if(overConf35>=62 && safe_tXG>=lp.minXGO35 && safe_bttsScore>=1.20) {
    omegaPick="🚀 OVER 3.5 GOALS"; pickScore=overConf35; reason=`O3.5 Conf: ${overConf35.toFixed(1)}% | Poisson: ${(pp.pO35*100).toFixed(1)}%`;
  } else if(overConf25>=62 && safe_tXG>=lp.minXGO25 && safe_bttsScore>=0.85) {
    omegaPick="🔥 OVER 2.5 GOALS"; pickScore=overConf25; reason=`O2.5 Conf: ${overConf25.toFixed(1)}% | xG: ${safe_tXG.toFixed(2)}`;
  } else if(pp.pU25>=0.56 && safe_tXG<=lp.maxU25) {
    omegaPick="🔒 UNDER 2.5 GOALS"; pickScore=pp.pU25*100; reason=`Poisson U2.5: ${(pp.pU25*100).toFixed(1)}%`;
  } else if(safe_bttsScore>=lp.minBTTS && pp.pBTTS>=0.47) {
    omegaPick="🎯 GOAL/GOAL (BTTS)"; pickScore=pp.pBTTS*100; reason=`BTTS Prob: ${(pp.pBTTS*100).toFixed(1)}%`;
  } else if(outPick!=="X" && Math.abs(xgDiff)>=lp.xgDiff+0.10) {
    const outcome=outPick==="1"?"🏠 ΑΣΟΣ":"✈️ ΔΙΠΛΟ";
    const outProb=outPick==="1"?pp.pHome:pp.pAway;
    omegaPick=outProb>=0.55?`⚡ ${outcome}`:outcome;
    pickScore=outProb*100;
    reason=`Poisson ${outPick==='1'?'Home':'Away'}: ${(outProb*100).toFixed(1)}%`;
  } else if(cornerConf>=65) {
    omegaPick="🚩 OVER 8.5 ΚΟΡΝΕΡ"; pickScore=cornerConf; reason=`Corner Conf: ${cornerConf.toFixed(1)}% | Avg: ${combinedCor.toFixed(1)}`;
  }

  let {h: hG_raw, a: aG_raw} = pp.bestScore;
  let hG = hG_raw, aG = aG_raw;
  
  let bestAlignedScore = { h: hG_raw, a: aG_raw, prob: 0 };
  for(let h = 0; h <= 6; h++) {
    for(let a = 0; a <= 6; a++) {
      const p = pp.matrix[h]?.[a] ?? 0;
      let isValid = true;
      if (omegaPick.includes("OVER 2.5") && (h + a < 3)) isValid = false;
      if (omegaPick.includes("OVER 3.5") && (h + a < 4)) isValid = false;
      if (omegaPick.includes("UNDER 2.5") && (h + a > 2)) isValid = false;
      if (omegaPick.includes("GOAL") && (h === 0 || a === 0)) isValid = false;
      if (outPick === "1" && h <= a) isValid = false;
      if (outPick === "2" && a <= h) isValid = false;
      if (outPick === "X" && h !== a) isValid = false;

      if (isValid && p > bestAlignedScore.prob) {
        bestAlignedScore = { h, a, prob: p };
      }
    }
  }
  
  let exactConf = Math.round(clamp(pp.bestScore.prob * 100 * 3, 0, 99));
  if (bestAlignedScore.prob > 0) {
     hG = bestAlignedScore.h;
     aG = bestAlignedScore.a;
     exactConf = Math.round(clamp(bestAlignedScore.prob * 100 * 8, 0, 99));
  }

  return{omegaPick,reason,pickScore,outPick,hG,aG,hExp:hLambda,aExp:aLambda,exactConf,xgDiff,pp,overConf25,cornerConf};
}

// UI Προσθήκες (για να μην βγάζει Reference Errors)
window.scrollToMatch = function(id) {
  const el = document.getElementById(id);
  if(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if(typeof window.flashElement === 'function') window.flashElement(el);
  }
};

window.getMatchCardHTML = function(d) {
  const isFin = window.isFinished ? window.isFinished(d.m?.fixture?.status?.short) : ["FT","AET","PEN"].includes(d.m?.fixture?.status?.short);
  const isLiveNow = window.isLive ? window.isLive(d.m?.fixture?.status?.short) : ["1H","2H","HT","LIVE","ET","BT","P"].includes(d.m?.fixture?.status?.short);
  const scoreStr = isFin || isLiveNow ? `${d.m?.goals?.home??0} - ${d.m?.goals?.away??0}` : 'vs';
  const conf = d.strength ? d.strength.toFixed(1) : '0.0';
  
  // Custom escape if esc isn't global
  const safeStr = (str) => String(str||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  
  return `
  <div class="quant-panel match-card" id="card-${d.fixId}" style="margin-bottom: 12px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <span style="font-size:0.65rem; color:var(--accent-blue); text-transform:uppercase; letter-spacing:1px; font-weight:700;">${safeStr(d.lg)}</span>
      <span style="font-size:0.65rem; color:var(--text-muted);">${d.m?.fixture?.date?.slice(11,16) || ''}</span>
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <div style="flex:1; text-align:right; font-weight:700; font-size:0.9rem;">${safeStr(d.ht)}</div>
      <div style="margin:0 15px; padding:4px 10px; background:var(--bg-surface); border-radius:4px; font-weight:800; color:${isLiveNow?'var(--accent-green)':'var(--text-main)'}; font-family:var(--font-mono);">${scoreStr}</div>
      <div style="flex:1; text-align:left; font-weight:700; font-size:0.9rem;">${safeStr(d.at)}</div>
    </div>
    <div style="background:var(--bg-surface); padding:10px; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center; border-left:3px solid ${d.omegaPick?.includes('NO BET')?'var(--text-muted)':'var(--accent-green)'};">
      <div>
        <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase;">AI Signal</div>
        <div style="font-weight:800; font-size:0.9rem; color:var(--text-main); margin-top:2px;">${safeStr(d.omegaPick)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase;">Confidence</div>
        <div style="font-weight:800; font-size:0.9rem; color:var(--accent-gold); margin-top:2px;">${conf}%</div>
      </div>
    </div>
    <div style="margin-top:8px; font-size:0.7rem; color:var(--text-muted); display:flex; justify-content:space-between;">
      <span>xG: ${d.tXG ? d.tXG.toFixed(2) : '0.00'}</span>
      <span>Exact Pred: <span style="color:var(--accent-blue)">${d.exact || '?-?'}</span></span>
    </div>
  </div>`;
};
