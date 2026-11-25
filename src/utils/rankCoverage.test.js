import {rankCoverage,repairPages,improvesCoverage,researchStatus} from "./rankCoverage";
const rows=Array.from({length:1000},(_,i)=>({id:"coin-"+(i+1),market_cap_rank:i+1}));
const gap=rows.map(c=>c.market_cap_rank===998?{...c,market_cap_rank:1001}:c.market_cap_rank===1000?{...c,market_cap_rank:1002}:c);
test("two missing lower ranks still permit complete top 500 coverage",()=>{
 const coverage=rankCoverage(gap,1000);
 expect(coverage.marketCount).toBe(1000);
 expect(coverage.missingRanks).toEqual([998,1000]);
 expect(repairPages(coverage,250)).toEqual([4]);
 expect(researchStatus(gap,false,"watchlist")).toEqual({status:"Complete",covered:500,missing:[]});
 expect(improvesCoverage(coverage,rankCoverage(rows,1000))).toBe(true);
});
test("no improvement or loss of top 500 coverage is rejected",()=>{
 const before=rankCoverage(gap,1000);
 expect(improvesCoverage(before,before)).toBe(false);
 const regression=rows.map(c=>c.market_cap_rank===1?{...c,market_cap_rank:1001}:c);
 expect(improvesCoverage(before,rankCoverage(regression,1000))).toBe(false);
});
test("duplicates and missing top 500 ranks are not complete",()=>{
 expect(researchStatus(rows.slice(1),false,"market").status).toBe("Partial");
 expect(researchStatus([...rows,rows[0]],false,"watchlist").status).toBe("Partial");
 expect(rankCoverage([...rows,rows[0]],1000).duplicates).toBe(1);
});
