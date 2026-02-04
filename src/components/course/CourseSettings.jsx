import { useState } from 'react'
import Modal from '../common/Modal'
import { updateCourse, archiveCourse } from '../../services/courses'

/**
 * CourseEditModal - Modal for editing course details
 */
export function CourseEditModal({ course, isOpen, onClose, onUpdate }) {
  const [name, setName] = useState(course?.name || '')
  const [description, setDescription] = useState(course?.description || '')
  const [weights, setWeights] = useState(course?.category_weights || {
    ku: 25,
    thinking: 25,
    application: 25,
    communication: 25
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    const { error } = await updateCourse(course.id, {
      name: name.trim(),
      description: description.trim() || null,
      category_weights: weights
    })

    if (error) {
      setError(error.message || 'Failed to update course')
    } else {
      onUpdate()
      onClose()
    }
    setLoading(false)
  }

  const handleWeightChange = (category, value) => {
    setWeights(prev => ({
      ...prev,
      [category]: parseInt(value) || 0
    }))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Course">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-error-50 border border-error-500 text-error-600 rounded-md text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="editCourseName" className="label">Course Name *</label>
          <input
            id="editCourseName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            required
          />
        </div>

        <div>
          <label htmlFor="editCourseDescription" className="label">Description</label>
          <textarea
            id="editCourseDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            rows={3}
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
            {loading ? 'Saving...' : 'Save Changes'}
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

/**
 * CourseArchiveModal - Modal for archiving a course
 */
export function CourseArchiveModal({ course, isOpen, onClose, onArchive, enrollmentCount = 0 }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleArchive = async () => {
    setLoading(true)
    setError('')

    const { error } = await archiveCourse(course.id)

    if (error) {
      setError(error.message || 'Failed to archive course')
    } else {
      onArchive()
      onClose()
    }
    setLoading(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Archive Course">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-error-50 border border-error-500 text-error-600 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-warning-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="font-medium text-warning-800">Archiving this course will:</h4>
              <ul className="mt-2 text-sm text-warning-700 list-disc list-inside space-y-1">
                <li>Hide the course from students</li>
                <li>Preserve all course data and grades</li>
                <li>Keep the course accessible to you for reference</li>
              </ul>
            </div>
          </div>
        </div>

        <p className="text-gray-600">
          Are you sure you want to archive "<strong>{course?.name}</strong>"?
          {enrollmentCount > 0 && (
            <span className="block mt-2 text-sm">
              This course has <strong>{enrollmentCount} enrolled student{enrollmentCount !== 1 ? 's' : ''}</strong>.
            </span>
          )}
        </p>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleArchive}
            disabled={loading}
            className="btn bg-warning-600 text-white hover:bg-warning-700 flex-1 disabled:opacity-50"
          >
            {loading ? 'Archiving...' : 'Archive Course'}
          </button>
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * CourseSettingsDropdown - Dropdown menu for course settings
 */
export function CourseSettingsDropdown({ course, onEdit, onArchive }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title="Course Settings"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              <button
                onClick={() => {
                  setIsOpen(false)
                  onEdit()
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Course
              </button>
              <button
                onClick={() => {
                  setIsOpen(false)
                  onArchive()
                }}
                className="w-full px-4 py-2 text-left text-sm text-warning-600 hover:bg-warning-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Archive Course
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
