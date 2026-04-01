-- ============================================================
-- Quipster 数据库初始化 Schema
-- 版本: 1.0.0  日期: 2026-04-01
-- ============================================================

-- 启用必要扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. 用户资料表 (基于 auth.users 扩展)
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        UNIQUE NOT NULL,
  nickname    TEXT        NOT NULL CHECK (LENGTH(nickname) >= 2 AND LENGTH(nickname) <= 20),
  avatar_url  TEXT,
  gender      TEXT        CHECK (gender IN ('男', '女', '保密')),
  major       TEXT,
  grade       TEXT,
  bio         TEXT,
  credit_score INTEGER    DEFAULT 100 NOT NULL CHECK (credit_score >= 0 AND credit_score <= 100),
  visibility  SMALLINT    DEFAULT 1 NOT NULL CHECK (visibility IN (0, 1)),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 唯一昵称索引
CREATE UNIQUE INDEX idx_profiles_nickname ON public.profiles (LOWER(nickname));
CREATE INDEX idx_profiles_major ON public.profiles (major);
CREATE INDEX idx_profiles_grade ON public.profiles (grade);

COMMENT ON TABLE public.profiles IS '用户资料，扩展 auth.users';
COMMENT ON COLUMN public.profiles.visibility IS '0=仅好友可见 1=所有人可见';

-- ============================================================
-- 2. 兴趣标签表
-- ============================================================
CREATE TABLE public.tags (
  id         SERIAL      PRIMARY KEY,
  name       TEXT        NOT NULL UNIQUE,
  category   TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_tags_category ON public.tags (category);

-- ============================================================
-- 3. 用户兴趣标签关联表
-- ============================================================
CREATE TABLE public.user_tags (
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tag_id     INTEGER     NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, tag_id)
);

CREATE INDEX idx_user_tags_user ON public.user_tags (user_id);
CREATE INDEX idx_user_tags_tag  ON public.user_tags (tag_id);

-- ============================================================
-- 4. 匹配记录表
-- ============================================================
CREATE TABLE public.matches (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action         TEXT        NOT NULL CHECK (action IN ('like', 'dislike')),
  is_matched     BOOLEAN     DEFAULT FALSE NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, target_user_id),
  CHECK (user_id <> target_user_id)
);

CREATE INDEX idx_matches_user      ON public.matches (user_id);
CREATE INDEX idx_matches_target    ON public.matches (target_user_id);
CREATE INDEX idx_matches_action    ON public.matches (user_id, action);

-- ============================================================
-- 5. 会话表（一对一聊天）
-- ============================================================
CREATE TABLE public.conversations (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user1_id, user2_id),
  CHECK (user1_id < user2_id)  -- 确保唯一性，小 UUID 在前
);

CREATE INDEX idx_conversations_user1 ON public.conversations (user1_id);
CREATE INDEX idx_conversations_user2 ON public.conversations (user2_id);

-- ============================================================
-- 6. 消息表
-- ============================================================
CREATE TABLE public.messages (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL CHECK (LENGTH(content) > 0),
  message_type    TEXT        DEFAULT 'text' NOT NULL CHECK (message_type IN ('text', 'image')),
  is_read         BOOLEAN     DEFAULT FALSE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_messages_conversation ON public.messages (conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender       ON public.messages (sender_id);
CREATE INDEX idx_messages_receiver     ON public.messages (receiver_id);
CREATE INDEX idx_messages_unread       ON public.messages (receiver_id, is_read) WHERE is_read = FALSE;

-- ============================================================
-- 7. 动态表
-- ============================================================
CREATE TABLE public.posts (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content       TEXT        NOT NULL CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 500),
  images        TEXT[]      DEFAULT '{}' NOT NULL,
  like_count    INTEGER     DEFAULT 0 NOT NULL CHECK (like_count >= 0),
  comment_count INTEGER     DEFAULT 0 NOT NULL CHECK (comment_count >= 0),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_posts_user       ON public.posts (user_id);
CREATE INDEX idx_posts_created    ON public.posts (created_at DESC);

-- ============================================================
-- 8. 动态点赞表
-- ============================================================
CREATE TABLE public.post_likes (
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id    UUID        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_post_likes_post ON public.post_likes (post_id);

-- ============================================================
-- 9. 动态评论表
-- ============================================================
CREATE TABLE public.post_comments (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    UUID        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL CHECK (LENGTH(content) > 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_post_comments_post ON public.post_comments (post_id, created_at ASC);

-- ============================================================
-- 10. 兴趣社群表
-- ============================================================
CREATE TABLE public.groups (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL CHECK (LENGTH(name) >= 2),
  description  TEXT,
  cover_url    TEXT,
  creator_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  member_count INTEGER     DEFAULT 1 NOT NULL CHECK (member_count >= 0),
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_groups_creator ON public.groups (creator_id);
CREATE INDEX idx_groups_created ON public.groups (created_at DESC);

-- ============================================================
-- 11. 社群成员表
-- ============================================================
CREATE TABLE public.group_members (
  group_id   UUID        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT        DEFAULT 'member' NOT NULL CHECK (role IN ('creator', 'admin', 'member')),
  joined_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user  ON public.group_members (user_id);
CREATE INDEX idx_group_members_group ON public.group_members (group_id);

-- ============================================================
-- 12. 社群标签关联表
-- ============================================================
CREATE TABLE public.group_tags (
  group_id UUID    NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, tag_id)
);

-- ============================================================
-- 13. 活动表
-- ============================================================
CREATE TABLE public.events (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title                TEXT        NOT NULL CHECK (LENGTH(title) >= 2),
  description          TEXT,
  cover_url            TEXT,
  organizer_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time           TIMESTAMPTZ NOT NULL,
  end_time             TIMESTAMPTZ,
  location             TEXT,
  max_participants     INTEGER     CHECK (max_participants > 0),
  current_participants INTEGER     DEFAULT 0 NOT NULL CHECK (current_participants >= 0),
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK (end_time IS NULL OR end_time > start_time)
);

CREATE INDEX idx_events_organizer   ON public.events (organizer_id);
CREATE INDEX idx_events_start_time  ON public.events (start_time ASC);

-- ============================================================
-- 14. 活动报名表
-- ============================================================
CREATE TABLE public.event_signups (
  event_id     UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signed_up_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX idx_event_signups_user ON public.event_signups (user_id);

-- ============================================================
-- 15. 匿名树洞帖子表
-- ============================================================
CREATE TABLE public.anonymous_posts (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL CHECK (LENGTH(title) >= 2),
  content       TEXT        NOT NULL CHECK (LENGTH(content) > 0),
  like_count    INTEGER     DEFAULT 0 NOT NULL CHECK (like_count >= 0),
  comment_count INTEGER     DEFAULT 0 NOT NULL CHECK (comment_count >= 0),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_anon_posts_created   ON public.anonymous_posts (created_at DESC);
CREATE INDEX idx_anon_posts_popular   ON public.anonymous_posts (like_count DESC, comment_count DESC);
-- user_id 不建立索引（匿名，不对外暴露）

-- ============================================================
-- 16. 匿名帖子标签关联表
-- ============================================================
CREATE TABLE public.anonymous_post_tags (
  post_id UUID    NOT NULL REFERENCES public.anonymous_posts(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_anon_post_tags_tag ON public.anonymous_post_tags (tag_id);

-- ============================================================
-- 17. 匿名帖子点赞表
-- ============================================================
CREATE TABLE public.anonymous_post_likes (
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id    UUID        NOT NULL REFERENCES public.anonymous_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

-- ============================================================
-- 18. 匿名帖子评论表
-- ============================================================
CREATE TABLE public.anonymous_comments (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    UUID        NOT NULL REFERENCES public.anonymous_posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL CHECK (LENGTH(content) > 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_anon_comments_post ON public.anonymous_comments (post_id, created_at ASC);

-- ============================================================
-- 19. 校园问答问题表
-- ============================================================
CREATE TABLE public.questions (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title              TEXT        NOT NULL CHECK (LENGTH(title) >= 5),
  content            TEXT        NOT NULL CHECK (LENGTH(content) > 0),
  status             TEXT        DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'closed')),
  answer_count       INTEGER     DEFAULT 0 NOT NULL CHECK (answer_count >= 0),
  has_accepted_answer BOOLEAN    DEFAULT FALSE NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_questions_user    ON public.questions (user_id);
CREATE INDEX idx_questions_status  ON public.questions (status);
CREATE INDEX idx_questions_created ON public.questions (created_at DESC);
CREATE INDEX idx_questions_popular ON public.questions (answer_count DESC);

-- ============================================================
-- 20. 问题标签关联表
-- ============================================================
CREATE TABLE public.question_tags (
  question_id UUID    NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
);

CREATE INDEX idx_question_tags_tag ON public.question_tags (tag_id);

-- ============================================================
-- 21. 答案表
-- ============================================================
CREATE TABLE public.answers (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (LENGTH(content) > 0),
  is_accepted BOOLEAN     DEFAULT FALSE NOT NULL,
  like_count  INTEGER     DEFAULT 0 NOT NULL CHECK (like_count >= 0),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_answers_question ON public.answers (question_id, created_at ASC);
CREATE INDEX idx_answers_user     ON public.answers (user_id);
CREATE INDEX idx_answers_accepted ON public.answers (question_id) WHERE is_accepted = TRUE;

-- ============================================================
-- 22. 学习搭子任务表
-- ============================================================
CREATE TABLE public.study_tasks (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL CHECK (LENGTH(title) >= 2),
  description   TEXT,
  target_count  INTEGER     NOT NULL CHECK (target_count >= 2),
  current_count INTEGER     DEFAULT 1 NOT NULL CHECK (current_count >= 1),
  status        TEXT        DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'closed')),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_study_tasks_creator ON public.study_tasks (creator_id);
CREATE INDEX idx_study_tasks_status  ON public.study_tasks (status);
CREATE INDEX idx_study_tasks_created ON public.study_tasks (created_at DESC);

-- ============================================================
-- 23. 学习任务标签关联表
-- ============================================================
CREATE TABLE public.study_task_tags (
  task_id UUID    NOT NULL REFERENCES public.study_tasks(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

-- ============================================================
-- 24. 学习任务成员表
-- ============================================================
CREATE TABLE public.study_task_members (
  task_id    UUID        NOT NULL REFERENCES public.study_tasks(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT        DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX idx_study_task_members_task ON public.study_task_members (task_id);
CREATE INDEX idx_study_task_members_user ON public.study_task_members (user_id);

-- ============================================================
-- 25. 举报表
-- ============================================================
CREATE TABLE public.reports (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT        NOT NULL CHECK (target_type IN ('user', 'post', 'comment', 'message')),
  target_id   UUID        NOT NULL,
  reason      TEXT        NOT NULL CHECK (LENGTH(reason) > 0),
  description TEXT,
  status      TEXT        DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_reports_reporter ON public.reports (reporter_id);
CREATE INDEX idx_reports_status   ON public.reports (status);
CREATE INDEX idx_reports_target   ON public.reports (target_type, target_id);

-- ============================================================
-- 26. 信用变更记录表
-- ============================================================
CREATE TABLE public.credit_records (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('increase', 'decrease')),
  amount     INTEGER     NOT NULL CHECK (amount > 0),
  reason     TEXT        NOT NULL CHECK (LENGTH(reason) > 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_credit_records_user    ON public.credit_records (user_id, created_at DESC);

-- ============================================================
-- 触发器函数：自动更新 updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_anon_posts_updated_at
  BEFORE UPDATE ON public.anonymous_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_questions_updated_at
  BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_answers_updated_at
  BEFORE UPDATE ON public.answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_study_tasks_updated_at
  BEFORE UPDATE ON public.study_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 触发器：新用户注册后自动建 profile
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nickname)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', SPLIT_PART(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 触发器：帖子点赞数自动更新
-- ============================================================
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_post_like_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION update_post_like_count();

-- ============================================================
-- 触发器：帖子评论数自动更新
-- ============================================================
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_post_comment_count
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comment_count();

-- ============================================================
-- 触发器：匿名帖子点赞数自动更新
-- ============================================================
CREATE OR REPLACE FUNCTION update_anon_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.anonymous_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.anonymous_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_anon_post_like_count
  AFTER INSERT OR DELETE ON public.anonymous_post_likes
  FOR EACH ROW EXECUTE FUNCTION update_anon_post_like_count();

-- ============================================================
-- 触发器：匿名帖子评论数自动更新
-- ============================================================
CREATE OR REPLACE FUNCTION update_anon_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.anonymous_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.anonymous_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_anon_comment_count
  AFTER INSERT OR DELETE ON public.anonymous_comments
  FOR EACH ROW EXECUTE FUNCTION update_anon_comment_count();

-- ============================================================
-- 触发器：问题回答数自动更新
-- ============================================================
CREATE OR REPLACE FUNCTION update_question_answer_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.questions SET answer_count = answer_count + 1 WHERE id = NEW.question_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.questions SET answer_count = GREATEST(0, answer_count - 1) WHERE id = OLD.question_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_question_answer_count
  AFTER INSERT OR DELETE ON public.answers
  FOR EACH ROW EXECUTE FUNCTION update_question_answer_count();

-- ============================================================
-- 触发器：社群成员数自动更新
-- ============================================================
CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_group_member_count
  AFTER INSERT OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION update_group_member_count();

-- ============================================================
-- 触发器：活动报名人数自动更新
-- ============================================================
CREATE OR REPLACE FUNCTION update_event_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET current_participants = current_participants + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET current_participants = GREATEST(0, current_participants - 1) WHERE id = OLD.event_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_event_participant_count
  AFTER INSERT OR DELETE ON public.event_signups
  FOR EACH ROW EXECUTE FUNCTION update_event_participant_count();

-- ============================================================
-- 触发器：学习任务成员数更新（仅 approved 状态）
-- ============================================================
CREATE OR REPLACE FUNCTION update_study_task_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'approved' AND NEW.status = 'approved' THEN
      UPDATE public.study_tasks SET current_count = current_count + 1 WHERE id = NEW.task_id;
      -- 自动关闭已满的任务
      UPDATE public.study_tasks
        SET status = 'closed'
        WHERE id = NEW.task_id AND current_count >= target_count;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_study_task_member_count
  AFTER UPDATE ON public.study_task_members
  FOR EACH ROW EXECUTE FUNCTION update_study_task_member_count();

-- ============================================================
-- RLS（行级安全）策略
-- ============================================================
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_signups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_tags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_task_tags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_task_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_records     ENABLE ROW LEVEL SECURITY;

-- Edge Functions 使用 service_role 绕过 RLS，以下策略用于直接查询场景

-- profiles: 登录用户可查看所有 visibility=1 的资料，自己的全部可见
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  TO authenticated
  USING (visibility = 1 OR id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- tags: 任何已认证用户可读
CREATE POLICY "tags_select" ON public.tags FOR SELECT TO authenticated USING (TRUE);

-- user_tags: 用户可读所有，仅修改自己的
CREATE POLICY "user_tags_select" ON public.user_tags FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "user_tags_modify_own" ON public.user_tags FOR ALL  TO authenticated USING (user_id = auth.uid());

-- posts: 所有认证用户可读，自己的可增删
CREATE POLICY "posts_select" ON public.posts FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- post_likes: 自己操作
CREATE POLICY "post_likes_select" ON public.post_likes FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "post_likes_modify_own" ON public.post_likes FOR ALL TO authenticated USING (user_id = auth.uid());

-- post_comments: 读取全部，自己的可写
CREATE POLICY "post_comments_select" ON public.post_comments FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "post_comments_insert" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- conversations: 参与者可读
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT
  TO authenticated USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- messages: 参与对话的用户可读
CREATE POLICY "messages_select" ON public.messages FOR SELECT
  TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  TO authenticated WITH CHECK (sender_id = auth.uid());

-- groups: 所有认证用户可读
CREATE POLICY "groups_select"       ON public.groups FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "groups_insert"       ON public.groups FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());
CREATE POLICY "group_members_select" ON public.group_members FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "group_members_own"   ON public.group_members FOR ALL   TO authenticated USING (user_id = auth.uid());
CREATE POLICY "group_tags_select"   ON public.group_tags FOR SELECT TO authenticated USING (TRUE);

-- events
CREATE POLICY "events_select"   ON public.events FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "events_insert"   ON public.events FOR INSERT TO authenticated WITH CHECK (organizer_id = auth.uid());
CREATE POLICY "event_signups_select" ON public.event_signups FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "event_signups_own" ON public.event_signups FOR ALL TO authenticated USING (user_id = auth.uid());

-- anonymous posts: 内容公开，user_id 不在 SELECT 中暴露（由 Edge Function 控制）
CREATE POLICY "anon_posts_select"  ON public.anonymous_posts FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "anon_posts_insert"  ON public.anonymous_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "anon_post_tags_select" ON public.anonymous_post_tags FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "anon_post_tags_insert" ON public.anonymous_post_tags FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "anon_likes_select"  ON public.anonymous_post_likes FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "anon_likes_own"     ON public.anonymous_post_likes FOR ALL   TO authenticated USING (user_id = auth.uid());
CREATE POLICY "anon_comments_select" ON public.anonymous_comments FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "anon_comments_insert" ON public.anonymous_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- questions & answers
CREATE POLICY "questions_select" ON public.questions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "questions_insert" ON public.questions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "question_tags_select" ON public.question_tags FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "question_tags_insert" ON public.question_tags FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "answers_select"   ON public.answers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "answers_insert"   ON public.answers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "answers_update_question_owner" ON public.answers FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.questions q
    WHERE q.id = question_id AND q.user_id = auth.uid()
  ));

-- study tasks
CREATE POLICY "study_tasks_select"   ON public.study_tasks FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "study_tasks_insert"   ON public.study_tasks FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());
CREATE POLICY "study_task_tags_select" ON public.study_task_tags FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "study_task_members_select" ON public.study_task_members FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "study_task_members_own" ON public.study_task_members FOR ALL TO authenticated USING (user_id = auth.uid());

-- reports: 只能看自己提交的
CREATE POLICY "reports_insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports_select_own" ON public.reports FOR SELECT TO authenticated USING (reporter_id = auth.uid());

-- credit: 只看自己的
CREATE POLICY "credit_records_own" ON public.credit_records FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "credit_records_insert" ON public.credit_records FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 授予 Edge Functions 使用 service_role 的权限
-- ============================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ============================================================
-- 初始化兴趣标签数据
-- ============================================================
INSERT INTO public.tags (name, category) VALUES
  -- 技术类
  ('编程',     '技术'),
  ('算法',     '技术'),
  ('人工智能', '技术'),
  ('Web开发',  '技术'),
  ('移动开发', '技术'),
  ('数据科学', '技术'),
  ('网络安全', '技术'),
  ('云计算',   '技术'),
  ('开源',     '技术'),
  -- 艺术类
  ('音乐',     '艺术'),
  ('绘画',     '艺术'),
  ('摄影',     '艺术'),
  ('舞蹈',     '艺术'),
  ('电影',     '艺术'),
  ('文学',     '艺术'),
  ('设计',     '艺术'),
  ('戏剧',     '艺术'),
  -- 运动类
  ('篮球',     '运动'),
  ('足球',     '运动'),
  ('羽毛球',   '运动'),
  ('乒乓球',   '运动'),
  ('游泳',     '运动'),
  ('跑步',     '运动'),
  ('健身',     '运动'),
  ('瑜伽',     '运动'),
  ('登山',     '运动'),
  -- 学习类
  ('考研',     '学习'),
  ('四六级',   '学习'),
  ('编程竞赛', '学习'),
  ('论文写作', '学习'),
  ('数学',     '学习'),
  ('物理',     '学习'),
  ('英语口语', '学习'),
  ('自习搭子', '学习'),
  ('读书',     '学习'),
  -- 生活类
  ('美食',     '生活'),
  ('旅行',     '生活'),
  ('游戏',     '生活'),
  ('动漫',     '生活'),
  ('宠物',     '生活'),
  ('美妆',     '生活'),
  ('电竞',     '生活'),
  ('手工',     '生活'),
  ('烹饪',     '生活'),
  ('购物',     '生活');
