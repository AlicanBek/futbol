"""ESPN'in herkese açık verisinden puan tablolarını ve sezonun tüm maçlarını çekip data/espn.json yazar.

Sadece standart kütüphane kullanır:  python scripts/fetch_espn.py
"""
from __future__ import annotations

import json
import time
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "espn.json"

BASE = "https://site.api.espn.com/apis"
LEAGUES = {
    "tsl": "tur.1",
    "ucl": "uefa.champions",
    "uel": "uefa.europa",
    "uecl": "uefa.europa.conf",
}
# ESPN bölge açıklamaları -> sitede gösterilecek kısa Türkçe karşılık
ZONES = {
    "Champions League": "ŞL lig aşaması",
    "Champions League qualifying": "ŞL eleme",
    "Europa League qualifying": "AL eleme",
    "Conference League qualifying": "KL eleme",
    "Relegated": "Düşme hattı",
    "Qualifies for round of 16": "Son 16",
    "Knockout phase playoffs - seeded": "Play-off (seri başı)",
    "Knockout phase playoffs - unseeded": "Play-off",
    "Eliminated": "Elenir",
}
# Lig aşamasındaki maç sayısı; sonrası eleme turu
LEAGUE_PHASE_GAMES = {"ucl": 8, "uel": 8, "uecl": 6}


def get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")


def season_months(today: date) -> list[str]:
    """Temmuz'dan başlayan futbol sezonunun 12 ayı, YYYYMM."""
    start_year = today.year if today.month >= 7 else today.year - 1
    months = []
    for i in range(12):
        m = 7 + i
        y = start_year + (m - 1) // 12
        months.append(f"{y}{(m - 1) % 12 + 1:02d}")
    return months


def team_info(t: dict) -> dict:
    logo = t.get("logo") or (t.get("logos") or [{}])[0].get("href", "")
    return {
        "name": t["displayName"],
        "short": t.get("shortDisplayName") or t["displayName"],
        "logo": logo,
        "color": ("#" + t["color"]) if t.get("color") else "",
    }


def fetch_standings(slug: str, teams: dict) -> list[dict]:
    d = get(f"{BASE}/v2/sports/soccer/{slug}/standings")
    rows = []
    for e in d["children"][0]["standings"]["entries"]:
        t = e["team"]
        teams.setdefault(t["id"], team_info(t))
        s = {x["name"]: x.get("displayValue") for x in e["stats"]}
        note = e.get("note") or {}
        rows.append({
            "team": t["id"],
            "rank": int(s["rank"]),
            "gp": int(s["gamesPlayed"]),
            "w": int(s["wins"]),
            "d": int(s["ties"]),
            "l": int(s["losses"]),
            "gf": int(s["pointsFor"]),
            "ga": int(s["pointsAgainst"]),
            "gd": s["pointDifferential"],
            "pts": int(s["points"]),
            "zone": ZONES.get(note.get("description", ""), note.get("description", "")),
            "zoneColor": note.get("color", ""),
        })
    rows.sort(key=lambda r: r["rank"])
    return rows


def fetch_matches(key: str, slug: str, months: list[str], teams: dict) -> list[dict]:
    seen, out = set(), []
    for ym in months:
        d = get(f"{BASE}/site/v2/sports/soccer/{slug}/scoreboard?dates={ym}&limit=300")
        for e in d.get("events", []):
            if e["id"] in seen:
                continue
            seen.add(e["id"])
            c = e["competitions"][0]
            home = next(t for t in c["competitors"] if t.get("homeAway") == "home")
            away = next(t for t in c["competitors"] if t is not home)
            for t in (home, away):
                teams.setdefault(t["team"]["id"], team_info(t["team"]))
            st = c["status"]["type"]
            score = lambda t: (t["score"]["displayValue"] if isinstance(t.get("score"), dict) else t.get("score"))
            out.append({
                "id": e["id"],
                "lg": key,
                "date": e["date"],
                "timeKnown": c.get("timeValid") is not False,
                "venue": (c.get("venue") or {}).get("fullName", ""),
                "h": home["team"]["id"],
                "a": away["team"]["id"],
                "state": st.get("state", "pre"),
                "hs": score(home) if st.get("state") != "pre" else None,
                "as": score(away) if st.get("state") != "pre" else None,
            })
        time.sleep(0.3)
    out.sort(key=lambda m: m["date"])

    # Her takımın bu turnuvadaki kaçıncı maçı (hafta numarası)
    count = defaultdict(int)
    for m in out:
        for side in ("h", "a"):
            count[m[side]] += 1
            n = count[m[side]]
            if key in LEAGUE_PHASE_GAMES and n > LEAGUE_PHASE_GAMES[key]:
                n = None  # eleme turları: hafta yerine "Eleme" gösterilir
            m[side + "w"] = n
    return out


def main() -> None:
    today = datetime.now(timezone.utc).date()
    months = season_months(today)
    teams: dict = {}
    leagues, matches = {}, []
    for key, slug in LEAGUES.items():
        leagues[key] = {"standings": fetch_standings(slug, teams)}
        matches += fetch_matches(key, slug, months, teams)

    data = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "leagues": leagues,
        "teams": teams,
        "matches": sorted(matches, key=lambda m: m["date"]),
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {len(teams)} takım, {len(matches)} maç")


if __name__ == "__main__":
    main()
