import { Routes, Route, Navigate } from 'react-router-dom'
import { useAppSelector } from '@/store/hooks'

import Layout from '@/components/layout/Layout'
import AuthLayout from '@/components/layout/AuthLayout'

import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import TagSelectPage from '@/pages/auth/TagSelectPage'

import FeedPage from '@/pages/feed/FeedPage'
import ProfilePage from '@/pages/profile/ProfilePage'
import EditProfilePage from '@/pages/profile/EditProfilePage'
import MatchPage from '@/pages/match/MatchPage'
import ChatListPage from '@/pages/chat/ChatListPage'
import ChatRoomPage from '@/pages/chat/ChatRoomPage'
import GroupsPage from '@/pages/groups/GroupsPage'
import GroupDetailPage from '@/pages/groups/GroupDetailPage'
import EventsPage from '@/pages/events/EventsPage'
import EventDetailPage from '@/pages/events/EventDetailPage'
import AnonymousPage from '@/pages/anonymous/AnonymousPage'
import AnonymousDetailPage from '@/pages/anonymous/AnonymousDetailPage'
import QuestionsPage from '@/pages/questions/QuestionsPage'
import QuestionDetailPage from '@/pages/questions/QuestionDetailPage'
import StudyPage from '@/pages/study/StudyPage'
import CreditPage from '@/pages/governance/CreditPage'
import SearchPage from '@/pages/search/SearchPage'
import NotFoundPage from '@/pages/NotFoundPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAppSelector((s) => s.auth.user)
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const user = useAppSelector((s) => s.auth.user)
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnly>
              <RegisterPage />
            </GuestOnly>
          }
        />
        <Route
          path="/tags"
          element={
            <RequireAuth>
              <TagSelectPage />
            </RequireAuth>
          }
        />
      </Route>

      {/* App routes */}
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<FeedPage />} />
        <Route path="/match" element={<MatchPage />} />
        <Route path="/chat" element={<ChatListPage />} />
        <Route path="/chat/:conversationId" element={<ChatRoomPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/:groupId" element={<GroupDetailPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
        <Route path="/anonymous" element={<AnonymousPage />} />
        <Route path="/anonymous/:postId" element={<AnonymousDetailPage />} />
        <Route path="/questions" element={<QuestionsPage />} />
        <Route path="/questions/:questionId" element={<QuestionDetailPage />} />
        <Route path="/study" element={<StudyPage />} />
        <Route path="/credit" element={<CreditPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<EditProfilePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
