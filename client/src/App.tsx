import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import { AdminRoute, AuthRoute, PosterRoute } from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import JobDetailPage from './pages/JobDetailPage'
import PostJobPage from './pages/PostJobPage'
import AboutPage from './pages/AboutPage'
import ResourcesPage from './pages/ResourcesPage'
import MyApplicationsPage from './pages/MyApplicationsPage'
import AccountPage from './pages/AccountPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import DashboardPage from './pages/DashboardPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import BillingSuccessPage from './pages/BillingSuccessPage'
import BillingCancelPage from './pages/BillingCancelPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import IntelligencePage from './pages/IntelligencePage'
import EmployerProfilePage from './pages/EmployerProfilePage'
import LaborGraphPage from './pages/LaborGraphPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/dashboard/seeker" element={<Navigate to="/dashboard?tab=seeking" replace />} />
          <Route path="/dashboard/poster" element={<Navigate to="/dashboard?tab=posting" replace />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route
              path="/post-job"
              element={
                <PosterRoute>
                  <PostJobPage />
                </PosterRoute>
              }
            />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/intelligence" element={<IntelligencePage />} />
            <Route path="/labor-graph" element={<LaborGraphPage />} />
            <Route path="/employers/:slug" element={<EmployerProfilePage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/dashboard"
              element={
                <AuthRoute>
                  <DashboardPage />
                </AuthRoute>
              }
            />
            <Route
              path="/my-applications"
              element={
                <AuthRoute>
                  <MyApplicationsPage />
                </AuthRoute>
              }
            />
            <Route
              path="/account"
              element={
                <AuthRoute>
                  <AccountPage />
                </AuthRoute>
              }
            />
            <Route
              path="/billing/success"
              element={
                <AuthRoute>
                  <BillingSuccessPage />
                </AuthRoute>
              }
            />
            <Route
              path="/billing/cancel"
              element={
                <AuthRoute>
                  <BillingCancelPage />
                </AuthRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboardPage />
                </AdminRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
