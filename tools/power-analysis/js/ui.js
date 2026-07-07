import {
    buildPowerCurve, buildMDECurve, findCrossDay, findDropDay,
    calcRequiredN_ab, nForDay, getSplitRatio, normInv,
} from './stats.js';
import { renderChart, chartColors } from './charts.js';

let scenario = 'monitoring';
let abTrafficMode = 'ratio';

function tipHtml(text, tip) {
    return `${text} <span class="tooltip tip-left" data-tip="${tip}">ⓘ</span>`;
}

function statCard(label, tip, valueHtml, note, cls = '') {
    return `<div class="metric-card${cls === 'good' ? ' highlight' : ''}">
        <div class="metric-label">${tipHtml(label, tip)}</div>
        <div class="metric-value ${cls}">${valueHtml}</div>
        <div class="metric-note">${note}</div>
    </div>`;
}

function setFieldVisible(id, visible) {
    document.getElementById(id).style.display = visible ? '' : 'none';
}

function updateVisibility() {
    const isAb = scenario === 'ab-test';
    document.getElementById('traffic-mode-row').style.display = isAb ? 'flex' : 'none';
    setFieldVisible('field-daily-n', !isAb || abTrafficMode === 'ratio');
    setFieldVisible('field-split', isAb && abTrafficMode === 'ratio');
    setFieldVisible('field-daily-na', isAb && abTrafficMode === 'direct');
    setFieldVisible('field-daily-nb', isAb && abTrafficMode === 'direct');
    document.getElementById('results').classList.remove('visible');
}

function switchScenario(s) {
    scenario = s;
    if (s !== 'ab-test') abTrafficMode = 'ratio';
    document.querySelectorAll('.scenario-btn').forEach(btn => {
        const on = btn.dataset.scenario === s;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.traffic-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === abTrafficMode);
    });
    updateVisibility();
}

function setTrafficMode(mode) {
    abTrafficMode = mode;
    document.querySelectorAll('.traffic-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    updateVisibility();
}

function run() {
    const banner = document.getElementById('validation-banner');
    const list = [];
    const dailyN = parseFloat(document.getElementById('daily-n').value);
    const dailyNa = parseFloat(document.getElementById('daily-na').value);
    const dailyNb = parseFloat(document.getElementById('daily-nb').value);
    const p0Raw = parseFloat(document.getElementById('p0').value);
    const deltaRaw = parseFloat(document.getElementById('delta').value);
    const alpha = parseFloat(document.getElementById('alpha').value);
    const targetPower = parseFloat(document.getElementById('target-power').value);
    const maxDays = parseInt(document.getElementById('max-days').value);
    const splitRatio = document.getElementById('split-ratio').value;
    const isDirect = scenario === 'ab-test' && abTrafficMode === 'direct';

    if (!isDirect && (!dailyN || dailyN < 1)) list.push('请填写有效的日均流量');
    if (isDirect) {
        if (!dailyNa || dailyNa < 1) list.push('请填写有效的 A 组日均流量');
        if (!dailyNb || dailyNb < 1) list.push('请填写有效的 B 组日均流量');
    }
    if (!p0Raw || p0Raw <= 0 || p0Raw >= 100) list.push('基准转化率需在 0%–100% 之间');
    if (!maxDays || maxDays < 2) list.push('最多观测天数至少为 2');

    const p0 = p0Raw / 100;
    const delta = (!isNaN(deltaRaw) && deltaRaw > 0) ? deltaRaw / 100 : null;
    if (delta && p0 > 0 && p0 < 1 && p0 + delta >= 1) list.push('p₀ + δ 超出 100%，请调整参数');

    if (list.length) {
        banner.innerHTML = list.map(m => `<div>⚠ ${m}</div>`).join('');
        banner.hidden = false;
        document.getElementById('results').classList.remove('visible');
        banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    banner.hidden = true;

    const ctx = {
        scenario,
        abTrafficMode,
        dailyN: isDirect ? 1 : dailyN,
        dailyNa, dailyNb,
        splitRatio,
    };
    const targetPowerPct = Math.round(targetPower * 100);
    const colors = chartColors();

    const mdeCurve = buildMDECurve(p0, alpha, targetPower, maxDays, ctx);
    const powerCurve = delta ? buildPowerCurve(p0, delta, alpha, maxDays, ctx) : null;
    const mdeAt1 = mdeCurve[0].value;
    const mdeAtMax = mdeCurve[maxDays - 1].value;
    const crossDay = powerCurve ? findCrossDay(powerCurve, targetPower * 100) : null;
    const powerAtMax = powerCurve ? powerCurve[maxDays - 1].value : null;
    const mdeDropDay = delta ? findDropDay(mdeCurve, delta * 100) : null;

    let html = '';
    if (delta) {
        const reachable = crossDay !== null;
        html += statCard('达标天数', `在目标功效 ${targetPowerPct}%、α = ${alpha} 下，可检测到目标 MDE δ = ${deltaRaw.toFixed(2)}% 所需的实验累积天数。`,
            `${reachable ? crossDay : '&gt;' + maxDays}<span class="metric-unit">天</span>`,
            `δ = ${deltaRaw.toFixed(2)}%，α = ${alpha}`, reachable ? 'good' : 'warn');
        html += statCard('最终功效', `实验进行到第 ${maxDays} 天时，针对 δ = ${deltaRaw.toFixed(2)}% 的统计功效。`,
            `${powerAtMax.toFixed(1)}<span class="metric-unit">%</span>`,
            `δ = ${deltaRaw.toFixed(2)}%，α = ${alpha}`, powerAtMax >= targetPower * 100 ? 'good' : 'warn');
    }
    html += statCard('最终 MDE', `第 ${maxDays} 天在目标功效 ${targetPowerPct}% 下可检测的最小效应量。`,
        `${mdeAtMax.toFixed(2)}<span class="metric-unit">%</span>`,
        `功效 ${targetPowerPct}%，α = ${alpha}`, 'accent');

    if (scenario === 'ab-test' && delta) {
        const req = calcRequiredN_ab(p0, delta, alpha, targetPower, ctx);
        const totalN = Math.ceil(req.total);
        const reqNA = Math.ceil(req.nA);
        const reqNB = Math.ceil(req.nB);
        const dailyTotal = isDirect ? (dailyNa + dailyNb) : dailyN;
        const daysNeeded = dailyTotal > 0 ? Math.ceil(req.total / dailyTotal) : null;
        const daysNote = daysNeeded !== null ? `约需 ${daysNeeded} 天累积` : '';
        html += statCard('所需总样本量', `检测到 δ = ${deltaRaw.toFixed(2)}% 所需的总样本量。`,
            totalN.toLocaleString(), `δ = ${deltaRaw.toFixed(2)}%，功效 ${targetPowerPct}%${daysNote ? '，' + daysNote : ''}`, 'good');
        html += statCard('对照组样本量', '达到目标 MDE 时 A 组所需样本量。', reqNA.toLocaleString(), 'A组', '');
        html += statCard('实验组样本量', '达到目标 MDE 时 B 组所需样本量。', reqNB.toLocaleString(), 'B组', '');
    }

    const { nA: nA1, nB: nB1 } = nForDay(1, ctx);
    const groupNote = scenario === 'ab-test'
        ? `A组 ${Math.round(nA1).toLocaleString()} / B组 ${Math.round(nB1).toLocaleString()}`
        : `${Math.round(nA1).toLocaleString()} 人`;
    html += statCard('单日 MDE', '仅使用单日流量时，在目标功效下可检测的最小效应量。',
        `${mdeAt1.toFixed(2)}<span class="metric-unit">%</span>`, groupNote, '');

    document.getElementById('summary-grid').innerHTML = html;

    const powerEl = document.getElementById('power-chart');
    if (powerCurve) {
        renderChart(powerEl, {
            curve: powerCurve, yLabel: '功效 (%)', yMin: 0, yMax: 100,
            thresholdY: targetPower * 100, thresholdLabel: `${targetPowerPct}%`,
            markerDay: crossDay, color: colors.power,
        });
        document.getElementById('power-subtitle').textContent = `δ = ${deltaRaw.toFixed(2)}%，α = ${alpha}`;
    } else {
        powerEl.classList.remove('chart-interactive');
        powerEl.innerHTML = '<div class="chart-empty">填写目标 MDE δ 以显示功效曲线</div>';
        document.getElementById('power-subtitle').textContent = '';
    }

    const mdeYMax = Math.max(mdeAt1 * 1.15, delta ? delta * 100 * 1.25 : mdeAtMax * 1.1);
    renderChart(document.getElementById('mde-chart'), {
        curve: mdeCurve, yLabel: 'MDE (%)', yMin: 0, yMax: mdeYMax,
        thresholdY: delta ? delta * 100 : undefined,
        thresholdLabel: delta ? `δ = ${deltaRaw.toFixed(2)}%` : undefined,
        markerDay: mdeDropDay, color: colors.mde,
    });
    document.getElementById('mde-subtitle').textContent = `目标功效 ${targetPowerPct}%，α = ${alpha}`;

    const za = normInv(1 - alpha / 2).toFixed(3);
    const zb = normInv(targetPower).toFixed(3);
    const isAB = scenario === 'ab-test';
    let nDesc;
    if (!isAB) nDesc = 'n = 日均流量 × 天数';
    else if (abTrafficMode === 'direct') {
        nDesc = `n<sub>A</sub> = ${Math.round(dailyNa).toLocaleString()} × 天数，n<sub>B</sub> = ${Math.round(dailyNb).toLocaleString()} × 天数`;
    } else {
        const { rA, rB } = getSplitRatio(splitRatio);
        nDesc = `n<sub>A</sub> = 日均流量 × ${rA}/${rA + rB} × 天数，n<sub>B</sub> = 日均流量 × ${rB}/${rA + rB} × 天数`;
    }
    document.getElementById('formula-text').innerHTML =
        `<strong>${isAB ? 'AB 测试' : '长期观测（单样本）'}</strong><br>${nDesc}<br>
        SE = ${isAB ? '√( p₀(1−p₀)/n<sub>A</sub> + p₁(1−p₁)/n<sub>B</sub> )' : '√( p₀(1−p₀)/n )'}<br>
        功效 = Φ( δ/SE − z<sub>α/2</sub> )，z<sub>α/2</sub> = ${za}<br>
        MDE（功效 ${targetPowerPct}%）= (${za} + ${zb}) × SE`;

    document.getElementById('results').classList.add('visible');
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof gtag !== 'undefined') {
        gtag('event', 'run_power_analysis', { event_category: 'power_analysis', scenario });
    }
}

Object.assign(window, { switchScenario, setTrafficMode, run });

document.addEventListener('DOMContentLoaded', updateVisibility);
