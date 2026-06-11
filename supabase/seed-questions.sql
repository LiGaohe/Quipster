-- 校园问答种子数据（用于演示场景 F）
-- 使用方式: docker exec -i supabase_db_atvnnhjlouscahugvsee psql -U postgres < supabase/seed-questions.sql

-- 清空已有问答数据（避免重复执行导致冲突）
DELETE FROM public.ai_answers;
DELETE FROM public.answers;
DELETE FROM public.question_tags;
DELETE FROM public.questions;

-- 重置序列
ALTER TABLE public.questions ALTER COLUMN id RESTART WITH 1;
ALTER TABLE public.ai_answers ALTER COLUMN id RESTART WITH 1;
ALTER TABLE public.answers ALTER COLUMN id RESTART WITH 1;

-- ─── 插入问题 ──────────────────────────────────────────────────────────────

INSERT INTO public.questions (user_id, title, content, category, is_solved, has_ai_answer) VALUES
  ('1b52ad8d-c8f5-4a9c-b98f-7fbb5914ba43', '如何快速掌握 JavaScript 闭包？',
   '我是大一新生，正在自学前端开发。看了很多文档还是不太理解闭包的概念，有没有通俗易懂的解释和实际应用场景？',
   '技术', false, true),
  ('8860d8ba-0160-4113-8aa6-20fc4300e299', '学校篮球场周末开放时间？',
   '想和同学约周末打球，请问室内篮球场和室外篮球场的开放时间分别是多少？需要预约吗？',
   '运动', false, false),
  ('953981b7-bb36-48d9-b357-ea8efb5bde1e', '求推荐适合新手的摄影社团',
   '刚买了相机，想加入学校的摄影社团，请问哪个社团比较适合新手？有没有定期的外拍活动？',
   '艺术', false, false),
  ('0c062fd2-3cb3-47f2-bbc7-1a748f2aade2', '如何在 Linux 服务器上部署 Node.js 项目？',
   '我们小组的课程设计需要部署一个 Node.js 后端项目到服务器上。请问有没有完整的部署流程和注意事项？',
   '技术', true, true),
  ('1b52ad8d-c8f5-4a9c-b98f-7fbb5914ba43', '英语四级听力训练方法',
   '四级听力总是拿不到高分，尝试过精听和泛听结合，但效果不明显。求有效的听力训练方法！',
   '学习', false, true),
  ('8860d8ba-0160-4113-8aa6-20fc4300e299', '同济周边有什么好吃的餐馆推荐？',
   '刚来同济不久，想问一下学校附近有什么性价比高的餐馆？最好是适合学生聚餐的那种！',
   '生活', false, false),
  ('953981b7-bb36-48d9-b357-ea8efb5bde1e', '原神新手入坑需要注意什么？',
   '最近想入坑原神，但听说坑很深。请问零氪党能玩吗？前期有什么注意事项？',
   '娱乐', false, false);

-- ─── 问题打标签 ──────────────────────────────────────────────────────────

INSERT INTO public.question_tags (question_id, tag_id) VALUES
  (1, 1),  -- JS闭包 → 编程
  (2, 2),  -- 篮球场 → 篮球
  (3, 3),  -- 摄影社团 → 摄影
  (4, 1),  -- Node.js部署 → 编程
  (5, 5),  -- 四级听力 → 阅读(学习)
  (6, 7),  -- 周边餐馆 → 旅行(生活)
  (7, 6);  -- 原神 → 游戏

-- ─── AI 参考回答 ────────────────────────────────────────────────────────

INSERT INTO public.ai_answers (question_id, content) VALUES
  (1, E'闭包（Closure）简单说就是：**函数可以"记住"它被创建时的环境，即使这个环境已经执行完了**。\n\n## 通俗理解\n把闭包想象成一个"背包"——函数在定义时，会把当前作用域的变量都装进这个背包里。以后不管在哪里调用这个函数，它都能从背包里拿出这些变量来用。\n\n## 经典例子\n```javascript\nfunction createCounter() {\n  let count = 0  // 这个变量被"装进背包"\n  return function() {\n    count++       // 每次调用都能访问和修改 count\n    return count\n  }\n}\nconst counter = createCounter()\nconsole.log(counter())  // 1\nconsole.log(counter())  // 2\nconsole.log(counter())  // 3\n```\n注意：`createCounter` 执行完毕后，内部的 `count` 按理说应该被销毁，但因为返回的函数持有对它的引用，它仍然存在于内存中。\n\n## 实际应用场景\n1. **数据私有化**：上面的计数器就是典型的例子，外部代码无法直接修改 count\n2. **柯里化（Currying）**：固定某些参数，生成更具体的函数\n3. **回调函数与事件处理**：在异步操作中保留上下文\n4. **模块模式**：模拟私有变量和方法\n\n## 注意事项\n- 闭包会占用额外内存，因为被引用的变量不会被垃圾回收\n- 在循环中创建闭包时要注意变量共享问题（建议用 let 代替 var）'),
  (4, E'## Node.js 项目部署完整流程\n\n### 1. 服务器准备\n- 购买云服务器（阿里云/腾讯云学生机性价比高，约 ¥100/年）\n- 系统推荐 Ubuntu 20.04+ 或 CentOS 7+\n- 确保开放常用端口：22(SSH)、80/443(HTTP/HTTPS)、3000(应用端口)\n\n### 2. 环境安装\n```bash\n# 安装 Node.js（推荐使用 nvm 管理版本）\ncurl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash\nnvm install 18\nnvm use 18\n\n# 安装 PM2（进程管理）\nnpm install -g pm2\n\n# 安装 Nginx（反向代理）\nsudo apt update && sudo apt install nginx -y\n```\n\n### 3. 项目部署\n```bash\n# 从 GitHub 拉取代码\ngit clone https://github.com/your/project.git\ncd project\nnpm install\n\n# 配置环境变量\ncp .env.example .env\nvim .env  # 修改数据库连接等配置\n\n# 使用 PM2 启动\npm2 start npm --name "my-app" -- start\npm2 save\npm2 startup  # 设置开机自启\n```\n\n### 4. Nginx 反向代理配置\n```nginx\nserver {\n    listen 80;\n    server_name your-domain.com;\n\n    location / {\n        proxy_pass http://127.0.0.1:3000;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n    }\n}\n```\n\n### 5. 常见问题\n- **端口被占用**：用 `lsof -i :3000` 查看端口占用\n- **内存不足**：512MB 内存的服务器可加 swap 空间\n- **日志查看**：`pm2 logs my-app` 查看实时日志'),
  (5, E'## 英语四级听力高效训练方法\n\n### 问题诊断\n你提到的"精听+泛听结合效果不明显"，很可能是两个问题：\n1. **精听方法不对**——被动听写而不是主动分析\n2. **泛听缺乏针对性**——听的内容与四级题型脱节\n\n### 推荐训练方案\n\n#### 阶段一：精听（每天 20 分钟）\n1. **选材**：直接用四级真题听力（近 3 年）\n2. **方法**：\n   - 第一遍：正常做题，不对答案\n   - 第二遍：逐句听写，每句最多听 3 遍\n   - 第三遍：对照原文，标出没听出来的单词（尤其是连读、弱读现象）\n3. **跟读模仿**：对着原文跟读 2-3 遍，注意语音语调\n\n#### 阶段二：泛听（每天 30 分钟）\n- **推荐资源**：BBC 6 Minute English、VOA慢速英语、TED-Ed\n- **要求**：理解大意即可，不纠结生词\n- **技巧**：通勤/吃饭时听，利用碎片时间\n\n#### 阶段三：考前冲刺（考前 2 周）\n1. 每天一套真题听力，完全模拟考试环境\n2. 分析错题类型，针对性强化\n\n### 关键技巧\n- **预读选项**：播放 Directions 时快速浏览选项，预测话题\n- **抓关键词**：but, however, actually 等转折词后往往是考点\n- **顺序原则**：四级听力通常按文章顺序出题');