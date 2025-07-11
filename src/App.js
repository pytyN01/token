import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const pageCount = 16;
const countPerPage = 250;
const delayPerRequest = 12000;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

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
  const countdownInterval = useRef(null);
  const endTime = useRef(null);

  // Countdown Timer Effect – only starts on first page load
  useEffect(() => {
    if (page === 1) {
      const estimatedTime = (pageCount - 1) * delayPerRequest + 6000;
      endTime.current = Date.now() + estimatedTime;

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
    }

    return () => {
      clearInterval(countdownInterval.current);
    };
  }, [page]);

  // Fetching Data Effect
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

        setCryptoData((prevData) => [...prevData, ...response.data]);
        setCount((prevCount) => prevCount + countPerPage);

        if (page < pageCount) {
          await sleep(delayPerRequest);
          setPage((prevPage) => prevPage + 1);
        } else {
          clearInterval(countdownInterval.current);
          setCountdown(0);
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

    fetchCryptoData();

    return () => {
      controller.abort();
    };
  }, [page]);

  return (
    <div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {page < pageCount && (
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
              <td>${crypto.current_price}</td>
              <td>${crypto.ath}</td>
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
