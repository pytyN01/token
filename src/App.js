import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const pageCount = 12;
const countPerPage = 250;
const delayPerRequest = 12000;
const extraCoinRequest = 15000;

const extraCoinIds = [
  "boson-protocol",
  "capybara-nation",
  "senor-dip",
  "levva-protocol",
  "space-and-time",
  "cropto-barley-token",
  "crob-coin",
  "lybra-finance",
  "sudoswap",
];

// Tune these:
const cascadeDelay = 150; // ms between each row in a batch
const maxCascadeTotalDelay = 37500; // cap total per-batch delay so rows aren't hidden for ages
const animationDuration = 37500; // animation duration in ms

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
  const [doneLoadingAll, setDoneLoadingAll] = useState(false);

  // batches: record where each fetched batch started so we can animate only the new batch
  const [batches, setBatches] = useState([]); // { start, length, id }
  const [animatingBatchId, setAnimatingBatchId] = useState(null);

  const countdownInterval = useRef(null);
  const endTime = useRef(null);

  // helpers / refs for fetch control & timers
  const controllerRef = useRef(null);
  const cancelledRef = useRef(false);
  const batchIdCounterRef = useRef(0);
  const timersRef = useRef([]);

  useEffect(() => {
    const estimatedTime = (pageCount - 1) * delayPerRequest + extraCoinRequest;
    endTime.current = Date.now() + estimatedTime;

    countdownInterval.current = setInterval(() => {
      const remaining = Math.max(
        Math.floor((endTime.current - Date.now()) / 1000),
        0
      );
      setCountdown(remaining);
    }, 1000);

    return () => clearInterval(countdownInterval.current);
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    controllerRef.current = new AbortController();

    const clearAllTimers = () => {
      (timersRef.current || []).forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };

    const fetchExtraCoins = async () => {
      try {
        const start = Date.now();
        const response = await axios.get(
          "https://api.coingecko.com/api/v3/coins/markets",
          {
            params: {
              vs_currency: "usd",
              ids: extraCoinIds.join(","),
              sparkline: false,
            },
            signal: controllerRef.current.signal,
          }
        );
        if (cancelledRef.current) return;

        const resData = response.data;
        const batchId = ++batchIdCounterRef.current;

        // Append data and register batch start/length
        setCryptoData((prev) => {
          const startIndex = prev.length;
          setBatches((b) => [...b, { start: startIndex, length: resData.length, id: batchId }]);
          return [...prev, ...resData];
        });
        setCount((c) => c + resData.length);

        // animate this batch, then clear animating flag after it finishes
        setAnimatingBatchId(batchId);
        const cascadeTotal = Math.min(resData.length * cascadeDelay, maxCascadeTotalDelay) + animationDuration;
        const t = setTimeout(() => setAnimatingBatchId(null), cascadeTotal);
        timersRef.current.push(t);

        // we're done
        clearInterval(countdownInterval.current);
        setCountdown(0);
        setDoneLoadingAll(true);
      } catch (err) {
        if (axios.isCancel(err)) {
          console.log("Extra coins fetch canceled", err.message);
        } else {
          console.error("Error fetching extra coins:", err);
        }
      }
    };

    // Recursive fetcher that schedules next page based on elapsed time
    const fetchPage = async (p) => {
      const fetchStart = Date.now();
      try {
        const response = await axios.get(
          "https://api.coingecko.com/api/v3/coins/markets",
          {
            params: {
              vs_currency: "usd",
              order: "market_cap_desc",
              per_page: countPerPage,
              page: p,
              sparkline: false,
            },
            signal: controllerRef.current.signal,
          }
        );

        if (cancelledRef.current) return;
        const resData = response.data;
        const batchId = ++batchIdCounterRef.current;

        // Append data and register batch start/length
        setCryptoData((prev) => {
          const startIndex = prev.length;
          setBatches((b) => [...b, { start: startIndex, length: resData.length, id: batchId }]);
          return [...prev, ...resData];
        });
        setCount((c) => c + resData.length);

        // Animate only this new batch (so previously added rows are not reanimated)
        setAnimatingBatchId(batchId);
        const cascadeTotal = Math.min(resData.length * cascadeDelay, maxCascadeTotalDelay) + animationDuration;
        const tClear = setTimeout(() => setAnimatingBatchId(null), cascadeTotal);
        timersRef.current.push(tClear);

        // schedule next fetch: ensure roughly `delayPerRequest` between *start times*
        const elapsed = Date.now() - fetchStart;
        const wait = Math.max(0, delayPerRequest - elapsed);

        if (p < pageCount) {
          const tNext = setTimeout(() => fetchPage(p + 1), wait);
          timersRef.current.push(tNext);
        } else {
          // after last page, schedule extra coins fetch
          const tExtra = setTimeout(() => fetchExtraCoins(), wait);
          timersRef.current.push(tExtra);
        }
      } catch (err) {
        if (axios.isCancel(err)) {
          console.log("Request canceled:", err.message);
        } else {
          console.error("Error fetching crypto data:", err);
          setError("Error fetching data. Please try again later.");
          setCryptoData([]);
          clearInterval(countdownInterval.current);
        }
      }
    };

    // start at page 1
    fetchPage(1);

    return () => {
      // cleanup on unmount
      cancelledRef.current = true;
      controllerRef.current?.abort?.();
      clearInterval(countdownInterval.current);
      clearAllTimers();
    };
    // run once on mount
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // helper to find batch for a global index (small number of batches so linear scan is fine)
  const findBatchForIndex = (index) => {
    for (let i = 0; i < batches.length; i++) {
      const b = batches[i];
      if (index >= b.start && index < b.start + b.length) return b;
    }
    return null;
  };

  // CSS for fade effect (you can move to your CSS file instead)
  const css = `
    .fade-row {
      opacity: 0;
      transform: translateY(8px);
      animation-name: fadeInRow;
      animation-fill-mode: forwards;
      animation-timing-function: ease;
      animation-duration: ${animationDuration}ms;
      will-change: opacity, transform;
    }
    @keyframes fadeInRow {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;

  return (
    <div>
      {/* inject CSS here or move to an external file and import */}
      <style>{css}</style>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {!doneLoadingAll && (
        <p aria-live="polite">
          Loading top {pageCount * countPerPage + extraCoinIds.length} results... {count} loaded...{" "}
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
          {cryptoData.map((crypto, index) => {
            const batch = findBatchForIndex(index);
            const localIndex = batch ? index - batch.start : 0;
            const isAnimating = batch && batch.id === animatingBatchId;
            // per-item delay (cap it so late rows are still visible quickly)
            const perItemDelay = Math.min(localIndex * cascadeDelay, maxCascadeTotalDelay);

            return (
              <tr
                key={crypto.id}
                className={isAnimating ? "fade-row" : ""}
                style={isAnimating ? { animationDelay: `${perItemDelay}ms` } : {}}
              >
                <td>{crypto.market_cap_rank ?? index + 1}</td>
                <td>{crypto.name}</td>
                <td>{crypto.symbol.toUpperCase()}</td>
                <td>${toDecimalString(crypto.current_price)}</td>
                <td>${toDecimalString(crypto.ath)}</td>
                <td>{new Date(crypto.ath_date).toLocaleDateString()}</td>
                <td>{(crypto.ath / crypto.current_price).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default Home;
