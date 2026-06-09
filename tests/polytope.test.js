/**
 * tests/polytope-cps.test.js
 * Tests for the CPS-geometry extensions added to unistack-polytope.
 * Node built-in test runner (node --test)
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  // CPS vector utilities
  CPS_AXES,
  cpsVectorToPoint,
  cpsRunsToPolytope,
  cpsBasinDiameter,
  cpsBasinStabilityScore,
  cpsBasinsSame,
  cpsAsciiProject,
  // Trajectory
  trajectoryPolytope,
  trajectoryChord,
  trajectoryChordLength,
  trajectoryCurvature,
  // Perturbation
  cpsDisplacementRecord,
  // Frontier convergence
  frontierStep,
  convergenceTrace,
  // Basin fence
  cpsBasinFence,
  cpsInBasin,
  // Alignment / coupling
  semanticGeometricAlignment,
  trajectoryCouplingCoefficient,
  // Summary
  basinGeometrySummary,
} from "../packages/unistack-polytope/index.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCps(overrides = {}) {
  return {
    KCR_Q: 0.8,
    H_rep: 0.5,
    G_Q: 0.3,
    U_Q: 0.4,
    settleSteps: 5,
    rootDistance: 10,
    fixedPointDrift: 0.01,
    entropySlope: -0.05,
    geometrySlope: -0.03,
    ...overrides,
  };
}

function makeField(cells) {
  return { cells: cells.map(BigInt), width: cells.length, height: 1 };
}

// ── CPS_AXES ─────────────────────────────────────────────────────────────────
describe("CPS_AXES", () => {
  it("has 9 named dimensions", () => {
    assert.equal(CPS_AXES.length, 9);
    assert.ok(CPS_AXES.includes("KCR_Q"));
    assert.ok(CPS_AXES.includes("fixedPointDrift"));
  });
});

// ── cpsVectorToPoint ──────────────────────────────────────────────────────────
describe("cpsVectorToPoint", () => {
  it("maps all 9 axes in correct order", () => {
    const v = makeCps();
    const pt = cpsVectorToPoint(v);
    assert.equal(pt.length, 9);
    assert.equal(pt[0], v.KCR_Q);
    assert.equal(pt[6], v.fixedPointDrift);
  });

  it("defaults missing keys to 0", () => {
    const pt = cpsVectorToPoint({});
    pt.forEach((v) => assert.equal(v, 0));
  });
});

// ── cpsRunsToPolytope ─────────────────────────────────────────────────────────
describe("cpsRunsToPolytope", () => {
  it("builds a V-polytope from CPS vectors", () => {
    const runs = [makeCps({ KCR_Q: 0.1 }), makeCps({ KCR_Q: 0.9 }), makeCps({ KCR_Q: 0.5 })];
    const poly = cpsRunsToPolytope(runs);
    assert.equal(poly.kind, "V");
    assert.ok(poly.vertices.length >= 1);
  });
});

// ── cpsBasinDiameter ──────────────────────────────────────────────────────────
describe("cpsBasinDiameter", () => {
  it("returns 0 for empty set", () => {
    assert.equal(cpsBasinDiameter([]), 0);
  });

  it("returns 0 for single run", () => {
    assert.equal(cpsBasinDiameter([makeCps()]), 0);
  });

  it("is larger when runs differ more", () => {
    const tight = [makeCps({ KCR_Q: 0.5 }), makeCps({ KCR_Q: 0.51 })];
    const wide  = [makeCps({ KCR_Q: 0.0 }), makeCps({ KCR_Q: 1.0 })];
    assert.ok(cpsBasinDiameter(wide) > cpsBasinDiameter(tight));
  });
});

// ── cpsBasinStabilityScore ────────────────────────────────────────────────────
describe("cpsBasinStabilityScore", () => {
  it("returns 1 for single run (perfectly stable)", () => {
    assert.equal(cpsBasinStabilityScore([makeCps()]), 1);
  });

  it("returns value in (0,1] for spread runs", () => {
    const runs = [makeCps({ KCR_Q: 0 }), makeCps({ KCR_Q: 1 })];
    const s = cpsBasinStabilityScore(runs);
    assert.ok(s > 0 && s <= 1);
  });

  it("tighter basin → higher stability score", () => {
    const tight = [makeCps({ KCR_Q: 0.5 }), makeCps({ KCR_Q: 0.51 })];
    const wide  = [makeCps({ KCR_Q: 0.0 }), makeCps({ KCR_Q: 1.0 })];
    assert.ok(cpsBasinStabilityScore(tight) > cpsBasinStabilityScore(wide));
  });
});

// ── cpsBasinsSame ─────────────────────────────────────────────────────────────
describe("cpsBasinsSame", () => {
  it("identical runs → same basin", () => {
    const runs = [makeCps(), makeCps()];
    assert.equal(cpsBasinsSame(runs, runs, 1), true);
  });

  it("distant runs → different basin with tight epsilon", () => {
    const a = [makeCps({ KCR_Q: 0, H_rep: 0, G_Q: 0, U_Q: 0, settleSteps: 0, rootDistance: 0, fixedPointDrift: 0, entropySlope: 0, geometrySlope: 0 })];
    const b = [makeCps({ KCR_Q: 1000, H_rep: 1000, G_Q: 1000, U_Q: 1000, settleSteps: 1000, rootDistance: 1000, fixedPointDrift: 1000, entropySlope: 1000, geometrySlope: 1000 })];
    assert.equal(cpsBasinsSame(a, b, 1), false);
  });

  it("returns false for empty arrays", () => {
    assert.equal(cpsBasinsSame([], [makeCps()], 100), false);
  });
});

// ── cpsAsciiProject ───────────────────────────────────────────────────────────
describe("cpsAsciiProject", () => {
  it("returns a string with * for non-empty input", () => {
    const runs = [makeCps({ KCR_Q: 0 }), makeCps({ KCR_Q: 1 })];
    const art = cpsAsciiProject(runs);
    assert.equal(typeof art, "string");
    assert.ok(art.includes("*"));
  });

  it("returns fallback string for empty input", () => {
    const art = cpsAsciiProject([]);
    assert.ok(art.includes("empty"));
  });
});

// ── trajectoryChord / curvature ───────────────────────────────────────────────
describe("trajectory geometry", () => {
  it("chord of identical steps is zero vector", () => {
    const v = makeCps();
    const chord = trajectoryChord([v, v, v]);
    chord.forEach((c) => assert.ok(Math.abs(c) < 1e-9));
  });

  it("chord length is positive for a moving trajectory", () => {
    const steps = [makeCps({ KCR_Q: 0 }), makeCps({ KCR_Q: 0.5 }), makeCps({ KCR_Q: 1 })];
    assert.ok(trajectoryChordLength(steps) > 0);
  });

  it("curvature ≥ 1 always", () => {
    const steps = [makeCps({ KCR_Q: 0 }), makeCps({ KCR_Q: 0.5 }), makeCps({ KCR_Q: 1 })];
    assert.ok(trajectoryCurvature(steps) >= 1);
  });

  it("straight-line trajectory has curvature = 1", () => {
    const steps = [
      makeCps({ KCR_Q: 0, H_rep: 0, G_Q: 0, U_Q: 0, settleSteps: 0, rootDistance: 0, fixedPointDrift: 0, entropySlope: 0, geometrySlope: 0 }),
      makeCps({ KCR_Q: 0.5, H_rep: 0.5, G_Q: 0.5, U_Q: 0.5, settleSteps: 0.5, rootDistance: 0.5, fixedPointDrift: 0.5, entropySlope: 0.5, geometrySlope: 0.5 }),
      makeCps({ KCR_Q: 1, H_rep: 1, G_Q: 1, U_Q: 1, settleSteps: 1, rootDistance: 1, fixedPointDrift: 1, entropySlope: 1, geometrySlope: 1 }),
    ];
    assert.ok(Math.abs(trajectoryCurvature(steps) - 1) < 1e-6);
  });

  it("trajectoryPolytope is a V-polytope", () => {
    const poly = trajectoryPolytope([makeCps(), makeCps({ KCR_Q: 1 })]);
    assert.equal(poly.kind, "V");
  });
});

// ── cpsDisplacementRecord ─────────────────────────────────────────────────────
describe("cpsDisplacementRecord", () => {
  it("displacement is 0 for identical vectors", () => {
    const v = makeCps();
    const rec = cpsDisplacementRecord(v, v);
    assert.ok(Math.abs(rec.displacement) < 1e-9);
  });

  it("includes dominantAxis key", () => {
    const rec = cpsDisplacementRecord(makeCps({ KCR_Q: 0 }), makeCps({ KCR_Q: 1 }));
    assert.ok(CPS_AXES.includes(rec.dominantAxis));
  });

  it("dominant axis is KCR_Q when only that changes", () => {
    const rec = cpsDisplacementRecord(makeCps({ KCR_Q: 0 }), makeCps({ KCR_Q: 100 }));
    assert.equal(rec.dominantAxis, "KCR_Q");
  });
});

// ── frontierStep / convergenceTrace ──────────────────────────────────────────
describe("frontier convergence trace", () => {
  it("frontierStep returns expected keys", () => {
    const f = [makeField([0, 0]), makeField([1, 1])];
    const snap = frontierStep(f, 0);
    assert.ok("step" in snap);
    assert.ok("diameter" in snap);
    assert.ok("boundingBoxVolume" in snap);
  });

  it("convergenceTrace detects shrinking diameter", () => {
    const steps = [
      { step: 0, diameter: 100, boundingBoxVolume: 10000, vertexCount: 4 },
      { step: 1, diameter: 50,  boundingBoxVolume: 2500,  vertexCount: 4 },
      { step: 2, diameter: 10,  boundingBoxVolume: 100,   vertexCount: 2 },
      { step: 3, diameter: 1,   boundingBoxVolume: 1,     vertexCount: 2 },
    ];
    const trace = convergenceTrace(steps);
    assert.ok(trace.diameterSlope < 0);
    assert.ok(trace.volumeSlope < 0);
  });

  it("convergenceTrace marks converged when slopes near zero", () => {
    const steps = [
      { step: 0, diameter: 0, boundingBoxVolume: 0 },
      { step: 1, diameter: 0, boundingBoxVolume: 0 },
    ];
    const trace = convergenceTrace(steps);
    assert.equal(trace.converged, true);
  });
});

// ── cpsBasinFence / cpsInBasin ────────────────────────────────────────────────
describe("basin fence", () => {
  it("run inside fence → true", () => {
    const runs = [
      makeCps({ KCR_Q: 0, H_rep: 0 }),
      makeCps({ KCR_Q: 1, H_rep: 1 }),
    ];
    const fence = cpsBasinFence(runs);
    const inside = makeCps({ KCR_Q: 0.5, H_rep: 0.5 });
    assert.equal(cpsInBasin(inside, fence), true);
  });

  it("run outside fence → false", () => {
    const runs = [
      makeCps({ KCR_Q: 0.4, H_rep: 0.4, G_Q: 0.4, U_Q: 0.4, settleSteps: 0.4, rootDistance: 0.4, fixedPointDrift: 0.4, entropySlope: 0.4, geometrySlope: 0.4 }),
      makeCps({ KCR_Q: 0.6, H_rep: 0.6, G_Q: 0.6, U_Q: 0.6, settleSteps: 0.6, rootDistance: 0.6, fixedPointDrift: 0.6, entropySlope: 0.6, geometrySlope: 0.6 }),
    ];
    const fence = cpsBasinFence(runs);
    const outside = makeCps({ KCR_Q: 100, H_rep: 100, G_Q: 100, U_Q: 100, settleSteps: 100, rootDistance: 100, fixedPointDrift: 100, entropySlope: 100, geometrySlope: 100 });
    assert.equal(cpsInBasin(outside, fence), false);
  });
});

// ── semanticGeometricAlignment ────────────────────────────────────────────────
describe("semanticGeometricAlignment", () => {
  it("returns 0 for fewer than 2 runs", () => {
    assert.equal(semanticGeometricAlignment([makeCps()]), 0);
  });

  it("returns a number in [-1, 1]", () => {
    const runs = [makeCps({ KCR_Q: 0.1 }), makeCps({ KCR_Q: 0.9 }), makeCps({ KCR_Q: 0.5 })];
    const a = semanticGeometricAlignment(runs);
    assert.ok(a >= -1 && a <= 1);
  });
});

// ── trajectoryCouplingCoefficient ─────────────────────────────────────────────
describe("trajectoryCouplingCoefficient", () => {
  it("returns 0 for fewer than 2 steps", () => {
    assert.equal(trajectoryCouplingCoefficient([makeCps()]), 0);
  });

  it("returns number in [-1, 1]", () => {
    const steps = [
      makeCps({ KCR_Q: 0, rootDistance: 0 }),
      makeCps({ KCR_Q: 0.5, rootDistance: 5 }),
      makeCps({ KCR_Q: 1, rootDistance: 10 }),
    ];
    const c = trajectoryCouplingCoefficient(steps);
    assert.ok(c >= -1 && c <= 1);
  });
});

// ── basinGeometrySummary ──────────────────────────────────────────────────────
describe("basinGeometrySummary", () => {
  it("empty runs → diameter 0, stabilityScore 1", () => {
    const s = basinGeometrySummary([]);
    assert.equal(s.diameter, 0);
    assert.equal(s.stabilityScore, 1);
    assert.equal(s.vertexCount, 0);
  });

  it("has all expected keys", () => {
    const runs = [makeCps({ KCR_Q: 0 }), makeCps({ KCR_Q: 1 })];
    const s = basinGeometrySummary(runs);
    ["vertexCount", "diameter", "boundingBoxVolume", "stabilityScore",
     "semanticGeometricAlignment", "centroid", "dominantAxes"].forEach((k) => {
      assert.ok(k in s, `missing key: ${k}`);
    });
  });

  it("dominantAxes contains only valid CPS axis names", () => {
    const runs = [makeCps({ KCR_Q: 0 }), makeCps({ KCR_Q: 100 })];
    const s = basinGeometrySummary(runs);
    s.dominantAxes.forEach((ax) => assert.ok(CPS_AXES.includes(ax)));
  });
});
