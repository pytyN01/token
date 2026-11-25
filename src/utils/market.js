import {positivePrice,knownCoin} from "../config/staticCoins";

export const number = v => typeof v === "number" && Number.isFinite(v) ? v : null;
export const ratio = (a,b) => number(a)!==null && number(b)!==null && b>0 ? a/b : null;
export const product = (a,b) => number(a)!==null && number(b)!==null ? a*b : null;
export const columns = [
  ["Snapshot ID","snapshot"],["Scan status","status"],["Fetched UTC","fetched"],["Coin ID","id"],["Rank","market_cap_rank"],["Name","name"],["Symbol","symbol"],["Watchlist","watchlist"],["Top 500","eligible"],
  ["Price USD","current_price"],["Market cap USD","market_cap"],["FDV USD","fully_diluted_valuation"],["24h volume USD","total_volume"],
  ["Circulating supply","circulating_supply"],["Total supply","total_supply"],["Max supply","max_supply"],["FDV / cap","fdvRatio"],["Volume / cap","volumeRatio"],["Circulating / max","supplyRatio"],
  ["ATH USD","ath"],["ATH date","ath_date"],["ATH recovery X","athX"],["ATH drawdown %","ath_change_percentage"],["ATH required cap USD","athCap"],
  ["ATL USD","atl"],["ATL date","atl_date"],["24h %","price_change_percentage_24h"],["7d %","price_change_percentage_7d_in_currency"],["30d %","price_change_percentage_30d_in_currency"],["200d %","price_change_percentage_200d_in_currency"],["1y %","price_change_percentage_1y_in_currency"],["Provider updated UTC","last_updated"],["Watchlist status","watchStatus"],["Data source","dataSource"],["Project status","projectStatus"],["Price status","priceStatus"],["Research date","researchDate"],["Investment eligibility","investmentEligibility"],["Source URL","sourceUrl"],["Additional source URL","secondarySource"],["Provider coin ID","providerId"],["Legacy IDs","legacyIds"],["Sector (researched)","sector"],["Historical circulating supply","historicalCirculating"],["Historical total supply","historicalTotal"],["Historical max supply","historicalMax"],["Research notes","notes"],["Top 500 coverage status","researchStatus"]
];
export function enrich(c, snapshot, watchlist, status, watchStatus, researchStatus) {
 const isStatic=c.dataSource==="STATIC";
 const validPrice=positivePrice(c);
 const timestamp=Date.parse(c.last_updated);
 const priceStatus=!validPrice||isStatic?"UNAVAILABLE":!Number.isFinite(timestamp)?"UNVERIFIED":Date.parse(c.fetched||snapshot)-timestamp>86400000?"STALE":"CURRENT";
 const inUniverse=!isStatic&&c.marketMember!==false&&number(c.market_cap_rank)!==null&&c.market_cap_rank>=1&&c.market_cap_rank<=500;
 const investmentEligibility=(!inUniverse||knownCoin(c.id)||priceStatus!=="CURRENT")?"NO":"RESEARCH REQUIRED";
 return {...c,dataSource:c.dataSource||"LIVE",projectStatus:c.projectStatus||"UNKNOWN",priceStatus,investmentEligibility, snapshot,status,watchStatus,researchStatus,watchlist:watchlist.has(c.id)?"Yes":"No",eligible:inUniverse?"Yes":"No",fdvRatio:ratio(c.fully_diluted_valuation,c.market_cap),volumeRatio:ratio(c.total_volume,c.market_cap),supplyRatio:ratio(c.circulating_supply,c.max_supply),athX:ratio(c.ath,c.current_price),athCap:product(c.ath,c.circulating_supply)};
}
export function cell(v) {
 if(v===null||v===undefined||(typeof v==="number"&&!Number.isFinite(v))) return "";
 if(typeof v==="number") return v.toLocaleString("en-US",{useGrouping:false,maximumSignificantDigits:21});
 const s=String(v).replace(/[\t\r\n]/g," ");
 return /^[\s]*[=+\-@]/.test(s)?"'"+s:s;
}
export function tsv(headers,rows) {
 return [headers,...rows].map(row=>row.map(cell).join("\t")).join("\r\n");
}
export async function copyText(text) {
 if(!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable. Use the manual copy box.");
 await navigator.clipboard.writeText(text);
}

// Market coverage and optional watchlist coverage are independent.
export function scanStatuses({canceled,stage,marketErrors,watchErrors,missing,pagesOK,pages,shortPages,duplicateCount,marketCount,scope,missingRanks,include}) {
 const marketIncomplete=Boolean(marketErrors.length||shortPages||duplicateCount||pagesOK!==pages||marketCount!==scope||missingRanks.length);
 const marketStatus=canceled&&stage==="market"?"Canceled":marketIncomplete?"Partial":"Complete";
 const watchStatus=!include?"Skipped":canceled?"Canceled":watchErrors.length||missing.length?"Partial":"Complete";
 return {marketStatus,watchStatus};
}
