// Example: Next.js / Express API route

import axios from "axios";

export default async function handler(req, res) {
  const { page = 1, ids } = req.query;

  try {
    // If requesting specific IDs (extra coins)
    if (ids) {
      const idArray = ids.split(",");

      const results = await Promise.all(
        idArray.map(async (id) => {
          try {
            const { data } = await axios.get(
              `https://api.coincap.io/v2/assets/${id}`
            );

            const coin = data.data;

            return {
              id: coin.id,
              name: coin.name,
              symbol: coin.symbol,
              current_price: Number(coin.priceUsd),
              ath: null, // CoinCap does NOT provide ATH
              ath_date: null,
              market_cap_rank: null,
            };
          } catch {
            return null;
          }
        })
      );

      return res.json(results.filter(Boolean));
    }

    // Paginated list
    const limit = 250;
    const offset = (page - 1) * limit;

    const { data } = await axios.get(
      `https://api.coincap.io/v2/assets?limit=${limit}&offset=${offset}`
    );

    const formatted = data.data.map((coin, index) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      current_price: Number(coin.priceUsd),
      ath: null, // missing
      ath_date: null,
      market_cap_rank: offset + index + 1,
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch crypto data" });
  }
}
