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

    const $ = id => document.getElementById(id);

    function init() {
        workers = StorageManager.getWorkers().filter(w => w.trangThai === 'active');
        setupPicker();
        load(currentYear, currentMonth, currentIsLeap);
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

            // Hàng 1: Dương lịch
            thSolarRow += `<th title="${d.fullDayOfWeekStr}, ngày ${d.solarFullFormatted} (Dương lịch)"
                               class="${sunClass}" 
                               style="${solarBg} font-size:.65rem; padding:3px 2px; font-weight:600; border-bottom: 1px dashed rgba(0,0,0,0.12);">
                               ${d.solarFormatted}
                           </th>`;

            // Hàng 2: Âm lịch
            thLunarRow += `<th title="Mùng ${d.lunarDay} Tháng ${month}${isLeap ? ' Nhuận' : ''} Âm lịch (${d.fullDayOfWeekStr}, ${d.solarFullFormatted} Dương)"
                              class="${sunClass}" 
                              style="${lunarBg} font-size:.78rem; padding:4px 2px; font-weight:800;">
                              ${d.lunarDay}
                          </th>`;
        });

        thead.innerHTML = `<tr>${thSolarRow}</tr><tr>${thLunarRow}</tr>`;

        /* Filter workers */
        const filteredWorkers = filterWorkers(workers, filterText);

        /* Body rows */
        if (!filteredWorkers.length) {
            tbody.innerHTML = `<tr><td colspan="${daysInMonth + 4}" style="text-align:center;padding:2rem;color:var(--text-muted)">Không tìm thấy công nhân phù hợp</td></tr>`;
            return;
        }

        tbody.innerHTML = filteredWorkers.map((w, index) => {
            const wd = monthData[w.id] || {};
            let total = 0;
            let cells = '';

            for (let d = 1; d <= daysInMonth; d++) {
                const dayInfo = days[d - 1];
                const isSun = dayInfo.isSunday;
                const val = (wd[d] !== undefined) ? wd[d] : '';
                const cls = cellClass(val, isSun);
                const lbl = cellLabel(val, isSun);
                total += (val === '' || val === undefined) ? 0 : parseFloat(val) || 0;

                const tip = `Mùng ${d} ÂL (${dayInfo.solarFormatted} DL - ${dayInfo.fullDayOfWeekStr}): ${cellTitle(val)}`;
                cells += `<td><div class="att-cell ${cls}" data-id="${w.id}" data-day="${d}" title="${tip}">${lbl}</div></td>`;
            }

            return `<tr>
                <td class="stt-cell text-muted text-center align-middle" style="font-size:.8rem">${index + 1}</td>
                <td class="code-cell text-center align-middle">
                    <span class="badge bg-light text-primary fw-bold border" style="font-size:.74rem">${w.id}</span>
                </td>
                <td class="name-cell align-middle">
                    <div class="fw-semibold text-dark">${w.hoTen}</div>
                </td>
                <td class="total-cell td-total att-total-${w.id} text-center align-middle">${formatTotal(total)}</td>
                ${cells}
            </tr>`;
        }).join('');

        /* Delegate click */
        tbody.onclick = e => {
            const cell = e.target.closest('.att-cell');
            if (!cell) return;

            document.querySelectorAll('.att-table tr.tr-active').forEach(tr => tr.classList.remove('tr-active'));
            cell.closest('tr').classList.add('tr-active');

            toggleCell(cell);
        };
    }

    function toggleCell(cell) {
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

        // 2. Dòng Header 1: Dương Lịch
        const headerSolar = ['STT', 'Mã NV', 'Họ và tên', 'Tổng'];
        days.forEach(d => {
            headerSolar.push(d.solarFormatted + ' (DL)');
        });
        aoaData.push(headerSolar);

        // 3. Dòng Header 2: Âm Lịch
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

    return { init, save, clearMonth, exportExcel, exportPdf };
})();
