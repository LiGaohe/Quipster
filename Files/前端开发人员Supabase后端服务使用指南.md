# 前端开发人员 Supabase 后端服务使用指南

## 1. 环境配置

### 1.1 项目环境变量

在 `Quipster/frontend/.env` 文件中配置以下环境变量：

```env
VITE_SUPABASE_URL=https://atvnnhjlouscahugvsee.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0dm5uaGpsb3VzY2FodWd2c2VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjE2MzMsImV4cCI6MjA5MDQ5NzYzM30.ZlZffGs63PEfa0f8X9tjFienw0vX9IguH6bdFE8iuJI
```

### 1.2 多环境配置示例

```env
# .env.development (本地开发)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key

# .env.production (生产环境，当前使用)
VITE_SUPABASE_URL=https://atvnnhjlouscahugvsee.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 2. 依赖安装

```bash
npm install @supabase/supabase-js
```

## 3. Supabase 客户端初始化

创建 `src/lib/supabase.ts` 文件：

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## 4. API 接口调用

- 见`api/README.md`

## 7. 常见问题

### 7.1 是否需要 Supabase 账号？

**不需要**。前端开发人员只需要：
- 项目 URL
- Anon 公开密钥

### 7.2 Anon 密钥安全吗？

Anon 密钥是**公开密钥**，类似于 API Key，可以安全地暴露在客户端。所有敏感操作都在 Edge Functions 内部进行权限验证。

### 7.3 本地开发与生产环境切换

```bash
# 开发环境
npm run dev

# 生产构建
npm run build
```

Vite 会根据 `package.json` 中的 `mode` 自动选择对应的 `.env` 文件。

## 8. 项目结构参考

```
Quipster/frontend/
├── .env                    # 生产环境配置
├── .env.development        # 开发环境配置
├── .env.production         # 生产环境配置
└── src/
    └── lib/
        └── supabase.ts     # Supabase 客户端
```
