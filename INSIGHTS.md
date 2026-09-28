# Insights — what the data says about LILA BLACK's maps

All numbers come from the full dataset (Feb 10–14, 1,243 journeys, 796 matches). Each one can be reproduced in the tool with the view noted under it. Terms used below:

- **Human run:** one human journey file.
- **Visitor:** a human run with at least one position sample inside the area (radius ≈ 48 world units).
- **Survived:** the run has no death event. Extraction itself is not logged.

---

## 1. On Lockdown, the storm is a late-game trap: half the players still in at 11:00 die to it

**What caught my eye.** Switching the storm heatmap between maps, Lockdown looks different from the other two. Its storm deaths are spread across the middle of the map, not along the edges. The timeline strip puts every one of them at the very end of the match.

**Evidence**

| | Ambrose Valley | Grand Rift | Lockdown |
|---|---|---|---|
| Human runs ending in storm death | 17 / 555 (**3.1%**) | 5 / 57 (8.8%) | 17 / 170 (**10.0%**) |
| Human runs still in the match at 11:00 | 86 (15%) | 8 (14%) | 33 (19%) |
| …of those, died to the storm | **20%** | 62% (n=8) | **48%** |

- Storm deaths happen only late. All 39 fall between **10:55 and 14:47** of match time, while the median surviving human is last seen at about 8:30.
- Lockdown players aren't staying much later than players on other maps (19% vs 15% are still in at 11:00). The difference is what happens to the ones who do stay: on Lockdown, half of them never make it out.

**What to do.** The storm is working as a timer, but on Lockdown it turns a normal late decision into death half of the time. Options:
- Add an extraction point, or move one closer to the central valley where the storm deaths cluster.
- Add clearer storm/extraction wayfinding on Lockdown.
- Start the storm warning earlier on this map only.

*Metrics that should move:* storm-death rate per map (target near Ambrose's ~3%), extraction rate for players still in after 11:00, and early quits / re-queue rate after a storm death.

**Why a level designer should care.** A storm death is the most frustrating way to lose loot in an extraction shooter, because there is no opponent to blame. When a map kills 1 in 10 runs that way and its players don't stay longer than on other maps, the cause is almost always layout: exit placement and route length. It isn't a skill gap.

> Reproduce: **Lockdown → All matches → Heatmap: Storm**, turn off Kills/Deaths. The ticks on the timeline strip show the timing.

---

## 2. Ambrose Valley's risk and reward are inverted: the busiest central areas are the deadliest *and* pay the least

**What caught my eye.** On Ambrose Valley, the Deaths heatmap concentrates in the centre-west. The Loot heatmap is spread much more evenly. Bots cause **53.5%** of all human deaths there, and PvP accounts for only 2. So bot placement *is* the risk design.

**Evidence** (Ambrose Valley, 555 human runs; share of visitors killed by a bot vs loot pickups per visitor)

| Area | Visited by | Killed by bots | Loot per visitor |
|---|---|---|---|
| Central yard (industrial yard, map centre) | 31.7% | **25.6%** | 6.6 |
| West river village | 30.3% | **26.8%** | **4.1** |
| Walled compound (centre-west) | 21.3% | **25.4%** | **3.9** |
| North warehouse | 13.9% | 24.7% | 6.8 |
| NE outpost | 13.9% | **2.6%** | **6.6** |
| South dome | 16.9% | **3.2%** | **6.3** |
| Far-west compound | 19.1% | **0.0%** | 5.2 |

- In the three most-visited areas, about **1 in 4 visitors dies**.
- Two of those three (West river village, Walled compound) give the **lowest** loot per visitor on the map.
- The NE outpost and South dome give about the same loot as the deadliest areas with **~10× less risk**, yet only about 1 in 7 players goes there.
- Deaths are concentrated. **22%** of all Ambrose deaths to bots happen in three ~56 m grid squares.

**What to do.**
- *West river village and Walled compound* are traps: high risk, low reward. Cut bot density or add cover and flank routes, or raise their loot tier to justify the risk.
- *NE outpost, South dome and Far-west compound* are free loot. Add a bot patrol or lower their loot tier so safe play doesn't win outright.
- The North warehouse is already a working high-risk, high-reward area. Leave it and use it as the benchmark.

*Metrics that should move:* death rate per area (aim to tie it to loot value), loot per visitor, how evenly visits are spread across areas, and survival rate on Ambrose Valley.

**Why a level designer should care.** Players learn the risk/reward of each area quickly. If the central, most-visited areas punish without paying out, experienced players will route around them, and new players will keep dying there.

> Reproduce: **Ambrose Valley → All matches → Heatmap: Deaths**, then switch to **Loot**. Click any death marker in the centre-west to open that match and watch the fight.

---

## 3. Traffic funnels into a small part of each map, and good areas at the edges are going unused

**What caught my eye.** In the Traffic heatmap, players move from the fixed spawn points at the map edges straight into the centre. Large parts of the outer ring barely show up.

**Evidence** (human position samples, one every ~5 s, on a 32×32 grid)

| Map | Grid cells ever entered by a human | Cells holding 50% of movement time | Cells holding 80% |
|---|---|---|---|
| Ambrose Valley | 438 | **57 (13%)** | 166 (38%) |
| Lockdown | 321 | **45 (14%)** | 123 (38%) |
| Grand Rift | 355 | 63 (18%) | 160 (45%) |

- On Ambrose Valley, the **SE houses** are visited by just **8.5%** of runs.
- The **far-east road exit** is visited by 16.8%, but players keep moving: 0.2 loot per visitor and ~20 s spent there on average.
- The NE outpost has the best risk/reward on the map (see insight 2) and gets 13.9%.
- The map rotation is lopsided too. Grand Rift hosts only **59 of 796 matches (7.4%)**, against 566 (71%) on Ambrose Valley.

**What to do.**
- Give the outer areas a reason to go there: a marked high-tier loot room, an objective, or a nearby extraction.
- Or shrink or simplify them if they're unused on purpose.
- Where a route is used only to pass through (far-east road), consider cover or a small loot cache along it so it becomes a real choice.
- Check whether Grand Rift's low share is a matchmaking weight or a player preference before investing more art time in it.

*Metrics that should move:* share of the map with meaningful traffic (e.g. cells holding 80% of time), visits per area, variety of routes between spawn and extraction, and map pick/queue share.

**Why a level designer should care.** Every unused square metre is art, lighting and QA budget that players never see. When all the traffic runs through the same few lanes, fights and deaths become predictable, and that drives the risk imbalance in insight 2.

> Reproduce: **Ambrose Valley → All matches → Heatmap: Traffic**, turn off event markers. Set Spread to 1–2 for a sharper view.

---

### Caveats
- 743 of 796 matches contain a single human journey file, so PvP (3 kills in 5 days) is either very rare or under-sampled. For that reason, none of the insights above rely on PvP.
- Area names are my own labels for buildings on the minimap. Grand Rift is the only map with printed area names.
