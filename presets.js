// presets.js: ventilation by training zone, from KIHU treadmill tests
//
// Group medians from the "Kohti talvea" handout (KIHU, October 2026;
// esitys_kylmaan_sopeutuminen/01_thresholds.R): latest treadmill test per
// athlete, 2017 to 2025, men n = 24, women n = 11. LT1 = lactate first above
// nadir + 0.5 mmol/L; LT2 = the mean of baseline + 1.5 mmol/L, modified Dmax and
// VT2 where found. Easy = midway between the first stage and LT1.
// Aggregate values only; your own ventilation differs.

export const ZONES = {
  men:   { first: 66, lt1: 99, lt2: 131, peak: 206, n: 24 },
  women: { first: 49, lt1: 73, lt2: 97,  peak: 142, n: 11 },
};

export function presets(sex) {
  const z = ZONES[sex];
  return [
    { id: "easy", ve: Math.round((z.first + z.lt1) / 2) },
    { id: "lt1", ve: z.lt1 },
    { id: "lt2", ve: z.lt2 },
    { id: "max", ve: z.peak },
  ];
}
