function themeChart() {
    const s = getComputedStyle(document.body);
    return {
        grid: 'rgba(128,128,128,0.2)',
        axis: s.getPropertyValue('--apple-tertiary').trim() || '#86868b',
        label: s.getPropertyValue('--apple-secondary').trim() || '#6e6e73',
        bg: s.getPropertyValue('--apple-grouped').trim() || '#fff',
        warn: s.getPropertyValue('--apple-secondary').trim() || '#98989d',
    };
}

export function renderChart(container, { curve, yLabel, yMin, yMax, thresholdY, thresholdLabel, markerDay, color }) {
    const tc = themeChart();
    const W = 500, H = 260;
    const ml = 52, mr = 16, mt = 14, mb = 40;
    const cw = W - ml - mr, ch = H - mt - mb;
    const maxDay = curve[curve.length - 1].day;

    function px(day) {
        return maxDay <= 1 ? ml + cw / 2 : ml + (day - 1) / (maxDay - 1) * cw;
    }
    function py(v) {
        return mt + ch - (Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin) * ch;
    }

    function xTicks() {
        const step = Math.max(1, Math.ceil(maxDay / 6));
        const ticks = [1];
        for (let t = step; t < maxDay; t += step) if (t > 1) ticks.push(t);
        if (ticks[ticks.length - 1] !== maxDay) ticks.push(maxDay);
        return ticks;
    }

    function yTicks() {
        const range = yMax - yMin;
        const candidates = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50];
        const step = candidates.find(s => range / s <= 7) || 50;
        const ticks = [];
        for (let t = Math.ceil(yMin / step) * step; t <= yMax + 1e-9; t = Math.round((t + step) * 1e8) / 1e8) ticks.push(t);
        return ticks;
    }

    function fmtTick(v) {
        if (v === 0) return '0';
        if (Math.abs(v) >= 10) return v.toFixed(0);
        if (Math.abs(v) >= 1) return v.toFixed(1);
        return v.toFixed(2);
    }

    const xt = xTicks(), yt = yTicks();
    let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

    for (const v of yt) {
        const yp = py(v);
        s += `<line x1="${ml}" y1="${yp}" x2="${ml + cw}" y2="${yp}" stroke="${tc.grid}" stroke-width="1"/>`;
    }
    for (const d of xt) {
        const xp = px(d);
        s += `<line x1="${xp}" y1="${mt}" x2="${xp}" y2="${mt + ch}" stroke="${tc.grid}" stroke-width="1"/>`;
    }

    if (thresholdY !== undefined && thresholdY >= yMin && thresholdY <= yMax) {
        const yp = py(thresholdY);
        s += `<line x1="${ml}" y1="${yp}" x2="${ml + cw}" y2="${yp}" stroke="${tc.warn}" stroke-width="1.5" stroke-dasharray="6,4"/>`;
        s += `<text x="${ml + cw - 4}" y="${yp - 5}" font-size="10" fill="${tc.warn}" text-anchor="end">${thresholdLabel}</text>`;
    }

    const pts = curve.map(p => `${px(p.day)},${py(p.value)}`).join(' ');
    s += `<polygon points="${px(1)},${py(yMin)} ${pts} ${px(maxDay)},${py(yMin)}" fill="${color}" fill-opacity="0.1"/>`;
    s += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

    if (markerDay !== undefined && markerDay !== null) {
        const pt = curve.find(p => p.day === markerDay);
        if (pt) {
            const mxp = px(markerDay), myp = py(pt.value);
            s += `<line x1="${mxp}" y1="${myp}" x2="${mxp}" y2="${mt + ch}" stroke="${color}" stroke-width="1" stroke-dasharray="4,3" opacity="0.5"/>`;
            s += `<circle cx="${mxp}" cy="${myp}" r="5" fill="${color}" stroke="${tc.bg}" stroke-width="2"/>`;
            const anchor = mxp > ml + cw * 0.75 ? 'end' : 'start';
            const lx = anchor === 'start' ? mxp + 8 : mxp - 8;
            s += `<text x="${lx}" y="${myp - 9}" font-size="11" fill="${color}" text-anchor="${anchor}" font-weight="500">第${markerDay}天</text>`;
        }
    }

    s += `<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ch}" stroke="${tc.axis}" stroke-width="1.5"/>`;
    s += `<line x1="${ml}" y1="${mt + ch}" x2="${ml + cw}" y2="${mt + ch}" stroke="${tc.axis}" stroke-width="1.5"/>`;

    for (const v of yt) {
        const yp = py(v);
        s += `<text x="${ml - 6}" y="${yp + 4}" font-size="10" fill="${tc.label}" text-anchor="end" font-family="ui-monospace,monospace">${fmtTick(v)}</text>`;
    }
    for (const d of xt) {
        const xp = px(d);
        s += `<text x="${xp}" y="${mt + ch + 16}" font-size="10" fill="${tc.label}" text-anchor="middle" font-family="ui-monospace,monospace">${d}</text>`;
    }

    s += `<text x="${ml + cw / 2}" y="${H - 3}" font-size="10" fill="${tc.label}" text-anchor="middle">天数</text>`;
    s += `<text x="10" y="${mt + ch / 2}" font-size="10" fill="${tc.label}" text-anchor="middle" transform="rotate(-90 10 ${mt + ch / 2})">${yLabel}</text>`;

    s += `<g class="chart-crosshair" opacity="0">`;
    s += `<line class="crosshair-v" y1="${mt}" y2="${mt + ch}" stroke="${color}" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/>`;
    s += `<line class="crosshair-h" x1="${ml}" x2="${ml + cw}" stroke="${color}" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/>`;
    s += `<circle class="crosshair-dot" r="5" fill="${color}" stroke="${tc.bg}" stroke-width="2"/>`;
    s += `</g>`;
    s += `<rect class="chart-hit-area" x="${ml}" y="${mt}" width="${cw}" height="${ch}" fill="transparent"/>`;
    s += `</svg>`;

    container.classList.add('chart-interactive');
    container.innerHTML = s + `<div class="chart-tooltip" aria-hidden="true"><div class="chart-tooltip-day"></div><div class="chart-tooltip-value"></div></div>`;

    const svg = container.querySelector('svg');
    const hitArea = svg.querySelector('.chart-hit-area');
    const crosshair = svg.querySelector('.chart-crosshair');
    const crossV = svg.querySelector('.crosshair-v');
    const crossH = svg.querySelector('.crosshair-h');
    const crossDot = svg.querySelector('.crosshair-dot');
    const tooltip = container.querySelector('.chart-tooltip');
    const tooltipDay = tooltip.querySelector('.chart-tooltip-day');
    const tooltipValue = tooltip.querySelector('.chart-tooltip-value');
    const valueLabel = yLabel.replace(/\s*\(%\)\s*$/, '');

    function dayFromSvgX(svgX) {
        if (maxDay <= 1) return 1;
        const t = (svgX - ml) / cw;
        return Math.min(maxDay, Math.max(1, Math.round(1 + t * (maxDay - 1))));
    }

    function svgPointFromEvent(e) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return null;
        return pt.matrixTransform(ctm.inverse());
    }

    function showAtDay(day, clientX, clientY) {
        const pt = curve[day - 1];
        if (!pt) return;
        const xp = px(day), yp = py(pt.value);
        crossV.setAttribute('x1', xp);
        crossV.setAttribute('x2', xp);
        crossH.setAttribute('y1', yp);
        crossH.setAttribute('y2', yp);
        crossDot.setAttribute('cx', xp);
        crossDot.setAttribute('cy', yp);
        crosshair.setAttribute('opacity', '1');
        tooltipDay.textContent = `第 ${day} 天`;
        tooltipValue.textContent = `${valueLabel}：${pt.value.toFixed(2)}%`;
        tooltipValue.style.color = color;
        tooltip.classList.add('visible');
        tooltip.setAttribute('aria-hidden', 'false');

        const margin = 12;
        const gap = 10;
        const tipW = tooltip.offsetWidth || 120;
        const tipH = tooltip.offsetHeight || 48;
        let left = clientX + gap;
        let top = clientY - tipH - gap;
        if (left + tipW > window.innerWidth - margin) left = clientX - tipW - gap;
        if (left < margin) left = margin;
        if (top < margin) top = clientY + gap;
        if (top + tipH > window.innerHeight - margin) top = window.innerHeight - tipH - margin;
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    function hideTooltip() {
        crosshair.setAttribute('opacity', '0');
        tooltip.classList.remove('visible');
        tooltip.setAttribute('aria-hidden', 'true');
    }

    function onPointerMove(e) {
        const sp = svgPointFromEvent(e);
        if (!sp || sp.x < ml || sp.x > ml + cw || sp.y < mt || sp.y > mt + ch) {
            hideTooltip();
            return;
        }
        showAtDay(dayFromSvgX(sp.x), e.clientX, e.clientY);
    }

    hitArea.addEventListener('mousemove', onPointerMove);
    hitArea.addEventListener('mouseleave', hideTooltip);
    hitArea.addEventListener('touchmove', e => {
        if (e.touches.length) { e.preventDefault(); onPointerMove(e.touches[0]); }
    }, { passive: false });
    hitArea.addEventListener('touchend', hideTooltip);
}

export function chartColors() {
    const s = getComputedStyle(document.body);
    return {
        power: s.getPropertyValue('--apple-success').trim() || '#34c759',
        mde: s.getPropertyValue('--apple-blue').trim() || '#007aff',
    };
}
