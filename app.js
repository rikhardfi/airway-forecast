// app.js: the page. State in, DOM out; no framework.
import { dryingLimit } from "./physics.js";
import { fetchForecast, searchPlace } from "./forecast.js";
import { ZONES, presets } from "./presets.js";
import { makeT } from "./i18n.js";

const $ = (id) => document.getElementById(id);

// Embedded on hengitystutkimus.fi: the host page supplies the title, and the
// iframe is sized to the content, so report the height whenever it changes.
const EMBED = new URLSearchParams(location.search).has("embed");
if (EMBED) {
  document.documentElement.classList.add("embed");
  const post = () => parent.postMessage({ airwayForecastHeight: document.documentElement.scrollHeight }, "*");
  new ResizeObserver(post).observe(document.body);
  addEventListener("load", post);
}
const t = makeT();
const store = {
  get(k) { try { return localStorage.getItem(`af.${k}`); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(`af.${k}`, v); } catch { /* private mode */ } },
};

const state = { sites: [], site: null, fc: null, day: 0, start: 10, duration: 90,
                sex: store.get("sex") || "men", preset: "lt1", ownVe: 100 };

const nf = (d) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmt = (x, d = 0) => nf(d).format(x);
const ve = () => (state.preset === "own" ? Number(state.ownVe) : presets(state.sex).find((p) => p.id === state.preset).ve);

// ---- days and windows --------------------------------------------------------
function days() {
  const by = new Map();
  state.fc.rows.forEach((r, i) => {
    const d = r.time.slice(0, 10);
    if (!by.has(d)) by.set(d, []);
    by.get(d).push({ ...r, i, hour: Number(r.time.slice(11, 13)), lim: dryingLimit(r.tempC, r.rhPct, r.pressurePa) });
  });
  return [...by.entries()].map(([date, rows]) => ({ date, rows }));
}

function bestWindow(rows, hours) {
  let best = null;
  for (const r of rows) {
    if (r.hour < 8 || r.hour + hours > 20) continue;
    const w = rows.filter((x) => x.hour >= r.hour && x.hour < r.hour + hours);
    if (w.length < hours) continue;
    const m = w.reduce((s, x) => s + x.lim.lo, 0) / hours;
    if (!best || m > best.mean) best = { start: r.hour, mean: m };
  }
  return best;
}

const mean = (rows, k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;

// ---- weather icons (WMO codes, Open-Meteo daily summary) ----------------------
const ICON = {
  sun: '<circle cx="12" cy="12" r="4.5" fill="#f2b705"/><g stroke="#f2b705" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></g>',
  part: '<circle cx="9" cy="9" r="4" fill="#f2b705"/><path d="M8 19h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 8 19z" fill="#9fb3c8"/>',
  cloud: '<path d="M6 19h12a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.5 2A3.5 3.5 0 0 0 6 19z" fill="#8a9bb0"/>',
  fog: '<g stroke="#8a9bb0" stroke-width="2.2" stroke-linecap="round"><path d="M4 8h16M3 12h18M5 16h14M7 20h10"/></g>',
  rain: '<path d="M6 14h12a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.5 1.8A3.2 3.2 0 0 0 6 14z" fill="#8a9bb0"/><g stroke="#2c6ea3" stroke-width="2" stroke-linecap="round"><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/></g>',
  snow: '<path d="M6 14h12a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.5 1.8A3.2 3.2 0 0 0 6 14z" fill="#8a9bb0"/><g fill="#5f8fbf"><circle cx="8" cy="18" r="1.4"/><circle cx="12" cy="20" r="1.4"/><circle cx="16" cy="18" r="1.4"/></g>',
  storm: '<path d="M6 13h12a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.5 1.8A3.2 3.2 0 0 0 6 13z" fill="#6f7f93"/><path d="M12 13l-3 5h3l-2 4 5-6h-3l2-3z" fill="#f2b705"/>',
};
const ICON_NAME = { sun: "Clear", part: "Partly cloudy", cloud: "Cloudy", fog: "Fog", rain: "Rain", snow: "Snow", storm: "Thunderstorm" };
// The daily WMO code is the worst hour of the day, so one drizzle hour makes the
// whole day "rain". The icon instead follows the day's precipitation total and
// its daytime cloud cover; the code only decides fog, snow and thunder.
function iconFor(day, rows) {
  if (!day) return null;
  const { code, precip } = day;
  if (code >= 95) return "storm";
  if (precip >= 1) return (code >= 71 && code <= 77) || code === 85 || code === 86 ? "snow" : "rain";
  if (code === 45 || code === 48) return "fog";
  const cc = rows.filter((r) => r.hour >= 8 && r.hour < 20 && r.cloud != null).map((r) => r.cloud);
  const mean = cc.length ? cc.reduce((s, v) => s + v, 0) / cc.length : null;
  if (mean == null) return code === 0 ? "sun" : code <= 2 ? "part" : "cloud";
  return mean < 25 ? "sun" : mean < 70 ? "part" : "cloud";
}
const icon = (day, rows) => { const k = iconFor(day, rows); return k ? `<svg viewBox="0 0 24 24" class="wx" role="img" aria-label="${ICON_NAME[k]}"><title>${ICON_NAME[k]}</title>${ICON[k]}</svg>` : ""; };

// ---- calendar: Monday-first weeks, rolling forward from today ------------------
function calendar(ds) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const first = new Date(`${ds[0].date}T12:00Z`), last = new Date(`${ds[ds.length - 1].date}T12:00Z`);
  const monday = new Date(first); monday.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  const index = new Map(ds.map((d, i) => [d.date, i]));
  const head = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div class="wd">${d}</div>`).join("");
  let cells = "";
  for (let d = new Date(monday); d <= last || (d.getUTCDay() + 6) % 7 !== 0; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = iso(d), i = index.get(key), dd = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
    if (i == null) { cells += `<div class="day off"><span class="d">${dd}</span></div>`; continue; }
    const r = ds[i].rows, daylight = r.filter((x) => x.hour >= 8 && x.hour < 20);
    const lo = daylight.length ? Math.min(...daylight.map((x) => x.lim.lo)) : NaN;
    const tmin = Math.min(...r.map((x) => x.tempC)), tmax = Math.max(...r.map((x) => x.tempC));
    cells += `<button class="day${i === state.day ? " on" : ""}" data-day="${i}">
      <span class="top"><span class="d">${dd}</span>${icon(state.fc.daily?.[key], r)}</span>
      <span class="tt">${fmt(tmin)} to ${fmt(tmax)} °C</span>
      <span class="m">${Number.isFinite(lo) ? `limit ${fmt(lo)}` : ""}</span></button>`;
  }
  return `<div class="cal">${head}${cells}</div>`;
}

// ---- rendering ---------------------------------------------------------------
function renderControls() {
  const sel = $("intensity");
  sel.innerHTML = presets(state.sex).map((p) => `<option value="${p.id}">${t(`preset_${p.id}`)}, ${p.ve} L/min</option>`).join("")
    + `<option value="own">${t("preset_own")}</option>`;
  sel.value = state.preset;
  $("ownVeRow").hidden = state.preset !== "own";
  $("sex").value = state.sex;
}

function renderSites() {
  const groups = {};
  for (const s of state.sites) (groups[s.region] ??= []).push(s);
  $("site").innerHTML = Object.entries(groups).map(([g, list]) =>
    `<optgroup label="${g}">${list.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}</optgroup>`).join("");
  if (state.site) $("site").value = state.site.id;
}

function render() {
  if (!state.fc) return;
  const ds = days();
  state.day = Math.min(state.day, ds.length - 1);
  const day = ds[state.day];
  const hours = Math.max(1, Math.ceil(state.duration / 60));
  const dfmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "numeric" });

  $("days").innerHTML = calendar(ds);

  const startRow = day.rows.find((r) => r.hour === state.start) ?? day.rows[0];
  const sessRows = state.fc.rows.slice(startRow.i, startRow.i + hours);
  const best = bestWindow(day.rows, hours);
  $("best").textContent = best ? t("best", { h: hours, start: String(best.start).padStart(2, "0") }) : "";
  if (!sessRows.length) { $("result").hidden = true; return; }
  $("result").hidden = false;
  const air = { tempC: mean(sessRows, "tempC"), rhPct: mean(sessRows, "rhPct"), pressurePa: mean(sessRows, "pressurePa") };
  const lim = dryingLimit(air.tempC, air.rhPct, air.pressurePa);
  const room = dryingLimit(19, 55, air.pressurePa);
  const v = ve();
  const where = v > lim.hi ? t("above") : v >= lim.lo ? t("within") : t("below");
  const when = `${dfmt.format(new Date(`${day.date}T12:00`))} ${String(startRow.hour).padStart(2, "0")}:00`;
  drawZones(lim, room, air, when);

  $("vals").innerHTML = [
    [t("limit"), `${fmt(lim.lo)} to ${fmt(lim.hi)} L/min`, ""],
    [t("yourVe"), `${fmt(v)} L/min`, where],
    [t("air"), `${fmt(air.tempC, 1)} °C, humidity ${fmt(air.rhPct)} %`, ""],
    [t("roomLimit"), `${fmt(room.lo)} to ${fmt(room.hi)} L/min`, ""],
  ].map(([k, val, sub]) => `<div class="v"><dt>${k}</dt><dd>${val}${sub ? `<small>${sub}</small>` : ""}</dd></div>`).join("");

  const tf = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" });
  const model = state.fc.model === "metno_seamless" ? "MET Nordic (MET Norway) via Open-Meteo" : "Open-Meteo best match";
  $("method").textContent = t("method", { model, elev: fmt(state.fc.elevation), time: tf.format(state.fc.fetchedAt) });
}

// The KIHU handout figure: ventilation by training zone for men and women, with
// the drying limit in the forecast air and in room air.
const ZONE_COLOURS = { easy: "#00860f", threshold: "#ff9933", high: "#e00000" };
// On a phone the 760-wide figure would shrink its labels to ~5 px, so it is
// drawn narrower there (the CSS enlarges its text) and redrawn on rotation.
const NARROW = matchMedia("(max-width: 600px)");
function drawZones(lim, room, air, when) {
  const narrow = NARROW.matches;
  const W = narrow ? 420 : 760, H = 300, pad = narrow ? { l: 62, r: 14, t: 20, b: 60 } : { l: 78, r: 16, t: 20, b: 60 };
  const x0 = 40, x1 = 230;
  const x = (v) => pad.l + ((Math.min(Math.max(v, x0), x1) - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const rows = [["men", t("men"), 92], ["women", t("women"), 200]];
  const top = pad.t, bottom = H - pad.b + 6;
  let g = "";
  for (let v = 40; v <= 220; v += narrow ? 40 : 20) g += `<line x1="${x(v)}" x2="${x(v)}" y1="${pad.t}" y2="${H - pad.b + 14}" class="grid"/><text x="${x(v)}" y="${H - pad.b + 30}" class="ax" text-anchor="middle">${v}</text>`;
  g += `<text x="${(pad.l + W - pad.r) / 2}" y="${H - pad.b + 50}" class="axt" text-anchor="middle">${t("axis")}</text>`;
  const band = (b, cls) => `<rect x="${x(b.lo)}" y="${top}" width="${Math.max(3, x(b.hi) - x(b.lo))}" height="${bottom - top}" class="${cls}"/>`;
  g += band(room, "room") + band(lim, "now");
  for (const [sex, label, y] of rows) {
    const z = ZONES[sex];
    const seg = [["easy", z.first, z.lt1], ["threshold", z.lt1, z.lt2], ["high", z.lt2, z.peak]];
    g += `<text x="${pad.l - 10}" y="${y + 5}" class="row${sex === state.sex ? " on" : ""}" text-anchor="end">${label}</text>`;
    for (const [k, a, b] of seg) g += `<rect x="${x(a)}" y="${y - 15}" width="${x(b) - x(a)}" height="30" fill="${ZONE_COLOURS[k]}"/>`;
    for (const [lab, v] of [["LT1", z.lt1], ["LT2", z.lt2], ["Max", z.peak]]) {
      g += `<circle cx="${x(v)}" cy="${y - 24}" r="4.5" class="dot"/><text x="${x(v)}" y="${y - 33}" class="dl" text-anchor="middle">${lab} ${v}</text>`;
    }
    if (sex === state.sex) g += `<line x1="${x(ve())}" x2="${x(ve())}" y1="${y - 20}" y2="${y + 20}" class="you"/><text x="${x(ve())}" y="${y + 33}" class="yl" text-anchor="middle">${t("you")} ${fmt(ve())}</text>`;
  }
  $("chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}"${narrow ? ' class="narrow"' : ""} role="img" aria-label="${t("chartTitle")}">${g}</svg>`;
  $("chartWhen").textContent = t("chartWhen", { site: state.site.name, when });
  const sw = (cls, style = "") => `<span class="sw ${cls}" style="${style}"></span>`;
  $("legend").innerHTML = [
    [sw("", `background:${ZONE_COLOURS.easy}`) + sw("", `background:${ZONE_COLOURS.threshold}`) + sw("", `background:${ZONE_COLOURS.high}`), t("legZones")],
    [sw("now"), t("legNow", { site: state.site.name, when, t: fmt(air.tempC, 1), rh: fmt(air.rhPct), lo: fmt(lim.lo), hi: fmt(lim.hi) })],
    [sw("room"), t("legRoom", { lo: fmt(room.lo), hi: fmt(room.hi) })],
    [sw("dotk"), t("legDots")],
    [sw("youk"), t("legYou")],
  ].map(([k, v]) => `<li>${k}<span>${v}</span></li>`).join("");
}

// ---- data --------------------------------------------------------------------
async function load(site) {
  state.site = site; store.set("site", JSON.stringify(site));
  $("status").textContent = t("loading"); $("status").hidden = false; $("result").hidden = true;
  try {
    state.fc = await fetchForecast(site.lat, site.lon);
    $("status").hidden = true;
    render();
  } catch (err) {
    console.error(err);
    $("status").textContent = t("error");
  }
}

// ---- events ------------------------------------------------------------------
function wire() {
  NARROW.addEventListener("change", render);
  $("site").addEventListener("change", (e) => load(state.sites.find((s) => s.id === e.target.value)));
  $("days").addEventListener("click", (e) => { const b = e.target.closest("[data-day]"); if (b) { state.day = Number(b.dataset.day); render(); } });
  $("start").addEventListener("change", (e) => { state.start = Number(e.target.value); render(); });
  $("duration").addEventListener("input", (e) => { const v = Number(e.target.value); if (v > 0 && v <= 480) { state.duration = v; render(); } });
  $("sex").addEventListener("change", (e) => { state.sex = e.target.value; store.set("sex", state.sex); renderControls(); render(); });
  $("intensity").addEventListener("change", (e) => { state.preset = e.target.value; $("ownVeRow").hidden = state.preset !== "own"; render(); });
  $("ownVe").addEventListener("input", (e) => { const v = Number(e.target.value); if (v > 0 && v <= 300) { state.ownVe = v; render(); } });
  $("searchForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("search").value.trim(); if (!q) return;
    const found = await searchPlace(q, "en");
    $("found").innerHTML = found.length ? found.map((f, i) => `<button type="button" class="chip" data-f="${i}">${f.name}, ${f.region}</button>`).join("") : t("noResults");
    $("found").onclick = (ev) => {
      const b = ev.target.closest("[data-f]"); if (!b) return;
      const f = found[Number(b.dataset.f)];
      if (!state.sites.some((s) => s.id === f.id)) state.sites.push({ ...f, region: "Search" });
      renderSites(); $("site").value = f.id; $("found").innerHTML = ""; load(f);
    };
  });
}

async function init() {
  for (const el of document.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t);
  $("search").placeholder = t("search");
  $("start").innerHTML = Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, "0")}:00</option>`).join("");
  $("start").value = state.start; $("duration").value = state.duration; $("ownVe").value = state.ownVe;
  state.sites = await (await fetch("data/sites.json")).json();
  let site = null;
  try { site = JSON.parse(store.get("site")); } catch { /* none */ }
  if (site && !state.sites.some((s) => s.id === site.id)) state.sites.push({ ...site, region: "Search" });
  state.site = site || state.sites.find((s) => s.id === "Jyvaskyla");
  renderSites(); renderControls(); wire(); load(state.site);
}

init();
