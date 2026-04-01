import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import { authApi } from '@/api/auth'
import type { AuthState, LoginDto, RegisterDto, Session, User } from '@/types'

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const registerUser = createAsyncThunk(
  'auth/register',
  async (dto: RegisterDto, { rejectWithValue }) => {
    try {
      const res = await authApi.register(dto)
      return res.data
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
        '注册失败，请稍后重试'
      return rejectWithValue(msg)
    }
  }
)

export const loginUser = createAsyncThunk(
  'auth/login',
  async (dto: LoginDto, { rejectWithValue }) => {
    try {
      const res = await authApi.login(dto)
      const { session, user } = res.data
      localStorage.setItem('access_token', session.access_token)
      localStorage.setItem('refresh_token', session.refresh_token)
      localStorage.setItem('user', JSON.stringify(user))
      return { session, user }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
        '邮箱或密码错误'
      return rejectWithValue(msg)
    }
  }
)

export const logoutUser = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await authApi.logout()
  } catch {
    // ignore logout errors
  } finally {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadInitialState(): AuthState {
  const userStr = localStorage.getItem('user')
  const accessToken = localStorage.getItem('access_token')
  const refreshToken = localStorage.getItem('refresh_token')

  if (userStr && accessToken) {
    const user: User = JSON.parse(userStr)
    const session: Session = {
      access_token: accessToken,
      refresh_token: refreshToken ?? '',
      expires_at: 0,
    }
    return { user, session, loading: false, error: null }
  }
  return { user: null, session: null, loading: false, error: null }
}

// ─── Slice ───────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState: loadInitialState(),
  reducers: {
    clearError(state) {
      state.error = null
    },
    updateUser(state, action: PayloadAction<User>) {
      state.user = action.payload
      localStorage.setItem('user', JSON.stringify(action.payload))
    },
  },
  extraReducers: (builder) => {
    // Register
    builder.addCase(registerUser.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(registerUser.fulfilled, (state) => {
      state.loading = false
    })
    builder.addCase(registerUser.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // Login
    builder.addCase(loginUser.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(
      loginUser.fulfilled,
      (state, action: PayloadAction<{ session: Session; user: User }>) => {
        state.loading = false
        state.session = action.payload.session
        state.user = action.payload.user
      }
    )
    builder.addCase(loginUser.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // Logout
    builder.addCase(logoutUser.fulfilled, (state) => {
      state.user = null
      state.session = null
    })
  },
})

export const { clearError, updateUser } = authSlice.actions
export default authSlice.reducer
