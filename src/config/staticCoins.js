// Historical research checked 2026-11-24. Supply values are provider-reported historical
// figures, not current circulating supply. Never substitute a static price for a live quote.
export const staticCoins = [
 {id:"moonchain", aliases:["mxc"], name:"MXC", symbol:"mxc", sector:"DePIN", projectStatus:"INACTIVE MARKETS", ath:0.1335, ath_date:"2022-01-19", atl:0.000001909, historicalCirculating:3250845877, historicalTotal:null, historicalMax:null, researchDate:"2026-11-24", sourceUrl:"https://www.coingecko.com/en/coins/moonchain", secondarySource:"https://coinstats.app/coins/mxc/", notes:"CoinGecko reports no active trading pairs. Migration/token identity must be verified against wallet contract."},
 {id:"shiden", aliases:["shiden-network"], name:"Shiden Network", symbol:"sdn", sector:"Layer 1", projectStatus:"DECLINING", ath:8.41, ath_date:"2021-09-11", atl:0.00418, historicalCirculating:68731320, historicalTotal:87962763, historicalMax:null, researchDate:"2026-11-24", sourceUrl:"https://cryptoslate.com/coins/shiden-network/", secondarySource:"https://forum.astar.network/t/wasm-smart-contract-sunset-on-astar-and-shiden/9516", notes:"ATH/ATL from CryptoSlate (CoinMarketCap data); supply from May 2026 snapshot. WASM sunset does not establish a full chain shutdown."},
 {id:"buy-the-dip", aliases:["senor-dip"], name:"Buy the DIP", symbol:"dip", sector:"Meme", projectStatus:"LOW LIQUIDITY", ath:0.00336, ath_date:"2024-04-30", atl:0.0002061, historicalCirculating:10000000000, historicalTotal:10000000000, historicalMax:10000000000, researchDate:"2026-11-24", sourceUrl:"https://www.coingecko.com/en/coins/buy-the-dip", secondarySource:"https://www.theblock.co/price/buy-the-dip", notes:"Cronos token; contract 0x9be47e9dca99a6f5cb3666d079571ec229ae2ca4. Thin trading; check wallet contract and executable quote."},
 {id:"step-app", aliases:[], name:"Step App", symbol:"fitfi", sector:"Move-to-Earn", projectStatus:"SHUTDOWN", ath:0.7319, ath_date:"2022-05-05", atl:0.00000104, historicalCirculating:4600000000, historicalTotal:null, historicalMax:null, researchDate:"2026-11-24", sourceUrl:"https://www.coingecko.com/en/coins/step-app", secondarySource:"https://cointelegraph.com/news/step-app-winds-down-four-years-move-to-earn", notes:"Services announced to end August 21, 2026. Residual token trading may continue."}
];
export function knownCoin(id) {
 return staticCoins.find(c=>c.id===id||c.aliases.includes(id));
}
export function canonicalId(id) {
 return knownCoin(id)?.id||id;
}
export function lookupIds(ids) {
 return [...new Set(ids.flatMap(id=>{const c=knownCoin(id);return c?[c.id,...c.aliases]:[id];}))];
}
export function positivePrice(c) {
 return typeof c?.current_price==="number" && Number.isFinite(c.current_price) && c.current_price>0;
}
export function annotateLive(c) {
 const known=knownCoin(c.id);
 if(known && String(c.symbol).toLowerCase()!==known.symbol) return null;
 const metadata=known?{sector:known.sector,projectStatus:known.projectStatus,researchDate:known.researchDate,sourceUrl:known.sourceUrl,secondarySource:known.secondarySource,notes:known.notes,legacyIds:known.aliases.join(", "),historicalCirculating:known.historicalCirculating,historicalTotal:known.historicalTotal,historicalMax:known.historicalMax}:{};
 return {...c,...metadata,id:known?.id||c.id,providerId:c.id,dataSource:"LIVE"};
}
export function staticFallback(id) {
 const c=knownCoin(id);
 if(!c)return null;
 const {aliases,...history}=c;
 return {...history,legacyIds:aliases.join(", "),providerId:null,dataSource:"STATIC",market_cap_rank:null,current_price:null,market_cap:null,total_volume:null,fully_diluted_valuation:null,circulating_supply:null,total_supply:null,max_supply:null,last_updated:null,fetched:null};
}
