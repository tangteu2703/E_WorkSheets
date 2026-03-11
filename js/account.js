/**
 * AccountsModule - Quản lý Tài Khoản & Khuôn mặt
 */
const AccountsModule = (() => {
    let accounts = [];
    let searchQuery = '';
    let editingUsername = null;

    const $ = id => document.getElementById(id);

    async function init() {
        if (!window.supabaseClient) {
            console.error("Supabase Client chưa được khởi tạo");
            return;
        }
        await loadAccounts();
        bindEvents();
    }

    /* ---- Lấy dữ liệu ---- */
    async function loadAccounts() {
        showLoading(true);
        try {
            const { data, error } = await window.supabaseClient.from('accounts').select('username, fullname, role, face_descriptor, created_at').order('created_at', { ascending: false });
            if (error) throw error;
            accounts = data || [];
            renderTable();
        } catch (err) {
            console.error(err);
            showToast('Lỗi tải danh sách tài khoản', 'error');
            $('acc-tbody').innerHTML = `<tr><td colspan="7" class="text-center text-danger">Lỗi kết nối máy chủ</td></tr>`;
        }
        showLoading(false);
    }

    /* ---- Render ---- */
    function renderTable() {
        const tbody = $('acc-tbody');
        const mobileList = $('acc-mobile-list');

        const filtered = accounts.filter(a => {
            const q = searchQuery.toLowerCase();
            return (a.username || '').toLowerCase().includes(q) ||
                (a.fullname || '').toLowerCase().includes(q);
        });

        // Stats
        $('acc-stat-total').textContent = accounts.length;
        $('acc-stat-face').textContent = accounts.filter(a => a.face_descriptor).length;

        if (!filtered.length) {
            const emptyHtml = `<div class="text-center text-muted py-5"><i class="bi bi-person-x fs-1 d-block mb-2 opacity-50"></i>Không có tài khoản nào</div>`;
            tbody.innerHTML = `<tr><td colspan="7">${emptyHtml}</td></tr>`;
            mobileList.innerHTML = emptyHtml;
            return;
        }

        const renderItems = filtered.map((a, i) => {
            const hasFace = !!a.face_descriptor;
            const faceIcon = hasFace ? `<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25" title="Đã có Face ID"><i class="bi bi-check-circle-fill me-1"></i>Đã cài</span>` : `<span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25" title="Chưa cài Face ID"><i class="bi bi-x-circle me-1"></i>Chưa cài</span>`;

            let roleBadge = '';
            if (a.role === 'admin') {
                roleBadge = `<span class="badge bg-primary rounded-pill"><i class="bi bi-shield-lock-fill me-1"></i>Admin</span>`;
            } else if (a.role === 'accountancy') {
                roleBadge = `<span class="badge bg-info text-dark rounded-pill"><i class="bi bi-calculator-fill me-1"></i>Kế toán</span>`;
            } else {
                roleBadge = `<span class="badge bg-light text-dark border rounded-pill"><i class="bi bi-person me-1"></i>User</span>`;
            }

            const btnFace = `<button class="btn btn-sm ${hasFace ? 'btn-outline-success' : 'btn-outline-primary'} d-flex align-items-center gap-1 mx-auto" onclick="AccountsModule.openFaceReg('${a.username}')"><i class="bi bi-person-bounding-box"></i> ${hasFace ? 'Face ID' : 'Face ID'}</button>`;

            let dateStr = '—';
            if (a.created_at) {
                const d = new Date(a.created_at);
                dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
            }

            const btnAction = `
                <div class="d-flex text-center justify-content-center">
                    <button class="btn-action-lux edit me-1" onclick="AccountsModule.openEdit('${a.username}')" title="Sửa"><i class="bi bi-pencil"></i></button>
                    ${a.username !== 'admin' ? `<button class="btn-action-lux delete" onclick="AccountsModule.confirmDelete('${a.username}')" title="Xóa"><i class="bi bi-trash"></i></button>` : ''}
                </div>
            `;

            return `
              <tr>
                <td class="text-muted" style="font-size:.8rem">${i + 1}</td>
                <td><span class="fw-bold" style="color:var(--primary-dark)">${a.username}</span></td>
                <td><span class="fw-semibold">${a.fullname || '—'}</span></td>
                <td>${faceIcon}</td>
                <td>${roleBadge}</td>
                <td class="text-muted small">${dateStr}</td>
                <td class="text-center">${btnFace}</td>
                <td class="text-center">${btnAction}</td>
              </tr>
            `;
        }).join('');

        tbody.innerHTML = renderItems;

        // Mobile list (Mô phỏng giống list UI)
        mobileList.innerHTML = filtered.map(a => {
            const hasFace = !!a.face_descriptor;
            return `
            <div class="card mb-2 shadow-sm border-0 rounded-3">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <span class="fw-bold text-dark d-block">@${a.username}</span>
                            <small class="text-muted">${a.fullname || '—'}</small>
                        </div>
                        <span class="badge ${a.role === 'admin' ? 'bg-primary' : (a.role === 'accountancy' ? 'bg-info text-dark' : 'bg-secondary')}">${a.role === 'admin' ? 'Admin' : (a.role === 'accountancy' ? 'Kế toán' : 'User')}</span>
                    </div>
                    <div class="mt-3 d-flex justify-content-between align-items-center">
                        <div>
                            ${hasFace ? '<span class="text-success small"><i class="bi bi-check-circle-fill"></i> Có Face ID</span>' : '<span class="text-muted small"><i class="bi bi-x-circle"></i> Chưa cài Face</span>'}
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm ${hasFace ? 'btn-success' : 'btn-primary'}" onclick="AccountsModule.openFaceReg('${a.username}')" title="Face ID">
                                <i class="bi bi-person-bounding-box"></i>
                            </button>
                            <button class="btn btn-sm btn-light text-primary border" onclick="AccountsModule.openEdit('${a.username}')" title="Sửa"><i class="bi bi-pencil"></i></button>
                            ${a.username !== 'admin' ? `<button class="btn btn-sm btn-light text-danger border" onclick="AccountsModule.confirmDelete('${a.username}')" title="Xóa"><i class="bi bi-trash"></i></button>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    /* ---- Events ---- */
    function bindEvents() {
        $('acc-search').addEventListener('input', e => {
            searchQuery = e.target.value;
            renderTable();
        });

        /* Face Registration UI Events */
        $('btnStartFaceReg').addEventListener('click', startFaceScanProcess);

        // Dừng camera nếu đóng modal bằng nút X hoặc click ngoài
        const faceModalEl = $('faceRegisterModal');
        faceModalEl.addEventListener('hidden.bs.modal', () => {
            const video = $('regVideoElement');
            if (video && video.srcObject) stopCamera(video);
            // Clear interval nếu đang chạy
            if (window._faceRegInterval) {
                clearInterval(window._faceRegInterval);
                window._faceRegInterval = null;
            }
        });
    }

    /* ---- CRUD ---- */
    function openAdd() {
        editingUsername = null;
        $('acc-modal-title').textContent = 'Thêm Tài Khoản';
        $('acc-form').reset();
        $('acc-username-field').readOnly = false;
        $('acc-password-field').required = true;
        $('acc-password-field').placeholder = "VD: admin123";
        clearValidation();
        new bootstrap.Modal($('acc-modal')).show();
    }

    function openEdit(username) {
        const acc = accounts.find(a => a.username === username);
        if (!acc) return;
        editingUsername = username;
        $('acc-modal-title').textContent = 'Sửa Tài Khoản';
        $('acc-form').reset();

        $('acc-username-field').value = acc.username;
        $('acc-username-field').readOnly = true; // Không cho sửa username
        $('acc-fullname-field').value = acc.fullname || '';
        $('acc-role-field').value = acc.role || 'user';

        // Mật khẩu khi sửa không bắt buộc phải nhập lại (nếu không nhập mảng giữ nguyên)
        $('acc-password-field').required = false;
        $('acc-password-field').placeholder = "(Để trống nếu không đổi mật khẩu)";

        clearValidation();
        new bootstrap.Modal($('acc-modal')).show();
    }

    async function save(e) {
        e.preventDefault();
        const username = $('acc-username-field').value.trim();
        const fullname = $('acc-fullname-field').value.trim();
        const password = $('acc-password-field').value.trim();
        const role = $('acc-role-field').value;

        if (!username || !fullname) {
            showToast('Username và Họ tên là bắt buộc', 'warning');
            return;
        }

        if (!editingUsername && !password) {
            showToast('Vui lòng nhập mật khẩu cho tài khoản mới', 'warning');
            return;
        }

        const btn = $('acc-btn-save');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Đang lưu...`;
        btn.disabled = true;

        try {
            if (editingUsername) {
                // Cập nhật
                const updateData = { fullname, role };
                if (password) updateData.password = password; // Chỉ cập nhật pass nếu có nhập

                const { error } = await window.supabaseClient.from('accounts')
                    .update(updateData)
                    .eq('username', editingUsername);

                if (error) throw error;
                showToast('Cập nhật tài khoản thành công', 'success');

            } else {
                // Thêm mới
                const { data: exist } = await window.supabaseClient.from('accounts').select('username').eq('username', username).single();
                if (exist) {
                    showToast('Username đã tồn tại!', 'error');
                    btn.innerHTML = oldHtml;
                    btn.disabled = false;
                    return;
                }

                const { error } = await window.supabaseClient.from('accounts').insert([{
                    username, fullname, password, role
                }]);

                if (error) throw error;
                showToast('Tạo tài khoản thành công', 'success');
            }

            bootstrap.Modal.getInstance($('acc-modal')).hide();
            loadAccounts();

        } catch (err) {
            console.error(err);
            showToast('Không thể lưu tài khoản: ' + err.message, 'error');
        }

        btn.innerHTML = oldHtml;
        btn.disabled = false;
    }

    function clearValidation() {
        document.querySelectorAll('#acc-form .is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }

    function confirmDelete(username) {
        if (username === 'admin') {
            showToast('Không thể xóa tài khoản Admin mặc định', 'error');
            return;
        }
        showConfirm(
            '🗑️',
            'Xóa tài khoản?',
            `Bạn có chắc muốn xóa tài khoản <strong>@${username}</strong>? Hành động này không thể hoàn tác.`,
            () => deleteAccount(username)
        );
    }

    async function deleteAccount(username) {
        try {
            showLoading(true);
            const { error } = await window.supabaseClient.from('accounts').delete().eq('username', username);
            if (error) throw error;
            showToast('Đã xóa tài khoản!', 'success');
            loadAccounts();
        } catch (err) {
            console.error(err);
            showToast('Lỗi khi xóa tài khoản', 'error');
        } finally {
            showLoading(false);
        }
    }

    function showLoading(show) {
        // Có thể add global spinner logic ở đây
    }

    /* =========================================================
       Quy trình Quét & Cập nhật Face ID (Face Registration)
       Dành cho Manager gán Face cho các Account trong hệ thống
       ========================================================= */

    let currentRegUsername = null;

    function openFaceReg(username) {
        currentRegUsername = username;
        $('regFaceUsernameLabel').textContent = "@" + username;

        // Reset UI
        $('registerFaceWrapper').classList.add('d-none');
        $('regFaceFooter').classList.remove('d-none');
        $('regFaceLoadingFooter').classList.add('d-none');
        $('regFaceText').className = 'face-scan-text d-none';
        $('regFaceOverlay').className = 'face-scan-overlay';

        const regModal = new bootstrap.Modal($('faceRegisterModal'));
        regModal.show();
    }

    async function startFaceScanProcess() {
        if (!currentRegUsername) return;

        const wrapper = $('registerFaceWrapper');
        const video = $('regVideoElement');
        const overlay = $('regFaceOverlay');
        const text = $('regFaceText');

        $('regFaceFooter').classList.add('d-none');
        $('regFaceLoadingFooter').classList.remove('d-none');

        wrapper.classList.remove('d-none');
        text.classList.remove('d-none');
        text.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang tải Model AI...';

        try {
            await loadFaceModels();
            text.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang mở camera...';

            const camReady = await startCamera(video);
            if (!camReady) throw new Error("Không thể mở Camera. Hãy kiểm tra quyền truy cập.");

            text.textContent = "Vui lòng nhìn thẳng...";
            overlay.className = 'face-scan-overlay scanning';

            // Cho UI kịp render chữ trước khi WebGL chạy nặng
            await new Promise(r => setTimeout(r, 200));

            // Thử quét liên tục
            let attempts = 0;
            let isProcessing = false;

            window._faceRegInterval = setInterval(async () => {
                if (isProcessing) return;
                attempts++;

                if (attempts > 15) { // 15s timeout
                    clearInterval(window._faceRegInterval);
                    overlay.className = 'face-scan-overlay error';
                    text.textContent = "Không quét được khuôn mặt. Vui lòng thử lại.";
                    stopCamera(video);
                    setTimeout(() => {
                        bootstrap.Modal.getInstance($('faceRegisterModal')).hide();
                    }, 3000);
                    return;
                }

                text.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Đang quét... (${attempts}/15)`;
                isProcessing = true;

                try {
                    let descriptor = await extractFaceDescriptor(video);
                    if (descriptor) {
                        clearInterval(window._faceRegInterval);
                        overlay.className = 'face-scan-overlay success';
                        text.innerHTML = '<i class="bi bi-check-circle-fill text-success me-1"></i> Đã nhận diện khuôn mặt thành công!';
                        stopCamera(video);

                        // Lưu DB
                        const saved = await authUpdateFaceDescriptor(currentRegUsername, descriptor);
                        if (saved) {
                            text.innerHTML = '<i class="bi bi-cloud-check-fill text-success me-1"></i> Đã lưu dữ liệu lên hệ thống.';
                            setTimeout(() => {
                                bootstrap.Modal.getInstance($('faceRegisterModal')).hide();
                                showToast('Cập nhật Face ID thành công', 'success');
                                loadAccounts(); // reload table
                            }, 1500);
                        } else {
                            throw new Error("Lỗi lưu CSDL");
                        }
                        return;
                    }
                } catch (e) {
                    console.error("Lỗi trích xuất:", e);
                }
                isProcessing = false;
            }, 1000);

        } catch (err) {
            console.error(err);
            overlay.className = 'face-scan-overlay error';
            text.innerHTML = '<i class="bi bi-exclamation-triangle-fill text-danger me-1"></i> ' + (err.message || "Lỗi thiết lập");
            stopCamera(video);

            setTimeout(() => {
                bootstrap.Modal.getInstance($('faceRegisterModal')).hide();
            }, 3000);
        }
    }


    return { init, openAdd, openEdit, save, confirmDelete, openFaceReg };
})();
