// Evaluate the actual provider ranks, never the table's row indexes.
export function rankCoverage(rows, scope) {
 const ids=new Set(), ranks=new Set();
 let duplicates=0;
 for(const c of rows){
  if(!c?.id)continue;
  if(ids.has(c.id)){duplicates++;continue;}
  ids.add(c.id);
  if(Number.isInteger(c.market_cap_rank)&&c.market_cap_rank>=1&&c.market_cap_rank<=scope)ranks.add(c.market_cap_rank);
 }
 const missingRanks=Array.from({length:scope},(_,i)=>i+1).filter(r=>!ranks.has(r));
 return {marketCount:ids.size,duplicates,missingRanks,top500Missing:missingRanks.filter(r=>r<=500)};
}
export function repairPages(coverage,pageSize,limit=2){
 return [...new Set(coverage.missingRanks.map(r=>Math.ceil(r/pageSize)))].slice(0,limit);
}
export function improvesCoverage(before,after){
 // Never trade away top-500 coverage or introduce duplicate IDs to fill a gap.
 const preserved=after.top500Missing.every(r=>before.top500Missing.includes(r));
 return preserved&&after.duplicates<=before.duplicates&&after.marketCount>=before.marketCount&&after.missingRanks.length<before.missingRanks.length;
}
export function researchStatus(rows, canceled, stage){
 const c=rankCoverage(rows,500);
 const ranked=rows.filter(r=>Number.isInteger(r.market_cap_rank)&&r.market_cap_rank>=1&&r.market_cap_rank<=500);
 const uniqueIds=new Set(ranked.map(r=>r.id));
 return {status:canceled&&stage==="market"&&c.top500Missing.length?"Canceled":c.top500Missing.length||ranked.length!==500||uniqueIds.size!==500?"Partial":"Complete",covered:500-c.top500Missing.length,missing:c.top500Missing};
}

// Local display ranks fill gaps only with actual fetched records. Provider rank stays unchanged.
export function assignDisplayRanks(rows,scope){
 const validRank=r=>Number.isSafeInteger(r)&&r>0;
 const cap=c=>typeof c.market_cap==="number"&&Number.isFinite(c.market_cap)&&c.market_cap>0?c.market_cap:-1;
 const byCap=(a,b)=>cap(b)-cap(a)||a.id.localeCompare(b.id);
 const market=rows.filter(c=>c.marketMember===true).sort(byCap);
 const extras=rows.filter(c=>c.marketMember!==true).sort((a,b)=>{
  if(a.dataSource!==b.dataSource)return a.dataSource==="STATIC"?1:b.dataSource==="STATIC"?-1:byCap(a,b);
  return byCap(a,b);
 });
 const assigned=new Map(),used=new Set(),pending=[];
 for(const c of market){
  const r=c.market_cap_rank;
  if(validRank(r)&&r<=scope&&!used.has(r)){
   assigned.set(c.id,{displayRank:r,rankSource:"COINGECKO"});used.add(r);
  }else pending.push(c);
 }
 let next=1;
 for(const c of pending){
  while(used.has(next))next++;
  assigned.set(c.id,{displayRank:next,rankSource:"FALLBACK"});used.add(next);
 }
 let extraRank=Math.max(scope,...used)+1;
 for(const c of extras){
  assigned.set(c.id,{displayRank:extraRank++,rankSource:"WATCHLIST POSITION"});
 }
 return rows.map(c=>({...c,...assigned.get(c.id)}));
}
