# AI聊天破冰助手

## 1. 模块说明

本模块为匹配成功后的聊天场景增加“AI 聊天破冰助手”能力。

当两个用户匹配成功后，系统会：

1. 读取双方资料、专业与兴趣标签。
2. 基于共同兴趣标签生成破冰建议。
3. 可选调用 OpenRouter 生成更自然的聊天建议。

设计目标：

- 不影响原有匹配、会话和消息发送流程。
- OpenRouter 不可用时自动退化为规则模板。
- 不新增数据库表。

## 2. 本次实现内容

### 2.1 后端

- `supabase/functions/_shared/chat-icebreaker.ts`
- `supabase/functions/matches/index.ts`

### 2.2 前端

- `frontend/src/api/matches.ts`
- `frontend/src/components/chat/IcebreakerPanel.tsx`
- `frontend/src/pages/match/MatchPage.tsx`
- `frontend/src/pages/chat/ChatRoomPage.tsx`
- `frontend/src/types/index.ts`

## 3. 数据库依赖

- `users`
- `user_tags`
- `matches`
- `conversations`
- `conversation_members`

## 4. OpenRouter 配置

```bash
supabase secrets set OPENROUTER_API_KEY=你的_openrouter_key
supabase secrets set OPENROUTER_MODEL=openrouter/free
supabase secrets set OPENROUTER_APP_NAME=Quipster
supabase secrets set OPENROUTER_SITE_URL=https://你的前端域名
```

## 5. API 设计

```http
GET /matches
POST /matches
GET /matches/icebreaker?peer_user_id=xxx
```

## 6. 前端展示规则

- 匹配成功弹窗展示破冰建议。
- 聊天页顶部展示破冰建议。

