/**
 * PaymentModule — Tính lương per-worker qua modal
 */
const PaymentModule = (() => {
    const RESULTS_KEY = 'tc_pay_results';
    const CFG_KEY = 'tc_pay_cfg';
    const $ = id => document.getElementById(id);

    /* ── Confirm helper ── */
    let _pcmEl, _pcmInstance;
    function payConfirm({ icon, title, msg, okLabel, okClass, onOk }) {
        if (!_pcmEl) {
            _pcmEl = $('pay-confirm-modal');
            _pcmInstance = new bootstrap.Modal(_pcmEl);
        }
        $('pcm-icon').textContent = icon;
        $('pcm-title').textContent = title;
        $('pcm-msg').textContent = msg;
        const okBtn = $('pcm-ok');
        okBtn.className = `btn px-4 fw-semibold ${okClass}`;
        okBtn.textContent = okLabel;
        const handler = () => { _pcmInstance.hide(); onOk(); };
        okBtn.replaceWith(okBtn.cloneNode(true));   // strip old listeners
        $('pcm-ok').addEventListener('click', handler, { once: true });
        _pcmInstance.show();
    }

    let currentYear = new Date().getFullYear();
    let results = [];          // [{workerId, year, ...}]
    let editingIdx = null;     // index đang sửa

    // Config kỳ mặc định (lưu để nhớ)
    let periodCfg = {
        p1: { months: [1, 2, 3, 4, 5, 6, 7, 8, 9], rate: 400000 },
        p2: { months: [10, 11, 12], rate: 420000 },
    };

    /* ─────────────── INIT ─────────────── */
    function init() {
        // Load saved
        try { const s = JSON.parse(localStorage.getItem(CFG_KEY)); if (s) periodCfg = s; } catch { }
        try { results = JSON.parse(localStorage.getItem(RESULTS_KEY)) || []; } catch { }

        $('pay-year').value = currentYear;
        $('pay-year').addEventListener('change', e => {
            currentYear = parseInt(e.target.value) || new Date().getFullYear();
            renderTable();
        });

        $('pay-btn-open').addEventListener('click', () => openModal(null));
        $('pay-btn-print').addEventListener('click', () => window.print());
        $('pay-btn-clear').addEventListener('click', clearResults);

        // Modal: worker dropdown → reload days when changed
        $('modal-worker').addEventListener('change', recalcModal);

        // Rate inputs → recalc on input
        ['modal-rate1', 'modal-rate2'].forEach(id => {
            $(id).addEventListener('input', recalcModal);
        });

        // Modal save — qua confirm trước
        $('modal-btn-save').addEventListener('click', () => {
            const wid = $('modal-worker').value;
            if (!wid) { alert('Vui lòng chọn công nhân!'); return; }
            const workers = StorageManager.getWorkers();
            const w = workers.find(x => x.id === wid);
            const isEdit = editingIdx !== null;
            payConfirm({
                icon: isEdit ? '💾' : '✅',
                title: isEdit ? 'Cập nhật lương' : 'Lưu vào bảng',
                msg: `Xác nhận ${isEdit ? 'cập nhật' : 'lưu'} lương cho ${w ? w.hoTen : wid}?`,
                okLabel: isEdit ? 'Cập nhật' : 'Lưu',
                okClass: 'btn-primary',
                onOk: saveFromModal,
            });
        });

        // Search input
        const searchEl = $('pay-search');
        if (searchEl) searchEl.addEventListener('input', renderTable);

        // Populate worker dropdown
        populateWorkerSelect();
        // Render existing results
        renderTable();
    }

    /* ─────────────── WORKER DROPDOWN ─────────────── */
    function populateWorkerSelect() {
        const workers = StorageManager.getWorkers().filter(w => w.trangThai === 'active');
        const sel = $('modal-worker');
        sel.innerHTML = '<option value="">-- Chọn công nhân --</option>';
        workers.forEach(w => {
            sel.innerHTML += `<option value="${w.id}">${w.hoTen} (${w.id})</option>`;
        });
    }

    /* ─────────────── OPEN MODAL ─────────────── */
    function openModal(idx) {
        editingIdx = idx;
        populateWorkerSelect();

        if (idx !== null && results[idx]) {
            // Editing existing
            const r = results[idx];
            $('modal-worker').value = r.workerId;
            $('modal-year').value = r.year;
            periodCfg.p1.months = r.p1months; periodCfg.p1.rate = r.p1rate;
            periodCfg.p2.months = r.p2months; periodCfg.p2.rate = r.p2rate;
        } else {
            $('modal-worker').value = '';
            $('modal-year').value = currentYear;
        }

        renderModalChips(1);
        renderModalChips(2);
        $('modal-rate1').value = periodCfg.p1.rate.toLocaleString('vi-VN');
        $('modal-rate2').value = periodCfg.p2.rate.toLocaleString('vi-VN');
        recalcModal();

        bootstrap.Modal.getOrCreateInstance($('payModal')).show();
    }

    /* ─────────────── MONTH CHIPS IN MODAL ─────────────── */
    function renderModalChips(period) {
        const wrap = $(`modal-chips-p${period}`);
        const selected = period === 1 ? periodCfg.p1.months : periodCfg.p2.months;
        wrap.innerHTML = '';
        for (let m = 1; m <= 12; m++) {
            const chip = document.createElement('span');
            chip.className = 'month-chip' + (selected.includes(m) ? ' active' : '');
            chip.dataset.m = m;

            const label = document.createElement('span');
            label.textContent = 'Th.' + m;

            const daysEl = document.createElement('span');
            daysEl.className = 'chip-days';
            daysEl.id = `chip-d${period}-m${m}`;

            chip.appendChild(label);
            chip.appendChild(daysEl);

            chip.addEventListener('click', () => {
                const arr = period === 1 ? periodCfg.p1.months : periodCfg.p2.months;
                const otherArr = period === 1 ? periodCfg.p2.months : periodCfg.p1.months;
                const i = arr.indexOf(m);
                if (i >= 0) {
                    // Bỏ tích
                    arr.splice(i, 1);
                    chip.classList.remove('active');
                } else {
                    // Tick vào kỳ này
                    arr.push(m);
                    arr.sort((a, b) => a - b);
                    chip.classList.add('active');
                    // Tự động bỏ khỏi kỳ kia nếu có
                    const j = otherArr.indexOf(m);
                    if (j >= 0) {
                        otherArr.splice(j, 1);
                        // Re-render chips của kỳ kia để cập nhật UI
                        renderModalChips(period === 1 ? 2 : 1);
                    }
                }
                recalcModal();
            });
            wrap.appendChild(chip);
        }
    }

    /* ─────────────── RECALC MODAL PREVIEW ─────────────── */
    function recalcModal() {
        const wid = $('modal-worker').value;
        const year = parseInt($('modal-year').value) || currentYear;
        periodCfg.p1.rate = parseNum($('modal-rate1').value);
        periodCfg.p2.rate = parseNum($('modal-rate2').value);

        let days1 = 0, days2 = 0;

        // Update each chip's day count label
        for (let m = 1; m <= 12; m++) {
            const d = wid ? StorageManager.getWorkerMonthTotal(wid, year, m) : 0;
            const e1 = $(`chip-d1-m${m}`), e2 = $(`chip-d2-m${m}`);
            const tag = d > 0 ? fmtDay(d) : '';
            if (e1) e1.textContent = tag;
            if (e2) e2.textContent = tag;
            if (periodCfg.p1.months.includes(m)) days1 += d;
            if (periodCfg.p2.months.includes(m)) days2 += d;
        }

        const sal1 = days1 * periodCfg.p1.rate;
        const sal2 = days2 * periodCfg.p2.rate;
        const total = sal1 + sal2;

        const adv = StorageManager.getAdvances()
            .filter(a => a.workerId === wid && a.date && a.date.startsWith(year + '-'))
            .reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

        const net = total - adv;

        setText('modal-days1', fmtDay(days1) + ' công');
        setText('modal-money1', fmtVnd(sal1));
        setText('modal-days2', fmtDay(days2) + ' công');
        setText('modal-money2', fmtVnd(sal2));
        setText('modal-total', fmtVnd(total));
        setText('modal-adv', adv > 0 ? fmtVnd(adv) : '—');
        setText('modal-net', fmtVnd(net));
        setText('modal-net-words', numToWords(Math.round(net)));
        $('modal-net').className = 'fw-bold fs-5 ' + (net >= 0 ? 'text-success' : 'text-danger');

        // Ẩn kỳ kia nếu 1 kỳ đã chiếm hết 12 tháng
        const row1 = $('period-row-1'), row2 = $('period-row-2');
        if (row1 && row2) {
            const p1Full = periodCfg.p1.months.length === 12;
            const p2Full = periodCfg.p2.months.length === 12;
            row2.style.display = p1Full ? 'none' : '';
            row1.style.display = p2Full ? 'none' : '';
        }

        saveCfg();
    }

    /* ─────────────── SAVE RESULT ─────────────── */
    function saveFromModal() {
        const wid = $('modal-worker').value;
        const year = parseInt($('modal-year').value) || currentYear;
        if (!wid) { alert('Vui lòng chọn công nhân!'); return; }

        // ── Kiểm tra trùng: cùng người + cùng năm ──
        const dupIdx = results.findIndex(
            (r, i) => r.workerId === wid && r.year === year && i !== editingIdx
        );

        const workers = StorageManager.getWorkers();
        const worker = workers.find(w => w.id === wid);

        const doSave = () => {
            let days1 = 0, days2 = 0;
            periodCfg.p1.months.forEach(m => { days1 += StorageManager.getWorkerMonthTotal(wid, year, m); });
            periodCfg.p2.months.forEach(m => { days2 += StorageManager.getWorkerMonthTotal(wid, year, m); });

            const sal1 = days1 * periodCfg.p1.rate;
            const sal2 = days2 * periodCfg.p2.rate;
            const total = sal1 + sal2;
            const adv = StorageManager.getAdvances()
                .filter(a => a.workerId === wid && a.date && a.date.startsWith(year + '-'))
                .reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

            const entry = {
                workerId: wid, workerName: worker ? worker.hoTen : wid,
                workerDept: worker ? (worker.phongBan || '—') : '—',
                year,
                p1months: [...periodCfg.p1.months], p1rate: periodCfg.p1.rate,
                p2months: [...periodCfg.p2.months], p2rate: periodCfg.p2.rate,
                days1, days2, sal1, sal2, total, adv, net: total - adv,
                savedAt: Date.now(),
            };

            const targetIdx = editingIdx !== null ? editingIdx : (dupIdx >= 0 ? dupIdx : null);
            if (targetIdx !== null) results[targetIdx] = entry;
            else results.push(entry);

            localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
            bootstrap.Modal.getInstance($('payModal')).hide();
            renderTable();
        };

        doSave();
    }

    /* ─────────────── RENDER TABLE ─────────────── */
    function renderTable() {
        $('pay-year-label').textContent = `Năm ${currentYear}`;

        const term = ($('pay-search')?.value || '').toLowerCase().trim();
        let yearRows = results.filter(r => r.year === currentYear);

        if (term) {
            yearRows = yearRows.filter(r =>
                r.workerName.toLowerCase().includes(term) ||
                r.workerId.toLowerCase().includes(term)
            );
        }

        if (!yearRows.length) {
            const isEmptySearch = term !== '';
            $('pay-tbody').innerHTML = `<tr><td colspan="8" class="text-center text-muted py-5">
                <i class="bi ${isEmptySearch ? 'bi-search' : 'bi-wallet2'} d-block fs-2 mb-2 text-muted opacity-50"></i>
                <div class="${isEmptySearch ? 'text-muted' : ''}">
                    ${isEmptySearch ? `Không tìm thấy kết quả cho "${term}"` : 'Nhấn <strong>Tính lương</strong> để thêm dữ liệu'}
                </div>
            </td></tr>`;
            $('pay-summary').innerHTML = '';
            return;
        }

        let grandTotal = 0, grandAdv = 0, grandNet = 0;
        let html = '';

        yearRows.forEach((r, i) => {
            const realIdx = results.indexOf(r);
            grandTotal += r.total; grandAdv += r.adv; grandNet += r.net;
            const netCls = r.net >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold';

            const p1Label = r.p1months.map(m => 'Th.' + m).join(', ') || '—';
            const p2Label = r.p2months.map(m => 'Th.' + m).join(', ') || '—';

            html += `<tr>
                <td class="text-center text-muted">${i + 1}</td>
                <td>
                    <div class="fw-bold">${r.workerName}</div>
                    <div class="text-muted" style="font-size:.73rem">${r.workerId} · ${r.workerDept}</div>
                </td>
                <td>
                    <div class="small text-muted mb-1">${p1Label}</div>
                    <div>${fmtDay(r.days1)} công × ${fmtVnd(r.p1rate)}</div>
                    <div class="fw-semibold" style="color:#059669">${fmtVnd(r.sal1)}</div>
                </td>
                <td>
                    <div class="small text-muted mb-1">${p2Label}</div>
                    <div>${fmtDay(r.days2)} công × ${fmtVnd(r.p2rate)}</div>
                    <div class="fw-semibold" style="color:#3b82f6">${fmtVnd(r.sal2)}</div>
                </td>
                <td class="text-end fw-semibold">${fmtVnd(r.total)}</td>
                <td class="text-end text-danger">${r.adv > 0 ? fmtVnd(r.adv) : '—'}</td>
                <td class="text-end ${netCls}">${fmtVnd(r.net)}</td>
                <td class="text-center no-print">
                    <div class="d-flex gap-1 justify-content-center">
                        <button class="btn-action-lux edit" onclick="PaymentModule.edit(${realIdx})" title="Sửa"><i class="bi bi-pencil-fill"></i></button>
                        <button class="btn-action-lux" style="background:rgba(6,95,70,.12);color:#059669;border:1px solid rgba(6,95,70,.2)" onclick="PaymentModule.printSlip(${realIdx})" title="In phiếu lương"><i class="bi bi-printer-fill"></i></button>
                        <button class="btn-action-lux delete" onclick="PaymentModule.del(${realIdx})" title="Xóa"><i class="bi bi-trash-fill"></i></button>
                    </div>
                </td>
            </tr>`;
        });

        html += `<tr class="table-dark fw-bold">
            <td colspan="2" class="text-center">TỔNG CỘNG</td>
            <td colspan="2"></td>
            <td class="text-end">${fmtVnd(grandTotal)}</td>
            <td class="text-end text-warning">${fmtVnd(grandAdv)}</td>
            <td class="text-end text-success">${fmtVnd(grandNet)}</td>
            <td></td>
        </tr>`;

        $('pay-tbody').innerHTML = html;

        $('pay-summary').innerHTML = `<div class="d-flex gap-2 flex-wrap mb-3">
            <span class="badge rounded-pill px-3 py-2" style="background:#ecfdf5;color:#065f46">
                <i class="bi bi-people-fill me-1"></i>${yearRows.length} người
            </span>
            <span class="badge rounded-pill px-3 py-2" style="background:#eff6ff;color:#1e40af">
                <i class="bi bi-cash me-1"></i>Tổng thực chi: ${fmtVnd(grandTotal)}
            </span>
            <span class="badge rounded-pill px-3 py-2" style="background:#fef2f2;color:#991b1b">
                <i class="bi bi-arrow-down-circle me-1"></i>Ứng: ${fmtVnd(grandAdv)}
            </span>
            <span class="badge rounded-pill px-3 py-2 fw-bold" style="background:#f0fdf4;color:#166534;font-size:.85rem">
                <i class="bi bi-wallet2 me-1"></i>Còn lại: ${fmtVnd(grandNet)}
            </span>
        </div>`;
    }

    /* ─────────────── ACTIONS ─────────────── */
    function edit(idx) { openModal(idx); }

    function del(idx) {
        const r = results[idx];
        if (!r) return;
        payConfirm({
            icon: '🗑️',
            title: 'Xóa kết quả',
            msg: `Xóa lương của ${r.workerName} (${r.year})?`,
            okLabel: 'Xóa',
            okClass: 'btn-danger',
            onOk: () => {
                results.splice(idx, 1);
                localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
                renderTable();
            },
        });
    }

    function clearResults() {
        payConfirm({
            icon: '⚠️',
            title: 'Xóa toàn bộ',
            msg: 'Xóa toàn bộ kết quả tính lương? Không thể hoàn tác!',
            okLabel: 'Xóa tất cả',
            okClass: 'btn-danger',
            onOk: () => {
                results = [];
                localStorage.removeItem(RESULTS_KEY);
                renderTable();
            },
        });
    }

    /* ─────────────── PRINT SLIP ─────────────── */
    function printSlip(idx) {
        const r = results[idx];
        if (!r) return;

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        const setHtml = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };

        // Header
        set('slip-period-label', `Năm ${r.year}`);
        set('slip-date', new Date().toLocaleDateString('vi-VN'));
        set('slip-worker-name', r.workerName);
        set('slip-worker-meta', `Mã: ${r.workerId}  ·  Bộ phận: ${r.workerDept}`);

        // Người lập phiếu — lấy từ session đăng nhập
        const session = typeof authGetSession === 'function' ? authGetSession() : null;
        set('slip-creator-name', session ? session.username : '');

        // Period 1 chips
        const makeChips = (months, allDays, colorClass) => {
            let html = '';
            for (let m = 1; m <= 12; m++) {
                const active = months.includes(m);
                const d = allDays[m] || 0;
                const cls = active ? `slip-chip active ${colorClass}` : 'slip-chip inactive';
                html += `<span class="${cls}"><span>Th.${m}</span>${d > 0 ? `<span class="sc-days">${fmtDay(d)}</span>` : '<span class="sc-days" style="min-height:.75rem"></span>'}</span>`;
            }
            return html;
        };

        // Per-month days lookup
        const monthDays = {};
        for (let m = 1; m <= 12; m++) {
            monthDays[m] = StorageManager.getWorkerMonthTotal(r.workerId, r.year, m);
        }

        setHtml('slip-chips-p1', makeChips(r.p1months, monthDays, 'p1'));
        setHtml('slip-chips-p2', makeChips(r.p2months, monthDays, 'p2'));

        // Period results
        set('slip-p1-result', `${fmtDay(r.days1)} công × ${fmtVnd(r.p1rate)} = ${fmtVnd(r.sal1)}`);
        set('slip-p2-result', `${fmtDay(r.days2)} công × ${fmtVnd(r.p2rate)} = ${fmtVnd(r.sal2)}`);

        // Hide empty period rows
        const p2Wrap = document.getElementById('slip-p2-wrap');
        if (p2Wrap) p2Wrap.style.display = r.p2months.length === 0 ? 'none' : '';

        // Summary
        set('slip-total', fmtVnd(r.total));
        set('slip-adv', r.adv > 0 ? fmtVnd(r.adv) : '—');
        set('slip-net', fmtVnd(r.net));
        set('slip-words', numToWords(Math.round(r.net)));

        // Print
        document.body.classList.add('printing-slip');
        window.print();
        window.addEventListener('afterprint', () => {
            document.body.classList.remove('printing-slip');
        }, { once: true });
    }

    /* ───────────────── HELPERS ───────────────── */
    function saveCfg() { localStorage.setItem(CFG_KEY, JSON.stringify(periodCfg)); }
    function parseNum(str) { return parseFloat((str + '').replace(/[.,]/g, '')) || 0; }
    function fmtDay(d) { return d > 0 ? (Number.isInteger(d) ? d : d.toFixed(1)) : '0'; }
    function fmtVnd(n) { return (n || 0).toLocaleString('vi-VN') + ' đ'; }
    function setText(id, v) { const el = $(id); if (el) el.textContent = v; }

    /* ─ Đọc tiền bằng chữ tiếng Việt ─ */
    function numToWords(n) {
        if (!n || n === 0) return 'Không đồng';
        if (n < 0) return 'Âm ' + numToWords(-n);

        const u = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

        function readGroup(n, leading) {
            const h = Math.floor(n / 100);
            const t = Math.floor((n % 100) / 10);
            const o = n % 10;
            let s = '';
            if (h) s += u[h] + ' trăm';
            else if (!leading && (t || o)) s += 'không trăm';

            if (t === 0 && o && s) { s += ' linh'; }
            else if (t === 1) { s += (s ? ' ' : '') + 'mười'; }
            else if (t > 1) { s += (s ? ' ' : '') + u[t] + ' mươi'; }

            if (o) {
                const sep = s ? ' ' : '';
                if (t === 0) s += sep + u[o];
                else if (o === 1) s += sep + 'mốt';
                else if (o === 5) s += sep + 'lăm';
                else s += sep + u[o];
            }
            return s.trim();
        }

        const ty = Math.floor(n / 1e9);
        const tr = Math.floor((n % 1e9) / 1e6);
        const ngh = Math.floor((n % 1e6) / 1e3);
        const rem = n % 1e3;

        const parts = [];
        let leading = true;
        if (ty) { parts.push(readGroup(ty, leading) + ' tỷ'); leading = false; }
        if (tr) { parts.push(readGroup(tr, leading) + ' triệu'); leading = false; }
        if (ngh) { parts.push(readGroup(ngh, leading) + ' nghìn'); leading = false; }
        if (rem) { parts.push(readGroup(rem, leading)); }

        const result = parts.join(' ');
        return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
    }

    return { init, edit, del, printSlip };
})();
