import { calcOR } from './stats.js';
import { CORRECTION_NAMES } from './csv.js';

function theme() {
    const s = getComputedStyle(document.body);
    return {
        label: s.getPropertyValue('--apple-label').trim() || '#1d1d1f',
        muted: s.getPropertyValue('--apple-secondary').trim() || '#6e6e73',
        green: s.getPropertyValue('--apple-success').trim() || '#34c759',
        red: s.getPropertyValue('--apple-danger').trim() || '#ff3b30',
        grid: 'rgba(128,128,128,0.2)',
        bg: s.getPropertyValue('--apple-grouped').trim() || '#fff',
    };
}

function fmtP(p) { return p < 0.0001 ? '<0.0001' : p.toFixed(4); }
function fmtPower(v) { return isFinite(v) ? (v * 100).toFixed(1) + '%' : '—'; }
function powerCls(v) { return isFinite(v) && v >= 0.8 ? 'success-cell' : (isFinite(v) && v < 0.5 ? 'warning-cell' : ''); }
function fmtOR(or) { return or === null ? '—' : or.toFixed(3); }
function orCls(or) { return or === null ? '' : (or > 1 ? 'success-cell' : (or < 1 ? 'warning-cell' : '')); }
function escapeHtml(s) { return String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
function escapeXml(s) { return String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c])); }
function clip(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function colorFor(r, t) {
    if (!r.sig) return t.muted;
    return r.est > 0 ? t.green : t.red;
}

function tagFor(r) {
    if (!r.sig) return '<span class="tag tag-neutral">不显著</span>';
    return r.est > 0 ? '<span class="tag tag-up">显著↑</span>' : '<span class="tag tag-down">显著↓</span>';
}

function thTip(label, tip) {
    return `${label} <span class="tooltip tip-left" data-tip="${tip.replace(/"/g, '&quot;')}">ⓘ</span>`;
}

export function renderForest(results, testType) {
    const t = theme();
    const rowH = 46, padTop = 44, padBottom = 52;
    const W = 860, labelW = 196, valW = 156;
    const plotLeft = labelW, plotRight = W - valW, plotW = plotRight - plotLeft;
    const H = padTop + results.length * rowH + padBottom;
    let vals = [0];
    results.forEach(r => vals.push(r.ciLow, r.ciHigh, r.est));
    let dmin = Math.min(...vals), dmax = Math.max(...vals);
    if (dmin === dmax) { dmin -= 0.01; dmax += 0.01; }
    const sp = dmax - dmin;
    dmin -= sp * 0.12;
    dmax += sp * 0.12;
    const X = v => plotLeft + (v - dmin) / (dmax - dmin) * plotW;
    const axisY = padTop + results.length * rowH + 8;
    let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
        const v = dmin + (dmax - dmin) * i / ticks;
        const px = X(v);
        svg += `<line x1="${px}" y1="${padTop - 10}" x2="${px}" y2="${axisY}" stroke="${t.grid}" stroke-width="1"/>`;
        svg += `<text x="${px}" y="${axisY + 18}" fill="${t.muted}" font-size="11" text-anchor="middle">${(v * 100).toFixed(1)}%</text>`;
    }
    svg += `<line x1="${plotLeft}" y1="${axisY}" x2="${plotRight}" y2="${axisY}" stroke="${t.grid}" stroke-width="1"/>`;
    svg += `<text x="${(plotLeft + plotRight) / 2}" y="${axisY + 40}" fill="${t.muted}" font-size="12" text-anchor="middle">${testType === 'single' ? '观测比例 − 基准比例 (p̂ − p₀)' : '组间差异 (A − B)'}</text>`;
    const zx = X(0);
    svg += `<line x1="${zx}" y1="${padTop - 10}" x2="${zx}" y2="${axisY}" stroke="${t.muted}" stroke-width="1.5" stroke-dasharray="5,4"/>`;
    results.forEach((r, i) => {
        const cy = padTop + i * rowH + rowH / 2;
        const col = colorFor(r, t);
        const lo = X(r.ciLow), hi = X(r.ciHigh), pe = X(r.est);
        svg += `<text x="${plotLeft - 14}" y="${cy + 4}" fill="${t.label}" font-size="12.5" text-anchor="end">${escapeXml(clip(r.metric, 12))}</text>`;
        svg += `<line x1="${lo}" y1="${cy}" x2="${hi}" y2="${cy}" stroke="${col}" stroke-width="2.5" opacity="0.85"/>`;
        svg += `<line x1="${lo}" y1="${cy - 6}" x2="${lo}" y2="${cy + 6}" stroke="${col}" stroke-width="2"/>`;
        svg += `<line x1="${hi}" y1="${cy - 6}" x2="${hi}" y2="${cy + 6}" stroke="${col}" stroke-width="2"/>`;
        svg += `<circle cx="${pe}" cy="${cy}" r="6" fill="${col}" stroke="${t.bg}" stroke-width="1.5"/>`;
        const pShown = r.corrected ? r.pAdj : r.p;
        const txt = `${r.est >= 0 ? '+' : ''}${(r.est * 100).toFixed(2)}%  ${r.corrected ? 'p*' : 'p'}=${fmtP(pShown)}`;
        svg += `<text x="${plotRight + 12}" y="${cy + 4}" fill="${r.sig ? col : t.muted}" font-size="11.5" text-anchor="start">${txt}</text>`;
    });
    svg += `</svg>`;
    return svg;
}

export function renderTableHTML(results, alpha, tail, testType) {
    const ciLabel = `${((1 - alpha) * 100).toFixed(0)}% CI`;
    const corrected = results.length && results[0].corrected;
    const adjHead = corrected ? '<th>校正后 p</th>' : '';
    const adjCell = r => corrected ? `<td>${fmtP(r.pAdj)}</td>` : '';
    const pwHead = `<th>${thTip('事后功效', 'observed power：以观测效应为真实效应，在当前样本量与 α 下检测到该效应的概率。')}</th>`;
    const pwCell = r => `<td class="${powerCls(r.power)}">${fmtPower(r.power)}</td>`;
    const orHead = `<th>${thTip('OR', '比值比（Odds Ratio）。OR=1 无差异，OR>1 正向，OR<1 负向。')}</th>`;
    const orCellSingle = r => { const or = calcOR(r.phat, r.p0); return `<td class="${orCls(or)}">${fmtOR(or)}</td>`; };
    const orCellTwo = r => { const or = calcOR(r.p2, r.p1); return `<td class="${orCls(or)}">${fmtOR(or)}</td>`; };
    let thead, tbody;
    if (testType === 'single') {
        thead = `<tr><th>指标</th><th>观测 p̂</th><th>基准 p₀</th><th>差异</th><th>${ciLabel}</th>${orHead}<th>z 值</th><th>p 值</th>${adjHead}${pwHead}<th>结论</th></tr>`;
        tbody = results.map(r => `<tr><td class="metric-cell">${escapeHtml(r.metric)}</td><td>${(r.phat * 100).toFixed(2)}%</td><td>${(r.p0 * 100).toFixed(2)}%</td><td>${r.est >= 0 ? '+' : ''}${(r.est * 100).toFixed(2)}%</td><td>[${(r.ciLow * 100).toFixed(2)}%, ${(r.ciHigh * 100).toFixed(2)}%]</td>${orCellSingle(r)}<td>${r.z.toFixed(3)}</td><td>${fmtP(r.p)}</td>${adjCell(r)}${pwCell(r)}<td>${tagFor(r)}</td></tr>`).join('');
    } else {
        thead = `<tr><th>指标</th><th>A 比例</th><th>B 比例</th><th>差异(A−B)</th><th>${ciLabel}</th>${orHead}<th>z 值</th><th>p 值</th>${adjHead}${pwHead}<th>结论</th></tr>`;
        tbody = results.map(r => `<tr><td class="metric-cell">${escapeHtml(r.metric)}</td><td>${(r.p1 * 100).toFixed(2)}%</td><td>${(r.p2 * 100).toFixed(2)}%</td><td>${r.est >= 0 ? '+' : ''}${(r.est * 100).toFixed(2)}%</td><td>[${(r.ciLow * 100).toFixed(2)}%, ${(r.ciHigh * 100).toFixed(2)}%]</td>${orCellTwo(r)}<td>${r.z.toFixed(3)}</td><td>${fmtP(r.p)}</td>${adjCell(r)}${pwCell(r)}<td>${tagFor(r)}</td></tr>`).join('');
    }
    return { thead, tbody };
}

export function renderFormulaHTML(alpha, tail, testType, correction) {
    const tailTxt = { two: '双侧', greater: '右侧', less: '左侧' }[tail];
    const pTxt = tail === 'two' ? '2 × [1 − Φ(|z|)]' : (tail === 'greater' ? '1 − Φ(z)' : 'Φ(z)');
    const sigTxt = correction === 'none' ? '当 p &lt; α 时认为显著' : '当<strong>校正后 p</strong> &lt; α 时认为显著';
    let html;
    if (testType === 'single') {
        html = `<strong>单样本 z 比例检验</strong>（${tailTxt}，α=${alpha}）<br>检验统计量：z = (p̂ − p₀) / √(p₀(1−p₀)/n)<br>置信区间（Wald）：(p̂ − p₀) ± Z<sub>${tail === 'two' ? 'α/2' : 'α'}</sub> × √(p̂(1−p̂)/n)<br>p 值：${pTxt}；${sigTxt}`;
    } else {
        html = `<strong>双样本 z 比例检验</strong>（${tailTxt}，α=${alpha}）<br>合并比例：p̄ = (x₁ + x₂) / (n₁ + n₂)<br>检验统计量：z = (p̂₁ − p̂₂) / √(p̄(1−p̄)(1/n₁ + 1/n₂))<br>p 值：${pTxt}；${sigTxt}`;
    }
    if (correction !== 'none') {
        const desc = {
            bonferroni: 'Bonferroni：p<sub>校正</sub> = min(1, m × p)。控制 FWER ≤ α。',
            holm: 'Holm-Bonferroni：升序排列后第 k 小者乘以 (m − k + 1)。控制 FWER。',
            bh: 'Benjamini-Hochberg：控制错误发现率 FDR ≤ α。',
        }[correction];
        html += `<br><strong>多重比较校正 · ${CORRECTION_NAMES[correction]}</strong><br>${desc}`;
    }
    return html;
}

export function summaryCardsFromResults(results) {
    const total = results.length;
    const sig = results.filter(r => r.sig).length;
    const up = results.filter(r => r.sig && r.est > 0).length;
    const down = results.filter(r => r.sig && r.est < 0).length;
    return [
        { label: '指标总数', value: String(total), cls: '' },
        { label: '显著', value: String(sig), cls: 'good' },
        { label: '不显著', value: String(total - sig), cls: '' },
        { label: '↑ 升 / ↓ 降', value: `<span class="metric-value good" style="font-size:1.25rem">${up}</span> / <span class="metric-value danger" style="font-size:1.25rem">${down}</span>`, cls: '', raw: true },
    ];
}
