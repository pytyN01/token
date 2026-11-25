# Crypto Research Terminal

React / Create React App with a Vercel serverless endpoint at `api/crypto.js`. No API key, database, CSV downloads or trading integration required.

## Run locally
- `npm ci`
- `npm test -- --watchAll=false`
- `npm run build`
- Use Vercel CLI (`npx vercel dev`) or a Vercel preview to exercise the serverless API. Plain CRA `npm start` does not serve the API route by itself.

## Workflow
1. Choose coverage (default 1,000) and request delay (default 12 seconds). Run manually.
2. Check scan status, missing ranks, duplicates, and watchlist IDs. Public CoinGecko access may be rate limited; retry/backoff is included. A multi-page scan is not an atomic market snapshot.
3. Copy all or filtered rows to Excel, including headers. Paste into a new historical snapshot rather than overwriting old data. Excel has approximately 15 significant digits of numeric precision; import identifiers or exact values as text if necessary. Provider missing values remain blank. The watchlist is the original deduplicated list, not a verified mapping of all legacy holdings.
4. Evaluate project fundamentals and projected ROI in Excel. Paste exactly 20 unique CoinGecko IDs and expected ROI percentages (e.g. 250 means +250%) into the allocator. This is manual research input, not an automated recommendation. Budget must be a whole number from $20 to $1,000,000. The allocator reserves $1 per coin and apportions remaining dollars by rank using largest remainders. At $100 it produces $8 / $6 / $5 / $4 tiers. Ties can occur. Copy allocation separately and record actual executed amounts and fees in Excel.
5. The scanner does not make trades. A top-500 rank is only a research-universe flag. ATH upside is not expected ROI. Exchange order minimums may exceed allocations.

The old unused App2.js is not imported. Public deployments can still be rate limited or abused; consider access controls if needed. No API key is configured.

## Independent scan status
Market coverage is validated separately from optional watchlist coverage. The Excel `Scan status` column describes market coverage; `Watchlist status` describes the optional lookup. Missing watchlist IDs are reported without substituting zero prices. A completed market scan is still a sequential snapshot, not an atomic or guaranteed valuation. The watchlist retains unresolved IDs for later verification.

## Appearance
Dark mode is the default. Use the top-right theme toggle to switch between dark and light mode. Your choice is stored locally in your browser; switching themes does not reset scans or investment inputs.

## Scan timing
The keyless public API has variable rate limits; 12 seconds is a theoretical five-request/minute pace, not a guarantee. Faster options can trigger throttling. The countdown estimates remaining logical requests (including watchlist batches), uses observed successful response durations, and includes active retry waits. HTTP 429 retries wait at least 60 seconds or longer if required by Retry-After or exponential backoff; an exhausted 429 stops the scan to avoid repeatedly hitting the limit. Existing partial results remain available. The timer is an estimate, not a guarantee of completion time.

## Historical watchlist fallback
MXC, Shiden, Buy the DIP and Step App are retained as legacy-only research records. The scanner attempts canonical and legacy provider IDs in the existing watchlist batches; the alternate MXC and Shiden IDs are candidates, not guaranteed API results. A returned positive price is preferred, otherwise the static historical record is included with no price, market rank, current supply, or live timestamp. The watchlist remains Partial when live quotes are missing. Static records and all four legacy-only projects are excluded from the round allocator. Copy to Excel includes data source, price status, research date, source links, historical supply figures and legacy/provider IDs. The historical-only filter displays fallback rows. No additional API provider or API key is required. Historical price and supply figures can differ across providers and should not be used as executable valuations.

## Rank reconciliation
CoinGecko pages are sequential and ranks can be missing or nonconsecutive. When every initial page returns, the scanner rechecks up to two affected pages at the selected request interval. It retains a replacement only if it improves observed rank coverage without losing previously covered top-500 ranks or adding duplicate IDs. It never creates ranks or claims a complete full scan when gaps remain. Top-500 research coverage is reported independently and included in clipboard data. Watchlist refreshes cannot overwrite the market-page rank, and watchlist-only records do not enter the top-500 filter. Research coverage is a rank check, not a guarantee of investment quality or price freshness.

## Local ranks and appearance
The dark theme uses a Vercel-inspired black/charcoal palette. Light mode and theme persistence remain available. The main `Rank` column is a local display rank: valid unique CoinGecko market ranks within the selected range are reserved; remaining fetched market records fill open positions by descending market cap (ID breaks ties). Watchlist-only rows receive unique local positions after the selected market range, ordered with historical-only records last. These positions are not global market-cap ranks. The original `CoinGecko rank` is unchanged and `Rank source` labels COINGECKO, FALLBACK, or WATCHLIST POSITION. Actual missing market records, failed pages, and duplicates still produce Partial. Full rank coverage obtained using fallback is labeled Complete (calculated); top-500 fallback candidates require rank verification. No new coins or provider ranks are fabricated.

## Interface polish
The progress bar animates actual completed request batches with a continuous activity shimmer; it does not simulate completed requests. The first successful market batch fades in with a capped stagger, and subsequent results render immediately. Both animations respect reduced-motion preferences. The optional investment allocator is collapsed by default and retains its inputs when opened and closed.
