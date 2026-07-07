import { testSingle, testTwo, adjustPValues, calcOR } from './stats.js';
import { parseCSV, saveCsv, SAMPLE_SINGLE, SAMPLE_TWO, CORRECTION_NAMES } from './csv.js';
import { renderForest, renderTableHTML, renderFormulaHTML, summaryCardsFromResults } from './charts.js';

let testType = 'single';
let lastRun = null;

function getParams() {
    return {
        alpha: parseFloat(document.getElementById('alpha').value) || 0.05,
        tail: document.getElementById('tail').value,
        correction: document.getElementById('correction').value,
        defaultP0: (parseFloat(document.getElementById('default-p0').value) || 0) / 100,
    };
}

function updateParamInfo() {
    const { correction } = getParams();
    let base = testType === 'single'
        ? '单样本检验：将每个指标的观测比例 p̂ = x/n 与基准比例 p₀ 比较。CSV 列：metric, x, n, p0'
        : '双样本检验：比较两组（A/B）独立比例。CSV 列：metric, x1, n1, x2, n2';
    if (correction !== 'none') {
        base += `。已启用 ${CORRECTION_NAMES[correction]} 校正，基于校正后 p 值判定显著性。`;
    }
    document.getElementById('param-info').textContent = base;
    document.getElementById('dz-hint').textContent = testType === 'single'
        ? '列格式：metric, x, n, p0' : '列格式：metric, x1, n1, x2, n2';
}

function renderDataTable() {
    const tbody = document.getElementById('data-tbody');
    const isSingle = testType === 'single';
    document.getElementById('data-thead').innerHTML = isSingle
        ? '<tr><th>指标名称</th><th>成功数 x</th><th>样本量 n</th><th>基准 p₀ (%)</th><th></th></tr>'
        : '<tr><th>指标名称</th><th>x₁</th><th>n₁</th><th>x₂</th><th>n₂</th><th></th></tr>';

    const data = collectRowsFromDOM();
    if (!data.length) data.push(emptyRow());
    tbody.innerHTML = '';
    data.forEach((row, idx) => {
        const tr = document.createElement('tr');
        if (isSingle) {
            tr.innerHTML = `
                <td><input type="text" class="metric-input" data-field="metric" value="${escAttr(row.metric)}" placeholder="指标名称"></td>
                <td><input type="number" data-field="x" value="${escAttr(row.x)}" placeholder="x"></td>
                <td><input type="number" data-field="n" value="${escAttr(row.n)}" placeholder="n"></td>
                <td><input type="number" data-field="p0" value="${escAttr(row.p0)}" placeholder="可选"></td>
                <td><button type="button" class="row-del" onclick="removeRow(${idx})" aria-label="删除行">×</button></td>`;
        } else {
            tr.innerHTML = `
                <td><input type="text" class="metric-input" data-field="metric" value="${escAttr(row.metric)}" placeholder="指标名称"></td>
                <td><input type="number" data-field="x1" value="${escAttr(row.x1)}" placeholder="x₁"></td>
                <td><input type="number" data-field="n1" value="${escAttr(row.n1)}" placeholder="n₁"></td>
                <td><input type="number" data-field="x2" value="${escAttr(row.x2)}" placeholder="x₂"></td>
                <td><input type="number" data-field="n2" value="${escAttr(row.n2)}" placeholder="n₂"></td>
                <td><button type="button" class="row-del" onclick="removeRow(${idx})" aria-label="删除行">×</button></td>`;
        }
        tbody.appendChild(tr);
    });
}

function escAttr(v) {
    return String(v ?? '').replace(/"/g, '&quot;');
}

function emptyRow() {
    return { metric: '', x: '', n: '', p0: '', x1: '', n1: '', x2: '', n2: '' };
}

function collectRowsFromDOM() {
    const rows = [];
    document.querySelectorAll('#data-tbody tr').forEach(tr => {
        const row = emptyRow();
        tr.querySelectorAll('input[data-field]').forEach(inp => {
            row[inp.dataset.field] = inp.value;
        });
        rows.push(row);
    });
    return rows;
}

function switchTest(t) {
    testType = t;
    document.querySelectorAll('.scenario-btn').forEach(btn => {
        const on = btn.dataset.test === t;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const p0Group = document.getElementById('default-p0-group');
    if (p0Group) p0Group.style.display = t === 'single' ? '' : 'none';
    clearRows();
    updateParamInfo();
}

function addRow() {
    const data = collectRowsFromDOM();
    data.push(emptyRow());
    const tbody = document.getElementById('data-tbody');
    const idx = data.length - 1;
    const tr = document.createElement('tr');
    const isSingle = testType === 'single';
    if (isSingle) {
        tr.innerHTML = `<td><input type="text" class="metric-input" data-field="metric" placeholder="指标名称"></td>
            <td><input type="number" data-field="x" placeholder="x"></td>
            <td><input type="number" data-field="n" placeholder="n"></td>
            <td><input type="number" data-field="p0" placeholder="可选"></td>
            <td><button type="button" class="row-del" onclick="removeRow(${idx})" aria-label="删除行">×</button></td>`;
    } else {
        tr.innerHTML = `<td><input type="text" class="metric-input" data-field="metric" placeholder="指标名称"></td>
            <td><input type="number" data-field="x1" placeholder="x₁"></td>
            <td><input type="number" data-field="n1" placeholder="n₁"></td>
            <td><input type="number" data-field="x2" placeholder="x₂"></td>
            <td><input type="number" data-field="n2" placeholder="n₂"></td>
            <td><button type="button" class="row-del" onclick="removeRow(${idx})" aria-label="删除行">×</button></td>`;
    }
    tbody.appendChild(tr);
}

function removeRow(idx) {
    const data = collectRowsFromDOM();
    if (data.length <= 1) return;
    data.splice(idx, 1);
    const tbody = document.getElementById('data-tbody');
    tbody.innerHTML = '';
    data.forEach((row, i) => {
        const tr = document.createElement('tr');
        const isSingle = testType === 'single';
        if (isSingle) {
            tr.innerHTML = `<td><input type="text" class="metric-input" data-field="metric" value="${escAttr(row.metric)}"></td>
                <td><input type="number" data-field="x" value="${escAttr(row.x)}"></td>
                <td><input type="number" data-field="n" value="${escAttr(row.n)}"></td>
                <td><input type="number" data-field="p0" value="${escAttr(row.p0)}"></td>
                <td><button type="button" class="row-del" onclick="removeRow(${i})" aria-label="删除行">×</button></td>`;
        } else {
            tr.innerHTML = `<td><input type="text" class="metric-input" data-field="metric" value="${escAttr(row.metric)}"></td>
                <td><input type="number" data-field="x1" value="${escAttr(row.x1)}"></td>
                <td><input type="number" data-field="n1" value="${escAttr(row.n1)}"></td>
                <td><input type="number" data-field="x2" value="${escAttr(row.x2)}"></td>
                <td><input type="number" data-field="n2" value="${escAttr(row.n2)}"></td>
                <td><button type="button" class="row-del" onclick="removeRow(${i})" aria-label="删除行">×</button></td>`;
        }
        tbody.appendChild(tr);
    });
}

function clearRows() {
    document.getElementById('data-tbody').innerHTML = '';
    renderDataTable();
    document.getElementById('results').classList.remove('visible');
    document.getElementById('csv-status').textContent = '';
    document.getElementById('csv-status').className = 'csv-status';
    document.getElementById('validation-banner').hidden = true;
    lastRun = null;
}

function loadSample() {
    const sample = testType === 'single' ? SAMPLE_SINGLE : SAMPLE_TWO;
    const tbody = document.getElementById('data-tbody');
    tbody.innerHTML = '';
    sample.forEach((d, idx) => {
        const tr = document.createElement('tr');
        if (testType === 'single') {
            tr.innerHTML = `<td><input type="text" class="metric-input" data-field="metric" value="${escAttr(d.metric)}"></td>
                <td><input type="number" data-field="x" value="${d.x}"></td>
                <td><input type="number" data-field="n" value="${d.n}"></td>
                <td><input type="number" data-field="p0" value="${d.p0}"></td>
                <td><button type="button" class="row-del" onclick="removeRow(${idx})" aria-label="删除行">×</button></td>`;
        } else {
            tr.innerHTML = `<td><input type="text" class="metric-input" data-field="metric" value="${escAttr(d.metric)}"></td>
                <td><input type="number" data-field="x1" value="${d.x1}"></td>
                <td><input type="number" data-field="n1" value="${d.n1}"></td>
                <td><input type="number" data-field="x2" value="${d.x2}"></td>
                <td><input type="number" data-field="n2" value="${d.n2}"></td>
                <td><button type="button" class="row-del" onclick="removeRow(${idx})" aria-label="删除行">×</button></td>`;
        }
        tbody.appendChild(tr);
    });
    setCsvStatus(`已加载 ${sample.length} 行示例数据`, 'ok');
    runTest();
}

function setCsvStatus(msg, cls) {
    const el = document.getElementById('csv-status');
    el.textContent = msg;
    el.className = 'csv-status' + (cls ? ' ' + cls : '');
}

function runTest() {
    const { alpha, tail, correction, defaultP0 } = getParams();
    const banner = document.getElementById('validation-banner');
    const dataRows = collectRowsFromDOM().filter(row => {
        if (testType === 'single') return row.x !== '' || row.n !== '';
        return row.x1 !== '' || row.n1 !== '' || row.x2 !== '' || row.n2 !== '';
    });

    if (!dataRows.length) {
        banner.innerHTML = '<div>⚠ 请先录入或导入至少一行有效数据</div>';
        banner.hidden = false;
        return;
    }

    const results = [];
    const list = [];

    for (let i = 0; i < dataRows.length; i++) {
        const r = dataRows[i];
        const metric = (r.metric && r.metric.trim()) || `指标 ${i + 1}`;
        if (testType === 'single') {
            const x = parseFloat(r.x), n = parseFloat(r.n);
            let p0 = r.p0 !== '' && !isNaN(parseFloat(r.p0)) ? parseFloat(r.p0) / 100 : defaultP0;
            if (!(n > 0) || !(x >= 0) || x > n) {
                list.push(`第 ${i + 1} 行（${metric}）的 x/n 无效`);
                continue;
            }
            if (!(p0 > 0 && p0 < 1)) {
                list.push(`第 ${i + 1} 行（${metric}）的基准比例 p₀ 无效`);
                continue;
            }
            results.push({ metric, raw: { x, n }, ...testSingle(x, n, p0, alpha, tail) });
        } else {
            const x1 = parseFloat(r.x1), n1 = parseFloat(r.n1), x2 = parseFloat(r.x2), n2 = parseFloat(r.n2);
            if (!(n1 > 0 && n2 > 0) || !(x1 >= 0 && x2 >= 0) || x1 > n1 || x2 > n2) {
                list.push(`第 ${i + 1} 行（${metric}）的样本数据无效`);
                continue;
            }
            results.push({ metric, raw: { x1, n1, x2, n2 }, ...testTwo(x1, n1, x2, n2, alpha, tail) });
        }
    }

    if (list.length) {
        banner.innerHTML = list.map(m => `<div>⚠ ${m}</div>`).join('');
        banner.hidden = false;
        return;
    }
    banner.hidden = true;

    const pAdj = adjustPValues(results.map(r => r.p), correction);
    const corrected = correction !== 'none';
    results.forEach((r, i) => {
        r.pAdj = pAdj[i];
        r.corrected = corrected;
        r.sig = pAdj[i] < alpha;
    });

    lastRun = { results, alpha, tail, correction, testType };
    renderResults();
    if (typeof gtag !== 'undefined') gtag('event', 'run_test', { event_category: 'significance_test' });
}

function renderResults() {
    if (!lastRun) return;
    const { results, alpha, tail, correction, testType: tt } = lastRun;
    document.getElementById('result-desc').textContent =
        (tt === 'single' ? '单样本' : '双样本') + ` z 比例检验 · ${results.length} 个指标 · 置信度 ${((1 - alpha) * 100).toFixed(0)}%` +
        (correction !== 'none' ? ` · ${CORRECTION_NAMES[correction]} 校正` : '');

    const cards = summaryCardsFromResults(results);
    document.getElementById('summary-grid').innerHTML = cards.map(c => `
        <div class="metric-card${c.cls === 'good' ? ' highlight' : ''}">
            <div class="metric-label">${c.label}</div>
            <div class="metric-value ${c.cls}">${c.raw ? c.value : c.value}</div>
        </div>`).join('');

    document.getElementById('forest').innerHTML = renderForest(results, tt);
    const tbl = renderTableHTML(results, alpha, tail, tt);
    document.getElementById('res-thead').innerHTML = tbl.thead;
    document.getElementById('res-tbody').innerHTML = tbl.tbody;
    document.getElementById('formula').innerHTML = renderFormulaHTML(alpha, tail, tt, correction);

    const resultsEl = document.getElementById('results');
    resultsEl.classList.add('visible');
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    initTableHeaderTooltips();
}

function downloadTemplate() {
    if (testType === 'single') {
        const csv = 'metric,x,n,p0\n' + SAMPLE_SINGLE.map(d => `${d.metric},${d.x},${d.n},${d.p0}`).join('\n') + '\n';
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'significance-single-sample-template.csv';
        a.click();
        URL.revokeObjectURL(url);
    } else {
        const csv = 'metric,x1,n1,x2,n2\n' + SAMPLE_TWO.map(d => `${d.metric},${d.x1},${d.n1},${d.x2},${d.n2}`).join('\n') + '\n';
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'significance-two-sample-template.csv';
        a.click();
        URL.revokeObjectURL(url);
    }
}

function downloadResults() {
    if (!lastRun || !lastRun.results.length) {
        document.getElementById('validation-banner').innerHTML = '<div>⚠ 请先运行检验后再下载结果</div>';
        document.getElementById('validation-banner').hidden = false;
        return;
    }
    const { results, alpha, tail, correction, testType: tt } = lastRun;
    const tailTxt = { two: '双侧', greater: '右侧', less: '左侧' }[tail];
    const ciPct = ((1 - alpha) * 100).toFixed(0);
    const corrected = correction !== 'none';
    const pct = v => (v * 100).toFixed(2) + '%';
    const sigTxt = r => r.sig ? (r.est > 0 ? '显著↑' : '显著↓') : '不显著';
    const fmtPower = v => isFinite(v) ? (v * 100).toFixed(1) + '%' : '—';
    const fmtOR = or => or === null ? '—' : or.toFixed(3);
    const rows = [];
    if (tt === 'single') {
        const head = ['指标', '成功数x', '样本量n', '观测比例p_hat', '基准p0', '差异', `CI下限(${ciPct}%)`, `CI上限(${ciPct}%)`, 'OR', 'z值', 'p值'];
        if (corrected) head.push('校正后p');
        head.push('事后功效', '结论');
        rows.push(head);
        results.forEach(r => {
            const or = calcOR(r.phat, r.p0);
            const row = [r.metric, r.raw.x, r.raw.n, pct(r.phat), pct(r.p0), pct(r.est), pct(r.ciLow), pct(r.ciHigh), fmtOR(or), r.z.toFixed(4), r.p.toExponential(4)];
            if (corrected) row.push(r.pAdj.toExponential(4));
            row.push(fmtPower(r.power), sigTxt(r));
            rows.push(row);
        });
    } else {
        const head = ['指标', 'A成功数x1', 'A样本量n1', 'B成功数x2', 'B样本量n2', 'A比例', 'B比例', '差异(A-B)', `CI下限(${ciPct}%)`, `CI上限(${ciPct}%)`, 'OR(B/A)', 'z值', 'p值'];
        if (corrected) head.push('校正后p');
        head.push('事后功效', '结论');
        rows.push(head);
        results.forEach(r => {
            const or = calcOR(r.p2, r.p1);
            const row = [r.metric, r.raw.x1, r.raw.n1, r.raw.x2, r.raw.n2, pct(r.p1), pct(r.p2), pct(r.est), pct(r.ciLow), pct(r.ciHigh), fmtOR(or), r.z.toFixed(4), r.p.toExponential(4)];
            if (corrected) row.push(r.pAdj.toExponential(4));
            row.push(fmtPower(r.power), sigTxt(r));
            rows.push(row);
        });
    }
    rows.push([]);
    rows.push(['# 检验类型', tt === 'single' ? '单样本z比例检验' : '双样本z比例检验']);
    rows.push(['# 显著性水平α', alpha]);
    rows.push(['# 检验方向', tailTxt]);
    rows.push(['# 多重比较校正', CORRECTION_NAMES[correction]]);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '').replace(/-/g, '');
    saveCsv(rows, `significance-result-${tt}-${stamp}.csv`);
}

function handleCSVImport(text, fname) {
    let parsed;
    try { parsed = parseCSV(text, testType); } catch (e) {
        setCsvStatus('CSV 解析失败：' + e.message, 'err');
        return;
    }
    if (!parsed.length) {
        setCsvStatus('未在文件中找到有效数据行', 'err');
        return;
    }
    const tbody = document.getElementById('data-tbody');
    tbody.innerHTML = '';
    parsed.forEach((d, idx) => {
        const tr = document.createElement('tr');
        if (testType === 'single') {
            tr.innerHTML = `<td><input type="text" class="metric-input" data-field="metric" value="${escAttr(d.metric)}"></td>
                <td><input type="number" data-field="x" value="${escAttr(d.x)}"></td>
                <td><input type="number" data-field="n" value="${escAttr(d.n)}"></td>
                <td><input type="number" data-field="p0" value="${escAttr(d.p0)}"></td>
                <td><button type="button" class="row-del" onclick="removeRow(${idx})" aria-label="删除行">×</button></td>`;
        } else {
            tr.innerHTML = `<td><input type="text" class="metric-input" data-field="metric" value="${escAttr(d.metric)}"></td>
                <td><input type="number" data-field="x1" value="${escAttr(d.x1)}"></td>
                <td><input type="number" data-field="n1" value="${escAttr(d.n1)}"></td>
                <td><input type="number" data-field="x2" value="${escAttr(d.x2)}"></td>
                <td><input type="number" data-field="n2" value="${escAttr(d.n2)}"></td>
                <td><button type="button" class="row-del" onclick="removeRow(${idx})" aria-label="删除行">×</button></td>`;
        }
        tbody.appendChild(tr);
    });
    setCsvStatus(`已从 ${fname || 'CSV'} 导入 ${parsed.length} 行数据`, 'ok');
    runTest();
}

function initTableHeaderTooltips() {
    let tipEl = document.getElementById('float-tip');
    if (!tipEl) {
        tipEl = document.createElement('div');
        tipEl.id = 'float-tip';
        document.body.appendChild(tipEl);
    }
    function showFloatTip(target) {
        const text = target.getAttribute('data-tip');
        if (!text) return;
        tipEl.textContent = text;
        tipEl.style.display = 'block';
        const rect = target.getBoundingClientRect();
        const margin = 12, gap = 8;
        const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
        let left = rect.left + rect.width / 2 - tw / 2;
        let top = rect.bottom + gap;
        if (left < margin) left = margin;
        if (left + tw > window.innerWidth - margin) left = window.innerWidth - tw - margin;
        if (top + th > window.innerHeight - margin) top = rect.top - th - gap;
        tipEl.style.left = left + 'px';
        tipEl.style.top = top + 'px';
    }
    function hideFloatTip() { tipEl.style.display = 'none'; }
    if (!initTableHeaderTooltips._bound) {
        document.addEventListener('mouseover', e => {
            const t = e.target.closest('.results-table th .tooltip');
            if (t) showFloatTip(t);
        });
        document.addEventListener('mouseout', e => {
            const t = e.target.closest('.results-table th .tooltip');
            if (t && !t.contains(e.relatedTarget)) hideFloatTip();
        });
        window.addEventListener('scroll', hideFloatTip, true);
        window.addEventListener('resize', hideFloatTip);
        initTableHeaderTooltips._bound = true;
    }
}

function setupDropzone() {
    const dz = document.getElementById('csv-dropzone');
    const fileInput = document.getElementById('csv-file');
    dz.addEventListener('click', () => fileInput.click());
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
        e.preventDefault();
        dz.classList.remove('dragover');
        const f = e.dataTransfer.files[0];
        if (f) readFile(f);
    });
    fileInput.addEventListener('change', e => {
        if (e.target.files[0]) readFile(e.target.files[0]);
        e.target.value = '';
    });
}

function readFile(file) {
    if (!/\.csv$/i.test(file.name)) {
        setCsvStatus('请选择 .csv 文件', 'err');
        return;
    }
    const reader = new FileReader();
    reader.onload = e => handleCSVImport(e.target.result, file.name);
    reader.onerror = () => setCsvStatus('文件读取失败', 'err');
    reader.readAsText(file, 'UTF-8');
}

Object.assign(window, {
    switchTest, addRow, removeRow, clearRows, loadSample, runTest,
    downloadTemplate, downloadResults,
});

document.addEventListener('DOMContentLoaded', () => {
    renderDataTable();
    updateParamInfo();
    setupDropzone();
    document.getElementById('correction').addEventListener('change', updateParamInfo);
});
