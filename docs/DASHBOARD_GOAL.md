# Dashboard Goal

## Refresh UX

- The dashboard exposes a header-level `Refresh dashboard` action.
- Refresh is non-blocking:
  - visible lists stay mounted,
  - open stream/video panels stay open,
  - each section keeps its current content while its own loading indicator spins.
- The end of the cycle surfaces a compact `UPDATED HH:MM` state in the header.
- On refresh failure, the UI falls back to a retry state instead of clearing rendered data.

## Trump Criticality

### Goal

Trump criticality is meant to reflect operational impact, not just inflammatory tone.

### Severity bands

- `0-3` -> `FAIBLE`
- `4-5` -> `MOYEN`
- `6-7` -> `IMPORTANT`
- `8-10` -> `CRITIQUE`
- `7+` also flips `isBreaking=true`

### What counts as 10/10

A `10/10` is treated as a worldwide alert scenario:

- war / direct military escalation
- bombardment / missiles / strikes
- emergency trade shock such as blanket tariffs
- resignation or firing of top national-security leadership

### Training approach

- The backend keeps rule-based guards for obvious hard signals:
  - war / attack / missiles / strikes
  - tariffs / sanctions / embargo / blockade
  - executive removals / resignations
- On top of that, the scoring profile is trained from:
  - a curated seed corpus in `server/src/services/trump.training-corpus.ts`
  - the rolling cached Trump corpus stored in the database
- The trained profile is rebuilt from recent cached tweets and merged with the curated seed corpus so the model keeps the hard `10/10` anchors while adapting to repeated real phrasing.

### Why the curated corpus exists

- We need stable `10/10` anchors even when the live cache is sparse.
- We do not commit third-party raw dumps into the repo.
- The corpus is written as paraphrased public-post patterns that represent the classes we want the model to learn.

### Public corpus references used for the direction

- Truth Social Dataset (`823k+` posts): https://arxiv.org/abs/2303.11240
- TruthSocial 2024 Election Initiative (`1.5M` posts described in paper): https://arxiv.org/abs/2411.01330
- TruthStance annotated conversations dataset: https://arxiv.org/abs/2602.14406

These references justify the larger-corpus direction, but the shipped model currently trains on the curated corpus plus the local cached posts available to the app runtime.

## Stock Groups

### Goal

The market section now distinguishes macro indices from dashboard stock groups with stronger product meaning.

### Group mapping

- `MAGNIFICENT 7`
  - `AAPL`, `MSFT`, `GOOGL`, `AMZN`, `META`, `NVDA`, `TSLA`
- `AI`
  - `AMD`, `AVGO`, `PLTR`, `TSM`
- `TECH`
  - `ORCL`, `CRM`, `ADBE`, `NOW`
- `DEFENSE`
  - `LMT`, `NOC`, `RTX`, `GD`
- `COMMODITIES`
  - `XOM`, `CVX`, `FCX`, `NEM`
- `INDICES & ETFS`
  - `SPX`, `IXIC`, `DJI`, `VIX`, `SPY`, `QQQ`

### API / UI structure

- The backend enriches stock tickers with:
  - `groupKey`
  - `groupLabel`
- The frontend store computes grouped stock buckets from those fields.
- The market section renders group headings in both grid and list view.

## Security / Stability Notes

- Refresh continues to use existing backend refresh routes and does not bypass rate-limiting or auth boundaries already in place.
- No dashboard refresh state leaks backend internals to the UI.
- Market grouping is display metadata only; it does not widen API access or data scope.
