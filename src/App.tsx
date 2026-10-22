import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Shell } from '@/components/Shell'
import { Spinner } from '@/components/widgets'
import Auth from '@/pages/Auth'
import Landing from '@/pages/Landing'
import { EventDetail, Events, Home, Results, TeamDetail } from '@/pages/Participant'
import Invest from '@/pages/Invest'
import { Leaderboard, Profile, Wallet } from '@/pages/Wallet'
import { AdminEvent, AdminEvents, AdminLayout, AdminLedger, AdminUsers } from '@/pages/admin/Admin'
import { useApp } from '@/state/AppProvider'

const Display = lazy(() => import('@/pages/Display'))
const Demo = lazy(() => import('@/pages/Demo'))

function RequireAuth() {
  const { session, loading } = useApp()
  if (session === undefined || (loading && !session)) return <Spinner />
  if (!session) return <Navigate to="/auth" replace />
  return <Outlet />
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/demo" element={<Demo />} />
        <Route element={<RequireAuth />}>
          <Route path="/app" element={<Shell />}>
            <Route index element={<Home />} />
            <Route path="events" element={<Events />} />
            <Route path="events/:eventId" element={<EventDetail />} />
            <Route path="events/:eventId/teams/:teamId" element={<TeamDetail />} />
            <Route path="events/:eventId/invest" element={<Invest />} />
            <Route path="events/:eventId/results" element={<Results />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="/display/:eventId" element={<Display />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminEvents />} />
            <Route path="events/:eventId" element={<AdminEvent />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="ledger" element={<AdminLedger />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
