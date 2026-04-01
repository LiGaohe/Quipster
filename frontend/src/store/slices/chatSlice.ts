import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import { chatApi } from '@/api/chat'
import type { Conversation, Message, SendMessageDto } from '@/types'

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Record<string, Message[]>
  loadingConversations: boolean
  loadingMessages: boolean
  error: string | null
}

const initialState: ChatState = {
  conversations: [],
  activeConversationId: null,
  messages: {},
  loadingConversations: false,
  loadingMessages: false,
  error: null,
}

export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async (_, { rejectWithValue }) => {
    try {
      const res = await chatApi.getConversations()
      return res.data.data ?? []
    } catch {
      return rejectWithValue('获取会话列表失败')
    }
  }
)

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async (
    { conversationId, page }: { conversationId: string; page?: number },
    { rejectWithValue }
  ) => {
    try {
      const res = await chatApi.getMessages(conversationId, { page })
      return { conversationId, messages: res.data.data ?? [] }
    } catch {
      return rejectWithValue('获取聊天记录失败')
    }
  }
)

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (dto: SendMessageDto, { rejectWithValue }) => {
    try {
      const res = await chatApi.sendMessage(dto)
      return res.data.data
    } catch {
      return rejectWithValue('发送失败')
    }
  }
)

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveConversation(state, action: PayloadAction<string>) {
      state.activeConversationId = action.payload
    },
    receiveMessage(
      state,
      action: PayloadAction<{ conversationId: string; message: Message }>
    ) {
      const { conversationId, message } = action.payload
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = []
      }
      state.messages[conversationId].push(message)

      // Update last message in conversation list
      const conv = state.conversations.find((c) => c.conversation_id === conversationId)
      if (conv) {
        conv.last_message = { content: message.content, created_at: message.created_at }
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchConversations.pending, (state) => {
      state.loadingConversations = true
    })
    builder.addCase(fetchConversations.fulfilled, (state, action) => {
      state.loadingConversations = false
      state.conversations = action.payload
    })
    builder.addCase(fetchConversations.rejected, (state, action) => {
      state.loadingConversations = false
      state.error = action.payload as string
    })

    builder.addCase(fetchMessages.pending, (state) => {
      state.loadingMessages = true
    })
    builder.addCase(fetchMessages.fulfilled, (state, action) => {
      state.loadingMessages = false
      const { conversationId, messages } = action.payload
      state.messages[conversationId] = messages
    })
    builder.addCase(fetchMessages.rejected, (state, action) => {
      state.loadingMessages = false
      state.error = action.payload as string
    })

    builder.addCase(sendMessage.fulfilled, (state, action) => {
      if (action.payload) {
        // Find conversationId from active conversation
        const convId = state.activeConversationId
        if (convId) {
          if (!state.messages[convId]) state.messages[convId] = []
          state.messages[convId].push(action.payload)
        }
      }
    })
  },
})

export const { setActiveConversation, receiveMessage } = chatSlice.actions
export default chatSlice.reducer
