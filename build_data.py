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
    "europe":  "international-wc-qualification-europe-players-2026-to-2026-stats.csv",
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
 "CZE": ("europe", "Czech Republic", "europe", "Czech Republic"),
 "BIH": ("europe", "Bosnia and Herzegovina", "europe", "Bosnia and Herzegovina"),
 "QAT": ("asia", "Qatar", "asia", "Qatar"),
 "SUI": ("europe", "Switzerland", "europe", "Switzerland"),
 "BRA": ("sa", "Brazil", "sa", "Brazil"),
 "MAR": ("africa", "Morocco", "africa", "Morocco"),
 "HAI": ("concacaf", "Haiti", "concacaf", "Haiti"),
 "SCO": ("europe", "Scotland", "europe", "Scotland"),
 "PAR": ("sa", "Paraguay", "sa", "Paraguay"),
 "AUS": ("asia", "Australia", "asia", "Australia"),
 "TUR": ("europe", "Turkey", "europe", "Turkey"),
 "GER": ("europe", "Germany", "europe", "Germany"),
 "CUW": ("concacaf", "Curaçao", "concacaf", "Curaçao"),
 "CIV": ("africa", "Ivory Coast", "africa", "Ivory Coast"),
 "ECU": ("sa", "Ecuador", "sa", "Ecuador"),
 "NED": ("europe", "Netherlands", "europe", "Netherlands"),
 "JPN": ("asia", "Japan", "asia", "Japan"),
 "SWE": ("europe", "Sweden", "europe", "Sweden"),
 "TUN": ("africa", "Tunisia", "africa", "Tunisia"),
 "BEL": ("europe", "Belgium", "europe", "Belgium"),
 "EGY": ("africa", "Egypt", "africa", "Egypt"),
 "IRN": ("asia", "Iran", "asia", "Iran"),
 "NZL": ("oceania", "New Zealand", "oceania", "New Zealand"),
 "ESP": ("europe", "Spain", "europe", "Spain"),
 "CPV": ("africa", "Cape Verde Islands", "africa", "Cape Verde"),
 "KSA": ("asia", "Saudi Arabia", "asia", "Saudi Arabia"),
 "URU": ("sa", "Uruguay", "sa", "Uruguay"),
 "FRA": ("europe", "France", "europe", "France"),
 "SEN": ("africa", "Senegal", "africa", "Senegal"),
 "IRQ": ("asia", "Iraq", "asia", "Iraq"),
 "NOR": ("europe", "Norway", "europe", "Norway"),
 "ARG": ("sa", "Argentina", "sa", "Argentina"),
 "ALG": ("africa", "Algeria", "africa", "Algeria"),
 "AUT": ("europe", "Austria", "europe", "Austria"),
 "JOR": ("asia", "Jordan", "asia", "Jordan"),
 "POR": ("europe", "Portugal", "europe", "Portugal"),
 "COD": ("africa", "Congo DR", "africa", "Congo DR"),
 "UZB": ("asia", "Uzbekistan", "asia", "Uzbekistan"),
 "COL": ("sa", "Colombia", "sa", "Colombia"),
 "ENG": ("europe", "England", "europe", "England"),
 "CRO": ("europe", "Croatia", "europe", "Croatia"),
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

def per90(total, minutes):
    if total is None or not minutes: return None
    return round(total / (minutes/90.0), 2)

def player_squad(pkey, teamkey):
    # In these international datasets the "Current Club" field is the NATIONAL TEAM
    # the player actually represented in qualifying (the real squad), while
    # "nationality" is their listed nationality (dual-nationals differ). Group on the team.
    rows = [r for r in player_rows[pkey] if r.get("Current Club","").strip() == teamkey]
    out = []
    for r in rows:
        mins = num(r.get("minutes_played_overall")) or 0
        xg = num(r.get("xg_total_overall"))
        out.append({
            "name": r.get("full_name","").strip(),
            "age": num(r.get("age")),
            "pos": r.get("position","").strip(),
            "nat": r.get("nationality","").strip(),
            "min": mins,
            "app": num(r.get("appearances_overall")) or 0,
            "gs":  num(r.get("games_started")) or 0,
            "g": num(r.get("goals_overall")) or 0,
            "a": num(r.get("assists_overall")) or 0,
            "yc": num(r.get("yellow_cards_overall")) or 0,
            "rc": num(r.get("red_cards_overall")) or 0,
            "cs": num(r.get("clean_sheets_overall")) or 0,
            "rt": num(r.get("average_rating_overall")),
            "xg": xg,
            "xg90": per90(xg, mins),
            "g90":  num(r.get("goals_per_90_overall")),
            "a90":  num(r.get("assists_per_90_overall")),
            "ga90": num(r.get("goals_involved_per_90_overall")),
            "sh90": num(r.get("shots_per_90_overall")),
            "sot90":num(r.get("shots_on_target_per_90_overall")),
            "kp90": num(r.get("key_passes_per_90_overall")),
            "cc90": num(r.get("chances_created_per_90_overall")),
            "tk90": num(r.get("tackles_per_90_overall")),
            "int90":num(r.get("interceptions_per_90_overall")),
            "drb90":num(r.get("dribbles_successful_per_90_overall")),
            "pas90":num(r.get("passes_per_90_overall")),
            "pasc": num(r.get("pass_completion_rate_overall")),
            "sav90":num(r.get("saves_per_90_overall")),
            "mv":   num(r.get("market_value")),
        })
    # default sort: actual starters first (games started, then minutes)
    out.sort(key=lambda p: (p["gs"], p["min"], p["app"]), reverse=True)
    return out

POS_ORDER = {"Goalkeeper":0,"Defender":1,"Midfielder":2,"Forward":3}

def starter_score(p):
    """How likely the player is a first-choice starter, from qualifying usage + quality."""
    s = (p["gs"] or 0)*3.0 + (p["app"] or 0)*1.0 + (p["min"] or 0)/90.0
    if p.get("rt"): s += (p["rt"] - 6.5) * 2.0   # rating nudge around a 6.5 baseline
    return s

def probable_xi(squad):
    """Pick the most likely first-choice XI from games started + minutes, then arrange
    into the formation that the selected outfield players actually imply (clamped to a
    realistic shape). Returns (xi, bench, formation_string)."""
    ranked = sorted(squad, key=starter_score, reverse=True)
    gks = [p for p in ranked if p["pos"]=="Goalkeeper"]
    out = [p for p in ranked if p["pos"]!="Goalkeeper"]
    gk = gks[:1]
    # take the 10 strongest outfield starters, then see what shape they form
    top10 = out[:10]
    d = sum(1 for p in top10 if p["pos"]=="Defender")
    m = sum(1 for p in top10 if p["pos"]=="Midfielder")
    f = sum(1 for p in top10 if p["pos"]=="Forward")
    # clamp to a believable formation, rebalancing to exactly 10 outfielders
    d = min(max(d,3),5); f = min(max(f,1),3); m = 10-d-f
    if m < 2: m = 2; d = min(d, 10-m-f)
    if d+m+f != 10: m = 10-d-f
    need = {"Defender":d, "Midfielder":m, "Forward":f}
    by = defaultdict(list)
    for p in out: by[p["pos"]].append(p)
    xi, used = list(gk), set(p["name"] for p in gk)
    for pos in ("Defender","Midfielder","Forward"):
        for p in by[pos][:need[pos]]:
            xi.append(p); used.add(p["name"])
    # backfill if a bucket was short
    if len(xi) < 11:
        for p in ranked:
            if p["name"] not in used:
                xi.append(p); used.add(p["name"])
                if len(xi) >= 11: break
    bench = [p for p in ranked if p["name"] not in used][:7]
    formation = f"{d}-{m}-{f}"
    return xi[:11], bench, formation

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
            xi, bench, formation = probable_xi(sq)
            entry["xi"] = xi
            entry["bench"] = bench
            entry["formation"] = formation
            for p in sq:
                all_players.append({**p, "team": t["name"], "code": code,
                                    "flag": entry["flag"], "group": gid})
        teams[code] = entry

# ---- team power ratings (drive the predictor's default group order & picks) ----
# Consensus pre-tournament strength prior (0-100), blended with qualifying form.
TIER = {
 "ARG":96,"FRA":95,"ESP":94,"ENG":92,"BRA":90,"POR":89,"GER":88,"NED":86,
 "BEL":82,"CRO":80,"URU":80,"COL":77,"MAR":80,"JPN":77,"SEN":75,"SUI":74,
 "NOR":73,"USA":71,"MEX":69,"TUR":68,"ECU":67,"KOR":66,"CIV":66,"EGY":65,
 "ALG":65,"AUT":64,"IRN":62,"CAN":61,"AUS":61,"GHA":60,"SWE":60,"SCO":59,
 "TUN":58,"BIH":57,"CZE":57,"PAR":57,"COD":55,"RSA":53,"UZB":52,"KSA":52,
 "PAN":51,"QAT":50,"IRQ":49,"JOR":47,"CPV":47,"NZL":45,"HAI":44,"CUW":42,
}
def _vals(key):
    return [t["stats"][key] for t in teams.values() if t["stats"] and t["stats"].get(key) is not None]
def _norm(v, lo, hi):
    if v is None or hi==lo: return None
    return max(0.0, min(1.0, (v-lo)/(hi-lo)))
ppg_v, win_v = _vals("points_per_game"), _vals("win_percentage")
gd_v = [t["stats"]["goal_difference"]/max(1,(t["stats"].get("matches_played") or 1))
        for t in teams.values() if t["stats"] and t["stats"].get("goal_difference") is not None]
ppg_lo,ppg_hi=min(ppg_v),max(ppg_v); win_lo,win_hi=min(win_v),max(win_v); gd_lo,gd_hi=min(gd_v),max(gd_v)
for code,t in teams.items():
    tier = TIER.get(code, 55)
    st = t["stats"]
    if st:
        gdpm = (st.get("goal_difference") or 0)/max(1,(st.get("matches_played") or 1))
        parts = [x for x in (_norm(st.get("points_per_game"),ppg_lo,ppg_hi),
                             _norm(st.get("win_percentage"),win_lo,win_hi),
                             _norm(gdpm,gd_lo,gd_hi)) if x is not None]
        form = (sum(parts)/len(parts))*100 if parts else tier
    else:
        form = tier  # hosts: no qualifiers, lean on prior
    # Tier prior dominates (keeps favourites on top); qualifying form is a light ±6 nudge,
    # so a perfect record in a weak confederation can't leapfrog an established giant.
    t["power"] = round(tier + (form - 50) * 0.12, 1)

for cs in country_stats:
    cs["power"] = teams[cs["code"]]["power"]

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
