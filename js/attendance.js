/**
 * AttendanceModule - Bảng Công theo Tháng
 * Trạng thái: 0 → trống (→ click) → 1 (đầy đủ) → 0.5 (nửa ngày) → 0 (nghỉ) → vòng lại
 */
const AttendanceModule = (() => {
    const CYCLE = [1, 0.5, 0]; // click cycle
    let currentYear = new Date().getFullYear();
    let currentMonth = new Date().getMonth() + 1;
    let monthData = {};  // { workerId: { day: value } }
    let workers = [];
    let hasChanges = false;

    const $ = id => document.getElementById(id);

    function init() {
        workers = StorageManager.getWorkers().filter(w => w.trangThai === 'active');
        setupPicker();
        load(currentYear, currentMonth);
    }

    /* ---- Picker ---- */
    function setupPicker() {
        const monthSel = $('att-month');
        const yearInp = $('att-year');
        const searchInp = $('att-search');

        monthSel.value = currentMonth;
        yearInp.value = currentYear;

        monthSel.addEventListener('change', () => {
            currentMonth = parseInt(monthSel.value);
            load(currentYear, currentMonth);
            if (searchInp) searchInp.value = ''; // Reset search on month change
        });
        yearInp.addEventListener('change', () => {
            currentYear = parseInt(yearInp.value);
            load(currentYear, currentMonth);
            if (searchInp) searchInp.value = ''; // Reset search on year change
        });

        if (searchInp) {
            searchInp.addEventListener('input', (e) => {
                renderGrid(currentYear, currentMonth, e.target.value);
            });
        }
    }

    /* ---- Load ---- */
    function load(year, month) {
        hasChanges = false;
        monthData = deepClone(StorageManager.getMonthAttendance(year, month));
        renderGrid(year, month);
        renderSummary();
    }

    /* ---- Render Grid ---- */
    function renderGrid(year, month, filterText = '') {
        const daysInMonth = new Date(year, month, 0).getDate();
        const thead = $('att-thead');
        const tbody = $('att-tbody');
        const searchVal = filterText.toLowerCase().trim();

        /* Header row */
        let thHtml = `<th class="th-stt col-stt" rowspan="2">#</th>`;
        thHtml += `<th class="th-name col-name" rowspan="2">Công nhân</th>`;
        thHtml += `<th class="th-total col-total" rowspan="2">Tổng</th>`;
        for (let d = 1; d <= daysInMonth; d++) {
            const dow = new Date(year, month - 1, d).getDay(); // 0=Sun
            const isSun = dow === 0;
            thHtml += `<th title="${d}/${month}/${year}" class="${isSun ? 'sunday-head th-sun' : ''}" style="${isSun ? 'background:#fef3c7;color:#92400e' : ''}">${d}</th>`;
        }
        thead.innerHTML = `<tr>${thHtml}</tr>`;

        /* Filter workers */
        const filteredWorkers = workers.filter(w => {
            if (!searchVal) return true;
            return w.hoTen.toLowerCase().includes(searchVal) || w.id.toLowerCase().includes(searchVal);
        });

        /* Body rows */
        if (!filteredWorkers.length) {
            tbody.innerHTML = `<tr><td colspan="${daysInMonth + 2}" style="text-align:center;padding:2rem;color:var(--text-muted)">Không tìm thấy công nhân phù hợp</td></tr>`;
            return;
        }

        tbody.innerHTML = filteredWorkers.map((w, index) => {
            const wd = monthData[w.id] || {};
            let total = 0;
            let cells = '';
            for (let d = 1; d <= daysInMonth; d++) {
                const val = (wd[d] !== undefined) ? wd[d] : '';
                const dow = new Date(year, month - 1, d).getDay();
                const isSun = dow === 0;
                const cls = cellClass(val, isSun);
                const lbl = cellLabel(val, isSun);
                total += (val === '' || val === undefined) ? 0 : parseFloat(val) || 0;
                cells += `<td><div class="att-cell ${cls}" data-id="${w.id}" data-day="${d}" title="${cellTitle(val)}">${lbl}</div></td>`;
            }
            return `<tr>
        <td class="stt-cell text-muted text-center align-middle" style="font-size:.8rem">${index + 1}</td>
        <td class="name-cell">
          <span style="font-size:.75rem;color:var(--text-muted)">${w.id}</span>
          <div>${w.hoTen}</div>
        </td>
        <td class="total-cell td-total att-total-${w.id}">${formatTotal(total)}</td>
        ${cells}
      </tr>`;
        }).join('');

        /* Delegate click */
        tbody.onclick = e => {
            const cell = e.target.closest('.att-cell');
            if (!cell) return;

            // Remove previous active row highlight
            document.querySelectorAll('.att-table tr.tr-active').forEach(tr => tr.classList.remove('tr-active'));

            // Highlight current row
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

        // Update this cell visually
        const dow = new Date(currentYear, currentMonth - 1, day).getDay();
        const isSun = dow === 0;
        cell.className = `att-cell ${cellClass(next, isSun)}`;
        cell.title = cellTitle(next);
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
            el.textContent = `Tổng công toàn đội tháng này: ${formatTotal(grandTotal)} công`;
        }
    }

    /* ---- Save ---- */
    function save() {
        showConfirm('💾', 'Lưu bảng công?',
            `Xác nhận lưu dữ liệu chấm công tháng ${currentMonth}/${currentYear}?`,
            () => {
                StorageManager.saveMonthAttendance(currentYear, currentMonth, monthData);
                hasChanges = false;
                showToast(`Đã lưu bảng công tháng ${currentMonth}/${currentYear}!`, 'success');
            }
        );
    }

    /* ---- Clear month ---- */
    function clearMonth() {
        showConfirm('🔄', 'Xóa bảng công?',
            `Xóa toàn bộ dữ liệu tháng ${currentMonth}/${currentYear}?`,
            () => {
                monthData = {};
                StorageManager.saveMonthAttendance(currentYear, currentMonth, {});
                renderGrid(currentYear, currentMonth);
                renderSummary();
                showToast('Đã xóa bảng công!', 'info');
            }
        );
    }

    /* ---- Export ---- */
    function exportExcel() {
        const title = `Bảng chấm công tháng ${currentMonth}/${currentYear}`;
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

        // 1. Dòng tiêu đề lớn
        const aoaData = [];
        aoaData.push([title]);
        aoaData.push([]); // Dòng trống

        // 2. Dòng Header
        const headerRow = ['STT', 'Mã - Tên công nhân', 'Tổng'];
        for (let d = 1; d <= daysInMonth; d++) {
            headerRow.push(d.toString());
        }
        aoaData.push(headerRow);

        // 3. Chuẩn bị dữ liệu hiển thị (có filter)
        const searchInp = document.getElementById('att-search');
        const searchVal = searchInp ? searchInp.value.toLowerCase().trim() : '';
        const filteredWorkers = workers.filter(w => {
            if (!searchVal) return true;
            return w.hoTen.toLowerCase().includes(searchVal) || w.id.toLowerCase().includes(searchVal);
        });

        // 4. Fill Data body
        filteredWorkers.forEach((w, index) => {
            const wd = monthData[w.id] || {};
            let total = 0;
            const row = [
                index + 1,
                `${w.id} - ${w.hoTen}`
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

            row.push(Number.isInteger(total) ? total : Number(total.toFixed(1))); // Cột tổng
            aoaData.push(row.concat(daysData));
        });

        // 5. Tạo Worksheet và Workbook
        const ws = XLSX.utils.aoa_to_sheet(aoaData);

        // Styling and Merging via SheetJS is largely unavailable in the free community version.
        // We set column widths instead to make it look nice.
        const cols = [
            { wch: 5 },   // STT
            { wch: 30 },  // Name
            { wch: 8 },   // Total
        ];
        for (let d = 1; d <= daysInMonth; d++) {
            cols.push({ wch: 4 }); // Day columns
        }
        ws['!cols'] = cols;

        // Merge Title
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: daysInMonth + 2 } });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Tháng ${currentMonth}`);

        XLSX.writeFile(wb, `Bang_Cong_T${currentMonth}_${currentYear}.xlsx`);
        showToast('Đã xuất file Excel!', 'success');
    }

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

        // Add font if needed later, but standard is fine for numbers. 
        // For Vietnamese text we need to use standard fonts or provide a base64 font. 
        // Since standard jsPDF doesn't support full utf8 vi out of the box without custom fonts,
        // we will strip diacritics for the guaranteed PDF export or rely on autoTable defaults.
        const removeAccents = (str) => {
            return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
        };

        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

        // Prepare headers
        const head = [['STT', 'Ten cong nhan', 'Tong']];
        for (let d = 1; d <= daysInMonth; d++) {
            head[0].push(d.toString());
        }

        // Prepare body
        const searchInp = document.getElementById('att-search');
        const searchVal = searchInp ? searchInp.value.toLowerCase().trim() : '';

        const filteredWorkers = workers.filter(w => {
            if (!searchVal) return true;
            return w.hoTen.toLowerCase().includes(searchVal) || w.id.toLowerCase().includes(searchVal);
        });

        const body = filteredWorkers.map((w, index) => {
            const wd = monthData[w.id] || {};
            let total = 0;
            const row = [
                (index + 1).toString(),
                `${w.id} - ${removeAccents(w.hoTen)}`,
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

        const title = `Bang cham cong thang ${currentMonth}/${currentYear}`;

        doc.setFontSize(16);
        doc.text(title, doc.internal.pageSize.width / 2, 30, { align: 'center' });

        doc.autoTable({
            head: head,
            body: body,
            startY: 50,
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 3,
                halign: 'center',
                valign: 'middle'
            },
            headStyles: {
                fillColor: [241, 245, 249],
                textColor: [15, 23, 42],
                fontStyle: 'bold'
            },
            columnStyles: {
                1: { halign: 'left', cellWidth: 120 }, // Name column
                2: { fontStyle: 'bold', textColor: [5, 150, 105] } // Total column
            },
            didParseCell: function (data) {
                // Style sundays in header
                if (data.section === 'head' && data.column.index > 2) {
                    const day = parseInt(data.cell.raw);
                    const dow = new Date(currentYear, currentMonth - 1, day).getDay();
                    if (dow === 0) {
                        data.cell.styles.fillColor = [254, 243, 199];
                        data.cell.styles.textColor = [146, 64, 14];
                    }
                }

                // Style body cells
                if (data.section === 'body' && data.column.index > 2) {
                    const val = data.cell.raw;
                    const day = data.column.index - 2;
                    const dow = new Date(currentYear, currentMonth - 1, day).getDay();
                    const isSun = dow === 0;

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

        doc.save(`Bang_Cong_T${currentMonth}_${currentYear}.pdf`);
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
