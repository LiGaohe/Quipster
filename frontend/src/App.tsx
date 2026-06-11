import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAppSelector } from '@/store/hooks'

import Layout from '@/components/layout/Layout'
import AuthLayout from '@/components/layout/AuthLayout'
import LoadingSpinner from '@/components/common/LoadingSpinner'

// 路由懒加载 - 按需加载页面组件
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const TagSelectPage = lazy(() => import('@/pages/auth/TagSelectPage'))

const FeedPage = lazy(() => import('@/pages/feed/FeedPage'))
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'))
const EditProfilePage = lazy(() => import('@/pages/profile/EditProfilePage'))
const MatchPage = lazy(() => import('@/pages/match/MatchPage'))
const ChatListPage = lazy(() => import('@/pages/chat/ChatListPage'))
const ChatRoomPage = lazy(() => import('@/pages/chat/ChatRoomPage'))
const GroupsPage = lazy(() => import('@/pages/groups/GroupsPage'))
const GroupDetailPage = lazy(() => import('@/pages/groups/GroupDetailPage'))
const EventsPage = lazy(() => import('@/pages/events/EventsPage'))
const EventDetailPage = lazy(() => import('@/pages/events/EventDetailPage'))
const AnonymousPage = lazy(() => import('@/pages/anonymous/AnonymousPage'))
const AnonymousDetailPage = lazy(() => import('@/pages/anonymous/AnonymousDetailPage'))
const QuestionsPage = lazy(() => import('@/pages/questions/QuestionsPage'))
const QuestionDetailPage = lazy(() => import('@/pages/questions/QuestionDetailPage'))
const StudyPage = lazy(() => import('@/pages/study/StudyPage'))
const CreditPage = lazy(() => import('@/pages/governance/CreditPage'))
const AdminReviewPage = lazy(() => import('@/pages/admin/AdminReviewPage'))
const SearchPage = lazy(() => import('@/pages/search/SearchPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

// 懒加载包装器
function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
}

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
              <LazyPage>
                <LoginPage />
              </LazyPage>
            </GuestOnly>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnly>
              <LazyPage>
                <RegisterPage />
              </LazyPage>
            </GuestOnly>
          }
        />
        <Route
          path="/tags"
          element={
            <RequireAuth>
              <LazyPage>
                <TagSelectPage />
              </LazyPage>
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
        <Route index element={<LazyPage><FeedPage /></LazyPage>} />
        <Route path="/match" element={<LazyPage><MatchPage /></LazyPage>} />
        <Route path="/chat" element={<LazyPage><ChatListPage /></LazyPage>} />
        <Route path="/chat/:conversationId" element={<LazyPage><ChatRoomPage /></LazyPage>} />
        <Route path="/groups" element={<LazyPage><GroupsPage /></LazyPage>} />
        <Route path="/groups/:groupId" element={<LazyPage><GroupDetailPage /></LazyPage>} />
        <Route path="/events" element={<LazyPage><EventsPage /></LazyPage>} />
        <Route path="/events/:eventId" element={<LazyPage><EventDetailPage /></LazyPage>} />
        <Route path="/anonymous" element={<LazyPage><AnonymousPage /></LazyPage>} />
        <Route path="/anonymous/:postId" element={<LazyPage><AnonymousDetailPage /></LazyPage>} />
        <Route path="/questions" element={<LazyPage><QuestionsPage /></LazyPage>} />
        <Route path="/questions/:questionId" element={<LazyPage><QuestionDetailPage /></LazyPage>} />
        <Route path="/study" element={<LazyPage><StudyPage /></LazyPage>} />
        <Route path="/credit" element={<LazyPage><CreditPage /></LazyPage>} />
        <Route path="/admin/reports" element={<LazyPage><AdminReviewPage /></LazyPage>} />
        <Route path="/search" element={<LazyPage><SearchPage /></LazyPage>} />
        <Route path="/profile" element={<LazyPage><ProfilePage /></LazyPage>} />
        <Route path="/profile/edit" element={<LazyPage><EditProfilePage /></LazyPage>} />
        <Route path="/profile/:userId" element={<LazyPage><ProfilePage /></LazyPage>} />
      </Route>

      <Route path="*" element={<LazyPage><NotFoundPage /></LazyPage>} />
    </Routes>
  )
}
