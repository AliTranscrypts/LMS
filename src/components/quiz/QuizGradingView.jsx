import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  QUESTION_TYPES,
  CATEGORY_LABELS,
  getQuizConfig,
  getQuizAttemptsForGrading,
  getQuizAttemptById,
  manualGradeQuestion,
  getQuizStats
} from '../../services/quizzes'

/**
 * QuizGradingView - Teacher interface for grading quizzes
 * Supports manual grading of short answer and essay questions
 */
export default function QuizGradingView({ assignment, courseId, onClose }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState([])
  const [quizConfig, setQuizConfig] = useState(null)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  
  // Selected attempt for grading
  const [selectedAttempt, setSelectedAttempt] = useState(null)
  const [attemptDetails, setAttemptDetails] = useState(null)

  useEffect(() => {
    loadGradingData()
  }, [assignment.id])

  const loadGradingData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get quiz configuration
      const { data: configData, error: configError } = await getQuizConfig(assignment.id)
      if (configError) throw configError
      setQuizConfig(configData?.quiz_config)

      // Get all attempts for grading
      const { data: attemptsData, error: attemptsError } = await getQuizAttemptsForGrading(assignment.id)
      if (attemptsError) throw attemptsError
      setAttempts(attemptsData || [])

      // Get quiz stats
      const { data: statsData } = await getQuizStats(assignment.id)
      setStats(statsData)

    } catch (err) {
      console.error('Error loading grading data:', err)
      setError('Failed to load quiz data')
    }

    setLoading(false)
  }

  const handleSelectAttempt = async (attempt) => {
    setSelectedAttempt(attempt)
    
    // Load full attempt details
    const { data, error } = await getQuizAttemptById(attempt.attempt_id)
    if (!error) {
      setAttemptDetails(data)
    }
  }

  const handleBackToList = () => {
    setSelectedAttempt(null)
    setAttemptDetails(null)
    loadGradingData() // Refresh data
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-error-50 border border-error-200 text-error-700 rounded-lg">
        {error}
      </div>
    )
  }

  // Show individual attempt grading view
  if (selectedAttempt && attemptDetails) {
    return (
      <AttemptGradingView
        attempt={attemptDetails}
        quizConfig={quizConfig}
        graderId={user?.id}
        onBack={handleBackToList}
        onGraded={handleBackToList}
      />
    )
  }

  // Show attempts list
  return (
    <div className="space-y-6">
      {/* Quiz Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-primary-600">{stats.totalAttempts}</p>
            <p className="text-xs text-gray-500">Total Attempts</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-success-600">{stats.gradedAttempts}</p>
            <p className="text-xs text-gray-500">Fully Graded</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">
              {stats.averagePercentage !== null ? `${stats.averagePercentage}%` : '--'}
            </p>
            <p className="text-xs text-gray-500">Average Score</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">
              {stats.highestScore !== null ? stats.highestScore : '--'}
            </p>
            <p className="text-xs text-gray-500">Highest Score</p>
          </div>
        </div>
      )}

      {/* Attempts List */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">Student Attempts</h3>
        
        {attempts.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No quiz attempts yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {attempts.map((attempt) => {
              const percentage = attempt.max_score > 0 
                ? Math.round((attempt.total_score / attempt.max_score) * 100) 
                : 0
              const needsGrading = !attempt.is_graded

              return (
                <div 
                  key={attempt.attempt_id}
                  className={`card p-4 cursor-pointer hover:shadow-md transition-shadow ${
                    needsGrading ? 'border-l-4 border-warning-400' : ''
                  }`}
                  onClick={() => handleSelectAttempt(attempt)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-lg">👤</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {attempt.student_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {attempt.student_number} • Submitted {formatDate(attempt.submitted_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          percentage >= 80 ? 'text-success-600' :
                          percentage >= 70 ? 'text-primary-600' :
                          percentage >= 60 ? 'text-warning-600' :
                          'text-error-600'
                        }`}>
                          {attempt.total_score}/{attempt.max_score}
                        </div>
                        <div className="text-xs text-gray-500">
                          {percentage}%
                        </div>
                      </div>
                      
                      {needsGrading ? (
                        <span className="px-3 py-1 bg-warning-100 text-warning-700 text-xs font-medium rounded-full">
                          Needs Grading
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-success-100 text-success-700 text-xs font-medium rounded-full">
                          Graded
                        </span>
                      )}

                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * AttemptGradingView - Grade individual quiz attempt
 */
function AttemptGradingView({ attempt, quizConfig, graderId, onBack, onGraded }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  
  // Manual grades for questions that need grading
  const [manualGrades, setManualGrades] = useState({})
  const [feedback, setFeedback] = useState('')

  const questions = quizConfig?.questions || []
  const studentAnswers = attempt.answers || {}

  // Find questions needing manual grading
  const questionsNeedingGrading = questions.filter(q => 
    q.type === QUESTION_TYPES.SHORT_ANSWER || q.type === QUESTION_TYPES.ESSAY
  )

  const handlePointsChange = (questionId, points) => {
    setManualGrades(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], points: parseFloat(points) || 0 }
    }))
  }

  const handleQuestionFeedbackChange = (questionId, fb) => {
    setManualGrades(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], feedback: fb }
    }))
  }

  const handleSaveGrades = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Grade each question that needs manual grading
      for (const question of questionsNeedingGrading) {
        const grade = manualGrades[question.id]
        if (grade?.points !== undefined) {
          const { error: gradeError } = await manualGradeQuestion(
            attempt.id,
            question.id,
            grade.points,
            graderId,
            grade.feedback || null
          )
          if (gradeError) throw gradeError
        }
      }

      setSuccess('Grades saved successfully!')
      setTimeout(() => {
        onGraded()
      }, 1500)

    } catch (err) {
      console.error('Error saving grades:', err)
      setError('Failed to save grades. Please try again.')
    }

    setSaving(false)
  }

  const percentage = attempt.max_score > 0 
    ? Math.round((attempt.total_score / attempt.max_score) * 100) 
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Attempts
        </button>
      </div>

      {/* Student Info */}
      <div className="card p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-xl">👤</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{attempt.student?.full_name}</h3>
            <p className="text-sm text-gray-500">{attempt.student?.student_id}</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${
            percentage >= 80 ? 'text-success-600' :
            percentage >= 70 ? 'text-primary-600' :
            percentage >= 60 ? 'text-warning-600' :
            'text-error-600'
          }`}>
            {attempt.total_score}/{attempt.max_score}
          </div>
          <p className="text-sm text-gray-500">{percentage}% (auto-graded portion)</p>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-3 bg-error-50 border border-error-200 text-error-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-success-50 border border-success-200 text-success-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Questions & Answers</h3>
        
        {questions.map((question, index) => {
          const studentAnswer = studentAnswers[question.id] || ''
          const isAutoGraded = question.type === QUESTION_TYPES.MULTIPLE_CHOICE || 
                               question.type === QUESTION_TYPES.TRUE_FALSE
          const isCorrect = isAutoGraded 
            ? studentAnswer.toLowerCase() === question.correct_answer?.toLowerCase()
            : null
          
          return (
            <div 
              key={question.id}
              className={`card p-4 ${
                !isAutoGraded ? 'border-l-4 border-warning-400' : ''
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">Q{index + 1}.</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                      {question.type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-500">
                      {CATEGORY_LABELS[question.category]?.split(' ')[0]}
                    </span>
                  </div>
                  <p className="text-gray-700">{question.text}</p>
                </div>
                <div className="text-right ml-4">
                  <span className="text-sm font-medium text-gray-600">
                    {question.points} pt{question.points !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Student Answer */}
              <div className={`p-3 rounded-lg mb-3 ${
                isAutoGraded 
                  ? (isCorrect ? 'bg-success-50 border border-success-200' : 'bg-error-50 border border-error-200')
                  : 'bg-gray-50 border border-gray-200'
              }`}>
                <div className="text-sm text-gray-500 mb-1">Student's Answer:</div>
                <div className="text-gray-800">
                  {studentAnswer || <span className="text-gray-400 italic">No answer provided</span>}
                </div>
              </div>

              {/* Auto-graded Result */}
              {isAutoGraded && (
                <div className="flex items-center gap-2 text-sm">
                  {isCorrect ? (
                    <span className="text-success-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Correct - {question.points}/{question.points} points
                    </span>
                  ) : (
                    <span className="text-error-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Incorrect - 0/{question.points} points
                      <span className="text-gray-500 ml-2">
                        (Correct: {question.correct_answer})
                      </span>
                    </span>
                  )}
                </div>
              )}

              {/* Manual Grading Section */}
              {!isAutoGraded && (
                <div className="border-t pt-3 space-y-3">
                  {/* Reference Answer */}
                  {question.correct_answer && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm text-blue-700 font-medium mb-1">
                        Reference / Rubric:
                      </div>
                      <div className="text-sm text-blue-600">
                        {question.correct_answer}
                      </div>
                    </div>
                  )}

                  {/* Points Input */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">
                      Award Points:
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={question.points}
                      step="0.5"
                      value={manualGrades[question.id]?.points ?? ''}
                      onChange={(e) => handlePointsChange(question.id, e.target.value)}
                      placeholder={`0-${question.points}`}
                      className="input w-24"
                    />
                    <span className="text-sm text-gray-500">
                      / {question.points} pts
                    </span>
                  </div>

                  {/* Question Feedback */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Feedback for this question (optional):
                    </label>
                    <textarea
                      value={manualGrades[question.id]?.feedback || ''}
                      onChange={(e) => handleQuestionFeedbackChange(question.id, e.target.value)}
                      rows={2}
                      placeholder="Add feedback for this specific question..."
                      className="input w-full text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Overall Feedback */}
      {questionsNeedingGrading.length > 0 && (
        <div className="card p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Overall Feedback (optional):
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="Add overall feedback for the student..."
            className="input w-full"
          />
        </div>
      )}

      {/* Save Button */}
      {questionsNeedingGrading.length > 0 && (
        <div className="flex gap-3">
          <button
            onClick={handleSaveGrades}
            disabled={saving}
            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Grades
              </>
            )}
          </button>
          <button
            onClick={onBack}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
