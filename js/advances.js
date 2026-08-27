/**
 * AdvancesModule - Quản lý Ứng Tiền
 */
const AdvancesModule = (() => {
    let advances = [];
    let workers = [];      // chỉ active (dùng cho dropdown thêm mới)
    let allWorkers = [];   // tất cả (dùng để resolve tên trong bảng)
    let editingId = null;
    let searchQuery = '';
    let filterYear = new Date().getFullYear();

    /* ---- DOM refs ---- */
    const $ = id => document.getElementById(id);

    function init() {
        advances = StorageManager.getAdvances();
        allWorkers = StorageManager.getWorkers();                              // tất cả NV kể cả nghỉ việc
        workers = allWorkers.filter(w => w.trangThai === 'active');            // chỉ active cho dropdown
        if ($('adv-year-filter')) $('adv-year-filter').value = filterYear;
        renderTable();
        bindEvents();
        populateWorkerSelect();
    }

    /* ---- Render ---- */
    function renderTable() {
        const tbody = $('adv-tbody');
        const mobileList = $('adv-mobile-list');

        let filtered = advances.filter(a => {
            const w = allWorkers.find(x => x.id === a.workerId); // dùng allWorkers để ko bỏ sót người nghỉ việc
            const wName = w ? w.hoTen : 'Không rõ';

            const q = searchQuery.toLowerCase();
            const yearMatch = new Date(a.date).getFullYear() === parseInt(filterYear);
            const textMatch = wName.toLowerCase().includes(q) ||
                (a.note || '').toLowerCase().includes(q) ||
                a.workerId.toLowerCase().includes(q);

            return yearMatch && textMatch;
        });


        // Sắp xếp theo ngày ứng (mới nhất lên đầu)
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Tính tổng tiền báo cáo
        const totalAmount = filtered.reduce((sum, a) => sum + (a.amount || 0), 0);
        if ($('adv-total-amount')) {
            $('adv-total-amount').textContent = formatCurrency(totalAmount) + ' VNĐ';
        }

        if (!filtered.length) {
            const emptyHtml = `<div class="text-center text-muted py-5"><i class="bi bi-inbox fs-1 d-block mb-2 opacity-50"></i>Không có phiếu ứng nào trong năm ${filterYear}</div>`;
            tbody.innerHTML = `<tr><td colspan="7">${emptyHtml}</td></tr>`;
            if (mobileList) mobileList.innerHTML = emptyHtml;
            return;
        }

        tbody.innerHTML = filtered.map((a, i) => {
            const w = allWorkers.find(x => x.id === a.workerId);
            const isInactive = w && w.trangThai !== 'active';
            const isDeleted = !w;
            let wName;
            if (isDeleted) {
                wName = `<span class="text-danger">Không rõ (${a.workerId})</span>`;
            } else if (isInactive) {
                wName = `${w.hoTen} <span class="badge text-bg-secondary ms-1" style="font-size:.7rem;font-weight:500">Nghỉ việc</span>`;
            } else {
                wName = w.hoTen;
            }
            const amountWords = a.amount > 0 ? numberToWords(a.amount) + ' đồng' : '';

            return `
            <tr>
                <td class="text-center text-muted" style="font-size:.8rem">${i + 1}</td>
                <td>
                    <span class="worker-id-badge" style="background:var(--primary-light);color:var(--primary-dark)">${a.workerId}</span>
                    <span class="fw-semibold ms-2" style="font-size:.9rem">${wName}</span>
                </td>
                <td class="text-muted">${formatDate(a.date)}</td>
                <td class="text-end fw-bold" style="color:#b45309;font-size:1.05rem">${formatCurrency(a.amount)}</td>
                <td class="text-muted fst-italic" style="font-size:.85rem;">${amountWords}</td>
                <td class="text-muted" style="font-size:.85rem;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${a.note || ''}">${a.note || '—'}</td>
                <td class="d-flex text-end">
                    <button class="btn-action-lux edit" onclick="AdvancesModule.openEdit('${a.id}')" title="Sửa"><i class="bi bi-pencil"></i></button>
                    <button class="btn-action-lux delete ms-1" onclick="AdvancesModule.confirmDelete('${a.id}')" title="Xóa"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
        }).join('');

        if (mobileList) {
            mobileList.innerHTML = filtered.map((a, i) => {
                const w = allWorkers.find(x => x.id === a.workerId);
                const isInactive = w && w.trangThai !== 'active';
                const isDeleted = !w;
                let wName;
                if (isDeleted) {
                    wName = `Không rõ (${a.workerId})`;
                } else if (isInactive) {
                    wName = `${w.hoTen} (Nghỉ việc)`;
                } else {
                    wName = w.hoTen;
                }
                const note = a.note ? `<div class="mt-2 text-muted small fst-italic"><i class="bi bi-chat-left-text me-1"></i>${a.note}</div>` : '';

                return `
                <div class="card mb-2 shadow-sm border-0 rounded-3">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <span class="badge bg-light text-success border border-success-subtle mb-1">${formatDate(a.date)}</span>
                                <h6 class="mb-0 fw-bold text-dark">${wName} <span class="text-muted fw-normal" style="font-size:0.75rem">#${a.workerId}</span></h6>
                            </div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm btn-light text-primary py-0 px-2 border" onclick="AdvancesModule.openEdit('${a.id}')"><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-light text-danger py-0 px-2 border" onclick="AdvancesModule.confirmDelete('${a.id}')"><i class="bi bi-trash"></i></button>
                            </div>
                        </div>
                        <div class="mt-2 bg-light p-2 rounded text-end border">
                            <div class="fw-bold" style="color:#b45309;font-size:1.1rem">${formatCurrency(a.amount)} đ</div>
                        </div>
                        ${note}
                    </div>
                </div>`;
            }).join('');
        }
    }

    function populateWorkerSelect() {
        const sel = $('adv-worker-field');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Chọn công nhân --</option>' +
            workers.map(w => `<option value="${w.id}">${w.id} - ${w.hoTen} (${w.phongBan || 'Không rõ phòng'})</option>`).join('');
    }

    /* ---- Events ---- */
    function bindEvents() {
        $('adv-search').addEventListener('input', e => {
            searchQuery = e.target.value;
            renderTable();
        });

        if ($('adv-year-filter')) {
            $('adv-year-filter').addEventListener('change', e => {
                filterYear = parseInt(e.target.value) || new Date().getFullYear();
                renderTable();
            });
        }

        $('adv-form').addEventListener('submit', e => {
            e.preventDefault();
            save();
        });

        const amountField = $('adv-amount-field');
        if (amountField) {
            amountField.addEventListener('input', e => {
                const wordsEl = $('adv-amount-words');
                if (wordsEl) {
                    const val = parseInt(e.target.value);
                    wordsEl.textContent = val > 0 ? (numberToWords(val) + ' đồng') : '';
                }
            });
        }
    }

    /* ---- CRUD ---- */
    function openAdd() {
        editingId = null;
        $('adv-modal-title').textContent = '💸 Thêm Phiếu Ứng Tiền';
        $('adv-form').reset();

        // Mặc định ngày hôm nay
        const today = new Date().toISOString().split('T')[0];
        $('adv-date-field').value = today;

        if ($('adv-amount-words')) $('adv-amount-words').textContent = '';
        clearValidation();
        new bootstrap.Modal($('adv-modal')).show();
    }

    function openEdit(id) {
        const a = advances.find(x => x.id === id);
        if (!a) return;
        editingId = id;
        $('adv-modal-title').textContent = '✏️ Sửa Phiếu Ứng Tiền';

        $('adv-worker-field').value = a.workerId;
        $('adv-date-field').value = a.date;
        $('adv-amount-field').value = a.amount;
        $('adv-note-field').value = a.note || '';

        if ($('adv-amount-words')) {
            $('adv-amount-words').textContent = a.amount > 0 ? (numberToWords(a.amount) + ' đồng') : '';
        }

        clearValidation();
        new bootstrap.Modal($('adv-modal')).show();
    }

    function save() {
        const workerId = $('adv-worker-field').value;
        const date = $('adv-date-field').value;
        const amount = parseInt($('adv-amount-field').value) || 0;

        let isValid = true;
        if (!workerId) { $('adv-worker-field').classList.add('is-invalid'); isValid = false; } else $('adv-worker-field').classList.remove('is-invalid');
        if (!date) { $('adv-date-field').classList.add('is-invalid'); isValid = false; } else $('adv-date-field').classList.remove('is-invalid');
        if (amount <= 0) { $('adv-amount-field').classList.add('is-invalid'); isValid = false; } else $('adv-amount-field').classList.remove('is-invalid');

        if (!isValid) return;

        const payload = {
            id: editingId || StorageManager.generateAdvanceId(advances),
            workerId: workerId,
            date: date,
            amount: amount,
            note: $('adv-note-field').value.trim()
        };

        if (editingId) {
            const idx = advances.findIndex(x => x.id === editingId);
            advances[idx] = payload;
            showToast('Đã cập nhật phiếu ứng!', 'success');
        } else {
            advances.push(payload);
            showToast('Đã thêm phiếu ứng mới!', 'success');
        }

        StorageManager.saveAdvances(advances);
        renderTable();
        bootstrap.Modal.getInstance($('adv-modal')).hide();
    }

    function confirmDelete(id) {
        const a = advances.find(x => x.id === id);
        if (!a) return;
        const w = workers.find(x => x.id === a.workerId);
        const name = w ? w.hoTen : a.workerId;

        showConfirm(
            '🗑️',
            'Xoá phiếu ứng?',
            `Bạn có chắc muốn xóa khoản ứng <strong>${formatCurrency(a.amount)}</strong> của <strong>${name}</strong> ngày ${formatDate(a.date)}?`,
            () => deleteAdvance(id)
        );
    }

    function deleteAdvance(id) {
        advances = advances.filter(x => x.id !== id);
        StorageManager.saveAdvances(advances);
        renderTable();
        showToast('Đã xóa phiếu ứng!', 'error');
    }

    function clearValidation() {
        document.querySelectorAll('#adv-form .is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }

    /* ---- Helpers ---- */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN').format(amount);
    }

    function numberToWords(n) {
        if (n === 0) return 'Không';
        const str = n.toString();
        const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
        const blocks = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ'];

        let words = [];
        let numBlocks = Math.ceil(str.length / 3);
        let paddedStr = str.padStart(numBlocks * 3, '0');

        for (let i = 0; i < numBlocks; i++) {
            let b = parseInt(paddedStr.substring(i * 3, i * 3 + 3));
            if (b === 0) continue;
            let h = Math.floor(b / 100), t = Math.floor((b % 100) / 10), u = b % 10;
            let bw = [];

            if (h > 0 || (i > 0 && parseInt(str) > 0)) bw.push(digits[h] + ' trăm');
            if (t === 0 && u > 0 && (h > 0 || i > 0)) bw.push('lẻ');
            if (t === 1) bw.push('mười');
            if (t > 1) bw.push(digits[t] + ' mươi');
            if (u === 1 && t > 1) bw.push('mốt');
            else if (u === 5 && t > 0) bw.push('lăm');
            else if (u > 0 && !(t === 1 && u === 1)) bw.push(digits[u]);

            if (bw.length > 0) {
                words.push(bw.join(' ') + (blocks[numBlocks - 1 - i] ? ' ' + blocks[numBlocks - 1 - i] : ''));
            }
        }
        let res = words.join(' ').replace(/^không trăm (lẻ )?/, '').trim();
        return res.charAt(0).toUpperCase() + res.slice(1);
    }

    return { init, openAdd, openEdit, confirmDelete, renderTable };
})();
