# Quipster

同济大学校园社交平台

## 项目结构

```
Quipster/
├── frontend/          # 前端项目 (Vite + React + TypeScript)
├── supabase/          # Supabase Edge Functions
└── Files/             # 项目文档
```

## 快速启动

```bash
cd frontend
npm install
npm run dev
```

启动后访问 http://localhost:3000/

## 可用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | 代码检查 |

## 技术栈

- **前端**: Vite + React + TypeScript + MUI + Redux Toolkit
- **后端**: Supabase (PostgreSQL + Edge Functions + Realtime)
