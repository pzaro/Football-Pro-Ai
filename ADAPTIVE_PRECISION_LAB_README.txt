APEX OMEGA v5.5 — ADAPTIVE PRECISION LAB

PURPOSE
Improve selective 1X2 prediction precision through historical recall, chronological validation and abstention.
The target (for example 70%) is a selection objective, not a guaranteed hit rate.

HOW TO USE
1. Run normal scans so pre-match predictions are stored in the Vault.
2. In Smart Audit, choose Audit From / Audit To and optionally a league.
3. Open Adaptive Precision Lab.
4. Choose Prediction Objective:
   - Balanced: target 65%, minimum coverage 25%
   - High Accuracy: target 70%, minimum coverage 15%
   - Elite: target 72%, minimum coverage 10%
   - Custom: choose your own target/coverage
5. Press "Recall & Train".

WHAT THE LAB DOES
- Recalls final results for Vault fixtures in the selected period.
- Uses only information that was frozen before kickoff.
- Uses expanding walk-forward validation (past -> future).
- Fits a meta-confidence model estimating whether the base 1/X/2 pick will be correct.
- Learns a global confidence threshold and separate thresholds for 1, X, 2.
- Learns league-specific thresholds only when the sample is large enough.
- Uses recency weighting so newer results matter more.
- Runs feature ablation to detect variables that improve or reduce hold-out Brier Score.
- Shows calibration bins, Brier Score, selected accuracy, coverage and Wilson lower bound.
- Applies a Precision Guard to suppress weak 1/X/2 signals when enabled.

IMPORTANT LIMITATION
Historical Recall can recover results only for matches whose pre-match prediction already exists in the Vault.
It does NOT invent or reconstruct a historical pre-match prediction after the result is known, because that would create data leakage.

CONTINUOUS LEARNING
When the hourly self-improvement cycle finds newly completed matches, v5.5 retrains the precision model from the rolling learning window.

NEW OUTPUT
Top Picks now includes a "Precision 1X2" tab. Matches are ranked by meta-confidence and are marked ELITE / STRONG / STANDARD / NO SIGNAL.
The right-side match drawer also shows Meta-Confidence and the current threshold.
