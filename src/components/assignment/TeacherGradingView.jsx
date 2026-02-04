import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  getSubmittedStudents,
  getStudentSubmissions,
  getAssignmentGrades,
  getCourseEnrolledStudents,
  saveGrade
} from '../../services/assignments'
import Modal from '../common/Modal'
import GradingForm from './GradingForm'

/**
 * TeacherGradingView - Teacher view for grading an assignment
 * Shows all enrolled students, their submissions, and allows grading
 */
export default function TeacherGradingView({ assignment, courseId, onClose }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [enrolledStudents, setEnrolledStudents] = useState([])
  const [submissions, setSubmissions] = useState({})
  const [grades, setGrades] = useState({})
  const [error, setError] = useState(null)
  
  // Grading modal state
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showGradingModal, setShowGradingModal] = useState(false)
  const [studentSubmissions, setStudentSubmissions] = useState([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)

  useEffect(() => {
    fetchData()
  }, [assignment.id, courseId])

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch enrolled students
      const { data: students, error: studentsError } = await getCourseEnrolledStudents(courseId)
      if (studentsError) throw studentsError
      setEnrolledStudents(students || [])

      // Fetch students who submitted
      const { data: submitted, error: submittedError } = await getSubmittedStudents(assignment.id)
      if (submittedError) throw submittedError
      
      // Create a map of student_id -> submission data
      const submissionsMap = {}
      submitted?.forEach(s => {
        submissionsMap[s.student_id] = s
      })
      setSubmissions(submissionsMap)

      // Fetch existing grades
      const { data: gradesData, error: gradesError } = await getAssignmentGrades(assignment.id)
      if (gradesError) throw gradesError
      
      // Create a map of student_id -> grade
      const gradesMap = {}
      gradesData?.forEach(g => {
        gradesMap[g.student_id] = g
      })
      setGrades(gradesMap)

    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenGrading = async (student) => {
    setSelectedStudent(student)
    setLoadingSubmissions(true)
    setShowGradingModal(true)

    // Fetch all submissions for this student
    const { data, error } = await getStudentSubmissions(assignment.id, student.student_id)
    if (error) {
      console.error('Error fetching submissions:', error)
    }
    setStudentSubmissions(data || [])
    setLoadingSubmissions(false)
  }

  const handleGradeSaved = (studentId, gradeData) => {
    setGrades(prev => ({
      ...prev,
      [studentId]: gradeData
    }))
    setShowGradingModal(false)
    setSelectedStudent(null)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Calculate submission stats
  const submittedCount = Object.keys(submissions).length
  const gradedCount = Object.keys(grades).length
  const totalStudents = enrolledStudents.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-error-600">
        {error}
        <button onClick={fetchData} className="btn btn-secondary mt-4">
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Assignment Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{assignment.name}</h2>
          {assignment.due_date && (
            <p className="text-gray-500 mt-1">
              Due: {formatDate(assignment.due_date)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            assignment.evaluation_type === 'of' 
              ? 'bg-success-100 text-success-700' 
              : 'bg-gray-100 text-gray-700'
          }`}>
            {assignment.evaluation_type === 'of' ? 'OF Learning' : 
             assignment.evaluation_type === 'for' ? 'FOR Learning' : 'AS Learning'}
          </span>
          <span className="text-gray-500">
            {assignment.total_points} points
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-primary-600">{submittedCount}</div>
          <div className="text-sm text-gray-500">Submitted</div>
          <div className="text-xs text-gray-400">of {totalStudents} students</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-success-600">{gradedCount}</div>
          <div className="text-sm text-gray-500">Graded</div>
          <div className="text-xs text-gray-400">of {submittedCount} submissions</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-gray-600">
            {totalStudents - submittedCount}
          </div>
          <div className="text-sm text-gray-500">Missing</div>
          <div className="text-xs text-gray-400">not submitted</div>
        </div>
      </div>

      {/* Student List */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Student Submissions</h3>
        </div>
        
        {enrolledStudents.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No students enrolled in this course.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {enrolledStudents.map((enrollment) => {
              const student = enrollment.student
              const submission = submissions[student.id]
              const grade = grades[student.id]
              
              return (
                <div 
                  key={student.id}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-600 font-semibold">
                          {student.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      
                      {/* Student Info */}
                      <div>
                        <p className="font-medium text-gray-900">{student.full_name}</p>
                        <p className="text-sm text-gray-500">{student.student_id}</p>
                      </div>
                    </div>

                    {/* Submission Status */}
                    <div className="flex items-center gap-4">
                      {submission ? (
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm px-2 py-0.5 rounded-full ${
                              submission.latest_submission.is_late 
                                ? 'bg-yellow-100 text-yellow-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {submission.latest_submission.is_late ? 'Late' : 'On time'}
                            </span>
                            {submission.submission_count > 1 && (
                              <span className="text-xs text-gray-500">
                                {submission.submission_count} versions
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(submission.latest_submission.submitted_at)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not submitted</span>
                      )}

                      {/* Grade */}
                      {grade ? (
                        <div className="text-right min-w-[80px]">
                          <span className="text-lg font-bold text-success-600">
                            {grade.total_score}/{grade.max_score}
                          </span>
                          <p className="text-xs text-gray-500">
                            {Math.round((grade.total_score / grade.max_score) * 100)}%
                          </p>
                        </div>
                      ) : (
                        <div className="min-w-[80px] text-right">
                          <span className="text-sm text-gray-400">--</span>
                        </div>
                      )}

                      {/* Action Button */}
                      <button
                        onClick={() => handleOpenGrading(enrollment)}
                        disabled={!submission}
                        className={`btn ${submission ? 'btn-primary' : 'btn-secondary'} text-sm`}
                      >
                        {grade ? 'Edit Grade' : 'Grade'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Grading Modal */}
      <Modal
        isOpen={showGradingModal}
        onClose={() => {
          setShowGradingModal(false)
          setSelectedStudent(null)
        }}
        title={`Grade: ${selectedStudent?.student?.full_name}`}
        maxWidth="max-w-4xl"
      >
        {selectedStudent && (
          <GradingForm
            assignment={assignment}
            student={selectedStudent.student}
            submissions={studentSubmissions}
            existingGrade={grades[selectedStudent.student_id]}
            loading={loadingSubmissions}
            onSave={(gradeData) => handleGradeSaved(selectedStudent.student_id, gradeData)}
            onCancel={() => {
              setShowGradingModal(false)
              setSelectedStudent(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}
