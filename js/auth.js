/* ================================================================
   AUTH — Token-based session management
   Tài khoản định nghĩa ở đây chỉ dùng nội bộ / local.
   ================================================================ */

const ACCOUNTS = [
    { username: 'admin', password: 'admin123', role: 'Quản trị viên', avatar: '👑' },
    { username: 'Đỗ Thị Nga', password: 'admin123', role: 'Đỗ Thị Nga', avatar: '💼' },
    { username: 'Đỗ Văn Tăng', password: 'admin123', role: 'Đỗ Văn Tăng', avatar: '' },
];

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
function authLogin(username, password) {
    const acc = ACCOUNTS.find(
        a => a.username === username.trim() && a.password === password
    );
    if (!acc) return null;

    const token = _generateToken();
    const session = {
        username: acc.username,
        role: acc.role,
        avatar: acc.avatar,
        token: token,
        loginAt: Date.now(),
        expiresAt: Date.now() + TOKEN_TTL_MS,
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    sessionStorage.setItem(TOKEN_KEY, token);
    return session;
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
