/* ================================================================
   AUTH — Token-based session management
   Tài khoản định nghĩa ở đây chỉ dùng nội bộ / local.
   ================================================================ */

// ACCOUNTS array removed, user data now comes from Supabase 'accounts' table.
const SESSION_KEY = 'ew_session';
const TOKEN_KEY = 'ew_token';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 giờ

/* ── Tạo token ngẫu nhiên ── */
function _generateToken() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

/* ── Đăng nhập — trả về session hoặc null ── */
async function authLogin(username, password) {
    if (!window.supabaseClient) {
        console.error('Supabase client is not initialized.');
        return null;
    }

    try {
        const { data: acc, error } = await window.supabaseClient
            .from('accounts')
            .select('*')
            .eq('username', username.trim())
            .eq('password', password)
            .single();

        if (error || !acc) return null;

        const token = _generateToken();
        const session = {
            username: acc.username,
            role: acc.role,
            avatar: acc.avatar,
            fullname: acc.fullname,
            email: acc.email,
            phone: acc.phone,
            token: token,
            loginAt: Date.now(),
            expiresAt: Date.now() + TOKEN_TTL_MS,
        };

        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        sessionStorage.setItem(TOKEN_KEY, token);
        return session;
    } catch (err) {
        console.error('Error during login:', err);
        return null;
    }
}

let authFaceCache = null;
let authFaceCacheTime = 0;

/* ── Đăng nhập — Bằng khuôn mặt (Face Auth - Tự động 1:N) ── */
async function authLoginWithFace(currentDescriptor) {
    if (!window.supabaseClient) {
        console.error('Supabase client is not initialized.');
        return { success: false, msg: 'Hệ thống chưa kết nối dữ liệu.' };
    }

    try {
        let accounts = authFaceCache;
        // Fetch lại data nếu cache rỗng hoặc đã qua 15 giây
        if (!accounts || Date.now() - authFaceCacheTime > 15000) {
            console.log("⏳ Đang tải Face Database từ Supabase vòng mới...");
            const { data: dbAcc, error } = await window.supabaseClient
                .from('accounts')
                .select('*')
                .not('face_descriptor', 'is', null);

            if (error || !dbAcc || dbAcc.length === 0) {
                return { success: false, msg: 'Chưa có tài khoản nào đăng ký khuôn mặt.' };
            }
            accounts = dbAcc;
            authFaceCache = accounts;
            authFaceCacheTime = Date.now();
        }

        let bestMatchAccount = null;
        let bestDistance = 0.45; // Ngưỡng nhận diện (càng nhỏ càng khắt khe, 0.45 khá an toàn cho 1:N)

        console.log(`🔍 Bắt đầu so khớp 1:N với ${accounts.length} người dùng đã đăng ký...`);

        // Duyệt qua tất cả account để tìm người giống nhất
        for (const acc of accounts) {
            let dbDescriptor = null;
            try {
                dbDescriptor = typeof acc.face_descriptor === 'string' ? JSON.parse(acc.face_descriptor) : acc.face_descriptor;
            } catch (e) {
                console.log(`   ❌ Bỏ qua [${acc.username}] do dữ liệu Face lưu sai định dạng.`);
                continue; // Bỏ qua nếu data lỗi
            }

            const float32DbDescriptor = new Float32Array(dbDescriptor);

            // Tính khoảng cách
            const distance = faceapi.euclideanDistance(currentDescriptor, float32DbDescriptor);
            console.log(`   👤 So với [${acc.username}]: Khoảng cách = ${distance.toFixed(4)} ${distance < 0.45 ? '-> (ĐẠT)' : ''}`);

            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatchAccount = acc;
            }
        }

        if (!bestMatchAccount) {
            console.log("🚫 KHÔNG TÌM THẤY MATCH NÀO VƯỢT QUA NGƯỠNG AN TOÀN (< 0.45).");
            return { success: false, msg: 'Khuôn mặt không khớp với bất kỳ nhân viên nào.' };
        }

        console.log(`🎉 MATCH THÀNH CÔNG: Người dùng khớp nhất là [${bestMatchAccount.username}] với khoảng cách tối ưu: ${bestDistance.toFixed(4)}`);

        // Tạm dừng chạy code (nếu đang bật F12) để bạn có thời gian check data
        debugger;

        // Đăng nhập thành công
        const acc = bestMatchAccount;
        const token = _generateToken();
        const session = {
            username: acc.username,
            role: acc.role,
            avatar: acc.avatar,
            fullname: acc.fullname,
            email: acc.email,
            phone: acc.phone,
            token: token,
            loginAt: Date.now(),
            expiresAt: Date.now() + TOKEN_TTL_MS,
        };

        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        sessionStorage.setItem(TOKEN_KEY, token);
        return { success: true, session: session, user: acc };
    } catch (err) {
        console.error('Error during face login:', err);
        return { success: false, msg: 'Lỗi máy chủ.' };
    }
}

/* ── Cập nhật dữ liệu khuôn mặt lên Supabase ── */
async function authUpdateFaceDescriptor(username, descriptor) {
    if (!window.supabaseClient) return false;
    try {
        // descriptor từ faceapi là Float32Array, ta chuyển thành Array thường để Supabase JSONB lưu trữ
        const descriptorArray = Array.from(descriptor);

        const { error } = await window.supabaseClient
            .from('accounts')
            .update({ face_descriptor: descriptorArray })
            .eq('username', username.trim());

        return !error;
    } catch (err) {
        console.error('Lỗi khi cập nhật khuôn mặt:', err);
        return false;
    }
}

/* ── Đăng xuất ── */
function authLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.href = 'index.html';
}

/* ── Lấy session nếu token hợp lệ, ngược lại null ── */
function authGetSession() {
    try {
        const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
        const token = sessionStorage.getItem(TOKEN_KEY);

        if (!session || !token) return null; // chưa đăng nhập
        if (session.token !== token) return null; // token bị thay đổi
        if (Date.now() > session.expiresAt) {                   // hết hạn
            authLogout();
            return null;
        }
        return session;
    } catch {
        return null;
    }
}

/* ── Guard: gọi đầu mỗi trang cần bảo vệ ── */
function authGuard() {
    if (!authGetSession()) {
        // Xóa sạch trước khi chuyển hướng
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        window.location.replace('index.html');
    }
}
