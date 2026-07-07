/** @module charts — boundary SVG */

function themeColors() {
    const s = getComputedStyle(document.body);
    return {
        blue: s.getPropertyValue('--apple-blue').trim() || '#007aff',
        orange: s.getPropertyValue('--apple-secondary').trim() || '#98989d',
        green: s.getPropertyValue('--apple-success').trim() || '#34c759',
        red: s.getPropertyValue('--apple-danger').trim() || '#ff3b30',
        muted: s.getPropertyValue('--apple-tertiary').trim() || '#86868b',
        secondary: s.getPropertyValue('--apple-secondary').trim() || '#6e6e73',
        grid: 'rgba(128,128,128,0.15)',
        grouped: s.getPropertyValue('--apple-grouped').trim() || '#fff',
    };
}

export function renderBoundaryChart(looks, currentLook, currentZ, tail, N, alpha, svgEl) {
    const c = themeColors();
    const W = 560, H = 260, ml = 54, mr = 20, mt = 14, mb = 44;
    const pw = W - ml - mr, ph = H - mt - mb;
    const K = looks.length;
    const sides = tail === 'two' ? 2 : 1;
    const fixedZ = normInvLocal(1 - (alpha || 0.05) / sides);

    const allZ = looks.map(l => l.z);
    const maxZ = Math.max(...allZ, fixedZ, currentZ != null ? Math.abs(currentZ) : 0) * 1.15 + 0.3;
    const minZ = 0;
    const xOf = k => ml + (k - 1) / (K - 1) * pw;
    const yOf = z => mt + ph - (z - minZ) / (maxZ - minZ) * ph;

    let svg = '';
    const yTicks = [1, 1.5, 2, 2.5, 3, 3.5, 4].filter(v => v <= maxZ);
    svg += yTicks.map(v => {
        const y = yOf(v);
        return `<line x1="${ml}" y1="${y}" x2="${ml + pw}" y2="${y}" stroke="${c.grid}" stroke-width="1"/>
                <text x="${ml - 6}" y="${y + 4}" text-anchor="end" fill="${c.muted}" font-size="10">${v}</text>`;
    }).join('');

    svg += looks.map(lk => {
        const x = xOf(lk.k);
        return `<line x1="${x}" y1="${mt}" x2="${x}" y2="${mt + ph + 6}" stroke="${c.grid}" stroke-width="1"/>
                <text x="${x}" y="${mt + ph + 18}" text-anchor="middle" fill="${c.muted}" font-size="10">${lk.k}</text>`;
    }).join('');
    svg += `<text x="${ml + pw / 2}" y="${H - 4}" text-anchor="middle" fill="${c.secondary}" font-size="11">分析节点</text>`;

    const yFix = yOf(fixedZ);
    svg += `<line x1="${ml}" y1="${yFix}" x2="${ml + pw}" y2="${yFix}" stroke="${c.muted}" stroke-width="1" stroke-dasharray="4,4"/>
            <text x="${ml + pw + 4}" y="${yFix + 4}" fill="${c.muted}" font-size="9">固定 z=${fixedZ.toFixed(2)}</text>`;

    const pts = looks.map(lk => `${xOf(lk.k)},${yOf(lk.z)}`).join(' ');
    const lastX = xOf(K), firstX = xOf(1);
    svg += `<polygon points="${firstX},${mt} ${pts} ${lastX},${mt}" fill="${c.blue}" fill-opacity="0.08" stroke="none"/>`;
    svg += `<polyline points="${pts}" fill="none" stroke="${c.blue}" stroke-width="2.5" stroke-linejoin="round"/>`;

    svg += looks.map(lk => {
        const x = xOf(lk.k), y = yOf(lk.z);
        const isCurrent = currentLook && lk.k === currentLook.k;
        const color = isCurrent ? c.orange : c.blue;
        return `<circle cx="${x}" cy="${y}" r="${isCurrent ? 6 : 4}" fill="${color}" stroke="${c.grouped}" stroke-width="2"/>
                <text x="${x}" y="${y - 9}" text-anchor="middle" fill="${color}" font-size="9" font-weight="600">${lk.z.toFixed(2)}</text>`;
    }).join('');

    if (currentZ != null) {
        const absZ = Math.abs(currentZ);
        if (absZ >= minZ && absZ <= maxZ * 1.05) {
            const yZ = yOf(absZ);
            const color = currentLook && absZ >= currentLook.z ? c.red : c.green;
            svg += `<line x1="${ml}" y1="${yZ}" x2="${ml + pw}" y2="${yZ}" stroke="${color}" stroke-width="1.5" stroke-dasharray="6,3"/>
                    <text x="${ml + 6}" y="${yZ - 5}" fill="${color}" font-size="10">当前 |z|=${absZ.toFixed(3)}</text>`;
        }
    }

    svg += `<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ph}" stroke="${c.grid}" stroke-width="1.5"/>
            <line x1="${ml}" y1="${mt + ph}" x2="${ml + pw}" y2="${mt + ph}" stroke="${c.grid}" stroke-width="1.5"/>`;
    svg += `<text x="12" y="${mt + ph / 2}" text-anchor="middle" fill="${c.secondary}" font-size="11" transform="rotate(-90,12,${mt + ph / 2})">边界 |z|</text>`;

    svgEl.innerHTML = svg;
}

function normInvLocal(p) {
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
