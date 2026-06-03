#!/usr/bin/env python3
"""Build a single compact data bundle (site/data.js) for the WC2026 site
from the uploaded CSV/JSON sources."""
import csv, json, os, sys
from collections import defaultdict

SRC = "/mnt/user-data/uploads"
OUT = "/home/claude/wc26/site"

def load_csv(path):
    with open(os.path.join(SRC, path), newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))

# ---- groups & bracket ----
groups = json.load(open(os.path.join(SRC, "fifa_wc2026_groups.json")))
bracket = json.load(open(os.path.join(SRC, "fifa_wc2026_bracket_progression.json")))

# ---- team file map ----
TEAM_FILES = {
    "africa":  "international-wc-qualification-africa-teams-2026-to-2026-stats.csv",
    "asia":    "international-wc-qualification-asia-teams-2026-to-2026-stats.csv",
    "concacaf":"international-wc-qualification-concacaf-teams-2026-to-2026-stats.csv",
    "oceania": "international-wc-qualification-oceania-teams-2026-to-2026-stats.csv",
    "sa":      "international-wc-qualification-south-america-teams-2023-to-2026-stats.csv",
    "europe":  "international-wc-qualification-europe-teams-2026-to-2026-stats.csv",
}
PLAYER_FILES = {
    "africa":  "international-wc-qualification-africa-players-2026-to-2026-stats.csv",
    "asia":    "international-wc-qualification-asia-players-2026-to-2026-stats.csv",
    "concacaf":"international-wc-qualification-concacaf-players-2026-to-2026-stats.csv",
    "oceania": "international-wc-qualification-oceania-players-2026-to-2026-stats.csv",
    "sa":      "international-wc-qualification-south-america-players-2023-to-2026-stats.csv",
}

team_rows = {k: load_csv(v) for k, v in TEAM_FILES.items()}
player_rows = {k: load_csv(v) for k, v in PLAYER_FILES.items()}

# code -> (team_file_key, csv_common_name | None, player_file_key | None, nationality | None)
MAP = {
 "MEX": (None, None, "concacaf", "Mexico"),
 "CAN": (None, None, "concacaf", "Canada"),
 "USA": (None, None, "concacaf", "USA"),
 "RSA": ("africa", "South Africa", "africa", "South Africa"),
 "KOR": ("asia", "South Korea", "asia", "South Korea"),
 "CZE": ("europe", "Czech Republic", None, None),
 "BIH": ("europe", "Bosnia and Herzegovina", None, None),
 "QAT": ("asia", "Qatar", "asia", "Qatar"),
 "SUI": ("europe", "Switzerland", None, None),
 "BRA": ("sa", "Brazil", "sa", "Brazil"),
 "MAR": ("africa", "Morocco", "africa", "Morocco"),
 "HAI": ("concacaf", "Haiti", "concacaf", "Haiti"),
 "SCO": ("europe", "Scotland", None, None),
 "PAR": ("sa", "Paraguay", "sa", "Paraguay"),
 "AUS": ("asia", "Australia", "asia", "Australia"),
 "TUR": ("europe", "Turkey", None, None),
 "GER": ("europe", "Germany", None, None),
 "CUW": ("concacaf", "Curaçao", "concacaf", "Curaçao"),
 "CIV": ("africa", "Ivory Coast", "africa", "Ivory Coast"),
 "ECU": ("sa", "Ecuador", "sa", "Ecuador"),
 "NED": ("europe", "Netherlands", None, None),
 "JPN": ("asia", "Japan", "asia", "Japan"),
 "SWE": ("europe", "Sweden", None, None),
 "TUN": ("africa", "Tunisia", "africa", "Tunisia"),
 "BEL": ("europe", "Belgium", None, None),
 "EGY": ("africa", "Egypt", "africa", "Egypt"),
 "IRN": ("asia", "Iran", "asia", "Iran"),
 "NZL": ("oceania", "New Zealand", "oceania", "New Zealand"),
 "ESP": ("europe", "Spain", None, None),
 "CPV": ("africa", "Cape Verde Islands", "africa", "Cape Verde"),
 "KSA": ("asia", "Saudi Arabia", "asia", "Saudi Arabia"),
 "URU": ("sa", "Uruguay", "sa", "Uruguay"),
 "FRA": ("europe", "France", None, None),
 "SEN": ("africa", "Senegal", "africa", "Senegal"),
 "IRQ": ("asia", "Iraq", "asia", "Iraq"),
 "NOR": ("europe", "Norway", None, None),
 "ARG": ("sa", "Argentina", "sa", "Argentina"),
 "ALG": ("africa", "Algeria", "africa", "Algeria"),
 "AUT": ("europe", "Austria", None, None),
 "JOR": ("asia", "Jordan", "asia", "Jordan"),
 "POR": ("europe", "Portugal", None, None),
 "COD": ("africa", "Congo DR", "africa", "Congo DR"),
 "UZB": ("asia", "Uzbekistan", "asia", "Uzbekistan"),
 "COL": ("sa", "Colombia", "sa", "Colombia"),
 "ENG": ("europe", "England", None, None),
 "CRO": ("europe", "Croatia", None, None),
 "GHA": ("africa", "Ghana", "africa", "Ghana"),
 "PAN": ("concacaf", "Panama", "concacaf", "Panama"),
}

# flag emoji per code
FLAGS = {
 "MEX":"🇲🇽","CAN":"🇨🇦","USA":"🇺🇸","RSA":"🇿🇦","KOR":"🇰🇷","CZE":"🇨🇿","BIH":"🇧🇦",
 "QAT":"🇶🇦","SUI":"🇨🇭","BRA":"🇧🇷","MAR":"🇲🇦","HAI":"🇭🇹","SCO":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","PAR":"🇵🇾",
 "AUS":"🇦🇺","TUR":"🇹🇷","GER":"🇩🇪","CUW":"🇨🇼","CIV":"🇨🇮","ECU":"🇪🇨","NED":"🇳🇱",
 "JPN":"🇯🇵","SWE":"🇸🇪","TUN":"🇹🇳","BEL":"🇧🇪","EGY":"🇪🇬","IRN":"🇮🇷","NZL":"🇳🇿",
 "ESP":"🇪🇸","CPV":"🇨🇻","KSA":"🇸🇦","URU":"🇺🇾","FRA":"🇫🇷","SEN":"🇸🇳","IRQ":"🇮🇶",
 "NOR":"🇳🇴","ARG":"🇦🇷","ALG":"🇩🇿","AUT":"🇦🇹","JOR":"🇯🇴","POR":"🇵🇹","COD":"🇨🇩",
 "UZB":"🇺🇿","COL":"🇨🇴","ENG":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","CRO":"🇭🇷","GHA":"🇬🇭","PAN":"🇵🇦",
}

def num(v):
    if v is None or v == "" or v == "N/A": return None
    try:
        f = float(v)
        return int(f) if f == int(f) else round(f, 2)
    except (ValueError, TypeError):
        return None

# Key team-stat columns to keep
TEAM_COLS = ["matches_played","wins","draws","losses","points_per_game","goals_scored",
 "goals_conceded","goal_difference","clean_sheets","btts_count","average_possession",
 "shots","shots_on_target","corners_total","cards_total","xg_for_avg_overall",
 "xg_against_avg_overall","win_percentage","clean_sheet_percentage","btts_percentage",
 "performance_rank","goals_scored_per_match","goals_conceded_per_match","fouls",
 "corners_per_match","cards_per_match","first_team_to_score_percentage"]

def find_team_row(fkey, common):
    for r in team_rows[fkey]:
        if r.get("common_name","").strip() == common:
            return r
    # fallback contains
    for r in team_rows[fkey]:
        if common.lower() in r.get("common_name","").lower():
            return r
    return None

def player_squad(pkey, teamkey):
    # In these international datasets the "Current Club" field is the NATIONAL TEAM
    # the player actually represented in qualifying (the real squad), while
    # "nationality" is their listed nationality (dual-nationals differ). Group on the team.
    rows = [r for r in player_rows[pkey] if r.get("Current Club","").strip() == teamkey]
    out = []
    for r in rows:
        out.append({
            "name": r.get("full_name","").strip(),
            "age": num(r.get("age")),
            "pos": r.get("position","").strip(),
            "nat": r.get("nationality","").strip(),
            "min": num(r.get("minutes_played_overall")) or 0,
            "app": num(r.get("appearances_overall")) or 0,
            "g": num(r.get("goals_overall")) or 0,
            "a": num(r.get("assists_overall")) or 0,
            "yc": num(r.get("yellow_cards_overall")) or 0,
            "rc": num(r.get("red_cards_overall")) or 0,
            "cs": num(r.get("clean_sheets_overall")) or 0,
        })
    out.sort(key=lambda p: (p["min"], p["app"]), reverse=True)
    return out

POS_ORDER = {"Goalkeeper":0,"Defender":1,"Midfielder":2,"Forward":3}

def probable_xi(squad):
    """Heuristic 4-3-3 from minutes leaders by position."""
    by = defaultdict(list)
    for p in squad:
        by[p["pos"]].append(p)
    need = [("Goalkeeper",1),("Defender",4),("Midfielder",3),("Forward",3)]
    xi, used = [], set()
    for pos, n in need:
        for p in by.get(pos, [])[:n]:
            xi.append(p); used.add(p["name"])
    # backfill to 11 from remaining by minutes
    if len(xi) < 11:
        for p in squad:
            if p["name"] not in used:
                xi.append(p); used.add(p["name"])
                if len(xi) >= 11: break
    bench = [p for p in squad if p["name"] not in used][:12]
    return xi[:11], bench

teams = {}
all_players = []  # for global leaderboards (qualifiers)
country_stats = []  # for country leaderboards

for gid, gobj in groups["groups"].items():
    for t in gobj["teams"]:
        code = t["code"]
        fkey, common, pkey, nat = MAP[code]
        entry = {
            "code": code, "name": t["name"], "flag": FLAGS.get(code,"🏳️"),
            "group": gid, "slot": t["slot"], "conf": t["confederation"],
            "host": t["host"], "debut": t["debut"],
            "stats": None, "squad": [], "xi": [], "bench": [],
            "player_source": "available" if pkey else "europe_na",
            "team_source": "available" if fkey else "host_na",
        }
        if fkey and common:
            row = find_team_row(fkey, common)
            if row:
                st = {c: num(row.get(c)) for c in TEAM_COLS}
                entry["stats"] = st
                country_stats.append({"code":code,"name":t["name"],"flag":entry["flag"],
                                      "group":gid,"conf":t["confederation"],**st})
        if pkey and nat:
            teamkey = common or nat  # Current Club value == team common_name (hosts use plain name)
            sq = player_squad(pkey, teamkey)
            entry["squad"] = sq[:30]
            xi, bench = probable_xi(sq)
            entry["xi"] = xi
            entry["bench"] = bench
            for p in sq:
                all_players.append({**p, "team": t["name"], "code": code,
                                    "flag": entry["flag"], "group": gid})
        teams[code] = entry

# europe league summary
eu_league = load_csv("international-wc-qualification-europe-league-2026-to-2026-stats.csv")
eu_league = eu_league[0] if eu_league else {}

# trimmed scenarios (keep all 495 but compact)
scen = json.load(open(os.path.join(SRC, "fifa_wc2026_495_scenarios.json")))

bundle = {
    "meta": {
        "title": groups["title"],
        "draw_source": groups["source"],
        "built": "June 2026",
        "summary": groups["summary"],
    },
    "groups": {gid: [t["code"] for t in g["teams"]] for gid, g in groups["groups"].items()},
    "teams": teams,
    "bracket": bracket,
    "country_stats": country_stats,
    "players": all_players,
    "eu_league": {k: num(v) if num(v) is not None else v for k, v in eu_league.items()},
}

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "data.js"), "w", encoding="utf-8") as f:
    f.write("window.WC_DATA = ")
    json.dump(bundle, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

# scenarios as separate fetchable file (compact)
with open(os.path.join(OUT, "scenarios.json"), "w", encoding="utf-8") as f:
    json.dump(scen, f, ensure_ascii=False, separators=(",", ":"))

# report
np = sum(1 for t in teams.values() if t["squad"])
nt = sum(1 for t in teams.values() if t["stats"])
print(f"teams={len(teams)} with_team_stats={nt} with_players={np} "
      f"total_qualifier_players={len(all_players)}")
print("data.js bytes:", os.path.getsize(os.path.join(OUT,"data.js")))
print("scenarios.json bytes:", os.path.getsize(os.path.join(OUT,"scenarios.json")))
# warn empties
for c,t in teams.items():
    if t["team_source"]=="available" and not t["stats"]:
        print("WARN no team stats:", c, t["name"])
    if t["player_source"]=="available" and not t["squad"]:
        print("WARN no players:", c, t["name"])
