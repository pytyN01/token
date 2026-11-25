import React,{useState,useRef,useEffect,useMemo,useCallback} from "react";
import axios from "axios";
import {columns,enrich,tsv,copyText,cell,scanStatuses} from "./utils/market";
import {extraCoinIds} from "./config/watchlist";
import {canonicalId,lookupIds,annotateLive,positivePrice,staticFallback} from "./config/staticCoins";
import {remainingMs,formatCountdown,retryDelay,advancePercent} from "./utils/scanTiming";
import {rankCoverage,repairPages,improvesCoverage,researchStatus,assignDisplayRanks} from "./utils/rankCoverage";
import "./App.css";

const PAGE_SIZE=250;
const scope=1000, pause=12, include=true;
const wantedIds=[...new Set(extraCoinIds.map(canonicalId))];
const delay=(ms,signal)=>new Promise((resolve,reject)=>{
 if(signal.aborted){reject(new Error("Canceled"));return;}
 const abort=()=>{clearTimeout(timer);reject(new Error("Canceled"));};
 const timer=setTimeout(()=>{signal.removeEventListener("abort",abort);resolve();},ms);
 signal.addEventListener("abort",abort,{once:true});
});
async function request(params,signal,pause,onRetry,onAttempt,onResponse){
 for(let attempt=0;;attempt++){
  try{
   onAttempt();
   const started=Date.now();
   const r=await axios.get("/api/crypto",{params,signal,timeout:30000});
   onResponse(Date.now()-started);
   if(!Array.isArray(r.data)) throw new Error("Unexpected API response");
   return r.data;
  }catch(e){
   const status=e.response?.status;
   if(signal.aborted||attempt>=3||(status&&status!==429&&status<500))throw e;
   const wait=retryDelay(status,pause,attempt,e.response?.headers?.["retry-after"],Date.now());
   onRetry(status===429?"Rate limited — cooling down":"API error — retrying",wait);
   await delay(wait,signal);
  }
 }
}
const THEME_KEY = "crypto-research-theme";
function initialTheme(){
 try {return window.localStorage.getItem(THEME_KEY)==="light"?"light":"dark";}
 catch {return "dark";}
}
function ScanCountdown({progress}){
 const [now,setNow]=useState(()=>Date.now());
 const [estimate,setEstimate]=useState(0);
 useEffect(()=>{
  if(progress.finished)return undefined;
  const tick=()=>{
   const current=Date.now();
   setNow(current);
   setEstimate(previous=>advancePercent(previous,progress,current));
  };
  const timer=setInterval(tick,100);
  return ()=>clearInterval(timer);
 },[progress]);
 const current=Math.max(now,progress.updated);
 const eta=remainingMs(progress,current);
 const wait=Math.max(0,progress.until-current);
 const waiting=progress.phase==="waiting"||progress.phase==="retry";
 const percent=progress.finished?100:estimate;
 const total=Math.max(1,progress.total);
 return <div className="scan-progress">
  <div className="scan-progress-heading">
   <strong>{progress.finished?"Requests finished":"Estimated time remaining: "+(eta>0?formatCountdown(eta):"Finishing…")}</strong>
   <span>{progress.completed}/{progress.total} request batches processed</span>
  </div>
  <div className="scan-progress-track" role="progressbar" aria-label="Estimated scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(percent)} aria-valuetext={Math.floor(percent)+" percent estimated; "+Math.min(total,progress.completed)+" of "+total+" batches processed"}>
   <div className="scan-progress-fill" style={{width:percent+"%"}}/>
  </div>
  <div className="scan-percent">{Math.floor(percent)}%</div>
  {!progress.finished&&<p>{waiting?((progress.phase==="retry"?"Retry cooldown: ":"Next request in: ")+formatCountdown(wait)):"Fetching market data…"}</p>}
 </div>;
}
export default function App(){
 const [theme,setTheme]=useState(initialTheme);
 useEffect(()=>{
  document.documentElement.dataset.theme=theme;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute("content",theme==="dark"?"#000000":"#f4f6f8");
  try {window.localStorage.setItem(THEME_KEY,theme);} catch {/* Theme still works without storage. */}
 },[theme]);
 const [raw,setRaw]=useState([]),[meta,setMeta]=useState(null);
 const [running,setRunning]=useState(true),[message,setMessage]=useState("Starting market scan…");
 const [sort,setSort]=useState({key:"displayRank",asc:true}),[copy,setCopy]=useState(null),[notice,setNotice]=useState("");
 const [progress,setProgress]=useState(null);
 const [entryRows,setEntryRows]=useState(null);
 const [entryRevealed,setEntryRevealed]=useState(false);
 const active=useRef(null);
 useEffect(()=>{
  if(running||!progress?.finished)return undefined;
  const timer=setTimeout(()=>setProgress(null),650);
  return ()=>clearTimeout(timer);
 },[running,progress]);
 useEffect(()=>{
  if(!entryRows)return undefined;
  // Paint the fully sized grid with hidden cell text, then reveal the contents.
  let revealFrame,revealTimer,cleanupTimer;
  const paintFrame=requestAnimationFrame(()=>{
   revealFrame=requestAnimationFrame(()=>{
    revealTimer=setTimeout(()=>{
     setEntryRevealed(true);
     cleanupTimer=setTimeout(()=>setEntryRows(null),2600);
    },300);
   });
  });
  return ()=>{
   cancelAnimationFrame(paintFrame);
   if(revealFrame!==undefined)cancelAnimationFrame(revealFrame);
   if(revealTimer!==undefined)clearTimeout(revealTimer);
   if(cleanupTimer!==undefined)clearTimeout(cleanupTimer);
  };
 },[entryRows]);
 const scan=useCallback(async()=>{
  if(active.current)return;
  const ctl=new AbortController();active.current=ctl;
  const sig=ctl.signal, id=new Date().toISOString(), wanted=wantedIds;
  const seen=new Map(),marketSeen=new Set(),marketErrors=[],watchErrors=[],missing=[],marketPages=new Map(),repairNotes=[];
  let recoveryAttempts=0,recoveryAccepted=0;
  let stage="market";
  let pagesOK=0,shortPages=0,duplicateCount=0;
  const pages=scope/PAGE_SIZE, step=pause*1000;
  let timing={total:pages+Math.ceil(lookupIds(wanted).length/50),completed:0,gap:step,average:1000,phase:"request",until:0,started:Date.now(),scanStarted:Date.now(),updated:Date.now()};
  let samples=0;
  const publish=(patch)=>{timing={...timing,...patch,updated:Date.now()};setProgress(timing);};
  const waitFor=async(ms)=>{publish({phase:"waiting",until:Date.now()+ms});await delay(ms,sig);};
  const fetchBatch=async(params)=>{
   try {
    return await request(params,sig,step,(label,ms)=>{
     setMessage(label);
     publish({phase:"retry",until:Date.now()+ms});
    },()=>publish({phase:"request",started:Date.now(),until:0}),ms=>{
     samples++;
     publish({average:Math.max(250,samples===1?ms:(timing.average*(samples-1)+ms)/samples)});
    });
   } finally {
    if(!sig.aborted)publish({completed:timing.completed+1,phase:"between",until:0});
   }
  };
  let firstBatchShown=false;
  setRunning(true);setRaw([]);setMeta(null);setCopy(null);setNotice("");setEntryRevealed(false);setEntryRows(null);publish({});
  const save=(data,market)=>{
   const fetched=new Date().toISOString();
   for(const row of data){
    if(!row?.id)continue;
    const c=annotateLive(row);
    if(!c)continue;
    if(market){if(marketSeen.has(c.id))duplicateCount++;marketSeen.add(c.id);}
    const previous=seen.get(c.id);
    // Prefer a usable quote; when both aliases return data prefer the canonical provider ID.
    if(!previous || (positivePrice(c)&&!positivePrice(previous)) || (positivePrice(c)===positivePrice(previous)&&(market||c.providerId===c.id))){
     const rank=!market&&marketSeen.has(c.id)?previous?.market_cap_rank:c.market_cap_rank;
     seen.set(c.id,{...c,market_cap_rank:rank,fetched,marketMember:marketSeen.has(c.id)});
    }
   }
   if(market&&!firstBatchShown&&seen.size){
    firstBatchShown=true;
    setEntryRows(new Set(seen.keys()));
   }
   setRaw([...seen.values()]);
  };
  try{
   for(let page=1;page<=pages;page++){
    if(page>1)await waitFor(step);
    setMessage("Market page "+page+" / "+pages);
    try{const data=await fetchBatch({page});marketPages.set(page,data);save(data,true);pagesOK++;if(data.length!==PAGE_SIZE)shortPages++;}
    catch(e){if(sig.aborted)throw e;marketErrors.push("Page "+page+": "+(e.response?.status||e.message));if(e.response?.status===429)throw e;}
   }
   // Repair only pages associated with missing ranks. Keep original pages unless
   // a replacement demonstrably improves coverage; do not manufacture ranks.
   const normalized=(pageMap)=>[...pageMap.values()].flatMap(batch=>batch.map(row=>row?.id?annotateLive(row):null).filter(Boolean));
   if(pagesOK===pages){
    const targets=repairPages(rankCoverage(normalized(marketPages),scope),PAGE_SIZE);
    publish({total:timing.total+targets.length});
    for(const page of targets){
     recoveryAttempts++;
     await waitFor(step);
     setMessage("Rechecking market page "+page+" for missing ranks");
     try{
      const batch=await fetchBatch({page});
      const candidate=new Map(marketPages);
      candidate.set(page,batch);
      if(batch.length===PAGE_SIZE&&improvesCoverage(rankCoverage(normalized(marketPages),scope),rankCoverage(normalized(candidate),scope))){
       marketPages.set(page,batch);
       recoveryAccepted++;
       repairNotes.push("Page "+page+" refreshed: coverage improved");
      }else{repairNotes.push("Page "+page+" rechecked: original retained");}
     }catch(e){
      if(sig.aborted)throw e;
      repairNotes.push("Page "+page+" recheck failed: "+(e.response?.status||e.message));
      if(e.response?.status===429)throw e;
     }
    }
    if(recoveryAccepted){
     seen.clear();marketSeen.clear();duplicateCount=0;shortPages=0;
     for(const batch of marketPages.values()){save(batch,true);if(batch.length!==PAGE_SIZE)shortPages++;}
    }
   }
   stage="watchlist";
   const extra=lookupIds(wanted.filter(id=>!positivePrice(seen.get(id))));
   publish({total:pages+recoveryAttempts+Math.ceil(extra.length/50)});
   for(let i=0;i<extra.length;i+=50){
    await waitFor(step);
    const batch=extra.slice(i,i+50);
    setMessage("Watchlist batch "+(Math.floor(i/50)+1));
    try{save(await fetchBatch({ids:batch.join(",")}),false);}
    catch(e){if(sig.aborted)throw e;watchErrors.push("Watchlist batch "+(Math.floor(i/50)+1)+": "+(e.response?.status||e.message));if(e.response?.status===429)throw e;}
   }
  }catch(e){if(!sig.aborted){(stage==="market"?marketErrors:watchErrors).push(e.message);}}
  finally{
   missing.push(...wanted.filter(x=>!positivePrice(seen.get(x))));
   const marketRows=[...marketSeen].map(x=>seen.get(x)).filter(Boolean);
   const {missingRanks:providerMissingRanks}=rankCoverage(marketRows,scope);
   const providerResearch=researchStatus(marketRows,sig.aborted,stage);
   const fallbackIds=[];
   if(!sig.aborted){
    for(const coinId of missing){
     const fallback=staticFallback(coinId);
     if(fallback){
      if(marketSeen.has(coinId)){
       // Retain the real market rank, even if a ranked record has no usable price.
       seen.set(coinId,{...seen.get(coinId),current_price:null,priceFallback:"Historical metadata only"});
      }else{
       seen.set(coinId,fallback);
       fallbackIds.push(coinId);
      }
     }
    }
   }
   const unresolved=missing.filter(x=>!fallbackIds.includes(x));
   const ranked=assignDisplayRanks([...seen.values()],scope);
   const rankedMarket=ranked.filter(c=>c.marketMember===true);
   const effectiveRows=rankedMarket.map(c=>({...c,market_cap_rank:c.displayRank}));
   const {missingRanks}=rankCoverage(effectiveRows,scope);
   const fallbackRanks=rankedMarket.filter(c=>c.rankSource==="FALLBACK").length;
   const researchFallbacks=rankedMarket.filter(c=>c.rankSource==="FALLBACK"&&c.displayRank<=500).length;
   const research=researchStatus(effectiveRows,sig.aborted,stage);
   if(research.status==="Complete"&&researchFallbacks)research.status="Complete (calculated)";
   const statuses=scanStatuses({canceled:sig.aborted,stage,marketErrors,watchErrors,missing,pagesOK,pages,shortPages,duplicateCount,marketCount:marketSeen.size,scope,missingRanks,include});
   const marketStatus=statuses.marketStatus==="Complete"&&fallbackRanks?"Complete (calculated)":statuses.marketStatus;
   const watchStatus=statuses.watchStatus;
   setRaw(ranked);
   setMeta({id,wanted,marketStatus,watchStatus,marketErrors,watchErrors,missing,fallbackIds,unresolved,pagesOK,pages,duplicateCount,shortPages,missingRanks,marketCount:marketSeen.size,research,providerResearch,providerMissingRanks,fallbackRanks,researchFallbacks,recoveryAttempts,recoveryAccepted,repairNotes});
   setMessage("Market: "+marketStatus+" · Watchlist: "+watchStatus+" — "+seen.size+" unique records ("+fallbackIds.length+" historical)");setRunning(false);
   if(!sig.aborted&&timing.completed===timing.total){publish({finished:true,phase:"finished",until:0});}
   else{setProgress(null);}
   active.current=null;
  }
 },[]);
 useEffect(()=>{
  // Defer the first request so React StrictMode can clean up its rehearsal mount.
  const timer=setTimeout(()=>{scan();},0);
  return ()=>{clearTimeout(timer);active.current?.abort();};
 },[scan]);
 const data=useMemo(()=>raw.map(c=>enrich(c,meta?.id||"",new Set(meta?.wanted||[]),meta?.marketStatus||"In progress",meta?.watchStatus||"In progress",meta?.research.status||"In progress")),[raw,meta]);
 const visible=useMemo(()=>[...data].sort((a,b)=>{
  const x=a[sort.key],y=b[sort.key];if(x==null)return y==null?0:1;if(y==null)return -1;
  return (typeof x==="number"&&typeof y==="number"?x-y:String(x).localeCompare(String(y)))*(sort.asc?1:-1);
 }),[data,sort]);
 async function copyRows(text){
  setNotice("");setCopy(null);
  try{await copyText(text);setNotice("Copied. Paste into Excel with Ctrl+V.");}
  catch{setCopy(text);setNotice("Automatic clipboard unavailable. Select the text below and press Ctrl+C.");}
 }
 const copyMarket=rows=>copyRows(tsv(columns.map(c=>c[0]),rows.map(r=>columns.map(c=>r[c[1]]))));
 const canCopy=Boolean(!running&&meta?.marketStatus.startsWith("Complete")&&meta.unresolved.length===0&&data.length);
 const canReload=!running&&Boolean(meta);
 return <main className="terminal">
  <header className="terminal-header">
   <h1>Crypto Research Terminal</h1>
   <div className="header-actions">
   <button type="button" className="icon-button theme-toggle" title={theme==="dark"?"Switch to light mode":"Switch to dark mode"} aria-label="Light mode" aria-pressed={theme==="light"} onClick={()=>setTheme(t=>t==="dark"?"light":"dark")}>
    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
     {theme==="dark"?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></>:<path d="M20.9 13.35A9 9 0 0 1 10.65 3.1 9 9 0 1 0 20.9 13.35Z"/>}
    </svg>
   </button>
   <button type="button" className="icon-button" title="Copy all to Excel" aria-label="Copy all to Excel" disabled={!canCopy} onClick={()=>copyMarket(data)}>
    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
   </button>
   <button type="button" className="icon-button" title="Reload market data" aria-label="Reload market data" disabled={!canReload} onClick={scan}>
    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.4 8a8 8 0 0 1 13.2-3L20 7M4 17l1.4 2A8 8 0 0 0 18.6 16"/></svg>
   </button>
   </div>
  </header>
  {notice&&<p className="copy-notice" role="status">{notice}</p>}
  <section aria-label="Market scanner">
  {running&&<p role="status">{message} · {raw.length} loaded</p>}
  {progress&&(running||progress.finished)&&<ScanCountdown progress={progress}/>}
  {!running&&meta&&!canCopy&&<p className="scan-error" role="alert">Scan incomplete. Reload market data to retry.{meta.marketErrors.length>0?" "+meta.marketErrors.join("; "):""}{meta.unresolved.length>0?" Unresolved watchlist: "+meta.unresolved.join(", "):""}</p>}
  <div className="table-wrap"><table><thead><tr>{columns.map(([label,key])=><th key={key}><button onClick={()=>setSort(s=>({key,asc:s.key===key?!s.asc:true}))}>{label}{sort.key===key?(sort.asc?" ↑":" ↓"):""}</button></th>)}</tr></thead><tbody className={entryRevealed?"market-data-revealed":undefined}>{visible.map((c,index)=>{
   const entering=entryRows?.has(c.id);
   return <tr key={c.id} className={entering?"market-data-enter":undefined} style={entering?{"--entry-delay":Math.min(index*110,1800)+"ms"}:undefined}>
    {columns.map(([,key])=><td key={key}>{entering?<span className="market-cell-value">{cell(c[key])}</span>:cell(c[key])}</td>)}
   </tr>;
  })}</tbody></table></div>
  </section>
  {copy!==null&&<textarea aria-label="Manual clipboard fallback" readOnly rows={8} value={copy} onFocus={e=>e.target.select()}/>}
 </main>;
}
