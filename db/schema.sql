-- =========================================================================
-- SUPABASE SQL SCHEMA SETUP FOR E_WORKSHEETS
-- Hướng dẫn: Chạy script này trong SQL Editor của Supabase để khởi tạo cơ sở dữ liệu.
-- =========================================================================

-- NẾU MUỐN XOÁ BẢNG CŨ ĐỂ KHỞI TẠO LẠI, HÃY BỎ DẤU COMMENT (--) CÁC DÒNG DƯỚI ĐÂY:
-- DROP TABLE IF EXISTS payment_results CASCADE;
-- DROP TABLE IF EXISTS advances CASCADE;
-- DROP TABLE IF EXISTS attendance CASCADE;
-- DROP TABLE IF EXISTS workers CASCADE;
-- DROP TABLE IF EXISTS accounts CASCADE;

-- 1. Bảng tài khoản quản trị (accounts)
CREATE TABLE IF NOT EXISTS accounts (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    fullname TEXT,
    role TEXT DEFAULT 'staff',
    avatar TEXT,
    email TEXT,
    phone TEXT,
    face_descriptor JSONB, -- Lưu mảng 128 đặc trưng khuôn mặt dạng JSON (array)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Bảng thông tin công nhân (workers)
CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY, -- Ví dụ: CN001, CN002...
    name TEXT NOT NULL,
    base_salary NUMERIC DEFAULT 0,
    ngay_sinh DATE,
    sdt TEXT,
    phong_ban TEXT DEFAULT 'Sản xuất',
    chuc_vu TEXT DEFAULT 'Công nhân',
    trang_thai TEXT DEFAULT 'active' -- active (đang làm) hoặc inactive (đã nghỉ)
);

-- 3. Bảng chấm công hàng tháng (attendance)
CREATE TABLE IF NOT EXISTS attendance (
    worker_id TEXT REFERENCES workers(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Lưu dạng: {"1": 1, "2": 0.5, "3": 0...}
    PRIMARY KEY (worker_id, year, month)
);

-- 4. Bảng tạm ứng lương (advances)
CREATE TABLE IF NOT EXISTS advances (
    id TEXT PRIMARY KEY, -- Ví dụ: ADV001, ADV002...
    worker_id TEXT REFERENCES workers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    note TEXT
);

-- 5. Bảng lưu kết quả tính toán lương (payment_results)
CREATE TABLE IF NOT EXISTS payment_results (
    worker_id TEXT REFERENCES workers(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Lưu trữ toàn bộ object kết quả tính lương
    PRIMARY KEY (worker_id, year)
);

-- =========================================================================
-- VÔ HIỆU HOÁ RLS (ROW LEVEL SECURITY)
-- Cho phép ứng dụng Frontend truy xuất và ghi dữ liệu trực tiếp bằng anon key.
-- =========================================================================
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE workers DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE advances DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_results DISABLE ROW LEVEL SECURITY;
