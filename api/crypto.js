export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({error:"GET only"}); }
  const { page = "1", ids } = req.query;
  if (typeof page !== "string" || !/^\d+$/.test(page) || Number(page)<1 || Number(page)>12 ||
      (ids !== undefined && (typeof ids !== "string" || !ids.trim()))) {
    return res.status(400).json({error:"Invalid page or IDs"});
  }
  const unique = ids ? [...new Set(ids.split(",").map(x=>x.trim()).filter(Boolean))] : [];
  if (ids && (!unique.length || unique.length>50 || unique.some(x=>!/^[-a-zA-Z0-9_]+$/.test(x)))) return res.status(400).json({error:"Invalid IDs (maximum 50)"});
  const params = new URLSearchParams({vs_currency:"usd",order:"market_cap_desc",per_page:"250",page:ids?"1":page,sparkline:"false",price_change_percentage:"7d,30d,200d,1y",precision:"full"});
  if(ids) params.set("ids",unique.join(","));
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try {
    const response=await fetch("https://api.coingecko.com/api/v3/coins/markets?"+params,{signal:controller.signal,headers:{accept:"application/json"}});
    if(!response.ok){
      const retry=response.headers.get("retry-after");
      if(retry) res.setHeader("Retry-After",retry);
      return res.status(response.status).json({error:"CoinGecko returned HTTP "+response.status});
    }
    const data=await response.json();
    if(!Array.isArray(data)) return res.status(502).json({error:"Unexpected CoinGecko response"});
    return res.status(200).json(data);
  } catch(error) {
    return res.status(error.name==="AbortError"?504:502).json({error:"CoinGecko request failed"});
  } finally {clearTimeout(timer);}
}
