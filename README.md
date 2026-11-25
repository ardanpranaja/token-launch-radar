# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ardanpranaja/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ardanpranaja/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

**Token Radar 2.0** ranks pre-token DeFi protocols by *probability-weighted launch value*: what a first token could be worth (TVL × a stated category value-capture multiple, adjusted for momentum, maturity, chain breadth and data confidence) multiplied by how strongly the snapshot supports a launch scenario (scale, time with no token on record, momentum, breadth, category behaviour). It covers all 40 watchlist protocols plus every other pre-token protocol that passes a conservative product screen — 198 ranked rows, each with its full score breakdown, a thesis, drivers, risks and a concrete seven-step farm plan. The full model write-up is in [MODEL.md](MODEL.md).

## The model in one paragraph

Potential launch value is TVL × a stated category value-capture multiple, adjusted for 7-day momentum, maturity (age with no token on record), chain breadth and data confidence. Launch likelihood is a weighted index of the same signals — scale 0.27, age 0.20, momentum 0.17, breadth 0.12, category prior 0.19, confidence 0.05 — mapped to a probability between 0.15 and 0.90. Implied value is potential × probability. Every row prints its full arithmetic in `model`, plus a thesis, at least five drivers, at least one risk and a seven-step farm plan.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

## Verify it

The program is deterministic: two runs with no network write identical bytes.

```sh
mkdir -p out1 out2
MAKEFUN_OUTPUT_DIR=out1 node main.ts --input /input/snapshot.json
MAKEFUN_OUTPUT_DIR=out2 node main.ts --input /input/snapshot.json
diff -r out1 out2
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=zkyjn780&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
