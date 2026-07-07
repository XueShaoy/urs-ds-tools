/** @module stats — sequential test boundaries (pure) */

export function erf(x) {
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
    return sign * y;
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

export function spendOBF(alpha, t) {
    if (t <= 0) return 0;
    if (t >= 1) return alpha;
    const sides = 2;
    const za = normInv(1 - alpha / sides);
    return sides * (1 - normCDF(za / Math.sqrt(t)));
}

export function spendPocock(alpha, t) {
    if (t <= 0) return 0;
    if (t >= 1) return alpha;
    return alpha * Math.log(1 + (Math.E - 1) * t);
}

export function computeBoundaries(alpha, K, spendFn, tail) {
    const sides = tail === 'two' ? 2 : 1;
    const looks = [];
    let prevSpent = 0;
    for (let k = 1; k <= K; k++) {
        const t = k / K;
        const cumSpent = spendFn(alpha, t);
        const deltaAlpha = Math.max(cumSpent - prevSpent, 1e-10);
        const critP = deltaAlpha / sides;
        const z = normInv(1 - critP);
        const boundaryP = sides * (1 - normCDF(z));
        looks.push({ k, t, cumSpent, deltaAlpha, z, boundaryP });
        prevSpent = cumSpent;
    }
    return looks;
}

export function findCurrentLook(looks, currentN, N) {
    if (!(currentN > 0 && N > 0)) return null;
    const t = Math.min(currentN / N, 1);
    let bestIdx = 0;
    for (let i = 0; i < looks.length; i++) {
        if (Math.abs(looks[i].t - t) < Math.abs(looks[bestIdx].t - t)) bestIdx = i;
    }
    return looks[bestIdx];
}
