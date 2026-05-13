-- ============================================================
-- Quipster 数据库完整 Schema
-- 版本: 2.0.0  日期: 2026-04-30
-- 从云端 Supabase 同步
-- ============================================================

-- ============================================================
-- 1. 用户表
-- ============================================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR UNIQUE NOT NULL,
    password_hash TEXT,
    nickname VARCHAR NOT NULL,
    avatar_url VARCHAR,
    gender VARCHAR CHECK (gender::text IN ('male', 'female', 'other')),
    major VARCHAR,
    grade VARCHAR,
    bio TEXT,
    credit_score INTEGER DEFAULT 100 CHECK (credit_score >= 0 AND credit_score <= 200),
    visibility INTEGER DEFAULT 2 CHECK (visibility IN (0, 1, 2)),
    status VARCHAR DEFAULT 'active' CHECK (status::text IN ('active', 'banned', 'suspended')),
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    ban_reason TEXT,
    banned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. 兴趣标签表
-- ============================================================
CREATE TABLE public.tags (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL,
    category VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. 用户兴趣标签关联表
-- ============================================================
CREATE TABLE public.user_tags (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, tag_id)
);

-- ============================================================
-- 4. 匹配记录表
-- ============================================================
CREATE TABLE public.matches (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_matched BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, target_user_id)
);

-- ============================================================
-- 5. 好友关系表
-- ============================================================
CREATE TABLE public.friendships (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    friend_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR DEFAULT 'pending' CHECK (status::text IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE (user_id, friend_user_id)
);

-- ============================================================
-- 6. 会话表（支持群聊）
-- ============================================================
CREATE TABLE public.conversations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100),
    is_group BOOLEAN DEFAULT FALSE,
    creator_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    group_id BIGINT
);

-- ============================================================
-- 7. 会话成员表
-- ============================================================
CREATE TABLE public.conversation_members (
    conversation_id BIGINT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role::text IN ('owner', 'admin', 'member')),
    last_read_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    related_type VARCHAR(20) DEFAULT 'conversation' CHECK (related_type::text IN ('conversation', 'group')),
    group_id BIGINT,
    PRIMARY KEY (conversation_id, user_id)
);

-- ============================================================
-- 8. 消息表
-- ============================================================
CREATE TABLE public.messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    message_type VARCHAR DEFAULT 'text' CHECK (message_type::text IN ('text', 'image', 'system', 'ai_suggestion')),
    status VARCHAR DEFAULT 'sent' CHECK (status::text IN ('sent', 'delivered', 'read')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. 动态/帖子表
-- ============================================================
CREATE TABLE public.posts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_urls TEXT[],
    visibility INTEGER DEFAULT 2 CHECK (visibility IN (0, 1, 2)),
    audit_status VARCHAR DEFAULT 'pending' CHECK (audit_status::text IN ('pending', 'passed', 'flagged', 'rejected')),
    type VARCHAR DEFAULT 'post' CHECK (type::text IN ('post', 'comment')),
    parent_id BIGINT,
    post_id BIGINT,
    audited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    audited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. 匿名树洞帖子表
-- ============================================================
CREATE TABLE public.anonymous_posts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    title VARCHAR(200),
    content TEXT NOT NULL,
    tag VARCHAR(50),
    emotion_type VARCHAR(20),
    emotion_score NUMERIC CHECK (emotion_score >= 0 AND emotion_score <= 1),
    support_resources TEXT[],
    is_hot BOOLEAN DEFAULT FALSE,
    audit_status VARCHAR DEFAULT 'pending' CHECK (audit_status::text IN ('pending', 'passed', 'flagged', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    type VARCHAR DEFAULT 'post' CHECK (type::text IN ('post', 'comment')),
    parent_id BIGINT,
    anonymous_post_id BIGINT,
    audited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    audited_at TIMESTAMPTZ
);

-- ============================================================
-- 11. 统一点赞表
-- ============================================================
CREATE TABLE public.likes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL CHECK (target_type::text IN ('post', 'anonymous_post', 'comment', 'answer')),
    target_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, target_type, target_id)
);

-- ============================================================
-- 12. 活动表（支持活动和任务）
-- ============================================================
CREATE TABLE public.activities (
    id BIGSERIAL PRIMARY KEY,
    creator_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    location VARCHAR(200),
    event_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    max_participants INTEGER,
    visibility INTEGER DEFAULT 2,
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status::text IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
    image_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    activity_type VARCHAR(20) DEFAULT 'event' CHECK (activity_type::text IN ('event', 'study_task')),
    task_type VARCHAR(50),
    max_members INTEGER DEFAULT 5,
    start_time TIMESTAMPTZ,
    conversation_id BIGINT,
    group_id BIGINT
);

-- ============================================================
-- 13. 活动参与者表
-- ============================================================
CREATE TABLE public.activity_participants (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'registered' CHECK (status::text IN ('registered', 'approved', 'rejected')),
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    related_type VARCHAR(20) DEFAULT 'activity',
    UNIQUE (activity_id, user_id)
);

-- ============================================================
-- 14. 兴趣社群表
-- ============================================================
CREATE TABLE public.groups (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url VARCHAR(500),
    creator_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    visibility INTEGER DEFAULT 2,
    conversation_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. 校园问答问题表
-- ============================================================
CREATE TABLE public.questions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR,
    is_solved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. 问题标签关联表
-- ============================================================
CREATE TABLE public.question_tags (
    question_id BIGINT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, tag_id)
);

-- ============================================================
-- 17. 答案表
-- ============================================================
CREATE TABLE public.answers (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    is_accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 18. AI 答案表
-- ============================================================
CREATE TABLE public.ai_answers (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 19. 信用变更记录表
-- ============================================================
CREATE TABLE public.credit_records (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    change INTEGER NOT NULL,
    reason VARCHAR(200) NOT NULL,
    related_type VARCHAR(20),
    related_id BIGINT,
    operator_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 20. 举报表
-- ============================================================
CREATE TABLE public.reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_type VARCHAR NOT NULL CHECK (target_type IN ('user', 'post', 'comment', 'message')),
    target_id BIGINT NOT NULL,
    reason VARCHAR NOT NULL,
    description TEXT,
    status VARCHAR DEFAULT 'pending' CHECK (status::text IN ('pending', 'processing', 'resolved', 'dismissed')),
    handler_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    handler_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 21. 管理员操作审计日志表
-- ============================================================
CREATE TABLE public.admin_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('report_approve', 'report_reject', 'ban_user', 'unban_user', 'delete_post', 'delete_anonymous_post')),
    target_type TEXT,
    target_id BIGINT,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 22. 知识库表
-- ============================================================
CREATE TABLE public.knowledge_base (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50),
    keywords TEXT[],
    source VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- ============================================================
-- 外键约束
-- ============================================================
ALTER TABLE public.activities ADD CONSTRAINT activities_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;
ALTER TABLE public.activities ADD CONSTRAINT activities_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;
ALTER TABLE public.activity_participants ADD CONSTRAINT event_participants_event_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;
ALTER TABLE public.anonymous_posts ADD CONSTRAINT anonymous_posts_audited_by_fkey FOREIGN KEY (audited_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.anonymous_posts ADD CONSTRAINT anonymous_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.anonymous_posts ADD CONSTRAINT anonymous_posts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.anonymous_posts(id) ON DELETE CASCADE;
ALTER TABLE public.anonymous_posts ADD CONSTRAINT anonymous_posts_anonymous_post_id_fkey FOREIGN KEY (anonymous_post_id) REFERENCES public.anonymous_posts(id) ON DELETE CASCADE;
ALTER TABLE public.answers ADD CONSTRAINT answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.answers ADD CONSTRAINT answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
ALTER TABLE public.conversation_members ADD CONSTRAINT conversation_members_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.conversation_members ADD CONSTRAINT conversation_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.conversation_members ADD CONSTRAINT conversation_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_creator_user_id_fkey FOREIGN KEY (creator_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;
ALTER TABLE public.credit_records ADD CONSTRAINT credit_records_operator_user_id_fkey FOREIGN KEY (operator_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.credit_records ADD CONSTRAINT credit_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.friendships ADD CONSTRAINT friendships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.friendships ADD CONSTRAINT friendships_friend_user_id_fkey FOREIGN KEY (friend_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.groups ADD CONSTRAINT groups_creator_user_id_fkey FOREIGN KEY (creator_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.groups ADD CONSTRAINT groups_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;
ALTER TABLE public.likes ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.matches ADD CONSTRAINT matches_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.matches ADD CONSTRAINT matches_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.posts ADD CONSTRAINT posts_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
ALTER TABLE public.posts ADD CONSTRAINT posts_audited_by_fkey FOREIGN KEY (audited_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.posts ADD CONSTRAINT posts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.posts(id) ON DELETE CASCADE;
ALTER TABLE public.question_tags ADD CONSTRAINT question_tags_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
ALTER TABLE public.question_tags ADD CONSTRAINT question_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;
ALTER TABLE public.questions ADD CONSTRAINT questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.reports ADD CONSTRAINT reports_handler_user_id_fkey FOREIGN KEY (handler_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.reports ADD CONSTRAINT reports_reporter_user_id_fkey FOREIGN KEY (reporter_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_tags ADD CONSTRAINT user_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_tags ADD CONSTRAINT user_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;
ALTER TABLE public.ai_answers ADD CONSTRAINT ai_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
ALTER TABLE public.admin_audit_logs ADD CONSTRAINT admin_audit_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ============================================================
-- 索引
-- ============================================================
CREATE UNIQUE INDEX activities_pkey ON public.activities USING btree (id);
CREATE INDEX activities_creator_idx ON public.activities USING btree (creator_user_id);
CREATE INDEX activities_task_status_idx ON public.activities USING btree (status, start_time) WHERE ((status = ANY (ARRAY['pending', 'ongoing'])) AND ((activity_type)::text = 'study_task'));
CREATE INDEX activities_time_idx ON public.activities USING btree (event_time) WHERE ((status = ANY (ARRAY['upcoming', 'ongoing'])) AND ((activity_type)::text = 'event'));
CREATE INDEX idx_activities_group_id ON public.activities USING btree (group_id);

CREATE UNIQUE INDEX event_participants_pkey ON public.activity_participants USING btree (id);
CREATE UNIQUE INDEX event_participants_unique ON public.activity_participants USING btree (activity_id, user_id);
CREATE INDEX activity_participants_activity_idx ON public.activity_participants USING btree (activity_id);
CREATE INDEX activity_participants_user_idx ON public.activity_participants USING btree (user_id);

CREATE UNIQUE INDEX admin_audit_logs_pkey ON public.admin_audit_logs USING btree (id);
CREATE INDEX idx_audit_action ON public.admin_audit_logs USING btree (action_type);
CREATE INDEX idx_audit_admin ON public.admin_audit_logs USING btree (admin_id, created_at DESC);

CREATE UNIQUE INDEX ai_answers_pkey ON public.ai_answers USING btree (id);
CREATE INDEX ai_answers_question_idx ON public.ai_answers USING btree (question_id);

CREATE UNIQUE INDEX anonymous_posts_pkey ON public.anonymous_posts USING btree (id);
CREATE INDEX anonymous_posts_hot_idx ON public.anonymous_posts USING btree (created_at DESC) WHERE ((is_hot = true) AND ((audit_status)::text = 'passed') AND ((type)::text = 'post'));
CREATE INDEX anonymous_posts_parent_idx ON public.anonymous_posts USING btree (parent_id, created_at) WHERE ((type)::text = 'comment');
CREATE INDEX anonymous_posts_post_idx ON public.anonymous_posts USING btree (anonymous_post_id, created_at) WHERE ((type)::text = 'comment');
CREATE INDEX anonymous_posts_tag_idx ON public.anonymous_posts USING btree (tag, created_at DESC) WHERE ((type)::text = 'post');

CREATE UNIQUE INDEX answers_pkey ON public.answers USING btree (id);
CREATE INDEX answers_question_idx ON public.answers USING btree (question_id, created_at);
CREATE INDEX answers_user_idx ON public.answers USING btree (user_id);

CREATE UNIQUE INDEX conversation_members_pkey ON public.conversation_members USING btree (conversation_id, user_id);
CREATE INDEX conversation_members_user_idx ON public.conversation_members USING btree (user_id);
CREATE INDEX conversation_members_group_idx ON public.conversation_members USING btree (group_id) WHERE ((related_type)::text = 'group');

CREATE UNIQUE INDEX conversations_pkey ON public.conversations USING btree (id);
CREATE INDEX conversations_creator_idx ON public.conversations USING btree (creator_user_id);

CREATE UNIQUE INDEX credit_records_pkey ON public.credit_records USING btree (id);
CREATE INDEX credit_records_user_idx ON public.credit_records USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX friendships_pkey ON public.friendships USING btree (id);
CREATE UNIQUE INDEX friendships_unique ON public.friendships USING btree (user_id, friend_user_id);
CREATE INDEX friendships_user_idx ON public.friendships USING btree (user_id);
CREATE INDEX friendships_friend_idx ON public.friendships USING btree (friend_user_id);
CREATE INDEX friendships_status_idx ON public.friendships USING btree (status) WHERE ((status)::text = 'accepted');

CREATE UNIQUE INDEX groups_pkey ON public.groups USING btree (id);
CREATE INDEX groups_creator_idx ON public.groups USING btree (creator_user_id);

CREATE UNIQUE INDEX knowledge_base_pkey ON public.knowledge_base USING btree (id);
CREATE INDEX knowledge_base_category_idx ON public.knowledge_base USING btree (category);
CREATE INDEX knowledge_base_active_idx ON public.knowledge_base USING btree (category, keywords) WHERE (is_active = true);

CREATE UNIQUE INDEX likes_pkey ON public.likes USING btree (id);
CREATE UNIQUE INDEX likes_unique ON public.likes USING btree (user_id, target_type, target_id);
CREATE INDEX likes_target_idx ON public.likes USING btree (target_type, target_id);

CREATE UNIQUE INDEX matches_pkey ON public.matches USING btree (id);
CREATE UNIQUE INDEX matches_unique ON public.matches USING btree (user_id, target_user_id);
CREATE INDEX matches_user_idx ON public.matches USING btree (user_id);
CREATE INDEX matches_target_idx ON public.matches USING btree (target_user_id);
CREATE INDEX matches_matched_idx ON public.matches USING btree (user_id, target_user_id) WHERE (is_matched = true);

CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id);
CREATE INDEX messages_conversation_idx ON public.messages USING btree (conversation_id, created_at DESC);
CREATE INDEX messages_sender_idx ON public.messages USING btree (sender_user_id);

CREATE UNIQUE INDEX posts_pkey ON public.posts USING btree (id);
CREATE INDEX posts_user_idx ON public.posts USING btree (user_id, created_at DESC);
CREATE INDEX posts_visibility_idx ON public.posts USING btree (visibility, created_at DESC) WHERE (((audit_status)::text = 'passed') AND ((type)::text = 'post'));
CREATE INDEX posts_parent_idx ON public.posts USING btree (parent_id, created_at) WHERE ((type)::text = 'comment');
CREATE INDEX posts_post_idx ON public.posts USING btree (post_id, created_at) WHERE ((type)::text = 'comment');

CREATE UNIQUE INDEX question_tags_pkey ON public.question_tags USING btree (question_id, tag_id);
CREATE INDEX idx_question_tags_question_id ON public.question_tags USING btree (question_id);
CREATE INDEX idx_question_tags_tag_id ON public.question_tags USING btree (tag_id);

CREATE UNIQUE INDEX questions_pkey ON public.questions USING btree (id);
CREATE INDEX questions_user_idx ON public.questions USING btree (user_id, created_at DESC);
CREATE INDEX questions_category_idx ON public.questions USING btree (category, created_at DESC);
CREATE INDEX questions_unsolved_idx ON public.questions USING btree (created_at DESC) WHERE (is_solved = false);

CREATE UNIQUE INDEX reports_pkey ON public.reports USING btree (id);
CREATE INDEX reports_reporter_idx ON public.reports USING btree (reporter_user_id);
CREATE INDEX idx_reports_pending ON public.reports USING btree (status) WHERE ((status)::text = 'pending');
CREATE INDEX reports_status_idx ON public.reports USING btree (status) WHERE ((status)::text = ANY (ARRAY['pending', 'processing']));

CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (id);
CREATE UNIQUE INDEX tags_name_key ON public.tags USING btree (name);
CREATE INDEX tags_category_idx ON public.tags USING btree (category);

CREATE UNIQUE INDEX user_tags_pkey ON public.user_tags USING btree (user_id, tag_id);
CREATE INDEX user_tags_tag_idx ON public.user_tags USING btree (tag_id);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE INDEX idx_users_role ON public.users USING btree (role) WHERE (role = 'admin');
CREATE INDEX idx_users_status ON public.users USING btree (status) WHERE ((status)::text = ANY (ARRAY['banned', 'suspended']));
CREATE INDEX users_status_idx ON public.users USING btree (status) WHERE ((status)::text = 'active';

-- ============================================================
-- RLS 策略
-- ============================================================

-- users 表
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_select ON public.users FOR SELECT TO authenticated USING (((( SELECT users_1.role FROM public.users users_1 WHERE (users_1.id = auth.uid())) = 'admin') OR (visibility = 1) OR (id = auth.uid())));
CREATE POLICY users_select_policy ON public.users FOR SELECT TO public USING (((id = auth.uid()) OR (visibility = 2) OR ((visibility = 1) AND (EXISTS ( SELECT 1 FROM public.friendships WHERE (((friendships.status)::text = 'accepted') AND (((friendships.user_id = auth.uid()) AND (friendships.friend_user_id = users.id)) OR ((friendships.friend_user_id = auth.uid()) AND (friendships.user_id = users.id))))))))));
CREATE POLICY users_update_policy ON public.users FOR UPDATE TO public USING ((id = auth.uid()));

-- tags 表
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_select_all ON public.tags FOR SELECT TO public USING (true);

-- user_tags 表
ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_tags_select_all ON public.user_tags FOR SELECT TO public USING (true);
CREATE POLICY user_tags_insert_own ON public.user_tags FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY user_tags_delete_own ON public.user_tags FOR DELETE TO public USING ((auth.uid() = user_id));

-- matches 表
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY matches_select_own ON public.matches FOR SELECT TO public USING (((auth.uid() = user_id) OR (auth.uid() = target_user_id)));
CREATE POLICY matches_insert_own ON public.matches FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY matches_update_own ON public.matches FOR UPDATE TO public USING ((auth.uid() = user_id));

-- friendships 表
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY friendships_select_own ON public.friendships FOR SELECT TO public USING (((auth.uid() = user_id) OR (auth.uid() = friend_user_id)));
CREATE POLICY friendships_insert_own ON public.friendships FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY friendships_update_own ON public.friendships FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY friendships_delete_own ON public.friendships FOR DELETE TO public USING (((auth.uid() = user_id) OR (auth.uid() = friend_user_id)));

-- conversations 表
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_select_participant ON public.conversations FOR SELECT TO public USING (EXISTS ( SELECT 1 FROM public.conversation_members WHERE ((conversation_members.conversation_id = conversations.id) AND (conversation_members.user_id = auth.uid()))));
CREATE POLICY conversations_insert_own ON public.conversations FOR INSERT TO public WITH CHECK ((auth.uid() = creator_user_id));
CREATE POLICY conversations_update_creator ON public.conversations FOR UPDATE TO public USING ((auth.uid() = creator_user_id));

-- conversation_members 表
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversation_members_select_all ON public.conversation_members FOR SELECT TO public USING (true);
CREATE POLICY conversation_members_select_policy ON public.conversation_members FOR SELECT TO public USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM public.conversation_members cm WHERE ((cm.conversation_id = conversation_members.conversation_id) AND (cm.user_id = auth.uid()))))));
CREATE POLICY conversation_members_insert_own ON public.conversation_members FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY conversation_members_update_own ON public.conversation_members FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY conversation_members_delete_own ON public.conversation_members FOR DELETE TO public USING ((auth.uid() = user_id));

-- messages 表
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_select_policy ON public.messages FOR SELECT TO public USING (EXISTS ( SELECT 1 FROM public.conversation_members WHERE ((conversation_members.conversation_id = messages.conversation_id) AND (conversation_members.user_id = auth.uid()))));
CREATE POLICY messages_insert_policy ON public.messages FOR INSERT TO public WITH CHECK (EXISTS ( SELECT 1 FROM public.conversation_members WHERE ((conversation_members.conversation_id = messages.conversation_id) AND (conversation_members.user_id = auth.uid()))));

-- posts 表
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY posts_select_policy ON public.posts FOR SELECT TO public USING (((((type)::text = 'post') AND ((user_id = auth.uid()) OR (visibility = 2) OR ((visibility = 1) AND (EXISTS ( SELECT 1 FROM public.friendships WHERE (((friendships.status)::text = 'accepted') AND (((friendships.user_id = auth.uid()) AND (friendships.friend_user_id = posts.user_id)) OR ((friendships.friend_user_id = auth.uid()) AND (friendships.user_id = posts.user_id))))))))) OR (((type)::text = 'comment') AND (EXISTS ( SELECT 1 FROM public.posts p WHERE ((p.id = posts.post_id) AND ((p.user_id = auth.uid()) OR (p.visibility = 2) OR ((p.visibility = 1) AND (EXISTS ( SELECT 1 FROM public.friendships WHERE (((friendships.status)::text = 'accepted') AND (((friendships.user_id = auth.uid()) AND (friendships.friend_user_id = p.user_id)) OR ((friendships.friend_user_id = auth.uid()) AND (friendships.user_id = p.user_id))))))))))))));
CREATE POLICY posts_insert_policy ON public.posts FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY posts_update_policy ON public.posts FOR UPDATE TO public USING ((user_id = auth.uid()));
CREATE POLICY posts_delete_policy ON public.posts FOR DELETE TO public USING ((user_id = auth.uid()));

-- anonymous_posts 表
ALTER TABLE public.anonymous_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY anonymous_posts_select_policy ON public.anonymous_posts FOR SELECT TO public USING (((audit_status)::text = 'passed'));

-- likes 表
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY likes_select_all ON public.likes FOR SELECT TO public USING (true);
CREATE POLICY likes_insert_own ON public.likes FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY likes_delete_own ON public.likes FOR DELETE TO public USING ((auth.uid() = user_id));

-- activities 表
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY activities_select_policy ON public.activities FOR SELECT TO public USING ((((((activity_type)::text = 'event') AND ((creator_user_id = auth.uid()) OR (visibility = 2) OR ((visibility = 1) AND (EXISTS ( SELECT 1 FROM public.friendships WHERE (((friendships.status)::text = 'accepted') AND (((friendships.user_id = auth.uid()) AND (friendships.friend_user_id = activities.creator_user_id)) OR ((friendships.friend_user_id = auth.uid()) AND (friendships.user_id = activities.creator_user_id)))))))))) OR (((activity_type)::text = 'study_task') AND (EXISTS ( SELECT 1 FROM public.activity_participants WHERE ((activity_participants.activity_id = activities.id) AND (activity_participants.user_id = auth.uid())))))));

-- activity_participants 表
ALTER TABLE public.activity_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_participants_select_all ON public.activity_participants FOR SELECT TO public USING (true);
CREATE POLICY activity_participants_insert_own ON public.activity_participants FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY activity_participants_update_own ON public.activity_participants FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY activity_participants_delete_own ON public.activity_participants FOR DELETE TO public USING ((auth.uid() = user_id));

-- groups 表
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY groups_select_all ON public.groups FOR SELECT TO public USING (true);
CREATE POLICY groups_insert_own ON public.groups FOR INSERT TO public WITH CHECK ((auth.uid() = creator_user_id));
CREATE POLICY groups_update_creator ON public.groups FOR UPDATE TO public USING ((auth.uid() = creator_user_id));
CREATE POLICY groups_delete_creator ON public.groups FOR DELETE TO public USING ((auth.uid() = creator_user_id));

-- questions 表
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY questions_select_all ON public.questions FOR SELECT TO public USING (true);
CREATE POLICY questions_insert_own ON public.questions FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY questions_update_own ON public.questions FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY questions_delete_own ON public.questions FOR DELETE TO public USING ((auth.uid() = user_id));

-- answers 表
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY answers_select_all ON public.answers FOR SELECT TO public USING (true);
CREATE POLICY answers_insert_own ON public.answers FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY answers_update_own ON public.answers FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY answers_delete_own ON public.answers FOR DELETE TO public USING ((auth.uid() = user_id));

-- ai_answers 表
ALTER TABLE public.ai_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_answers_select_all ON public.ai_answers FOR SELECT TO public USING (true);

-- credit_records 表
ALTER TABLE public.credit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_records_select_policy ON public.credit_records FOR SELECT TO public USING ((user_id = auth.uid()));

-- reports 表
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_select_policy ON public.reports FOR SELECT TO public USING ((reporter_user_id = auth.uid()));
CREATE POLICY reports_select_own ON public.reports FOR SELECT TO authenticated USING (((reporter_user_id = auth.uid()) OR (( SELECT users.role FROM public.users WHERE (users.id = auth.uid())) = 'admin')));
CREATE POLICY reports_insert_policy ON public.reports FOR INSERT TO public WITH CHECK ((reporter_user_id = auth.uid()));
CREATE POLICY reports_update_admin ON public.reports FOR UPDATE TO authenticated USING ((( SELECT users.role FROM public.users WHERE (users.id = auth.uid())) = 'admin'));

-- admin_audit_logs 表
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_select_admin ON public.admin_audit_logs FOR SELECT TO authenticated USING ((( SELECT users.role FROM public.users WHERE (users.id = auth.uid())) = 'admin'));
CREATE POLICY audit_insert_admin ON public.admin_audit_logs FOR INSERT TO authenticated WITH CHECK ((( SELECT users.role FROM public.users WHERE (users.id = auth.uid())) = 'admin'));

-- knowledge_base 表
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY knowledge_base_select_active ON public.knowledge_base FOR SELECT TO public USING ((is_active = true));
