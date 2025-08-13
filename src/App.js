import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const pageCount = 12;
const countPerPage = 250;
const delayPerRequest = 12000;
const extraCoinRequest = 18000;
const totalRows = pageCount * countPerPage + 9; // 3009 rows
const animationDuration = 149000; // 2:29 minutes in ms

const extraCoinIds = [
  "boson-protocol",       // BOSON
  "capybara-nation",      // BARA
  "senor-dip",            // DIP
  "levva-protocol",       // LVVA
  "space-and-time",       // SXT
  "cropto-barley-token",  // CROB
  "crob-coin",            // CROB
  "lybra-finance",        // LBR
  "sudoswap",             // SUDO
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
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [doneLoadingAll, setDoneLoadingAll] = useState(false);
  const [visibleRows, setVisibleRows] = useState(0);

  const countdownInterval = useRef(null);
  const animationInterval = useRef(null);
  const endTime = useRef(null);
  const startTime = useRef(null);

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

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  // Start animation timer when first data arrives
  useEffect(() => {
    if (cryptoData.length > 0 && !startTime.current) {
      startTime.current = Date.now();
      
      animationInterval.current = setInterval(() => {
        const elapsed = Date.now() - startTime.current;
        const progress = Math.min(1, elapsed / animationDuration);
        const target = Math.floor(progress * totalRows);
        
        setVisibleRows(target);
        
        if (progress >= 1) {
          clearInterval(animationInterval.current);
        }
      }, 100);
    }
    
    return () => {
      if (animationInterval.current) {
        clearInterval(animationInterval.current);
      }
    };
  }, [cryptoData.length]);

  // Data fetching
  useEffect(() => {
    const controller = new AbortController();

    const fetchCryptoData = async () => {
      try {
        const response = await axios.get(
          "https://api.coingecko.com/api/v3/coins/markets",
          {
            params: {
              vs_currency: "usd",
              order: "market_cap_desc",
              per_page: countPerPage,
              page,
              sparkline: false,
            },
            signal: controller.signal,
          }
        );

        // Add new data with unique keys
        const newData = response.data.map((item, i) => ({
          ...item,
          uniqueKey: `${page}-${i}`
        }));

        setCryptoData((prevData) => [...prevData, ...newData]);
        setCount((prevCount) => prevCount + countPerPage);

        if (page < pageCount) {
          await sleep(delayPerRequest);
          setPage((prevPage) => prevPage + 1);
        } else {
          await sleep(delayPerRequest);
          await fetchExtraCoins();
          clearInterval(countdownInterval.current);
          setCountdown(0);
          setDoneLoadingAll(true);
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

    const fetchExtraCoins = async () => {
      try {
        const response = await axios.get(
          "https://api.coingecko.com/api/v3/coins/markets",
          {
            params: {
              vs_currency: "usd",
              ids: extraCoinIds.join(","),
              sparkline: false,
            },
          }
        );
        
        const extraData = response.data.map((item, i) => ({
          ...item,
          uniqueKey: `extra-${i}`
        }));
        
        setCryptoData((prevData) => [...prevData, ...extraData]);
        setCount((prevCount) => prevCount + response.data.length);
      } catch (err) {
        console.error("Error fetching extra coins:", err);
      }
    };

    fetchCryptoData();
    return () => controller.abort();
  }, [page]);

  return (
    <div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!doneLoadingAll && (
        <p aria-live="polite">
          Loading top {totalRows} results...{" "}
          {count} loaded, {Math.min(visibleRows, cryptoData.length)} displayed... {formatTime(countdown)} left. ⏳
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
          {cryptoData.slice(0, Math.min(visibleRows, cryptoData.length)).map((crypto, index) => (
            <tr 
              key={crypto.uniqueKey}
              className="fade-row"
              style={{ animationDelay: `${(index % 20) * 30}ms` }}
            >
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
          animation: fadeInRow 0.5s ease forwards;
        }
      `}</style>
    </div>
  );
};

export default Home;
