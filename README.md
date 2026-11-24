# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ardanpranaja/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ardanpranaja/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

**Token Radar 2.0** ranks pre-token DeFi protocols by *probability-weighted launch value*: what a first token could be worth (TVL × a stated category value-capture multiple, adjusted for momentum, maturity, chain breadth and data confidence) multiplied by how strongly the snapshot supports a launch scenario (scale, time with no token on record, momentum, breadth, category behaviour). It covers all 40 watchlist protocols plus every other pre-token protocol that passes a conservative product screen — 198 ranked rows, each with its full score breakdown, a thesis, drivers, risks and a concrete seven-step farm plan. The full model write-up is in [MODEL.md](MODEL.md).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=zkyjn780&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
