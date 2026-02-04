import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../services/supabase'
import { getSubmittedStudents, getAssignmentGrades } from '../../services/assignments'
import { fetchStudentGradeData, getCourseGradebook, getCourseGradeStats } from '../../services/grades'
import { getQuizAttemptsForGrading } from '../../services/quizzes'
import { useGradePolling } from '../../hooks/usePolling'
import Modal from '../common/Modal'
import TeacherGradingView from '../assignment/TeacherGradingView'
import { QuizGradingView } from '../quiz'

export default function GradesTab({ course, isTeacher, studentId }) {
  const [loading, setLoading] = useState(true)
  const [grades, setGrades] = useState([])
  const [assignments, setAssignments] = useState([])
  const [enrollmentGrade, setEnrollmentGrade] = useState(null)
  const [error, setError] = useState(null)
  
  // Assignment grading modal state
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [showGradingView, setShowGradingView] = useState(false)
  const [assignmentStats, setAssignmentStats] = useState({})

  // Teacher gradebook state
  const [activeTeacherView, setActiveTeacherView] = useState('assignments') // 'assignments' | 'gradebook'
  const [gradebookData, setGradebookData] = useState([])
  const [gradeStats, setGradeStats] = useState(null)

  // Polling hook for student grade updates (25-35 second intervals)
  const fetchGradeData = useCallback(async () => {
    if (!studentId || !course.id) return null
    return await fetchStudentGradeData(course.id, studentId)
  }, [course.id, studentId])

  const { 
    data: polledGradeData, 
    loading: pollingLoading, 
    refresh: refreshGrades,
    lastUpdated 
  } = useGradePolling(fetchGradeData, {
    enabled: !isTeacher && !!studentId,
    fetchOnMount: false, // We'll do initial fetch manually
    deps: [course.id, studentId]
  })

  // Update state when polled data changes
  useEffect(() => {
    if (polledGradeData) {
      setEnrollmentGrade(polledGradeData.enrollmentGrade)
      setGrades(polledGradeData.grades)
    }
  }, [polledGradeData])

  useEffect(() => {
    if (isTeacher) {
      fetchTeacherGradesOverview()
    } else {
      fetchStudentGrades()
    }
  }, [course.id, studentId, isTeacher])

  const fetchStudentGrades = async () => {
    setLoading(true)
    
    try {
      const data = await fetchStudentGradeData(course.id, studentId)
      setEnrollmentGrade(data.enrollmentGrade)
      setGrades(data.grades)
      setError(null)
    } catch (err) {
      setError('Failed to load grades')
      console.error(err)
    }

    setLoading(false)
  }

  const fetchTeacherGradesOverview = async () => {
    setLoading(true)
    
    // Fetch all assignments/quizzes for this course
    const { data, error } = await supabase
      .from('content')
      .select(`
        id,
        name,
        type,
        total_points,
        due_date,
        evaluation_type,
        category_weights,
        submission_type,
        module:modules!inner(course_id, name)
      `)
      .eq('module.course_id', course.id)
      .in('type', ['assignment', 'quiz'])
      .order('created_at', { ascending: true })

    if (error) {
      setError('Failed to load assignments')
      console.error(error)
    } else {
      setAssignments(data || [])
      
      // Fetch submission and grading stats for each assignment/quiz
      const stats = {}
      for (const assignment of (data || [])) {
        if (assignment.type === 'quiz') {
          // For quizzes, get attempts
          const { data: attempts } = await getQuizAttemptsForGrading(assignment.id)
          const totalAttempts = attempts?.length || 0
          const gradedAttempts = attempts?.filter(a => a.is_graded)?.length || 0
          stats[assignment.id] = {
            submittedCount: totalAttempts,
            gradedCount: gradedAttempts
          }
        } else {
          // For assignments, get submissions
          const { data: submitted } = await getSubmittedStudents(assignment.id)
          const { data: graded } = await getAssignmentGrades(assignment.id)
          stats[assignment.id] = {
            submittedCount: submitted?.length || 0,
            gradedCount: graded?.length || 0
          }
        }
      }
      setAssignmentStats(stats)
    }

    // Fetch gradebook data for all students
    await fetchGradebookData()

    setLoading(false)
  }

  const fetchGradebookData = async () => {
    const { data: gradebook, error: gradebookError } = await getCourseGradebook(course.id)
    if (!gradebookError) {
      setGradebookData(gradebook || [])
    }

    const { data: stats, error: statsError } = await getCourseGradeStats(course.id)
    if (!statsError) {
      setGradeStats(stats)
    }
  }

  const handleOpenGradingView = (assignment) => {
    setSelectedAssignment(assignment)
    setShowGradingView(true)
  }

  const handleCloseGradingView = () => {
    setShowGradingView(false)
    setSelectedAssignment(null)
    // Refresh stats
    fetchTeacherGradesOverview()
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

  // Student view with polling
  if (!isTeacher) {
    return (
      <StudentGradesView 
        grades={grades} 
        enrollmentGrade={enrollmentGrade} 
        categoryWeights={course.category_weights}
        lastUpdated={lastUpdated}
        onRefresh={refreshGrades}
        isRefreshing={pollingLoading}
      />
    )
  }

  // Teacher view
  return (
    <>
      {/* Teacher view tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTeacherView('assignments')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTeacherView === 'assignments'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Assignments
            </button>
            <button
              onClick={() => setActiveTeacherView('gradebook')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTeacherView === 'gradebook'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Student Gradebook
            </button>
          </nav>
        </div>
      </div>

      {activeTeacherView === 'assignments' ? (
        <TeacherGradesOverview 
          assignments={assignments} 
          courseId={course.id} 
          assignmentStats={assignmentStats}
          onOpenGrading={handleOpenGradingView}
        />
      ) : (
        <TeacherGradebook 
          gradebookData={gradebookData}
          gradeStats={gradeStats}
          categoryWeights={course.category_weights}
          onRefresh={fetchGradebookData}
        />
      )}
      
      {/* Assignment/Quiz Grading Modal */}
      <Modal
        isOpen={showGradingView}
        onClose={handleCloseGradingView}
        title={selectedAssignment?.type === 'quiz' ? 'Grade Quiz' : 'Grade Assignment'}
        maxWidth="max-w-6xl"
      >
        {selectedAssignment && selectedAssignment.type === 'quiz' ? (
          <QuizGradingView
            assignment={selectedAssignment}
            courseId={course.id}
            onClose={handleCloseGradingView}
          />
        ) : selectedAssignment && (
          <TeacherGradingView
            assignment={selectedAssignment}
            courseId={course.id}
            onClose={handleCloseGradingView}
          />
        )}
      </Modal>
    </>
  )
}

function StudentGradesView({ grades, enrollmentGrade, categoryWeights, lastUpdated, onRefresh, isRefreshing }) {
  const finalGrade = enrollmentGrade?.final_grade
  const categories = enrollmentGrade?.categories || {}

  // Get grade color based on percentage
  const getGradeColor = (grade) => {
    if (grade === null || grade === undefined) return 'text-gray-400'
    if (grade >= 80) return 'text-success-600'
    if (grade >= 70) return 'text-primary-600'
    if (grade >= 60) return 'text-warning-600'
    return 'text-error-600'
  }

  // Get progress bar color based on percentage
  const getBarColor = (grade) => {
    if (grade === null || grade === undefined) return 'bg-gray-300'
    if (grade >= 80) return 'bg-success-500'
    if (grade >= 70) return 'bg-primary-500'
    if (grade >= 60) return 'bg-warning-500'
    return 'bg-error-500'
  }

  return (
    <div>
      {/* Grade Summary */}
      <div className="card p-6 mb-6">
        {/* Last updated indicator */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-xs text-gray-400">
            {lastUpdated && (
              <>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </>
            )}
          </div>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 disabled:opacity-50"
          >
            <svg 
              className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Overall Grade - Large and Prominent */}
        <div className="text-center mb-8">
          <div className={`text-6xl font-bold mb-2 ${getGradeColor(finalGrade)}`}>
            {finalGrade !== undefined && finalGrade !== null ? `${finalGrade}%` : '--'}
          </div>
          <p className="text-gray-600 text-lg">Overall Course Grade</p>
          {finalGrade === null || finalGrade === undefined ? (
            <p className="text-sm text-gray-400 mt-2">
              Your grade will appear once OF Learning assignments are graded
            </p>
          ) : null}
        </div>

        {/* Category Breakdown with Progress Bars */}
        <div className="border-t pt-6">
          <h3 className="font-semibold text-gray-900 mb-4">Category Breakdown</h3>
          <div className="space-y-5">
            {Object.entries(categoryWeights || {}).map(([key, weight]) => {
              const categoryGrade = categories[key]
              const label = key === 'ku' ? 'Knowledge & Understanding' : key.charAt(0).toUpperCase() + key.slice(1)
              const hasGrade = categoryGrade !== undefined && categoryGrade !== null
              
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-700 font-medium">{label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs">({weight}% weight)</span>
                      <span className={`font-bold ${hasGrade ? getGradeColor(categoryGrade) : 'text-gray-400'}`}>
                        {hasGrade ? `${categoryGrade}%` : '--'}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${getBarColor(categoryGrade)}`}
                      style={{ width: `${categoryGrade || 0}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Individual Grades */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Graded Assignments</h3>
        
        {grades.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p>No graded assignments yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Your grades will appear here as your teacher grades your work.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grades.map((grade) => {
              const percentage = Math.round((grade.total_score / grade.max_score) * 100)
              const isOfLearning = grade.assignment?.evaluation_type === 'of'
              
              return (
                <div key={grade.id} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{grade.assignment?.name}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isOfLearning 
                            ? 'bg-success-100 text-success-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {grade.assignment?.evaluation_type === 'of' ? 'OF Learning' : 
                           grade.assignment?.evaluation_type === 'for' ? 'FOR Learning' : 'AS Learning'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        Graded on {new Date(grade.graded_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${getGradeColor(percentage)}`}>
                        {grade.total_score}/{grade.max_score}
                      </div>
                      <div className="text-sm text-gray-500">
                        {percentage}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Category scores */}
                  {grade.category_scores && (
                    <div className="flex flex-wrap gap-3 text-sm mt-2">
                      {Object.entries(grade.category_scores).map(([key, value]) => {
                        const maxValue = grade.assignment?.category_weights?.[key]
                        const label = key === 'ku' ? 'K&U' : key.charAt(0).toUpperCase() + key.slice(1)
                        return value !== undefined && value !== null && (
                          <span key={key} className="bg-gray-100 px-2 py-1 rounded text-gray-600">
                            {label}: {value}{maxValue ? `/${maxValue}` : ''}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {grade.feedback && (
                    <div className="mt-3 p-3 bg-primary-50 rounded-lg text-sm text-gray-700 border-l-4 border-primary-400">
                      <span className="font-medium text-primary-700">Feedback: </span>
                      {grade.feedback}
                    </div>
                  )}

                  {!isOfLearning && (
                    <p className="text-xs text-gray-400 mt-2 italic">
                      This grade does not count toward your final grade.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function TeacherGradebook({ gradebookData, gradeStats, categoryWeights, onRefresh }) {
  // Get grade color based on percentage
  const getGradeColor = (grade) => {
    if (grade === null || grade === undefined) return 'text-gray-400'
    if (grade >= 80) return 'text-success-600'
    if (grade >= 70) return 'text-primary-600'
    if (grade >= 60) return 'text-warning-600'
    return 'text-error-600'
  }

  const getCategoryLabel = (key) => {
    const labels = {
      ku: 'K&U',
      thinking: 'Think',
      application: 'App',
      communication: 'Comm'
    }
    return labels[key] || key
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Student Gradebook</h2>
        <button
          onClick={onRefresh}
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Class Statistics */}
      {gradeStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-primary-600">
              {gradeStats.totalStudents}
            </p>
            <p className="text-sm text-gray-500">Total Students</p>
          </div>
          <div className="card p-4 text-center">
            <p className={`text-2xl font-bold ${getGradeColor(gradeStats.average)}`}>
              {gradeStats.average !== null ? `${gradeStats.average}%` : '--'}
            </p>
            <p className="text-sm text-gray-500">Class Average</p>
          </div>
          <div className="card p-4 text-center">
            <p className={`text-2xl font-bold ${getGradeColor(gradeStats.highest)}`}>
              {gradeStats.highest !== null ? `${gradeStats.highest}%` : '--'}
            </p>
            <p className="text-sm text-gray-500">Highest Grade</p>
          </div>
          <div className="card p-4 text-center">
            <p className={`text-2xl font-bold ${getGradeColor(gradeStats.lowest)}`}>
              {gradeStats.lowest !== null ? `${gradeStats.lowest}%` : '--'}
            </p>
            <p className="text-sm text-gray-500">Lowest Grade</p>
          </div>
        </div>
      )}

      {/* Gradebook Table */}
      {gradebookData.length === 0 ? (
        <div className="card p-6 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p>No students enrolled in this course yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Enroll students from the Students tab.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Final Grade
                  </th>
                  {categoryWeights && Object.keys(categoryWeights).map(key => (
                    <th key={key} scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getCategoryLabel(key)}
                      <span className="block text-gray-400 font-normal">({categoryWeights[key]}%)</span>
                    </th>
                  ))}
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {gradebookData.map((enrollment) => {
                  const finalGrade = enrollment.calculated_grade?.final_grade
                  const categories = enrollment.calculated_grade?.categories || {}
                  
                  return (
                    <tr key={enrollment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {enrollment.student?.full_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {enrollment.student?.student_id}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`text-lg font-bold ${getGradeColor(finalGrade)}`}>
                          {finalGrade !== null && finalGrade !== undefined ? `${finalGrade}%` : '--'}
                        </span>
                      </td>
                      {categoryWeights && Object.keys(categoryWeights).map(key => {
                        const categoryGrade = categories[key]
                        return (
                          <td key={key} className="px-4 py-4 whitespace-nowrap text-center">
                            <span className={`text-sm font-medium ${getGradeColor(categoryGrade)}`}>
                              {categoryGrade !== null && categoryGrade !== undefined ? `${categoryGrade}%` : '--'}
                            </span>
                          </td>
                        )
                      })}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        {enrollment.last_calculated_at 
                          ? new Date(enrollment.last_calculated_at).toLocaleDateString()
                          : '--'
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-success-500"></span>
          80%+ (A)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary-500"></span>
          70-79% (B)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-warning-500"></span>
          60-69% (C)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-error-500"></span>
          Below 60%
        </span>
      </div>
    </div>
  )
}

function TeacherGradesOverview({ assignments, courseId, assignmentStats, onOpenGrading }) {
  const formatDate = (dateString) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Assignments & Quizzes</h2>
      
      {assignments.length === 0 ? (
        <div className="card p-6 text-center text-gray-500">
          No assignments or quizzes have been created yet.
          <p className="text-sm mt-2">Add assignments from the Modules tab.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => {
            const stats = assignmentStats[assignment.id] || { submittedCount: 0, gradedCount: 0 }
            const isPastDue = assignment.due_date && new Date() > new Date(assignment.due_date)
            
            return (
              <div 
                key={assignment.id} 
                className="card p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onOpenGrading(assignment)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {assignment.type === 'quiz' ? '❓' : '📝'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{assignment.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          assignment.evaluation_type === 'of' 
                            ? 'bg-success-100 text-success-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {assignment.evaluation_type === 'of' ? 'OF' : 
                           assignment.evaluation_type === 'for' ? 'FOR' : 'AS'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {assignment.module?.name}
                        {assignment.due_date && (
                          <span className={isPastDue ? 'text-error-600 ml-2' : 'ml-2'}>
                            • Due {formatDate(assignment.due_date)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {/* Submission Stats */}
                    <div className="text-center">
                      <p className="text-lg font-semibold text-primary-600">
                        {stats.submittedCount}
                      </p>
                      <p className="text-xs text-gray-500">submitted</p>
                    </div>
                    
                    {/* Graded Stats */}
                    <div className="text-center">
                      <p className="text-lg font-semibold text-success-600">
                        {stats.gradedCount}
                      </p>
                      <p className="text-xs text-gray-500">graded</p>
                    </div>
                    
                    {/* Points */}
                    <div className="text-center min-w-[60px]">
                      {assignment.total_points && (
                        <>
                          <p className="text-lg font-semibold text-gray-600">
                            {assignment.total_points}
                          </p>
                          <p className="text-xs text-gray-500">points</p>
                        </>
                      )}
                    </div>
                    
                    {/* Action */}
                    <div className="text-primary-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
