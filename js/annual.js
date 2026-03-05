/**
 * AnnualModule - Tổng hợp Công theo Năm
 */
const AnnualModule = (() => {
    let currentYear = new Date().getFullYear();
    let chart = null;
    const MONTHS = ['Th.1', 'Th.2', 'Th.3', 'Th.4', 'Th.5', 'Th.6', 'Th.7', 'Th.8', 'Th.9', 'Th.10', 'Th.11', 'Th.12'];

    const $ = id => document.getElementById(id);

    function init() {
        $('ann-year').value = currentYear;
        $('ann-year').addEventListener('change', e => {
            currentYear = parseInt(e.target.value);
            render();
        });
        render();
    }

    function render() {
        const workers = StorageManager.getWorkers().filter(w => w.trangThai === 'active');
        if (!workers.length) {
            $('ann-tbody').innerHTML = `<tr><td colspan="15" class="text-center text-muted py-4">Không có công nhân nào</td></tr>`;
            return;
        }

        // Build data matrix: workerData[wId][month] = total
        const matrix = {};
        workers.forEach(w => { matrix[w.id] = {}; });

        for (let m = 1; m <= 12; m++) {
            const md = StorageManager.getMonthAttendance(currentYear, m);
            workers.forEach(w => {
                const wd = md[w.id] || {};
                let t = 0;
                Object.values(wd).forEach(v => { t += parseFloat(v) || 0; });
                matrix[w.id][m] = t;
            });
        }

        // Render table
        const tbody = $('ann-tbody');
        const rows = workers.map((w, i) => {
            const rowTotals = matrix[w.id];
            const yearTotal = Object.values(rowTotals).reduce((s, v) => s + v, 0);
            const cells = MONTHS.map((_, mi) => {
                const m = mi + 1;
                const v = rowTotals[m];
                return `<td class="text-center ${monthCellClass(v, currentYear, m)}">${v > 0 ? fmt(v) : ''}</td>`;
            }).join('');
            return `<tr>
        <td class="text-center text-muted" style="font-size:.8rem">${i + 1}</td>
        <td><span class="fw-semibold text-primary" style="font-size:.8rem">${w.id}</span> <span class="fw-semibold">${w.hoTen}</span></td>
        ${cells}
        <td class="text-center yc-total">${fmt(yearTotal)}</td>
      </tr>`;
        });
        tbody.innerHTML = rows.join('');

        // Render stats and top 3
        renderStats(workers, matrix);
    }

    function renderStats(workers, matrix) {
        let grandTotal = 0;
        let workerTotals = [];

        workers.forEach(w => {
            const t = Object.values(matrix[w.id]).reduce((s, v) => s + v, 0);
            grandTotal += t;
            workerTotals.push({ worker: w, total: t });
        });

        // Top 3
        workerTotals.sort((a, b) => b.total - a.total);
        const top3 = workerTotals.slice(0, 3).filter(item => item.total > 0);

        const top3Html = top3.map((item, idx) => {
            const medals = ['🥇', '🥈', '🥉'];
            const medal = medals[idx] || '';
            const color = idx === 0 ? '#b45309' : (idx === 1 ? '#475569' : '#b45309');
            const bg = idx === 0 ? '#fef3c7' : (idx === 1 ? '#f1f5f9' : '#ffedd5');
            return `
            <div class="d-flex align-items-center justify-content-between p-2 rounded" style="background:${bg}; border: 1px solid rgba(0,0,0,0.05)">
                <div class="d-flex align-items-center gap-3">
                    <span class="fs-4 drop-shadow-sm">${medal}</span>
                    <div>
                        <div class="fw-bold text-dark" style="font-size:.95rem">${item.worker.hoTen}</div>
                        <div class="text-muted" style="font-size:.75rem">${item.worker.phongBan || '—'}</div>
                    </div>
                </div>
                <div class="fw-bold" style="color:${color}; font-size:1.1rem">${fmt(item.total)} <span class="fw-normal" style="font-size:.75rem;opacity:.7">công</span></div>
            </div>`;
        }).join('');

        const listEl = $('ann-top3-list');
        if (listEl) {
            listEl.innerHTML = top3.length ? top3Html : '<div class="text-muted small py-2 text-center">Chưa có dữ liệu</div>';
        }

        // Top 3 Advances
        const advYearEl = $('ann-adv-year');
        if (advYearEl) advYearEl.textContent = currentYear;

        const advances = typeof StorageManager.getAdvances === 'function' ? StorageManager.getAdvances() : [];
        const yearAdvances = advances.filter(a => a.date && a.date.startsWith(currentYear + '-'));

        const advTotals = {};
        yearAdvances.forEach(a => {
            advTotals[a.workerId] = (advTotals[a.workerId] || 0) + (parseFloat(a.amount) || 0);
        });

        const advList = Object.keys(advTotals).map(wId => {
            const w = workers.find(x => x.id === wId);
            return { worker: w || { hoTen: 'Công nhân đã xóa', phongBan: '' }, total: advTotals[wId] };
        });

        advList.sort((a, b) => b.total - a.total);
        const top3Adv = advList.slice(0, 3).filter(item => item.total > 0);

        const advHtml = top3Adv.map((item, idx) => {
            const medals = ['🔥', '⚡', '💸'];
            const medal = medals[idx] || '';
            const bg = idx === 0 ? '#fee2e2' : (idx === 1 ? '#fef2f2' : '#fff5f5');
            return `
            <div class="d-flex align-items-center justify-content-between p-2 rounded" style="background:${bg}; border: 1px solid rgba(0,0,0,0.05)">
                <div class="d-flex align-items-center gap-3">
                    <span class="fs-4 drop-shadow-sm">${medal}</span>
                    <div>
                        <div class="fw-bold text-dark" style="font-size:.95rem">${item.worker.hoTen}</div>
                        <div class="text-muted" style="font-size:.75rem">${item.worker.phongBan || '—'}</div>
                    </div>
                </div>
                <div class="fw-bold text-danger" style="font-size:1.1rem">${item.total.toLocaleString('vi-VN')} <span class="fw-normal" style="font-size:.75rem;opacity:.7">đ</span></div>
            </div>`;
        }).join('');

        const advListEl = $('ann-top3-adv-list');
        if (advListEl) {
            advListEl.innerHTML = top3Adv.length ? advHtml : '<div class="text-muted small py-2 text-center">Chưa có ứng tiền trong năm này</div>';
        }
    }

    function monthCellClass(val, year, month) {
        const maxDays = new Date(year, month, 0).getDate();
        if (!val) return 'yc-zero';
        const ratio = val / maxDays;
        if (ratio >= .9) return 'yc-high';
        if (ratio >= .6) return 'yc-mid';
        return 'yc-low';
    }

    function fmt(n) {
        return Number.isInteger(n) ? n : parseFloat(n.toFixed(1));
    }

    function shortName(fullName) {
        const parts = fullName.trim().split(' ');
        if (parts.length <= 1) return fullName;
        return parts[parts.length - 1]; // last name for chart label
    }

    return { init, render };
})();
