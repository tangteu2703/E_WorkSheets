/**
 * AttendanceModule - Bảng Chấm Công theo Tháng ÂM LỊCH Việt Nam (Hồ Ngọc Đức)
 * Hỗ trợ:
 * - Render đúng số ngày tháng âm (29 ngày tháng thiếu, 30 ngày tháng đủ, tháng nhuận)
 * - Hiển thị 2 hàng tiêu đề song song: Hàng trên là Ngày Dương lịch, Hàng dưới là Ngày Âm lịch
 * - Tự động nhận diện và highlight chính xác các ngày Chủ Nhật thực tế
 * - Lọc nhiều người cùng lúc bằng dấu phẩy (,), tìm kiếm không dấu tiếng Việt
 * - Xuất Excel & PDF đầy đủ thông tin Âm Lịch & Dương Lịch
 */
const AttendanceModule = (() => {
    const CYCLE = [1, 0.5, 0]; // click cycle

    // Khởi tạo ngày âm lịch hiện tại
    const todayLunar = (typeof LunarCalendar !== 'undefined')
        ? LunarCalendar.getTodayLunar()
        : [1, new Date().getMonth() + 1, new Date().getFullYear(), 0];

    let currentYear = todayLunar[2];
    let currentMonth = todayLunar[1];
    let currentIsLeap = todayLunar[3] || 0;
    let currentMonthDetail = null;

    let monthData = {};  // { workerId: { day: value } }
    let workers = [];
    let hasChanges = false;
    let filterStatus = 'all'; // 'all' | 'has_work' | 'no_work'

    // --- Batch Selection State ---
    let selectedWorkers = new Set(); // Set of worker IDs
    let selectedDays    = new Set(); // Set of day numbers (1-based)

    // --- Brush Mode State ---
    let brushActive = false;  // Chế độ cọ đang bật?
    let brushValue  = 1;      // Giá trị tô: 1 | 0.5 | 0
    let isBrushing  = false;  // Đang kéo chuột?

    // --- Lock State ---
    let isLocked = true; // Mặc định load trang là đang khóa, tránh click nhầm

    const $ = id => document.getElementById(id);

    function init() {
        workers = StorageManager.getWorkers().filter(w => w.trangThai === 'active');
        setupPicker();
        setupImportButton();
        setupBatchActionBar();
        setupBrushMode();
        setupLockButton();
        load(currentYear, currentMonth, currentIsLeap);
        // Áp dụng trạng thái khóa ngay sau khi render xong
        applyLockState();
        // Khởi tạo guard cảnh báo chưa lưu
        setupUnsavedGuard();
    }


    /* ---- Picker ---- */
    function setupPicker() {
        const monthSel = $('att-month');
        const yearInp = $('att-year');
        const searchInp = $('att-search');

        yearInp.value = currentYear;
        renderMonthOptions();

        monthSel.addEventListener('change', () => {
            const parts = monthSel.value.split('_');
            currentMonth = parseInt(parts[0]);
            currentIsLeap = parseInt(parts[1]) || 0;
            load(currentYear, currentMonth, currentIsLeap);
            if (searchInp) searchInp.value = '';
        });

        yearInp.addEventListener('change', () => {
            currentYear = parseInt(yearInp.value) || new Date().getFullYear();
            renderMonthOptions();
            load(currentYear, currentMonth, currentIsLeap);
            if (searchInp) searchInp.value = '';
        });

        if (searchInp) {
            searchInp.addEventListener('input', (e) => {
                renderGrid(currentYear, currentMonth, currentIsLeap, e.target.value);
            });
        }

        const statusFilter = $('att-status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                filterStatus = statusFilter.value;
                const searchVal = searchInp ? searchInp.value : '';
                renderGrid(currentYear, currentMonth, currentIsLeap, searchVal);
            });
        }
    }

    function renderMonthOptions() {
        const monthSel = $('att-month');
        if (!monthSel) return;

        const months = (typeof LunarCalendar !== 'undefined')
            ? LunarCalendar.getLunarMonthsInYear(currentYear)
            : Array.from({ length: 12 }, (_, i) => ({ month: i + 1, isLeap: 0, label: `Tháng ${i + 1}` }));

        monthSel.innerHTML = months.map(m => {
            const val = `${m.month}_${m.isLeap}`;
            const selected = (m.month === currentMonth && m.isLeap === currentIsLeap) ? 'selected' : '';
            return `<option value="${val}" ${selected}>${m.label}</option>`;
        }).join('');

        // Nếu currentMonth chưa khớp option nào, chọn option đầu tiên
        if (!monthSel.value) {
            monthSel.selectedIndex = 0;
            const parts = monthSel.value.split('_');
            currentMonth = parseInt(parts[0]);
            currentIsLeap = parseInt(parts[1]) || 0;
        }
    }

    /* ---- Load ---- */
    function load(year, month, isLeap = 0) {
        hasChanges = false;
        clearBatchSelection(); // Reset lựa chọn hàng loạt khi đổi tháng
        // Key lưu trữ tháng (nếu tháng nhuận dùng key riêng)
        const storageMonthKey = isLeap ? (month + 100) : month;
        monthData = deepClone(StorageManager.getMonthAttendance(year, storageMonthKey));

        // Lấy chi tiết số ngày và ánh xạ dương lịch của tháng âm
        if (typeof LunarCalendar !== 'undefined') {
            currentMonthDetail = LunarCalendar.getLunarMonthDaysDetail(month, year, isLeap);
        } else {
            const daysInMonth = new Date(year, month, 0).getDate();
            const days = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const dow = new Date(year, month - 1, d).getDay();
                days.push({
                    lunarDay: d,
                    solarDay: d,
                    solarMonth: month,
                    solarYear: year,
                    solarFormatted: `${d}/${month}`,
                    solarFullFormatted: `${d}/${month}/${year}`,
                    dayOfWeek: dow,
                    fullDayOfWeekStr: dow === 0 ? 'Chủ Nhật' : `Thứ ${dow + 1}`,
                    isSunday: dow === 0
                });
            }
            currentMonthDetail = { totalDays: daysInMonth, days };
        }

        renderGrid(year, month, isLeap);
        renderSummary();
    }

    /* ---- Search & Filter Helper ---- */
    function normalizeStr(str) {
        if (!str) return '';
        return str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D')
            .toLowerCase()
            .trim();
    }

    function filterWorkers(list, text = '') {
        if (!text || !text.trim()) return list;
        const keywords = text
            .split(/[,;]+/)
            .map(k => k.trim())
            .filter(Boolean);
        if (!keywords.length) return list;

        return list.filter(w => {
            const rawName = (w.hoTen || '').toLowerCase();
            const normName = normalizeStr(w.hoTen);
            const rawId = (w.id || '').toLowerCase();
            const normId = normalizeStr(w.id);

            return keywords.some(kw => {
                const rawKw = kw.toLowerCase();
                const normKw = normalizeStr(kw);
                return rawName.includes(rawKw) || normName.includes(normKw) ||
                       rawId.includes(rawKw) || normId.includes(normKw);
            });
        });
    }

    /* ---- Render Grid ---- */
    function renderGrid(year, month, isLeap = 0, filterText = '') {
        const thead = $('att-thead');
        const tbody = $('att-tbody');
        if (!currentMonthDetail) return;

        const days = currentMonthDetail.days;
        const daysInMonth = currentMonthDetail.totalDays;

        /* 2-Row Header: Hàng 1 là Dương Lịch, Hàng 2 là Âm Lịch */
        let thSolarRow = `<th class="th-stt col-stt" rowspan="2">#</th>`;
        thSolarRow += `<th class="th-code col-code" rowspan="2">Mã NV</th>`;
        thSolarRow += `<th class="th-name col-name" rowspan="2">Họ và Tên</th>`;
        thSolarRow += `<th class="th-total col-total" rowspan="2">Tổng</th>`;

        let thLunarRow = '';

        days.forEach(d => {
            const isSun = d.isSunday;
            const sunClass = isSun ? 'sunday-head th-sun' : '';
            const solarBg = isSun ? 'background:#fef3c7;color:#92400e;' : 'background:#f8fafc;color:#64748b;';
            const lunarBg = isSun ? 'background:#fee2e2;color:#991b1b;' : 'background:#f1f5f9;color:#0f172a;';

            // Kiểm tra ngày đang được chọn để áp dụng style
            const daySelected = selectedDays.has(d.lunarDay) ? 'th-day-selected' : '';

            // Hàng 1: Dương lịch
            thSolarRow += `<th title="${d.fullDayOfWeekStr}, ngày ${d.solarFullFormatted} (Dương lịch)"
                               class="${sunClass}" 
                               style="${solarBg} font-size:.65rem; padding:3px 2px; font-weight:600; border-bottom: 1px dashed rgba(0,0,0,0.12);">
                               ${d.solarFormatted}
                           </th>`;

            // Hàng 2: Âm lịch — thêm class th-day-sel và data-day để click chọn
            thLunarRow += `<th title="Mùng ${d.lunarDay} Tháng ${month}${isLeap ? ' Nhuận' : ''} Âm lịch (${d.fullDayOfWeekStr}, ${d.solarFullFormatted} Dương) — Click để chọn ngày"
                              class="th-day-sel ${sunClass} ${daySelected}" 
                              data-day="${d.lunarDay}"
                              style="${lunarBg} font-size:.78rem; padding:4px 2px; font-weight:800;">
                              ${d.lunarDay}
                          </th>`;
        });

        thead.innerHTML = `<tr>${thSolarRow}</tr><tr>${thLunarRow}</tr>`;

        /* Filter workers by name/id */
        let filteredWorkers = filterWorkers(workers, filterText);

        /* Filter thêm theo trạng thái có/không có công */
        if (filterStatus === 'has_work') {
            filteredWorkers = filteredWorkers.filter(w => {
                const wd = monthData[w.id] || {};
                return Object.values(wd).some(v => v !== '' && v !== undefined && parseFloat(v) > 0);
            });
        } else if (filterStatus === 'no_work') {
            filteredWorkers = filteredWorkers.filter(w => {
                const wd = monthData[w.id] || {};
                const total = Object.values(wd).reduce((s, v) => s + (parseFloat(v) || 0), 0);
                return total === 0;
            });
        }

        /* Body rows */
        if (!filteredWorkers.length) {
            tbody.innerHTML = `<tr><td colspan="${daysInMonth + 4}" style="text-align:center;padding:2rem;color:var(--text-muted)">Không tìm thấy công nhân phù hợp</td></tr>`;
            return;
        }

        tbody.innerHTML = filteredWorkers.map((w, index) => {
            const wd = monthData[w.id] || {};
            let total = 0;
            let cells = '';

            const isWorkerSel = selectedWorkers.has(w.id);
            const workerRowCls = isWorkerSel ? 'tr-worker-selected' : '';

            for (let d = 1; d <= daysInMonth; d++) {
                const dayInfo = days[d - 1];
                const isSun = dayInfo.isSunday;
                const val = (wd[d] !== undefined) ? wd[d] : '';
                const cls = cellClass(val, isSun);
                const lbl = cellLabel(val, isSun);
                total += (val === '' || val === undefined) ? 0 : parseFloat(val) || 0;

                const tip = `Mùng ${d} Âm Lịch (${dayInfo.solarFormatted} DL - ${dayInfo.fullDayOfWeekStr}): ${cellTitle(val)}`;
                const daySelCls = selectedDays.has(d) ? 'td-day-selected' : '';
                cells += `<td class="${daySelCls}" data-col="${d}"><div class="att-cell ${cls}" data-id="${w.id}" data-day="${d}" title="${tip}">${lbl}</div></td>`;
            }

            // Hiển thị icon check nếu công nhân đang được chọn
            const checkIcon = isWorkerSel
                ? `<i class="bi bi-check-circle-fill" style="color:#f59e0b;font-size:.7rem"></i>`
                : `<i class="bi bi-circle" style="color:#cbd5e1;font-size:.7rem"></i>`;

            const badgeBg = isWorkerSel ? '' : 'bg-light text-primary border';

            return `<tr class="${workerRowCls}">
                <td class="stt-cell text-muted text-center align-middle" style="font-size:.8rem">${index + 1}</td>
                <td class="code-cell text-center align-middle">
                    <span class="worker-badge-sel ${isWorkerSel ? 'sel-active' : 'badge bg-light text-primary border'}" 
                          data-worker-id="${w.id}" 
                          title="Click để chọn/bỏ chọn ${w.hoTen} cho nhập nhanh">
                        ${checkIcon} ${w.id}
                    </span>
                </td>
                <td class="name-cell align-middle">
                    <div class="fw-semibold text-dark">${w.hoTen}</div>
                </td>
                <td class="total-cell td-total att-total-${w.id} text-center align-middle">${formatTotal(total)}</td>
                ${cells}
            </tr>`;
        }).join('');

        /* Delegate click — ô chấm công */
        tbody.onclick = e => {
            if (brushActive) return; // Chế độ cọ: mousedown/mouseover xử lý, bỏ qua click cycle

            // Click vào worker badge để toggle chọn
            const badge = e.target.closest('.worker-badge-sel');
            if (badge) {
                const wid = badge.dataset.workerId;
                if (wid) toggleWorkerSelection(wid);
                return;
            }

            // Click vào ô chấm công (single cell)
            const cell = e.target.closest('.att-cell');
            if (!cell) return;

            document.querySelectorAll('.att-table tr.tr-active').forEach(tr => tr.classList.remove('tr-active'));
            cell.closest('tr').classList.add('tr-active');

            toggleCell(cell);
        };

        /* Brush mode — mousedown bắt đầu tô, mouseover tiếp tục kéo */
        tbody.onmousedown = e => {
            if (!brushActive || isLocked) return;
            const cell = e.target.closest('.att-cell');
            if (!cell) return;
            isBrushing = true;
            paintCell(cell);
            e.preventDefault(); // Ngăn bôi đen text khi kéo
        };
        tbody.onmouseover = e => {
            if (!brushActive || !isBrushing || isLocked) return;
            const cell = e.target.closest('.att-cell');
            if (!cell) return;
            paintCell(cell);
        };

        /* Delegate click — header ngày âm lịch để chọn ngày */
        thead.onclick = e => {
            const th = e.target.closest('th.th-day-sel');
            if (!th) return;
            const day = parseInt(th.dataset.day);
            if (!day) return;
            toggleDaySelection(day);
        };

        // Áp dụng trạng thái chọn hiện tại lên DOM (nếu render lại sau batch)
        syncSelectionToDOM();
    }

    /* ============================================================
       BATCH SELECTION — Chọn nhiều công nhân & ngày để nhập nhanh
       ============================================================ */

    /** Toggle chọn/bỏ chọn một công nhân */
    function toggleWorkerSelection(workerId) {
        if (selectedWorkers.has(workerId)) {
            selectedWorkers.delete(workerId);
        } else {
            selectedWorkers.add(workerId);
        }
        syncSelectionToDOM();
        updateBatchBar();
    }

    /** Toggle chọn/bỏ chọn một ngày */
    function toggleDaySelection(day) {
        if (selectedDays.has(day)) {
            selectedDays.delete(day);
        } else {
            selectedDays.add(day);
        }
        syncSelectionToDOM();
        updateBatchBar();
    }

    /**
     * Đồng bộ trạng thái selection lên DOM mà không re-render toàn bộ bảng.
     * - Worker badge: thêm/bỏ class sel-active, cập nhật icon
     * - Row: thêm/bỏ class tr-worker-selected
     * - Header ngày: thêm/bỏ class th-day-selected
     * - Cột ngày: thêm/bỏ class td-day-selected
     */
    function syncSelectionToDOM() {
        // Sync worker badges & rows
        document.querySelectorAll('.worker-badge-sel[data-worker-id]').forEach(badge => {
            const wid = badge.dataset.workerId;
            const row = badge.closest('tr');
            if (selectedWorkers.has(wid)) {
                badge.classList.add('sel-active');
                badge.classList.remove('badge', 'bg-light', 'text-primary', 'border');
                const iconEl = badge.querySelector('i');
                if (iconEl) {
                    iconEl.className = 'bi bi-check-circle-fill';
                    iconEl.style.color = '#f59e0b';
                    iconEl.style.fontSize = '.7rem';
                }
                if (row) row.classList.add('tr-worker-selected');
            } else {
                badge.classList.remove('sel-active');
                badge.classList.add('badge', 'bg-light', 'text-primary', 'border');
                const iconEl = badge.querySelector('i');
                if (iconEl) {
                    iconEl.className = 'bi bi-circle';
                    iconEl.style.color = '#cbd5e1';
                    iconEl.style.fontSize = '.7rem';
                }
                if (row) row.classList.remove('tr-worker-selected');
            }
        });

        // Sync header ngày — row 2 của thead
        document.querySelectorAll('th.th-day-sel[data-day]').forEach(th => {
            const day = parseInt(th.dataset.day);
            if (selectedDays.has(day)) {
                th.classList.add('th-day-selected');
            } else {
                th.classList.remove('th-day-selected');
            }
        });

        // Sync cột ngày trong tbody
        document.querySelectorAll('#att-tbody td[data-col]').forEach(td => {
            const col = parseInt(td.dataset.col);
            if (selectedDays.has(col)) {
                td.classList.add('td-day-selected');
            } else {
                td.classList.remove('td-day-selected');
            }
        });
    }

    /** Cập nhật hiển thị Batch Action Bar */
    function updateBatchBar() {
        const wCount = selectedWorkers.size;
        const dCount = selectedDays.size;

        const cntW = $('batch-count-workers');
        const cntD = $('batch-count-days');
        if (cntW) cntW.textContent = wCount;
        if (cntD) cntD.textContent = dCount;

        // Hiện/ẩn phần selection info + nút Bỏ chọn
        const hasSelection = wCount > 0 && dCount > 0;
        const selInfo    = $('batch-sel-info');
        const selDivider = $('batch-sel-divider');
        const btnCancel  = $('batch-btn-cancel');
        if (selInfo)    selInfo.style.display    = hasSelection ? '' : 'none';
        if (selDivider) selDivider.style.display = hasSelection ? '' : 'none';
        if (btnCancel)  btnCancel.style.display  = hasSelection ? '' : 'none';
    }

    /**
     * Áp dụng công hàng loạt cho các worker x ngày đã chọn.
     * @param {number|''} value — 1, 0.5, 0, hoặc '' (xóa)
     */
    function applyBatch(value) {
        if (isLocked) { showToast('🔒 Bảng đang khóa! Nhấn nút <strong>Mở Khóa</strong> trước.', 'warning'); return; }
        if (selectedWorkers.size === 0 || selectedDays.size === 0) return;

        const daysInMonth = currentMonthDetail ? currentMonthDetail.totalDays : 30;

        selectedWorkers.forEach(wid => {
            if (!monthData[wid]) monthData[wid] = {};
            selectedDays.forEach(day => {
                if (day < 1 || day > daysInMonth) return;
                if (value === '') {
                    delete monthData[wid][day];
                } else {
                    monthData[wid][day] = value;
                }
            });
            updateWorkerTotal(wid);
        });

        hasChanges = true;

        // Cập nhật lại các ô trong DOM (không re-render toàn bộ)
        const days = currentMonthDetail ? currentMonthDetail.days : [];
        selectedWorkers.forEach(wid => {
            selectedDays.forEach(day => {
                const cell = document.querySelector(`.att-cell[data-id="${wid}"][data-day="${day}"]`);
                if (!cell) return;
                const dayInfo = days[day - 1] || { isSunday: false, solarFormatted: '', fullDayOfWeekStr: '' };
                const isSun = dayInfo.isSunday;
                const cur = (value === '') ? '' : value;
                cell.className = `att-cell ${cellClass(cur, isSun)}`;
                cell.title = `Mùng ${day} ÂL (${dayInfo.solarFormatted} DL - ${dayInfo.fullDayOfWeekStr}): ${cellTitle(cur)}`;
                cell.innerHTML = cellLabel(cur, isSun);
            });
        });

        renderSummary();

        const valLabel = value === 1 ? '1 ngày công' : value === 0.5 ? '0.5 ngày' : value === 0 ? 'Nghỉ' : 'Xóa trống';
        showToast(
            `✅ Đã nhập <strong>${valLabel}</strong> cho ${selectedWorkers.size} công nhân × ${selectedDays.size} ngày`,
            'success'
        );
    }

    /** Xóa toàn bộ lựa chọn */
    function clearBatchSelection() {
        selectedWorkers.clear();
        selectedDays.clear();
        syncSelectionToDOM();
        updateBatchBar();
    }

    /** Kết nối các nút trên Action Bar (dùng chung cho Cọ + Batch) */
    function setupBatchActionBar() {
        const actionBtns = document.querySelectorAll('.brush-val-btn[data-val]');
        const btnCancel  = $('batch-btn-cancel');

        actionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const rawVal = btn.dataset.val;
                const val = rawVal === '' ? '' : parseFloat(rawVal);
                if (brushActive) {
                    // Chế độ Cọ: đặt brushValue + highlight nút đã chọn
                    brushValue = val;
                    actionBtns.forEach(b => b.classList.remove('brush-val-selected'));
                    btn.classList.add('brush-val-selected');
                } else {
                    // Chế độ Batch: apply hàng loạt (chỉ hoạt động khi có chọn NV + Ngày)
                    applyBatch(val);
                }
            });
        });

        if (btnCancel) btnCancel.addEventListener('click', () => clearBatchSelection());
    }

    /** Tô một ô theo brushValue (dùng trong chế độ cọ) */
    function paintCell(cell) {
        const workerId = cell.dataset.id;
        const day = parseInt(cell.dataset.day);
        if (!workerId || !day) return;
        if (!monthData[workerId]) monthData[workerId] = {};
        if (monthData[workerId][day] === brushValue) return; // Không tô lại nếu cùng giá trị

        monthData[workerId][day] = brushValue;
        hasChanges = true;

        const dayInfo = currentMonthDetail
            ? currentMonthDetail.days[day - 1]
            : { isSunday: false, solarFormatted: '', fullDayOfWeekStr: '' };
        const isSun = dayInfo.isSunday;
        cell.className = `att-cell ${cellClass(brushValue, isSun)}`;
        cell.title = `Mùng ${day} ÂL (${dayInfo.solarFormatted} DL - ${dayInfo.fullDayOfWeekStr}): ${cellTitle(brushValue)}`;
        cell.innerHTML = cellLabel(brushValue, isSun);
        updateWorkerTotal(workerId);
    }

    /** Thiết lập chế độ Cọ — kéo chuột để tô công nhanh */
    function setupBrushMode() {
        const toggleBtn = $('brush-toggle-btn');
        if (!toggleBtn) return;

        toggleBtn.addEventListener('click', () => {
            brushActive = !brushActive;
            if (brushActive) {
                toggleBtn.classList.add('brush-active');
                // Đồng bộ brushValue theo nút đang được highlight
                const selBtn = document.querySelector('.brush-val-btn.brush-val-selected');
                if (selBtn) {
                    const raw = selBtn.dataset.val;
                    brushValue = raw === '' ? '' : parseFloat(raw);
                }
                document.querySelector('.att-wrapper')?.classList.add('brush-mode');
            } else {
                toggleBtn.classList.remove('brush-active');
                document.querySelector('.att-wrapper')?.classList.remove('brush-mode');
            }
        });

        // mouseup ở bất kỳ đâu → dừng quét
        document.addEventListener('mouseup', () => { isBrushing = false; });
    }

    /* ---- Lock / Unlock ---- */

    /** Áp dụng trạng thái khóa/mở khóa lên DOM */
    function applyLockState() {
        const wrapper  = document.querySelector('.att-wrapper');
        const btn      = $('att-btn-lock');
        const notice   = $('att-lock-notice');
        const actionBar = $('batch-action-bar');

        if (isLocked) {
            // Đang khóa
            if (wrapper) wrapper.classList.add('att-locked');
            if (btn) {
                btn.classList.remove('is-unlocked');
                btn.classList.add('is-locked');
                btn.title = 'Bảng đang khóa – nhấn để mở khóa nhập liệu';
                btn.innerHTML = '<i class="bi bi-lock-fill"></i> <span class="d-none d-sm-inline">Mở Khóa</span>';
            }
            if (notice) notice.classList.add('notice-visible');
            // Ẩn action bar khi khóa
            if (actionBar) actionBar.classList.remove('bar-visible');
            // Tắt chế độ cọ nếu đang bật
            if (brushActive) {
                brushActive = false; isBrushing = false;
                const tb = $('brush-toggle-btn');
                if (tb) tb.classList.remove('brush-active');
                document.querySelector('.att-wrapper')?.classList.remove('brush-mode');
            }
        } else {
            // Đang mở khóa
            if (wrapper) wrapper.classList.remove('att-locked');
            if (btn) {
                btn.classList.remove('is-locked');
                btn.classList.add('is-unlocked');
                btn.title = 'Bảng đang mở – nhấn để khóa lại';
                btn.innerHTML = '<i class="bi bi-unlock-fill"></i> <span class="d-none d-sm-inline">Khóa lại</span>';
            }
            if (notice) notice.classList.remove('notice-visible');
            // Hiện action bar khi mở khóa
            if (actionBar) actionBar.classList.add('bar-visible');
            updateBatchBar();
        }
    }

    /** Kết nối nút Khóa / Mở Khóa */
    function setupLockButton() {
        const btn = $('att-btn-lock');
        if (!btn) return;
        btn.addEventListener('click', () => {
            isLocked = !isLocked;
            applyLockState();
            if (!isLocked) {
                showToast('🔓 Đã <strong>mở khóa</strong> — bạn có thể chấm công ngay bây giờ!', 'success');
            } else {
                clearBatchSelection();
                showToast('🔒 Đã <strong>khóa</strong> bảng công — an toàn xem dữ liệu!', 'info');
            }
        });
    }

    /* ---- Unsaved Changes Guard ---- */
    let _pendingNavHref = null;

    /**
     * Thiết lập bảo vệ dữ liệu chưa lưu:
     * 1. beforeunload — cảnh báo khi đóng/reload tab.
     * 2. Chặn click các nav-link sidebar — hỏi xác nhận trước khi rời trang.
     */
    function setupUnsavedGuard() {
        // 1. Cảnh báo khi đóng/reload tab
        window.addEventListener('beforeunload', (e) => {
            if (hasChanges) {
                e.preventDefault();
                e.returnValue = 'Bạn có dữ liệu chưa lưu! Thoát sẽ mất toàn bộ công vừa chấm.';
            }
        });

        // 2. Chặn click các nav-link trong sidebar
        document.querySelectorAll('#sidebar a.nav-link-tc').forEach(link => {
            link.addEventListener('click', (e) => {
                if (!hasChanges) return; // Không có thay đổi → cho qua bình thường
                const href = link.getAttribute('href');
                if (!href || href === '#' || href === 'attendance.html') return;

                e.preventDefault();
                _pendingNavHref = href;

                // Capture href vào closure riêng để tránh race condition
                const targetHref = href;
                showConfirm(
                    '💾',
                    'Lưu Bảng trước khi rời trang?',
                    'Bạn có dữ liệu chấm công <strong>chưa lưu</strong>!<br>Nếu rời trang ngay, toàn bộ công vừa chấm sẽ <span style="color:#dc2626">bị mất</span>.<br><br>Nhấn <strong>Lưu & Rời trang</strong> để lưu trước khi đi.',
                    () => {
                        // Lưu ngay rồi chuyển trang
                        const storageMonthKey = currentIsLeap ? (currentMonth + 100) : currentMonth;
                        StorageManager.saveMonthAttendance(currentYear, storageMonthKey, monthData);
                        hasChanges = false;
                        window.location.href = targetHref;
                    },
                    { confirmLabel: 'Lưu & Rời trang', cancelLabel: 'Ở lại', dangerBtn: false,
                      extraBtn: { label: 'Rời trang (không lưu)', onClick: () => { window.location.href = targetHref; } } }
                );
            });
        });
    }

    function toggleCell(cell) {
        if (isLocked) return; // Bị khóa — không cho chấm công
        const workerId = cell.dataset.id;
        const day = parseInt(cell.dataset.day);
        if (!monthData[workerId]) monthData[workerId] = {};

        const cur = monthData[workerId][day];
        let next;
        if (cur === undefined || cur === '' || cur === 0) next = 1;
        else if (cur === 1) next = 0.5;
        else if (cur === 0.5) next = 0;
        else next = 1;

        monthData[workerId][day] = next;
        hasChanges = true;

        // Cập nhật giao diện cell
        const dayInfo = currentMonthDetail ? currentMonthDetail.days[day - 1] : { isSunday: false, solarFormatted: '', fullDayOfWeekStr: '' };
        const isSun = dayInfo.isSunday;

        cell.className = `att-cell ${cellClass(next, isSun)}`;
        cell.title = `Mùng ${day} ÂL (${dayInfo.solarFormatted} DL - ${dayInfo.fullDayOfWeekStr}): ${cellTitle(next)}`;
        cell.innerHTML = cellLabel(next, isSun);

        // Update total
        updateWorkerTotal(workerId);
    }

    function updateWorkerTotal(workerId) {
        const wd = monthData[workerId] || {};
        let total = 0;
        Object.values(wd).forEach(v => { total += (v === '' ? 0 : parseFloat(v) || 0); });
        const el = document.querySelector(`.att-total-${workerId}`);
        if (el) el.textContent = formatTotal(total);
        renderSummary();
    }

    function renderSummary() {
        let grandTotal = 0;
        let zeroCount = 0;
        workers.forEach(w => {
            const wd = monthData[w.id] || {};
            Object.values(wd).forEach(v => {
                const n = parseFloat(v) || 0;
                grandTotal += n;
                if (n === 0) zeroCount++;
            });
        });
        const el = $('att-summary');
        if (el) {
            const totalDays = currentMonthDetail ? currentMonthDetail.totalDays : 30;
            const leapStr = currentIsLeap ? ' Nhuận' : '';
            el.innerHTML = `<i class="bi bi-moon-stars-fill text-warning me-1"></i>Tháng <strong>${currentMonth}${leapStr}/${currentYear} ÂL</strong> (${totalDays} ngày) — Tổng công toàn đội: <span class="text-success fw-bold">${formatTotal(grandTotal)} công</span>`;
        }
    }

    /* ---- Save ---- */
    function save() {
        const leapStr = currentIsLeap ? ' Nhuận' : '';
        showConfirm('💾', 'Lưu bảng công Âm Lịch?',
            `Xác nhận lưu dữ liệu chấm công Tháng ${currentMonth}${leapStr}/${currentYear} (Âm lịch)?`,
            () => {
                const storageMonthKey = currentIsLeap ? (currentMonth + 100) : currentMonth;
                StorageManager.saveMonthAttendance(currentYear, storageMonthKey, monthData);
                hasChanges = false;
                _pendingNavHref = null; // Reset pending nav sau khi lưu thành công
                showToast(`Đã lưu bảng công Tháng ${currentMonth}${leapStr}/${currentYear} ÂL!`, 'success');
            }
        );
    }

    /* ---- Clear month ---- */
    function clearMonth() {
        const leapStr = currentIsLeap ? ' Nhuận' : '';
        showConfirm('🔄', 'Xóa bảng công Âm Lịch?',
            `Xóa toàn bộ dữ liệu chấm công Tháng ${currentMonth}${leapStr}/${currentYear} (Âm lịch)?`,
            () => {
                monthData = {};
                const storageMonthKey = currentIsLeap ? (currentMonth + 100) : currentMonth;
                StorageManager.saveMonthAttendance(currentYear, storageMonthKey, {});
                renderGrid(currentYear, currentMonth, currentIsLeap);
                renderSummary();
                showToast('Đã xóa bảng công!', 'info');
            }
        );
    }

    /* ---- Export Excel ---- */
    function exportExcel() {
        const leapStr = currentIsLeap ? ' Nhuận' : '';
        const title = `BẢNG CHẤM CÔNG THÁNG ${currentMonth}${leapStr}/${currentYear} (ÂM LỊCH)`;
        const days = currentMonthDetail ? currentMonthDetail.days : [];
        const daysInMonth = days.length;

        // 1. Dòng tiêu đề lớn
        const aoaData = [];
        aoaData.push([title]);
        aoaData.push([]); // Dòng trống

        // 2. Dòng Header 1: Dương lịch
        const headerSolar = ['STT', 'Mã NV', 'Họ và tên', 'Tổng'];
        days.forEach(d => {
            headerSolar.push(d.solarFormatted + ' (DL)');
        });
        aoaData.push(headerSolar);

        // 3. Dòng Header 2: Âm lịch
        const headerLunar = ['', '', '', ''];
        days.forEach(d => {
            headerLunar.push(`M.${d.lunarDay}`);
        });
        aoaData.push(headerLunar);

        // 4. Chuẩn bị dữ liệu hiển thị (có filter)
        const searchInp = document.getElementById('att-search');
        const searchVal = searchInp ? searchInp.value.trim() : '';
        const filteredWorkers = filterWorkers(workers, searchVal);

        // 5. Fill Data body
        filteredWorkers.forEach((w, index) => {
            const wd = monthData[w.id] || {};
            let total = 0;
            const row = [
                index + 1,
                w.id,
                w.hoTen
            ];

            const daysData = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const val = wd[d];
                total += (val === '' || val === undefined) ? 0 : parseFloat(val) || 0;

                let text = '';
                if (val === 1) text = 1;
                else if (val === 0.5) text = 0.5;
                else if (val === 0) text = '-';

                daysData.push(text);
            }

            row.push(Number.isInteger(total) ? total : Number(total.toFixed(1)));
            aoaData.push(row.concat(daysData));
        });

        // 6. Tạo Worksheet và Workbook
        const ws = XLSX.utils.aoa_to_sheet(aoaData);

        const cols = [
            { wch: 5 },   // STT
            { wch: 10 },  // Mã NV
            { wch: 25 },  // Họ tên
            { wch: 8 },   // Tổng
        ];
        for (let d = 1; d <= daysInMonth; d++) {
            cols.push({ wch: 6 }); // Day columns
        }
        ws['!cols'] = cols;

        // Merge Title & Headers
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: daysInMonth + 3 } });
        ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } }); // Merge STT
        ws['!merges'].push({ s: { r: 2, c: 1 }, e: { r: 3, c: 1 } }); // Merge Mã NV
        ws['!merges'].push({ s: { r: 2, c: 2 }, e: { r: 3, c: 2 } }); // Merge Họ tên
        ws['!merges'].push({ s: { r: 2, c: 3 }, e: { r: 3, c: 3 } }); // Merge Tổng

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `T${currentMonth}${leapStr} AL`);

        XLSX.writeFile(wb, `Bang_Cong_T${currentMonth}${leapStr}_${currentYear}_AL.xlsx`);
        showToast('Đã xuất file Excel!', 'success');
    }

    /* ---- Export PDF ---- */
    function exportPdf() {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            showToast('Thư viện xuất PDF chưa tải xong, vui lòng thử lại sau!', 'warning');
            return;
        }

        const doc = new window.jspdf.jsPDF({
            orientation: 'landscape',
            unit: 'pt',
            format: 'A4'
        });

        const removeAccents = (str) => {
            return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
        };

        const days = currentMonthDetail ? currentMonthDetail.days : [];
        const daysInMonth = days.length;

        // Prepare headers (2 rows)
        const headRow1 = ['STT', 'Ma NV', 'Ho va ten', 'Tong'];
        const headRow2 = ['', '', '', ''];
        days.forEach(d => {
            headRow1.push(d.solarFormatted);
            headRow2.push(d.lunarDay.toString());
        });
        const head = [headRow1, headRow2];

        // Prepare body
        const searchInp = document.getElementById('att-search');
        const searchVal = searchInp ? searchInp.value.trim() : '';
        const filteredWorkers = filterWorkers(workers, searchVal);

        const body = filteredWorkers.map((w, index) => {
            const wd = monthData[w.id] || {};
            let total = 0;
            const row = [
                (index + 1).toString(),
                w.id,
                removeAccents(w.hoTen),
            ];

            const daysData = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const val = wd[d];
                total += (val === '' || val === undefined) ? 0 : parseFloat(val) || 0;

                let text = '';
                if (val === 1) text = '1';
                else if (val === 0.5) text = '0.5';
                else if (val === 0) text = '-';

                daysData.push(text);
            }

            row.push(formatTotal(total));
            return row.concat(daysData);
        });

        const leapStr = currentIsLeap ? ' Nhuan' : '';
        const title = `Bang cham cong Thang ${currentMonth}${leapStr}/${currentYear} (Am lich - ${daysInMonth} ngay)`;

        doc.setFontSize(14);
        doc.text(title, doc.internal.pageSize.width / 2, 28, { align: 'center' });

        doc.autoTable({
            head: head,
            body: body,
            startY: 42,
            theme: 'grid',
            styles: {
                fontSize: 7.5,
                cellPadding: 2.5,
                halign: 'center',
                valign: 'middle'
            },
            headStyles: {
                fillColor: [241, 245, 249],
                textColor: [15, 23, 42],
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { cellWidth: 24 },
                1: { halign: 'center', cellWidth: 44 },
                2: { halign: 'left', cellWidth: 105 },
                3: { fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 32 }
            },
            didParseCell: function (data) {
                // Highlight Sunday in head
                if (data.section === 'head' && data.column.index > 3) {
                    const dayIdx = data.column.index - 4;
                    const dInfo = days[dayIdx];
                    if (dInfo && dInfo.isSunday) {
                        data.cell.styles.fillColor = [254, 243, 199];
                        data.cell.styles.textColor = [146, 64, 14];
                    }
                }

                // Style body cells
                if (data.section === 'body' && data.column.index > 3) {
                    const val = data.cell.raw;
                    const dayIdx = data.column.index - 4;
                    const dInfo = days[dayIdx];
                    const isSun = dInfo ? dInfo.isSunday : false;

                    if (val === '1') {
                        data.cell.styles.fillColor = isSun ? [167, 243, 208] : [209, 250, 229];
                        data.cell.styles.textColor = [6, 95, 70];
                    } else if (val === '0.5') {
                        data.cell.styles.fillColor = isSun ? [221, 214, 254] : [237, 233, 254];
                        data.cell.styles.textColor = [91, 33, 182];
                    } else if (val === '-') {
                        data.cell.styles.fillColor = [254, 226, 226];
                        data.cell.styles.textColor = [153, 27, 27];
                    } else if (isSun) {
                        data.cell.styles.fillColor = [254, 243, 199];
                        data.cell.styles.textColor = [146, 64, 14];
                    }
                }
            }
        });

        doc.save(`Bang_Cong_T${currentMonth}${leapStr}_${currentYear}_AL.pdf`);
        showToast('Đã xuất file PDF thành công!', 'success');
    }

    /* ---- Import Excel ---- */
    function importExcel(file) {
        if (!file) return;
        if (typeof XLSX === 'undefined') {
            showToast('Thư viện Excel chưa tải xong, vui lòng thử lại!', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                // --- Bước 1: Đọc tiêu đề để xác định Tháng/Năm âm lịch ---
                // Row 0: "BẢNG CHẤM CÔNG THÁNG 2/2026 (ÂM LỊCH)" hoặc "BẢNG CHẤM CÔNG THÁNG 6 Nhuận/2025 (ÂM LỊCH)"
                const titleCell = (aoa[0] && aoa[0][0]) ? String(aoa[0][0]) : '';
                let importMonth = null, importYear = null, importIsLeap = 0;

                // Parse tiêu đề dạng: "THÁNG 2/2026" hoặc "THÁNG 6 Nhuận/2025"
                const titleMatch = titleCell.match(/THÁNG\s+(\d+)(?:\s+Nhuận)?\/(\d{4})/i);
                const leapMatch = titleCell.match(/THÁNG\s+(\d+)\s+Nhuận/i);
                if (titleMatch) {
                    importMonth = parseInt(titleMatch[1]);
                    importYear = parseInt(titleMatch[2]);
                    importIsLeap = leapMatch ? 1 : 0;
                } else {
                    // Fallback: thử đọc từ tên file (VD: Bang_Cong_T2_2026_AL.xlsx)
                    const fnMatch = file.name.match(/T(\d+)(?:Nhuan)?_(\d{4})_AL/i);
                    const fnLeap = file.name.match(/T\d+Nhuan_/i);
                    if (fnMatch) {
                        importMonth = parseInt(fnMatch[1]);
                        importYear = parseInt(fnMatch[2]);
                        importIsLeap = fnLeap ? 1 : 0;
                    }
                }

                if (!importMonth || !importYear) {
                    showToast('Ð Không đọc được tháng/năm từ file! Hãy đảm bảo dùng đúng file xuất ra từ hệ thống.', 'danger');
                    return;
                }

                // --- Bước 2: Tìm dòng header có cột "Mã NV" ---
                // File xuất có cấu trúc: row0=tiêu đề, row1=trống, row2=header solar, row3=header lunar, row4+=dữ liệu
                let headerRowIdx = -1;
                let colIdxId = -1, colIdxName = -1, colIdxTotal = -1, colIdxFirstDay = -1;

                for (let ri = 0; ri < Math.min(aoa.length, 10); ri++) {
                    const row = aoa[ri];
                    for (let ci = 0; ci < row.length; ci++) {
                        const cell = String(row[ci]).trim();
                        if (cell === 'Mã NV' || cell.toLowerCase() === 'ma nv') {
                            headerRowIdx = ri;
                            colIdxId = ci;
                        }
                    }
                    if (headerRowIdx >= 0) break;
                }

                if (headerRowIdx < 0) {
                    showToast('Ð Không tìm thấy cột "Mã NV" trong file! Hãy dùng đúng file xuất từ hệ thống.', 'danger');
                    return;
                }

                const headerRow = aoa[headerRowIdx];
                // Tìm các cột dựa trên header
                for (let ci = 0; ci < headerRow.length; ci++) {
                    const cell = String(headerRow[ci]).trim();
                    if (cell === 'Mã NV' || cell.toLowerCase() === 'ma nv') colIdxId = ci;
                    else if (cell === 'Họ và tên' || cell === 'Họ và tên' || cell.toLowerCase() === 'ho va ten') colIdxName = ci;
                    else if (cell === 'Tổng' || cell.toLowerCase() === 'tong') colIdxTotal = ci;
                }

                // Cột ngày bắt đầu sau cột Tổng
                colIdxFirstDay = (colIdxTotal >= 0) ? colIdxTotal + 1 : colIdxId + 3;

                // Dòng dữ liệu bắt đầu sau dòng header lunar (skip thêm 1 dòng nữa cho header lunar)
                const dataStartRow = headerRowIdx + 2;

                // --- Bước 3: Đọc từng dòng công nhân ---
                const imported = {};
                let matchCount = 0, skipCount = 0;

                for (let ri = dataStartRow; ri < aoa.length; ri++) {
                    const row = aoa[ri];
                    if (!row || row.length === 0) continue;

                    const workerId = String(row[colIdxId] || '').trim();
                    if (!workerId) continue;

                    // Kiểm tra có trong danh sách công nhân không
                    const worker = workers.find(w => w.id === workerId);
                    if (!worker) { skipCount++; continue; }

                    const workerDays = {};
                    for (let ci = colIdxFirstDay; ci < row.length; ci++) {
                        const dayNum = ci - colIdxFirstDay + 1;
                        const rawVal = row[ci];
                        const cellStr = String(rawVal).trim();

                        let val = '';
                        if (cellStr === '1' || rawVal === 1) val = 1;
                        else if (cellStr === '0.5' || rawVal === 0.5) val = 0.5;
                        else if (cellStr === '-' || cellStr === '0' || rawVal === 0) val = 0;
                        // trống thì giữ nguyên '', không ghi

                        if (val !== '') {
                            workerDays[dayNum] = val;
                        }
                    }
                    imported[workerId] = workerDays;
                    matchCount++;
                }

                if (matchCount === 0) {
                    showToast('Ð Không tìm thấy công nhân nào khớp! Kiểm tra lại Mã NV trong file.', 'danger');
                    return;
                }

                // --- Bước 4: Xác nhận rồi áp dụng ---
                const leapLabel = importIsLeap ? ' Nhuận' : '';
                const confirmMsg = `Nhập bảng công T${importMonth}${leapLabel}/${importYear} ÂL cho ${matchCount} công nhân${skipCount > 0 ? ` (bỏ qua ${skipCount} mã không tìm thấy)` : ''}?`;

                showConfirm('📥', 'Nhập Excel vào Bảng Công?', confirmMsg, () => {
                    // Đổi sang đúng tháng/năm nếu khác hiện tại
                    if (importMonth !== currentMonth || importYear !== currentYear || importIsLeap !== currentIsLeap) {
                        currentMonth = importMonth;
                        currentYear = importYear;
                        currentIsLeap = importIsLeap;

                        // Cập nhật picker
                        const yearInp = $('att-year');
                        if (yearInp) yearInp.value = importYear;
                        renderMonthOptions();
                    }

                    // Ghi dữ liệu vào monthData, giữ các ngày chưa có trong file nguyên vẹn
                    Object.entries(imported).forEach(([wid, days]) => {
                        if (!monthData[wid]) monthData[wid] = {};
                        Object.assign(monthData[wid], days);
                    });

                    hasChanges = true;

                    // Load lại đúng tháng âm để có currentMonthDetail đúng
                    const storageMonthKey = importIsLeap ? (importMonth + 100) : importMonth;
                    if (typeof LunarCalendar !== 'undefined') {
                        currentMonthDetail = LunarCalendar.getLunarMonthDaysDetail(importMonth, importYear, importIsLeap);
                    }

                    renderGrid(importYear, importMonth, importIsLeap);
                    renderSummary();

                    const skipNote = skipCount > 0 ? ` (Bỏ qua ${skipCount} mã không tìm thấy)` : '';
                    showToast(`Ð Nhập thành công ${matchCount} công nhân T${importMonth}${leapLabel}/${importYear} ÂL!${skipNote} Nhớ nhấn Lưu!`, 'success');
                });

            } catch (err) {
                console.error('Import Excel error:', err);
                showToast('Ð Lỗi khi đọc file Excel! Hãy đảm bảo đúng định dạng (.xlsx/.xls).', 'danger');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    /* ---- Setup Import Button ---- */
    function setupImportButton() {
        const btnImport = document.getElementById('att-btn-import-excel');
        const fileInput = document.getElementById('att-import-file');
        if (!btnImport || !fileInput) return;

        btnImport.addEventListener('click', () => {
            fileInput.value = ''; // reset để cho phép chọn lại cùng file
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) importExcel(file);
        });
    }

    /* ---- Helpers ---- */
    function cellClass(val, isSun) {
        if (val === '' || val === undefined) return isSun ? 'c-empty c-sun' : 'c-empty';
        if (val === 0) return isSun ? 'c-off c-sun' : 'c-off';
        if (val === 0.5) return 'c-half';
        return 'c-full';
    }

    function cellLabel(val, isSun) {
        if (val === 1) return '<span style="font-weight:700;font-size:.82rem">1</span>';
        if (val === 0.5) return '<span style="font-weight:700;font-size:.78rem">0.5</span>';
        if (val === 0) return '<i class="bi bi-dash-lg"></i>';
        return isSun ? '<i class="bi bi-brightness-high" style="font-size:.7rem"></i>' : '';
    }

    function cellTitle(val) {
        if (val === '' || val === undefined) return 'Chưa chấm – nhấn để đánh dấu';
        if (val === 0) return 'Nghỉ';
        if (val === 0.5) return 'Nửa ngày (0.5 công)';
        return 'Đi làm (1 ngày công)';
    }

    function formatTotal(n) {
        return Number.isInteger(n) ? n.toString() : n.toFixed(1);
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    return { init, save, clearMonth, exportExcel, exportPdf, setupImportButton };
})();
