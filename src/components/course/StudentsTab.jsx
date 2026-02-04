import { useState, useEffect } from 'react'
import { getCourseEnrollments, findStudentByStudentId, enrollStudent, unenrollStudent } from '../../services/enrollments'
import Modal from '../common/Modal'
import EmptyState from '../common/EmptyState'

export default function StudentsTab({ course, onUpdate }) {
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showEnrollModal, setShowEnrollModal] = useState(false)

  useEffect(() => {
    fetchEnrollments()
  }, [course.id])

  const fetchEnrollments = async () => {
    setLoading(true)
    const { data, error } = await getCourseEnrollments(course.id)
    
    if (error) {
      setError('Failed to load students')
      console.error(error)
    } else {
      setEnrollments(data || [])
    }
    setLoading(false)
  }

  const handleEnrollSuccess = () => {
    setShowEnrollModal(false)
    fetchEnrollments()
    if (onUpdate) onUpdate()
  }

  const handleUnenroll = async (enrollmentId, studentName) => {
    if (!confirm(`Remove ${studentName} from this course?`)) return
    
    const { error } = await unenrollStudent(enrollmentId)
    if (error) {
      alert('Failed to remove student')
      console.error(error)
    } else {
      fetchEnrollments()
      if (onUpdate) onUpdate()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Enrolled Students</h2>
        <button
          onClick={() => setShowEnrollModal(true)}
          className="btn btn-primary"
        >
          + Enroll Student
        </button>
      </div>

      {error ? (
        <div className="text-center py-12 text-error-600">{error}</div>
      ) : enrollments.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
          title="No students enrolled"
          description="Enroll students by entering their unique Student ID."
          action={
            <button
              onClick={() => setShowEnrollModal(true)}
              className="btn btn-primary"
            >
              + Enroll Student
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Enrolled Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grade
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {enrollments.map((enrollment) => (
                <tr key={enrollment.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-primary-700 font-medium text-sm">
                          {enrollment.student?.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {enrollment.student?.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {enrollment.student?.student_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(enrollment.enrolled_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {enrollment.calculated_grade?.final_grade !== undefined ? (
                      <span className="font-medium text-gray-900">
                        {enrollment.calculated_grade.final_grade}%
                      </span>
                    ) : (
                      <span className="text-gray-400">No grades</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => handleUnenroll(enrollment.id, enrollment.student?.full_name)}
                      className="text-error-600 hover:text-error-800"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Enroll Student Modal */}
      <EnrollStudentModal
        isOpen={showEnrollModal}
        onClose={() => setShowEnrollModal(false)}
        courseId={course.id}
        courseName={course.name}
        onSuccess={handleEnrollSuccess}
      />
    </div>
  )
}

function EnrollStudentModal({ isOpen, onClose, courseId, courseName, onSuccess }) {
  const [studentIdInput, setStudentIdInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [foundStudent, setFoundStudent] = useState(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleSearch = async (e) => {
    e.preventDefault()
    setError('')
    setFoundStudent(null)

    if (!studentIdInput.trim()) {
      setError('Please enter a student ID')
      return
    }

    setLoading(true)
    const { data, error } = await findStudentByStudentId(studentIdInput.trim())
    
    if (error || !data) {
      setError('Student ID not found. Please check the ID and try again. Ask the student if they have signed up or not.')
    } else {
      setFoundStudent(data)
      setShowConfirmation(true)
    }
    setLoading(false)
  }

  const handleEnroll = async () => {
    if (!foundStudent) return

    setLoading(true)
    const { data, error } = await enrollStudent(courseId, foundStudent.id)
    
    if (error) {
      if (error.code === '23505') {
        setError('This student is already enrolled in the course.')
      } else {
        setError(error.message || 'Failed to enroll student')
      }
      setShowConfirmation(false)
    } else {
      onSuccess()
      handleClose()
    }
    setLoading(false)
  }

  const handleClose = () => {
    setStudentIdInput('')
    setError('')
    setFoundStudent(null)
    setShowConfirmation(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Enroll Student">
      {showConfirmation && foundStudent ? (
        <div>
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-primary-700 font-bold text-2xl">
                {foundStudent.full_name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Enroll {foundStudent.full_name}?
            </h3>
            <p className="text-gray-600">
              Add this student to <span className="font-medium">{courseName}</span>?
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-error-50 border border-error-500 text-error-600 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleEnroll}
              disabled={loading}
              className="btn btn-primary flex-1 disabled:opacity-50"
            >
              {loading ? 'Enrolling...' : 'Confirm Enrollment'}
            </button>
            <button
              onClick={() => {
                setShowConfirmation(false)
                setFoundStudent(null)
                setError('')
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSearch}>
          <div className="mb-4">
            <label htmlFor="studentId" className="label">Student Unique ID</label>
            <input
              id="studentId"
              type="text"
              value={studentIdInput}
              onChange={(e) => setStudentIdInput(e.target.value)}
              className="input"
              placeholder="e.g., STU-12345678-abcd"
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500">
              Students can find their ID on their dashboard
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-error-50 border border-error-500 text-error-600 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Find Student'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
