/**
 * StorageManager
 * - Workers: đọc trực tiếp từ data/workers.js (window.TC_WORKERS)
 * - Attendance: lưu/đọc localStorage (dữ liệu người dùng nhập)
 */
const StorageManager = {
    KEYS: {
        ATTENDANCE: 'tc_attendance',
        ADVANCES: 'tc_advances',
    },

    /* ===== WORKERS — đọc từ file data/workers.js ===== */
    getWorkers() {
        if (!window.TC_WORKERS || !window.TC_WORKERS.length) {
            console.warn('[StorageManager] Không tìm thấy window.TC_WORKERS. Kiểm tra data/workers.js đã được load chưa.');
            return [];
        }
        // Trả về bản sao để tránh mutation
        return JSON.parse(JSON.stringify(window.TC_WORKERS));
    },

    // Lưu workers vào JS file không được (browser không ghi file).
    // Mọi thay đổi (thêm/sửa/xóa) chỉ lưu tạm trong bộ nhớ session.
    // Để thay đổi vĩnh viễn: sửa data/workers.js
    saveWorkers(workers) {
        // Cập nhật runtime array để các module khác đọc đúng trong session
        window.TC_WORKERS = workers;
    },

    generateWorkerId(workers) {
        if (!workers.length) return 'CN001';
        const nums = workers.map(w => parseInt(w.id.replace('CN', '')) || 0);
        const max = Math.max(...nums);
        return 'CN' + String(max + 1).padStart(3, '0');
    },

    /* ===== ATTENDANCE — localStorage ===== */
    getAttendance() {
        const data = localStorage.getItem(this.KEYS.ATTENDANCE);
        if (data) return JSON.parse(data);
        return {};
    },

    saveAttendance(data) {
        localStorage.setItem(this.KEYS.ATTENDANCE, JSON.stringify(data));
    },

    getMonthAttendance(year, month) {
        const all = this.getAttendance();
        return (all[year] && all[year][month]) ? all[year][month] : {};
    },

    saveMonthAttendance(year, month, monthData) {
        const all = this.getAttendance();
        if (!all[year]) all[year] = {};
        all[year][month] = monthData;
        this.saveAttendance(all);
    },

    getWorkerMonthTotal(workerId, year, month) {
        const monthData = this.getMonthAttendance(year, month);
        const workerData = monthData[workerId] || {};
        let total = 0;
        Object.values(workerData).forEach(v => { total += parseFloat(v) || 0; });
        return total;
    },

    clearAttendance() {
        localStorage.removeItem(this.KEYS.ATTENDANCE);
    },

    /* ===== ADVANCES (Ứng tiền) — localStorage ===== */
    getAdvances() {
        const data = localStorage.getItem(this.KEYS.ADVANCES);
        if (data) return JSON.parse(data);
        return []; // Array of { id, workerId, date, amount, note }
    },

    saveAdvances(advances) {
        localStorage.setItem(this.KEYS.ADVANCES, JSON.stringify(advances));
    },

    generateAdvanceId(advances) {
        if (!advances || !advances.length) return 'ADV001';
        const nums = advances.map(a => parseInt(a.id.replace('ADV', '')) || 0);
        const max = Math.max(...nums);
        return 'ADV' + String(max + 1).padStart(3, '0');
    }
};
