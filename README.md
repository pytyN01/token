# Crypto Research Terminal

React / Create React App with a Vercel serverless endpoint at `api/crypto.js`. No API key, database, CSV downloads or trading integration required.

## Run locally
- `npm ci`
- `npm test -- --watchAll=false`
- `npm run build`
- Use Vercel CLI (`npx vercel dev`) or a Vercel preview to exercise the serverless API. Plain CRA `npm start` does not serve the API route by itself.

## Workflow
1. Choose coverage (default 1,000) and request delay (default 20 seconds). Run manually.
2. Check scan status, missing ranks, duplicates, and watchlist IDs. Public CoinGecko access may be rate limited; retry/backoff is included. A multi-page scan is not an atomic market snapshot.
3. Copy all or filtered rows to Excel, including headers. Paste into a new historical snapshot rather than overwriting old data. Excel has approximately 15 significant digits of numeric precision; import identifiers or exact values as text if necessary. Provider missing values remain blank. The watchlist is the original deduplicated list, not a verified mapping of all legacy holdings.
4. Evaluate project fundamentals and projected ROI in Excel. Paste exactly 20 unique CoinGecko IDs and expected ROI percentages (e.g. 250 means +250%) into the allocator. This is manual research input, not an automated recommendation. Budget must be a whole number from $20 to $1,000,000. The allocator reserves $1 per coin and apportions remaining dollars by rank using largest remainders. At $100 it produces $8 / $6 / $5 / $4 tiers. Ties can occur. Copy allocation separately and record actual executed amounts and fees in Excel.
5. The scanner does not make trades. A top-500 rank is only a research-universe flag. ATH upside is not expected ROI. Exchange order minimums may exceed allocations.

The old unused App2.js is not imported. Public deployments can still be rate limited or abused; consider access controls if needed. No API key is configured.

## Independent scan status
Market coverage is validated separately from optional watchlist coverage. The Excel `Scan status` column describes market coverage; `Watchlist status` describes the optional lookup. Missing watchlist IDs are reported without substituting zero prices. A completed market scan is still a sequential snapshot, not an atomic or guaranteed valuation. The watchlist retains unresolved IDs for later verification.
