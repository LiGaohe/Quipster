# Quipster API 文档

**版本**: v1.0.0  
**最后更新**: 2026-03-31  
**基础 URL**: `https://atvnnhjlouscahugvsee.supabase.co`

---

## 目录

1. [认证](#1-认证)
2. [用户](#2-用户)
3. [兴趣标签](#3-兴趣标签)
4. [匹配推荐](#4-匹配推荐)
5. [即时聊天](#5-即时聊天)
6. [动态](#6-动态)
7. [兴趣社群](#7-兴趣社群)
8. [活动](#8-活动)
9. [匿名树洞](#9-匿名树洞)
10. [校园问答](#10-校园问答)
11. [学习搭子](#11-学习搭子)
12. [社区治理](#12-社区治理)
13. [错误码](#13-错误码)

---

## 认证

### 1.1 注册

**Endpoint**: `POST /functions/v1/auth/register`

**描述**: 使用同济大学邮箱注册新用户

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ANON_KEY}
```

**请求体**:
```json
{
  "email": "student@tongji.edu.cn",
  "password": "password123",
  "nickname": "用户名"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 同济邮箱，仅支持 @tongji.edu.cn 或 @stu.tongji.edu.cn |
| password | string | 是 | 密码，最小6位 |
| nickname | string | 是 | 昵称，2-20字符 |

**成功响应** (201):
```json
{
  "success": true,
  "message": "注册成功，请查收邮箱验证邮件",
  "user": {
    "id": "7e3646bf-0e31-431d-aa61-2827743f075c",
    "email": "student@tongji.edu.cn"
  }
}
```

**错误响应** (400):
```json
{
  "error": "请使用同济大学邮箱（@tongji.edu.cn 或 @stu.tongji.edu.cn）注册"
}
```

---

### 1.2 登录

**Endpoint**: `POST /functions/v1/auth/login`

**描述**: 用户登录

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ANON_KEY}
```

**请求体**:
```json
{
  "email": "student@tongji.edu.cn",
  "password": "password123"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 同济邮箱 |
| password | string | 是 | 密码 |

**成功响应** (200):
```json
{
  "success": true,
  "message": "登录成功",
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": 1774922763
  },
  "user": {
    "id": "7e3646bf-0e31-431d-aa61-2827743f075c",
    "email": "student@tongji.edu.cn",
    "nickname": "用户名",
    "avatar_url": "https://...",
    "credit_score": 100
  }
}
```

**错误响应** (401):
```json
{
  "error": "邮箱或密码错误"
}
```

---

### 1.3 退出登录

**Endpoint**: `POST /functions/v1/auth/logout`

**描述**: 用户退出登录

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}
```

**成功响应** (200):
```json
{
  "success": true,
  "message": "已退出登录"
}
```

---

## 2. 用户

### 2.1 获取用户资料

**Endpoint**: `GET /functions/v1/users/{id}`

**描述**: 获取指定用户的资料信息

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | uuid | 用户ID |

**请求头**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

**成功响应** (200):
```json
{
  "success": true,
  "data": {
    "id": "7e3646bf-0e31-431d-aa61-2827743f075c",
    "email": "student@tongji.edu.cn",
    "nickname": "用户名",
    "avatar_url": "https://...",
    "gender": "男",
    "major": "软件工程",
    "grade": "2023级",
    "bio": "个人简介",
    "credit_score": 100,
    "visibility": 1,
    "created_at": "2026-03-31T10:00:00Z"
  }
}
```

---

### 2.2 更新用户资料

**Endpoint**: `PUT /functions/v1/users/{id}`

**描述**: 更新当前用户的资料信息

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | uuid | 用户ID（需与当前登录用户一致） |

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}
```

**请求体**:
```json
{
  "nickname": "新昵称",
  "avatar_url": "https://...",
  "gender": "男",
  "major": "软件工程",
  "grade": "2023级",
  "bio": "新的个人简介",
  "visibility": 1
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| nickname | string | 否 | 昵称 |
| avatar_url | string | 否 | 头像URL |
| gender | string | 否 | 性别 |
| major | string | 否 | 专业 |
| grade | string | 否 | 年级 |
| bio | string | 否 | 个人简介 |
| visibility | integer | 否 | 可见性 0:仅好友 1:所有人 |

**成功响应** (200):
```json
{
  "success": true,
  "message": "资料更新成功",
  "data": {
    "id": "7e3646bf-0e31-431d-aa61-2827743f075c",
    "nickname": "新昵称",
    ...
  }
}
```

---

### 2.3 搜索用户

**Endpoint**: `GET /functions/v1/users`

**描述**: 根据条件搜索用户

**请求头**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| keyword | string | 搜索关键词（昵称、专业） |
| major | string | 专业 |
| grade | string | 年级 |
| page | integer | 页码，默认1 |
| limit | integer | 每页数量，默认20 |

**成功响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "nickname": "用户名",
      "avatar_url": "https://...",
      "major": "软件工程",
      "grade": "2023级"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

## 3. 兴趣标签

### 3.1 获取标签列表

**Endpoint**: `GET /functions/v1/tags`

**描述**: 获取所有可用的兴趣标签

**请求头**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

**成功响应** (200):
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "编程", "category": "技术" },
    { "id": 2, "name": "音乐", "category": "艺术" },
    { "id": 3, "name": "篮球", "category": "运动" }
  ]
}
```

---

### 3.2 获取用户标签

**Endpoint**: `GET /functions/v1/user-tags/{userId}`

**描述**: 获取指定用户的兴趣标签

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| userId | uuid | 用户ID |

**成功响应** (200):
```json
{
  "success": true,
  "data": [
    { "tag_id": 1, "tag_name": "编程" }
  ]
}
```

---

### 3.3 设置用户标签

**Endpoint**: `POST /functions/v1/user-tags`

**描述**: 为当前用户设置兴趣标签

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}
```

**请求体**:
```json
{
  "tag_ids": [1, 2, 3]
}
```

**成功响应** (200):
```json
{
  "success": true,
  "message": "标签设置成功"
}
```

---

## 4. 匹配推荐

### 4.1 获取匹配推荐

**Endpoint**: `GET /functions/v1/matches`

**描述**: 根据用户兴趣标签获取推荐的好友列表

**请求头**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| page | integer | 页码，默认1 |
| limit | integer | 每页数量，默认10 |

**成功响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "user_id": "...",
      "nickname": "用户名",
      "avatar_url": "https://...",
      "major": "软件工程",
      "common_tags": ["编程", "音乐"],
      "match_score": 85.5
    }
  ]
}
```

---

### 4.2 创建匹配记录

**Endpoint**: `POST /functions/v1/matches`

**描述**: 记录用户对推荐结果的操作（喜欢/不喜欢）

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}
```

**请求体**:
```json
{
  "target_user_id": "...",
  "action": "like"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| target_user_id | uuid | 是 | 目标用户ID |
| action | string | 是 | 操作：like/dislike |

**成功响应** (200):
```json
{
  "success": true,
  "is_matched": true,
  "message": "匹配成功！"
}
```

---

## 5. 即时聊天

### 5.1 获取会话列表

**Endpoint**: `GET /functions/v1/conversations`

**描述**: 获取当前用户的所有会话列表

**请求头**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

**成功响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "conversation_id": "...",
      "peer_user": {
        "id": "...",
        "nickname": "用户名",
        "avatar_url": "https://..."
      },
      "last_message": {
        "content": "最后一条消息",
        "created_at": "2026-03-31T10:00:00Z"
      },
      "unread_count": 2
    }
  ]
}
```

---

### 5.2 获取聊天记录

**Endpoint**: `GET /functions/v1/conversations/{id}/messages`

**描述**: 获取指定会话的聊天记录

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | uuid | 会话ID |

**请求头**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| page | integer | 页码，默认1 |
| limit | integer | 每页数量，默认50 |
| before | timestamp | 获取此时间之前的消息 |

**成功响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "sender_id": "...",
      "content": "消息内容",
      "message_type": "text",
      "created_at": "2026-03-31T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "has_more": true
  }
}
```

---

### 5.3 发送消息

**Endpoint**: `POST /functions/v1/messages`

**描述**: 发送消息给指定用户

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}
```

**请求体**:
```json
{
  "receiver_id": "...",
  "content": "消息内容",
  "message_type": "text"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| receiver_id | uuid | 是 | 接收者用户ID |
| content | string | 是 | 消息内容 |
| message_type | string | 否 | 消息类型：text/image，默认text |

**成功响应** (201):
```json
{
  "success": true,
  "data": {
    "id": "...",
    "sender_id": "...",
    "receiver_id": "...",
    "content": "消息内容",
    "message_type": "text",
    "created_at": "2026-03-31T10:00:00Z"
  }
}
```

---

## 6. 动态

### 6.1 获取动态列表

**Endpoint**: `GET /functions/v1/posts`

**描述**: 获取用户动态信息流

**请求头**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| page | integer | 页码，默认1 |
| limit | integer | 每页数量，默认20 |
| user_id | uuid | 筛选特定用户的动态 |

**成功响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "user": {
        "id": "...",
        "nickname": "用户名",
        "avatar_url": "https://..."
      },
      "content": "动态内容",
      "images": ["https://..."],
      "like_count": 10,
      "comment_count": 5,
      "is_liked": true,
      "created_at": "2026-03-31T10:00:00Z"
    }
  ]
}
```

---

### 6.2 发布动态

**Endpoint**: `POST /functions/v1/posts`

**描述**: 发布新的动态

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}
```

**请求体**:
```json
{
  "content": "动态内容",
  "images": ["https://..."]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 是 | 动态内容，最多500字 |
| images | string[] | 否 | 图片URL数组，最多9张 |

**成功响应** (201):
```json
{
  "success": true,
  "message": "发布成功",
  "data": {
    "id": "...",
    "content": "动态内容",
    "images": ["https://..."],
    "created_at": "2026-03-31T10:00:00Z"
  }
}
```

---

### 6.3 点赞动态

**Endpoint**: `POST /functions/v1/posts/{id}/like`

**描述**: 点赞或取消点赞动态

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | uuid | 动态ID |

**请求头**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

**成功响应** (200):
```json
{
  "success": true,
  "is_liked": true,
  "like_count": 11
}
```

---

### 6.4 评论动态

**Endpoint**: `POST /functions/v1/posts/{id}/comment`

**描述**: 评论动态

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | uuid | 动态ID |

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}
```

**请求体**:
```json
{
  "content": "评论内容"
}
```

**成功响应** (201):
```json
{
  "success": true,
  "data": {
    "id": "...",
    "user": {
      "id": "...",
      "nickname": "用户名",
      "avatar_url": "https://..."
    },
    "content": "评论内容",
    "created_at": "2026-03-31T10:00:00Z"
  }
}
```

---

## 7. 兴趣社群

### 7.1 获取社群列表

**Endpoint**: `GET /functions/v1/groups`

**描述**: 获取兴趣社群列表

**请求头**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| keyword | string | 搜索关键词 |
| page | integer | 页码，默认1 |
| limit | integer | 每页数量，默认20 |

**成功响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "编程爱好者",
      "description": "社群描述",
      "cover_url": "https://...",
      "member_count": 100,
      "is_joined": false
    }
  ]
}
```

---

### 7.2 创建社群

**Endpoint**: `POST /functions/v1/groups`

**描述**: 创建新的兴趣社群

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}
```

**请求体**:
```json
{
  "name": "社群名称",
  "description": "社群描述",
  "cover_url": "https://...",
  "tags": [1, 2]
}
```

**成功响应** (201):
```json
{
  "success": true,
  "message": "社群创建成功",
  "data": {
    "id": "..."
  }
}
```

---

### 7.3 加入社群

**Endpoint**: `POST /functions/v1/groups/{id}/join`

**描述**: 加入指定社群

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | uuid | 社群ID |

**成功响应** (200):
```json
{
  "success": true,
  "message": "加入成功"
}
```

---

## 8. 活动

### 8.1 获取活动列表

**Endpoint**: `GET /functions/v1/events`

**描述**: 获取校园活动列表

**请求头**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| keyword | string | 搜索关键词 |
| status | string | 活动状态：upcoming/on_going/ended |
| page | integer | 页码，默认1 |
| limit | integer | 每页数量，默认20 |

**成功响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "title": "活动标题",
      "description": "活动描述",
      "cover_url": "https://...",
      "organizer": {
        "id": "...",
        "nickname": "主办方"
      },
      "start_time": "2026-04-01T10:00:00Z",
      "end_time": "2026-04-01T18:00:00Z",
      "location": "同济大学",
      "max_participants": 50,
      "current_participants": 30,
      "is_signed_up": false
    }
  ]
}
```

---

### 8.2 创建活动

**Endpoint**: `POST /functions/v1/events`

**描述**: 创建新的校园活动

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}
```

**请求体**:
```json
{
  "title": "活动标题",
  "description": "活动描述",
  "cover_url": "https://...",
  "start_time": "2026-04-01T10:00:00Z",
  "end_time": "2026-04-01T18:00:00Z",
  "location": "同济大学",
  "max_participants": 50
}
```

**成功响应** (201):
```json
{
  "success": true,
  "message": "活动创建成功",
  "data": {
    "id": "..."
  }
}
```

---

### 8.3 报名活动

**Endpoint**: `POST /functions/v1/events/{id}/signup`

**描述**: 报名参加活动

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | uuid | 活动ID |

**成功响应** (200):
```json
{
  "success": true,
  "message": "报名成功"
}
```

---

## 9. 匿名树洞

### 9.1 获取匿名帖子列表

**Endpoint**: `GET /functions/v1/anonymous-posts`

**描述**: 获取匿名树洞帖子列表

**请求头**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| tag_id | integer | 按标签筛选 |
| sort | string | 排序：latest/popular |
| page | integer | 页码，默认1 |
| limit | integer | 每页数量，默认20 |

**成功响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "title": "帖子标题",
      "content": "帖子内容",
      "tags": [{"id": 1, "name": "学习"}],
      "like_count": 20,
      "comment_count": 5,
      "is_liked": false,
      "created_at": "2026-03-31T10:00:00Z"
    }
  ]
}
```

---

### 9.2 发布匿名帖子

**Endpoint**: `POST /functions/v1/anonymous-posts`

**描述**: 发布匿名帖子

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}
```

**请求体**:
```json
{
  "title": "帖子标题",
  "content": "帖子内容",
  "tags": [1, 2]
}
```

**成功响应** (201):
```json
{
  "success": true,
  "message": "发布成功",
  "data": {
    "id": "..."
  }
}
```

---

### 9.3 评论匿名帖子

**Endpoint**: `POST /functions/v1/anonymous-posts/{id}/comment`

**描述**: 评论匿名帖子

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | uuid | 帖子ID |

**请求体**:
```json
{
  "content": "评论内容"
}
```

**成功响应** (201):
```json
{
  "success": true,
  "data": {
    "id": "...",
    "content": "评论内容",
    "created_at": "2026-03-31T10:00:00Z"
  }
}
```

---

## 10. 校园问答

### 10.1 获取问题列表

**Endpoint**: `GET /functions/v1/questions`

**描述**: 获取校园问答问题列表

**请求头**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| tag_id | integer | 按标签筛选 |
| status | string | 状态：open/closed |
| sort | string | 排序：latest/hotests |
| page | integer | 页码，默认1 |
| limit | integer | 每页数量，默认20 |

**成功响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "title": "问题标题",
      "content": "问题描述",
      "tags": [{"id": 1, "name": "课程"}],
      "answer_count": 3,
      "has_accepted_answer": true,
      "user": {
        "id": "...",
        "nickname": "提问者"
      },
      "created_at": "2026-03-31T10:00:00Z"
    }
  ]
}
```

---

### 10.2 发布问题

**Endpoint**: `POST /functions/v1/questions`

**描述**: 发布新的问题

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}
```

**请求体**:
```json
{
  "title": "问题标题",
  "content": "问题详细描述",
  "tags": [1, 2]
}
```

**成功响应** (201):
```json
{
  "success": true,
  "message": "问题发布成功",
  "data": {
    "id": "..."
  }
}
```

---

### 10.3 回答问题

**Endpoint**: `POST /functions/v1/questions/{id}/answers`

**描述**: 回答指定问题

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | uuid | 问题ID |

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}
```

**请求体**:
```json
{
  "content": "回答内容"
}
```

**成功响应** (201):
```json
{
  "success": true,
  "data": {
    "id": "...",
    "content": "回答内容",
    "user": {
      "id": "...",
      "nickname": "回答者"
    },
    "created_at": "2026-03-31T10:00:00Z"
  }
}
```

---

### 10.4 采纳答案

**Endpoint**: `POST /functions/v1/answers/{id}/accept`

**描述**: 提问者采纳最佳答案

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | uuid | 答案ID |

**成功响应** (200):
```json
{
  "success": true,
  "message": "已采纳为最佳答案"
}
```

---

## 11. 学习搭子

### 11.1 获取学习任务列表

**Endpoint**: `GET /functions/v1/study-tasks`

**描述**: 获取学习搭子任务列表

**请求头**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| tag_id | integer | 按标签筛选 |
| status | string | 状态：open/closed |
| page | integer | 页码，默认1 |
| limit | integer | 每页数量，默认20 |

**成功响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "title": "考研数学学习",
      "description": "寻找一起复习考研数学的伙伴",
      "tags": [{"id": 1, "name": "考研"}],
      "target_count": 5,
      "current_count": 2,
      "creator": {
        "id": "...",
        "nickname": "发起者"
      },
      "status": "open",
      "created_at": "2026-03-31T10:00:00Z"
    }
  ]
}
```

---

### 11.2 发布学习任务

**Endpoint**: `POST /functions/v1/study-tasks`

**描述**: 发布新的学习搭子任务

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}
```

**请求体**:
```json
{
  "title": "任务标题",
  "description": "任务描述",
  "tags": [1, 2],
  "target_count": 5
}
```

**成功响应** (201):
```json
{
  "success": true,
  "message": "任务发布成功",
  "data": {
    "id": "..."
  }
}
```

---

### 11.3 申请加入

**Endpoint**: `POST /functions/v1/study-tasks/{id}/join`

**描述**: 申请加入学习任务

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | uuid | 任务ID |

**成功响应** (200):
```json
{
  "success": true,
  "message": "申请已提交"
}
```

---

## 12. 社区治理

### 12.1 举报内容

**Endpoint**: `POST /functions/v1/reports`

**描述**: 举报用户或内容

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}
```

**请求体**:
```json
{
  "target_type": "post",
  "target_id": "...",
  "reason": "违规内容",
  "description": "详细描述"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| target_type | string | 是 | 举报类型：user/post/comment/message |
| target_id | uuid | 是 | 被举报内容ID |
| reason | string | 是 | 举报原因 |
| description | string | 否 | 详细描述 |

**成功响应** (201):
```json
{
  "success": true,
  "message": "举报已提交，感谢您的反馈"
}
```

---

### 12.2 获取信用信息

**Endpoint**: `GET /functions/v1/credit`

**描述**: 获取当前用户的信用信息

**请求头**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

**成功响应** (200):
```json
{
  "success": true,
  "data": {
    "credit_score": 95,
    "level": "良好",
    "records": [
      {
        "type": "increase",
        "amount": 5,
        "reason": "优质回答被采纳",
        "created_at": "2026-03-30T10:00:00Z"
      },
      {
        "type": "decrease",
        "amount": -10,
        "reason": "被举报内容违规",
        "created_at": "2026-03-29T10:00:00Z"
      }
    ]
  }
}
```

---

## 13. 错误码

| 错误码 | HTTP状态码 | 说明 |
|--------|------------|------|
| AUTH_001 | 400 | 无效的邮箱格式 |
| AUTH_002 | 400 | 非同济邮箱（@tongji.edu.cn 或 @stu.tongji.edu.cn） |
| AUTH_003 | 401 | 邮箱或密码错误 |
| AUTH_004 | 401 | Token已过期 |
| AUTH_005 | 403 | 无权限访问 |
| AUTH_006 | 400 | 密码长度不足 |
| USER_001 | 404 | 用户不存在 |
| USER_002 | 400 | 昵称已被使用 |
| POST_001 | 404 | 动态不存在 |
| POST_002 | 400 | 内容超过长度限制 |
| GROUP_001 | 404 | 社群不存在 |
| GROUP_002 | 400 | 已加入该社群 |
| EVENT_001 | 404 | 活动不存在 |
| EVENT_002 | 400 | 活动已满员 |
| EVENT_003 | 400 | 已报名该活动 |
| QUESTION_001 | 404 | 问题不存在 |
| ANSWER_001 | 404 | 答案不存在 |
| ANSWER_002 | 403 | 仅提问者可采纳答案 |
| STUDY_TASK_001 | 404 | 任务不存在 |
| STUDY_TASK_002 | 400 | 任务已满员 |
| REPORT_001 | 400 | 举报类型无效 |
| CREDIT_001 | 400 | 信用分已达下限 |
| COMMON_001 | 500 | 服务器内部错误 |

---

## 附录

### A. 通用响应格式

**成功响应**:
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "错误描述"
  }
}
```

### B. 分页响应格式

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### C. 认证说明

除登录注册接口外，所有接口都需要在请求头中携带 JWT Token：

```
Authorization: Bearer {ACCESS_TOKEN}
```

Token 在登录成功后会返回，需要妥善保存在前端（如 localStorage），并在后续请求中携带。
