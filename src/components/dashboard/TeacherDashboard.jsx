import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getTeacherCourses, createCourse } from '../../services/courses'
import { useOffline } from '../../contexts/OfflineContext'
import { useSearch } from '../../hooks'
import Layout from '../common/Layout'
import EmptyState from '../common/EmptyState'
import Modal from '../common/Modal'
import QuillEditor from '../common/QuillEditor'
import { CardSkeleton } from '../common/LoadingSpinner'

export default function TeacherDashboard() {
  const { profile, user } = useAuth()
  const { isOnline } = useOffline()
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isFromCache, setIsFromCache] = useState(false)

  // Search functionality with debouncing
  const { 
    searchTerm, 
    setSearchTerm, 
    filteredItems: filteredCourses,
    isSearching 
  } = useSearch(courses, { 
    searchFields: ['name', 'description'],
    debounceMs: 300
  })

  useEffect(() => {
    fetchCourses()
  }, [user?.id])

  const fetchCourses = useCallback(async () => {
    if (!user?.id) return
    
    setLoading(true)
    setError(null)
    
    const result = await getTeacherCourses(user.id)
    
    if (result.error) {
      setError(result.isFromCache ? 'Showing cached data - some courses may be outdated' : 'Failed to load courses')
      console.error(result.error)
    }
    
    setCourses(result.data || [])
    setIsFromCache(result.isFromCache || false)
    setLoading(false)
  }, [user?.id])

  const handleCreateCourse = async (courseData) => {
    const { data, error } = await createCourse(user.id, courseData)
    
    if (error) {
      return { error: error.message || 'Failed to create course' }
    }
    
    setShowCreateModal(false)
    // Navigate to the modules tab of the new course (as per spec)
    navigate(`/courses/${data.id}`)
    return { error: null }
  }

  return (
    <Layout>
      <div className="page-container">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome, {profile?.full_name}!
            </h1>
            <p className="text-gray-600">
              Manage your courses and students
            </p>
          </div>
        </div>

        {/* Courses Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">My Courses</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
              disabled={!isOnline}
              title={!isOnline ? 'Cannot create courses while offline' : ''}
            >
              + Create Course
            </button>
          </div>

          {/* Search bar (shown when there are courses) */}
          {!loading && courses.length > 0 && (
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
              {searchTerm && (
                <p className="mt-2 text-sm text-gray-600">
                  {filteredCourses.length} {filteredCourses.length === 1 ? 'course' : 'courses'} found
                </p>
              )}
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
              <CardSkeleton />
            </div>
          ) : error && courses.length === 0 ? (
            <div className="text-center py-12 text-error-600">{error}</div>
          ) : courses.length === 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Create Course Card */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="card p-6 border-2 border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50 transition-colors text-center"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Create Course</h3>
                <p className="text-sm text-gray-500">Add your first course to get started</p>
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Create Course Card */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="card p-6 border-2 border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50 transition-colors text-center"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Create Course</h3>
                <p className="text-sm text-gray-500">Add a new course</p>
              </button>

              {filteredCourses.map((course) => (
                <TeacherCourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>

        {/* Create Course Modal */}
        <CreateCourseModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateCourse}
        />
      </div>
    </Layout>
  )
}

function TeacherCourseCard({ course }) {
  const enrollmentCount = course.enrollments?.[0]?.count || 0
  const moduleCount = course.modules?.[0]?.count || 0

  return (
    <Link
      to={`/courses/${course.id}`}
      className="card p-5 hover:shadow-md transition-shadow"
    >
      <h3 className="font-semibold text-lg text-gray-900 mb-2">
        {course.name}
      </h3>

      {course.description && (
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
          {course.description}
        </p>
      )}

      <div className="flex gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          {enrollmentCount} students
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          {moduleCount} modules
        </div>
      </div>

      <div className="mt-4 flex items-center text-primary-600 text-sm font-medium">
        Manage Course
        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

function CreateCourseModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [syllabus, setSyllabus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSyllabusEditor, setShowSyllabusEditor] = useState(false)
  
  const [weights, setWeights] = useState({
    ku: 25,
    thinking: 25,
    application: 25,
    communication: 25
  })

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
  const isValidWeight = totalWeight === 100

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setName('')
      setDescription('')
      setSyllabus(null)
      setError('')
      setShowSyllabusEditor(false)
      setWeights({
        ku: 25,
        thinking: 25,
        application: 25,
        communication: 25
      })
    }
  }, [isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter a course name')
      return
    }

    if (!isValidWeight) {
      setError('Category weights must sum to 100%')
      return
    }

    setLoading(true)
    const result = await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      syllabus,
      categoryWeights: weights
    })

    if (result?.error) {
      setError(result.error)
    }
    setLoading(false)
  }

  const handleWeightChange = (category, value) => {
    setWeights(prev => ({
      ...prev,
      [category]: parseInt(value) || 0
    }))
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Course" size="large">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-error-50 border border-error-500 text-error-600 rounded-md text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="courseName" className="label">Course Name *</label>
          <input
            id="courseName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="e.g., Grade 10 Mathematics"
            required
          />
        </div>

        <div>
          <label htmlFor="courseDescription" className="label">Description</label>
          <textarea
            id="courseDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            rows={3}
            placeholder="Brief description of the course..."
          />
        </div>

        {/* Syllabus Section */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="label mb-0">Course Syllabus</label>
            {!showSyllabusEditor && (
              <button
                type="button"
                onClick={() => setShowSyllabusEditor(true)}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                + Add Syllabus
              </button>
            )}
          </div>
          
          {showSyllabusEditor ? (
            <div>
              <QuillEditor
                value={syllabus}
                onChange={setSyllabus}
                placeholder="Write your course syllabus here. You can add it later if you prefer."
              />
              <button
                type="button"
                onClick={() => {
                  setShowSyllabusEditor(false)
                  setSyllabus(null)
                }}
                className="mt-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Remove syllabus
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              You can add a detailed syllabus with rich formatting, images, and videos. 
              This can also be added later from the course page.
            </p>
          )}
        </div>

        <div>
          <label className="label">Grading Category Weights (must total 100%)</label>
          <p className="text-xs text-gray-500 mb-2">
            These are the Ontario curriculum assessment categories used for grading.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {[
              { key: 'ku', label: 'Knowledge & Understanding' },
              { key: 'thinking', label: 'Thinking' },
              { key: 'application', label: 'Application' },
              { key: 'communication', label: 'Communication' }
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <label className="text-sm text-gray-700 flex-1">{label}:</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={weights[key]}
                  onChange={(e) => handleWeightChange(key, e.target.value)}
                  className="input w-20 text-center"
                />
                <span className="text-gray-500">%</span>
              </div>
            ))}
          </div>
          <div className={`mt-2 text-sm ${isValidWeight ? 'text-success-600' : 'text-error-600'}`}>
            Total: {totalWeight}% {isValidWeight ? '✓' : '(must equal 100%)'}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading || !isValidWeight}
            className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Course'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
