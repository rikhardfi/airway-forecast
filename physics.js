// physics.js: the airway's cost of conditioning inspired air
//
// A port of calculate_kilojoules_and_water() (exhale R/thermodynamics.R) with
// air density from the session's own air (R/altitude.R). Inspired air is
// brought to body temperature and full saturation; everything is per litre
// ventilated, so a session is this times its total ventilation.
//
// One deliberate difference: latent heat. The R pipeline uses a fixed
// 2260 kJ/kg; this uses the temperature-dependent 2501 - 2.361 T of
// R/tsi.R, evaluated at body temperature (2413.6 kJ/kg), about 7 % higher.
// Sensible heat and water match R exactly (test/physics.test.mjs).

const BODY_C = 37;
const CP_AIR = 1.006;            // kJ/(kg K)
const MW_RATIO = 18.015 / 28.97;
const RD = 287.058, RV = 461.495; // J/(kg K)

export const latentHeat = (tempC) => 2501 - 2.361 * tempC; // kJ/kg
export const buckSaturation = (tempC) => 611.21 * Math.exp((17.502 * tempC) / (tempC + 240.97)); // Pa
export const pressureFromElevation = (m) => 101325 * Math.pow(1 - 2.25577e-5 * m, 5.25588); // Pa

const mixingRatio = (pv, p) => (pv >= p ? NaN : MW_RATIO * pv / (p - pv));

export function airDensity(tempC, rhPct, pressurePa) {
  const tk = tempC + 273.15;
  const pv = (rhPct / 100) * buckSaturation(tempC);
  return (pressurePa - pv) / (RD * tk) + pv / (RV * tk);
}

// Cost of one litre of inspired air: { sensibleKj, latentKj, totalKj, waterG }
export function perLitre(tempC, rhPct, pressurePa = 101325) {
  if (!Number.isFinite(tempC) || !Number.isFinite(rhPct) || rhPct < 0 || rhPct > 100) return null;
  const massKg = airDensity(tempC, rhPct, pressurePa) / 1000;
  const sensibleKj = massKg * CP_AIR * (BODY_C - tempC);
  const qAmbient = mixingRatio((rhPct / 100) * buckSaturation(tempC), pressurePa);
  const qBody = mixingRatio(buckSaturation(BODY_C), pressurePa);
  const waterKg = (qBody - qAmbient) * massKg;
  const latentKj = waterKg * latentHeat(BODY_C);
  return { sensibleKj, latentKj, totalKj: sensibleKj + latentKj, waterG: waterKg * 1000 };
}

// The mild reference day the multiplier is measured against.
export const REFERENCE = { tempC: 20, rhPct: 50 };

// How many times the airway's total cost per litre exceeds the reference day
// at the same pressure. Independent of ventilation, body size and recovery.
export function multiplier(tempC, rhPct, pressurePa = 101325) {
  const here = perLitre(tempC, rhPct, pressurePa);
  const ref = perLitre(REFERENCE.tempC, REFERENCE.rhPct, pressurePa);
  return here && ref ? here.totalKj / ref.totalKj : null;
}

// A session: ventilation in L/min over hourly weather rows {tempC, rhPct, pressurePa}
// covering the session, minute-weighted. Returns totals and the mean multiplier.
export function session(rows, veLmin, minutes) {
  if (!rows.length || !(veLmin > 0) || !(minutes > 0)) return null;
  const perHour = Math.min(60, minutes);
  let left = minutes, sensible = 0, latent = 0, water = 0, mult = 0;
  for (const r of rows) {
    if (left <= 0) break;
    const m = Math.min(perHour, left);
    const c = perLitre(r.tempC, r.rhPct, r.pressurePa);
    if (!c) return null;
    const litres = veLmin * m;
    sensible += c.sensibleKj * litres; latent += c.latentKj * litres; water += c.waterG * litres;
    mult += multiplier(r.tempC, r.rhPct, r.pressurePa) * m;
    left -= m;
  }
  const used = minutes - Math.max(left, 0);
  return { sensibleKj: sensible, latentKj: latent, totalKj: sensible + latent,
           waterMl: water, litres: veLmin * used, multiplier: mult / used, minutes: used };
}

// ---- Tracheal drying limit -------------------------------------------------
// The ventilation above which water evaporating from the tracheal lining
// outpaces what the epithelium replenishes, as in the KIHU "Kohti talvea"
// handout (October 2026) and exhale R/dehydration.R calculate_ve_threshold():
// tracheal evaporation from Karamaoun et al. 2022 Table 2 (19 C, 55 % RH),
// fitted linearly in ventilation, scaled to other air by its water deficit x
// density, against a replenishment ceiling of 0.32 to 0.35 x 10^-3 uL/mm^2/s
// (Karamaoun 2022, from Widdicombe 2002). A model calculation, not a measurement.
const K22 = [[75, 0.285], [80, 0.304], [85, 0.323], [100, 0.379], [115, 0.434]];
const [FIT_A, FIT_B] = (() => {
  const n = K22.length, mx = K22.reduce((s, [x]) => s + x, 0) / n, my = K22.reduce((s, [, y]) => s + y, 0) / n;
  const b = K22.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / K22.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  return [my - b * mx, b];
})();
const CEILING = [0.32, 0.35];
const KARAMAOUN_AIR = { tempC: 19, rhPct: 55, pressurePa: 101325 };

export function dryingLimit(tempC, rhPct, pressurePa = 101325) {
  const here = perLitre(tempC, rhPct, pressurePa);
  const ref = perLitre(KARAMAOUN_AIR.tempC, KARAMAOUN_AIR.rhPct, KARAMAOUN_AIR.pressurePa);
  if (!here || !ref) return null;
  const r = here.waterG / ref.waterG;           // water flux per litre, relative to the reference air
  if (!(r > 0)) return { lo: Infinity, hi: Infinity };
  const [lo, hi] = CEILING.map((c) => (c / r - FIT_A) / FIT_B);
  return { lo, hi };
}
