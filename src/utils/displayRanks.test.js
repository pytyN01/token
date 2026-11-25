import {assignDisplayRanks,rankCoverage} from "./rankCoverage";
const row=(id,rank,cap)=>({id,market_cap_rank:rank,market_cap:cap,marketMember:true});
test("fills rank 1000 without changing provider rank",()=>{
 const rows=Array.from({length:1000},(_,i)=>row("coin-"+i,i===999?1001:i+1,1000-i));
 const result=assignDisplayRanks(rows,1000);
 expect(result[999]).toMatchObject({displayRank:1000,market_cap_rank:1001,rankSource:"FALLBACK"});
 expect(new Set(result.map(c=>c.displayRank)).size).toBe(1000);
 expect(rankCoverage(result.map(c=>({...c,market_cap_rank:c.displayRank})),1000).missingRanks).toEqual([]);
});
test("duplicate and null ranks fill open positions in cap order",()=>{
 const result=assignDisplayRanks([row("a",1,20),row("b",1,10),row("c",null,5)],3);
 expect(result.map(c=>c.displayRank)).toEqual([1,2,3]);
 expect(result.map(c=>c.rankSource)).toEqual(["COINGECKO","FALLBACK","FALLBACK"]);
});
test("watchlist and static records get local positions beyond the market range",()=>{
 const result=assignDisplayRanks([row("a",1,20),{id:"history",dataSource:"STATIC"},{id:"extra",dataSource:"LIVE",market_cap_rank:999,market_cap:10}],500);
 expect(result.map(c=>c.displayRank)).toEqual([1,502,501]);
 expect(result[1].rankSource).toBe("WATCHLIST POSITION");
 expect(result[2].market_cap_rank).toBe(999);
});
test("missing records are not invented",()=>{
 const result=assignDisplayRanks([row("a",1,20),row("b",3,10)],4);
 expect(rankCoverage(result.map(c=>({...c,market_cap_rank:c.displayRank})),4).missingRanks).toEqual([2,4]);
});
