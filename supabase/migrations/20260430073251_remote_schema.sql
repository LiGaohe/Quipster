


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.users (id, email, nickname)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nickname', '用户' || left(new.id::text, 8)));
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" bigint NOT NULL,
    "creator_user_id" "uuid" NOT NULL,
    "title" character varying(200) NOT NULL,
    "description" "text",
    "location" character varying(200),
    "event_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone,
    "max_participants" integer,
    "visibility" integer DEFAULT 2,
    "status" character varying(20) DEFAULT 'upcoming'::character varying,
    "image_url" character varying(500),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "activity_type" character varying(20) DEFAULT 'event'::character varying,
    "task_type" character varying(50),
    "max_members" integer DEFAULT 5,
    "start_time" timestamp with time zone,
    "conversation_id" bigint,
    "group_id" bigint,
    CONSTRAINT "activities_activity_type_check" CHECK ((("activity_type")::"text" = ANY ((ARRAY['event'::character varying, 'study_task'::character varying])::"text"[]))),
    CONSTRAINT "activities_max_members_check" CHECK (("max_members" > 0)),
    CONSTRAINT "events_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['upcoming'::character varying, 'ongoing'::character varying, 'finished'::character varying, 'cancelled'::character varying])::"text"[]))),
    CONSTRAINT "events_visibility_check" CHECK (("visibility" = ANY (ARRAY[0, 1, 2])))
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_participants" (
    "id" bigint NOT NULL,
    "activity_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'registered'::character varying,
    "registered_at" timestamp with time zone DEFAULT "now"(),
    "related_type" character varying(20) DEFAULT 'activity'::character varying,
    CONSTRAINT "activity_participants_related_type_check" CHECK ((("related_type")::"text" = ANY ((ARRAY['activity'::character varying, 'task'::character varying])::"text"[]))),
    CONSTRAINT "event_participants_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['registered'::character varying, 'attended'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."activity_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_logs" (
    "id" bigint NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "target_type" "text",
    "target_id" bigint,
    "details" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_audit_logs_action_type_check" CHECK (("action_type" = ANY (ARRAY['report_approve'::"text", 'report_reject'::"text", 'ban_user'::"text", 'unban_user'::"text", 'delete_post'::"text", 'delete_anonymous_post'::"text"])))
);


ALTER TABLE "public"."admin_audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_audit_logs" IS '管理员操作审计日志';



COMMENT ON COLUMN "public"."admin_audit_logs"."action_type" IS '操作类型';



COMMENT ON COLUMN "public"."admin_audit_logs"."target_type" IS '目标类型';



COMMENT ON COLUMN "public"."admin_audit_logs"."target_id" IS '目标ID';



COMMENT ON COLUMN "public"."admin_audit_logs"."details" IS '操作详情';



ALTER TABLE "public"."admin_audit_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."admin_audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."ai_answers" (
    "id" bigint NOT NULL,
    "question_id" bigint NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_answers" OWNER TO "postgres";


ALTER TABLE "public"."ai_answers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."ai_answers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."anonymous_posts" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "title" character varying(200),
    "content" "text" NOT NULL,
    "tag" character varying(50),
    "emotion_type" character varying(20),
    "emotion_score" numeric(3,2),
    "support_resources" "text"[],
    "is_hot" boolean DEFAULT false,
    "audit_status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" character varying(20) DEFAULT 'post'::character varying,
    "parent_id" bigint,
    "anonymous_post_id" bigint,
    "audited_by" "uuid",
    "audited_at" timestamp with time zone,
    CONSTRAINT "anonymous_posts_audit_status_check" CHECK ((("audit_status")::"text" = ANY ((ARRAY['pending'::character varying, 'passed'::character varying, 'flagged'::character varying, 'rejected'::character varying])::"text"[]))),
    CONSTRAINT "anonymous_posts_emotion_score_check" CHECK ((("emotion_score" >= (0)::numeric) AND ("emotion_score" <= (1)::numeric))),
    CONSTRAINT "anonymous_posts_emotion_type_check" CHECK ((("emotion_type")::"text" = ANY ((ARRAY['positive'::character varying, 'neutral'::character varying, 'anxiety'::character varying, 'stress'::character varying, 'sadness'::character varying])::"text"[]))),
    CONSTRAINT "anonymous_posts_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['post'::character varying, 'comment'::character varying])::"text"[])))
);


ALTER TABLE "public"."anonymous_posts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."anonymous_posts"."audited_by" IS '审核人（管理员）';



COMMENT ON COLUMN "public"."anonymous_posts"."audited_at" IS '审核时间';



ALTER TABLE "public"."anonymous_posts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."anonymous_posts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."answers" (
    "id" bigint NOT NULL,
    "question_id" bigint NOT NULL,
    "user_id" "uuid",
    "content" "text" NOT NULL,
    "is_ai_generated" boolean DEFAULT false,
    "is_accepted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."answers" OWNER TO "postgres";


ALTER TABLE "public"."answers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."answers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."conversation_members" (
    "conversation_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" character varying(20) DEFAULT 'member'::character varying,
    "last_read_at" timestamp with time zone,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "related_type" character varying(20) DEFAULT 'conversation'::character varying,
    "group_id" bigint,
    CONSTRAINT "conversation_members_related_type_check" CHECK ((("related_type")::"text" = ANY ((ARRAY['conversation'::character varying, 'group'::character varying])::"text"[]))),
    CONSTRAINT "conversation_members_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['owner'::character varying, 'admin'::character varying, 'member'::character varying])::"text"[])))
);


ALTER TABLE "public"."conversation_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" bigint NOT NULL,
    "name" character varying(100),
    "is_group" boolean DEFAULT false,
    "creator_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "group_id" bigint
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


ALTER TABLE "public"."conversations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."conversations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."credit_records" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "change" integer NOT NULL,
    "reason" character varying(200) NOT NULL,
    "related_type" character varying(20),
    "related_id" bigint,
    "operator_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."credit_records" OWNER TO "postgres";


ALTER TABLE "public"."credit_records" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."credit_records_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."activity_participants" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."event_participants_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."activities" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friend_user_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone,
    CONSTRAINT "friendships_no_self" CHECK (("user_id" <> "friend_user_id")),
    CONSTRAINT "friendships_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'blocked'::character varying])::"text"[])))
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


ALTER TABLE "public"."friendships" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."friendships_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" bigint NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "avatar_url" character varying(500),
    "creator_user_id" "uuid" NOT NULL,
    "visibility" integer DEFAULT 2,
    "conversation_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "groups_visibility_check" CHECK (("visibility" = ANY (ARRAY[0, 1, 2])))
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


ALTER TABLE "public"."groups" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."groups_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."knowledge_base" (
    "id" bigint NOT NULL,
    "title" character varying(200) NOT NULL,
    "content" "text" NOT NULL,
    "category" character varying(50),
    "keywords" "text"[],
    "source" character varying(100),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone,
    CONSTRAINT "knowledge_base_category_check" CHECK ((("category")::"text" = ANY ((ARRAY['课程'::character varying, '考研'::character varying, '实习'::character varying, '生活'::character varying, '校园服务'::character varying, '其他'::character varying])::"text"[])))
);


ALTER TABLE "public"."knowledge_base" OWNER TO "postgres";


ALTER TABLE "public"."knowledge_base" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."knowledge_base_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."likes" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "target_type" character varying(20) NOT NULL,
    "target_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "likes_target_type_check" CHECK ((("target_type")::"text" = ANY ((ARRAY['post'::character varying, 'anonymous_post'::character varying, 'comment'::character varying, 'answer'::character varying])::"text"[])))
);


ALTER TABLE "public"."likes" OWNER TO "postgres";


ALTER TABLE "public"."likes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."likes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "action" character varying(20) NOT NULL,
    "is_matched" boolean DEFAULT false,
    "matched_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "matches_action_check" CHECK ((("action")::"text" = ANY ((ARRAY['like'::character varying, 'pass'::character varying, 'super_like'::character varying])::"text"[]))),
    CONSTRAINT "matches_no_self" CHECK (("user_id" <> "target_user_id"))
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


ALTER TABLE "public"."matches" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."matches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" bigint NOT NULL,
    "conversation_id" bigint NOT NULL,
    "sender_user_id" "uuid",
    "content" "text" NOT NULL,
    "message_type" character varying(20) DEFAULT 'text'::character varying,
    "status" character varying(20) DEFAULT 'sent'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "messages_message_type_check" CHECK ((("message_type")::"text" = ANY ((ARRAY['text'::character varying, 'image'::character varying, 'system'::character varying, 'ai_suggestion'::character varying])::"text"[]))),
    CONSTRAINT "messages_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['sent'::character varying, 'delivered'::character varying, 'read'::character varying])::"text"[])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


ALTER TABLE "public"."messages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "image_urls" "text"[],
    "visibility" integer DEFAULT 2,
    "audit_status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone,
    "type" character varying(20) DEFAULT 'post'::character varying,
    "parent_id" bigint,
    "post_id" bigint,
    "audited_by" "uuid",
    "audited_at" timestamp with time zone,
    CONSTRAINT "posts_audit_status_check" CHECK ((("audit_status")::"text" = ANY ((ARRAY['pending'::character varying, 'passed'::character varying, 'flagged'::character varying, 'rejected'::character varying])::"text"[]))),
    CONSTRAINT "posts_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['post'::character varying, 'comment'::character varying])::"text"[]))),
    CONSTRAINT "posts_visibility_check" CHECK (("visibility" = ANY (ARRAY[0, 1, 2])))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."posts"."audited_by" IS '审核人（管理员）';



COMMENT ON COLUMN "public"."posts"."audited_at" IS '审核时间';



ALTER TABLE "public"."posts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."posts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."question_tags" (
    "question_id" bigint NOT NULL,
    "tag_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."question_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."question_tags" IS '问题标签关联表';



CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" character varying(200) NOT NULL,
    "content" "text",
    "category" character varying(50),
    "is_solved" boolean DEFAULT false,
    "has_ai_answer" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


ALTER TABLE "public"."questions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."questions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" bigint NOT NULL,
    "reporter_user_id" "uuid" NOT NULL,
    "target_type" character varying(20) NOT NULL,
    "target_id" bigint NOT NULL,
    "reason" "text" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "handler_user_id" "uuid",
    "resolution" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    "handler_note" "text",
    CONSTRAINT "reports_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'resolved'::character varying, 'rejected'::character varying])::"text"[]))),
    CONSTRAINT "reports_target_type_check" CHECK ((("target_type")::"text" = ANY ((ARRAY['post'::character varying, 'user'::character varying, 'comment'::character varying, 'anonymous_post'::character varying, 'event'::character varying])::"text"[])))
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


COMMENT ON COLUMN "public"."reports"."handler_note" IS '处理意见';



ALTER TABLE "public"."reports" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."reports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" bigint NOT NULL,
    "name" character varying(50) NOT NULL,
    "category" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


ALTER TABLE "public"."tags" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."tags_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_tags" (
    "user_id" "uuid" NOT NULL,
    "tag_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "password_hash" "text",
    "nickname" character varying(50) NOT NULL,
    "avatar_url" character varying(500),
    "gender" character varying(10),
    "major" character varying(100),
    "grade" character varying(20),
    "bio" "text",
    "credit_score" integer DEFAULT 100,
    "visibility" integer DEFAULT 1,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone,
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "ban_reason" "text",
    "banned_at" timestamp with time zone,
    CONSTRAINT "users_credit_score_check" CHECK ((("credit_score" >= 0) AND ("credit_score" <= 200))),
    CONSTRAINT "users_gender_check" CHECK ((("gender")::"text" = ANY ((ARRAY['male'::character varying, 'female'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text"]))),
    CONSTRAINT "users_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'banned'::character varying, 'suspended'::character varying])::"text"[]))),
    CONSTRAINT "users_visibility_check" CHECK (("visibility" = ANY (ARRAY[0, 1, 2])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."role" IS '用户角色: user=普通用户, admin=管理员';



COMMENT ON COLUMN "public"."users"."ban_reason" IS '封禁/禁言原因';



COMMENT ON COLUMN "public"."users"."banned_at" IS '封禁/禁言时间';



ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_answers"
    ADD CONSTRAINT "ai_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."anonymous_posts"
    ADD CONSTRAINT "anonymous_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_records"
    ADD CONSTRAINT "credit_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_participants"
    ADD CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_participants"
    ADD CONSTRAINT "event_participants_unique" UNIQUE ("activity_id", "user_id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_unique" UNIQUE ("user_id", "friend_user_id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_base"
    ADD CONSTRAINT "knowledge_base_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_unique" UNIQUE ("user_id", "target_type", "target_id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_unique" UNIQUE ("user_id", "target_user_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."question_tags"
    ADD CONSTRAINT "question_tags_pkey" PRIMARY KEY ("question_id", "tag_id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_tags"
    ADD CONSTRAINT "user_tags_pkey" PRIMARY KEY ("user_id", "tag_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "activities_creator_idx" ON "public"."activities" USING "btree" ("creator_user_id");



CREATE INDEX "activities_task_status_idx" ON "public"."activities" USING "btree" ("status", "start_time") WHERE ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'ongoing'::character varying])::"text"[])) AND (("activity_type")::"text" = 'study_task'::"text"));



CREATE INDEX "activities_time_idx" ON "public"."activities" USING "btree" ("event_time") WHERE ((("status")::"text" = ANY ((ARRAY['upcoming'::character varying, 'ongoing'::character varying])::"text"[])) AND (("activity_type")::"text" = 'event'::"text"));



CREATE INDEX "activity_participants_activity_idx" ON "public"."activity_participants" USING "btree" ("activity_id");



CREATE INDEX "activity_participants_user_idx" ON "public"."activity_participants" USING "btree" ("user_id");



CREATE INDEX "ai_answers_question_idx" ON "public"."ai_answers" USING "btree" ("question_id");



CREATE INDEX "anonymous_posts_hot_idx" ON "public"."anonymous_posts" USING "btree" ("created_at" DESC) WHERE (("is_hot" = true) AND (("audit_status")::"text" = 'passed'::"text") AND (("type")::"text" = 'post'::"text"));



CREATE INDEX "anonymous_posts_parent_idx" ON "public"."anonymous_posts" USING "btree" ("parent_id", "created_at") WHERE (("type")::"text" = 'comment'::"text");



CREATE INDEX "anonymous_posts_post_idx" ON "public"."anonymous_posts" USING "btree" ("anonymous_post_id", "created_at") WHERE (("type")::"text" = 'comment'::"text");



CREATE INDEX "anonymous_posts_tag_idx" ON "public"."anonymous_posts" USING "btree" ("tag", "created_at" DESC) WHERE (("type")::"text" = 'post'::"text");



CREATE INDEX "answers_question_idx" ON "public"."answers" USING "btree" ("question_id", "created_at");



CREATE INDEX "answers_user_idx" ON "public"."answers" USING "btree" ("user_id");



CREATE INDEX "conversation_members_group_idx" ON "public"."conversation_members" USING "btree" ("group_id") WHERE (("related_type")::"text" = 'group'::"text");



CREATE INDEX "conversation_members_user_idx" ON "public"."conversation_members" USING "btree" ("user_id");



CREATE INDEX "conversations_creator_idx" ON "public"."conversations" USING "btree" ("creator_user_id");



CREATE INDEX "credit_records_user_idx" ON "public"."credit_records" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "friendships_friend_idx" ON "public"."friendships" USING "btree" ("friend_user_id");



CREATE INDEX "friendships_status_idx" ON "public"."friendships" USING "btree" ("status") WHERE (("status")::"text" = 'accepted'::"text");



CREATE INDEX "friendships_user_idx" ON "public"."friendships" USING "btree" ("user_id");



CREATE INDEX "groups_creator_idx" ON "public"."groups" USING "btree" ("creator_user_id");



CREATE INDEX "idx_activities_group_id" ON "public"."activities" USING "btree" ("group_id");



CREATE INDEX "idx_audit_action" ON "public"."admin_audit_logs" USING "btree" ("action_type");



CREATE INDEX "idx_audit_admin" ON "public"."admin_audit_logs" USING "btree" ("admin_id", "created_at" DESC);



CREATE INDEX "idx_question_tags_question_id" ON "public"."question_tags" USING "btree" ("question_id");



CREATE INDEX "idx_question_tags_tag_id" ON "public"."question_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_reports_pending" ON "public"."reports" USING "btree" ("status") WHERE (("status")::"text" = 'pending'::"text");



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role") WHERE ("role" = 'admin'::"text");



CREATE INDEX "idx_users_status" ON "public"."users" USING "btree" ("status") WHERE (("status")::"text" = ANY ((ARRAY['banned'::character varying, 'suspended'::character varying])::"text"[]));



CREATE INDEX "knowledge_base_active_idx" ON "public"."knowledge_base" USING "btree" ("category", "keywords") WHERE ("is_active" = true);



CREATE INDEX "knowledge_base_category_idx" ON "public"."knowledge_base" USING "btree" ("category");



CREATE INDEX "likes_target_idx" ON "public"."likes" USING "btree" ("target_type", "target_id");



CREATE INDEX "matches_matched_idx" ON "public"."matches" USING "btree" ("user_id", "target_user_id") WHERE ("is_matched" = true);



CREATE INDEX "matches_target_idx" ON "public"."matches" USING "btree" ("target_user_id");



CREATE INDEX "matches_user_idx" ON "public"."matches" USING "btree" ("user_id");



CREATE INDEX "messages_conversation_idx" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "messages_sender_idx" ON "public"."messages" USING "btree" ("sender_user_id");



CREATE INDEX "posts_parent_idx" ON "public"."posts" USING "btree" ("parent_id", "created_at") WHERE (("type")::"text" = 'comment'::"text");



CREATE INDEX "posts_post_idx" ON "public"."posts" USING "btree" ("post_id", "created_at") WHERE (("type")::"text" = 'comment'::"text");



CREATE INDEX "posts_user_idx" ON "public"."posts" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "posts_visibility_idx" ON "public"."posts" USING "btree" ("visibility", "created_at" DESC) WHERE ((("audit_status")::"text" = 'passed'::"text") AND (("type")::"text" = 'post'::"text"));



CREATE INDEX "questions_category_idx" ON "public"."questions" USING "btree" ("category", "created_at" DESC);



CREATE INDEX "questions_unsolved_idx" ON "public"."questions" USING "btree" ("created_at" DESC) WHERE ("is_solved" = false);



CREATE INDEX "questions_user_idx" ON "public"."questions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "reports_reporter_idx" ON "public"."reports" USING "btree" ("reporter_user_id");



CREATE INDEX "reports_status_idx" ON "public"."reports" USING "btree" ("status") WHERE (("status")::"text" = ANY ((ARRAY['pending'::character varying, 'processing'::character varying])::"text"[]));



CREATE INDEX "tags_category_idx" ON "public"."tags" USING "btree" ("category");



CREATE INDEX "user_tags_tag_idx" ON "public"."user_tags" USING "btree" ("tag_id");



CREATE INDEX "users_status_idx" ON "public"."users" USING "btree" ("status") WHERE (("status")::"text" = 'active'::"text");



CREATE OR REPLACE TRIGGER "update_friendships_updated_at" BEFORE UPDATE ON "public"."friendships" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_knowledge_base_updated_at" BEFORE UPDATE ON "public"."knowledge_base" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_posts_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_answers"
    ADD CONSTRAINT "ai_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anonymous_posts"
    ADD CONSTRAINT "anonymous_posts_anonymous_post_id_fkey" FOREIGN KEY ("anonymous_post_id") REFERENCES "public"."anonymous_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anonymous_posts"
    ADD CONSTRAINT "anonymous_posts_audited_by_fkey" FOREIGN KEY ("audited_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."anonymous_posts"
    ADD CONSTRAINT "anonymous_posts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."anonymous_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anonymous_posts"
    ADD CONSTRAINT "anonymous_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_records"
    ADD CONSTRAINT "credit_records_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_records"
    ADD CONSTRAINT "credit_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_participants"
    ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_participants"
    ADD CONSTRAINT "event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "events_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_friend_user_id_fkey" FOREIGN KEY ("friend_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_audited_by_fkey" FOREIGN KEY ("audited_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_tags"
    ADD CONSTRAINT "question_tags_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_tags"
    ADD CONSTRAINT "question_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_handler_user_id_fkey" FOREIGN KEY ("handler_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_tags"
    ADD CONSTRAINT "user_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_tags"
    ADD CONSTRAINT "user_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activities_select_policy" ON "public"."activities" FOR SELECT USING ((((("activity_type")::"text" = 'event'::"text") AND (("creator_user_id" = "auth"."uid"()) OR ("visibility" = 2) OR (("visibility" = 1) AND (EXISTS ( SELECT 1
   FROM "public"."friendships"
  WHERE ((("friendships"."status")::"text" = 'accepted'::"text") AND ((("friendships"."user_id" = "auth"."uid"()) AND ("friendships"."friend_user_id" = "activities"."creator_user_id")) OR (("friendships"."friend_user_id" = "auth"."uid"()) AND ("friendships"."user_id" = "activities"."creator_user_id"))))))))) OR ((("activity_type")::"text" = 'study_task'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."activity_participants"
  WHERE (("activity_participants"."activity_id" = "activities"."id") AND ("activity_participants"."user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."activity_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_participants_delete_own" ON "public"."activity_participants" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "activity_participants_insert_own" ON "public"."activity_participants" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "activity_participants_select_all" ON "public"."activity_participants" FOR SELECT USING (true);



CREATE POLICY "activity_participants_update_own" ON "public"."activity_participants" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."admin_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_answers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_answers_select_all" ON "public"."ai_answers" FOR SELECT USING (true);



ALTER TABLE "public"."anonymous_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anonymous_posts_select_policy" ON "public"."anonymous_posts" FOR SELECT USING ((("audit_status")::"text" = 'passed'::"text"));



ALTER TABLE "public"."answers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "answers_delete_own" ON "public"."answers" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "answers_insert_own" ON "public"."answers" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "answers_select_all" ON "public"."answers" FOR SELECT USING (true);



CREATE POLICY "answers_update_own" ON "public"."answers" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "audit_insert_admin" ON "public"."admin_audit_logs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "audit_select_admin" ON "public"."admin_audit_logs" FOR SELECT TO "authenticated" USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'admin'::"text"));



ALTER TABLE "public"."conversation_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_members_select_policy" ON "public"."conversation_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."conversation_members" "cm"
  WHERE (("cm"."conversation_id" = "conversation_members"."conversation_id") AND ("cm"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_insert_own" ON "public"."conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "creator_user_id"));



CREATE POLICY "conversations_select_participant" ON "public"."conversations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_members"
  WHERE (("conversation_members"."conversation_id" = "conversations"."id") AND ("conversation_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "conversations_update_creator" ON "public"."conversations" FOR UPDATE USING (("auth"."uid"() = "creator_user_id"));



ALTER TABLE "public"."credit_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_records_select_policy" ON "public"."credit_records" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "friendships_delete_own" ON "public"."friendships" FOR DELETE USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "friend_user_id")));



CREATE POLICY "friendships_insert_own" ON "public"."friendships" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "friendships_select_own" ON "public"."friendships" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "friend_user_id")));



CREATE POLICY "friendships_update_own" ON "public"."friendships" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "groups_delete_creator" ON "public"."groups" FOR DELETE USING (("auth"."uid"() = "creator_user_id"));



CREATE POLICY "groups_insert_own" ON "public"."groups" FOR INSERT WITH CHECK (("auth"."uid"() = "creator_user_id"));



CREATE POLICY "groups_select_all" ON "public"."groups" FOR SELECT USING (true);



CREATE POLICY "groups_update_creator" ON "public"."groups" FOR UPDATE USING (("auth"."uid"() = "creator_user_id"));



ALTER TABLE "public"."knowledge_base" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "knowledge_base_select_active" ON "public"."knowledge_base" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "likes_delete_own" ON "public"."likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "likes_insert_own" ON "public"."likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "likes_select_all" ON "public"."likes" FOR SELECT USING (true);



ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matches_insert_own" ON "public"."matches" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "matches_select_own" ON "public"."matches" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "target_user_id")));



CREATE POLICY "matches_update_own" ON "public"."matches" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_insert_policy" ON "public"."messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversation_members"
  WHERE (("conversation_members"."conversation_id" = "messages"."conversation_id") AND ("conversation_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "messages_select_policy" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_members"
  WHERE (("conversation_members"."conversation_id" = "messages"."conversation_id") AND ("conversation_members"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posts_delete_policy" ON "public"."posts" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "posts_insert_policy" ON "public"."posts" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "posts_select_policy" ON "public"."posts" FOR SELECT USING ((((("type")::"text" = 'post'::"text") AND (("user_id" = "auth"."uid"()) OR ("visibility" = 2) OR (("visibility" = 1) AND (EXISTS ( SELECT 1
   FROM "public"."friendships"
  WHERE ((("friendships"."status")::"text" = 'accepted'::"text") AND ((("friendships"."user_id" = "auth"."uid"()) AND ("friendships"."friend_user_id" = "posts"."user_id")) OR (("friendships"."friend_user_id" = "auth"."uid"()) AND ("friendships"."user_id" = "posts"."user_id"))))))))) OR ((("type")::"text" = 'comment'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "posts"."post_id") AND (("p"."user_id" = "auth"."uid"()) OR ("p"."visibility" = 2) OR (("p"."visibility" = 1) AND (EXISTS ( SELECT 1
           FROM "public"."friendships"
          WHERE ((("friendships"."status")::"text" = 'accepted'::"text") AND ((("friendships"."user_id" = "auth"."uid"()) AND ("friendships"."friend_user_id" = "p"."user_id")) OR (("friendships"."friend_user_id" = "auth"."uid"()) AND ("friendships"."user_id" = "p"."user_id"))))))))))))));



CREATE POLICY "posts_update_policy" ON "public"."posts" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."question_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "questions_delete_own" ON "public"."questions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "questions_insert_own" ON "public"."questions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "questions_select_all" ON "public"."questions" FOR SELECT USING (true);



CREATE POLICY "questions_update_own" ON "public"."questions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reports_insert_policy" ON "public"."reports" FOR INSERT WITH CHECK (("reporter_user_id" = "auth"."uid"()));



CREATE POLICY "reports_select_own" ON "public"."reports" FOR SELECT TO "authenticated" USING ((("reporter_user_id" = "auth"."uid"()) OR (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'admin'::"text")));



CREATE POLICY "reports_select_policy" ON "public"."reports" FOR SELECT USING (("reporter_user_id" = "auth"."uid"()));



CREATE POLICY "reports_update_admin" ON "public"."reports" FOR UPDATE TO "authenticated" USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'admin'::"text"));



ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tags_select_all" ON "public"."tags" FOR SELECT USING (true);



ALTER TABLE "public"."user_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_tags_delete_own" ON "public"."user_tags" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_tags_insert_own" ON "public"."user_tags" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_tags_select_all" ON "public"."user_tags" FOR SELECT USING (true);



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select" ON "public"."users" FOR SELECT TO "authenticated" USING (((( SELECT "users_1"."role"
   FROM "public"."users" "users_1"
  WHERE ("users_1"."id" = "auth"."uid"())) = 'admin'::"text") OR ("visibility" = 1) OR ("id" = "auth"."uid"())));



CREATE POLICY "users_select_policy" ON "public"."users" FOR SELECT USING ((("id" = "auth"."uid"()) OR ("visibility" = 2) OR (("visibility" = 1) AND (EXISTS ( SELECT 1
   FROM "public"."friendships"
  WHERE ((("friendships"."status")::"text" = 'accepted'::"text") AND ((("friendships"."user_id" = "auth"."uid"()) AND ("friendships"."friend_user_id" = "users"."id")) OR (("friendships"."friend_user_id" = "auth"."uid"()) AND ("friendships"."user_id" = "users"."id")))))))));



CREATE POLICY "users_update_policy" ON "public"."users" FOR UPDATE USING (("id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."activity_participants" TO "anon";
GRANT ALL ON TABLE "public"."activity_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_participants" TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."admin_audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."admin_audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."admin_audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ai_answers" TO "anon";
GRANT ALL ON TABLE "public"."ai_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_answers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ai_answers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ai_answers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ai_answers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."anonymous_posts" TO "anon";
GRANT ALL ON TABLE "public"."anonymous_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."anonymous_posts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."anonymous_posts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."anonymous_posts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."anonymous_posts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."answers" TO "anon";
GRANT ALL ON TABLE "public"."answers" TO "authenticated";
GRANT ALL ON TABLE "public"."answers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."answers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."answers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."answers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_members" TO "anon";
GRANT ALL ON TABLE "public"."conversation_members" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_members" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."conversations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."conversations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."conversations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."credit_records" TO "anon";
GRANT ALL ON TABLE "public"."credit_records" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_records" TO "service_role";



GRANT ALL ON SEQUENCE "public"."credit_records_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."credit_records_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."credit_records_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."event_participants_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."event_participants_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."event_participants_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT ALL ON SEQUENCE "public"."friendships_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."friendships_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."friendships_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON SEQUENCE "public"."groups_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."groups_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."groups_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_base" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_base" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_base" TO "service_role";



GRANT ALL ON SEQUENCE "public"."knowledge_base_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."knowledge_base_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."knowledge_base_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."likes" TO "anon";
GRANT ALL ON TABLE "public"."likes" TO "authenticated";
GRANT ALL ON TABLE "public"."likes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."likes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."likes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."likes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."posts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."posts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."posts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."question_tags" TO "anon";
GRANT ALL ON TABLE "public"."question_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."question_tags" TO "service_role";



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."questions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."questions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."questions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tags_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tags_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tags_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_tags" TO "anon";
GRANT ALL ON TABLE "public"."user_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."user_tags" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































