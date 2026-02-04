import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  QUESTION_TYPES,
  CATEGORY_LABELS,
  getQuizConfig,
  submitQuizAttempt,
  getLatestQuizAttempt,
  getStudentQuizGrade
} from '../../services/quizzes'
import { markContentComplete } from '../../services/progress'

/**
 * QuizViewer - Student interface for taking quizzes
 * Renders questions, handles timer, and submits for server-side grading
 */
export default function QuizViewer({ content, progress, onProgressUpdate }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  
  // Quiz data
  const [quizConfig, setQuizConfig] = useState(null)
  const [questions, setQuestions] = useState([])
  
  // Quiz state
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [existingAttempt, setExistingAttempt] = useState(null)
  const [existingGrade, setExistingGrade] = useState(null)
  
  // Timer
  const [timeRemaining, setTimeRemaining] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    loadQuizData()
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [content?.id, user?.id])

  const loadQuizData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get quiz configuration
      const { data: quizData, error: quizError } = await getQuizConfig(content.id)
      if (quizError) throw quizError

      setQuizConfig(quizData?.quiz_config)
      setQuestions(quizData?.quiz_config?.questions || [])

      // Check for existing attempts
      const { data: attemptData } = await getLatestQuizAttempt(content.id, user.id)
      if (attemptData) {
        setExistingAttempt(attemptData)
        setQuizCompleted(true)
      }

      // Check for existing grade
      const { data: gradeData } = await getStudentQuizGrade(content.id, user.id)
      if (gradeData) {
        setExistingGrade(gradeData)
      }

    } catch (err) {
      console.error('Error loading quiz:', err)
      setError('Failed to load quiz')
    }

    setLoading(false)
  }

  const startQuiz = () => {
    setQuizStarted(true)
    setAnswers({})
    
    // Start timer if time limit is set
    if (quizConfig?.time_limit) {
      const timeInSeconds = quizConfig.time_limit * 60
      setTimeRemaining(timeInSeconds)
      
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            handleSubmit(true) // Auto-submit when time runs out
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
  }

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit) {
      const unanswered = questions.filter(q => !answers[q.id] || answers[q.id].trim() === '')
      if (unanswered.length > 0) {
        const confirm = window.confirm(
          `You have ${unanswered.length} unanswered question(s). Are you sure you want to submit?`
        )
        if (!confirm) return
      }
    }

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    setSubmitting(true)
    setError(null)

    try {
      // Submit to server for grading
      const { data: gradeResult, error: gradeError } = await submitQuizAttempt(
        content.id,
        user.id,
        answers
      )

      if (gradeError) throw gradeError

      setResult(gradeResult)
      setQuizCompleted(true)

      // Mark content as complete
      if (!progress?.completed) {
        const { data: progressData } = await markContentComplete(content.id, user.id)
        if (progressData && onProgressUpdate) {
          onProgressUpdate(progressData)
        }
      }

    } catch (err) {
      console.error('Error submitting quiz:', err)
      setError('Failed to submit quiz. Please try again.')
    }

    setSubmitting(false)
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getAnsweredCount = () => {
    return questions.filter(q => answers[q.id] && answers[q.id].trim() !== '').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!quizConfig || questions.length === 0) {
    return (
      <div className="card p-6 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>This quiz has not been configured yet.</p>
        <p className="text-sm mt-1">Please check back later.</p>
      </div>
    )
  }

  // Show results if quiz is completed
  if (quizCompleted) {
    return (
      <QuizResults
        result={result}
        existingAttempt={existingAttempt}
        existingGrade={existingGrade}
        questions={questions}
        quizConfig={quizConfig}
        content={content}
        onRetake={() => {
          setQuizCompleted(false)
          setQuizStarted(false)
          setResult(null)
          setAnswers({})
        }}
      />
    )
  }

  // Show start screen if quiz hasn't started
  if (!quizStarted) {
    return (
      <QuizStartScreen
        quizConfig={quizConfig}
        questions={questions}
        content={content}
        onStart={startQuiz}
      />
    )
  }

  // Quiz in progress
  return (
    <div className="space-y-6">
      {/* Quiz Header with Timer */}
      <div className="sticky top-0 bg-white z-10 py-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-500">
              {getAnsweredCount()} of {questions.length} answered
            </span>
          </div>
          
          {timeRemaining !== null && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg ${
              timeRemaining < 60 ? 'bg-error-100 text-error-700 animate-pulse' :
              timeRemaining < 300 ? 'bg-warning-100 text-warning-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(timeRemaining)}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(getAnsweredCount() / questions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-error-50 border border-error-200 text-error-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((question, index) => (
          <QuestionRenderer
            key={question.id}
            question={question}
            index={index}
            answer={answers[question.id] || ''}
            onAnswerChange={(answer) => handleAnswerChange(question.id, answer)}
          />
        ))}
      </div>

      {/* Submit Button */}
      <div className="pt-4 border-t">
        <button
          onClick={() => handleSubmit(false)}
          disabled={submitting}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Submitting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Submit Quiz
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/**
 * Quiz Start Screen
 */
function QuizStartScreen({ quizConfig, questions, content, onStart }) {
  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0)
  const hasTimeLimit = quizConfig?.time_limit > 0
  
  const questionTypeCounts = questions.reduce((acc, q) => {
    acc[q.type] = (acc[q.type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="card p-6">
      <div className="text-center mb-6">
        <span className="text-5xl mb-4 block">📝</span>
        <h2 className="text-xl font-bold text-gray-900">Ready to Start?</h2>
        <p className="text-gray-600 mt-2">{content.description}</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Questions:</span>
          <span className="font-medium">{questions.length}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Points:</span>
          <span className="font-medium">{totalPoints}</span>
        </div>
        {hasTimeLimit && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Time Limit:</span>
            <span className="font-medium">{quizConfig.time_limit} minutes</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Question Types:</span>
          <span className="font-medium">
            {Object.entries(questionTypeCounts).map(([type, count]) => (
              <span key={type} className="ml-2">
                {count} {type.replace('_', ' ')}
              </span>
            ))}
          </span>
        </div>
      </div>

      {hasTimeLimit && (
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-warning-700">
              <p className="font-medium">Timed Quiz</p>
              <p>Once you start, you will have {quizConfig.time_limit} minutes to complete the quiz. The quiz will auto-submit when time runs out.</p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onStart}
        className="btn btn-primary w-full flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Start Quiz
      </button>
    </div>
  )
}

/**
 * Quiz Results
 */
function QuizResults({ result, existingAttempt, existingGrade, questions, quizConfig, content, onRetake }) {
  // Use result if available (just submitted), otherwise use existing data
  const displayData = result || existingAttempt
  const gradeData = existingGrade
  
  const totalScore = displayData?.total_score ?? 0
  const maxScore = displayData?.max_score ?? questions.reduce((sum, q) => sum + (q.points || 1), 0)
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
  const needsManualGrading = result?.needs_manual_grading || false
  const categoryScores = displayData?.category_scores || {}

  const getGradeColor = (pct) => {
    if (pct >= 80) return 'text-success-600'
    if (pct >= 70) return 'text-primary-600'
    if (pct >= 60) return 'text-warning-600'
    return 'text-error-600'
  }

  const getGradeBg = (pct) => {
    if (pct >= 80) return 'bg-success-50 border-success-200'
    if (pct >= 70) return 'bg-primary-50 border-primary-200'
    if (pct >= 60) return 'bg-warning-50 border-warning-200'
    return 'bg-error-50 border-error-200'
  }

  return (
    <div className="space-y-6">
      {/* Score Display */}
      <div className={`card p-6 border ${getGradeBg(percentage)}`}>
        <div className="text-center">
          <div className={`text-5xl font-bold ${getGradeColor(percentage)} mb-2`}>
            {percentage}%
          </div>
          <div className="text-xl text-gray-700">
            {totalScore} / {maxScore} points
          </div>
          
          {needsManualGrading && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Some questions require manual grading. Your final score may change.
            </div>
          )}
        </div>
      </div>

      {/* Category Breakdown */}
      {Object.keys(categoryScores).some(k => categoryScores[k] > 0) && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Category Breakdown</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(categoryScores).map(([key, score]) => {
              const categoryLabel = CATEGORY_LABELS[key] || key
              const shortLabel = categoryLabel.split(' ')[0]
              return score > 0 && (
                <div key={key} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-900">{score}</div>
                  <div className="text-xs text-gray-500">{shortLabel}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Feedback */}
      {gradeData?.feedback && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Teacher Feedback</h3>
          <p className="text-gray-700 bg-primary-50 rounded-lg p-4 border-l-4 border-primary-400">
            {gradeData.feedback}
          </p>
        </div>
      )}

      {/* Graded Questions Review */}
      {result?.graded_questions && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Question Review</h3>
          <div className="space-y-3">
            {questions.map((question, index) => {
              const graded = result.graded_questions.find(g => g.question_id === question.id)
              const isCorrect = graded?.is_correct
              const needsGrading = graded?.needs_manual_grading
              
              return (
                <div 
                  key={question.id} 
                  className={`p-3 rounded-lg border ${
                    needsGrading ? 'bg-yellow-50 border-yellow-200' :
                    isCorrect ? 'bg-success-50 border-success-200' : 
                    'bg-error-50 border-error-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className="font-medium">Q{index + 1}.</span>
                      <span className="ml-2 text-gray-700">{question.text}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {needsGrading ? (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                          Pending Review
                        </span>
                      ) : (
                        <span className={`text-sm font-medium ${
                          isCorrect ? 'text-success-600' : 'text-error-600'
                        }`}>
                          {graded?.points_earned ?? 0}/{question.points} pts
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Submission Info */}
      <div className="text-center text-sm text-gray-500">
        {displayData?.submitted_at && (
          <p>Submitted on {new Date(displayData.submitted_at).toLocaleString()}</p>
        )}
      </div>
    </div>
  )
}

/**
 * Question Renderer - Renders different question types
 */
function QuestionRenderer({ question, index, answer, onAnswerChange }) {
  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case QUESTION_TYPES.MULTIPLE_CHOICE: return 'Multiple Choice'
      case QUESTION_TYPES.TRUE_FALSE: return 'True/False'
      case QUESTION_TYPES.SHORT_ANSWER: return 'Short Answer'
      case QUESTION_TYPES.ESSAY: return 'Essay'
      default: return type
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-start gap-4 mb-4">
        <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary-100 text-primary-700 font-semibold rounded-full">
          {index + 1}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500">{getQuestionTypeLabel(question.type)}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">{question.points} pt{question.points !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-gray-900 font-medium">{question.text}</p>
        </div>
      </div>

      {/* Render based on question type */}
      {question.type === QUESTION_TYPES.MULTIPLE_CHOICE && (
        <div className="space-y-2 ml-12">
          {question.options.map((option, optIndex) => (
            <label
              key={optIndex}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                answer === option 
                  ? 'bg-primary-50 border-primary-300' 
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name={`q_${question.id}`}
                value={option}
                checked={answer === option}
                onChange={() => onAnswerChange(option)}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === QUESTION_TYPES.TRUE_FALSE && (
        <div className="flex gap-4 ml-12">
          {['True', 'False'].map((option) => (
            <label
              key={option}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                answer === option 
                  ? 'bg-primary-50 border-primary-300' 
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name={`q_${question.id}`}
                value={option}
                checked={answer === option}
                onChange={() => onAnswerChange(option)}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-gray-700 font-medium">{option}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === QUESTION_TYPES.SHORT_ANSWER && (
        <div className="ml-12">
          <input
            type="text"
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Enter your answer..."
            className="input w-full"
          />
        </div>
      )}

      {question.type === QUESTION_TYPES.ESSAY && (
        <div className="ml-12">
          <textarea
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            rows={6}
            placeholder="Write your essay response..."
            className="input w-full"
          />
          <p className="text-xs text-gray-500 mt-1 text-right">
            {answer.length} characters
          </p>
        </div>
      )}
    </div>
  )
}
