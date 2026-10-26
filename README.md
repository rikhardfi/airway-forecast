# Airway forecast

Pick a training site, get the weather forecast, and see hour by hour at what ventilation the airway lining starts to dry in that air, against typical training-zone ventilation. A static web app (plain HTML and ES modules, no build step) for coaches and athletes, published at `rikhardfi.github.io/airway-forecast/` and linked from hengitystutkimus.fi (`/airway-forecast`). English only for now.

Part of the EXHALE project (Huippu-urheilun instituutti KIHU). Every number is a port of the EXHALE research code (`~/ventilation_project/exhale/`), the same code behind the KIHU handout *Kohti talvea* (October 2026).

## What it shows

**Drying limit**, for each forecast hour: the ventilation above which water evaporating from the tracheal lining outpaces what the epithelium replenishes. Tracheal evaporation comes from Karamaoun et al. 2022 (J Appl Physiol 132:1031), Table 2, at 19 °C and 55 % humidity, fitted linearly in ventilation. It is scaled to other air by its water deficit × density (`calculate_ve_threshold()`, `R/dehydration.R`), against a replenishment ceiling of 0.32 to 0.35 × 10⁻³ µL/mm²/s (Karamaoun 2022, from Widdicombe 2002). Room air gives 84 to 92 L/min; −15 °C gives about 62 to 68 L/min. This is a model calculation, not a measurement.

**Training zones**: median ventilation from KIHU treadmill tests 2017 to 2025 (latest test per athlete; men n = 24, women n = 11): Easy (midway from the first stage to LT1), LT1, LT2 and maximal. These are group medians; an athlete's own ventilation differs, so there is an "own ventilation" box.

**Load against room air**: the cost of warming and humidifying each breath to 37 °C and saturation, divided by the same in room air or on an ordinary summer day (20 °C, 50 %), at the same pressure. A ratio, independent of ventilation and body size. Absolute energy is deliberately not shown: the full cost before recovery on the out-breath overstates what the airway actually loses.

## Code

- `physics.js`: per-litre heating and humidifying cost (port of `calculate_kilojoules_and_water()`, `R/thermodynamics.R`, and moist-air density, `R/altitude.R`), the room-air multiplier, and the drying limit.
- `test/physics.test.mjs`: reproduces the R code within 10⁻⁶ from `data/physics_fixture.csv`, exported by `exhale/scripts/export_airway_forecast.R`.
- `forecast.js`: Open-Meteo hourly temperature, humidity and surface pressure, 10 days. Inside Fennoscandia and the Baltics `metno_seamless` (MET Nordic, 1 km, then ECMWF), elsewhere Open-Meteo's best match. Model, grid elevation and fetch time are shown with every result.
- `presets.js`: the KIHU zone medians. `data/sites.json`: the 42-site EXHALE training-location gazetteer.

Weather data: Open-Meteo.com, CC BY 4.0.

## Develop

```
python3 -m http.server 8765    # then open http://127.0.0.1:8765/
npm test                       # node --test, no dependencies
```

To refresh the exports, from the EXHALE repository: `Rscript scripts/export_airway_forecast.R <path-to-this-repo>/data`.
