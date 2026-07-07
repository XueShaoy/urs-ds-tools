/** @module stats — z proportion tests */

export function erf(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return x >= 0 ? y : -y;
}

export function normCDF(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function normInv(p) {
    if (p <= 0 || p >= 1) return p <= 0 ? -Infinity : Infinity;
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pLow = 0.02425;
    let q, r;
    if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p <= 1 - pLow) {
        q = p - 0.5; r = q * q;
        return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

export function pValue(z, tail) {
    if (tail === 'greater') return 1 - normCDF(z);
    if (tail === 'less') return normCDF(z);
    return 2 * (1 - normCDF(Math.abs(z)));
}

export function calcPowerObserved(d, seNull, seAlt, zc, tail) {
    if (!(seAlt > 0)) seAlt = seNull;
    if (!(seAlt > 0)) return NaN;
    let pw;
    if (tail === 'greater') pw = normCDF((d - zc * seNull) / seAlt);
    else if (tail === 'less') pw = normCDF((-d - zc * seNull) / seAlt);
    else pw = normCDF((d - zc * seNull) / seAlt) + normCDF((-d - zc * seNull) / seAlt);
    return Math.min(1, Math.max(0, pw));
}

export function adjustPValues(pvals, method) {
    const m = pvals.length;
    if (m === 0 || method === 'none') return pvals.slice();
    if (method === 'bonferroni') return pvals.map(p => Math.min(1, p * m));
    const idx = pvals.map((p, i) => i).sort((a, b) => pvals[a] - pvals[b]);
    const adj = new Array(m);
    if (method === 'holm') {
        let prev = 0;
        for (let k = 0; k < m; k++) {
            const i = idx[k];
            let val = Math.min(1, (m - k) * pvals[i]);
            val = Math.max(val, prev);
            adj[i] = val;
            prev = val;
        }
    } else if (method === 'bh') {
        let prev = 1;
        for (let k = m - 1; k >= 0; k--) {
            const i = idx[k];
            let val = Math.min(1, pvals[i] * m / (k + 1));
            val = Math.min(val, prev);
            adj[i] = val;
            prev = val;
        }
    }
    return adj;
}

export function testSingle(x, n, p0, alpha, tail) {
    const phat = x / n;
    const se0 = Math.sqrt(p0 * (1 - p0) / n);
    const seEst = Math.sqrt(phat * (1 - phat) / n);
    const z = se0 > 0 ? (phat - p0) / se0 : 0;
    const p = pValue(z, tail);
    const zc = normInv(1 - (tail === 'two' ? alpha / 2 : alpha));
    return {
        phat, p0, est: phat - p0,
        ciLow: (phat - p0) - zc * seEst,
        ciHigh: (phat - p0) + zc * seEst,
        z, p, se0, seEst, zc,
        power: calcPowerObserved(phat - p0, se0, seEst, zc, tail),
    };
}

export function testTwo(x1, n1, x2, n2, alpha, tail) {
    const p1 = x1 / n1, p2 = x2 / n2;
    const diff = p1 - p2;
    const pPool = (x1 + x2) / (n1 + n2);
    const sePool = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
    const seDiff = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
    const z = sePool > 0 ? diff / sePool : 0;
    const p = pValue(z, tail);
    const zc = normInv(1 - (tail === 'two' ? alpha / 2 : alpha));
    return {
        p1, p2, est: diff,
        ciLow: diff - zc * seDiff,
        ciHigh: diff + zc * seDiff,
        z, p, pPool, sePool, seDiff, zc,
        power: calcPowerObserved(diff, sePool, seDiff, zc, tail),
    };
}

export function calcOR(pN, pD) {
    if (pD <= 0 || pD >= 1 || pN <= 0 || pN >= 1) return null;
    return (pN * (1 - pD)) / (pD * (1 - pN));
}
