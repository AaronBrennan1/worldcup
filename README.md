# World Cup 2026 Hub ⚽

A static, single-page site for the FIFA World Cup 2026 (USA · Canada · Mexico). No build step, no backend — just HTML/CSS/JS that runs anywhere, including **GitHub Pages**.

## What's built (from your plan)

| Page | Status | Notes |
|------|--------|-------|
| **Home** | ✅ | Hub linking every section |
| **Groups** | ✅ | All 12 groups, 48 teams, host/debut tags |
| **Knockout predictor** | ✅ | Interactive 3-step tool: order each group, pick the 8 third-placed qualifiers (resolved against all **495** official scenarios), then click your winner through R32 → Final. Favourites pre-filled from a power rating |
| **Countries** | ✅ | All 48 nations, filter by confederation, search |
| **Individual country page** | ✅ | Group · qualification stats · expected XI (starts-based, auto-detected formation) + bench · squad table · history placeholder |
| **Player statistics** | ✅ | 2,000+ qualifier players with an interactive per-90 scatter (selectable X/Y axes — xG/90, shots/90, etc.) plus a filterable, sortable per-90 table |
| **Country (team) statistics** | ✅ | 45 nations ranked by attack/defence/xG/possession/discipline |
| **Betting odds** | 🕓 Coming-soon page | Placeholder, ready for a live feed |
| **Fantasy zone** | 🕓 Coming-soon page | Placeholder |

### Honest data notes
- **Hosts (USA, Canada, Mexico)** played no qualifiers, so they have no qualification stats/squad — pages say so.
- **The three hosts** (USA, Canada, Mexico) qualified automatically, so they have no qualifying matches or qualifier squads — their pages note this and will fill in once live tournament data is added. All 45 non-host nations have full team stats and squads (including all 16 UEFA teams).
- The expected XI is inferred from **games started, minutes and average match rating** in qualifying; the formation (e.g. 4-4-2, 4-3-3) is read off the positions of the most-used starters rather than forced. Position data is only four buckets (GK/DEF/MID/FWD), so the shape is approximate.
- The predictor's default order and pre-picked winners come from a **power rating** = a consensus strength tier nudged by qualifying form (so a minnow's perfect record in a weak group can't leapfrog an established side). Everything is user-overridable; predictions are held in memory and reset on reload.
- The source's "Current Club" field is actually the **national team** a player represented in qualifying, so squads are grouped on that (this also correctly handles dual-nationals). Real club affiliations and live match results will slot in when live WC data is wired in — that's why the lineup cards show position/nationality and the "Previous games" panel is a placeholder. Some smaller federations report no shot/market-value data, so those columns can be blank.

## Files
```
site/
├── index.html        # app shell
├── styles.css        # theme
├── app.js            # router + all pages (vanilla JS, no framework)
├── data.js           # pre-processed bundle (groups, teams, squads, stats)
├── scenarios.json    # 495 third-place bracket scenarios (fetched on the Predictor page)
└── .nojekyll         # tells GitHub Pages to serve files as-is
build_data.py         # regenerates data.js / scenarios.json from the raw CSV/JSON
```

## Deploy to GitHub Pages (5 minutes)

1. Create a new repo on GitHub, e.g. `wc26-hub`.
2. Put the **contents of the `site/` folder** in the repo root (so `index.html` is at the top level).
   ```bash
   git init
   git add .
   git commit -m "World Cup 2026 hub"
   git branch -M main
   git remote add origin https://github.com/<you>/wc26-hub.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**, branch `main`, folder `/ (root)`. Save.
4. Wait ~1 minute. Your site is live at `https://<you>.github.io/wc26-hub/`.

That's it — the site uses hash routing (`#/groups`, `#/country/ARG`, …), so deep links and refreshes work on GitHub Pages with no extra config.

## Regenerating the data
If you update the raw CSV/JSON, re-run the builder (paths point at the original upload folder):
```bash
python3 build_data.py
```

## Local preview
```bash
cd site
python3 -m http.server 8000
# open http://localhost:8000
```
(Use a server rather than opening the file directly, so the Predictor page can fetch `scenarios.json`.)
