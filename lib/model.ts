// Token Radar 2.0: a probability-weighted launch-value model for the sealed DefiLlama snapshot.
//
// The board is deliberately wider than the house watchlist. It contains every watchlist protocol,
// plus every other protocol that (a) records no token in the snapshot and (b) passes a conservative
// product screen. The screen removes centralised exchanges, wrapped/staked/bridged products of an
// asset that already trades, exchange-prefixed products, and versioned pools. Those records may be
// economically large, but they are not clean evidence of a future first token launch.
//
// Two questions are kept separate:
//   1. Potential launch value: what could a first token be worth if the protocol's current scale and
//      category economics persisted?  potential = TVL x category value-capture multiple x momentum
//      x maturity x chain-breadth x data-confidence adjustments.
//   2. Launch likelihood: how strongly do scale, longevity without a recorded token, 7-day momentum,
//      chain breadth, category behaviour and data completeness support a launch scenario?
// The board's implied_value_usd is the probability-weighted value: potential x launch probability.
// It is a scenario value derived only from snapshot fields, not a price forecast and not a claim
// that a launch will happen. No protocol name is special-cased.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** Category-level economics: a value-capture multiple and a launch-behaviour prior. */
export interface CategoryEconomics {
  multiple: number;
  prior: number;
  capture: string;
}

/** The model's global constants. Category maps are data, not per-protocol exceptions. */
export interface ModelConstants {
  scale_floor_usd: number;
  scale_ceiling_usd: number;
  unknown_age_score: number;
  probability_floor: number;
  probability_range: number;
  weights: {
    scale: number;
    age: number;
    momentum: number;
    breadth: number;
    category: number;
    confidence: number;
  };
  default_category: CategoryEconomics;
  categories: Record<string, CategoryEconomics>;
}

const cat = (multiple: number, prior: number, capture: string): CategoryEconomics => ({ multiple, prior, capture });

export const MODEL: ModelConstants = {
  scale_floor_usd: 5_000_000,
  scale_ceiling_usd: 5_000_000_000,
  unknown_age_score: 0.45,
  probability_floor: 0.15,
  probability_range: 0.75,
  weights: { scale: 0.27, age: 0.20, momentum: 0.17, breadth: 0.12, category: 0.19, confidence: 0.05 },
  default_category: cat(0.26, 0.52, 'general protocol activity'),
  categories: {
    'Dexs': cat(0.55, 0.82, 'trading fees and order flow'),
    'Lending': cat(0.50, 0.80, 'interest spread and liquidation flow'),
    'Derivatives': cat(0.55, 0.78, 'trading fees and margin balances'),
    'CDP': cat(0.45, 0.72, 'stability fees and collateral demand'),
    'CDP Manager': cat(0.35, 0.65, 'collateral-management activity'),
    'Yield': cat(0.35, 0.76, 'vault fees and retained yield'),
    'Yield Aggregator': cat(0.35, 0.74, 'vault fees and retained yield'),
    'Risk Curators': cat(0.22, 0.55, 'curation fees on managed vaults'),
    'Onchain Capital Allocator': cat(0.25, 0.60, 'allocation fees and vault demand'),
    'RWA': cat(0.30, 0.62, 'issuance, servicing and secondary demand'),
    'Basis Trading': cat(0.30, 0.58, 'basis-strategy fees and retained yield'),
    'Chain': cat(0.35, 0.48, 'network fees and native-asset demand'),
    'Payments': cat(0.20, 0.35, 'payment flow and network utility'),
    'Prediction Market': cat(0.60, 0.70, 'market fees and open interest'),
    'Insurance': cat(0.35, 0.55, 'premiums and underwriting demand'),
    'Liquidity Manager': cat(0.35, 0.62, 'liquidity-management fees'),
    'Leveraged Farming': cat(0.30, 0.66, 'strategy fees and retained yield'),
    'Farm': cat(0.30, 0.70, 'farm incentives and strategy fees'),
    'Restaking': cat(0.35, 0.68, 'restaking fees and operator demand'),
    'Staking Pool': cat(0.25, 0.50, 'staking commissions'),
    'Collateral Markets': cat(0.30, 0.60, 'collateral and liquidation activity'),
    'Cross Chain Bridge': cat(0.30, 0.55, 'routing fees and transfer flow'),
    'OTC Marketplace': cat(0.40, 0.55, 'marketplace fees'),
    'CeDeFi': cat(0.30, 0.50, 'managed CeDeFi yield'),
    'Dual-Token Stablecoin': cat(0.25, 0.45, 'stablecoin issuance and collateral demand'),
    'Stablecoin Wrapper': cat(0.15, 0.30, 'wrapper utility'),
    'Anchor BTC': cat(0.12, 0.25, 'BTC product utility'),
    'Decentralized BTC': cat(0.15, 0.30, 'BTC product utility'),
    'Governance Incentives': cat(0.30, 0.65, 'incentive coordination'),
    'Crypto Card Issuer': cat(0.30, 0.45, 'card spend and account activity'),
    'Indexes': cat(0.30, 0.55, 'index issuance and rebalancing'),
    'Uncollateralized Lending': cat(0.45, 0.70, 'underwriting spread'),
    'Interest Rate Derivatives': cat(0.50, 0.72, 'rate-trading fees'),
  },
};

/** The model's version label: the dashboard names it and MODEL.md explains it. */
export const MODEL_VERSION = 'radar-2.0';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 36;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The auditable arithmetic behind one board row. */
export interface ScoreBreakdown {
  scale_score: number;
  age_score: number;
  momentum_score: number;
  breadth_score: number;
  category_prior: number;
  confidence_score: number;
  launch_index: number;
  launch_probability: number;
  launch_score: number;
  category_multiple: number;
  momentum_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  confidence_multiplier: number;
  potential_value_usd: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  tier: 'Core launch candidate' | 'Early radar' | 'Watchlist reserve';
  age_days: number | null;
  launch_score: number;
  launch_probability: number;
  potential_value_usd: number;
  implied_value_usd: number;
  thesis: string;
  drivers: string[];
  risks: string[];
  model: ScoreBreakdown & { age_days: number | null };
  farm_steps: string[];
}

/** The dashboard's view of one row: identical economics and farm plan to board.json. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  tier: BoardRow['tier'];
  launch_score: number;
  launch_probability: number;
  potential_value_usd: number;
  implied_value_usd: number;
  thesis: string;
  drivers: string[];
  risks: string[];
  model: ScoreBreakdown;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  candidate_size: number;
  screened_out_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const PRODUCT_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);
const PRODUCT_NAME = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all in the snapshot. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Why a non-watchlist pre-token record is screened out, or null when it is a clean launch candidate. */
export function screenReason(p: SnapshotProtocol): string | null {
  if (!isPreToken(p)) return 'a token is already recorded';
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return `${p.category} is treated as a product of an existing asset or network`;
  if (PRODUCT_NAME.test(p.name)) return 'the name marks a wrapped or staked product';
  if (EXCHANGE_PREFIX.test(p.name)) return 'the name begins with an exchange brand';
  if (VERSIONED.test(p.name)) return 'the name ends in a version marker';
  return null;
}

/** Whether a protocol is one the board may rank on its own record (watchlist rows bypass this screen). */
export function isRankable(p: SnapshotProtocol): boolean {
  return screenReason(p) === null;
}

function categoryOf(p: SnapshotProtocol): CategoryEconomics {
  return (p.category !== null ? MODEL.categories[p.category] : undefined) ?? MODEL.default_category;
}

function confidenceOf(p: SnapshotProtocol): number {
  let score = 1;
  if (p.change_7d === null) score -= 0.08;
  if (p.listed_at === null) score -= 0.12;
  if (p.category === null) score -= 0.05;
  if (p.chains.length === 0) score -= 0.05;
  return clamp(score, 0.75, 1);
}

/** Score one protocol: launch likelihood, potential FDV and the probability-weighted implied value. */
export function scoreProtocol(protocol: SnapshotProtocol, asOf: string, model: ModelConstants = MODEL): ScoreBreakdown & { age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const category = (protocol.category !== null ? model.categories[protocol.category] : undefined) ?? model.default_category;
  const scaleScore = clamp(Math.log10(Math.max(protocol.tvl_usd, 1) / model.scale_floor_usd) / Math.log10(model.scale_ceiling_usd / model.scale_floor_usd), 0, 1);
  const ageScore = age === null ? model.unknown_age_score : clamp(1 - Math.exp(-age / 650), 0, 1);
  const momentumScore = protocol.change_7d === null ? 0.5 : 0.5 + clamp(protocol.change_7d, -40, 40) / 80;
  const breadthScore = clamp(Math.log1p(protocol.chains.length) / Math.log1p(16), 0, 1);
  const confidenceScore = confidenceOf(protocol);
  const w = model.weights;
  const launchIndex = w.scale * scaleScore + w.age * ageScore + w.momentum * momentumScore + w.breadth * breadthScore + w.category * category.prior + w.confidence * confidenceScore;
  const launchProbability = model.probability_floor + model.probability_range * launchIndex;
  const momentumMultiplier = protocol.change_7d === null ? 1 : clamp(1 + (clamp(protocol.change_7d, -45, 45) / 100) * 0.9, 0.62, 1.38);
  const maturityMultiplier = 0.78 + 0.44 * ageScore;
  const breadthMultiplier = 0.90 + 0.22 * breadthScore;
  const confidenceMultiplier = 0.92 + 0.08 * confidenceScore;
  const potential = Math.max(1, Math.round(protocol.tvl_usd * category.multiple * momentumMultiplier * maturityMultiplier * breadthMultiplier * confidenceMultiplier));
  return {
    scale_score: round4(scaleScore),
    age_score: round4(ageScore),
    momentum_score: round4(momentumScore),
    breadth_score: round4(breadthScore),
    category_prior: category.prior,
    confidence_score: round4(confidenceScore),
    launch_index: round4(launchIndex),
    launch_probability: round4(launchProbability),
    launch_score: Math.round(launchProbability * 100),
    category_multiple: category.multiple,
    momentum_multiplier: round4(momentumMultiplier),
    maturity_multiplier: round4(maturityMultiplier),
    breadth_multiplier: round4(breadthMultiplier),
    confidence_multiplier: round4(confidenceMultiplier),
    potential_value_usd: potential,
    age,
  };
}

/** Backwards-compatible name for the starter's single-value helper, now returning the full breakdown. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants = MODEL): { implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const s = scoreProtocol(protocol, asOf, model);
  return { implied: Math.round(s.potential_value_usd * s.launch_probability), growthPct: protocol.change_7d ?? 0, growthMult: s.momentum_multiplier, maturityMult: s.maturity_multiplier, age: s.age };
}

function driversFor(p: SnapshotProtocol, s: ScoreBreakdown & { age: number | null }, floor: number): string[] {
  const drivers: string[] = [];
  const floorMultiple = p.tvl_usd / floor;
  drivers.push(floorMultiple >= 1
    ? `${money(p.tvl_usd)} of TVL is ${floorMultiple.toFixed(1)}x the ${money(floor)} watchlist floor, so the protocol already has launch-scale usage.`
    : `${money(p.tvl_usd)} of TVL is below the ${money(floor)} floor; this is an early position, not a scale claim.`);
  drivers.push(`The snapshot records no token for ${p.name}: both gecko_id and symbol are null.`);
  drivers.push(s.age === null
    ? 'DefiLlama gives no listed date, so the model uses a neutral age score rather than inventing a track record.'
    : `${p.name} has a ${s.age}-day record with no token in the snapshot; the age score is ${s.age_score.toFixed(2)} of 1.`);
  if (p.change_7d !== null) drivers.push(`Seven-day TVL momentum is ${p.change_7d >= 0 ? '+' : ''}${p.change_7d.toFixed(2)}%, producing a ${s.momentum_multiplier.toFixed(2)}x value adjustment.`);
  drivers.push(p.chains.length > 1
    ? `The record spans ${p.chains.length} chains (${p.chains.slice(0, 4).join(', ')}${p.chains.length > 4 ? ', ...' : ''}), which raises the breadth score to ${s.breadth_score.toFixed(2)}.`
    : `The record is concentrated on ${p.chains[0] ?? 'one chain'}, so the plan starts there instead of spreading capital thinly.`);
  drivers.push(`The ${p.category ?? 'uncategorised'} category prior is ${s.category_prior.toFixed(2)} and its value-capture multiple is ${s.category_multiple.toFixed(2)}x TVL (${categoryOf(p).capture}).`);
  return drivers;
}

function risksFor(p: SnapshotProtocol, s: ScoreBreakdown & { age: number | null }): string[] {
  const risks: string[] = [];
  if (p.change_7d !== null && p.change_7d <= -10) risks.push(`TVL fell ${Math.abs(p.change_7d).toFixed(2)}% in seven days; use the smaller starter position and review weekly rather than adding on a schedule.`);
  if (s.age !== null && s.age < 180) risks.push(`Only ${s.age} days of listed history are visible, so the no-token record is young and the launch score is capped by weak seasoning.`);
  if (s.age === null) risks.push('No listed date is reported, so longevity cannot be verified from the snapshot and the model takes a confidence deduction.');
  if (p.change_7d === null) risks.push('No seven-day TVL change is reported, so momentum is neutral rather than treated as growth.');
  if (p.chains.length <= 1) risks.push('Single-chain concentration means one network or app incident can interrupt the whole farm plan.');
  if (risks.length === 0) risks.push('No snapshot field removes the central risk: a token launch is optional, so implied value is a scenario value, not a forecast.');
  return risks;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest probability-weighted value first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const watchlist = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const s = scoreProtocol(p, snapshot.as_of, model);
    const implied = Math.max(1, Math.round(s.potential_value_usd * s.launch_probability));
    return { p, s, implied };
  });
  scored.sort((a, b) => b.implied - a.implied || b.s.launch_score - a.s.launch_score || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map(({ p, s, implied }, i) => {
    const tier: BoardRow['tier'] = watchlist.has(p.slug)
      ? (s.launch_score >= 58 ? 'Core launch candidate' : 'Watchlist reserve')
      : 'Early radar';
    const thesis = `${p.name}'s implied value is ${money(implied)}: a ${money(s.potential_value_usd)} potential launch value multiplied by a ${Math.round(s.launch_probability * 100)}% launch likelihood. The score is driven by ${money(p.tvl_usd)} of TVL, a ${s.age === null ? 'neutral unknown-age input' : `${s.age}-day no-token record`}, ${p.change_7d === null ? 'unreported 7-day momentum' : `${p.change_7d >= 0 ? '+' : ''}${p.change_7d.toFixed(2)}% seven-day TVL momentum`}, ${p.chains.length} listed chain${p.chains.length === 1 ? '' : 's'} and the ${p.category ?? 'default'} category model.`;
    return {
      rank: i + 1,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: 'pre-token',
      watchlist: watchlist.has(p.slug),
      tier,
      age_days: s.age,
      launch_score: s.launch_score,
      launch_probability: s.launch_probability,
      potential_value_usd: s.potential_value_usd,
      implied_value_usd: implied,
      thesis,
      drivers: driversFor(p, s, snapshot.floor_usd),
      risks: risksFor(p, s),
      model: { ...s, age_days: s.age },
      farm_steps: farmSteps(p, s.age, s.launch_score).map(stepText),
    };
  });
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one starter farm position needs, from the protocol's own TVL and category risk. */
function capitalFor(p: SnapshotProtocol): number {
  const c = (p.category ?? '').toLowerCase();
  let capital = p.tvl_usd >= 1_000_000_000 ? 300 : p.tvl_usd >= 250_000_000 ? 200 : p.tvl_usd >= 50_000_000 ? 125 : p.tvl_usd >= 10_000_000 ? 75 : 50;
  if (c.includes('derivative') || c.includes('leveraged') || c.includes('basis')) capital = Math.min(capital, 100);
  return capital;
}

/** How long to hold, from the protocol's age and score: younger or weaker records need a longer evidence window. */
function holdDaysFor(age: number | null, launchScore: number): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return launchScore >= 60 ? 30 : 45;
}

interface CategoryActions { open: string; deepen: string; monitor: string }

/** Category-specific opening and follow-up actions. Every string is a template over snapshot fields. */
function actionsFor(p: SnapshotProtocol, capital: number, chain: string): CategoryActions {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('uncollateralized')) return {
    open: `Supply $${capital} of USDC or the main lending asset to ${name} on ${chain}; borrow no more than 30% of the supplied value so the position stays boring and countable.`,
    deepen: `Keep the borrow open for seven days, repay it in full, then supply again; this creates both sides of lending activity without running a liquidation risk.`,
    monitor: `Check the health factor or loan-to-value every Monday and Thursday; add collateral immediately if it moves inside the app's warning zone.`,
  };
  if (c.includes('cdp')) return {
    open: `Deposit $${capital} of collateral into ${name} on ${chain} at a collateral ratio of at least 200%; mint only a small amount of its debt asset.`,
    deepen: `Hold the vault for seven days, repay the minted amount, then reopen at the same conservative ratio rather than increasing leverage.`,
    monitor: `Review collateral price and liquidation ratio twice a week; the farm is the vault history, not a leveraged trade.`,
  };
  if (c.includes('dex') || c.includes('liquidity')) return {
    open: `Provide $${capital} of liquidity to ${name}'s most active pair on ${chain}, split evenly between the two pool assets, and make two small swaps through the same interface.`,
    deepen: `Leave the LP position untouched for a full week, then rebalance once back toward a 50/50 value split if the pool has drifted.`,
    monitor: `Record the pool share and impermanent-loss estimate weekly; withdraw only after the planned hold, not after a one-day price move.`,
  };
  if (c.includes('derivative') || c.includes('interest rate')) return {
    open: `Deposit $${capital} of USDC margin on ${name} (${chain}) and open one small long and one small short in liquid markets, closing both the same day to establish genuine trading activity.`,
    deepen: `Repeat one modest hedged trade each week rather than directional speculation; keep unused margin in the account between sessions.`,
    monitor: `Check margin ratio before and after every trade; stop and withdraw if the account approaches its liquidation warning.`,
  };
  if (c.includes('bridge') || c.includes('cross chain')) return {
    open: `Bridge $${capital} of USDC from ${chain} to one destination chain through ${name}, then use the bridged funds in the destination app instead of bridging straight back.`,
    deepen: `Make one further bridge transfer in the opposite direction after at least seven days, keeping the round trip tied to real use.`,
    monitor: `Save both transaction hashes and the destination balance after each transfer; never use a look-alike bridge link.`,
  };
  if (c.includes('staking') || c.includes('restak')) return {
    open: `Stake $${capital} of the relevant chain asset through ${name} on ${chain} and keep the staking or restaking receipt in the farm wallet.`,
    deepen: `Claim or compound any staking rewards once, after the first reward period, and keep the receipt rather than rotating to a copycat product.`,
    monitor: `Write down the unbonding period before staking; review validator/operator status weekly and never stake funds needed inside that window.`,
  };
  if (c.includes('prediction')) return {
    open: `Fund $${capital} on ${name} and take one small position in a liquid market you can explain; avoid illiquid novelty markets.`,
    deepen: `Let the first market settle or close it after seven days, then take one further position so the account shows considered repeat use.`,
    monitor: `Cap total prediction exposure at the starter amount; this is an activity farm, not a betting strategy.`,
  };
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield') || c.includes('farm') || c.includes('basis')) return {
    open: `Deposit $${capital} into one ${name} vault or strategy on ${chain}; choose the vault whose assets you can identify and keep the share receipt.`,
    deepen: `Hold the shares for a full reward or reporting period, then make one small top-up rather than hopping between vaults.`,
    monitor: `Review the vault's asset list and TVL direction weekly; exit if the strategy changes to assets you cannot identify.`,
  };
  if (c.includes('rwa') || c.includes('index') || c.includes('stable') || c.includes('btc')) return {
    open: `Mint or buy $${capital} of the ${name} asset on ${chain} through the protocol's own app, completing any eligibility check it presents, and hold the asset in the farm wallet.`,
    deepen: `Make one small second mint or purchase after at least fourteen days, so the account shows continuing rather than one-off use.`,
    monitor: `Record the redemption route and any lock or eligibility condition before adding more; do not assume daily liquidity.`,
  };
  if (c.includes('insurance')) return {
    open: `Buy $${capital} of cover from ${name} on ${chain} for an asset you actually hold, and keep the policy record.`,
    deepen: `Renew or extend the cover once if the underlying position is still open at the first policy's end.`,
    monitor: `Save the policy terms and claim deadline; cover that has lapsed does not evidence continuing use.`,
  };
  if (c.includes('chain') || c.includes('payment') || c.includes('card')) return {
    open: `Fund the farm wallet with $${capital} on ${chain}, use ${name}'s own app or payment route for one genuine transaction, and keep a small working balance.`,
    deepen: `Repeat one genuine transaction each week for six weeks; vary the purpose (transfer, payment, app use) rather than sending funds in a circle.`,
    monitor: `Keep the balance small and sweep only at the end of the hold; the evidence is regular use, not idle size.`,
  };
  return {
    open: `Deposit $${capital} of USDC into ${name} on ${chain} through its primary app and keep the position open.`,
    deepen: `Make one further deposit, withdrawal-and-redeposit or governance action after seven days, using the same wallet.`,
    monitor: `Review the position weekly and keep every transaction hash in the farm log.`,
  };
}

/**
 * A protocol's farm plan: seven steps, each an action with a planning cost and a time. Costs are
 * budgets derived from the position size, not fee quotes; the plan says to verify the app's quote.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, launchScore = 55): FarmStep[] {
  const chain = chainOf(p);
  const secondChain = p.chains.length > 1 ? p.chains[1]! : null;
  const capital = capitalFor(p);
  const hold = holdDaysFor(age, launchScore);
  const actions = actionsFor(p, capital, chain);
  return [
    {
      text: `Set up a dedicated farm wallet for ${p.name}; fund it only from your main wallet, save the recovery phrase offline, and send a $5 test transaction on ${chain} before committing capital.`,
      cost: 'about $5 test capital plus the wallet app quote for one small transaction',
      time: '10 minutes',
    },
    {
      text: actions.open,
      cost: `$${capital} of position capital; budget $3-$15 for network and app fees and proceed only if the final quote is inside that range`,
      time: '20 minutes to set up',
    },
    {
      text: actions.deepen,
      cost: `no new capital beyond the $${capital} position; budget about $2-$8 per follow-up transaction`,
      time: '15 minutes in week 2',
    },
    {
      text: secondChain === null
        ? `Repeat one qualifying ${p.category ?? 'protocol'} action on ${chain} each week for six weeks, on roughly the same day, so the wallet shows a durable pattern rather than a single burst.`
        : `In week 3, repeat the core action on ${secondChain} with no more than 25% of the position, because ${p.name}'s snapshot record spans ${p.chains.length} chains; keep the main position on ${chain}.`,
      cost: 'about $2-$10 of network fees per weekly session',
      time: '10 minutes a week for 6 weeks',
    },
    {
      text: `Hold the core position for at least ${hold} days. ${actions.monitor}`,
      cost: `the $${capital} stays committed for the hold; opportunity cost is the main cost`,
      time: `${hold} days, with a 5-minute weekly check`,
    },
    {
      text: `Keep total exposure to ${p.name} at or below $${capital} until the protocol publishes its own points, rewards or token terms; if it does, re-read those terms before adding a dollar, because the snapshot cannot tell you the eligibility rule.`,
      cost: 'nothing to wait; never pay a third party for a claim, boost or eligibility check',
      time: '15 minutes to re-read the official terms',
    },
    {
      text: `Maintain a farm log with the wallet address, chain, dates, transaction hashes, position size and screenshots of the ${p.name} position; when you unwind, withdraw to the same dedicated wallet first and record the closing balances.`,
      cost: 'nothing but the log; withdrawal fees are the app quote at exit',
      time: '5 minutes per session, 15 minutes to unwind',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js: the same economics and the same farm plan as board.json. */
export function radarRow(row: BoardRow): RadarRow {
  const { model, ...rest } = row;
  const { age_days: _ageDays, ...score } = model;
  return { ...rest, model: score };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const boardSlugs = new Set(board.map((r) => r.slug));
  const screenedOut = snapshot.protocols.filter((p) => isPreToken(p) && !boardSlugs.has(p.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    candidate_size: board.length,
    screened_out_size: screenedOut,
    live_size: snapshot.protocols.filter((p) => !isPreToken(p)).length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, values, scores and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100) return `the board holds ${board.length} rows: at least 100 are required`;
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return 'the board repeats a slug';
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!Number.isSafeInteger(r.potential_value_usd) || r.potential_value_usd < r.implied_value_usd) return `${r.slug} has potential value ${r.potential_value_usd} below its implied value`;
    if (r.launch_score < 0 || r.launch_score > 100) return `${r.slug} has launch score ${r.launch_score}`;
    if (r.drivers.length < 3 || r.risks.length < 1 || r.thesis.length < 40) return `${r.slug} lacks stated reasoning`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
