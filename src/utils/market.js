export const number = v => typeof v === "number" && Number.isFinite(v) ? v : null;
export const ratio = (a,b) => number(a)!==null && number(b)!==null && b>0 ? a/b : null;
export const product = (a,b) => number(a)!==null && number(b)!==null ? a*b : null;
export const columns = [
  ["Snapshot ID","snapshot"],["Scan status","status"],["Fetched UTC","fetched"],["Coin ID","id"],["Rank","market_cap_rank"],["Name","name"],["Symbol","symbol"],["Watchlist","watchlist"],["Top 500","eligible"],
  ["Price USD","current_price"],["Market cap USD","market_cap"],["FDV USD","fully_diluted_valuation"],["24h volume USD","total_volume"],
  ["Circulating supply","circulating_supply"],["Total supply","total_supply"],["Max supply","max_supply"],["FDV / cap","fdvRatio"],["Volume / cap","volumeRatio"],["Circulating / max","supplyRatio"],
  ["ATH USD","ath"],["ATH date","ath_date"],["ATH recovery X","athX"],["ATH drawdown %","ath_change_percentage"],["ATH required cap USD","athCap"],
  ["ATL USD","atl"],["ATL date","atl_date"],["24h %","price_change_percentage_24h"],["7d %","price_change_percentage_7d_in_currency"],["30d %","price_change_percentage_30d_in_currency"],["200d %","price_change_percentage_200d_in_currency"],["1y %","price_change_percentage_1y_in_currency"],["Provider updated UTC","last_updated"]
];
export function enrich(c, snapshot, watchlist, status) {
 return {...c, snapshot,status,watchlist:watchlist.has(c.id)?"Yes":"No",eligible:number(c.market_cap_rank)!==null&&c.market_cap_rank>=1&&c.market_cap_rank<=500?"Yes":"No",fdvRatio:ratio(c.fully_diluted_valuation,c.market_cap),volumeRatio:ratio(c.total_volume,c.market_cap),supplyRatio:ratio(c.circulating_supply,c.max_supply),athX:ratio(c.ath,c.current_price),athCap:product(c.ath,c.circulating_supply)};
}
export function cell(v) {
 if(v===null||v===undefined||typeof v==="number"&&!Number.isFinite(v)) return "";
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
