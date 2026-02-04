import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getTeacherCourses, createCourse } from '../../services/courses'
import Layout from '../common/Layout'
import EmptyState from '../common/EmptyState'
import Modal from '../common/Modal'

export default function TeacherDashboard() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    fetchCourses()
  }, [user?.id])

  const fetchCourses = async () => {
    if (!user?.id) return
    
    setLoading(true)
    const { data, error } = await getTeacherCourses(user.id)
    
    if (error) {
      setError('Failed to load courses')
      console.error(error)
    } else {
      setCourses(data || [])
    }
    setLoading(false)
  }

  const handleCreateCourse = async (courseData) => {
    const { data, error } = await createCourse(user.id, courseData)
    
    if (error) {
      return { error: error.message || 'Failed to create course' }
    }
    
    setShowCreateModal(false)
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
            >
              + Create Course
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
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

              {courses.map((course) => (
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [weights, setWeights] = useState({
    ku: 25,
    thinking: 25,
    application: 25,
    communication: 25
  })

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
  const isValidWeight = totalWeight === 100

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
      name,
      description,
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
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Course">
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

        <div>
          <label className="label">Grading Category Weights (must total 100%)</label>
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
