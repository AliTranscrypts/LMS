import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { OfflineProvider } from './contexts/OfflineContext'
import ErrorBoundary from './components/common/ErrorBoundary'
import { PageLoader } from './components/common/LoadingSpinner'
import OfflineIndicator from './components/common/OfflineIndicator'

// Lazy load auth pages
const Login = lazy(() => import('./components/auth/Login'))
const SignUp = lazy(() => import('./components/auth/SignUp'))
const RegistrationSuccess = lazy(() => import('./components/auth/RegistrationSuccess'))

// Lazy load auth guard
const AuthGuard = lazy(() => import('./components/auth/AuthGuard'))

// Lazy load main pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CourseView = lazy(() => import('./pages/CourseView'))
const ContentViewer = lazy(() => import('./pages/ContentViewer'))
const Profile = lazy(() => import('./pages/Profile'))

// Loading fallback component
function SuspenseFallback() {
  return <PageLoader message="Loading..." />
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return <PageLoader message="Authenticating..." />
  }

  return (
    <Suspense fallback={<SuspenseFallback />}>
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" replace /> : <Login />} 
        />
        <Route 
          path="/signup" 
          element={user ? <Navigate to="/dashboard" replace /> : <SignUp />} 
        />
        <Route 
          path="/registration-success" 
          element={<RegistrationSuccess />} 
        />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          }
        />
        <Route
          path="/courses/:courseId"
          element={
            <AuthGuard>
              <CourseView />
            </AuthGuard>
          }
        />
        <Route
          path="/content/:contentId"
          element={
            <AuthGuard>
              <ContentViewer />
            </AuthGuard>
          }
        />
        <Route
          path="/profile"
          element={
            <AuthGuard>
              <Profile />
            </AuthGuard>
          }
        />

        {/* Default redirect */}
        <Route 
          path="/" 
          element={<Navigate to={user ? "/dashboard" : "/login"} replace />} 
        />

        {/* 404 */}
        <Route 
          path="*" 
          element={<Navigate to="/" replace />} 
        />
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <OfflineProvider>
            <AppRoutes />
            <OfflineIndicator />
          </OfflineProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  )
}

export default App
