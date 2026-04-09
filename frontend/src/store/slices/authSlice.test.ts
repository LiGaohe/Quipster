import { describe, it, expect, beforeEach } from 'vitest'
import authReducer, { clearError, updateUser } from '@/store/slices/authSlice'
import type { AuthState, User } from '@/types'

describe('authSlice', () => {
  let initialState: AuthState

  beforeEach(() => {
    initialState = {
      user: null,
      session: null,
      loading: false,
      error: null,
    }
  })

  describe('clearError', () => {
    it('clears error message', () => {
      const stateWithError: AuthState = { ...initialState, error: '登录失败' }
      const newState = authReducer(stateWithError, clearError())
      expect(newState.error).toBeNull()
    })
  })

  describe('updateUser', () => {
    it('updates user data', () => {
      const mockUser: User = {
        id: '1',
        email: 'test@tongji.edu.cn',
        nickname: '测试用户',
        credit_score: 100,
        visibility: 1,
        created_at: '2026-01-01T00:00:00Z',
      }

      const stateWithUser: AuthState = { ...initialState, user: mockUser }
      const updatedUser = { ...mockUser, nickname: '新昵称' }
      const newState = authReducer(stateWithUser, updateUser(updatedUser))

      expect(newState.user?.nickname).toBe('新昵称')
    })
  })

  describe('initial state', () => {
    it('returns initial state when given undefined state', () => {
      const result = authReducer(undefined, { type: 'unknown' })
      expect(result).toEqual({
        user: null,
        session: null,
        loading: false,
        error: null,
      })
    })
  })
})
