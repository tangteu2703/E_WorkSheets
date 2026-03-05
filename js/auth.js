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
