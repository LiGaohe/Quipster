// ============================================================
// 全局类型定义
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: {
    code: string
    message: string
  }
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: Pagination
}

export interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

// ============================================================
// 用户相关
// ============================================================

export interface User {
  id: string
  email: string
  nickname: string
  avatar_url?: string
  gender?: string
  major?: string
  grade?: string
  bio?: string
  credit_score: number
  visibility: 0 | 1
  created_at: string
}

export interface UserBasic {
  id: string
  nickname: string
  avatar_url?: string
  major?: string
  grade?: string
}

export interface UpdateUserDto {
  nickname?: string
  avatar_url?: string
  gender?: string
  major?: string
  grade?: string
  bio?: string
  visibility?: 0 | 1
}

export interface SearchUsersParams {
  keyword?: string
  major?: string
  grade?: string
  page?: number
  limit?: number
}

// ============================================================
// 认证相关
// ============================================================

export interface RegisterDto {
  email: string
  password: string
  nickname: string
}

export interface LoginDto {
  email: string
  password: string
}

export interface Session {
  access_token: string
  refresh_token: string
  expires_at: number
}

export interface LoginResponse {
  success: boolean
  message: string
  session: Session
  user: User
}

export interface RegisterResponse {
  success: boolean
  message: string
  user: {
    id: string
    email: string
  }
}

// ============================================================
// 兴趣标签
// ============================================================

export interface Tag {
  id: number
  name: string
  category: string
}

export interface UserTag {
  tag_id: number
  tag_name: string
}

// ============================================================
// 匹配推荐
// ============================================================

export interface MatchUser {
  user_id: string
  nickname: string
  avatar_url?: string
  major?: string
  common_tags: string[]
  match_score: number
}

export interface MatchActionDto {
  target_user_id: string
  action: 'like' | 'dislike'
}

export interface MatchActionResponse {
  success: boolean
  is_matched: boolean
  message: string
}

// ============================================================
// 即时聊天
// ============================================================

export interface Conversation {
  conversation_id: string
  name?: string
  is_group?: boolean
  peer_user: UserBasic | null
  last_message?: {
    content: string
    created_at: string
  }
  unread_count: number
}

export interface Message {
  id: string
  sender_user_id: string
  content: string
  message_type: 'text' | 'image'
  status: 'sent' | 'delivered' | 'read'
  created_at: string
}

export interface SendMessageDto {
  receiver_id?: string
  conversation_id?: string | number
  content: string
  message_type?: 'text' | 'image'
}

export interface GetMessagesParams {
  page?: number
  limit?: number
  before?: string
}

// ============================================================
// 动态
// ============================================================

export interface Post {
  id: string
  user: UserBasic
  content: string
  images?: string[]
  like_count: number
  comment_count: number
  is_liked: boolean
  created_at: string
}

export interface Comment {
  id: string
  user: UserBasic
  content: string
  created_at: string
}

export interface CreatePostDto {
  content: string
  images?: string[]
}

export interface GetPostsParams {
  page?: number
  limit?: number
  user_id?: string
}

// ============================================================
// 兴趣社群
// ============================================================

export interface Group {
  id: string | number
  name: string
  description?: string
  avatar_url?: string
  cover_url?: string
  member_count: number
  is_joined: boolean
  my_role?: 'owner' | 'admin' | 'member' | null
  creator_user_id?: string
  created_at?: string
  conversation_id?: string | number
}

export interface CreateGroupDto {
  name: string
  description?: string
  avatar_url?: string
  cover_url?: string
  tags?: number[]
}

export interface UpdateGroupDto {
  name?: string
  description?: string
  avatar_url?: string
}

export interface GroupMember {
  user_id: string
  nickname?: string
  avatar_url?: string
  role: 'owner' | 'admin' | 'member'
  joined_at?: string
}

// ============================================================
// 活动
// ============================================================

export interface Event {
  id: string
  title: string
  description?: string
  cover_url?: string
  group_id?: number
  organizer: UserBasic
  start_time: string
  end_time?: string
  location?: string
  max_participants?: number
  current_participants: number
  is_signed_up: boolean
}

export interface CreateEventDto {
  title: string
  description?: string
  cover_url?: string
  group_id?: number
  start_time: string
  end_time?: string
  location?: string
  max_participants?: number
}

export interface GetEventsParams {
  keyword?: string
  status?: 'upcoming' | 'on_going' | 'ended'
  group_id?: number
  page?: number
  limit?: number
}

// ============================================================
// 匿名树洞
// ============================================================

export interface AnonymousPost {
  id: string
  title: string
  content: string
  tags?: Array<{ id: number; name: string }>
  like_count: number
  comment_count: number
  is_liked: boolean
  created_at: string
}

export interface AnonymousComment {
  id: string
  content: string
  created_at: string
}

export interface CreateAnonymousPostDto {
  title: string
  content: string
  tags?: number[]
}

export interface GetAnonymousPostsParams {
  tag_id?: number
  sort?: 'latest' | 'popular'
  page?: number
  limit?: number
}

// ============================================================
// 校园问答
// ============================================================

export interface Question {
  id: string
  title: string
  content: string
  tags?: Array<{ id: number; name: string }>
  answer_count: number
  has_accepted_answer: boolean
  user: UserBasic
  created_at: string
}

export interface Answer {
  id: string
  content: string
  user: UserBasic
  is_accepted: boolean
  created_at: string
}

export interface CreateQuestionDto {
  title: string
  content: string
  tags?: number[]
}

export interface GetQuestionsParams {
  tag_id?: number
  status?: 'open' | 'closed'
  sort?: 'latest' | 'hotests'
  page?: number
  limit?: number
}

// ============================================================
// 学习搭子
// ============================================================

export interface StudyTask {
  id: string
  title: string
  description?: string
  tags: Array<{ id: number; name: string }>
  target_count: number
  current_count: number
  creator: UserBasic
  status: 'open' | 'closed'
  created_at: string
}

export interface CreateStudyTaskDto {
  title: string
  description?: string
  tags?: number[]
  target_count: number
}

export interface GetStudyTasksParams {
  tag_id?: number
  status?: 'open' | 'closed'
  page?: number
  limit?: number
}

// ============================================================
// 社区治理
// ============================================================

export interface ReportDto {
  target_type: 'user' | 'post' | 'comment' | 'message'
  target_id: string
  reason: string
  description?: string
}

export interface CreditRecord {
  type: 'increase' | 'decrease'
  amount: number
  reason: string
  created_at: string
}

export interface CreditInfo {
  credit_score: number
  level: string
  records: CreditRecord[]
}

// ============================================================
// Redux State 相关
// ============================================================

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}
