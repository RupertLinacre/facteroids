import assert from "node:assert/strict";
import test from "node:test";
import { formatFactors, parseFactorisation } from "../src/factors.js";

test("asterisks work with factors, spaces and powers", () => {
  for (const input of ["10*2", "10 * 2", "10x2", "10 2"]) {
    assert.equal(parseFactorisation(input).product, 20);
    assert.equal(parseFactorisation(formatFactors(input)).product, 20);
  }
  assert.equal(formatFactors("2^2*3"), "2² × 3");
  assert.equal(parseFactorisation("2^2*3").product, 12);
  assert.equal(parseFactorisation(formatFactors("2^2*3")).product, 12);
  assert.ok(parseFactorisation("2**3").error);
});
