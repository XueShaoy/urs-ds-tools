import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcMDE, calcPower, nForDay, getSplitRatio } from '../js/stats.js';

describe('calcMDE / calcPower', () => {
    it('MDE decreases with more samples', () => {
        const ctx = { scenario: 'monitoring', dailyN: 1000, abTrafficMode: 'ratio', splitRatio: '1:1' };
        const m1 = calcMDE(0.5, 1000, 1000, 0.05, 0.8, 'monitoring');
        const m2 = calcMDE(0.5, 4000, 4000, 0.05, 0.8, 'monitoring');
        assert.ok(m2 < m1);
    });
    it('power increases with days', () => {
        const ctx = { scenario: 'monitoring', dailyN: 1000, abTrafficMode: 'ratio', splitRatio: '1:1' };
        const { nA: n1 } = nForDay(7, ctx);
        const { nA: n2 } = nForDay(28, ctx);
        const p1 = calcPower(0.5, 0.01, n1, n1, 0.05, 'monitoring');
        const p2 = calcPower(0.5, 0.01, n2, n2, 0.05, 'monitoring');
        assert.ok(p2 > p1);
    });
});

describe('getSplitRatio', () => {
    it('parses 1:2', () => {
        assert.deepEqual(getSplitRatio('1:2'), { rA: 1, rB: 2 });
    });
});
