# AI智能内容识别

## 1. 模块说明

本模块为 Supabase 后端补充“AI 智能内容识别（AI Content Moderation）”能力。

## 2. 实现范围

- `supabase/functions/_shared/content-moderation.ts`
- `supabase/functions/posts/index.ts`
- `supabase/functions/anonymous-posts/index.ts`
- `supabase/functions/messages/index.ts`
- `supabase/functions/conversations/index.ts`
- `supabase/migrations/20260509000000_content_moderation.sql`

## 3. 数据库变更

按照supabase已有字段进行变更。

## 4. 审核流程

1. 规则检测优先。
2. OpenRouter 可用时进行二次校正。
3. 非 `passed` 内容自动标记并提交 `reports`。

## 5. OpenRouter 配置

```bash
supabase secrets set OPENROUTER_API_KEY=你的_openrouter_key
supabase secrets set OPENROUTER_MODEL=openrouter/free
supabase secrets set OPENROUTER_APP_NAME=Quipster
supabase secrets set OPENROUTER_SITE_URL=https://你的前端域名
```

