# Token Radar 2.0 — the model

This document is the human-readable companion to `lib/model.ts`. Everything below is computed from
the sealed snapshot's own fields (`tvl_usd`, `change_7d`, `listed_at`, `chains`, `category`, and the
token fields `mcap_usd` / `gecko_id` / `symbol`). No outside data, no per-protocol exceptions.

## Who is on the board

A protocol is **pre-token** when the snapshot records no token for it: `mcap_usd`, `gecko_id` and
`symbol` are all null. (The dashboard says "records no token", never "has no token" — the snapshot
is evidence, not omniscience.)

The board contains:

- **All 40 watchlist protocols** — the house floor, always included.
- **Every other pre-token protocol that passes a conservative product screen** — 158 more rows,
  198 in total.

The screen sets aside 144 pre-token records that are products of an asset or brand that already
exists, rather than clean first-launch candidates: centralised exchanges, bridges and canonical
bridges, liquid staking / restaking products, names carrying wrapped/staked/staking markers,
exchange-branded products, and versioned pools (names ending in a version marker such as "V2").
Screened-out records are counted on the dashboard, never silently ranked.

Protocols that already trade (416 in the snapshot) are kept apart in the dashboard's Live token
view with their market caps — facts, not model output.

## Two questions, kept separate

### 1. Potential launch value

What could a first token be worth if the protocol's current scale and category economics persisted?

```
potential = TVL x category_multiple x momentum_mult x maturity_mult x breadth_mult x confidence_mult
```

- **Category multiple** — value captured per dollar of TVL, stated per category: Dexs 0.55,
  Lending 0.50, Derivatives 0.55, CDP 0.45, Yield / Yield Aggregator 0.35, Risk Curators 0.22,
  Onchain Capital Allocator 0.25, RWA 0.30, Prediction Market 0.60, Chain 0.35, Payments 0.20,
  default 0.26. Curators and allocators get low multiples because most vault value accrues to the
  underlying venues, not the curator.
- **Momentum multiplier** — `clamp(1 + clamp(change_7d, -45, 45)/100 x 0.9, 0.62, 1.38)`;
  unreported momentum is neutral (1.0).
- **Maturity multiplier** — `0.78 + 0.44 x age_score`, so young protocols are discounted.
- **Breadth multiplier** — `0.90 + 0.22 x breadth_score`; multi-chain records carry more
  distribution surface.
- **Confidence multiplier** — `0.92 + 0.08 x confidence`; missing fields cost a little value
  instead of being silently treated as good news.

### 2. Launch likelihood

```
index       = 0.27 scale + 0.20 age + 0.17 momentum + 0.12 breadth + 0.19 category_prior + 0.05 confidence
probability = 0.15 + 0.75 x index        (launch_score = round(100 x probability))
```

- **Scale** — log TVL between $5M and $5B: size is the strongest single launch signal.
- **Age** — `1 - exp(-age_days/650)` from `listed_at` to the snapshot date: a long record with no
  token on file is exactly the radar's quarry. Unknown dates get a neutral 0.45.
- **Momentum** — `0.5 + clamp(change_7d, -40, 40)/80`; unreported is neutral 0.5.
- **Breadth** — `log1p(chains)/log1p(16)`.
- **Category prior** — how launch-prone the category is (Dexs 0.82, Lending 0.80, Derivatives 0.78,
  Yield 0.76, CDP 0.72, Risk Curators 0.55, Chain 0.48, Payments 0.35, default 0.52).
- **Confidence** — starts at 1; −0.08 missing momentum, −0.12 missing listed date, −0.05 missing
  category, −0.05 no chains; floored at 0.75.

### Implied value

```
implied_value_usd = round(potential x probability)
```

A probability-weighted scenario value. It keeps a huge-but-unlikely launch from outranking a
likely one on size alone, and it is labelled a scenario everywhere it appears — a launch is
optional for every protocol on the board, and the snapshot cannot change that.

Every board row carries its full arithmetic (`model` breakdown), a one-sentence `thesis` with the
actual figures, at least five `drivers`, and at least one `risk` drawn from its own fields
(negative momentum, young record, missing date/momentum, single-chain concentration).

## Farm plan logic

Seven steps per protocol, generated from category, chains, TVL and age — never from the name:

1. **Dedicated wallet + $5 test transaction** on the protocol's first listed chain.
2. **Category-specific opening action** with tiered capital ($50 under $10M TVL, $75 to $50M,
   $125 to $250M, $200 to $1B, $300 above; derivatives/leverage/basis capped at $100):
   lending = supply + borrow ≤30%; CDP = collateral ≥200%; DEX = balanced LP + swaps;
   derivatives = small hedged trades; staking = stake and keep the receipt; prediction = one
   explainable position; curator/allocator/yield = one identifiable vault; RWA/index/stable =
   mint and hold; insurance = real cover; chain/payments = genuine recurring use.
3. **Deepen** — a second-side or repeat action in week 2 (repay-and-resupply, rebalance,
   renew, compound), so the wallet shows considered use, not one burst.
4. **Weekly cadence for 6 weeks**; multi-chain protocols repeat on a second chain in week 3 with
   ≤25% of the position, because their snapshot record spans chains.
5. **Hold** 30/45/60 days by age and score (younger or weaker records wait longer), with a
   category-specific monitoring rule (health factor, liquidation ratio, unbonding period…).
6. **Exposure cap** — no adding capital until the protocol publishes its own points/rewards/token
   terms; never pay third parties for claims or "eligibility checks".
7. **Farm log and clean unwind** — wallet, chains, dates, hashes, sizes; withdraw to the same
   dedicated wallet first.

Costs are stated as **budgets** ("budget $3–$15 … proceed only if the final quote is inside that
range"), never as invented fee quotes: the snapshot contains no fee data, so the model does not
pretend to know any.

## Honesty limits

- The snapshot is one day (2026-11-14). Momentum is a single 7-day window.
- Category multiples and priors are stated judgement, applied uniformly — they are the model's
  opinion, printed in full so a reader can disagree with numbers, not with hidden choices.
- "Records no token" is a statement about the snapshot, and the copy says so.
