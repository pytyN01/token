# Excel investment round allocation — migration specification

The scanner no longer renders or runs the investment allocator. The original pure JavaScript reference implementation remains in `src/utils/allocation.js` with regression tests; it is not imported by the application.

## Workbook requirements
- Configurable whole-dollar USD budget, default $100, minimum $20, maximum $1,000,000.
- Exactly 20 distinct eligible CoinGecko IDs selected by research, sorted by expected ROI descending, then ID ascending for ties. Exclude legacy-only, static, stale/unverified prices and unverified fallback ranks until reviewed. Use researched expected ROI, not historical ATH recovery.
- Each receives at least $1, no cents; total equals budget exactly. Rank 1 has weight 7, ranks 2–5 weight 5, ranks 6–13 weight 4, ranks 14–20 weight 3 (sum 80).
- Reserve $20 ($1 per coin); distribute remaining budget by weights. Floor each share, then distribute unassigned dollars in descending remainder order, ties resolved by better ROI rank.
- At $100 the tiers are $8, $6 each, $5 each, $4 each. Record the executed amounts, actual fills and fees separately.

## Excel formula layout (example, not an existing workbook)
B2 = budget input. Rows 6:25 = 20 pre-sorted, unique, reviewed coin IDs (B), expected ROI (C), and rank (A, 1–20).
D6 (weight): =IF(A6=1,7,IF(A6<=5,5,IF(A6<=13,4,3)))
E6 (base allocation): =1+QUOTIENT(($B$2-20)*D6,80)
F6 (remainder): =MOD(($B$2-20)*D6,80)
G6 (remainder priority): =COUNTIF($F$6:$F$25,">"&F6)+COUNTIF($F$6:F6,F6)
H6 (final allocation): =E6+IF(G6<=$B$2-SUM($E$6:$E$25),1,0)
Fill D6:H6 down through row 25. Total =SUM(H6:H25); unallocated =B2-SUM(H6:H25).
The eventual workbook must validate budget, distinct IDs, numeric ROI, eligibility and sorted rank before exposing allocation outputs. This example assumes validated inputs; it is not a standalone finished workbook.
