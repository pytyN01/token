import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const pageCount = 12;
const countPerPage = 250;
const delayPerRequest = 12000;
const extraCoinRequest = 15000;

const extraCoinIds = [
  "boson-protocol", "capybara-nation", "senor-dip", "levva-protocol",
  "space-and-time", "cropto-barley-token", "crob-coin", "lybra-finance", "sudoswap"
];

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
  const [visibleCount, setVisibleCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [doneLoadingAll, setDoneLoadingAll] = useState(false);

  const countdownInterval = useRef(null);
  const endTime = useRef(null);
  const rowDelayRef = useRef(37); // start at 30ms

  // Countdown timer
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

  // Fetch all data in the background
  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        let allData = [];
        for (let p = 1; p <= pageCount; p++) {
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
              signal: controller.signal,
            }
          );
          allData = [...allData, ...response.data];
          setCryptoData([...allData]); // update immediately
          rowDelayRef.current = Math.max(1, rowDelayRef.current - 3);
          await sleep(delayPerRequest);
        }

        // Fetch extra coins
        const extraResponse = await axios.get(
          "https://api.coingecko.com/api/v3/coins/markets",
          {
            params: {
              vs_currency: "usd",
              ids: extraCoinIds.join(","),
              sparkline: false,
            },
          }
        );
        allData = [...allData, ...extraResponse.data];
        setCryptoData([...allData]);

        clearInterval(countdownInterval.current);
        setCountdown(0);
        setDoneLoadingAll(true);

      } catch (err) {
        if (!axios.isCancel(err)) {
          console.error("Error fetching crypto data:", err);
          setError("Error fetching data. Please try again later.");
          setCryptoData([]);
          clearInterval(countdownInterval.current);
        }
      }
    };

    fetchData();
    return () => controller.abort();
  }, []);

  // Cascading display effect
  useEffect(() => {
    if (cryptoData.length > 0) {
      const interval = setInterval(() => {
        setVisibleCount((prev) => {
          if (prev < cryptoData.length) return prev + 1;
          clearInterval(interval);
          return prev;
        });
      }, rowDelayRef.current); // 50ms between rows
      return () => clearInterval(interval);
    }
  }, [cryptoData]);

  return (
    <div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!doneLoadingAll && (
        <p aria-live="polite">
          Loading top {pageCount * countPerPage + extraCoinIds.length} results...{" "}
          {visibleCount} loaded... {formatTime(countdown)} minutes left. ⏳
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
          0% { opacity: 0; transform: translateY(5px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .fade-row {
          opacity: 0;
          animation: fadeInRow .5s ease forwards;
        }
      `}</style>
    </div>
  );
};

export default Home;
