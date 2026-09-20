APEX OMEGA v5.7 — PROFESSIONAL UI + COMPETITION CONTEXT

Main changes
1. Professional executive-light palette with stronger contrast and more restrained accent colors.
2. League badge is shown consistently on match cards, Value Bets, Bombs, diagnostics, top selections and Match Dashboard rows.
3. Cup matches show each team's primary domestic league/category when it can be resolved from recent fixtures.
   If the API cannot resolve it, the UI explicitly shows "Κατηγορία μη διαθέσιμη".
4. The right-side Match Analysis drawer is narrower and more compact.
5. Team names in the drawer wrap normally and remain fully visible; no ellipsis/truncation.
6. The drawer header uses a high-contrast navy gradient; body cards use a compact light professional layout.
7. Drawer quick metrics and accordion cards use denser spacing and improved typography.
8. Existing CMI, Adaptive Precision, Value Bets, Market Bombs and learning logic are retained.

Cup-category API note
For known cup/UEFA competitions, APEX first tries to infer each team's primary league from the data already loaded. If that cannot be resolved, it performs one cached recent-fixtures lookup per team. This improves category coverage while avoiding repeated API requests.
