# Architecture

## Stack and why

| Layer | Choice | Why |
|---|---|---|
| Data pipeline | Python + **pyarrow** (one script) | Reads the parquet files natively. The dataset is small (89k rows), so a one-off offline build is simpler than a database or API. |
| Frontend | **React + TypeScript + Vite** | Fast to build, typed data model, static output. |
| Rendering | **Canvas 2D**, no map/chart libraries | Full control over pan/zoom, paths, markers and heatmap in one render pass. Stays at 60 fps with ~50k path points. |
| Hosting | **GitHub Pages** via GitHub Actions | Free, no servers, deploys from the same repo that is submitted. |
| Tests | Vitest (logic) + Playwright (E2E, also run against the live URL) | Covers the parts that can quietly go wrong: coordinates, playback interpolation, heatmap orientation, UI flows. |

No backend: the processed dataset is ~2 MB of JSON (~600 KB gzipped), so the browser holds a whole map in memory and every filter is instant.

## Data flow

```
player_data/February_*/{user}_{match}.nakama-0  (1,243 parquet files)
        │  pipeline/build_data.py
        │   • decode event bytes → str        • ts int64 = Unix *seconds* → t = ts − match start
        │   • bot = numeric user_id            • drop duplicate position samples (same t, x, z)
        │   • world (x, z) → UV [0,1]          • group files by match_id, sort by t
        │   • downscale minimaps → 2048² JPEG  • per-journey outcome (storm / killed / no death)
        ▼
public/data/manifest.json        maps + match summaries (day, duration, humans, bots, kills, deaths…)
public/data/{Map}.json           match → players → { path: flat [t,u,v,…], events: [[t,u,v,type]] }
public/minimaps/{Map}.jpg
        │  fetched on demand (one map at a time, cached)
        ▼
React state: map · days · match · layers · heatmap · time   (map/days/match/heatmap mirrored to the URL hash)
        │  filter → journeys[] → canvas: minimap → heatmap → paths → markers → playback heads
        ▼
Level designer's browser
```

## Coordinate mapping

The README gives `u = (x − originX) / scale`, `v = (z − originZ) / scale`, `pixel = (u·1024, (1 − v)·1024)`. Three details matter:

1. **Use `x` and `z`, not `y`.** `y` is elevation, which I ignore.
2. **The minimaps are not 1024².** They are 4320², 2160×2158 and 9000². So I never store pixels. The pipeline outputs **UV** (rounded to 4 decimals, ≈0.1 px at 1024), and the renderer maps UV onto a logical 1024-unit square: `screen = offset + (u·1024, (1−v)·1024)·zoom`. The images are downscaled to 2048² so this holds for any resolution. Grand Rift's 2 px non-squareness (0.09%) is stretched away.
3. **Flip Y.** World Z grows "north", but image rows grow downward, hence `1 − v`.

**Verification:**
- The README's worked example, (−301.45, −355.55) → pixel (78, 890), is asserted in both the Python pipeline and a Vitest test.
- All 89k points fall inside [0,1]² (the pipeline reports `uv_out_of_range: 0`).
- Overlaying every position on each minimap shows paths following roads, bridges and building interiors.
- An E2E test hovers the screen position computed for a known kill and checks that the tooltip for that kill appears.

## Assumptions and ambiguities

| What I ran into | How I handled it |
|---|---|
| `ts` is typed `timestamp[ms]`, but the values are Unix **seconds** (read as ms, all 5 days fall within ~7 minutes of 1970-01-21) | Read the raw int64 as seconds. Matches then last 13 s to 14:50 (median 6:22) with a 5 s sample rate, which matches "several minutes". |
| Events are logged from the **file owner's** point of view. In bot files, `BotKill`/`BotKilled` mean *this bot* killed / died | Treat events as actor-centric: Kill + BotKill → "Kills", Killed + BotKilled → "Deaths". For bots, the cause of a `BotKilled` is shown as just "Killed". |
| 17 files with numeric (bot) IDs emit human `Position`/`Loot` events. Bot IDs are reused across matches (e.g. `1429` appears in 17 matches) | Follow the README rule: numeric ID = bot. Documented as a known anomaly. |
| 743 of 796 matches have only one human file, and bots have tracks in only ~50 matches | Show what exists. Bots elsewhere appear only through the human's `BotKill`/`BotKilled` events. The UI shows per-match human and bot counts so this is visible. |
| Exact duplicate rows (1,505) | Drop duplicate *position* samples. Keep duplicate discrete events, since two kills or pickups within the same second are plausible at 1 s resolution. |
| Day folders (e.g. `February_10`) start ~23:58 UTC the day before; one match crosses folders | Filter by folder date as given (it is the studio's own day boundary). A match that crosses folders belongs to its earliest folder. |
| Extraction isn't logged | A journey with no death event is labelled "No death logged", not "Extracted". |

## Trade-offs

| Considered | Decided | Why |
|---|---|---|
| Streamlit / Dash (fast Python UI) | React + Canvas static site | Needs no server. Playback, hover and pan/zoom are smoother, and the tool feels like a product, not a notebook. |
| DuckDB-WASM, reading parquet in the browser | Pre-bake JSON offline | Smaller payload (no 5 MB WASM), faster start, simpler code. Cost: new data needs a pipeline re-run. |
| Leaflet / deck.gl | Hand-written canvas + heatmap (~200 lines) | One simple image coordinate system; no tile or geo projection plumbing. Heatmap blur and colour are tuned for dark minimaps. |
| Per-match files (lazy) | One file per map | ≤1.3 MB raw per map loads in one request and makes aggregate heatmaps instant. Per-match files only pay off at ~10× this data. |
| Time-aware heatmap during playback | Heatmap covers the whole filtered selection | Stable colour scale; paths and markers already show progression over time. |
| Serving full-resolution minimaps | 2048² JPEG (~350 KB each) | 9000² source images are 12 MB. 2048 stays sharp up to about 4× zoom. |
