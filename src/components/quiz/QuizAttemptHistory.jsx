import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  CATEGORY_LABELS,
  getStudentQuizAttempts,
  getQuizConfig
} from '../../services/quizzes'

/**
 * QuizAttemptHistory - Shows student's past quiz attempts
 */
export default function QuizAttemptHistory({ quizId, onViewAttempt }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState([])
  const [quizConfig, setQuizConfig] = useState(null)
  const [error, setError] = useState(null)
  const [expandedAttempt, setExpandedAttempt] = useState(null)

  useEffect(() => {
    if (quizId && user?.id) {
      loadAttemptHistory()
    }
  }, [quizId, user?.id])

  const loadAttemptHistory = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get quiz config for question details
      const { data: configData, error: configError } = await getQuizConfig(quizId)
      if (configError) throw configError
      setQuizConfig(configData?.quiz_config)

      // Get attempts
      const { data: attemptData, error: attemptError } = await getStudentQuizAttempts(quizId, user.id)
      if (attemptError) throw attemptError
      setAttempts(attemptData || [])

    } catch (err) {
      console.error('Error loading attempt history:', err)
      setError('Failed to load quiz history')
    }

    setLoading(false)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getGradeColor = (percentage) => {
    if (percentage >= 80) return 'text-success-600'
    if (percentage >= 70) return 'text-primary-600'
    if (percentage >= 60) return 'text-warning-600'
    return 'text-error-600'
  }

  const getGradeBg = (percentage) => {
    if (percentage >= 80) return 'bg-success-100'
    if (percentage >= 70) return 'bg-primary-100'
    if (percentage >= 60) return 'bg-warning-100'
    return 'bg-error-100'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-error-50 border border-error-200 text-error-700 rounded-lg text-sm">
        {error}
      </div>
    )
  }

  if (attempts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p>No quiz attempts yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Quiz Attempt History</h3>
      
      <div className="space-y-3">
        {attempts.map((attempt, index) => {
          const percentage = attempt.max_score > 0 
            ? Math.round((attempt.total_score / attempt.max_score) * 100) 
            : 0
          const isExpanded = expandedAttempt === attempt.id
          const questions = quizConfig?.questions || []

          return (
            <div 
              key={attempt.id} 
              className="card border"
            >
              {/* Attempt Header */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedAttempt(isExpanded ? null : attempt.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getGradeBg(percentage)}`}>
                    <span className={`text-lg font-bold ${getGradeColor(percentage)}`}>
                      {percentage}%
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      Attempt #{attempts.length - index}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(attempt.submitted_at)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {attempt.total_score} / {attempt.max_score}
                    </div>
                    <div className="text-xs text-gray-500">
                      {attempt.is_graded ? 'Graded' : 'Pending Review'}
                    </div>
                  </div>
                  <svg 
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t space-y-4">
                  {/* Category Scores */}
                  {attempt.category_scores && Object.keys(attempt.category_scores).some(k => attempt.category_scores[k] > 0) && (
                    <div className="pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Category Breakdown</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(attempt.category_scores).map(([key, score]) => (
                          score > 0 && (
                            <span 
                              key={key} 
                              className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700"
                            >
                              {CATEGORY_LABELS[key]?.split(' ')[0] || key}: {score}
                            </span>
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Question Answers Review */}
                  {questions.length > 0 && attempt.answers && (
                    <div className="pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Your Answers</h4>
                      <div className="space-y-2">
                        {questions.map((question, qIndex) => {
                          const studentAnswer = attempt.answers[question.id]
                          const isCorrect = question.type === 'multiple_choice' || question.type === 'true_false'
                            ? studentAnswer?.toLowerCase() === question.correct_answer?.toLowerCase()
                            : null // Can't determine for essay/short answer
                          
                          return (
                            <div 
                              key={question.id}
                              className={`p-3 rounded-lg text-sm ${
                                isCorrect === true ? 'bg-success-50 border border-success-200' :
                                isCorrect === false ? 'bg-error-50 border border-error-200' :
                                'bg-gray-50 border border-gray-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <span className="font-medium text-gray-700">Q{qIndex + 1}:</span>
                                  <span className="ml-2 text-gray-600">{question.text}</span>
                                </div>
                                {isCorrect !== null && (
                                  <span className={`flex-shrink-0 ${
                                    isCorrect ? 'text-success-600' : 'text-error-600'
                                  }`}>
                                    {isCorrect ? '✓' : '✗'}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 text-gray-700">
                                <span className="text-gray-500">Your answer: </span>
                                {studentAnswer || '(No answer)'}
                              </div>
                              {isCorrect === false && question.correct_answer && (
                                <div className="mt-1 text-success-700">
                                  <span className="text-gray-500">Correct: </span>
                                  {question.correct_answer}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
