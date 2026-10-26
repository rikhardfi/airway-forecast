// i18n.js: interface text. English only for now; no em-dashes, no middle dots.

const EN = {
  title: "Airway forecast",
  tagline: "Pick a training site and a start time, and see where the airway drying limit falls in the forecast air against your training zones.",
  site: "Training site", search: "Search any place", searchBtn: "Search", noResults: "No places found.",
  start: "Start", duration: "Duration, min", sex: "Zones for", men: "Men", women: "Women",
  intensity: "Intensity", ownVe: "Own ventilation, L/min",
  preset_easy: "Easy", preset_lt1: "Aerobic threshold (LT1)", preset_lt2: "Lactate threshold (LT2)", preset_max: "Maximal",
  preset_own: "Own ventilation",
  chartTitle: "Training zones and the drying limit",
  chartWhen: "{site}, {when}",
  axis: "Ventilation (L/min)",
  chartLead: "The drying limit is the ventilation at which water evaporates from the airway lining faster than the lining can replace it. Training to the right of a band dries the airway lining in that air.",
  legZones: "Training zones: Easy (Z1 to 2), Threshold (LT1 to LT2), High intensity (LT2 to max)",
  legNow: "Drying limit in the forecast air: {site}, {when}, {t} °C, humidity {rh} % ({lo} to {hi} L/min)",
  legRoom: "Drying limit in room air, 19 °C, humidity 55 %, for comparison ({lo} to {hi} L/min)",
  legDots: "Median ventilation at LT1, LT2 and maximum",
  legYou: "Your selected ventilation",
  you: "You", zEasy: "Easy (Z1 to 2)", zThreshold: "Threshold", zHigh: "High intensity",
  best: "Highest drying limit for a {h} h session between 8 and 20: from {start}:00",
  sessionTitle: "Your session",
  limit: "Drying limit in this air", yourVe: "Your ventilation", roomLimit: "Drying limit in room air",
  above: "Above the drying limit", within: "Within the limit range", below: "Below the drying limit",
  air: "Air at the site",
  method: "Model calculation, not a measurement. Drying limit after Karamaoun et al. 2022 (J Appl Physiol 132:1031). Weather: {model}, grid elevation {elev} m, fetched {time}.",
  credit: "Weather data: Open-Meteo.com (CC BY 4.0).",
  loading: "Loading forecast…", error: "The forecast could not be loaded. Try again in a moment.",
};

export function makeT() {
  return (key, vars = {}) => {
    const v = EN[key];
    return typeof v === "string" ? v.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "") : v;
  };
}
