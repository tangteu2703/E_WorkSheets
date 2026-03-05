/**
 * WorkersModule - Quản lý Công nhân
 */
const WorkersModule = (() => {
    let workers = [];
    let editingId = null;
    let searchQuery = '';

    /* ---- DOM refs ---- */
    const $ = id => document.getElementById(id);

    function init() {
        workers = StorageManager.getWorkers();
        renderTable();
        bindEvents();
    }

    /* ---- Render ---- */
    function renderTable() {
        const tbody = $('wk-tbody');
        const active = workers.filter(w => w.trangThai === 'active');
        const filtered = workers.filter(w => {
            const q = searchQuery.toLowerCase();
            return w.hoTen.toLowerCase().includes(q) ||
                w.id.toLowerCase().includes(q) ||
                (w.phongBan || '').toLowerCase().includes(q);
        });

        // Stats
        $('wk-stat-total').textContent = workers.length;
        $('wk-stat-active').textContent = active.length;
        $('wk-stat-depts').textContent = [...new Set(workers.map(w => w.phongBan).filter(Boolean))].length;

        if (!filtered.length) {
            tbody.innerHTML = `<tr class="no-data-row"><td colspan="7"><i class="bi bi-inbox" style="font-size:2rem;display:block;margin-bottom:.5rem;opacity:.3"></i>Không có dữ liệu</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map((w, i) => `
      <tr>
        <td class="text-muted" style="font-size:.8rem">${i + 1}</td>
        <td><span class="worker-id-badge">${w.id}</span></td>
        <td><span class="fw-semibold">${w.hoTen}</span></td>
        <td class="d-none d-md-table-cell text-muted">${formatDate(w.ngaySinh) || '—'}</td>
        <td class="d-none d-md-table-cell text-muted">${w.soDienThoai || '—'}</td>
        <td class="d-none d-md-table-cell">${w.phongBan || '—'}</td>
        <td class="d-none d-lg-table-cell text-muted">${w.chucVu || '—'}</td>
        <td class="d-flex text-center">
          <button class="btn-action-lux edit" onclick="WorkersModule.openEdit('${w.id}')" title="Sửa"><i class="bi bi-pencil"></i></button>
          <button class="btn-action-lux delete ms-1" onclick="WorkersModule.confirmDelete('${w.id}')" title="Xóa"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `).join('');
    }

    /* ---- Events ---- */
    function bindEvents() {
        $('wk-search').addEventListener('input', e => {
            searchQuery = e.target.value;
            renderTable();
        });

        $('wk-form').addEventListener('submit', e => {
            e.preventDefault();
            save();
        });
    }

    /* ---- CRUD ---- */
    function openAdd() {
        editingId = null;
        $('wk-modal-title').textContent = '➕ Thêm Công Nhân';
        $('wk-form').reset();
        $('wk-id-field').value = StorageManager.generateWorkerId(workers);
        $('wk-id-field').readOnly = true;
        clearValidation();
        new bootstrap.Modal($('wk-modal')).show();
    }

    function openEdit(id) {
        const w = workers.find(x => x.id === id);
        if (!w) return;
        editingId = id;
        $('wk-modal-title').textContent = '✏️ Sửa Công Nhân';
        $('wk-id-field').value = w.id;
        $('wk-id-field').readOnly = true;
        $('wk-name-field').value = w.hoTen;
        $('wk-birth-field').value = w.ngaySinh || '';
        $('wk-dept-field').value = w.phongBan || '';
        $('wk-pos-field').value = w.chucVu || '';
        $('wk-phone-field').value = w.soDienThoai || '';
        $('wk-status-field').value = w.trangThai || 'active';
        clearValidation();
        new bootstrap.Modal($('wk-modal')).show();
    }

    function save() {
        const name = $('wk-name-field').value.trim();
        if (!name) {
            $('wk-name-field').classList.add('is-invalid');
            return;
        }
        $('wk-name-field').classList.remove('is-invalid');

        const payload = {
            id: $('wk-id-field').value,
            hoTen: name,
            ngaySinh: $('wk-birth-field').value,
            phongBan: $('wk-dept-field').value.trim(),
            chucVu: $('wk-pos-field').value.trim(),
            soDienThoai: $('wk-phone-field').value.trim(),
            trangThai: $('wk-status-field').value,
        };

        if (editingId) {
            const idx = workers.findIndex(w => w.id === editingId);
            workers[idx] = payload;
            showToast('Đã cập nhật công nhân!', 'success');
        } else {
            workers.push(payload);
            showToast('Đã thêm công nhân mới!', 'success');
        }

        StorageManager.saveWorkers(workers);
        renderTable();
        bootstrap.Modal.getInstance($('wk-modal')).hide();
    }

    function confirmDelete(id) {
        const w = workers.find(x => x.id === id);
        if (!w) return;
        showConfirm(
            '🗑️',
            'Xoá công nhân?',
            `Bạn có chắc muốn xóa <strong>${w.hoTen}</strong>? Dữ liệu bảng công liên quan sẽ không bị xóa.`,
            () => deleteWorker(id)
        );
    }

    function deleteWorker(id) {
        workers = workers.filter(w => w.id !== id);
        StorageManager.saveWorkers(workers);
        renderTable();
        showToast('Đã xóa công nhân!', 'error');
    }

    function clearValidation() {
        document.querySelectorAll('#wk-form .is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }

    return { init, openAdd, openEdit, confirmDelete };
})();

/* ---- Helpers ---- */
function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}
