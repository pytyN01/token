import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const pageCount = 16;
const countPerPage = 250;
const delayPerRequest = 13000;

const Home = () => {
  const [cryptoData, setCryptoData] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const countdownInterval = useRef(null);
  const endTime = useRef(null);
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  useEffect(() => {
    // Set the expected end time only once, when page 1 starts
    if (page === 1) {
      const estimatedTime = (pageCount - 1) * delayPerRequest + 6000;
      endTime.current = Date.now() + estimatedTime;
      startCountdown();
    }

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
          }
        );

        setCryptoData((prevData) => [...prevData, ...response.data]);
        setCount((prevCount) => prevCount + countPerPage);

        if (page < pageCount) {
          setTimeout(() => {
            setPage((prevPage) => prevPage + 1);
          }, delayPerRequest);
        } else {
          // Done fetching — stop the countdown
          clearInterval(countdownInterval.current);
          setCountdown(0);
        }
      } catch (err) {
        console.error("Error fetching crypto data:", err);
        setError("Error fetching data. Please try again later.");
        setCryptoData([]);
        clearInterval(countdownInterval.current);
      }
    };

    fetchCryptoData();
  }, [page]);

  const startCountdown = () => {
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
  };

  return (
    <div>
      {error && <p>{error}</p>}
      {page < pageCount && (
        <p>
          Loading top {pageCount * countPerPage} results... Please wait...{" "}
          {count} results loaded... {String(minutes).padStart(2, "0")}:
          {String(seconds).padStart(2, "0")} minutes left. ⏳
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
