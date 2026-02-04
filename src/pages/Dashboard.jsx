import { useAuth } from '../contexts/AuthContext'
import TeacherDashboard from '../components/dashboard/TeacherDashboard'
import StudentDashboard from '../components/dashboard/StudentDashboard'

export default function Dashboard() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (profile?.role === 'teacher') {
    return <TeacherDashboard />
  }

  return <StudentDashboard />
}
