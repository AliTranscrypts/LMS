import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getStudentEnrollments } from '../../services/enrollments'
import Layout from '../common/Layout'
import StudentIdCard from './StudentIdCard'
import EmptyState from '../common/EmptyState'

export default function StudentDashboard() {
  const { profile, user } = useAuth()
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchEnrollments()
  }, [user?.id])

  const fetchEnrollments = async () => {
    if (!user?.id) return
    
    setLoading(true)
    const { data, error } = await getStudentEnrollments(user.id)
    
    if (error) {
      setError('Failed to load your courses')
      console.error(error)
    } else {
      setEnrollments(data || [])
    }
    setLoading(false)
  }

  return (
    <Layout>
      <div className="page-container">
        {/* Welcome Section with Student ID */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {profile?.full_name}!
          </h1>
          <p className="text-gray-600">
            View your enrolled courses and track your progress
          </p>
        </div>

        {/* Student ID Card */}
        {profile?.student_id && (
          <StudentIdCard studentId={profile.student_id} />
        )}

        {/* Enrolled Courses Section */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">My Courses</h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-error-600">{error}</div>
          ) : enrollments.length === 0 ? (
            <EmptyState
              icon={
                <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              }
              title="You're not enrolled in any courses yet"
              description="Share your Student ID with your teacher to get enrolled in a course."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {enrollments.map((enrollment) => (
                <CourseCard key={enrollment.id} enrollment={enrollment} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

function CourseCard({ enrollment }) {
  const { course, calculated_grade } = enrollment
  const progress = calculated_grade?.final_grade

  return (
    <Link
      to={`/courses/${course.id}`}
      className="card p-5 hover:shadow-md transition-shadow"
    >
      <h3 className="font-semibold text-lg text-gray-900 mb-2">
        {course.name}
      </h3>
      
      {course.teacher?.full_name && (
        <p className="text-sm text-gray-600 mb-3">
          Taught by {course.teacher.full_name}
        </p>
      )}

      {course.description && (
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
          {course.description}
        </p>
      )}

      {/* Progress indicator */}
      <div className="mt-4">
        {progress !== undefined && progress !== null ? (
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Grade</span>
              <span className="font-medium text-gray-900">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-success-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            No grades yet
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center text-primary-600 text-sm font-medium">
        Continue Learning
        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}
