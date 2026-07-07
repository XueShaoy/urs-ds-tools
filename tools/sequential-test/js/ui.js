import { spendOBF, spendPocock, computeBoundaries, findCurrentLook, normCDF, normInv } from './stats.js';
import { renderBoundaryChart } from './charts.js';

function trackEvent(action) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, { event_category: 'sequential_test' });
    }
}

function showValidation(errors, list) {
    const banner = document.getElementById('validation-banner');
    if (list.length) {
        banner.innerHTML = list.map(msg => `<div>⚠ ${msg}</div>`).join('');
        banner.hidden = false;
        const firstId = Object.keys(errors)[0];
        const el = firstId ? document.getElementById(firstId) : null;
        const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
        if (el) {
            el.classList.add('input-error');
            el.focus({ preventScroll: true });
            el.scrollIntoView({ behavior, block: 'center' });
        } else {
            banner.scrollIntoView({ behavior, block: 'center' });
        }
    } else {
        banner.hidden = true;
        banner.innerHTML = '';
    }
}

function clearFieldErrors() {
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
}

function compute() {
    clearFieldErrors();
    const N = parseInt(document.getElementById('total-n').value) || 0;
    const dailyN = parseFloat(document.getElementById('daily-n').value) || 0;
    const K = Math.min(20, Math.max(2, parseInt(document.getElementById('k-looks').value) || 5));
    const alpha = parseFloat(document.getElementById('alpha').value) || 0.05;
    const bType = document.getElementById('boundary-type').value;
    const tail = document.getElementById('tail').value;
    const currentN = parseFloat(document.getElementById('current-n').value) || 0;
    const currentZRaw = document.getElementById('current-z').value;
    const hasCurrentZ = String(currentZRaw).trim() !== '';
    const currentZ = parseFloat(currentZRaw);
    const hasCurrentN = String(document.getElementById('current-n').value).trim() !== '';

    const errs = {}, list = [];
    const addErr = (id, message) => { if (!errs[id]) { errs[id] = message; list.push(message); } };
    if (N <= 0) addErr('total-n', '请输入计划总样本量 N');
    if (hasCurrentZ && !(currentN > 0)) addErr('current-n', '填写「当前 z 统计量」时需同时填写当前累计样本量 n');
    if (hasCurrentN && currentN > 0 && N > 0 && currentN > N) addErr('current-n', '当前样本量不应超过计划总样本量 N');
    if (list.length) {
        showValidation(errs, list);
        document.getElementById('results').classList.remove('visible');
        return;
    }
    showValidation({}, []);

    const sides = tail === 'two' ? 2 : 1;
    const spendFn = bType === 'obf' ? spendOBF : spendPocock;
    const looks = computeBoundaries(alpha, K, spendFn, tail);
    const currentLook = findCurrentLook(looks, currentN, N);
    const boundary = currentLook ? currentLook.z : looks[K - 1].z;

    let decision = null;
    if (hasCurrentZ && currentLook) {
        decision = Math.abs(currentZ) >= boundary ? 'stop' : 'continue';
    }

    const finalZ = looks[K - 1].z;
    const firstZ = looks[0].z;
    const cards = [
        { label: '最终分析边界 (z)', value: finalZ.toFixed(3), cls: 'good', note: `第 ${K} 次分析（t=1），对应 p<${(sides * (1 - normCDF(finalZ))).toFixed(4)}` },
        { label: '首次分析边界 (z)', value: firstZ.toFixed(3), cls: 'warn', note: `第 1 次分析（t=${(1 / K).toFixed(2)}），需超过此值才能早停` },
        { label: '每次节点样本量', value: Math.round(N / K).toLocaleString(), cls: '', note: `总量 ${N.toLocaleString()} / ${K} 次分析${dailyN > 0 ? '，约 ' + Math.round(N / K / dailyN) + ' 天/次' : ''}` },
    ];
    if (hasCurrentZ && currentLook) {
        cards.push({
            label: '当前决策', value: decision === 'stop' ? '停止' : '继续',
            cls: decision === 'stop' ? 'danger' : 'good',
            note: `|z|=${Math.abs(currentZ).toFixed(3)} ${decision === 'stop' ? '≥' : '<'} 边界 ${boundary.toFixed(3)}`,
        });
    }

    const grid = document.getElementById('summary-grid');
    grid.innerHTML = cards.map(card => `
        <div class="metric-card${card.cls === 'good' || card.cls === 'danger' ? ' highlight' : ''}">
            <div class="metric-label">${card.label}</div>
            <div class="metric-value ${card.cls}">${card.value}</div>
            <div class="metric-note">${card.note}</div>
        </div>`).join('');

    const decisionEl = document.getElementById('decision-banner');
    if (hasCurrentZ && currentLook && decision) {
        decisionEl.className = `decision-banner ${decision}`;
        decisionEl.hidden = false;
        document.getElementById('decision-title').textContent = decision === 'stop'
            ? `建议停止实验（第 ${currentLook.k} 次中期分析）`
            : `继续实验（第 ${currentLook.k} 次中期分析）`;
        document.getElementById('decision-desc').textContent = decision === 'stop'
            ? `当前 |z| = ${Math.abs(currentZ).toFixed(3)} 已超过本次分析边界 ${boundary.toFixed(3)}（累计消费 α = ${(currentLook.cumSpent * 100).toFixed(3)}%），可按预设规则宣告显著并停止实验。`
            : `当前 |z| = ${Math.abs(currentZ).toFixed(3)} 未超过本次分析边界 ${boundary.toFixed(3)}，尚无充分证据停止实验，继续观测至下一节点（第 ${Math.min(currentLook.k + 1, K)} 次分析，n ≈ ${Math.round(N * (Math.min(currentLook.k + 1, K)) / K).toLocaleString()}）。`;
        document.getElementById('decision-icon').textContent = decision === 'stop' ? '🛑' : '▶';
    } else {
        decisionEl.hidden = true;
    }

    const svgEl = document.getElementById('boundary-chart');
    renderBoundaryChart(looks, currentLook, hasCurrentZ ? currentZ : null, tail, N, alpha, svgEl);
    document.getElementById('chart-subtitle').textContent =
        `${bType === 'obf' ? "O'Brien-Fleming" : 'Pocock'} · ${tail === 'two' ? '双侧' : '单侧'} · α=${alpha} · K=${K} 次分析`;

    const hasDays = dailyN > 0;
    document.getElementById('boundary-thead').innerHTML = `<tr>
        <th>分析节点</th><th>信息分数 t</th><th>累计样本量</th>
        ${hasDays ? '<th>约第N天</th>' : ''}
        <th>消费 α (累计)</th><th>本次 Δα</th><th>边界 |z|</th><th>对应 p 值</th>
        ${hasCurrentZ && currentLook ? '<th>当前状态</th>' : ''}
    </tr>`;

    document.getElementById('boundary-tbody').innerHTML = looks.map(lk => {
        const n = Math.round(lk.t * N);
        const days = hasDays ? Math.round(n / dailyN) : null;
        const isCurrent = currentLook && lk.k === currentLook.k;
        const pBoundary = sides * (1 - normCDF(lk.z));
        let statusCell = '', rowClass = '';
        if (hasCurrentZ && currentLook) {
            if (isCurrent) {
                const dec = Math.abs(currentZ) >= lk.z ? 'stop' : 'continue';
                statusCell = `<td class="${dec === 'stop' ? 'cell-stop' : 'cell-continue'}">${dec === 'stop' ? '超过边界' : '未超过边界'}</td>`;
                rowClass = dec === 'stop' ? 'stop-row' : 'highlight-row';
            } else {
                statusCell = '<td class="cell-look">—</td>';
            }
        }
        return `<tr class="${rowClass}">
            <td>第 ${lk.k} 次${lk.k === K ? ' (终)' : ''}</td>
            <td>${lk.t.toFixed(3)}</td>
            <td>${n.toLocaleString()}</td>
            ${hasDays ? `<td>${days}</td>` : ''}
            <td>${(lk.cumSpent * 100).toFixed(4)}%</td>
            <td>${(lk.deltaAlpha * 100).toFixed(4)}%</td>
            <td><strong>${lk.z.toFixed(3)}</strong></td>
            <td>${pBoundary.toFixed(5)}</td>
            ${hasCurrentZ && currentLook ? statusCell : ''}
        </tr>`;
    }).join('');

    const bName = bType === 'obf' ? "O'Brien-Fleming" : 'Pocock';
    const bFormula = bType === 'obf'
        ? `α*(t) = 2 × [1 − Φ(z<sub>α/2</sub> / √t)]，其中 z<sub>α/2</sub> = ${normInv(1 - alpha / 2).toFixed(3)}`
        : `α*(t) = α × ln(1 + (e−1) × t)，其中 α = ${alpha}`;
    document.getElementById('formula-text').innerHTML = `
        <strong>方法：${bName} α 消费函数（Lan-DeMets, 1983）</strong><br>
        <strong>消费函数：</strong>${bFormula}<br>
        <strong>边界计算：</strong>第 k 次分析（t = k/K）消费 Δα<sub>k</sub> = α*(t<sub>k</sub>) − α*(t<sub>k−1</sub>)；边界 z<sub>k</sub> = Φ<sup>−1</sup>(1 − Δα<sub>k</sub>/${tail === 'two' ? '2' : '1'})<br>
        <strong>核心性质：</strong>所有中期分析与最终分析的总 I 类错误率 ≤ α（${(alpha * 100).toFixed(0)}%），无论在哪次分析停止。<br>
        <strong>使用前提：</strong>停止规则须在实验开始前预先注册（prospective）；中途追加分析节点会使保证失效。<br>
        <strong>与固定样本量的差异：</strong>${bType === 'obf' ? "O'Brien-Fleming 最终分析边界接近（略高于）固定样本量检验，检验力损失极小（&lt;1%）。" : 'Pocock 各次分析边界相等，最终分析边界高于固定样本量检验（更保守），需增加总样本量约 10-30% 以补偿。'}`;

    const finalBoundary = looks[K - 1].z;
    const finalP = (sides * (1 - normCDF(finalBoundary))).toFixed(5);
    document.getElementById('interp-text').innerHTML = `
        <strong>如何读边界表</strong><br>
        每行对应一次计划中的分析节点。<strong>边界 |z|</strong> 是该节点的临界值：若当次 z 检验统计量的绝对值 ≥ 该值，则达到早停条件。<br><br>
        <strong>如何读边界图</strong><br>
        蓝色折线是各节点的停止边界。灰色虚线是固定样本量的参考临界值（z=${normInv(1 - alpha / sides).toFixed(2)}，p=${alpha}）。${hasCurrentZ ? '橙色点是当前节点；水平虚线是当前 |z| 值。' : '填写当前 z 统计量后，图中会显示当前位置与边界的对比。'}<br><br>
        <strong>停止与继续的决策逻辑</strong><br>
        • <strong>超过边界</strong>：|z| ≥ 当前节点边界 → 结果显著，可按预设规则宣告有效并停止实验。<br>
        • <strong>未超过边界</strong>：|z| &lt; 当前节点边界 → 证据不足，继续实验，等待下一节点。<br>
        • <strong>走到最终分析（第 ${K} 次）</strong>：若所有中期节点均未超过边界，在最终分析使用最终边界（|z| ≥ ${finalBoundary.toFixed(3)}，即 p ≤ ${finalP}）做结论。`;

    const results = document.getElementById('results');
    results.classList.add('visible');
    const scrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    results.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
    trackEvent('compute');
}

Object.assign(window, { compute });

document.addEventListener('DOMContentLoaded', () => {
    ['total-n', 'current-n'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            document.getElementById(id).classList.remove('input-error');
        });
    });
});
