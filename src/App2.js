import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const pageCount = 18;
const countPerPage = 250;
const maxConcurrent = 5;
const delayBetweenBatches = 1000; // 1 second

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const toDecimalString = (num) => {
  const parsed = Number(num);
  if (isNaN(parsed)) return num;
  return parsed.toLocaleString("en-US", {
    useGrouping: false,
    maximumFractionDigits: 20,
  });
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const Home = () => {
  const [cryptoData, setCryptoData] = useState([]);
  const [count, setCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const countdownInterval = useRef(null);
  const endTime = useRef(null);

  useEffect(() => {
    const estimatedSeconds = Math.ceil((pageCount / maxConcurrent) * (delayBetweenBatches / 1000)) + 3;
    endTime.current = Date.now() + estimatedSeconds * 1000;

    countdownInterval.current = setInterval(() => {
      const remaining = Math.max(
        Math.floor((endTime.current - Date.now()) / 1000),
        0
      );
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownInterval.current);
      }
    }, 1000);

    fetchAllData();

    return () => clearInterval(countdownInterval.current);
  }, []);

  const fetchAllData = async () => {
    const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
    const results = [];

    try {
      for (let i = 0; i < pages.length; i += maxConcurrent) {
        const batch = pages.slice(i, i + maxConcurrent);
        const batchResults = await Promise.all(
          batch.map((page) =>
            axios.get("https://api.coingecko.com/api/v3/coins/markets", {
              params: {
                vs_currency: "usd",
                order: "market_cap_desc",
                per_page: countPerPage,
                page,
                sparkline: false,
              },
            })
          )
        );

        results.push(...batchResults.flatMap((r) => r.data));
        setCount(results.length); // update progressively

        if (i + maxConcurrent < pages.length) {
          await sleep(delayBetweenBatches);
        }
      }

      setCryptoData(results);
      setCountdown(0);
    } catch (err) {
      console.error("Error fetching crypto data:", err);
      setError("Error fetching data. Please try again later.");
    }
  };

  return (
    <div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {count < pageCount * countPerPage && (
        <p aria-live="polite">
          Loading top {pageCount * countPerPage} results... {count} loaded...{" "}
          {formatTime(countdown)} minutes left. ⏳
        </p>
      )}

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Symbol</th>
            <th>Current Price (USD)</th>
            <th>All-Time High (USD)</th>
            <th>ATH Date</th>
            <th>X</th>
          </tr>
        </thead>
        <tbody>
          {cryptoData.map((crypto, index) => (
            <tr key={crypto.id}>
              <td>{index + 1}</td>
              <td>{crypto.name}</td>
              <td>{crypto.symbol.toUpperCase()}</td>
              <td>${toDecimalString(crypto.current_price)}</td>
              <td>${toDecimalString(crypto.ath)}</td>
              <td>{new Date(crypto.ath_date).toLocaleDateString()}</td>
              <td>{(crypto.ath / crypto.current_price).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Home;
