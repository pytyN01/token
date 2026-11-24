import React,{useState,useRef,useEffect,useMemo} from "react";
import axios from "axios";
import {allocate} from "./utils/allocation";
import {columns,enrich,tsv,copyText,cell,scanStatuses} from "./utils/market";
import {extraCoinIds} from "./config/watchlist";
import "./App.css";

const PAGE_SIZE=250;
const delay=(ms,signal)=>new Promise((resolve,reject)=>{
 if(signal.aborted){reject(new Error("Canceled"));return;}
 const abort=()=>{clearTimeout(timer);reject(new Error("Canceled"));};
 const timer=setTimeout(()=>{signal.removeEventListener("abort",abort);resolve();},ms);
 signal.addEventListener("abort",abort,{once:true});
});
async function request(params,signal,pause,onRetry){
 for(let attempt=0;;attempt++){
  try{
   const r=await axios.get("/api/crypto",{params,signal,timeout:30000});
   if(!Array.isArray(r.data)) throw new Error("Unexpected API response");
   return r.data;
  }catch(e){
   const status=e.response?.status;
   if(signal.aborted||attempt>=3||(status&&status!==429&&status<500))throw e;
   const retry=e.response?.headers?.["retry-after"];
   const seconds=Number(retry);
   const server=retry?(Number.isFinite(seconds)?seconds*1000:Math.max(0,Date.parse(retry)-Date.now())):0;
   const wait=Math.max(pause*2**attempt,Number.isFinite(server)?server:0);
   onRetry("Retrying after API error in "+Math.ceil(wait/1000)+" seconds");
   await delay(wait,signal);
  }
 }
}
function parseRanks(input){
 return input.trim().split(/\r?\n/).filter(Boolean).filter((line,i)=>!(i===0&&/^coin[ _-]?id\s/i.test(line))).map(line=>{
  const p=line.trim().split(/\t|,|\s+/).map(s=>s.trim());
  if(p.length!==2||!p[1]||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(p[1]))throw new Error("Each line needs Coin ID and expected ROI %, e.g. chainlink 250.");
  return {id:p[0],roi:Number(p[1].replace(/%$/,""))};
 });
}
const THEME_KEY = "crypto-research-theme";
function initialTheme(){
 try {return window.localStorage.getItem(THEME_KEY)==="light"?"light":"dark";}
 catch {return "dark";}
}
export default function App(){
 const [theme,setTheme]=useState(initialTheme);
 useEffect(()=>{
  document.documentElement.dataset.theme=theme;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute("content",theme==="dark"?"#0d1117":"#f4f6f8");
  try {window.localStorage.setItem(THEME_KEY,theme);} catch {/* Theme still works without storage. */}
 },[theme]);
 const [scope,setScope]=useState(1000),[pause,setPause]=useState(20),[include,setInclude]=useState(true);
 const [watch,setWatch]=useState(extraCoinIds.join("\n")),[raw,setRaw]=useState([]),[meta,setMeta]=useState(null);
 const [running,setRunning]=useState(false),[message,setMessage]=useState("Ready"),[filter,setFilter]=useState("all"),[search,setSearch]=useState("");
 const [sort,setSort]=useState({key:"market_cap_rank",asc:true}),[copy,setCopy]=useState(null),[notice,setNotice]=useState("");
 const [budget,setBudget]=useState("100"),[rankInput,setRankInput]=useState("");
 const active=useRef(null);
 useEffect(()=>()=>active.current?.abort(),[]);
 async function scan(){
  if(active.current)return;
  const ctl=new AbortController();active.current=ctl;
  const sig=ctl.signal, id=new Date().toISOString(), wanted=include?[...new Set(watch.split(/[\s,]+/).filter(Boolean))]:[];
  const seen=new Map(),marketSeen=new Set(),marketErrors=[],watchErrors=[],missing=[];
  let stage="market";
  let pagesOK=0,shortPages=0,duplicateCount=0;
  const pages=scope/PAGE_SIZE, step=pause*1000;
  setRunning(true);setRaw([]);setMeta(null);setCopy(null);setNotice("");
  const save=(data,market)=>{
   const fetched=new Date().toISOString();
   for(const c of data){if(!c?.id)continue;if(market){if(marketSeen.has(c.id))duplicateCount++;marketSeen.add(c.id);}seen.set(c.id,{...c,fetched});}
   setRaw([...seen.values()]);
  };
  try{
   for(let page=1;page<=pages;page++){
    if(page>1)await delay(step,sig);
    setMessage("Market page "+page+" / "+pages);
    try{const data=await request({page},sig,step,setMessage);save(data,true);pagesOK++;if(data.length!==PAGE_SIZE)shortPages++;}
    catch(e){if(sig.aborted)throw e;marketErrors.push("Page "+page+": "+(e.response?.status||e.message));}
   }
   stage="watchlist";
   const extra=wanted.filter(id=>!seen.has(id));
   for(let i=0;i<extra.length;i+=50){
    await delay(step,sig);
    const batch=extra.slice(i,i+50);
    setMessage("Watchlist batch "+(Math.floor(i/50)+1));
    try{save(await request({ids:batch.join(",")},sig,step,setMessage),false);}
    catch(e){if(sig.aborted)throw e;watchErrors.push("Watchlist batch "+(Math.floor(i/50)+1)+": "+(e.response?.status||e.message));}
   }
  }catch(e){if(!sig.aborted){(stage==="market"?marketErrors:watchErrors).push(e.message);}}
  finally{
   missing.push(...wanted.filter(x=>!seen.has(x)));
   const ranks=new Set([...marketSeen].map(x=>seen.get(x)?.market_cap_rank));
   const missingRanks=Array.from({length:scope},(_,i)=>i+1).filter(x=>!ranks.has(x));
   const {marketStatus,watchStatus}=scanStatuses({canceled:sig.aborted,stage,marketErrors,watchErrors,missing,pagesOK,pages,shortPages,duplicateCount,marketCount:marketSeen.size,scope,missingRanks,include});
   setMeta({id,wanted,marketStatus,watchStatus,marketErrors,watchErrors,missing,pagesOK,pages,duplicateCount,shortPages,missingRanks,marketCount:marketSeen.size});
   setMessage("Market: "+marketStatus+" · Watchlist: "+watchStatus+" — "+seen.size+" unique coins");setRunning(false);active.current=null;
  }
 }
 const data=useMemo(()=>raw.map(c=>enrich(c,meta?.id||"",new Set(meta?.wanted||[]),meta?.marketStatus||"In progress",meta?.watchStatus||"In progress")),[raw,meta]);
 const visible=useMemo(()=>data.filter(c=>(filter==="all"||(filter==="top500"&&c.eligible==="Yes")||(filter==="watch"&&c.watchlist==="Yes"))&&[c.id,c.name,c.symbol].some(x=>String(x||"").toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>{
  const x=a[sort.key],y=b[sort.key];if(x==null)return y==null?0:1;if(y==null)return -1;
  return (typeof x==="number"&&typeof y==="number"?x-y:String(x).localeCompare(String(y)))*(sort.asc?1:-1);
 }),[data,filter,search,sort]);
 const result=useMemo(()=>{try{return {rows:allocate(/^\d+$/.test(budget)?Number(budget):NaN,parseRanks(rankInput))};}catch(e){return {error:e.message};}},[budget,rankInput]);
 async function copyRows(text){
  setNotice("");setCopy(null);
  try{await copyText(text);setNotice("Copied. Paste into Excel with Ctrl+V.");}
  catch{setCopy(text);setNotice("Automatic clipboard unavailable. Select the text below and press Ctrl+C.");}
 }
 const copyMarket=rows=>copyRows(tsv(columns.map(c=>c[0]),rows.map(r=>columns.map(c=>r[c[1]]))));
 return <main className="terminal">
  <header className="terminal-header">
   <div><h1>Crypto Research Terminal</h1><p>Market snapshots and whole-dollar investment rounds</p></div>
   <button type="button" className="theme-toggle" aria-label="Light mode" aria-pressed={theme==="light"} onClick={()=>setTheme(t=>t==="dark"?"light":"dark")}>
    <span aria-hidden="true">{theme==="dark"?"☀":"☾"}</span> {theme==="dark"?"Light mode":"Dark mode"}
   </button>
  </header>
  <section><h2>Market scanner</h2><div className="controls">
   <label>Market coverage<select disabled={running} value={scope} onChange={e=>setScope(Number(e.target.value))}>{[500,1000,2000,3000].map(n=><option key={n} value={n}>Top {n.toLocaleString()}</option>)}</select></label>
   <label>Request delay<select disabled={running} value={pause} onChange={e=>setPause(Number(e.target.value))}>{[10,20,30,60].map(n=><option key={n} value={n}>{n} seconds</option>)}</select></label>
   <label className="check"><input type="checkbox" checked={include} disabled={running} onChange={e=>setInclude(e.target.checked)}/> Include watchlist</label>
   <button disabled={running} onClick={scan}>Run market scan</button><button disabled={!running} onClick={()=>active.current?.abort()}>Cancel</button>
  </div>
  {include&&<details><summary>Watchlist coin IDs (editable)</summary><textarea disabled={running} rows={5} value={watch} onChange={e=>setWatch(e.target.value)}/></details>}
  <p role="status">{message} {running&&" · "+raw.length+" loaded"}</p>
  {meta&&<>
   <div className={meta.marketStatus==="Complete"?"report":"warning"}><strong>Market scan: {meta.marketStatus}</strong> · {meta.pagesOK}/{meta.pages} pages · {meta.marketCount} market coins · {meta.duplicateCount} duplicate rows · {meta.shortPages} short pages · {meta.missingRanks.length} missing ranks
   {!!meta.marketErrors.length&&<p>Market errors: {meta.marketErrors.join("; ")}</p>}
   {!!meta.missingRanks.length&&<p>Missing ranks: {meta.missingRanks.join(", ")}</p>}
   {meta.marketStatus!=="Complete"&&<p>Incomplete market coverage: do not use as a complete investment universe.</p>}
   </div>
   <div className={["Complete","Skipped"].includes(meta.watchStatus)?"report":"warning"}><strong>Watchlist: {meta.watchStatus}</strong> · {meta.wanted.length-meta.missing.length}/{meta.wanted.length} IDs returned
   {!!meta.watchErrors.length&&<p>Watchlist errors: {meta.watchErrors.join("; ")}</p>}
   {!!meta.missing.length&&<p>Missing watchlist IDs: {meta.missing.join(", ")}</p>}
   {meta.watchStatus==="Partial"&&<p>Missing watchlist data is not a zero valuation and does not invalidate a complete market scan.</p>}
   </div>
  </>}
  <div className="controls"><label>Filter<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All collected</option><option value="top500">Top 500</option><option value="watch">Watchlist</option></select></label>
   <label>Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, symbol or ID"/></label>
   <button disabled={running||!meta||!data.length} onClick={()=>copyMarket(data)}>Copy all to Excel</button><button disabled={running||!meta||!visible.length} onClick={()=>copyMarket(visible)}>Copy filtered to Excel</button></div>
  <p>{visible.length} displayed. ATH recovery is historical upside, not an expected return. Top 500 indicates rank only, not investment approval.</p>
  <div className="table-wrap"><table><thead><tr>{columns.map(([label,key])=><th key={key}><button onClick={()=>setSort(s=>({key,asc:s.key===key?!s.asc:true}))}>{label}{sort.key===key?(sort.asc?" ↑":" ↓"):""}</button></th>)}</tr></thead><tbody>{visible.map(c=><tr key={c.id}>{columns.map(([,key])=><td key={key}>{cell(c[key])}</td>)}</tr>)}</tbody></table></div>
  </section>
  <section><h2>Investment round allocator</h2><p>Paste 20 unique CoinGecko IDs and your researched expected ROI percentages from Excel. Ranked automatically; no trades are executed.</p>
   <label>Whole-dollar round budget (USD)<input type="number" min="20" max="1000000" step="1" value={budget} onChange={e=>setBudget(e.target.value)}/></label>
   <label>Coin ID and expected ROI %<textarea rows={8} value={rankInput} onChange={e=>setRankInput(e.target.value)} placeholder={"chainlink\t250\nsolana\t220\n..."} /></label>
   {result.error?<p role="status">{result.error}</p>:<><p><strong>Total allocated: ${result.rows.reduce((s,r)=>s+r.amount,0)}</strong> · 20 coins</p><button onClick={()=>copyRows(tsv(["Rank","Coin ID","Expected ROI %","Investment USD"],result.rows.map(r=>[r.rank,r.id,r.roi,r.amount])))}>Copy allocation to Excel</button><div className="table-wrap"><table><thead><tr><th>Rank</th><th>Coin ID</th><th>Expected ROI %</th><th>Investment USD</th></tr></thead><tbody>{result.rows.map(r=><tr key={r.id}><td>{r.rank}</td><td>{r.id}</td><td>{r.roi}</td><td>{r.amount}</td></tr>)}</tbody></table></div></>}
   <p>Minimum $1 per coin. Ties are possible at small budgets. Check exchange minimum orders, fees and spreads before buying.</p>
  </section>
  {notice&&<p role="status">{notice}</p>}{copy!==null&&<textarea aria-label="Manual clipboard fallback" readOnly rows={8} value={copy} onFocus={e=>e.target.select()}/>}
 </main>;
}
