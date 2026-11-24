import {canonicalId,lookupIds,annotateLive,positivePrice,staticFallback,knownCoin} from "./staticCoins";
import {enrich,tsv} from "../utils/market";
test("aliases canonicalize and lookup tries both IDs",()=>{
 expect(canonicalId("senor-dip")).toBe("buy-the-dip");
 expect(lookupIds(["moonchain","mxc"])).toEqual(["moonchain","mxc"]);
 expect(lookupIds(["shiden"])).toEqual(["shiden","shiden-network"]);
});
test("live positive prices survive alias resolution and mismatched symbols are rejected",()=>{
 const c=annotateLive({id:"senor-dip",symbol:"dip",current_price:0.0002});
 expect(c.id).toBe("buy-the-dip");
 expect(c.providerId).toBe("senor-dip");
 expect(positivePrice(c)).toBe(true);
 expect(annotateLive({id:"senor-dip",symbol:"wrong"})).toBeNull();
});
test.each(["moonchain","shiden","buy-the-dip","step-app"])("static %s is not a valuation or candidate",id=>{
 const c=enrich(staticFallback(id),"2026-11-24T00:00:00Z",new Set([id]),"Complete","Partial");
 expect(c.dataSource).toBe("STATIC");
 expect(c.current_price).toBeNull();
 expect(c.circulating_supply).toBeNull();
 expect(c.athX).toBeNull();
 expect(c.athCap).toBeNull();
 expect(c.eligible).toBe("No");
 expect(c.investmentEligibility).toBe("NO");
 expect(c.priceStatus).toBe("UNAVAILABLE");
 expect(c.watchlist).toBe("Yes");
 expect(tsv(["Price"],[[c.current_price]])).toBe("Price\r\n");
 expect(knownCoin(id)).toBeDefined();
});
test("ordinary live prices are only candidates for research",()=>{
 const c=enrich({id:"bitcoin",current_price:60000,market_cap_rank:1,last_updated:"2026-11-24T00:00:00Z",fetched:"2026-11-24T00:01:00Z"},"2026-11-24T00:00:00Z",new Set(),"Complete","Complete");
 expect(c.investmentEligibility).toBe("RESEARCH REQUIRED");
 expect(c.priceStatus).toBe("CURRENT");
});
