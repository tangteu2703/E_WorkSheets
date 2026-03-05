/**
 * StorageManager - Hybrid Sync/Async with Supabase
 *
 * This version maintains an in-memory database to keep UI operations fast and synchronous.
 * It fetches everything from Supabase once on initialization, and pushes updates asynchronously.
 */
let inMemoryWorkers = [];
let inMemoryAttendance = {}; // { '2026': { '1': { 'CN001': { '1': 1, '2': 0.5 } } } }
let inMemoryAdvances = [];
let inMemoryPaymentResults = [];

const StorageManager = {
    // ---- Lifecycle ----
    async initialize() {
        if (!window.supabaseClient) {
            console.error('[StorageManager] Supabase client not found!');
            return;
        }

        try {
            // Fetch everything in parallel
            const [wRes, attRes, advRes, payRes] = await Promise.all([
                window.supabaseClient.from('workers').select('*').order('id', { ascending: true }),
                window.supabaseClient.from('attendance').select('*'),
                window.supabaseClient.from('advances').select('*').order('date', { ascending: false }),
                window.supabaseClient.from('payment_results').select('*')
            ]);

            // Map Workers
            if (wRes.error) throw wRes.error;
            if (wRes.data && wRes.data.length > 0) {
                inMemoryWorkers = wRes.data.map(w => ({
                    id: w.id,
                    hoTen: w.name,
                    ngaySinh: w.ngay_sinh || '',
                    soDienThoai: w.sdt || '',
                    phongBan: w.phong_ban || 'Sản xuất', // Default until added to DB schema
                    chucVu: w.chuc_vu || 'Công nhân',
                    luongCB: w.base_salary,
                    phuCap: 0,
                    trangThai: w.trang_thai || 'active'
                }));
            } else if (window.TC_WORKERS && window.TC_WORKERS.length > 0) {
                // Migrate local static workers to DB
                console.log('Migrating workers from local to Supabase...');
                inMemoryWorkers = [...window.TC_WORKERS];
                const insertData = inMemoryWorkers.map(w => ({
                    id: w.id,
                    name: w.hoTen,
                    base_salary: w.luongCB || 0,
                    ngay_sinh: w.ngaySinh || '',
                    sdt: w.sdt || w.soDienThoai || '',
                    phong_ban: w.phongBan || '',
                    chuc_vu: w.chucVu || '',
                    trang_thai: w.trangThai || 'active'
                }));
                await window.supabaseClient.from('workers').insert(insertData);
            }

            // Map Attendance
            if (attRes.error) throw attRes.error;
            inMemoryAttendance = {};
            if (attRes.data) {
                attRes.data.forEach(row => {
                    const y = row.year;
                    const m = row.month;
                    const wid = row.worker_id;

                    if (!inMemoryAttendance[y]) inMemoryAttendance[y] = {};
                    if (!inMemoryAttendance[y][m]) inMemoryAttendance[y][m] = {};

                    inMemoryAttendance[y][m][wid] = row.data || {};
                });
            }

            // Map Advances
            if (advRes.error) throw advRes.error;
            if (advRes.data) {
                inMemoryAdvances = advRes.data.map(d => ({
                    id: d.id,
                    workerId: d.worker_id,
                    date: d.date,
                    amount: parseFloat(d.amount) || 0,
                    note: d.note || ''
                }));
            }

            // Map Payment Results
            if (payRes && payRes.data) {
                inMemoryPaymentResults = payRes.data.map(d => d.data);
            }

            // Sync legacy window reference for compatibility
            window.TC_WORKERS = inMemoryWorkers;

            console.log('[StorageManager] Initialized with Supabase data.');
        } catch (err) {
            console.error('[StorageManager] Initialization error:', err);
            // Fallback gracefully (so UI at least loads empty)
            if (window.TC_WORKERS) inMemoryWorkers = [...window.TC_WORKERS];
        }
    },

    // ---- Workers ----
    getWorkers() {
        // Return a clone to avoid accidental mutations
        return JSON.parse(JSON.stringify(inMemoryWorkers));
    },

    saveWorkers(workers) {
        inMemoryWorkers = workers;
        window.TC_WORKERS = workers; // Legacy sync

        // Async Push to DB
        // Warning: This simplistic approach upserts everything and assumes schema matches partially.
        // A robust app would have 'addWorker', 'updateWorker', 'deleteWorker' instead.
        const records = inMemoryWorkers.map(w => ({
            id: w.id,
            name: w.hoTen,
            base_salary: w.luongCB || 0,
            ngay_sinh: w.ngaySinh || '',
            sdt: w.soDienThoai || '',
            phong_ban: w.phongBan || '',
            chuc_vu: w.chucVu || '',
            trang_thai: w.trangThai || 'active'
        }));

        if (records.length > 0 && window.supabaseClient) {
            window.supabaseClient.from('workers')
                .upsert(records, { onConflict: 'id' })
                .then(({ error }) => {
                    if (error) console.error('[StorageManager] saveWorkers Sync Error', error);
                });
        }
    },

    generateWorkerId(workers) {
        if (!workers || !workers.length) return 'CN001';
        const nums = workers.map(w => parseInt(w.id.replace('CN', '')) || 0);
        const max = Math.max(...nums, 0);
        return 'CN' + String(max + 1).padStart(3, '0');
    },

    // ---- Attendance ----
    getAttendance() {
        return JSON.parse(JSON.stringify(inMemoryAttendance));
    },

    getMonthAttendance(year, month) {
        return (inMemoryAttendance[year] && inMemoryAttendance[year][month])
            ? JSON.parse(JSON.stringify(inMemoryAttendance[year][month]))
            : {};
    },

    saveMonthAttendance(year, month, monthData) {
        if (!inMemoryAttendance[year]) inMemoryAttendance[year] = {};
        inMemoryAttendance[year][month] = JSON.parse(JSON.stringify(monthData));

        // Async Push to DB
        const records = Object.keys(monthData).map(wid => ({
            worker_id: wid,
            year: year,
            month: month,
            data: monthData[wid]
        }));

        if (records.length > 0 && window.supabaseClient) {
            window.supabaseClient.from('attendance')
                .upsert(records, { onConflict: 'worker_id, year, month' })
                .then(({ error }) => {
                    if (error) console.error('[StorageManager] saveMonthAttendance Sync Error', error);
                });
        }
    },

    getWorkerMonthTotal(workerId, year, month) {
        const monthData = this.getMonthAttendance(year, month);
        const workerData = monthData[workerId] || {};
        let total = 0;
        Object.values(workerData).forEach(v => { total += parseFloat(v) || 0; });
        return Number.isInteger(total) ? total : parseFloat(total.toFixed(2));
    },

    clearAttendance() {
        inMemoryAttendance = {};
        // Async clear
        if (window.supabaseClient) {
            window.supabaseClient.from('attendance')
                .delete().neq('worker_id', 'none')
                .then(({ error }) => {
                    if (error) console.error('[StorageManager] clearAttendance Sync Error', error);
                });
        }
    },

    // ---- Advances ----
    getAdvances() {
        return JSON.parse(JSON.stringify(inMemoryAdvances));
    },

    saveAdvances(advances) {
        inMemoryAdvances = JSON.parse(JSON.stringify(advances));

        // Async Push to DB
        const records = advances.map(a => ({
            id: a.id,
            worker_id: a.workerId,
            date: a.date,
            amount: a.amount,
            note: a.note
        }));

        if (records.length > 0 && window.supabaseClient) {
            window.supabaseClient.from('advances')
                .upsert(records, { onConflict: 'id' })
                .then(({ error }) => {
                    if (error) console.error('[StorageManager] saveAdvances Sync Error', error);
                });
        }
    },

    generateAdvanceId(advances) {
        if (!advances || !advances.length) return 'ADV001';
        const nums = advances.map(a => parseInt(a.id.replace('ADV', '')) || 0);
        const max = Math.max(...nums, 0);
        return 'ADV' + String(max + 1).padStart(3, '0');
    },

    // ---- Payment Results ----
    getPaymentResults() {
        return JSON.parse(JSON.stringify(inMemoryPaymentResults));
    },

    savePaymentResults(results) {
        inMemoryPaymentResults = JSON.parse(JSON.stringify(results));

        // Async Push to DB
        const records = results.map(r => ({
            worker_id: r.workerId,
            year: r.year,
            data: r
        }));

        if (records.length > 0 && window.supabaseClient) {
            window.supabaseClient.from('payment_results')
                .upsert(records, { onConflict: 'worker_id, year' })
                .then(({ error }) => {
                    if (error) console.error('[StorageManager] savePaymentResults Sync Error', error);
                });
        }
    },

    clearPaymentResults() {
        inMemoryPaymentResults = [];
        if (window.supabaseClient) {
            window.supabaseClient.from('payment_results')
                .delete().neq('worker_id', 'none')
                .then(({ error }) => {
                    if (error) console.error('[StorageManager] clearPaymentResults Sync Error', error);
                });
        }
    }
};
