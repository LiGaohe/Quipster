# AI问答助手

## 1. 模块说明

本模块为校园问答增加一个“AI 参考回答”能力。

当用户发布问题后，系统会：

1. 对问题标题与正文做关键词提取。
2. 从 Supabase 的 `knowledge_base` 资料库中检索相关内容。
3. 将检索结果发送给 OpenRouter，再生成一份参考回答。
4. 把生成结果写入 `ai_answers` 表，并在问题详情页展示。

设计目标：

- 不影响现有人工提问、回答、采纳等功能。
- AI 生成失败时，问题仍然可以正常发布。
- 即使 OpenRouter 不可用，也会退化为“资料摘要型参考回答”。

## 2. 本次实现内容

### 2.1 后端

新增与修改的文件：

- `supabase/functions/_shared/ai-qa.ts`
- `supabase/functions/questions/index.ts`
- `supabase/functions/answers/index.ts`
- `supabase/migrations/20260507120000_add_has_ai_answer_to_questions.sql`

后端新增能力：

- 发布问题后自动异步生成 AI 参考回答。
- 支持手动生成/重新生成 AI 参考回答。
- 支持单独读取某个问题的 AI 参考回答。
- 检索来源优先使用 `knowledge_base`。
- OpenRouter 调用失败时自动回退为资料摘要回答。

### 2.2 前端

新增与修改的文件：

- `frontend/src/api/questions.ts`
- `frontend/src/pages/questions/QuestionDetailPage.tsx`
- `frontend/src/types/index.ts`

前端新增能力：

- 在问题详情页展示独立的“AI 参考回答”卡片。
- 支持“生成回答”和“重新生成”。
- AI 回答与人工回答分开展示，不混淆。

## 3. 数据库依赖

当前实现依赖以下表：

- `questions`
- `answers`
- `ai_answers`
- `knowledge_base`
- `question_tags`
- `users`

### 3.1 questions

需要包含字段：

- `id`
- `user_id`
- `title`
- `content`
- `category`
- `is_solved`
- `has_ai_answer`
- `created_at`

### 3.2 ai_answers

需要包含字段：

- `id`
- `question_id`
- `content`
- `created_at`

### 3.3 knowledge_base

当前检索使用以下字段：

- `id`
- `title`
- `content`
- `category`
- `keywords`
- `source`
- `is_active`

如果你的 Supabase 云端项目已经同步过 `20260430073251_remote_schema.sql`，通常已包含 `ai_answers` 和 `knowledge_base`。  
本次新增的本地迁移只补 `questions.has_ai_answer`：

- `supabase/migrations/20260507120000_add_has_ai_answer_to_questions.sql`

## 4. OpenRouter 配置

### 4.1 需要的 Secrets

部署到 Supabase 云端前，请设置以下 Edge Function Secrets：

```bash
supabase secrets set OPENROUTER_API_KEY=你的_openrouter_key
supabase secrets set OPENROUTER_MODEL=openrouter/free
supabase secrets set OPENROUTER_APP_NAME=Quipster
supabase secrets set OPENROUTER_SITE_URL=https://你的前端域名
```

说明：

- `OPENROUTER_API_KEY`：必填。
- `OPENROUTER_MODEL`：可选，默认使用 `openrouter/free`。
- `OPENROUTER_APP_NAME`：可选，用于请求标识。
- `OPENROUTER_SITE_URL`：建议填写你的正式前端域名。

如果你后续想换免费模型，可以只改 `OPENROUTER_MODEL`，无需改代码。

## 5. API 设计

### 5.1 自动生成

发布问题时：

- `POST /questions`

系统会在问题写入成功后，通过后台异步任务自动生成 AI 参考回答。  
如果 AI 生成失败，不会影响问题发布成功。

### 5.2 获取 AI 参考回答

```http
GET /questions/:id/ai-answer
```

返回示例：

```json
{
  "success": true,
  "data": {
    "id": "1",
    "question_id": "12",
    "content": "这是 AI 生成的参考回答",
    "created_at": "2026-05-07T12:00:00.000Z"
  }
}
```

如果还没有生成结果：

```json
{
  "success": true,
  "data": null
}
```

### 5.3 手动生成或重新生成

```http
POST /questions/:id/ai-answer
POST /questions/:id/ai-answer?force=true
```

说明：

- 不带 `force=true`：若已存在结果，则返回缓存结果。
- 带 `force=true`：强制重新生成，并覆盖旧结果。

## 6. 生成流程说明

### 6.1 问题理解与关键词提取

当前策略：

- 从标题和正文中提取中文词片段与英文术语。
- 对标题中的词给予更高权重。
- 过滤常见停用词。

### 6.2 知识库检索

当前策略：

- 先根据问题内容推断类别，如课程、考研、实习、生活、校园服务。
- 在 `knowledge_base` 中优先拉取同类别资料。
- 按标题命中、正文命中、关键词命中进行打分排序。
- 取前 5 条资料作为 AI 生成上下文。

### 6.3 答案生成

当前策略：

- 把问题、关键词、资料摘要发送到 OpenRouter。
- 要求模型只基于资料生成“参考回答”。
- 明确禁止编造政策、时间、流程和联系方式。

### 6.4 失败回退

如果出现以下情况：

- 未配置 `OPENROUTER_API_KEY`
- OpenRouter 请求失败
- 模型未返回可用内容

系统会自动回退为“资料摘要型回答”，仍然写入 `ai_answers` 表。

## 7. 前端展示规则

问题详情页中：

- AI 回答显示在人工回答列表之前。
- 独立显示为“AI 参考回答”卡片。
- 有清晰提示：“仅供参考，不替代人工回答和学校最新通知”。
- 用户可手动点击“生成回答”或“重新生成”。

## 8. Supabase 云端部署步骤

### 8.1 登录 Supabase

```bash
supabase login
```

### 8.2 关联项目

```bash
supabase link --project-ref atvnnhjlouscahugvsee
```

### 8.3 推送数据库迁移

```bash
supabase db push
```

### 8.4 配置 OpenRouter Secrets

```bash
supabase secrets set OPENROUTER_API_KEY=你的_openrouter_key
supabase secrets set OPENROUTER_MODEL=openrouter/free
supabase secrets set OPENROUTER_APP_NAME=Quipster
supabase secrets set OPENROUTER_SITE_URL=https://你的前端域名
```

### 8.5 部署 Edge Functions

```bash
supabase functions deploy questions
supabase functions deploy answers
```

如果你习惯一次性部署全部函数，也可以按你的现有流程执行。

## 9. 资料库准备建议

AI 质量主要取决于 `knowledge_base` 的内容质量。

建议至少录入以下类型资料：

- 教务相关常见问题
- 学院办事流程
- 校园服务指南
- 宿舍/食堂/图书馆/快递等生活信息
- 考研与实习经验整理

建议每条知识尽量补齐：

- `title`
- `content`
- `category`
- `keywords`
- `source`

这样检索效果会明显更稳定。

## 10. 注意事项

### 10.1 不影响现有功能

本次实现遵循“AI 与原有问答解耦”的原则：

- 发布问题成功不依赖 AI 成功。
- 人工回答、采纳答案不依赖 AI。
- AI 回答单独存储在 `ai_answers`，不会污染 `answers` 表。

### 10.2 已顺手修复的兼容问题

为避免问答模块其它功能被旧字段不一致影响，本次还修正了 `answers/accept` 与当前远端 schema 的兼容问题：

- 不再依赖 `questions.has_accepted_answer`
- 不再依赖 `questions.status`
- 改为使用 `questions.is_solved`
- 积分记录改为写入 `credit_records.change`

### 10.3 当前限制

当前知识库检索仍是“关键词匹配 + 规则打分”，不是向量检索。  
如果后续要提升准确率，可以继续升级为：

- pgvector 向量检索
- Embedding 召回
- 混合检索
- 更精细的 Prompt 模板

## 11. 建议的后续增强

可以继续做的增强项：

1. 增加 AI 回答状态字段，如 `pending / ready / failed`。
2. 在问题列表页增加“AI 已回答”标记。
3. 在后台增加知识库管理页面。
4. 为 AI 回答增加引用资料列表展示。
5. 将关键词检索升级为向量检索。
