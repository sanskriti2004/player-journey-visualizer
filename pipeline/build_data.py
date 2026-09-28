"""Convert raw LILA BLACK parquet telemetry into compact JSON for the web app.

Usage: python pipeline/build_data.py [path/to/player_data]
"""
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

import pyarrow.parquet as pq
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data_raw" / "player_data"
OUT_DATA = ROOT / "public" / "data"
OUT_MAPS = ROOT / "public" / "minimaps"
MINIMAP_SIZE = 2048

MAPS = {
    "AmbroseValley": {"name": "Ambrose Valley", "scale": 900, "originX": -370, "originZ": -473, "file": "AmbroseValley_Minimap.png"},
    "GrandRift": {"name": "Grand Rift", "scale": 581, "originX": -290, "originZ": -290, "file": "GrandRift_Minimap.png"},
    "Lockdown": {"name": "Lockdown", "scale": 1000, "originX": -500, "originZ": -500, "file": "Lockdown_Minimap.jpg"},
}
MOVEMENT = {"Position", "BotPosition"}
KILLS = {"Kill", "BotKill"}
DEATHS = {"Killed", "BotKilled", "KilledByStorm"}
BOT_ID = re.compile(r"^\d+$")
MONTHS = {m: i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"], 1)}


def world_to_uv(map_id, x, z):
    m = MAPS[map_id]
    return (x - m["originX"]) / m["scale"], (z - m["originZ"]) / m["scale"]


def folder_to_iso(name):
    month, day = name.split("_")
    return date(2026, MONTHS[month], int(day)).isoformat()


def read_files():
    for day_dir in sorted(p for p in RAW.iterdir() if p.is_dir() and "_" in p.name and p.name.split("_")[0] in MONTHS):
        day = folder_to_iso(day_dir.name)
        for f in sorted(day_dir.iterdir()):
            if f.name.startswith("."):
                continue
            try:
                table = pq.read_table(f)
            except Exception as exc:  # noqa: BLE001
                print(f"  skip unreadable {f.name}: {exc}")
                continue
            yield day, f.name, table


def outcome(events, is_bot):
    if "KilledByStorm" in events:
        return "storm"
    if "Killed" in events:
        return "killed_by_player"
    if "BotKilled" in events:
        # In a bot's own file BotKilled only says the bot died, not who killed it.
        return "killed" if is_bot else "killed_by_bot"
    return "survived"


def build():
    journeys = []
    stats = defaultdict(int)
    for day, fname, table in read_files():
        # `ts` is typed timestamp[ms] but the stored integers are Unix *seconds*; read the raw int64.
        ts = table.column("ts").cast("int64").to_pylist()
        cols = table.drop(["ts"]).to_pydict()
        n = table.num_rows
        if n == 0:
            stats["empty_files"] += 1
            continue
        user_id, match_id, map_id = cols["user_id"][0], cols["match_id"][0], cols["map_id"][0]
        if map_id not in MAPS:
            stats["unknown_map_files"] += 1
            continue
        rows, seen = [], set()
        for i in range(n):
            ev = cols["event"][i]
            ev = ev.decode("utf-8") if isinstance(ev, (bytes, bytearray)) else str(ev)
            t = ts[i]
            x, z = float(cols["x"][i]), float(cols["z"][i])
            if ev in MOVEMENT:
                key = (t, round(x, 3), round(z, 3))
                if key in seen:
                    stats["duplicate_positions_dropped"] += 1
                    continue
                seen.add(key)
            rows.append((t, ev, x, float(cols["y"][i]), z))
        rows.sort(key=lambda r: r[0])
        stats["rows"] += len(rows)
        journeys.append({
            "day": day, "file": fname, "user": user_id, "match": match_id.removesuffix(".nakama-0"),
            "map": map_id, "bot": bool(BOT_ID.match(user_id)), "rows": rows,
        })
    return journeys, stats


def export(journeys, stats):
    OUT_DATA.mkdir(parents=True, exist_ok=True)
    by_match = defaultdict(list)
    for j in journeys:
        by_match[j["match"]].append(j)

    per_map = {m: {} for m in MAPS}
    matches = []
    uv_out_of_range = 0
    for match_id, js in by_match.items():
        start = min(r[0] for j in js for r in j["rows"])
        end = max(r[0] for j in js for r in j["rows"])
        map_id = js[0]["map"]
        counts = defaultdict(int)
        players = []
        for j in sorted(js, key=lambda j: (j["bot"], j["user"])):
            path, events = [], []
            for t, ev, x, _y, z in j["rows"]:
                u, v = world_to_uv(map_id, x, z)
                if not (0 <= u <= 1 and 0 <= v <= 1):
                    uv_out_of_range += 1
                rel = t - start
                if ev in MOVEMENT:
                    path += [rel, round(u, 4), round(v, 4)]
                else:
                    events.append([rel, round(u, 4), round(v, 4), ev])
                    counts[ev] += 1
            evset = {e[3] for e in events}
            players.append({
                "id": j["user"], "bot": j["bot"], "outcome": outcome(evset, j["bot"]),
                "path": path, "events": events,
            })
        per_map[map_id][match_id] = {"players": players}
        matches.append({
            "id": match_id,
            "map": map_id,
            "day": min(j["day"] for j in js),
            "startedAt": start,
            "duration": end - start,
            "humans": sum(not p["bot"] for p in players),
            "bots": sum(p["bot"] for p in players),
            "kills": sum(counts[e] for e in KILLS),
            "deaths": sum(counts[e] for e in DEATHS),
            "stormDeaths": counts["KilledByStorm"],
            "loot": counts["Loot"],
        })

    matches.sort(key=lambda m: m["startedAt"])
    for map_id, data in per_map.items():
        with open(OUT_DATA / f"{map_id}.json", "w") as f:
            json.dump({"matches": data}, f, separators=(",", ":"))

    manifest = {
        "maps": [
            {"id": k, "name": v["name"], "scale": v["scale"], "originX": v["originX"], "originZ": v["originZ"],
             "image": f"minimaps/{k}.jpg"}
            for k, v in MAPS.items()
        ],
        "days": sorted({m["day"] for m in matches}),
        "matches": matches,
    }
    with open(OUT_DATA / "manifest.json", "w") as f:
        json.dump(manifest, f, separators=(",", ":"))

    stats["matches"] = len(matches)
    stats["journeys"] = len(journeys)
    stats["uv_out_of_range"] = uv_out_of_range
    stats["cross_day_matches"] = sum(len({j["day"] for j in js}) > 1 for js in by_match.values())
    stats["numeric_id_with_human_events"] = sum(
        1 for j in journeys if j["bot"] and any(r[1] == "Position" for r in j["rows"]))
    return stats


def export_minimaps():
    OUT_MAPS.mkdir(parents=True, exist_ok=True)
    for map_id, cfg in MAPS.items():
        src = RAW / "minimaps" / cfg["file"]
        img = Image.open(src)
        print(f"  {cfg['file']}: {img.size[0]}x{img.size[1]} -> {MINIMAP_SIZE}x{MINIMAP_SIZE}")
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            bg = Image.new("RGB", img.size, (0, 0, 0))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        img = img.convert("RGB").resize((MINIMAP_SIZE, MINIMAP_SIZE), Image.LANCZOS)
        img.save(OUT_MAPS / f"{map_id}.jpg", quality=85, optimize=True, progressive=True)


def self_check():
    # Worked example from the dataset README: (-301.45, -355.55) on AmbroseValley -> pixel (78, 890) on 1024px.
    u, v = world_to_uv("AmbroseValley", -301.45, -355.55)
    assert (round(u * 1024), round((1 - v) * 1024)) == (78, 890)


if __name__ == "__main__":
    self_check()
    print(f"Reading {RAW}")
    journeys, stats = build()
    stats = export(journeys, stats)
    print("Exporting minimaps")
    export_minimaps()
    for k, v in stats.items():
        print(f"  {k}: {v}")
