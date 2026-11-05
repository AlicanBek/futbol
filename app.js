"use strict";

// ---- Sabitler -------------------------------------------------------------

const LIS = "Europe/Lisbon";
const IST = "Europe/Istanbul";
const CPH = "Europe/Copenhagen";  // Prag ile aynı saat; Londra da Lizbon ile aynı
const WINDOW_DAYS = 14;
const GS = "432";

const COMP = {
  tsl:  { emoji: "🇹🇷", name: "Süper Lig", abbr: "TSL", color: "var(--sl)", bg: "var(--sl-bg)", dark: ["#2a2316", "#f2cf7a"] },
  ucl:  { emoji: "⭐", name: "Şampiyonlar Ligi", abbr: "ŞL", color: "var(--ucl)", bg: "var(--ucl-bg)", dark: ["#0f1c46", "#b8c6f5"] },
  uel:  { emoji: "🟠", name: "Avrupa Ligi", abbr: "AL", color: "var(--uel)", bg: "var(--uel-bg)", dark: ["#3a2309", "#f5bd72"] },
  uecl: { emoji: "🟢", name: "Konferans Ligi", abbr: "KL", color: "var(--uecl)", bg: "var(--uecl-bg)", dark: ["#0f3325", "#93dcb6"] },
  cup:  { emoji: "🏆", name: "Türkiye Kupası", abbr: "Kupa", color: "var(--cup)", bg: "var(--cup-bg)" },
};
const TABLE_ORDER = ["tsl", "ucl", "uel", "uecl"];
const OFFICIAL = {
  tsl: ["tff.org", "https://www.tff.org/default.aspx?pageID=198"],
  ucl: ["uefa.com", "https://www.uefa.com/uefachampionsleague/standings/"],
  uel: ["uefa.com", "https://www.uefa.com/uefaeuropaleague/standings/"],
  uecl: ["uefa.com", "https://www.uefa.com/uefaconferenceleague/standings/"],
};

// ESPN adlarının Türkçe/kısa karşılıkları
const TR = {
  "Amed SFK": "Amedspor", "Besiktas": "Beşiktaş", "Fenerbahce": "Fenerbahçe", "Kasimpasa": "Kasımpaşa",
  "Goztepe": "Göztepe", "Erzurum BB": "Erzurumspor", "Istanbul Basaksehir": "Başakşehir",
  "Caykur Rizespor": "Çaykur Rizespor", "Genclerbirligi": "Gençlerbirliği", "Eyupspor": "Eyüpspor",
  "VfB Stuttgart": "Stuttgart", "Feyenoord Rotterdam": "Feyenoord", "Internazionale": "Inter",
  "Bayern Munich": "Bayern", "Club Brugge": "Brugge", "AEK Athens": "AEK Atina", "Slavia Prague": "Slavia Prag",
};
// Büyük üçlü: kulüp rengi ve şerit
const BIG = {
  "Fenerbahce": { color: "#0a2240", stripe: ["#0a2240", "#f5d000"] },
  "Besiktas": { color: "#111111", stripe: ["#111111", "#d9d9d9"] },
  "Trabzonspor": { color: "#7a1e3a", stripe: ["#7a1e3a", "#5ba4d9"] },
};
const NEWS_STYLE = {
  "Sakatlık": ["#fde8e8", "#b42318"], "Ceza": ["#fef0d9", "#a15c07"], "Transfer": ["#e6effc", "#1e4fa3"],
  "Yönetim": ["#efe7fb", "#6b3fa0"], "Kulüp": ["#e5f4ec", "#1f7a4d"],
};
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

let D = null;   // data/espn.json
let X = {};     // data/extras.json
let ALL = [];   // ESPN maçları + kupa maçları, tarih sırasıyla
let BIG_IDS = {};
let timer = null;

// ---- Yardımcılar ----------------------------------------------------------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const team = (id) => D.teams[id] || { name: id, short: id, logo: "", color: "" };
const tname = (id) => TR[team(id).name] || team(id).name;
const tshort = (id) => TR[team(id).name] || team(id).short;
const logo = (id, cls = "") => team(id).logo ? `<img src="${esc(team(id).logo)}" alt="" loading="lazy" class="${cls}">` : "";

function parts(iso, tz) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(iso)).reduce((o, x) => (o[x.type] = x.value, o), {});
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { y: +p.year, mo: +p.month, d: +p.day, wd, hm: `${p.hour}:${p.minute}` };
}
const lis = (iso) => parts(iso, LIS);
const ist = (iso) => parts(iso, IST);
const cph = (iso) => parts(iso, CPH);
// Üç saat dilimi yan yana: Lizbon/Londra, Kopenhag/Prag, İstanbul
// Her yerde aynı saat şeridi: üstte şehir, altında saat
const times3 = (iso) => `<div class="tz"><div><span>Lizbon/Londra</span><b>${lis(iso).hm}</b></div><div><span>Kopenhag/Prag</span><b>${cph(iso).hm}</b></div><div><span>İstanbul</span><b>${ist(iso).hm}</b></div></div>`;
const DAYS_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const dayShort = (iso) => { const p = lis(iso); return `${DAYS_SHORT[p.wd]} ${p.d} ${MONTHS[p.mo - 1].slice(0, 3)}`; };
const dayLong = (iso) => { const p = lis(iso); return `${DAYS[p.wd]} ${p.d} ${MONTHS[p.mo - 1]}`; };
const monthOf = (iso) => MONTHS[lis(iso).mo - 1];

function sideOf(m, id) { return m.h === id ? "h" : m.a === id ? "a" : null; }
function weekLabel(m, id) {
  if (m.lg === "cup") return m.round || "";
  const n = m[(sideOf(m, id) || "h") + "w"];
  return n ? `${n}. hafta` : "Eleme";
}
function chan(m) { return m.lg === "cup" ? { tr: m.tr, pt: m.pt } : ((X.channels || {})[m.id] || {}); }
function chanHtml(m) {
  const c = chan(m), out = [];
  if (c.tr) out.push(`TR: <b>${esc(c.tr)}</b>`);
  if (c.pt) out.push(`PT: <b>${esc(c.pt)}</b>`);
  return out.length ? `📺 ${out.join(" &nbsp;·&nbsp; ")}` : "";
}
function names(m) { return m.lg === "cup" ? [m.home, m.away] : [tname(m.h), tname(m.a)]; }
function timesHtml(m) {
  if (!m.timeKnown) return `<div class="tba">${m.dateKnown === false ? "Gün ve saat açıklanmadı" : "Saat açıklanmadı"}</div>`;
  return times3(m.date);
}
function scoreHtml(m) { return m.state !== "pre" && m.hs != null ? `<span class="score">${esc(m.hs)}-${esc(m.as)}</span>` : ""; }

const now = () => Date.now();
const windowEnd = () => now() + WINDOW_DAYS * 864e5;
const upcoming = (m) => m.state !== "post" && new Date(m.date).getTime() > now() - 3 * 36e5;
// Günü belli olmayan kupa maçları turun ilk gününe (window_start) göre yerleşir
const inWindow = (m) => upcoming(m) && ((m.dateKnown === false && !m.approx) || new Date(m.date).getTime() <= windowEnd());

// Türkiye Kupası maçlarını (extras) ESPN maçlarıyla aynı şekle getir
function cupMatches() {
  return (X.cup || []).map((c, i) => {
    const dateKnown = !!c.date;
    const timeKnown = dateKnown && !!c.time_ist;
    const day = c.date || c.window_start;
    const iso = day ? new Date(`${day}T${timeKnown ? c.time_ist : "12:00"}:00+03:00`).toISOString() : new Date(now() + 864e5).toISOString();
    // Kupa rakibini Süper Lig takımlarından tanıyıp logosunu göstermek için ada göre eşle
    const byName = Object.fromEntries((D.leagues.tsl?.standings || []).map((r) => [tname(r.team), r.team]));
    const h = byName[c.home] || null, a = byName[c.away] || null;
    return { id: `cup-${i}`, lg: "cup", date: iso, dateKnown, timeKnown, approx: !dateKnown && !!c.window_start, state: "pre",
      home: c.home, away: c.away, h, a, round: c.round || "", tr: c.tr, pt: c.pt, note: c.date_note };
  });
}
const teamMatches = (id) => ALL.filter((m) => m.h === id || m.a === id);

// ---- Parçalar -------------------------------------------------------------

function detailCard(m, id) {
  const c = COMP[m.lg], [hn, an] = names(m);
  const venue = id ? (m.h === id ? "🏠 İç saha" : "✈️ Deplasman") : "";
  const day = m.dateKnown === false ? esc(m.note || "Tarih belli değil") : dayShort(m.date);
  const ch = chanHtml(m);
  return `<div class="card"><div class="top"><span style="color:${c.color}">${c.emoji} ${c.name} · ${esc(weekLabel(m, id))}</span><span class="venue">${venue}</span></div>
    <div class="teams">${esc(hn)} – ${esc(an)}${scoreHtml(m)}</div><div class="day">${day}</div>${timesHtml(m)}
    ${ch ? `<div class="foot">${ch}</div>` : ""}</div>`;
}

function roughList(ms, id) {
  let month = null, out = "";
  for (const m of ms) {
    const mo = monthOf(m.date);
    if (mo !== month) { month = mo; out += `<div class="month">${mo}</div>`; }
    const opp = m.h === id ? m.a : m.h, c = COMP[m.lg];
    const oppName = m.lg === "cup" ? (m.h === id ? m.away : m.home) : tname(opp);
    // Tarih sadece saati açıklanmış maçlarda kesin; diğerlerinde ESPN'in tarihi tahmini olduğu için yazılmaz
    const when = m.timeKnown && m.dateKnown !== false ? `<small>${dayShort(m.date)}</small>` : m.approx && m.note ? `<small>${esc(m.note)}</small>` : "";
    out += `<div class="row"><span class="ha">${m.h === id ? "🏠" : "✈️"}</span>${opp ? logo(opp) : ""}<span class="opp">${esc(oppName)}${when}</span>
      <span class="comp${m.lg === "tsl" ? "" : " eu"}">${c.emoji} ${c.abbr} · ${esc(weekLabel(m, id))}</span></div>`;
  }
  return out ? `<div class="list">${out}</div>` : `<div class="empty">Sezonda başka maç görünmüyor</div>`;
}

function standingOf(lg, id) { return (D.leagues[lg]?.standings || []).find((r) => r.team === id); }

// ---- Ekranlar -------------------------------------------------------------

function viewGS() {
  const ms = teamMatches(GS).filter(upcoming);
  const next = ms.find((m) => m.dateKnown !== false);
  const hm = heroMatch();
  let hero = `<section class="hero"><div class="k">Sıradaki maç</div><div class="teams">Sezonda maç kalmadı</div></section>`;
  if (hm && (hm.state !== "pre" || LIVE[hm.id])) hero = liveCard(hm);
  else if (next) {
    const c = COMP[next.lg], [hn, an] = names(next), ch = chan(next);
    hero = `<section class="hero"><div class="k">Sıradaki maç · ${c.emoji} ${c.name}</div>
      <div class="teams">${esc(hn)} – ${esc(an)}</div>
      <div class="meta">${dayLong(next.date)}${next.venue ? " · 📍 " + esc(next.venue) : ""}${ch.tr ? " · 📺 " + esc(ch.tr) : ""}</div>
      ${next.timeKnown ? times3(next.date) : `<div class="meta">Saat açıklanmadı</div>`}
      ${next.timeKnown ? `<div class="countdown" data-t="${next.date}"></div>` : ""}</section>`;
  }
  const stats = TABLE_ORDER.map((lg) => [lg, standingOf(lg, GS)]).filter(([, r]) => r).map(([lg, r]) =>
    `<a class="stat dark" href="#tablolar/${lg}"><div class="c" style="color:${COMP[lg].dark[1]}">${COMP[lg].emoji} ${COMP[lg].name}</div>
     <div class="v">${r.rank}. <small>· ${r.pts} puan</small></div><div class="g" style="color:${COMP[lg].dark[1]}">Tablo →</div></a>`).join("");
  const soon = ms.filter(inWindow), later = ms.filter((m) => !inWindow(m) && (m.dateKnown !== false || m.approx));
  const items = freshNews();
  const news = items.map((n) => { const [bg, fg] = NEWS_STYLE[n.category] || ["#eee", "#555"];
    return `<div class="item"><span class="tag" style="background:${bg};color:${fg}">${esc(n.category)}</span><span>${esc(n.text)}${n.date ? `<small class="nd">${newsDay(n.date)}</small>` : ""}</span></div>`; }).join("");
  return `${hero}<div class="stats">${stats}</div>
    <div class="label">Önümüzdeki 2 hafta</div>${soon.map((m) => detailCard(m, GS)).join("") || `<div class="empty">Bu dönemde GS maçı yok</div>`}
    ${fold("gs-later", "Sonraki maçlar", `${later.length} maç`, roughList(later, GS))}
    ${fold("gs-news", "GS gündemi", `${items.length} haber`, news ? `<div class="news">${news}</div>` : `<div class="empty">Henüz haber yok. Sakatlık, ceza, transfer, yönetim ve kulüp haberleri her gün 09:00'da güncellenir.</div>`)}
    ${playersTable()}
    <div class="updline">Veriler: ${updatedLabel()} · Yenilemek için sayfayı aşağı çek</div>`;
}

// Gündem: 7 günden eski haberler gösterilmez, her haberin yanında günü yazar
const NEWS_DAYS = 7;
const dayDiff = (ymd) => { const t = lis(new Date().toISOString()); return Math.round((Date.UTC(t.y, t.mo - 1, t.d) - Date.parse(ymd + "T00:00:00Z")) / 864e5); };
const freshNews = () => (X.gs_news || []).filter((n) => !n.date || dayDiff(n.date) <= NEWS_DAYS);
function newsDay(ymd) {
  const n = dayDiff(ymd);
  if (n <= 0) return "Bugün";
  if (n === 1) return "Dün";
  const [, mo, d] = ymd.split("-").map(Number);
  return `${d} ${MONTHS[mo - 1].slice(0, 3)}`;
}

// Açılır bölümler her açılışta kapalı başlar; sekmeler arası geçişte açık/kapalı hali korunur
const FOLDS = {};
const foldOpen = (key) => !!FOLDS[key];
const foldSave = (key, open) => { FOLDS[key] = open; };
// Kapalıyken beyaz hap, açıkken başlık ve içerik tek kart
const fold = (key, title, count, body) =>
  `<details class="fold" data-key="${key}"${foldOpen(key) ? " open" : ""}><summary>${title} <span>${count}</span></summary>${body}</details>`;

const POS = { G: "Kaleci", D: "Defans", M: "Orta saha", F: "Forvet" };
const SHOW_PLAYERS = 10;

function playersTable() {
  const ps = (D.players || []).map((p) => {
    const lg = p.tsl || {}, eu = p.ucl || p.uel || p.uecl || {};
    return { ...p, apps: (lg.apps || 0) + (eu.apps || 0), lgG: lg.goals || 0, euG: eu.goals || 0, ast: (lg.ast || 0) + (eu.ast || 0) };
  }).filter((p) => p.apps > 0)
    .sort((a, b) => (b.lgG + b.euG) - (a.lgG + a.euG) || b.ast - a.ast || b.apps - a.apps);
  if (!ps.length) return "";
  const euKey = TABLE_ORDER.slice(1).find((k) => standingOf(k, GS)) || "ucl";
  const row = (p) => `<tr><td class="t"><div class="pn">${esc(p.name)}<small>${POS[p.pos] || ""}${p.num ? " · " + esc(p.num) : ""}</small></div></td>
    <td class="n">${p.apps}</td><td class="n">${p.lgG}</td><td class="n">${p.euG}</td><td class="p">${p.lgG + p.euG}</td><td class="n">${p.ast}</td></tr>`;
  const head = `<thead><tr><th class="t" rowspan="2">Oyuncu</th><th class="n" rowspan="2">Maç</th><th colspan="3" class="grp">Gol</th><th class="n" rowspan="2">Ast</th></tr>
    <tr><th class="n">Lig</th><th class="n">${COMP[euKey].abbr}</th><th class="p">Top</th></tr></thead>`;
  const cols = `<colgroup><col><col class="cn"><col class="cn"><col class="cn"><col class="cn"><col class="cn"></colgroup>`;
  const more = ps.length > SHOW_PLAYERS
    ? `<details class="more"><summary>Diğer ${ps.length - SHOW_PLAYERS} oyuncu</summary><table class="pt">${cols}<tbody>${ps.slice(SHOW_PLAYERS).map(row).join("")}</tbody></table></details>` : "";
  return fold("gs-players", "Oyuncu istatistikleri", `${ps.length} oyuncu`,
    `<div class="tcard"><table class="pt">${cols}${head}<tbody>${ps.slice(0, SHOW_PLAYERS).map(row).join("")}</tbody></table>${more}
    <div class="legend">Lig + ${COMP[euKey].name}. Türkiye Kupası dahil değil.</div></div>`);
}

function viewMatches() {
  const end = new Date(windowEnd());
  const range = `${lis(new Date().toISOString()).d} ${MONTHS[lis(new Date().toISOString()).mo - 1]} – ${lis(end.toISOString()).d} ${MONTHS[lis(end.toISOString()).mo - 1]}`;
  const cards = Object.entries(BIG_IDS).map(([raw, id]) => {
    const b = BIG[raw], ms = teamMatches(id).filter(inWindow);
    const rows = ms.map((m) => {
      const c = COMP[m.lg], [hn, an] = names(m), ch = chanHtml(m);
      const day = m.dateKnown === false ? esc(m.note || "Tarih belli değil") : dayShort(m.date);
      const when = m.timeKnown ? times3(m.date) : `<div class="tba">${m.dateKnown === false ? "Gün ve saat açıklanmadı" : "Saat açıklanmadı"}</div>`;
      return `<div class="m"><div class="mt">${day} · <span style="color:${c.color}">${c.emoji} ${c.name} ${esc(weekLabel(m, id))}</span> · ${m.h === id ? "🏠" : "✈️"}</div>
        <div class="mn">${m.h ? logo(m.h) : ""}${esc(hn)} – ${esc(an)}${m.a ? logo(m.a) : ""}${scoreHtml(m)}</div>${when}${ch ? `<div class="mf">${ch}</div>` : ""}</div>`;
    }).join("") || `<div class="m mt">Bu dönemde maçı yok</div>`;
    return `<div class="tc"><div class="stripe" style="background:linear-gradient(90deg,${b.stripe[0]} 50%,${b.stripe[1]} 50%)"></div>
      <a class="th" style="color:${b.color}" href="#takim/tsl/${id}">${esc(tname(id))} ›</a>${rows}</div>`;
  }).join("");

  const ucl = ALL.filter((m) => m.lg === "ucl" && inWindow(m));
  let day = null, list = "";
  const bigSet = new Set(Object.values(BIG_IDS));
  let slot = null;
  for (const m of ucl) {
    const dl = dayLong(m.date);
    if (dl !== day) { day = dl; slot = null; list += `<div class="dayh">${dl}</div>`; }
    // Aynı başlama saatindeki maçlar tek saat şeridinin altında toplanır
    const sl = m.timeKnown ? m.date : "tba";
    if (sl !== slot) { slot = sl; list += m.timeKnown ? `<div class="slot">${times3(m.date)}</div>` : `<div class="slot"><div class="tba">Saat açıklanmadı</div></div>`; }
    const gs = m.h === GS || m.a === GS, tk = !gs && (bigSet.has(m.h) || bigSet.has(m.a));
    const nm = (id) => { const n = esc(tshort(id)); if (!tk) return n;
      const col = BIG[team(id).name]?.color || team(id).color; return col ? `<span style="color:${col}">${n}</span>` : n; };
    const ch = chan(m).tr || "";
    const badge = /TRT/i.test(ch) ? `<span class="trt">${esc(ch)}</span>` : ch ? `<span class="tb">${esc(ch)}</span>` : "";
    list += `<div class="u${gs ? " gs" : ""}${tk ? " tk" : ""}"><div class="um"><span class="hn">${nm(m.h)}</span>${logo(m.h)}<span class="dash">${m.state !== "pre" && m.hs != null ? `${esc(m.hs)}-${esc(m.as)}` : "–"}</span>${logo(m.a)}<span class="an">${nm(m.a)}</span></div><div class="uc">${badge}</div></div>`;
  }
  return `<h1>Diğer takımlar</h1><div class="sub">${range}</div>
    <div class="label">Türk takımları</div>${cards}
    <div class="label">⭐ Şampiyonlar Ligi</div>
    ${list ? `<div class="ucl">${list}</div>` : `<div class="empty">Bu dönemde ŞL maçı yok</div>`}`;
}

function viewTables(lg) {
  if (!COMP[lg] || lg === "cup") lg = "tsl";
  const rows = D.leagues[lg].standings, bigSet = new Set(Object.values(BIG_IDS)), legend = {};
  const body = rows.map((r) => {
    if (r.zone) legend[r.zone] = r.zoneColor;
    const nm = lg === "tsl" ? tname(r.team) : tshort(r.team);
    const col = BIG[team(r.team).name]?.color;
    const href = r.team === GS ? "#gs" : `#takim/${lg}/${r.team}`;
    return `<tr class="${r.team === GS ? "gs" : ""}" data-href="${href}"><td class="z" style="background:${r.zoneColor || "transparent"}"></td><td class="r">${r.rank}</td>
      <td class="t"><div class="tn">${logo(r.team)}<span${col && bigSet.has(r.team) ? ` style="color:${col}"` : ""}>${esc(nm)}</span></div></td>
      <td class="n">${r.gp}</td><td class="n">${r.w}</td><td class="n">${r.d}</td><td class="n">${r.l}</td><td class="n">${esc(r.gd)}</td><td class="p">${r.pts}</td></tr>`;
  }).join("");
  const seg = TABLE_ORDER.map((k) => `<a href="#tablolar/${k}" class="${k === lg ? "on" : ""}">${COMP[k].emoji} ${COMP[k].abbr}</a>`).join("");
  const leg = Object.entries(legend).map(([z, c]) => `<span><i style="background:${c}"></i>${esc(z)}</span>`).join("");
  return `<div class="tabs-head"><h1>Tablolar</h1><div class="upd">Güncelleme: ${updatedLabel()} · Takıma dokun, maçlarını gör</div><div class="seg">${seg}</div></div>
    <div class="tcard"><h2>${COMP[lg].name}</h2><table><thead><tr><th class="z"></th><th class="r">#</th><th class="t">Takım</th><th class="n">O</th><th class="n">G</th><th class="n">B</th><th class="n">M</th><th class="n">AV</th><th class="p">P</th></tr></thead>
    <tbody>${body}</tbody></table><div class="legend">${leg}</div>
    <a class="official" href="${OFFICIAL[lg][1]}" target="_blank" rel="noopener">Resmi puan durumu · <b>${OFFICIAL[lg][0]}</b> ↗</a></div>`;
}

function viewTeam(lg, id) {
  if (id === GS) return viewGS();
  const leagues = TABLE_ORDER.filter((k) => standingOf(k, id));
  const r = standingOf(lg, id) || standingOf(leagues[0], id);
  if (!r) return `<a class="back" href="#tablolar/${lg}">‹ Tablolar</a><div class="empty">Takım bulunamadı</div>`;
  const chips = leagues.map((k) => { const s = standingOf(k, id);
    return `<a class="pos" href="#tablolar/${k}" style="background:${COMP[k].bg};color:${COMP[k].color}">${COMP[k].emoji} ${COMP[k].name} · ${s.rank}. · ${s.pts} puan</a>`; }).join("");
  const done = ALL.filter((m) => m.lg === lg && m.state === "post" && (m.h === id || m.a === id)).slice(-5);
  const form = done.map((m) => { const me = +m[sideOf(m, id) === "h" ? "hs" : "as"], op = +m[sideOf(m, id) === "h" ? "as" : "hs"];
    const res = me > op ? ["G", "#2e9e5b"] : me < op ? ["M", "#e5484d"] : ["B", "#9a9a9a"];
    return `<span class="f" style="background:${res[1]}" title="${esc(tname(m.h === id ? m.a : m.h))} ${me}-${op}">${res[0]}</span>`; }).join("");
  const ms = teamMatches(id).filter(upcoming);
  const soon = ms.filter(inWindow), later = ms.filter((m) => !inWindow(m) && (m.dateKnown !== false || m.approx));
  return `<a class="back" href="#tablolar/${lg}">‹ Tablolar</a>
    <section class="head">${logo(id)}<h1>${esc(tname(id))}</h1>${chips}
      <div class="nums"><div><b>${r.gp}</b>O</div><div><b>${r.w}</b>G</div><div><b>${r.d}</b>B</div><div><b>${r.l}</b>M</div><div><b>${r.gf}:${r.ga}</b>Gol</div><div><b>${esc(r.gd)}</b>AV</div></div>
      ${form ? `<div class="form">Son 5 ${form}</div>` : ""}</section>
    <div class="label">Önümüzdeki 2 hafta</div>${soon.map((m) => detailCard(m, id)).join("") || `<div class="empty">Bu dönemde maçı yok</div>`}
    <div class="label">Sonraki maçlar</div>${roughList(later, id)}`;
}

function updatedLabel() {
  if (!D.updated) return "-";
  const p = lis(D.updated), t = lis(new Date().toISOString());
  const same = p.d === t.d && p.mo === t.mo;
  return `${same ? "bugün" : `${p.d} ${MONTHS[p.mo - 1]}`} ${p.hm}`;
}

// ---- Yönlendirme ----------------------------------------------------------

function tick() {
  document.querySelectorAll(".countdown").forEach((el) => {
    let s = Math.max(0, (new Date(el.dataset.t).getTime() - now()) / 1000);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s = Math.floor(s - m * 60);
    const two = (n) => String(n).padStart(2, "0");
    el.innerHTML = `<span class="cl">Maça kalan</span><b>${d ? `${d} gün ` : ""}${two(h)}:${two(m)}:${two(s)}</b>`;
  });
}

// ---- Canlı maç kartı -------------------------------------------------------
// GS maçı başladığında en üstteki kart canlı skora döner; maç bitince 2 saat "Maç sonu" olarak kalır.

const LIVE = {};  // maç id -> { clock, goals: [{ min, name, side, kind }] }
const KICKOFF_LEAD = 60e3, AFTER_FINAL = 4 * 36e5;

function heroMatch() {
  const ms = teamMatches(GS).filter((m) => m.lg !== "cup" && m.timeKnown);
  const t = now();
  return ms.find((m) => m.state === "in")
    || ms.find((m) => m.state === "pre" && new Date(m.date).getTime() - KICKOFF_LEAD <= t && t - new Date(m.date).getTime() < AFTER_FINAL)
    || ms.find((m) => m.state === "post" && t - new Date(m.date).getTime() < AFTER_FINAL);
}

async function pollLive() {
  if (!D || document.visibilityState !== "visible") return;
  const m = heroMatch();
  if (!m || (m.state === "post" && LIVE[m.id]?.final)) return;
  try {
    const d = await get(`${ESPN}/site/v2/sports/soccer/${SLUG[m.lg]}/summary?event=${m.id}`);
    const c = d.header.competitions[0], st = c.status;
    const side = (ha) => c.competitors.find((x) => x.homeAway === ha);
    const homeId = side("home").team.id;
    const goals = (d.keyEvents || []).filter((e) => e.scoringPlay || /red-card/.test(e.type?.type || "")).map((e) => ({
      min: e.clock?.displayValue || "",
      name: e.participants?.[0]?.athlete?.displayName || "",
      side: e.team?.id === homeId ? "h" : "a",
      kind: e.scoringPlay ? (/own/i.test(e.type?.type || "") ? "og" : "goal") : "red",
    }));
    const state = st.type.state;
    const clock = state === "in" ? (st.type.shortDetail === "HT" ? "Devre arası" : st.displayClock || st.type.shortDetail) : "";
    for (const x of [m, D.matches.find((y) => y.id === m.id)]) if (x) Object.assign(x, { state, hs: side("home").score, as: side("away").score });
    const prev = JSON.stringify(LIVE[m.id] || {});
    LIVE[m.id] = { clock, goals, final: state === "post" };
    if (JSON.stringify(LIVE[m.id]) !== prev && (location.hash || "#gs").startsWith("#gs")) render();
  } catch (e) { /* bağlantı yoksa bir sonraki denemede */ }
}

function liveCard(m) {
  const c = COMP[m.lg], L = LIVE[m.id] || {}, ch = chan(m);
  const live = m.state === "in" || (m.state === "pre" && !L.final);
  const status = m.state === "post" ? "Maç sonu" : (L.clock || "Başlıyor");
  const ev = (e) => `<div class="ev ${e.side}">${e.kind === "red" ? "🟥" : "⚽"} <b>${esc(e.min)}</b> ${esc(e.name)}${e.kind === "og" ? " (k.k.)" : ""}</div>`;
  const evs = L.goals || [];
  return `<section class="hero">
    <div class="k">${live ? `<span class="dot"></span>Canlı` : "Son maç"} · ${c.emoji} ${c.name}<span class="clock">${esc(status)}</span></div>
    <div class="board">
      <div class="side">${logo(m.h)}<span>${esc(tshort(m.h))}</span></div>
      <div class="sc">${esc(m.hs ?? 0)}<i>–</i>${esc(m.as ?? 0)}</div>
      <div class="side">${logo(m.a)}<span>${esc(tshort(m.a))}</span></div>
    </div>
    ${evs.length ? `<div class="evs"><div>${evs.filter((e) => e.side === "h").map(ev).join("")}</div><div>${evs.filter((e) => e.side === "a").map(ev).join("")}</div></div>` : ""}
    <div class="meta">${m.venue ? "📍 " + esc(m.venue) : ""}${ch.tr ? `${m.venue ? " · " : ""}📺 ${esc(ch.tr)}` : ""}</div>
  </section>`;
}

function render() {
  const [route, a, b] = (location.hash.replace(/^#/, "") || "gs").split("/");
  const main = document.querySelector("main");
  let html, tab = route;
  if (route === "maclar") html = viewMatches();
  else if (route === "tablolar") html = viewTables(a || "tsl");
  else if (route === "takim") { html = viewTeam(a, b); tab = b === GS ? "gs" : "tablolar"; }
  else { html = viewGS(); tab = "gs"; }
  main.innerHTML = html;
  document.querySelectorAll("nav a").forEach((n) => n.classList.toggle("on", n.dataset.tab === tab));
  main.querySelectorAll("tr[data-href]").forEach((tr) => tr.onclick = () => (location.hash = tr.dataset.href));
  main.querySelectorAll("details.fold").forEach((d) => d.ontoggle = () => foldSave(d.dataset.key, d.open));
  tick();
  clearInterval(timer);
  timer = setInterval(tick, 1000);
}

window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

const get = (u) => fetch(u, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));

function buildAll() {
  ALL = [...D.matches.map((m) => ({ ...m, dateKnown: true })), ...cupMatches()].sort((x, y) => x.date.localeCompare(y.date));
}

// ---- Yeni sürüm kontrolü --------------------------------------------------
// Telefonda uygulama arka plandan dönünce sayfa yeniden yüklenmez; kod değiştiyse kendimiz yeniliyoruz.

let SHELL_TAG = null;
async function shellTag() {
  const rs = await Promise.all(["app.js", "style.css"].map((u) => fetch(u, { method: "HEAD", cache: "no-store" })));
  return rs.map((r) => r.headers.get("etag") || r.headers.get("last-modified") || "").join("|");
}
async function checkUpdate() {
  try {
    const t = await shellTag();
    if (SHELL_TAG && t && t !== SHELL_TAG) { location.reload(); return true; }
    if (!SHELL_TAG) SHELL_TAG = t;
  } catch (e) { /* çevrimdışı */ }
  return false;
}
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !D) return;
  if (await checkUpdate()) return;
  pollLive();
  // Uygulama arka planda saatlerce kaldıysa veriyi de tazele
  if (now() - Date.parse(D.updated) > 10 * 60e3) liveRefresh();
});

async function load() {
  checkUpdate();
  try {
    D = await get("data/espn.json");
  } catch (e) {
    document.querySelector("main").innerHTML = `<div class="empty">Veri yüklenemedi. İnternet bağlantını kontrol et.</div>`;
    return;
  }
  X = await get("data/extras.json").catch(() => ({}));
  for (const [id, t] of Object.entries(D.teams)) if (BIG[t.name]) BIG_IDS[t.name] = id;
  BIG_IDS = Object.fromEntries(Object.keys(BIG).filter((k) => BIG_IDS[k]).map((k) => [k, BIG_IDS[k]]));
  buildAll();
  render();
  pollLive();
  // Günlük dosya saatler öncesinden kalmış olabilir; skor ve tabloları açılışta sessizce ESPN'den tazele
  liveRefresh();
}

// ---- Canlı yenileme (aşağı çekince) ---------------------------------------
// Günlük dosyayı beklemeden skorları, saatleri ve puan tablolarını doğrudan ESPN'den tazeler.

const ESPN = "https://site.api.espn.com/apis";
const SLUG = { tsl: "tur.1", ucl: "uefa.champions", uel: "uefa.europa", uecl: "uefa.europa.conf" };
const ZONES = {
  "Champions League": "ŞL lig aşaması", "Champions League qualifying": "ŞL eleme", "Europa League qualifying": "AL eleme",
  "Conference League qualifying": "KL eleme", "Relegated": "Düşme hattı", "Qualifies for round of 16": "Son 16",
  "Knockout phase playoffs - seeded": "Play-off (seri başı)", "Knockout phase playoffs - unseeded": "Play-off", "Eliminated": "Elenir",
};
const ym = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

function applyStandings(lg, d) {
  D.leagues[lg].standings = d.children[0].standings.entries.map((e) => {
    const s = Object.fromEntries(e.stats.map((x) => [x.name, x.displayValue]));
    const note = e.note || {};
    return { team: e.team.id, rank: +s.rank, gp: +s.gamesPlayed, w: +s.wins, d: +s.ties, l: +s.losses, gf: +s.pointsFor, ga: +s.pointsAgainst,
      gd: s.pointDifferential, pts: +s.points, zone: ZONES[note.description] || note.description || "", zoneColor: note.color || "" };
  }).sort((a, b) => a.rank - b.rank);
}

function applyEvents(d) {
  const byId = Object.fromEntries(D.matches.map((m) => [m.id, m]));
  for (const e of d.events || []) {
    const m = byId[e.id];
    if (!m) continue;
    const c = e.competitions[0], st = c.status.type.state;
    const side = (ha) => c.competitors.find((t) => t.homeAway === ha);
    const sc = (t) => (typeof t.score === "object" ? t.score?.displayValue : t.score);
    Object.assign(m, { date: e.date, timeKnown: c.timeValid !== false, venue: c.venue?.fullName || m.venue, state: st,
      hs: st === "pre" ? null : sc(side("home")), as: st === "pre" ? null : sc(side("away")) });
  }
}

async function liveRefresh() {
  const months = [...new Set([ym(Date.now() - 3 * 864e5), ym(Date.now()), ym(windowEnd())])];
  const jobs = [get("data/extras.json").then((x) => (X = x)).catch(() => {})];
  let ok = 0;
  for (const [lg, slug] of Object.entries(SLUG)) {
    jobs.push(get(`${ESPN}/v2/sports/soccer/${slug}/standings`).then((d) => { applyStandings(lg, d); ok++; }).catch(() => {}));
    for (const mo of months) jobs.push(get(`${ESPN}/site/v2/sports/soccer/${slug}/scoreboard?dates=${mo}&limit=300`).then((d) => { applyEvents(d); ok++; }).catch(() => {}));
  }
  await Promise.all(jobs);
  if (!ok) return false;
  D.updated = new Date().toISOString().slice(0, 16) + "Z";
  buildAll();
  render();
  return true;
}

function setupPullToRefresh() {
  const ptr = document.createElement("div");
  ptr.className = "ptr";
  ptr.innerHTML = "<span>↓ Yenilemek için çek</span>";
  document.body.appendChild(ptr);
  const label = ptr.firstChild, THRESHOLD = 70;
  let startY = null, dist = 0, busy = false;
  const show = (y, text) => { ptr.style.transform = `translateY(${y}px)`; if (text) label.textContent = text; };
  const hide = () => { ptr.classList.add("anim"); show(-60); setTimeout(() => ptr.classList.remove("anim"), 250); };

  window.addEventListener("touchstart", (e) => { if (!busy && window.scrollY <= 0 && D) { startY = e.touches[0].clientY; dist = 0; } }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0 || window.scrollY > 0) { dist = 0; show(-60); return; }
    dist = Math.min(dy * 0.5, 110);
    show(dist - 50, dist > THRESHOLD ? "↑ Bırak, yenile" : "↓ Yenilemek için çek");
  }, { passive: true });
  window.addEventListener("touchend", async () => {
    if (startY === null) return;
    startY = null;
    if (dist <= THRESHOLD) return hide();
    busy = true;
    ptr.classList.add("anim");
    show(16, "Yenileniyor…");
    // Tarayıcıdaki "yenile" gibi: sayfa baştan yüklenir, açılışta da veriler ESPN'den tazelenir
    location.reload();
  });
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
setupPullToRefresh();
setInterval(pollLive, 30000);
load();
