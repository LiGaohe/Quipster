import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import { postsApi } from '@/api/posts'
import type { Post, Comment, GetPostsParams } from '@/types'

interface PostsState {
  items: Post[]
  loading: boolean
  error: string | null
  page: number
  hasMore: boolean
  totalPages: number
}

const initialState: PostsState = {
  items: [],
  loading: false,
  error: null,
  page: 1,
  hasMore: true,
  totalPages: 1,
}

export const fetchPosts = createAsyncThunk(
  'posts/fetch',
  async (params: GetPostsParams & { replace?: boolean }, { rejectWithValue }) => {
    try {
      const res = await postsApi.getPosts(params)
      return { data: res.data.data ?? [], pagination: res.data.pagination, replace: params.replace }
    } catch {
      return rejectWithValue('获取动态失败')
    }
  }
)

export const createPost = createAsyncThunk(
  'posts/create',
  async (dto: { content: string; images?: string[] }, { rejectWithValue }) => {
    try {
      const res = await postsApi.createPost(dto)
      return res.data.data
    } catch {
      return rejectWithValue('发布动态失败')
    }
  }
)

export const toggleLike = createAsyncThunk(
  'posts/like',
  async (postId: string, { rejectWithValue }) => {
    try {
      const res = await postsApi.likePost(postId)
      return { postId, is_liked: res.data.is_liked, like_count: res.data.like_count }
    } catch {
      return rejectWithValue('操作失败')
    }
  }
)

export const addComment = createAsyncThunk(
  'posts/comment',
  async ({ postId, content }: { postId: string; content: string }, { rejectWithValue }) => {
    try {
      const res = await postsApi.commentPost(postId, content)
      return { postId, comment: res.data.data }
    } catch {
      return rejectWithValue('评论失败')
    }
  }
)

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    resetPosts(state) {
      state.items = []
      state.page = 1
      state.hasMore = true
      state.totalPages = 1
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchPosts.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchPosts.fulfilled, (state, action) => {
      state.loading = false
      const { data, pagination, replace } = action.payload
      if (replace) {
        state.items = data ?? []
        state.page = 1
      } else {
        state.items = [...state.items, ...(data ?? [])]
      }
      if (pagination) {
        state.totalPages = pagination.pages
        state.hasMore = state.page < pagination.pages
      } else {
        state.hasMore = false
      }
      state.page += 1
    })
    builder.addCase(fetchPosts.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
      state.hasMore = false
    })

    builder.addCase(createPost.fulfilled, (state, action) => {
      if (action.payload) {
        state.items.unshift(action.payload)
      }
    })

    builder.addCase(toggleLike.fulfilled, (state, action) => {
      const post = state.items.find((p) => p.id === action.payload.postId)
      if (post) {
        post.is_liked = action.payload.is_liked
        post.like_count = action.payload.like_count
      }
    })

    builder.addCase(addComment.fulfilled, (state, action) => {
      const post = state.items.find((p) => p.id === action.payload.postId)
      if (post) {
        post.comment_count += 1
      }
    })
  },
})

export const { resetPosts } = postsSlice.actions
export default postsSlice.reducer
