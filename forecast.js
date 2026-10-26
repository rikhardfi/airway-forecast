// forecast.js: hourly weather for a place, from Open-Meteo
//
// MET Nordic (metno_seamless: 1 km, observation-corrected, then ECMWF further
// out) inside its Nordic domain, Open-Meteo's best model elsewhere. A forecast
// is not a reading: every result carries its model, grid and fetch time.

const API = "https://api.open-meteo.com/v1/forecast";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";

// Approximate MET Nordic domain (Fennoscandia and the Baltics).
const inNordic = (lat, lon) => lat >= 54 && lat <= 72 && lon >= 4 && lon <= 32;

export async function fetchForecast(lat, lon, days = 10) {
  const models = inNordic(lat, lon) ? ["metno_seamless", "best_match"] : ["best_match"];
  for (const model of models) {
    const url = `${API}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,surface_pressure,cloud_cover`
      + `&daily=weather_code,precipitation_sum&forecast_days=${days}&timezone=auto&models=${model}`;
    let d = null;
    for (let attempt = 0; attempt < 2 && !d; attempt++) {
      try {
        const res = await fetch(url);
        if (res.ok) d = await res.json();
      } catch { /* network hiccup: retry once */ }
    }
    if (!d) continue;
    const h = d.hourly;
    const rows = h.time.map((t, i) => ({
      time: t, tempC: h.temperature_2m[i], rhPct: h.relative_humidity_2m[i],
      pressurePa: h.surface_pressure[i] == null ? null : h.surface_pressure[i] * 100,
      cloud: h.cloud_cover?.[i] ?? null,
    })).filter((r) => r.tempC != null && r.rhPct != null && r.pressurePa != null);
    if (rows.length < 24) continue;
    const daily = Object.fromEntries((d.daily?.time || []).map((t, i) => [t, { code: d.daily.weather_code[i], precip: d.daily.precipitation_sum[i] }]));
    return { rows, daily, model, elevation: d.elevation, timezone: d.timezone,
             gridLat: d.latitude, gridLon: d.longitude, fetchedAt: new Date() };
  }
  throw new Error("forecast unavailable");
}

export async function searchPlace(name, lang) {
  const res = await fetch(`${GEO}?name=${encodeURIComponent(name)}&count=6&language=${lang}&format=json`);
  if (!res.ok) return [];
  const d = await res.json();
  return (d.results || []).map((r) => ({
    id: `geo-${r.id}`, name: r.name, country: r.country_code,
    region: [r.admin1, r.country].filter(Boolean).join(", "), lat: r.latitude, lon: r.longitude,
  }));
}
