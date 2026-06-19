-- =========================================================================
-- SUPABASE SQL SEED DATA FOR E_WORKSHEETS
-- Hướng dẫn: Chạy script này sau khi chạy schema.sql để thêm dữ liệu mẫu thử nghiệm.
-- =========================================================================

-- 1. Thêm dữ liệu mẫu vào bảng accounts (Tài khoản)
-- Tài khoản mặc định: admin / admin123 và tangteu / 123456
INSERT INTO accounts (username, password, fullname, role, email, phone, avatar) VALUES
('admin', 'admin123', 'Quản Trị Viên', 'admin', 'admin@tangconstruction.vn', '0912345678', 'https://api.dicebear.com/7.x/adventurer/svg?seed=admin'),
('tangteu', '123456', 'Đỗ Văn Tăng', 'admin', 'tangteu@tangconstruction.vn', '0987654321', 'https://api.dicebear.com/7.x/adventurer/svg?seed=tangteu')
ON CONFLICT (username) DO NOTHING;

-- 2. Thêm dữ liệu mẫu vào bảng workers (Công nhân)
INSERT INTO workers (id, name, base_salary, ngay_sinh, sdt, phong_ban, chuc_vu, trang_thai) VALUES
('CN001', 'Nguyễn Văn Anh', 8500000, '1995-05-15', '0901111222', 'Sản xuất', 'Công nhân', 'active'),
('CN002', 'Trần Thị Bình', 9000000, '1998-08-20', '0902222333', 'Kho', 'Công nhân', 'active'),
('CN003', 'Phạm Văn Chiến', 12000000, '1990-12-10', '0903333444', 'Kỹ thuật', 'Tổ trưởng', 'active'),
('CN004', 'Lê Hoàng Dương', 8000000, '1996-03-25', '0904444555', 'Sản xuất', 'Công nhân', 'active'),
('CN005', 'Ngô Hoàng Em', 8700000, '1997-07-30', '0905555666', 'Sản xuất', 'Công nhân', 'inactive') -- Đã nghỉ việc
ON CONFLICT (id) DO NOTHING;

-- 3. Thêm dữ liệu mẫu vào bảng attendance (Chấm công - Tháng 6/2026)
-- Công nhân 1 đi làm hầu như đầy đủ cả ngày (1)
INSERT INTO attendance (worker_id, year, month, data) VALUES
('CN001', 2026, 6, '{"1": 1, "2": 1, "3": 1, "4": 1, "5": 0.5, "6": 1, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1, "13": 0.5, "15": 1, "16": 1, "17": 1, "18": 1, "19": 1}'::jsonb),
-- Công nhân 2 đi làm đầy đủ cả ngày (1)
('CN002', 2026, 6, '{"1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1, "13": 1, "15": 1, "16": 1, "17": 1, "18": 1, "19": 1}'::jsonb),
-- Công nhân 3 (Tổ trưởng) đi làm đầy đủ cả ngày (1)
('CN003', 2026, 6, '{"1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1, "13": 1, "15": 1, "16": 1, "17": 1, "18": 1, "19": 1}'::jsonb),
-- Công nhân 4 đi làm xen kẽ
('CN004', 2026, 6, '{"1": 1, "2": 0.5, "3": 1, "4": 1, "5": 0.5, "6": 1, "8": 1, "9": 0.5, "10": 1, "11": 1, "12": 1, "13": 0.5, "15": 1, "16": 1, "17": 1}'::jsonb)
ON CONFLICT (worker_id, year, month) DO NOTHING;

-- 4. Thêm dữ liệu mẫu vào bảng advances (Tạm ứng lương)
INSERT INTO advances (id, worker_id, date, amount, note) VALUES
('ADV001', 'CN001', '2026-06-10', 1000000, 'Ứng tiền đóng học cho con'),
('ADV002', 'CN002', '2026-06-12', 1500000, 'Ứng đóng tiền phòng trọ'),
('ADV003', 'CN004', '2026-06-15', 500000, 'Ứng mua thuốc men')
ON CONFLICT (id) DO NOTHING;

-- 5. Thêm dữ liệu mẫu vào bảng payment_results (Kết quả tính lương năm 2026)
-- Tạo 1 dòng kết quả tính lương mẫu cho công nhân CN001
INSERT INTO payment_results (worker_id, year, data) VALUES
('CN001', 2026, '{
    "workerId": "CN001",
    "workerName": "Nguyễn Văn Anh",
    "workerDept": "Sản xuất",
    "year": 2026,
    "p1months": [1, 2, 3, 4, 5, 6],
    "p1rate": 400000,
    "p2months": [7, 8, 9, 10, 11, 12],
    "p2rate": 420000,
    "days1": 16.0,
    "days2": 0,
    "sal1": 6400000,
    "sal2": 0,
    "total": 6400000,
    "adv": 1000000,
    "net": 5400000,
    "savedAt": 1781870400000
}'::jsonb)
ON CONFLICT (worker_id, year) DO NOTHING;
