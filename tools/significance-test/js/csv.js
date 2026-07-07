/** @module csv — parse & samples */

export const SAMPLE_SINGLE = [
    { metric: '列表页点击率', x: 3120, n: 4000, p0: 75 },
    { metric: '详情页转化率', x: 860, n: 2000, p0: 45 },
    { metric: '预订完成率', x: 1505, n: 2500, p0: 60 },
    { metric: '订单支付成功率', x: 2790, n: 3000, p0: 90 },
    { metric: '订后短信打开率', x: 410, n: 1000, p0: 38 },
    { metric: '客服转人工率', x: 180, n: 1500, p0: 15 },
];

export const SAMPLE_TWO = [
    { metric: '首页Banner点击率', x1: 1240, n1: 8000, x2: 1456, n2: 8000 },
    { metric: '搜索结果转化率', x1: 920, n1: 5000, x2: 965, n2: 5000 },
    { metric: '商品加购率', x1: 600, n1: 3000, x2: 660, n2: 3000 },
    { metric: '提交下单率', x1: 450, n1: 3000, x2: 420, n2: 3000 },
    { metric: '30日复购率', x1: 320, n1: 2000, x2: 260, n2: 2000 },
    { metric: '订单退款率', x1: 90, n1: 2000, x2: 140, n2: 2000 },
];

export const CORRECTION_NAMES = {
    none: '不校正',
    bonferroni: 'Bonferroni',
    holm: 'Holm-Bonferroni',
    bh: 'Benjamini-Hochberg (FDR)',
};

export function parseCSV(text, testType) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '');
    if (!lines.length) return [];
    const splitLine = l => l.split(',').map(s => s.trim().replace(/^"(.*)"$/, '$1'));
    const header = splitLine(lines[0]).map(h => h.toLowerCase());
    const alias = {
        metric: ['metric', 'name', '指标', '指标名称', '名称'],
        x: ['x', 'success', 'successes', '成功数', '成功'],
        n: ['n', 'total', '样本量', '总数'],
        p0: ['p0', 'baseline', 'base', '基准', '基准比例'],
        x1: ['x1', 'xa', 'a_x', '成功数a', 'a成功数', '成功数1'],
        n1: ['n1', 'na', 'a_n', '样本量a', 'a样本量', '样本量1'],
        x2: ['x2', 'xb', 'b_x', '成功数b', 'b成功数', '成功数2'],
        n2: ['n2', 'nb', 'b_n', '样本量b', 'b样本量', '样本量2'],
    };
    const findIdx = keys => { for (const k of keys) { const i = header.indexOf(k); if (i !== -1) return i; } return -1; };
    const needed = testType === 'single' ? ['metric', 'x', 'n', 'p0'] : ['metric', 'x1', 'n1', 'x2', 'n2'];
    const idx = {};
    let headerMatched = false;
    needed.forEach(k => { idx[k] = findIdx(alias[k]); if (idx[k] !== -1 && k !== 'metric') headerMatched = true; });
    let dataLines = lines;
    if (headerMatched) dataLines = lines.slice(1);
    else {
        const order = testType === 'single' ? ['metric', 'x', 'n', 'p0'] : ['metric', 'x1', 'n1', 'x2', 'n2'];
        order.forEach((k, i) => { idx[k] = i; });
        const firstCells = splitLine(lines[0]);
        const numKey = testType === 'single' ? idx.x : idx.x1;
        if (firstCells[numKey] !== undefined && isNaN(parseFloat(firstCells[numKey]))) dataLines = lines.slice(1);
    }
    const out = [];
    dataLines.forEach(line => {
        const cells = splitLine(line);
        const obj = {};
        for (const k of needed) {
            const i = idx[k];
            obj[k] = (i !== -1 && cells[i] !== undefined) ? cells[i] : '';
        }
        out.push(obj);
    });
    return out;
}

export function saveCsv(rows, fname) {
    const csvCell = v => {
        const s = String(v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
}
