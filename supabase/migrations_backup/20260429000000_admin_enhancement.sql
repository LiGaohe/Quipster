-- ============================================================
-- 管理员与治理监管增强
-- 版本: 1.1.0  日期: 2026-04-29
-- ============================================================

-- ============================================================
-- 1. users 表增加角色与封禁字段
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

-- 索引
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role) WHERE role = 'admin';
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users (status) WHERE status IN ('banned', 'suspended');

COMMENT ON COLUMN public.users.role IS '用户角色: user=普通用户, admin=管理员';
COMMENT ON COLUMN public.users.ban_reason IS '封禁/禁言原因';
COMMENT ON COLUMN public.users.banned_at IS '封禁/禁言时间';

-- ============================================================
-- 2. reports 表增加处理意见字段（如果不存在）
-- ============================================================
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS handler_note TEXT;

CREATE INDEX IF NOT EXISTS idx_reports_pending ON public.reports (status) WHERE status = 'pending';

COMMENT ON COLUMN public.reports.handler_note IS '处理意见';

-- ============================================================
-- 3. 新增管理员操作日志表
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('report_approve', 'report_reject', 'ban_user', 'unban_user', 'delete_post', 'delete_anonymous_post')),
    target_type TEXT,
    target_id BIGINT,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin ON public.admin_audit_logs (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.admin_audit_logs (action_type);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.admin_audit_logs IS '管理员操作审计日志';
COMMENT ON COLUMN public.admin_audit_logs.action_type IS '操作类型';
COMMENT ON COLUMN public.admin_audit_logs.target_type IS '目标类型';
COMMENT ON COLUMN public.admin_audit_logs.target_id IS '目标ID';
COMMENT ON COLUMN public.admin_audit_logs.details IS '操作详情';

-- ============================================================
-- 4. posts 表增加审核字段
-- ============================================================
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS audited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ;

COMMENT ON COLUMN public.posts.audited_by IS '审核人（管理员）';
COMMENT ON COLUMN public.posts.audited_at IS '审核时间';

-- ============================================================
-- 5. anonymous_posts 表增加审核字段
-- ============================================================
ALTER TABLE public.anonymous_posts
  ADD COLUMN IF NOT EXISTS audited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ;

COMMENT ON COLUMN public.anonymous_posts.audited_by IS '审核人（管理员）';
COMMENT ON COLUMN public.anonymous_posts.audited_at IS '审核时间';

-- ============================================================
-- 6. RLS 策略更新
-- ============================================================

-- users: 管理员可见所有用户数据
DROP POLICY IF EXISTS "users_select" ON public.users;
CREATE POLICY "users_select" ON public.users FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    OR visibility = 1
    OR id = auth.uid()
  );

-- reports: 管理员可查看、更新所有举报
DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports FOR SELECT
  TO authenticated
  USING (
    reporter_user_id = auth.uid()
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "reports_update_admin" ON public.reports FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- admin_audit_logs: 仅管理员可读写
CREATE POLICY "audit_select_admin" ON public.admin_audit_logs FOR SELECT
  TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "audit_insert_admin" ON public.admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- ============================================================
-- 7. 授予 service_role 权限
-- ============================================================
GRANT ALL ON public.admin_audit_logs TO service_role;
