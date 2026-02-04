import { useState, useEffect } from 'react'
import { 
  QUESTION_TYPES, 
  CATEGORIES, 
  CATEGORY_LABELS,
  createQuestion,
  calculateCategoryDistribution,
  calculateTotalPoints,
  saveQuizConfig,
  getQuizConfig
} from '../../services/quizzes'

/**
 * QuizBuilder - Teacher interface for creating and editing quizzes
 * Supports MC, True/False, Short Answer, and Essay questions
 */
export default function QuizBuilder({ content, onSave, onCancel }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  
  // Quiz settings
  const [quizName, setQuizName] = useState(content?.name || '')
  const [quizDescription, setQuizDescription] = useState(content?.description || '')
  const [timeLimit, setTimeLimit] = useState(null)
  
  // Questions
  const [questions, setQuestions] = useState([])
  
  // UI state
  const [expandedQuestion, setExpandedQuestion] = useState(null)
  const [showAddMenu, setShowAddMenu] = useState(false)

  useEffect(() => {
    if (content?.id) {
      loadQuizConfig()
    } else {
      setLoading(false)
    }
  }, [content?.id])

  const loadQuizConfig = async () => {
    setLoading(true)
    const { data, error } = await getQuizConfig(content.id)
    
    if (error) {
      setError('Failed to load quiz configuration')
      console.error(error)
    } else if (data?.quiz_config) {
      setTimeLimit(data.quiz_config.time_limit || null)
      setQuestions(data.quiz_config.questions || [])
    }
    
    setLoading(false)
  }

  const handleAddQuestion = (type) => {
    const newQuestion = createQuestion(type)
    setQuestions([...questions, newQuestion])
    setExpandedQuestion(newQuestion.id)
    setShowAddMenu(false)
  }

  const handleUpdateQuestion = (questionId, updates) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, ...updates } : q
    ))
  }

  const handleDeleteQuestion = (questionId) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      setQuestions(questions.filter(q => q.id !== questionId))
      if (expandedQuestion === questionId) {
        setExpandedQuestion(null)
      }
    }
  }

  const handleMoveQuestion = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= questions.length) return
    
    const newQuestions = [...questions]
    const [removed] = newQuestions.splice(index, 1)
    newQuestions.splice(newIndex, 0, removed)
    setQuestions(newQuestions)
  }

  const handleDuplicateQuestion = (question) => {
    const duplicated = {
      ...question,
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    const index = questions.findIndex(q => q.id === question.id)
    const newQuestions = [...questions]
    newQuestions.splice(index + 1, 0, duplicated)
    setQuestions(newQuestions)
    setExpandedQuestion(duplicated.id)
  }

  const handleSave = async () => {
    // Validate
    if (questions.length === 0) {
      setError('Please add at least one question')
      return
    }

    const invalidQuestions = questions.filter(q => !q.text.trim())
    if (invalidQuestions.length > 0) {
      setError('All questions must have text')
      return
    }

    const mcQuestions = questions.filter(q => q.type === QUESTION_TYPES.MULTIPLE_CHOICE)
    const invalidMC = mcQuestions.filter(q => !q.correct_answer || !q.options.some(o => o.trim()))
    if (invalidMC.length > 0) {
      setError('Multiple choice questions must have options and a correct answer')
      return
    }

    setSaving(true)
    setError(null)

    const quizConfig = {
      time_limit: timeLimit,
      questions: questions
    }

    const { error: saveError } = await saveQuizConfig(content.id, quizConfig)

    if (saveError) {
      setError('Failed to save quiz')
      console.error(saveError)
    } else {
      onSave && onSave()
    }

    setSaving(false)
  }

  const totalPoints = calculateTotalPoints(questions)
  const categoryDistribution = calculateCategoryDistribution(questions)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quiz Settings */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quiz Settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Limit (minutes)
            </label>
            <input
              type="number"
              value={timeLimit || ''}
              onChange={(e) => setTimeLimit(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="No time limit"
              min="1"
              max="300"
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited time</p>
          </div>
        </div>
      </div>

      {/* Category Distribution Preview */}
      <div className="card p-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-gray-900">Total Points: </span>
            <span className="text-xl font-bold text-primary-600">{totalPoints}</span>
          </div>
          <div className="flex gap-4 text-sm">
            {Object.entries(categoryDistribution).map(([key, points]) => (
              points > 0 && (
                <span key={key} className="bg-white px-3 py-1 rounded-full shadow-sm">
                  <span className="font-medium">{CATEGORY_LABELS[key].split(' ')[0]}:</span> {points} pts
                </span>
              )
            ))}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-error-50 border border-error-200 text-error-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            Questions ({questions.length})
          </h3>
        </div>

        {questions.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No questions yet. Add your first question below.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                isExpanded={expandedQuestion === question.id}
                onToggle={() => setExpandedQuestion(
                  expandedQuestion === question.id ? null : question.id
                )}
                onUpdate={(updates) => handleUpdateQuestion(question.id, updates)}
                onDelete={() => handleDeleteQuestion(question.id)}
                onMoveUp={() => handleMoveQuestion(index, -1)}
                onMoveDown={() => handleMoveQuestion(index, 1)}
                onDuplicate={() => handleDuplicateQuestion(question)}
                canMoveUp={index > 0}
                canMoveDown={index < questions.length - 1}
              />
            ))}
          </div>
        )}

        {/* Add Question Button */}
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="btn btn-secondary w-full flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Question
          </button>

          {/* Add Question Menu */}
          {showAddMenu && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border p-2 z-10">
              <button
                onClick={() => handleAddQuestion(QUESTION_TYPES.MULTIPLE_CHOICE)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded flex items-center gap-3"
              >
                <span className="text-xl">🔘</span>
                <div>
                  <div className="font-medium">Multiple Choice</div>
                  <div className="text-xs text-gray-500">Auto-graded</div>
                </div>
              </button>
              <button
                onClick={() => handleAddQuestion(QUESTION_TYPES.TRUE_FALSE)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded flex items-center gap-3"
              >
                <span className="text-xl">✓✗</span>
                <div>
                  <div className="font-medium">True/False</div>
                  <div className="text-xs text-gray-500">Auto-graded</div>
                </div>
              </button>
              <button
                onClick={() => handleAddQuestion(QUESTION_TYPES.SHORT_ANSWER)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded flex items-center gap-3"
              >
                <span className="text-xl">📝</span>
                <div>
                  <div className="font-medium">Short Answer</div>
                  <div className="text-xs text-gray-500">Manual grading required</div>
                </div>
              </button>
              <button
                onClick={() => handleAddQuestion(QUESTION_TYPES.ESSAY)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded flex items-center gap-3"
              >
                <span className="text-xl">📄</span>
                <div>
                  <div className="font-medium">Essay</div>
                  <div className="text-xs text-gray-500">Manual grading required</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={handleSave}
          disabled={saving || questions.length === 0}
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
              Save Quiz
            </>
          )}
        </button>
        <button
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * QuestionCard - Individual question editor
 */
function QuestionCard({ 
  question, 
  index, 
  isExpanded, 
  onToggle, 
  onUpdate, 
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  canMoveUp,
  canMoveDown
}) {
  const getTypeLabel = (type) => {
    switch (type) {
      case QUESTION_TYPES.MULTIPLE_CHOICE: return 'Multiple Choice'
      case QUESTION_TYPES.TRUE_FALSE: return 'True/False'
      case QUESTION_TYPES.SHORT_ANSWER: return 'Short Answer'
      case QUESTION_TYPES.ESSAY: return 'Essay'
      default: return type
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case QUESTION_TYPES.MULTIPLE_CHOICE: return '🔘'
      case QUESTION_TYPES.TRUE_FALSE: return '✓✗'
      case QUESTION_TYPES.SHORT_ANSWER: return '📝'
      case QUESTION_TYPES.ESSAY: return '📄'
      default: return '❓'
    }
  }

  const isAutoGraded = question.type === QUESTION_TYPES.MULTIPLE_CHOICE || 
                       question.type === QUESTION_TYPES.TRUE_FALSE

  return (
    <div className={`card border ${isExpanded ? 'border-primary-300 shadow-md' : 'border-gray-200'}`}>
      {/* Question Header */}
      <div
        className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <span className="text-xl">{getTypeIcon(question.type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">Q{index + 1}.</span>
            <span className="text-gray-600 truncate">
              {question.text || '(No question text)'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
            <span>{getTypeLabel(question.type)}</span>
            <span>•</span>
            <span>{question.points} pt{question.points !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{CATEGORY_LABELS[question.category]?.split(' ')[0] || question.category}</span>
            {isAutoGraded && (
              <>
                <span>•</span>
                <span className="text-success-600">Auto-graded</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp() }}
            disabled={!canMoveUp}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown() }}
            disabled={!canMoveDown}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
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

      {/* Question Editor */}
      {isExpanded && (
        <div className="p-4 pt-0 border-t space-y-4">
          {/* Question Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Question Text *
            </label>
            <textarea
              value={question.text}
              onChange={(e) => onUpdate({ text: e.target.value })}
              rows={2}
              className="input"
              placeholder="Enter your question..."
            />
          </div>

          {/* Question Settings Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Points
              </label>
              <input
                type="number"
                value={question.points}
                onChange={(e) => onUpdate({ points: parseInt(e.target.value) || 1 })}
                min="1"
                max="100"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={question.category}
                onChange={(e) => onUpdate({ category: e.target.value })}
                className="input"
              >
                {Object.entries(CATEGORIES).map(([key, value]) => (
                  <option key={value} value={value}>
                    {CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Type-specific fields */}
          {question.type === QUESTION_TYPES.MULTIPLE_CHOICE && (
            <MultipleChoiceEditor 
              question={question} 
              onUpdate={onUpdate} 
            />
          )}

          {question.type === QUESTION_TYPES.TRUE_FALSE && (
            <TrueFalseEditor 
              question={question} 
              onUpdate={onUpdate} 
            />
          )}

          {question.type === QUESTION_TYPES.SHORT_ANSWER && (
            <ShortAnswerEditor 
              question={question} 
              onUpdate={onUpdate} 
            />
          )}

          {question.type === QUESTION_TYPES.ESSAY && (
            <EssayEditor 
              question={question} 
              onUpdate={onUpdate} 
            />
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onDuplicate}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Duplicate
            </button>
            <button
              onClick={onDelete}
              className="text-sm text-error-600 hover:text-error-700 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Multiple Choice Editor
 */
function MultipleChoiceEditor({ question, onUpdate }) {
  const handleOptionChange = (index, value) => {
    const newOptions = [...question.options]
    newOptions[index] = value
    onUpdate({ options: newOptions })
  }

  const handleAddOption = () => {
    onUpdate({ options: [...question.options, ''] })
  }

  const handleRemoveOption = (index) => {
    if (question.options.length <= 2) return
    const newOptions = question.options.filter((_, i) => i !== index)
    // Clear correct answer if it was the removed option
    if (question.correct_answer === question.options[index]) {
      onUpdate({ options: newOptions, correct_answer: '' })
    } else {
      onUpdate({ options: newOptions })
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Answer Options
      </label>
      {question.options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="radio"
            name={`correct_${question.id}`}
            checked={question.correct_answer === option && option !== ''}
            onChange={() => onUpdate({ correct_answer: option })}
            className="w-4 h-4 text-primary-600"
            disabled={!option.trim()}
          />
          <input
            type="text"
            value={option}
            onChange={(e) => handleOptionChange(index, e.target.value)}
            placeholder={`Option ${index + 1}`}
            className="input flex-1"
          />
          {question.options.length > 2 && (
            <button
              onClick={() => handleRemoveOption(index)}
              className="p-2 text-gray-400 hover:text-error-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
      
      {question.options.length < 6 && (
        <button
          onClick={handleAddOption}
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Option
        </button>
      )}

      <p className="text-xs text-gray-500">
        Select the radio button next to the correct answer.
      </p>
    </div>
  )
}

/**
 * True/False Editor
 */
function TrueFalseEditor({ question, onUpdate }) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Correct Answer
      </label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`tf_${question.id}`}
            checked={question.correct_answer === 'True'}
            onChange={() => onUpdate({ correct_answer: 'True' })}
            className="w-4 h-4 text-primary-600"
          />
          <span className="text-gray-700">True</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`tf_${question.id}`}
            checked={question.correct_answer === 'False'}
            onChange={() => onUpdate({ correct_answer: 'False' })}
            className="w-4 h-4 text-primary-600"
          />
          <span className="text-gray-700">False</span>
        </label>
      </div>
    </div>
  )
}

/**
 * Short Answer Editor
 */
function ShortAnswerEditor({ question, onUpdate }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Expected Answer (for reference)
        </label>
        <input
          type="text"
          value={question.correct_answer || ''}
          onChange={(e) => onUpdate({ correct_answer: e.target.value })}
          placeholder="Sample correct answer for grading reference..."
          className="input"
        />
        <p className="text-xs text-gray-500 mt-1">
          This answer is for your reference when grading. Short answers require manual grading.
        </p>
      </div>
    </div>
  )
}

/**
 * Essay Editor
 */
function EssayEditor({ question, onUpdate }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Grading Rubric / Sample Answer (for reference)
        </label>
        <textarea
          value={question.correct_answer || ''}
          onChange={(e) => onUpdate({ correct_answer: e.target.value })}
          rows={4}
          placeholder="Enter rubric criteria or sample answer for grading reference..."
          className="input"
        />
        <p className="text-xs text-gray-500 mt-1">
          Use this space for rubric criteria or a sample answer. Essays require manual grading.
        </p>
      </div>
    </div>
  )
}
