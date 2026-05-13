# AI情绪识别

## 1. 模块说明

本模块为匿名树洞增加“AI 情绪识别（Emotion Detection）”能力。

当用户发布匿名树洞后，系统会：

1. 对文本内容进行情绪分析。
2. 将情绪划分为积极、中性、焦虑、压力、悲伤等类型。
3. 在识别到明显负面情绪时，自动生成支持建议。
4. 推荐相似树洞帖子与可关注的校园活动。

设计目标：

- 不影响原有匿名发帖、点赞、评论功能。
- 情绪识别失败时，发帖仍然成功。
- 优先使用规则识别，OpenRouter 可用时再做 AI 校正。

## 2. 本次实现内容

### 2.1 后端

新增与修改的文件：

- `supabase/functions/_shared/emotion-support.ts`
- `supabase/functions/anonymous-posts/index.ts`

后端新增能力：

- 匿名发帖后自动异步进行情绪识别。
- 将识别结果写回 `anonymous_posts.emotion_type / emotion_score / support_resources`。
- 支持单独获取帖子详情、评论列表、情绪支持信息。
- 支持手动重新执行情绪识别。

### 2.2 前端

新增与修改的文件：

- `frontend/src/api/anonymous.ts`
- `frontend/src/pages/anonymous/AnonymousPage.tsx`
- `frontend/src/pages/anonymous/AnonymousDetailPage.tsx`
- `frontend/src/types/index.ts`

前端新增能力：

- 树洞列表显示情绪标签。
- 树洞详情页显示情绪识别结果、支持建议、相关树洞和推荐活动。
- 支持手动“重新识别”。
- 匿名详情页改为真实请求详情和评论接口，不再依赖拉列表后本地查找。

## 3. 数据库依赖

当前实现依赖以下表：

- `anonymous_posts`
- `likes`
- `activities`
- `users`

### 3.1 anonymous_posts

需要包含字段：

- `id`
- `user_id`
- `title`
- `content`
- `tag`
- `emotion_type`
- `emotion_score`
- `support_resources`
- `type`
- `parent_id`
- `created_at`

当前远端 schema 中这些字段已经存在。

## 4. 情绪识别策略

### 4.1 第一层：规则识别

当前实现首先使用情绪词典和关键词匹配进行识别。

支持的情绪类型：

- `positive`
- `neutral`
- `anxiety`
- `stress`
- `sadness`

规则层会：

- 对树洞标题和正文做关键词匹配。
- 根据命中词计算情绪倾向。
- 识别明显风险词，如自伤、轻生等危机表达。

### 4.2 第二层：OpenRouter 校正

如果已配置 OpenRouter Key，系统会把规则初判结果发送给 OpenRouter 做一次轻量校正。

校正输出只允许返回：

- `emotion_type`
- `emotion_score`

如果 OpenRouter 不可用或返回异常，系统会自动回退到规则识别结果。

## 5. 支持机制

当情绪类型属于以下类别时：

- `anxiety`
- `stress`
- `sadness`

系统会自动提供支持建议，包括：

- 基础情绪支持建议
- 学业/压力沟通建议
- 心理支持建议
- 危机提示语
- 相似树洞推荐
- 近期活动推荐

### 5.1 危机词触发

如果文本中包含明显高风险表达，例如：

- 不想活
- 活不下去
- 自杀
- 轻生
- 自残

系统会额外给出更强的紧急支持提示。

## 6. API 设计

### 6.1 列表

```http
GET /anonymous-posts
```

返回中新增：

- `emotion_type`
- `emotion_label`

### 6.2 详情

```http
GET /anonymous-posts/:id
```

返回中新增：

- `emotion_type`
- `emotion_label`
- `emotion_score`
- `support_resources`

### 6.3 评论列表

```http
GET /anonymous-posts/:id/comments
```

### 6.4 情绪支持信息

```http
GET /anonymous-posts/:id/support
```

返回示例：

```json
{
  "success": true,
  "data": {
    "emotion_type": "stress",
    "emotion_label": "压力",
    "emotion_score": 0.82,
    "support_resources": [
      "建议优先保证睡眠、饮食和短时休息，把当前问题拆成更小的可执行步骤。"
    ],
    "support_posts": [
      { "id": "12", "title": "最近论文和课程压力真的好大" }
    ],
    "support_events": [
      { "id": "3", "title": "校园减压分享会", "start_time": "2026-05-12T10:00:00Z" }
    ]
  }
}
```

### 6.5 手动重算情绪识别

```http
POST /anonymous-posts/:id/analyze-emotion
```

用于手动重新触发识别与支持推荐生成。

### 6.6 自动触发

```http
POST /anonymous-posts
```

发帖成功后，系统会后台异步执行一次情绪识别。  
即使识别失败，发帖也仍然成功。

## 7. OpenRouter 配置

如果你已经为 AI 问答模块配置过以下 Secrets，这个模块可以直接复用：

```bash
supabase secrets set OPENROUTER_API_KEY=你的_openrouter_key
supabase secrets set OPENROUTER_MODEL=openrouter/free
supabase secrets set OPENROUTER_APP_NAME=Quipster
supabase secrets set OPENROUTER_SITE_URL=https://你的前端域名
```

说明：

- `OPENROUTER_API_KEY`：可选，但建议配置。
- 未配置时系统仍可运行，只是只用规则识别。

## 8. Supabase 云端部署步骤

### 8.1 登录

```bash
supabase login
```

### 8.2 关联项目

```bash
supabase link --project-ref atvnnhjlouscahugvsee
```

### 8.3 配置 Secrets

```bash
supabase secrets set OPENROUTER_API_KEY=你的_openrouter_key
supabase secrets set OPENROUTER_MODEL=openrouter/free
supabase secrets set OPENROUTER_APP_NAME=Quipster
supabase secrets set OPENROUTER_SITE_URL=https://你的前端域名
```

### 8.4 部署函数

```bash
supabase functions deploy anonymous-posts
```

## 9. 注意事项

### 9.1 不影响原功能

本次实现遵循“情绪识别与匿名树洞主流程解耦”的原则：

- 发帖成功不依赖情绪识别成功。
- 点赞、评论不依赖情绪识别结果。
- 情绪分析只写回匿名帖子本身，不影响匿名性。

### 9.2 匿名性

所有新增接口仍然不返回 `user_id`。  
本模块不会破坏匿名树洞的匿名展示规则。

### 9.3 当前限制

当前识别策略仍以规则匹配为主，OpenRouter 只做轻量校正。  
因此它适合作为“辅助识别”，不应被当作医学或心理诊断结果。

## 10. 建议的后续增强

后续可以继续增强：

1. 增加专门的心理资源表，而不是把支持建议只写成文本数组。
2. 增加“支持内容已查看”或“我需要帮助”按钮。
3. 用向量检索做更好的树洞相似推荐。
4. 将活动推荐改成更精确的情绪主题活动推荐。
5. 增加后台管理页面，维护支持文案与校园资源信息。
