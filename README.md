# World Cup 2026 Hub ⚽

A static, single-page site for the FIFA World Cup 2026 (USA · Canada · Mexico). No build step, no backend — just HTML/CSS/JS that runs anywhere, including **GitHub Pages**.

## What's built (from your plan)

| Page | Status | Notes |
|------|--------|-------|
| **Home** | ✅ | Hub linking every section |
| **Groups** | ✅ | All 12 groups, 48 teams, host/debut tags |
| **Knockout bracket** | ✅ | R32 → Final, with a selector for all **495** third-place qualifying scenarios |
| **Countries** | ✅ | All 48 nations, filter by confederation, search |
| **Individual country page** | ✅ | Group · qualification stats · expected XI (4-3-3) + bench · squad table · history placeholder |
| **Player statistics** | ✅ | 1,400+ qualifier players, sortable/filterable leaderboards |
| **Country (team) statistics** | ✅ | 45 nations ranked by attack/defence/xG/possession/discipline |
| **Betting odds** | 🕓 Coming-soon page | Placeholder, ready for a live feed |
| **Fantasy zone** | 🕓 Coming-soon page | Placeholder |

### Honest data notes
- **Hosts (USA, Canada, Mexico)** played no qualifiers, so they have no qualification stats/squad — pages say so.
- **UEFA player-level data** isn't in the source files, so European nations show team stats but not an expected XI yet. (All non-European qualified teams have full squads.)
- The source's "Current Club" field is actually the **national team** a player represented in qualifying, so squads are grouped on that (this also correctly handles dual-nationals). Real club affiliations and live match results will slot in when live WC data is wired in — that's why the lineup cards show position/nationality and the "Previous games" panel is a placeholder.

## Files
```
site/
├── index.html        # app shell
├── styles.css        # theme
├── app.js            # router + all pages (vanilla JS, no framework)
├── data.js           # pre-processed bundle (groups, teams, squads, stats)
├── scenarios.json    # 495 third-place bracket scenarios (fetched on the Bracket page)
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
(Use a server rather than opening the file directly, so the Bracket page can fetch `scenarios.json`.)
