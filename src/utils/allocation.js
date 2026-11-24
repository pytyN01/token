export function allocate(budget, rows) {
  if (!Number.isSafeInteger(budget) || budget < 20 || budget > 1000000) throw new Error("Enter a whole-dollar budget from $20 to $1,000,000.");
  if (rows.length !== 20 || new Set(rows.map(r=>r.id)).size !== 20 || rows.some(r=>!r.id || !Number.isFinite(r.roi))) throw new Error("Enter exactly 20 unique coin IDs with numeric expected ROI percentages.");
  const sorted=[...rows].sort((a,b)=>b.roi-a.roi || a.id.localeCompare(b.id));
  // Reserve $1 per coin, then distribute the remainder by rank.
  const weights=sorted.map((_,i)=>i===0?7:i<5?5:i<13?4:3);
  const remaining=budget-20;
  const shares=sorted.map((r,i)=>({...r,rank:i+1,amount:1+Math.floor(remaining*weights[i]/80),fraction:(remaining*weights[i])%80}));
  const left=budget-shares.reduce((s,r)=>s+r.amount,0);
  [...shares].sort((a,b)=>b.fraction-a.fraction || a.rank-b.rank).slice(0,left).forEach(r=>r.amount++);
  return shares.map(({fraction,...r})=>r);
}
