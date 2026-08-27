-- ============================================================
--  E-WORKSHEET CONSTRUCTION — Supabase Setup Script
--  Chay file nay trong Supabase SQL Editor de tao lai toan bo database
--  Project: https://gapskgtvhqwrfgmelhgc.supabase.co
-- ============================================================

-- ============================================================
--  BANG 1: accounts — Tai khoan nguoi dung
-- ============================================================
CREATE TABLE IF NOT EXISTS public.accounts (
    username        TEXT PRIMARY KEY,
    password        TEXT NOT NULL,
    fullname        TEXT,
    role            TEXT DEFAULT 'viewer',   -- 'admin' | 'manager' | 'viewer'
    avatar          TEXT,                    -- emoji hoac URL anh
    email           TEXT,
    phone           TEXT,
    face_descriptor JSONB,                   -- Float32Array luu dang JSON array
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  BANG 2: workers — Danh sach cong nhan
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workers (
    id          TEXT PRIMARY KEY,            -- VD: 'CN001'
    name        TEXT NOT NULL,
    base_salary NUMERIC(15,2) DEFAULT 0,
    ngay_sinh   TEXT DEFAULT '',             -- 'YYYY-MM-DD'
    sdt         TEXT DEFAULT '',
    phong_ban   TEXT DEFAULT 'San xuat',
    chuc_vu     TEXT DEFAULT 'Cong nhan',
    trang_thai  TEXT DEFAULT 'active',       -- 'active' | 'inactive'
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  BANG 3: attendance — Bang cham cong
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance (
    id          BIGSERIAL PRIMARY KEY,
    worker_id   TEXT NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    year        INTEGER NOT NULL,
    month       INTEGER NOT NULL,
    data        JSONB DEFAULT '{}',          -- { "1": 1, "2": 0.5, "3": 0, ... }
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (worker_id, year, month)
);

-- ============================================================
--  BANG 4: advances — Ung tien / tam ung
-- ============================================================
CREATE TABLE IF NOT EXISTS public.advances (
    id          TEXT PRIMARY KEY,            -- VD: 'ADV001'
    worker_id   TEXT NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    amount      NUMERIC(15,2) DEFAULT 0,
    note        TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  BANG 5: payment_results — Ket qua tinh luong / thanh toan
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_results (
    id          BIGSERIAL PRIMARY KEY,
    worker_id   TEXT NOT NULL,
    year        INTEGER NOT NULL,
    data        JSONB DEFAULT '{}',          -- Toan bo object ket qua tinh luong
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (worker_id, year)
);

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
--  Bat RLS & mo policy cho anon key truy cap
-- ============================================================

-- Bat RLS cho tat ca bang
ALTER TABLE public.accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advances        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_results ENABLE ROW LEVEL SECURITY;

-- accounts
CREATE POLICY "anon_select_accounts"  ON public.accounts FOR SELECT USING (true);
CREATE POLICY "anon_insert_accounts"  ON public.accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_accounts"  ON public.accounts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_accounts"  ON public.accounts FOR DELETE USING (true);

-- workers
CREATE POLICY "anon_select_workers"   ON public.workers FOR SELECT USING (true);
CREATE POLICY "anon_insert_workers"   ON public.workers FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_workers"   ON public.workers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_workers"   ON public.workers FOR DELETE USING (true);

-- attendance
CREATE POLICY "anon_select_att"       ON public.attendance FOR SELECT USING (true);
CREATE POLICY "anon_insert_att"       ON public.attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_att"       ON public.attendance FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_att"       ON public.attendance FOR DELETE USING (true);

-- advances
CREATE POLICY "anon_select_adv"       ON public.advances FOR SELECT USING (true);
CREATE POLICY "anon_insert_adv"       ON public.advances FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_adv"       ON public.advances FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_adv"       ON public.advances FOR DELETE USING (true);

-- payment_results
CREATE POLICY "anon_select_pay"       ON public.payment_results FOR SELECT USING (true);
CREATE POLICY "anon_insert_pay"       ON public.payment_results FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_pay"       ON public.payment_results FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_pay"       ON public.payment_results FOR DELETE USING (true);

-- ============================================================
--  DU LIEU MAU — Tai khoan admin mac dinh
--  !! Doi password sau khi chay xong !!
-- ============================================================
INSERT INTO public.accounts (username, password, fullname, role, avatar, email, phone)
VALUES
    ('admin', 'admin123', 'Quan Tri Vien', 'admin', '👑', 'admin@company.com', '0900000000')
ON CONFLICT (username) DO NOTHING;

-- ============================================================
--  KIEM TRA — Verify cac bang da tao thanh cong
-- ============================================================
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('accounts', 'workers', 'attendance', 'advances', 'payment_results')
ORDER BY table_name;
