APEX OMEGA v5.6 — COMPOSITE MATCH INTELLIGENCE

1) CMI no longer determines 1X2 mainly from xG Difference.
2) It combines: Poisson prior, projected xG, form xG, xGA defense, home/away split, form rating, H2H, shots on target, league rank, lineup/injuries and motivation/context.
3) Straight 1 or 2 requires probability >=56%, gap >=10pp, directional alignment and >=55% component agreement.
4) If a side is favoured but straight victory is insufficiently supported, CMI chooses 1X or X2.
5) Bomb safety gate: if CMI recommends X2, an Away Win candidate cannot be VERIFIED Bomb; it becomes SAFER DOUBLE CHANCE diagnostic.
6) Double Chance odds are parsed when the API provides them. Their no-vig probability is derived from the complete 1X2 no-vig consensus because DC outcomes overlap.
7) Value Bets may include 1X/X2/12 only when executable Double Chance odds exist.
8) The right-side analysis drawer shows CMI, Double Chance probabilities and the full weighted factor breakdown.
9) Adaptive Precision Lab now receives Composite Statistical Support as an additional meta-confidence feature.

Weights are initial guardrails, not proven universal optima. The walk-forward self-learning layer should be used to validate and later optimize them from the user's historical archive.
