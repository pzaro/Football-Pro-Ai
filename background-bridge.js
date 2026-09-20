(() => {
  'use strict';
  const KEYS = [
    'omega_preds_v5.0','omega_settings_v5.0','omega_lgmods_v5.0','omega_bankroll_v5.0','omega_postmatch_range_v5.0',
    'omega_live_alerts_v5.0','omega_my_leagues_v5.0','omega_adaptive_precision_model_v5.5','omega_adaptive_precision_settings_v5.5',
    'omega_adaptive_precision_log_v5.5','omega_betjournal_v5.0','omega_sheets_url_v5.0','omega_calib_log_v5.0','omega_self_improve_state_v5.0','omega_last_calib_ts'
  ];
  const last = new Map(KEYS.map(k => [k, localStorage.getItem(k)]));
  let remoteApply = false, flushBusy = false, restored = false;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const jfetch = async (url, opts={}) => {
    const r = await fetch(url, { cache:'no-store', ...opts, headers:{'Content-Type':'application/json',...(opts.headers||{})} });
    if(!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return r.json();
  };
  async function pushKey(k,v){
    try { await jfetch('/api/state/key',{method:'POST',body:JSON.stringify({key:k,value:v})}); }
    catch(e){ console.warn('[APEX BG] state push',k,e.message); }
  }
  async function seedIfNeeded(){
    try{
      const boot=window.__APEX_SERVER_BOOT__?.state||{};
      const payload={};
      for(const k of KEYS) if(!boot[k] && localStorage.getItem(k)!==null) payload[k]=localStorage.getItem(k);
      if(Object.keys(payload).length) await jfetch('/api/state/bulk',{method:'POST',body:JSON.stringify({state:payload})});
    }catch(e){console.warn('[APEX BG] seed',e.message);}
  }
  async function flushState(){
    if(flushBusy||remoteApply) return;
    flushBusy=true;
    try{
      for(const k of KEYS){
        const v=localStorage.getItem(k), prev=last.get(k);
        if(v!==prev){ last.set(k,v); await pushKey(k,v); }
      }
    }finally{flushBusy=false;}
  }
  async function pullState(){
    try{
      const d=await jfetch('/api/state');
      remoteApply=true;
      for(const k of KEYS){
        const rec=d.state?.[k]; if(!rec) continue;
        const cur=localStorage.getItem(k), known=last.get(k);
        // Apply remote only if the local value has not changed since our last observation.
        if(cur===known && rec.value!==cur){ localStorage.setItem(k,rec.value); last.set(k,rec.value); }
      }
    }catch(e){console.warn('[APEX BG] state pull',e.message);}
    finally{remoteApply=false;}
  }
  async function saveCurrentScan(data=window.scannedMatchesData||[]){
    if(!Array.isArray(data)) return;
    try{ await jfetch('/api/current-scan',{method:'POST',body:JSON.stringify({data})}); }
    catch(e){ console.warn('[APEX BG] current scan save',e.message); }
  }
  async function restoreCurrentScan(){
    if(restored && (window.scannedMatchesData||[]).length) return (window.scannedMatchesData||[]).length;
    try{
      const d=await jfetch('/api/current-scan');
      if(Array.isArray(d.data)&&d.data.length){
        window.scannedMatchesData=d.data;
        try{ window.applyAdaptivePrecisionToCurrentScan?.(); }catch{}
        try{ window.rebuildTopLists?.(); }catch{}
        try{ window.renderTopSections?.(); }catch{}
        try{ window.renderSummaryTable?.(); }catch{}
        try{ window.tickerRefresh?.(); }catch{}
        try{ if(new URLSearchParams(location.search).get('background')!=='1') window.startAutoSync?.(); }catch{}
        restored=true;
        return d.data.length;
      }
    }catch(e){console.warn('[APEX BG] current scan restore',e.message);}
    return 0;
  }
  function scannerConfig(){
    const val=id=>document.getElementById(id)?.value||'';
    let ids=[]; try{ids=window.getScanSelectedLeagueIds?.()||[];}catch{}
    return {
      enabled:true, autoScanEnabled:true,
      scanMode:val('scanMode')||'REMAINING', scanStart:val('scanStart'), scanStartTime:val('scanStartTime'), scanEnd:val('scanEnd'), scanEndTime:val('scanEndTime')||'23:59',
      leagueIds:ids.map(Number).filter(Number.isFinite)
    };
  }
  async function captureScannerConfig(){
    try{return await jfetch('/api/engine/config',{method:'POST',body:JSON.stringify(scannerConfig())});}
    catch(e){console.warn('[APEX BG] config',e.message);return null;}
  }
  async function setEngineEnabled(enabled){
    try{const d=await jfetch('/api/engine/config',{method:'POST',body:JSON.stringify({enabled:!!enabled})});updateStatus(d);return d;}
    catch(e){console.warn('[APEX BG] enable',e.message);}
  }
  async function runNow(job='scan'){
    try{ updateStatusText('⏳ εκτέλεση…','var(--accent-gold)'); return await jfetch('/api/engine/run-now',{method:'POST',body:JSON.stringify({job})}); }
    catch(e){ updateStatusText('⚠ background error','var(--accent-red)'); throw e; }
  }
  function updateStatusText(text,color){
    const el=document.getElementById('backgroundEngineStatus'); if(el){el.textContent=text; if(color)el.style.color=color;}
  }
  function updateStatus(d){
    const s=d?.status||d;
    if(!s) return;
    const head=s.headless||{}; const cfg=s.config||{};
    const color=!cfg.enabled?'var(--text-muted)':head.running?'var(--accent-green)':'var(--accent-gold)';
    const txt=!cfg.enabled?'OFF':head.running?`ONLINE · PID ${s.pid}`:`CORE ONLINE · HEADLESS ${head.lastError?'DEGRADED':'STARTING'}`;
    updateStatusText(txt,color);
    const dot=document.getElementById('backgroundEngineDot'); if(dot){dot.style.background=color;dot.style.boxShadow=`0 0 7px ${color}`;}
    const badge=document.getElementById('backgroundHeaderStatus'); if(badge)badge.textContent=txt;
    const btn=document.getElementById('backgroundToggleBtn'); if(btn)btn.textContent=cfg.enabled?'⏸ Pause BG':'▶ Enable BG';
    const details=document.getElementById('backgroundEngineDetails');
    if(details){
      const last=s.jobs?.scan?.at||'—', learn=s.jobs?.learn?.at||'—', results=s.jobs?.results?.at||'—';
      details.textContent=`Scan ${last} · Results ${results} · Learn ${learn} · Vault ${s.vaultCount||0}`;
    }
  }
  async function pollStatus(){try{updateStatus(await jfetch('/api/engine/status'));}catch{updateStatusText('OFFLINE','var(--accent-red)');}}

  window.APEX_BG={flushState,pullState,saveCurrentScan,restoreCurrentScan,captureScannerConfig,setEngineEnabled,runNow,pollStatus,scannerConfig};

  // Wrap the existing scan without changing its statistical engine.
  const originalRunScan=window.runScan;
  if(typeof originalRunScan==='function'){
    window.runScan=async function(...args){
      await captureScannerConfig();
      const r=await originalRunScan.apply(this,args);
      await saveCurrentScan(window.scannedMatchesData||[]);
      await flushState();
      return r;
    };
  }
  // saveToVault calls this bridge explicitly after v6.0 patch; periodic flush is the fallback.
  seedIfNeeded();
  setInterval(flushState,2000);
  setInterval(pullState,12000);
  setInterval(pollStatus,5000);
  setInterval(()=>{if((window.scannedMatchesData||[]).length)saveCurrentScan(window.scannedMatchesData);},60000);
  document.addEventListener('DOMContentLoaded',async()=>{
    await sleep(300); pollStatus();
    const waitForUnlock=setInterval(async()=>{
      if(document.getElementById('app')?.style.display!=='none'){
        clearInterval(waitForUnlock);
        await pullState();
        await restoreCurrentScan();
      }
    },500);
    const toggle=document.getElementById('backgroundToggleBtn');
    if(toggle)toggle.addEventListener('click',async()=>{
      const s=await jfetch('/api/engine/status'); await setEngineEnabled(!s.config?.enabled); await pollStatus();
    });
  });
})();
