"""data/extras.json: ESPN'de olmayan bilgiler (TV kanalları, Türkiye Kupası, GS gündemi).

Bu dosyayı her gün Claude'un zamanlanmış görevi web aramasıyla doldurur.
  python3 scripts/extras.py task       # görevin talimatını ve bu haftanın maç listesini basar
  python3 scripts/extras.py validate   # data/extras.json şemaya uyuyor mu
Sadece standart kütüphane.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
ESPN = ROOT / "data" / "espn.json"
EXTRAS = ROOT / "data" / "extras.json"
IST = ZoneInfo("Europe/Istanbul")
WINDOW_DAYS = 14

OUR_TEAMS = {"Galatasaray": "Galatasaray", "Fenerbahce": "Fenerbahçe", "Besiktas": "Beşiktaş", "Trabzonspor": "Trabzonspor"}
COMP = {"tsl": "Süper Lig", "ucl": "Şampiyonlar Ligi", "uel": "Avrupa Ligi", "uecl": "Konferans Ligi"}
CATEGORIES = {"Sakatlık", "Ceza", "Transfer", "Yönetim", "Kulüp"}

FORMAT = """{
  "updated": "YYYY-MM-DDTHH:MMZ",
  "channels": { "<maç id>": { "tr": "Türkiye kanalı", "pt": "Portekiz kanalı veya boş" } },
  "cup": [ { "date": "YYYY-MM-DD veya boş", "time_ist": "HH:MM veya boş", "date_note": "gün belli değilse kısa not",
             "round": "örn. Grup 2. maç", "home": "Takım", "away": "Takım", "tr": "kanal veya boş", "pt": "" } ],
  "gs_news": [ { "category": "Sakatlık | Ceza | Transfer | Yönetim | Kulüp", "text": "tek cümle", "source_url": "https://..." } ]
}"""


def window_matches() -> list[dict]:
    d = json.loads(ESPN.read_text(encoding="utf-8"))
    teams = d["teams"]
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=WINDOW_DAYS)
    out = []
    for m in d["matches"]:
        t = datetime.fromisoformat(m["date"].replace("Z", "+00:00"))
        if m["state"] == "post" or not (now - timedelta(hours=3) <= t <= end):
            continue
        h, a = teams[m["h"]]["name"], teams[m["a"]]["name"]
        ours = h in OUR_TEAMS or a in OUR_TEAMS
        if not ours and m["lg"] != "ucl":
            continue
        out.append({
            "id": m["id"], "comp": COMP[m["lg"]], "ours": ours,
            "when": t.astimezone(IST).strftime("%Y-%m-%d %H:%M TSİ") if m["timeKnown"] else t.astimezone(IST).strftime("%Y-%m-%d, saat belli değil"),
            "home": OUR_TEAMS.get(h, h), "away": OUR_TEAMS.get(a, a),
        })
    return out


def task() -> None:
    ms = window_matches()
    today = datetime.now(IST).date()
    lines = [
        f"Bugün {today.isoformat()}. Önümüzdeki {WINDOW_DAYS} gün için data/extras.json dosyasını web aramasıyla doldur.",
        "",
        "Kurallar:",
        "- Sadece bulduğun bilgiyi yaz, tahmin etme. Bulamadığın alanı boş string bırak.",
        "- Kaynak önceliği: resmi yayıncılar (beIN SPORTS, TRT, tabii, Sport TV, DAZN, TVI), kulüp siteleri, TFF, UEFA. Sonra güvenilir spor siteleri.",
        "- Mevcut data/extras.json'da doğru olduğu belli olan kanal bilgilerini koru, yenilerini ekle.",
        "",
        "1. Aşağıdaki her maç için Türkiye yayıncısını \"tr\" alanına yaz. \"ours: evet\" olan maçlar için Portekiz yayıncısını da \"pt\" alanına yaz (yoksa boş). Anahtar olarak maç id'sini kullan.",
        "2. Galatasaray, Fenerbahçe, Beşiktaş ve Trabzonspor'un bu aralıktaki Türkiye Kupası maçlarını \"cup\" listesine yaz. Takım adlarını Türkçe yaz (Galatasaray, Fenerbahçe, Beşiktaş, Trabzonspor). Kupa maçı yoksa boş liste.",
        "3. Galatasaray gündemi: son 7 günün haberleri. Kategoriler: Sakatlık, Ceza, Transfer, Yönetim (başkan, yönetim kurulu, seçim, resmi açıklamalar), Kulüp (finans, borç, sponsorluk, stadyum, tesis, altyapı, kulüp duyuruları). En fazla 7 madde, en önemlisi önce, her biri tek cümle. Söylentiyi kesinleşmiş gibi yazma. source_url gerçek bir makale linki olmalı (sitede gösterilmez, doğrulama için).",
        "4. \"updated\" alanına şu anki UTC zamanını yaz.",
        "",
        "Maçlar (id | turnuva | İstanbul saati | ev sahibi – deplasman | ours):",
    ]
    lines += [f"{m['id']} | {m['comp']} | {m['when']} | {m['home']} – {m['away']} | ours: {'evet' if m['ours'] else 'hayır'}" for m in ms]
    lines += ["", "Dosya formatı:", FORMAT]
    print("\n".join(lines))


def validate() -> int:
    errs = []
    try:
        x = json.loads(EXTRAS.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Okunamadı: {e}", file=sys.stderr)
        return 1
    if not isinstance(x, dict):
        print("Kök bir nesne olmalı", file=sys.stderr)
        return 1
    for k, typ in (("channels", dict), ("cup", list), ("gs_news", list)):
        if not isinstance(x.get(k), typ):
            errs.append(f"'{k}' alanı {typ.__name__} olmalı")
    if not isinstance(x.get("updated"), str):
        errs.append("'updated' metin olmalı")
    ids = {m["id"] for m in json.loads(ESPN.read_text(encoding="utf-8"))["matches"]}
    for mid, c in (x.get("channels") or {}).items():
        if mid not in ids:
            errs.append(f"channels: bilinmeyen maç id {mid}")
        if not isinstance(c, dict) or not all(isinstance(c.get(f, ""), str) for f in ("tr", "pt")):
            errs.append(f"channels[{mid}]: tr/pt metin olmalı")
    for i, c in enumerate(x.get("cup") or []):
        for f in ("date", "time_ist", "date_note", "round", "home", "away", "tr", "pt"):
            if not isinstance(c.get(f, ""), str):
                errs.append(f"cup[{i}].{f} metin olmalı")
        if c.get("date") and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", c["date"]):
            errs.append(f"cup[{i}].date YYYY-MM-DD olmalı")
        if c.get("time_ist") and not re.fullmatch(r"\d{2}:\d{2}", c["time_ist"]):
            errs.append(f"cup[{i}].time_ist HH:MM olmalı")
        if not c.get("home") or not c.get("away"):
            errs.append(f"cup[{i}]: home ve away dolu olmalı")
    for i, n in enumerate(x.get("gs_news") or []):
        if n.get("category") not in CATEGORIES:
            errs.append(f"gs_news[{i}].category {sorted(CATEGORIES)} olmalı")
        if not n.get("text"):
            errs.append(f"gs_news[{i}].text boş")
        if not str(n.get("source_url", "")).startswith("http"):
            errs.append(f"gs_news[{i}].source_url link olmalı")
    for e in errs:
        print(e, file=sys.stderr)
    if not errs:
        print("data/extras.json geçerli")
    return 1 if errs else 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "task":
        task()
    elif cmd == "validate":
        sys.exit(validate())
    else:
        print(__doc__)
        sys.exit(2)
