/**
 * app.js - Bootstrap toàn bộ ứng dụng Tính Công
 */

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
function showToast(msg, type = 'info') {
    const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
    const colors = { success: 'text-success', error: 'text-danger', info: 'text-primary' };
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'alert alert-light d-flex align-items-center gap-2 shadow mb-1 py-2 px-3';
    el.style.cssText = 'border-radius:10px;font-size:.875rem;font-weight:500;min-width:240px;animation:fadeInRight .25s ease';
    el.innerHTML = `<i class="bi ${icons[type] || icons.info} ${colors[type] || colors.info}"></i><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 2800);
}

/* ============================================================
   CONFIRM DIALOG
   ============================================================ */
let _confirmCallback = null;
/**
 * Hiển thị hộp thoại xác nhận.
 * @param {string} icon
 * @param {string} title
 * @param {string} msg
 * @param {Function} onOk - Callback khi nhấn nút xác nhận chính
 * @param {Object} [opts] - Tùy chọn mở rộng:
 *   opts.confirmLabel  {string}  Nhãn nút xác nhận (mặc định: 'Xác nhận')
 *   opts.cancelLabel   {string}  Nhãn nút hủy     (mặc định: 'Hủy')
 *   opts.dangerBtn     {boolean} Nút chính màu đỏ (mặc định: true)
 *   opts.extraBtn      {Object}  Nút phụ: { label, onClick } hoặc { label, href }
 */
function showConfirm(icon, title, msg, onOk, opts = {}) {
    _confirmCallback = onOk;

    const confirmIcon = document.getElementById('confirm-icon');
    if (confirmIcon) confirmIcon.textContent = icon;
    const confirmTitle = document.getElementById('confirm-title');
    if (confirmTitle) confirmTitle.textContent = title;
    const confirmMsg = document.getElementById('confirm-msg');
    if (confirmMsg) confirmMsg.innerHTML = msg;

    // Cập nhật nút chính (Xác nhận)
    const confirmOkBtn = document.getElementById('confirm-ok');
    if (confirmOkBtn) {
        confirmOkBtn.textContent = opts.confirmLabel || 'Xác nhận';
        confirmOkBtn.className = 'btn btn-sm px-3 w-100 text-nowrap';
        confirmOkBtn.classList.add((opts.dangerBtn === false) ? 'btn-primary' : 'btn-danger');
    }

    // Cập nhật nút Hủy
    const cancelBtn = document.querySelector('#confirm-modal [data-bs-dismiss="modal"]');
    if (cancelBtn) {
        cancelBtn.textContent = opts.cancelLabel || 'Hủy';
        cancelBtn.className = 'btn btn-sm btn-outline-secondary px-3 w-100 text-nowrap';
    }

    // Đổi layout container sang flex-column khi có extraBtn, flex-row khi không
    const btnArea = document.querySelector('#confirm-modal .confirm-btn-area');
    // Thêm/xóa nút phụ (rời trang không lưu)
    const extraBtnId = 'confirm-extra-btn';
    let extraEl = document.getElementById(extraBtnId);
    if (opts.extraBtn) {
        if (!extraEl) {
            extraEl = document.createElement('button');
            extraEl.id = extraBtnId;
            extraEl.className = 'btn btn-sm btn-outline-danger px-3 w-100 text-nowrap';
            // Chèn vào đầu btnArea (trước nút Hủy)
            if (btnArea) btnArea.insertBefore(extraEl, btnArea.firstChild);
        }
        extraEl.textContent = opts.extraBtn.label || 'Tiếp tục';
        extraEl.onclick = () => {
            const confirmModalEl = document.getElementById('confirm-modal');
            if (confirmModalEl) bootstrap.Modal.getInstance(confirmModalEl)?.hide();
            if (opts.extraBtn.onClick) opts.extraBtn.onClick();
            else if (opts.extraBtn.href) window.location.href = opts.extraBtn.href;
        };
        extraEl.style.display = '';
        if (btnArea) btnArea.className = 'confirm-btn-area d-flex flex-column gap-2';
    } else {
        if (extraEl) extraEl.style.display = 'none';
        // Khôi phục layout ngang khi không có extraBtn
        if (btnArea) btnArea.className = 'confirm-btn-area d-flex flex-row gap-2 justify-content-center';
    }

    const confirmModalEl = document.getElementById('confirm-modal');
    if (confirmModalEl) new bootstrap.Modal(confirmModalEl).show();
}
document.addEventListener('DOMContentLoaded', () => {
    const confirmOkBtn = document.getElementById('confirm-ok');
    if (confirmOkBtn) {
        confirmOkBtn.addEventListener('click', () => {
            const confirmModalEl = document.getElementById('confirm-modal');
            if (confirmModalEl) bootstrap.Modal.getInstance(confirmModalEl)?.hide();
            if (_confirmCallback) _confirmCallback();
        });
    }
});


/* ============================================================
   NAVIGATION
   ============================================================ */
function closeSidebarMobile() {
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('show');
    }
}

/* ============================================================
   BOOTSTRAP / INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    // Init Supabase Sync Cache
    await StorageManager.initialize();

    // Sidebar toggle (mobile)
    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebar-overlay').classList.toggle('show');
    });
    document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebarMobile);

    // Sidebar collapse/expand (desktop)
    const sidebar = document.getElementById('sidebar');
    const btnCollapse = document.getElementById('btn-collapse-sidebar');
    const collapseIcon = btnCollapse.querySelector('i');

    // Restore saved state
    if (localStorage.getItem('tc_sidebar_collapsed') === '1') {
        sidebar.classList.add('collapsed');
        document.body.classList.add('sidebar-collapsed');
        collapseIcon.className = 'bi bi-layout-sidebar';
    }

    btnCollapse.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        document.body.classList.toggle('sidebar-collapsed', isCollapsed);
        collapseIcon.className = isCollapsed ? 'bi bi-layout-sidebar' : 'bi bi-layout-sidebar-reverse';
        localStorage.setItem('tc_sidebar_collapsed', isCollapsed ? '1' : '0');
    });

    // ── Hiển thị tài khoản đang đăng nhập ──
    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (sidebarFooter && typeof authGetSession === 'function') {
        const sess = authGetSession();
        if (sess) {
            const chip = document.createElement('div');
            chip.className = 'sidebar-user-chip';
            chip.innerHTML = `
                <div class="suc-avatar">${sess.avatar || '👤'}</div>
                <div class="suc-info nav-label">
                    <div class="suc-name">${sess.username}</div>
                    <div class="suc-role">${sess.role || ''}</div>
                </div>`;
            sidebarFooter.prepend(chip);
        }
    }

    // Nav links handling for active state on current page is already done in HTML

    // Bảng công (Attendance) Page Context
    if (document.getElementById('sec-monthly')) {
        document.getElementById('att-btn-save')?.addEventListener('click', () => AttendanceModule.save());
        document.getElementById('att-btn-clear')?.addEventListener('click', () => AttendanceModule.clearMonth());
        document.getElementById('att-btn-export-excel')?.addEventListener('click', () => AttendanceModule.exportExcel());
        document.getElementById('att-btn-export-pdf')?.addEventListener('click', () => AttendanceModule.exportPdf());

        StorageManager.getWorkers(); // ensure seed for attendance
        AttendanceModule.init();
    }

    // Công Nhân (Workers) Page Context
    if (document.getElementById('sec-workers')) {
        document.getElementById('wk-btn-add')?.addEventListener('click', () => WorkersModule.openAdd());

        StorageManager.getWorkers();
        WorkersModule.init();
    }

    // Quản lý Ứng Tiền (Advances) Page Context
    if (document.getElementById('sec-advances')) {
        document.getElementById('adv-btn-add')?.addEventListener('click', () => AdvancesModule.openAdd());

        StorageManager.getWorkers(); // need workers for select
        AdvancesModule.init();
    }

    // Tổng Hợp Năm (Annual) Page Context
    if (document.getElementById('sec-annual')) {
        AnnualModule.init();
    }

    // Thanh Toán Lương (Payment) Page Context
    if (document.getElementById('sec-payment')) {
        PaymentModule.init();
    }

});

// Inline keyframes for toast animation
const style = document.createElement('style');
style.textContent = `@keyframes fadeInRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}`;
document.head.appendChild(style);
