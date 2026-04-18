export default async function handler(req, res) {
  try {
    const { page, ids } = req.query;

    let url = "https://api.coingecko.com/api/v3/coins/markets";

    const params = new URLSearchParams({
      vs_currency: "usd",
      sparkline: "false",
    });

    if (ids) {
      params.append("ids", ids);
    } else {
      params.append("order", "market_cap_desc");
      params.append("per_page", "250");
      params.append("page", page || "1");
    }

    const response = await fetch(`${url}?${params.toString()}`);
    const data = await response.json();

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch data" });
  }
}
