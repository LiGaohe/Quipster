# Cloudflare Pages 部署步骤

## 1. 构建项目
```bash
cd frontend
npm run build
```

## 2. 安装 Wrangler CLI
```bash
npm install -g wrangler
```

## 3. 登录 Cloudflare
```bash
wrangler login
```

## 4. 部署到 Cloudflare Pages
```bash
wrangler pages deploy dist --project-name=quipster
```

## 5. 配置环境变量
在 Cloudflare Pages 控制台设置：
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_API_BASE_URL

访问：https://dash.cloudflare.com/
进入 Pages > quipster > Settings > Environment variables

## 优势
- 全球 CDN 加速
- 国内访问相对稳定
- 免费额度大
- 自动 HTTPS