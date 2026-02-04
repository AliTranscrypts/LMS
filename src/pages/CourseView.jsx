import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getCourse } from '../services/courses'
import { getClassRoster, getEnrollmentCount } from '../services/enrollments'
import Layout from '../components/common/Layout'
import Tabs from '../components/common/Tabs'
import SyllabusTab from '../components/course/SyllabusTab'
import ModulesTab from '../components/course/ModulesTab'
import GradesTab from '../components/course/GradesTab'
import StudentsTab from '../components/course/StudentsTab'
import { CourseEditModal, CourseArchiveModal, CourseSettingsDropdown } from '../components/course/CourseSettings'

export default function CourseView() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { user, profile, isTeacher, isStudent } = useAuth()
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('modules') // Default to modules as per spec
  const [enrollmentCount, setEnrollmentCount] = useState(0)

  // Course settings modals
  const [showEditModal, setShowEditModal] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)

  useEffect(() => {
    fetchCourse()
  }, [courseId])

  const fetchCourse = async () => {
    setLoading(true)
    const { data, error } = await getCourse(courseId)
    
    if (error) {
      setError('Course not found or you do not have access')
      console.error(error)
    } else {
      setCourse(data)
      // Fetch enrollment count for archive warning
      const { count } = await getEnrollmentCount(courseId)
      setEnrollmentCount(count || 0)
    }
    setLoading(false)
  }

  const handleCourseArchived = () => {
    navigate('/dashboard')
  }

  // Teacher tabs
  const teacherTabs = [
    { id: 'syllabus', label: 'Syllabus' },
    { id: 'modules', label: 'Modules' },
    { id: 'grades', label: 'Grades' },
    { id: 'students', label: 'Students' },
  ]

  // Student tabs (no Students tab for managing, but they can see roster)
  const studentTabs = [
    { id: 'syllabus', label: 'Syllabus' },
    { id: 'modules', label: 'Modules' },
    { id: 'grades', label: 'Grades' },
    { id: 'roster', label: 'Class Roster' },
  ]

  const tabs = isTeacher ? teacherTabs : studentTabs

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    )
  }

  if (error || !course) {
    return (
      <Layout>
        <div className="page-container text-center py-16">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Course Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'This course does not exist or you do not have access.'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </Layout>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'syllabus':
        return <SyllabusTab course={course} isTeacher={isTeacher} onUpdate={fetchCourse} />
      case 'modules':
        return <ModulesTab course={course} isTeacher={isTeacher} onUpdate={fetchCourse} />
      case 'grades':
        return <GradesTab course={course} isTeacher={isTeacher} studentId={user?.id} />
      case 'students':
        return isTeacher ? <StudentsTab course={course} onUpdate={fetchCourse} /> : null
      case 'roster':
        return <ClassRosterView courseId={course.id} />
      default:
        return null
    }
  }

  return (
    <Layout>
      {/* Course Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{course.name}</h1>
                {course.description && (
                  <p className="text-sm text-gray-500 mt-1">{course.description}</p>
                )}
              </div>
            </div>

            {/* Course Settings (Teacher only) */}
            {isTeacher && (
              <CourseSettingsDropdown
                course={course}
                onEdit={() => setShowEditModal(true)}
                onArchive={() => setShowArchiveModal(true)}
              />
            )}
          </div>
          
          {/* Tabs */}
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderTabContent()}
      </div>

      {/* Course Edit Modal */}
      {isTeacher && (
        <>
          <CourseEditModal
            course={course}
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            onUpdate={fetchCourse}
          />

          <CourseArchiveModal
            course={course}
            isOpen={showArchiveModal}
            onClose={() => setShowArchiveModal(false)}
            onArchive={handleCourseArchived}
            enrollmentCount={enrollmentCount}
          />
        </>
      )}
    </Layout>
  )
}

// Class Roster View for Students
function ClassRosterView({ courseId }) {
  const [roster, setRoster] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchRoster()
  }, [courseId])

  const fetchRoster = async () => {
    setLoading(true)
    const { data, error } = await getClassRoster(courseId)
    
    if (error) {
      setError('Failed to load class roster')
      console.error(error)
    } else {
      setRoster(data || [])
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-12 text-error-600">{error}</div>
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Class Roster</h2>
      <p className="text-sm text-gray-600 mb-6">
        {roster.length} student{roster.length !== 1 ? 's' : ''} enrolled in this course
      </p>

      {roster.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No other students are enrolled in this course yet.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {roster.map((enrollment) => (
            <li key={enrollment.id} className="py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-700 font-medium text-sm">
                  {enrollment.student?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <span className="text-gray-900">{enrollment.student?.full_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
