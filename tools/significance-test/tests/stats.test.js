import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { testSingle, testTwo, adjustPValues, calcOR, normCDF } from '../js/stats.js';

describe('testSingle', () => {
    it('detects significant increase', () => {
        const r = testSingle(800, 1000, 0.75, 0.05, 'two');
        assert.ok(r.phat > r.p0);
        assert.ok(r.p < 0.05);
    });
    it('no effect near null', () => {
        const r = testSingle(500, 1000, 0.5, 0.05, 'two');
        assert.ok(Math.abs(r.est) < 0.05);
        assert.ok(r.p > 0.05);
    });
});

describe('testTwo', () => {
    it('detects group difference', () => {
        const r = testTwo(600, 3000, 450, 3000, 0.05, 'two');
        assert.ok(Math.abs(r.est) > 0.01);
        assert.ok(r.p < 0.05);
    });
});

describe('adjustPValues', () => {
    it('bonferroni multiplies by m', () => {
        const adj = adjustPValues([0.01, 0.02, 0.03], 'bonferroni');
        assert.deepEqual(adj, [0.03, 0.06, 0.09]);
    });
    it('holm is monotonic in sorted order', () => {
        const adj = adjustPValues([0.01, 0.04, 0.03], 'holm');
        const sorted = adj.slice().sort((a, b) => a - b);
        assert.deepEqual(adj.map((_, i) => adj[i]).sort((a, b) => a - b), sorted);
        assert.ok(adj.every(p => p <= 1));
    });
    it('bh controls step-down', () => {
        const adj = adjustPValues([0.001, 0.02, 0.03], 'bh');
        assert.ok(adj[0] <= adj[1]);
        assert.ok(adj[1] <= adj[2]);
    });
    it('none returns copy', () => {
        const p = [0.1, 0.2];
        const adj = adjustPValues(p, 'none');
        assert.deepEqual(adj, p);
        assert.notEqual(adj, p);
    });
});

describe('calcOR', () => {
    it('returns null at boundaries', () => {
        assert.equal(calcOR(0, 0.5), null);
        assert.equal(calcOR(1, 0.5), null);
    });
    it('symmetric around 1 for equal rates', () => {
        const or = calcOR(0.6, 0.4);
        assert.ok(or > 1);
        const inv = calcOR(0.4, 0.6);
        assert.ok(Math.abs(or * inv - 1) < 0.01);
    });
});

describe('normCDF', () => {
    it('standard normal at 0', () => {
        assert.ok(Math.abs(normCDF(0) - 0.5) < 1e-6);
    });
});
