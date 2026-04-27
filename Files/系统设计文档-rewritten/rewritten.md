# Quipster 数据设计部分演讲稿

## 开场

各位老师好！接下来由我介绍 Quipster 校园社交平台的数据设计部分。

Quipster 作为一个面向同济大学的校园社交平台，数据设计需要解决三个具体问题：

**问题一**：平台包含匹配交友、即时聊天、动态发布、匿名树洞、校园问答、学习搭子六个功能模块，每个模块的数据结构差异较大，如何设计表结构才能避免模块间的耦合？

**问题二**：树洞功能要求匿名发布，但违规内容需要追溯；用户资料有公开和私密之分，如何在数据库层面保证隐私安全？

**问题三**：实时聊天场景下，消息查询频率极高，如何在保证 RLS 安全策略的前提下，维持查询性能？

针对这三个问题，我们的数据设计形成了三个技术方案：**模块化表结构**、**RLS 行级安全策略**、**索引优化策略**。接下来逐一展开。

---

## 方案一：模块化表结构

### 表结构划分

系统共设计了 **21 张数据表**，按功能模块划分为 8 大类：

- 用户相关：users、tags、user_tags（3 张）
- 社交关系：matches、friendships（2 张）
- 聊天相关：conversations、conversation_members、messages（3 张）
- 内容相关：posts、anonymous_posts、likes（3 张）
- 问答相关：questions、question_tags、answers、ai_answers（4 张）
- 活动与学搭：activities、activity_participants（2 张）
- 社群：groups（1 张）
- 治理：reports、credit_records、knowledge_base（3 张）

这种划分方式的优势在于：每个模块的表只存储该模块相关的数据，模块间通过外键关联，但不直接依赖彼此的业务逻辑。例如，修改聊天模块的表结构（如增加消息撤回字段），不会影响匹配模块的表。

### 关键表设计

**用户表（users）**：

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY, REFERENCES auth.users | 用户唯一标识，使用 UUID 而非自增 ID |
| email | TEXT | UNIQUE NOT NULL | 用户邮箱，唯一标识 |
| nickname | TEXT | LENGTH >= 2 AND <= 20 | 昵称，2-20字符限制 |
| avatar_url | TEXT | - | 头像 URL |
| gender | TEXT | IN ('男', '女', '保密') | 性别，限定选项 |
| major | TEXT | - | 专业信息 |
| grade | TEXT | - | 年级信息 |
| bio | TEXT | - | 个人简介 |
| credit_score | INTEGER | DEFAULT 100, 0-100 | 信用分，初始100分 |
| visibility | SMALLINT | DEFAULT 1, IN (0, 1) | 0=仅好友可见，1=所有人可见 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

**设计考量**：
- **visibility 字段**：通过数据库约束确保隐私控制，而非应用层逻辑，保证数据一致性。
- **credit_score 字段**：设置 0-100 范围约束，防止异常值，支撑社区治理功能。

**匹配表（matches）**：

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | DEFAULT gen_random_uuid() | 匹配记录唯一标识 |
| user_id | UUID | NOT NULL, REFERENCES users | 发起匹配的用户 |
| target_user_id | UUID | NOT NULL, REFERENCES users | 被匹配的用户 |
| action | TEXT | IN ('like', 'dislike') | 匹配动作类型 |
| is_matched | BOOLEAN | DEFAULT FALSE | 是否匹配成功 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |

**设计考量**：
- **双向匹配逻辑**：通过 `is_matched` 字段实现双向匹配机制，只有双方都喜欢对方时才设为 true。
- **唯一约束**：`(user_id, target_user_id)` 唯一约束防止重复匹配。
- **自引用检查**：`CHECK (user_id <> target_user_id)` 防止用户匹配自己。

**树洞表（anonymous_posts）**：

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | DEFAULT gen_random_uuid() | 帖子唯一标识 |
| user_id | UUID | NOT NULL, REFERENCES users | 发布者（数据库记录，前端不暴露） |
| title | TEXT | LENGTH >= 2 | 帖子标题 |
| content | TEXT | LENGTH > 0 | 帖子内容 |
| like_count | INTEGER | DEFAULT 0 | 点赞数 |
| comment_count | INTEGER | DEFAULT 0 | 评论数 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

**设计考量**：
- **匿名性设计**：虽然存储 `user_id`，但通过 RLS 策略限制访问，前端不返回该字段。
- **可追溯性**：管理员可通过 `user_id` 追溯违规内容发布者。
- **性能优化**：为 `created_at` 和 `(like_count, comment_count)` 建立索引，支持按时间和热度排序。

**统一点赞表（likes）**：

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| user_id | UUID | NOT NULL, REFERENCES users | 点赞用户 |
| post_id | UUID | NOT NULL, REFERENCES posts | 被点赞的动态 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 点赞时间 |

**设计考量**：
- **复合主键**：`(user_id, post_id)` 作为主键，防止重复点赞。
- **外键约束**：确保数据完整性，删除用户或帖子时自动删除相关点赞。
- **索引优化**：为 `post_id` 建立索引，优化点赞数统计查询。

---

## 方案二：RLS 行级安全策略

### 为什么使用 RLS？

传统方案通常在应用层（如 Node.js 中间件）实现权限控制，逻辑是：用户请求 → API 验证权限 → 查询数据库 → 返回数据。这种方案存在安全隐患：如果 API 层被绕过（如直接连接数据库），权限控制就失效了。

RLS（Row Level Security）是 PostgreSQL 的行级安全策略，逻辑是：用户请求 → API 验证 Token → 查询数据库 → **数据库自动过滤数据** → 返回数据。即使 API 层被绕过，数据库仍然会根据 RLS 策略过滤数据，用户只能看到自己有权限的行。

### RLS 工作原理

当用户发起请求时，请求携带 JWT Token（包含用户 ID）。Edge Function 验证 Token 后，将用户 ID 注入到数据库会话中（通过 `auth.uid()` 函数获取）。PostgreSQL 执行查询时，会自动应用 RLS 策略，过滤掉用户无权访问的行。

### RLS 策略示例

**用户表的 RLS 策略**：

```sql
-- 查询策略：用户可以查看公开资料，或查看自己的资料
CREATE POLICY "users_select" ON users
  FOR SELECT
  USING (visibility = 1 OR id = auth.uid());

-- 更新策略：用户只能更新自己的资料
CREATE POLICY "users_update" ON users
  FOR UPDATE
  USING (id = auth.uid());
```

这个策略的逻辑是：
- 查询时，如果资料的 `visibility = 1`（公开），所有人都能看到；如果 `visibility = 0`（私密），只有用户本人能看到。
- 更新时，只有用户本人能更新自己的资料。

**消息表的 RLS 策略**：

```sql
CREATE POLICY "messages_select" ON messages
  FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());
```

这个策略的逻辑是：用户只能查看自己发送或接收的消息。即使前端或 API 层出现漏洞，用户也无法通过数据库查询看到其他人的聊天记录。

### 树洞功能的隐私保护

树洞功能的隐私保护是一个特殊案例，需要平衡匿名性和可追溯性：

**前端层面**：查询树洞列表时，API 返回的数据不包含 `user_id` 字段，用户看到的是完全匿名的帖子。

**数据库层面**：`anonymous_posts` 表仍然存储 `user_id`，但通过 RLS 策略限制访问：

```sql
-- 普通用户查询时，不返回 user_id
CREATE POLICY "anonymous_posts_select" ON anonymous_posts
  FOR SELECT
  USING (true);  -- 所有用户都能查看

-- 管理员可以查询 user_id（用于违规追溯）
CREATE POLICY "anonymous_posts_admin" ON anonymous_posts
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');
```

这个设计的逻辑是：普通用户无法获取发布者身份，但管理员可以追溯到发布者，用于处理违规内容。

---

## 方案三：索引优化策略

### 问题背景

RLS 策略会在查询时自动过滤数据，这会增加查询开销。在实时聊天场景下，消息查询频率极高（用户每打开一个会话都会查询），如果查询性能下降，会直接影响用户体验。

### 索引设计

**组合索引优化消息查询**：

聊天功能最高频的查询是："查询某个会话的最新 N 条消息"。我们为 `(conversation_id, created_at DESC)` 建立组合索引：

```sql
CREATE INDEX idx_messages_conversation_time 
ON messages (conversation_id, created_at DESC);
```

这个索引的优势是：查询时可以直接通过索引定位到指定会话，并按时间倒序返回消息，无需全表扫描。

**条件索引优化未读消息查询**：

另一个高频查询是："查询用户的所有未读消息"。我们为 `(receiver_id, is_read)` 建立条件索引：

```sql
CREATE INDEX idx_messages_unread 
ON messages (receiver_id, is_read) 
WHERE is_read = false;
```

这个索引只包含未读消息，已读消息不参与索引。当用户查询未读消息时，数据库只需扫描索引中的少量记录，大幅提升查询效率。

---
