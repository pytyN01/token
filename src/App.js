import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const pageCount = 12;
const countPerPage = 250;
const delayPerRequest = 12000;   // keep API pacing
const extraCoinRequest = 15000;  // used for initial ETA only

const extraCoinIds = [
  "boson-protocol", "capybara-nation", "senor-dip", "levva-protocol",
  "space-and-time", "cropto-barley-token", "crob-coin", "lybra-finance", "sudoswap"
];

const TOTAL_ROWS = pageCount * countPerPage + extraCoinIds.length;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const toDecimalString = (num) => {
  const parsed = Number(num);
  if (isNaN(parsed)) return num;
  return parsed.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const Home = () => {
  const [cryptoData, setCryptoData] = useState([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [doneLoadingAll, setDoneLoadingAll] = useState(false);

  // --- Refs for timing & rAF-driven cascade ---
  const waveStartRef = useRef(null);               // when fetch started
  const targetDurationRef = useRef(null);          // how long the cascade should take
  const rafRef = useRef(null);
  const cryptoLenRef = useRef(0);
  const visibleCountRef = useRef(0);
  const doneRef = useRef(false);

  // Countdown (for UX only, based on initial estimate)
  useEffect(() => {
    // initial ETA (rough) so the user has a clock
    const estimatedTime = (pageCount - 1) * delayPerRequest + extraCoinRequest;
    const endTime = Date.now() + estimatedTime;

    const t = setInterval(() => {
      const remaining = Math.max(Math.floor((endTime - Date.now()) / 1000), 0);
      setCountdown(remaining);
    }, 1000);

    return () => clearInterval(t);
  }, []);

  // Keep refs in sync
  useEffect(() => { cryptoLenRef.current = cryptoData.length; }, [cryptoData]);
  useEffect(() => { visibleCountRef.current = visibleCount; }, [visibleCount]);
  useEffect(() => { doneRef.current = doneLoadingAll; }, [doneLoadingAll]);

  // Fetch data (paged) and measure actual duration
  useEffect(() => {
    const controller = new AbortController();

    const fetchAll = async () => {
      try {
        waveStartRef.current = Date.now();

        let all = [];
        for (let p = 1; p <= pageCount; p++) {
          const resp = await axios.get(
            "https://api.coingecko.com/api/v3/coins/markets",
            {
              params: {
                vs_currency: "usd",
                order: "market_cap_desc",
                per_page: countPerPage,
                page: p,
                sparkline: false,
              },
              signal: controller.signal,
            }
          );
          all = all.concat(resp.data);
          setCryptoData(all); // append immediately so the cascade can keep flowing
          await sleep(delayPerRequest); // respect API pacing
        }

        // Extra coins
        const extraResp = await axios.get(
          "https://api.coingecko.com/api/v3/coins/markets",
          {
            params: {
              vs_currency: "usd",
              ids: extraCoinIds.join(","),
              sparkline: false,
            },
          }
        );
        all = all.concat(extraResp.data);
        setCryptoData(all);

        // Actual fetch time; make the wave finish slightly after fetch
        const actualFetchMs = Date.now() - waveStartRef.current;
        targetDurationRef.current = Math.max(actualFetchMs * 1.05, 2000); // never absurdly small
        setDoneLoadingAll(true);
        setCountdown(0);
      } catch (err) {
        if (!axios.isCancel(err)) {
          console.error("Error fetching crypto data:", err);
          setError("Error fetching data. Please try again later.");
          setCryptoData([]);
        }
      }
    };

    fetchAll();
    return () => controller.abort();
  }, []);

  // Adaptive cascade driven by requestAnimationFrame
  useEffect(() => {
    // Start with a reasonable guess so we don't go too slow at first.
    // If the network is faster/slower, we’ll correct when fetch completes.
    if (!targetDurationRef.current) {
      // Heuristic: assume it'll take about half of the theoretical delay budget.
      const heuristic = Math.max(((pageCount - 1) * delayPerRequest) * 0.5, 10000);
      targetDurationRef.current = heuristic;
    }
    if (!waveStartRef.current) {
      waveStartRef.current = Date.now();
    }

    const tick = (now) => {
      const total = TOTAL_ROWS;
      const loaded = cryptoLenRef.current; // how many rows we can show at most right now
      const elapsed = now - waveStartRef.current;
      const duration = targetDurationRef.current;

      // Global schedule: how many rows should be visible by now if we want to finish in `duration`
      let shouldBeVisible = Math.floor((elapsed / duration) * total);
      if (shouldBeVisible > total) shouldBeVisible = total;

      // We can't show more than what's loaded
      const maxVisibleNow = Math.min(shouldBeVisible, loaded);
      const currentVisible = visibleCountRef.current;

      if (maxVisibleNow > currentVisible) {
        // Reveal the difference in one go (can be >1 if we're behind)
        setVisibleCount(maxVisibleNow);
      }

      // Stop when everything is shown and fetch is done
      if (doneRef.current && visibleCountRef.current >= total) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!doneLoadingAll && (
        <p aria-live="polite">
          Loading top {TOTAL_ROWS} results... {visibleCount} on screen... {formatTime(countdown)} minutes left. ⏳
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
          {cryptoData.slice(0, visibleCount).map((crypto, index) => (
            <tr key={crypto.id} className="fade-row">
              <td>{crypto.market_cap_rank ?? index + 1}</td>
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

      <style>{`
        @keyframes fadeInRow {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .fade-row {
          opacity: 0;
          animation: fadeInRow 0.35s ease forwards;
          will-change: opacity, transform;
        }
      `}</style>
    </div>
  );
};

export default Home;
