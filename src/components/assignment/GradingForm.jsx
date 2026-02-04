import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { saveGrade } from '../../services/assignments'

/**
 * GradingForm - Form for teachers to grade a student's assignment
 * Shows submission history, category-based grading inputs, and feedback
 */
export default function GradingForm({ 
  assignment, 
  student, 
  submissions, 
  existingGrade,
  loading,
  onSave, 
  onCancel 
}) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [selectedSubmissionIndex, setSelectedSubmissionIndex] = useState(0)

  // Category scores state - initialize from existing grade or zeros
  const [categoryScores, setCategoryScores] = useState(() => {
    if (existingGrade?.category_scores) {
      return { ...existingGrade.category_scores }
    }
    // Initialize with zeros for each category in assignment weights
    const weights = assignment.category_weights || {}
    const initial = {}
    Object.keys(weights).forEach(key => {
      initial[key] = ''
    })
    return initial
  })

  const [feedback, setFeedback] = useState(existingGrade?.feedback || '')

  // Get category weights from assignment
  const categoryWeights = assignment.category_weights || {}

  // Calculate total score in real-time
  const { totalScore, maxScore, percentage } = useMemo(() => {
    let total = 0
    let max = 0
    
    Object.entries(categoryWeights).forEach(([key, maxValue]) => {
      const score = parseFloat(categoryScores[key]) || 0
      total += score
      max += maxValue
    })

    return {
      totalScore: total,
      maxScore: max,
      percentage: max > 0 ? Math.round((total / max) * 100) : 0
    }
  }, [categoryScores, categoryWeights])

  // Validate all category scores are filled
  const isValid = useMemo(() => {
    return Object.entries(categoryWeights).every(([key, maxValue]) => {
      const score = categoryScores[key]
      if (score === '' || score === undefined) return false
      const numScore = parseFloat(score)
      return !isNaN(numScore) && numScore >= 0 && numScore <= maxValue
    })
  }, [categoryScores, categoryWeights])

  const handleScoreChange = (category, value) => {
    const maxValue = categoryWeights[category]
    // Allow empty string for clearing
    if (value === '') {
      setCategoryScores(prev => ({ ...prev, [category]: '' }))
      return
    }
    
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      // Clamp to 0-maxValue
      const clampedValue = Math.max(0, Math.min(maxValue, numValue))
      setCategoryScores(prev => ({ ...prev, [category]: clampedValue }))
    }
  }

  const handleSave = async () => {
    if (!isValid) {
      setError('Please enter valid scores for all categories')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Convert empty strings to 0 and ensure numbers
      const finalScores = {}
      Object.entries(categoryScores).forEach(([key, value]) => {
        finalScores[key] = parseFloat(value) || 0
      })

      const selectedSubmission = submissions[selectedSubmissionIndex]
      
      const { data, error: saveError } = await saveGrade(
        assignment.id,
        student.id,
        {
          category_scores: finalScores,
          total_score: totalScore,
          max_score: maxScore,
          feedback: feedback.trim() || null,
          submission_id: selectedSubmission?.id || null
        },
        user.id
      )

      if (saveError) throw saveError

      onSave(data)
    } catch (err) {
      console.error('Error saving grade:', err)
      setError(err.message || 'Failed to save grade. Please try again.')
    } finally {
      setSaving(false)
    }
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

  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getCategoryLabel = (key) => {
    const labels = {
      ku: 'Knowledge & Understanding',
      thinking: 'Thinking',
      application: 'Application',
      communication: 'Communication'
    }
    return labels[key] || key.charAt(0).toUpperCase() + key.slice(1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const selectedSubmission = submissions[selectedSubmissionIndex]

  return (
    <div className="space-y-6">
      {/* Student Info */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-primary-600 font-bold text-lg">
            {student.full_name?.charAt(0)?.toUpperCase() || '?'}
          </span>
        </div>
        <div>
          <p className="font-semibold text-gray-900">{student.full_name}</p>
          <p className="text-sm text-gray-500">{student.student_id}</p>
        </div>
      </div>

      {/* Submission Viewer */}
      <div className="card">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Submission</h3>
          {submissions.length > 1 && (
            <select
              value={selectedSubmissionIndex}
              onChange={(e) => setSelectedSubmissionIndex(parseInt(e.target.value))}
              className="input py-1 px-2 text-sm"
            >
              {submissions.map((sub, index) => (
                <option key={sub.id} value={index}>
                  Version {sub.version} - {formatDate(sub.submitted_at)}
                  {sub.is_late ? ' (Late)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        
        {submissions.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No submission received from this student.
          </div>
        ) : (
          <div className="p-4">
            {/* Submission Meta */}
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-2 py-1 text-xs rounded-full ${
                selectedSubmission.is_late 
                  ? 'bg-yellow-100 text-yellow-700' 
                  : 'bg-green-100 text-green-700'
              }`}>
                {selectedSubmission.is_late ? 'Late Submission' : 'On Time'}
              </span>
              <span className="text-sm text-gray-500">
                Submitted {formatDate(selectedSubmission.submitted_at)}
              </span>
            </div>

            {/* File Submission */}
            {selectedSubmission.submission_data?.file_url && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📎</span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {selectedSubmission.submission_data.file_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(selectedSubmission.submission_data.file_size)}
                      </p>
                    </div>
                  </div>
                  <a
                    href={selectedSubmission.submission_data.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary text-sm"
                  >
                    Download
                  </a>
                </div>
              </div>
            )}

            {/* Text Submission */}
            {selectedSubmission.submission_data?.text_content && (
              <div className="bg-gray-50 rounded-lg border p-4">
                <h4 className="font-medium text-gray-900 mb-2">Text Submission</h4>
                <div className="bg-white rounded p-4 max-h-64 overflow-y-auto">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {selectedSubmission.submission_data.text_content}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grading Section */}
      <div className="card">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Grade Assignment</h3>
        </div>
        
        <div className="p-4 space-y-6">
          {error && (
            <div className="p-3 bg-error-50 border border-error-200 text-error-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Category Scores */}
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Category Scores</h4>
            <div className="space-y-4">
              {Object.entries(categoryWeights).map(([key, maxValue]) => {
                const score = categoryScores[key]
                const numScore = parseFloat(score) || 0
                const isOverMax = numScore > maxValue
                
                return (
                  <div key={key} className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {getCategoryLabel(key)}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max={maxValue}
                          step="0.5"
                          value={score}
                          onChange={(e) => handleScoreChange(key, e.target.value)}
                          className={`input w-24 text-center ${isOverMax ? 'border-error-500' : ''}`}
                          placeholder="0"
                        />
                        <span className="text-gray-500">/ {maxValue}</span>
                        <div className="flex-1 ml-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                numScore === 0 ? 'bg-gray-300' :
                                numScore / maxValue >= 0.8 ? 'bg-success-500' :
                                numScore / maxValue >= 0.6 ? 'bg-yellow-500' :
                                'bg-error-500'
                              }`}
                              style={{ width: `${Math.min(100, (numScore / maxValue) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Total Score Display */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <span className="text-lg font-semibold text-gray-900">Total Score:</span>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary-600">
                {totalScore} / {maxScore}
              </div>
              <div className={`text-lg ${
                percentage >= 80 ? 'text-success-600' :
                percentage >= 60 ? 'text-yellow-600' :
                'text-error-600'
              }`}>
                {percentage}%
              </div>
            </div>
          </div>

          {/* Feedback */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feedback (optional)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              className="input"
              placeholder="Provide feedback for the student..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving || !isValid}
              className="btn btn-success flex-1 flex items-center justify-center gap-2"
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
                  {existingGrade ? 'Update Grade' : 'Save Grade'}
                </>
              )}
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>

          {!isValid && (
            <p className="text-sm text-error-600 text-center">
              Please enter valid scores for all categories (0 to max value)
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
