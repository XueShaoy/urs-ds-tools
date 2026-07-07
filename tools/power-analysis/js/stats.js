/** @module stats — power analysis (pure) */

export function erf(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    return (x >= 0 ? 1 : -1) * (1 - p * Math.exp(-x * x));
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

export function variance(p) {
    return p * (1 - p);
}

export function getSplitRatio(splitRatio) {
    const [a, b] = String(splitRatio).split(':').map(Number);
    return { rA: a, rB: b };
}

export function nForDay(day, ctx) {
    if (ctx.scenario !== 'ab-test') return { nA: ctx.dailyN * day, nB: ctx.dailyN * day };
    if (ctx.abTrafficMode === 'direct') {
        return { nA: (ctx.dailyNa || 0) * day, nB: (ctx.dailyNb || 0) * day };
    }
    const total = ctx.dailyN * day;
    const { rA, rB } = getSplitRatio(ctx.splitRatio);
    return { nA: total * rA / (rA + rB), nB: total * rB / (rA + rB) };
}

export function calcPower(p0, delta, nA, nB, alpha, scenario) {
    const se = scenario === 'ab-test'
        ? Math.sqrt(variance(p0) / nA + variance(p0 + delta) / nB)
        : Math.sqrt(variance(p0) / nA);
    return normCDF(delta / se - normInv(1 - alpha / 2));
}

export function calcMDE(p0, nA, nB, alpha, power, scenario) {
    const z = normInv(1 - alpha / 2) + normInv(power);
    const se = scenario === 'ab-test'
        ? Math.sqrt(variance(p0) / nA + variance(p0) / nB)
        : Math.sqrt(variance(p0) / nA);
    return z * se;
}

export function calcRequiredN_ab(p0, delta, alpha, power, ctx) {
    const z = normInv(1 - alpha / 2) + normInv(power);
    const seTarget = delta / z;
    const v = variance(p0);
    let fA, fB;
    if (ctx.abTrafficMode === 'direct') {
        const tot = (ctx.dailyNa || 0) + (ctx.dailyNb || 0);
        fA = (ctx.dailyNa || 0) / tot;
        fB = (ctx.dailyNb || 0) / tot;
    } else {
        const { rA, rB } = getSplitRatio(ctx.splitRatio);
        fA = rA / (rA + rB);
        fB = rB / (rA + rB);
    }
    const total = v * (1 / fA + 1 / fB) / (seTarget * seTarget);
    return { total, nA: total * fA, nB: total * fB };
}

export function buildPowerCurve(p0, delta, alpha, maxDays, ctx) {
    return Array.from({ length: maxDays }, (_, i) => {
        const { nA, nB } = nForDay(i + 1, ctx);
        return { day: i + 1, value: Math.min(calcPower(p0, delta, nA, nB, alpha, ctx.scenario) * 100, 99.99) };
    });
}

export function buildMDECurve(p0, alpha, targetPower, maxDays, ctx) {
    return Array.from({ length: maxDays }, (_, i) => {
        const { nA, nB } = nForDay(i + 1, ctx);
        return { day: i + 1, value: calcMDE(p0, nA, nB, alpha, targetPower, ctx.scenario) * 100 };
    });
}

export function findCrossDay(curve, threshold) {
    const pt = curve.find(p => p.value >= threshold);
    return pt ? pt.day : null;
}

export function findDropDay(curve, threshold) {
    const pt = curve.find(p => p.value <= threshold);
    return pt ? pt.day : null;
}
