// Reproduces exhale's calculate_kilojoules_and_water() from its own fixture
// (scripts/export_airway_forecast.R). Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { perLitre, airDensity, multiplier, session, latentHeat, dryingLimit } from "../physics.js";

const rows = readFileSync(new URL("../data/physics_fixture.csv", import.meta.url), "utf8")
  .trim().split("\n").slice(1).map((l) => l.split(",").map(Number));
const close = (a, b, rel) => Math.abs(a - b) <= rel * Math.abs(b);

test("air density matches R/altitude.R", () => {
  for (const [t, rh, , p, rho] of rows) assert.ok(close(airDensity(t, rh, p), rho, 1e-9), `${t} ${rh} ${p}`);
});

test("sensible heat and water match calculate_kilojoules_and_water()", () => {
  for (const [t, rh, , p, , sens, water] of rows) {
    const c = perLitre(t, rh, p);
    assert.ok(close(c.sensibleKj * 1000, sens, 1e-6), `sensible ${t} ${rh} ${p}`);
    assert.ok(close(c.waterG * 1000, water, 1e-6), `water ${t} ${rh} ${p}`);
  }
});

test("latent heat is water times L(37 C)", () => {
  const c = perLitre(-10, 70, 101325);
  assert.ok(close(c.latentKj, (c.waterG / 1000) * latentHeat(37), 1e-12));
  assert.ok(close(latentHeat(37), 2413.643, 1e-6));
});

test("multiplier is 1 on the reference day and rises in cold dry air", () => {
  assert.ok(close(multiplier(20, 50), 1, 1e-12));
  assert.ok(multiplier(-15, 80) > 1.3);
  assert.ok(multiplier(30, 90) < 1);
});

test("session is linear in ventilation and minutes", () => {
  const w = [{ tempC: -10, rhPct: 80, pressurePa: 101325 }, { tempC: -12, rhPct: 80, pressurePa: 101325 }];
  const a = session(w, 60, 90), b = session(w, 120, 90);
  assert.ok(close(b.totalKj, 2 * a.totalKj, 1e-12));
  assert.equal(a.litres, 5400);
  assert.equal(session([], 60, 90), null);
});

test("drying limit matches the handout's R computation", () => {
  for (const [t, rh, , p, , , , lo, hi] of rows) {
    const d = dryingLimit(t, rh, p);
    assert.ok(close(d.lo, lo, 1e-6) && close(d.hi, hi, 1e-6), `${t} ${rh} ${p}: ${d.lo} vs ${lo}`);
  }
  const room = dryingLimit(19, 55);
  assert.equal(Math.round(room.lo), 84); assert.equal(Math.round(room.hi), 92);
});
