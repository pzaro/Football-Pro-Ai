// core.js
const API_BASE = "https://v3.football.api-sports.io";
let API_KEY = localStorage.getItem('omega_api_key') || "956cbd05f9e9bf934df78d9b72d9a3a0";
const _apiQueue=[]; let _apiActiveCount=0; const MAX_CONCURRENT=8; const REQUEST_GAP_MS=260;

// MATH & PROBABILITY
function poissonProb(lambda, k) {
  if(lambda<=0) return k===0?1:0;
  let logP = -lambda + k*Math.log(lambda);
  for(let i=1;i<=k;i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function getPoissonMatrix(hLambda, aLambda, maxG=5) {
  const m=[];
  for(let h=0;h<=maxG;h++) { m[h]=[]; for(let a=0;a<=maxG;a++) m[h][a]=poissonProb(hLambda,h)*poissonProb(aLambda,a); }
  return m;
}

function getPoissonProbabilities(hLambda, aLambda) {
  const m = getPoissonMatrix(hLambda,aLambda,6);
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

function normalCDF(z) {
  if(z < -6) return 0; if(z > 6) return 1;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t*(0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429))));
  const pdf  = Math.exp(-0.5*z*z)/Math.sqrt(2*Math.PI);
  const p    = 1 - pdf * poly;
  return z >= 0 ? p : 1 - p;
}

// XG & TEAM LOGIC
const safeNum = (x,d=0) => Number.isFinite(Number(x))?Number(x):d;
const clamp = (n,mn,mx) => Math.max(mn,Math.min(mx,n));
const statVal = (arr,type)=>parseFloat(String((arr.find(x=>x.type===type)||{}).value||0).replace('%',''))||0;
const getTeamGoals=(f,t)=>{if(!f?.teams)return 0;return f.teams.home?.id===t?(f.goals?.home??0):(f.goals?.away??0);};
const getOppGoals =(f,t)=>{if(!f?.teams)return 0;return f.teams.home?.id===t?(f.goals?.away??0):(f.goals?.home??0);};

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

// API QUEUE SYSTEM
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
    if(typeof currentCredits==='number'){currentCredits--;updateCredits(currentCredits);}
    resolve(r.ok ? await r.json() : {response:[]});
  } catch { resolve({response:[]}); }
  finally { await new Promise(r=>setTimeout(r,REQUEST_GAP_MS)); _apiActiveCount--; _drainQueue(); }
}