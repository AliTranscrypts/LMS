import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useOffline } from '../../contexts/OfflineContext'
import { getStudentEnrollments } from '../../services/enrollments'
import { getStudentCourseProgress, getNextIncompleteContent } from '../../services/progress'
import { useSearch } from '../../hooks'
import Layout from '../common/Layout'
import StudentIdCard from './StudentIdCard'
import EmptyState from '../common/EmptyState'
import { CardSkeleton } from '../common/LoadingSpinner'

export default function StudentDashboard() {
  const { profile, user } = useAuth()
  const { isOnline, pendingCount } = useOffline()
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isFromCache, setIsFromCache] = useState(false)

  // Search functionality with debouncing
  const { 
    searchTerm, 
    setSearchTerm, 
    filteredItems: filteredEnrollments,
    isSearching 
  } = useSearch(enrollments, { 
    searchFields: ['course.name', 'course.description', 'course.teacher.full_name'],
    debounceMs: 300
  })

  useEffect(() => {
    fetchEnrollments()
  }, [user?.id])

  const fetchEnrollments = useCallback(async () => {
    if (!user?.id) return
    
    setLoading(true)
    setError(null)
    
    const result = await getStudentEnrollments(user.id)
    
    if (result.error) {
      setError(result.isFromCache ? 'Showing cached data - some courses may be outdated' : 'Failed to load your courses')
      console.error(result.error)
    }
    
    setEnrollments(result.data || [])
    setIsFromCache(result.isFromCache || false)
    setLoading(false)
  }, [user?.id])

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

        {/* Pending Submissions Notice */}
        {pendingCount > 0 && (
          <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-lg">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-primary-900">
                  {pendingCount} pending {pendingCount === 1 ? 'submission' : 'submissions'}
                </p>
                <p className="text-sm text-primary-700">
                  {isOnline 
                    ? 'Your submissions will sync automatically.'
                    : 'Your submissions will sync when you\'re back online.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Enrolled Courses Section */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">My Courses</h2>

          {/* Search bar (shown when there are enrollments) */}
          {!loading && enrollments.length > 0 && (
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search courses..."
                  className="input pl-10"
                />
                <svg 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cached data indicator */}
          {isFromCache && (
            <div className="mb-4 p-3 bg-warning-50 border border-warning-200 rounded-lg text-sm text-warning-700 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Showing cached data. Some information may be outdated.
            </div>
          )}

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : error && enrollments.length === 0 ? (
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
              {filteredEnrollments.map((enrollment) => (
                <CourseCard key={enrollment.id} enrollment={enrollment} userId={user?.id} />
              ))}
              {searchTerm && filteredEnrollments.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No courses found matching "{searchTerm}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

function CourseCard({ enrollment, userId }) {
  const navigate = useNavigate()
  const { course, calculated_grade } = enrollment
  const gradeProgress = calculated_grade?.final_grade
  const [contentProgress, setContentProgress] = useState(null)
  const [nextUp, setNextUp] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      // Fetch progress and next up in parallel
      const [progressResult, nextUpResult] = await Promise.all([
        getStudentCourseProgress(userId, course.id),
        getNextIncompleteContent(userId, course.id)
      ])
      
      if (progressResult.data) {
        setContentProgress(progressResult.data)
      }
      if (nextUpResult.data) {
        setNextUp(nextUpResult.data)
      }
    }
    if (userId) {
      fetchData()
    }
  }, [userId, course.id])

  const getContentIcon = (type) => {
    switch (type) {
      case 'reading': return '📄'
      case 'video': return '🎥'
      case 'text': return '📝'
      case 'assignment': return '✏️'
      case 'quiz': return '❓'
      default: return '📎'
    }
  }

  const handleContinueLearning = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (nextUp?.content?.id) {
      // Navigate directly to the next incomplete content
      navigate(`/content/${nextUp.content.id}`)
    } else {
      // If all complete or no next up, go to course page
      navigate(`/courses/${course.id}`)
    }
  }

  return (
    <Link
      to={`/courses/${course.id}`}
      className="card p-5 hover:shadow-md transition-shadow flex flex-col"
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

      {/* Content Progress indicator */}
      {contentProgress && contentProgress.totalContent > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium text-gray-900">
              {contentProgress.completedContent} of {contentProgress.totalContent} ({contentProgress.percentComplete}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all"
              style={{ width: `${contentProgress.percentComplete}%` }}
            ></div>
          </div>
          {/* Module completion summary */}
          {contentProgress.modules && (
            <div className="mt-2 flex flex-wrap gap-1">
              {contentProgress.modules.map((module) => (
                <span 
                  key={module.id}
                  className={`text-xs px-2 py-0.5 rounded ${
                    module.totalCount > 0 && module.completedCount === module.totalCount
                      ? 'bg-success-100 text-success-700'
                      : module.completedCount > 0
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                  title={`${module.name}: ${module.completedCount}/${module.totalCount}`}
                >
                  {module.totalCount > 0 && module.completedCount === module.totalCount ? '✓' : `${module.completedCount}/${module.totalCount}`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grade Progress indicator */}
      <div className="mb-3">
        {gradeProgress !== undefined && gradeProgress !== null ? (
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Grade</span>
              <span className="font-medium text-gray-900">{gradeProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-success-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(gradeProgress, 100)}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            No grades yet
          </div>
        )}
      </div>

      {/* Next Up indicator */}
      {nextUp && !nextUp.allComplete && nextUp.content && (
        <div className="mb-3 p-2 bg-primary-50 rounded-lg border border-primary-100">
          <p className="text-xs text-primary-600 font-medium mb-1">Next Up</p>
          <p className="text-sm text-gray-900 flex items-center gap-1">
            <span>{getContentIcon(nextUp.content.type)}</span>
            <span className="truncate">{nextUp.content.name}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{nextUp.module?.name}</p>
        </div>
      )}

      {/* All Complete indicator */}
      {nextUp?.allComplete && (
        <div className="mb-3 p-2 bg-success-50 rounded-lg border border-success-100">
          <p className="text-sm text-success-700 font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Course Complete!
          </p>
        </div>
      )}

      {/* Continue Learning Button - grows to fill space */}
      <div className="mt-auto pt-2">
        <button
          onClick={handleContinueLearning}
          className="w-full py-2 px-4 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
        >
          {nextUp?.allComplete ? 'Review Course' : 'Continue Learning'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </Link>
  )
}
