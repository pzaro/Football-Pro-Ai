APEX OMEGA v5.9 — STREAMLINED SCANNER + ATHENS TIME WINDOW

NEW
- Scan mode: REMAINING MATCHES (from now) or CUSTOM RANGE.
- Date + time boundaries are interpreted in Europe/Athens, including DST.
- League preview counts only pre-match NS/TBD fixtures as candidates for heavy analysis.
- LIVE, FT/AET/PEN, PST/CANC/ABD/AWD/WO and interrupted fixtures are not sent to pre-match analysis.
- Run Scan forces a fresh fixture/status preview before analysis so a newly started match cannot be analysed as pre-match from stale cache.
- Scanner summary shows pre-match / live / finished / unavailable counts.
- All analysis tabs use only the selected time-window matches because scannedMatchesData is built exclusively from eligible fixtures.

CLEANUP
- Removed hidden legacy leagueFilter used only for backward compatibility.
- Removed confirmed unreferenced UI/render helpers and obsolete manual value-enrichment helpers.
- My Leagues remains as the Live Tracker preset.
- Auto-Calibration UI now correctly describes the implemented method as grid search, not gradient descent.

NOT REMOVED
- Live Tracker, Adaptive Precision Lab, Auto-Calibration, Market Value/Bombs, Lineup refresh, Bet Journal and optional Google Sheets push are still functional and therefore were kept.
