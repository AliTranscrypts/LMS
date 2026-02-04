import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/common/Layout'
import StudentIdCard from '../components/dashboard/StudentIdCard'

export default function Profile() {
  const { profile, user } = useAuth()

  return (
    <Layout>
      <div className="page-container">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>

        <div className="max-w-2xl">
          {/* Profile Card */}
          <div className="card p-6 mb-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-700 font-bold text-3xl">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{profile?.full_name}</h2>
                <p className="text-gray-600 capitalize">{profile?.role}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">Email</label>
                <p className="text-gray-900">{user?.email}</p>
              </div>

              <div>
                <label className="text-sm text-gray-600">Account Created</label>
                <p className="text-gray-900">
                  {new Date(profile?.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Student ID Card (only for students) */}
          {profile?.role === 'student' && profile?.student_id && (
            <StudentIdCard studentId={profile.student_id} />
          )}
        </div>
      </div>
    </Layout>
  )
}
