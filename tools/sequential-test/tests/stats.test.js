import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spendOBF, spendPocock, computeBoundaries, normInv } from '../js/stats.js';

describe('spendOBF / spendPocock', () => {
    it('OBF spends full alpha at t=1', () => {
        assert.ok(Math.abs(spendOBF(0.05, 1) - 0.05) < 1e-6);
    });
    it('Pocock spends full alpha at t=1', () => {
        assert.ok(Math.abs(spendPocock(0.05, 1) - 0.05) < 1e-6);
    });
});

describe('computeBoundaries', () => {
    it('returns K looks with increasing k', () => {
        const looks = computeBoundaries(0.05, 5, spendOBF, 'two');
        assert.equal(looks.length, 5);
        assert.equal(looks[0].k, 1);
        assert.equal(looks[4].k, 5);
    });
    it('OBF final boundary lower than first', () => {
        const looks = computeBoundaries(0.05, 5, spendOBF, 'two');
        assert.ok(looks[4].z < looks[0].z);
        assert.ok(looks[4].z > 1.5);
    });
    it('Pocock boundaries decrease or stay high early', () => {
        const looks = computeBoundaries(0.05, 4, spendPocock, 'two');
        assert.ok(looks.every(l => l.z > 0));
        assert.ok(looks[0].z > looks[3].z || Math.abs(looks[0].z - looks[3].z) < 0.5);
    });
});
