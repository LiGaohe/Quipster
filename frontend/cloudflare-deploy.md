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

## 性能优化配置

### 已实现的优化

1. **代码分割**：将 React、MUI、Redux、Supabase 等库分离成独立 chunk
2. **路由懒加载**：所有页面组件按需加载，减少首屏加载时间
3. **资源压缩**：生产环境移除 console 和 debugger
4. **缓存策略**：
   - 静态资源（JS/CSS/图片）缓存 1 年
   - HTML 文件不缓存，确保更新及时

### Cloudflare 控制台优化建议

在 Cloudflare Pages 控制台启用以下功能：

1. **Speed > Optimization**
   - ✅ Auto Minify: HTML, CSS, JavaScript
   - ✅ Brotli 压缩
   - ✅ Early Hints（预加载提示）

2. **Speed > Rocket Loader**
   - ⚠️ 不建议开启（可能与 React 冲突）

3. **Caching > Configuration**
   - ✅ Browser Cache TTL: 1 year
   - ✅ Always Online: 可选

4. **Network**
   - ✅ HTTP/3 (QUIC)
   - ✅ 0-RTT Connection Resumption
   - ✅ WebSockets

### 构建分析

查看打包后各模块大小：
```bash
npm run build
# 查看 dist/assets 目录中的文件大小
```

预期优化效果：

- 首屏加载：减少 40-60%
- 后续页面：减少 70-80%（缓存命中）
- 总包大小：减少 30-50%（代码分割）

## 优势

- 全球 CDN 加速
- 国内访问相对稳定
- 免费额度大
- 自动 HTTPS
- HTTP/3 支持