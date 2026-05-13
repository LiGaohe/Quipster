-- ============================================================
-- AI 智能内容识别
-- 为 messages 增加审核字段，支持内容风险标记
-- ============================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS audit_status VARCHAR(20) DEFAULT 'pending' CHECK (audit_status::text IN ('pending', 'passed', 'flagged', 'rejected')),
  ADD COLUMN IF NOT EXISTS audited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ;

COMMENT ON COLUMN public.messages.audit_status IS '消息审核状态';
COMMENT ON COLUMN public.messages.audited_by IS '审核人（系统或管理员）';
COMMENT ON COLUMN public.messages.audited_at IS '审核时间';

