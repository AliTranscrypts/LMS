import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { 
  getLatestSubmission, 
  getStudentSubmissions,
  getStudentGrade,
  createSubmission,
  uploadSubmissionFile,
  getSubmissionSignedUrl
} from '../../services/assignments'
import { markContentComplete } from '../../services/progress'

/**
 * AssignmentViewer - Student view for assignments
 * Shows assignment details, submission form, and grades
 */
export default function AssignmentViewer({ content, progress, onProgressUpdate }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [latestSubmission, setLatestSubmission] = useState(null)
  const [allSubmissions, setAllSubmissions] = useState([])
  const [grade, setGrade] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState(null)

  // Submission form state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSubmissionForm, setShowSubmissionForm] = useState(false)
  const [submissionText, setSubmissionText] = useState('')
  const [submissionFile, setSubmissionFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const isCompleted = progress?.completed
  const dueDate = content?.due_date ? new Date(content.due_date) : null
  const isPastDue = dueDate && new Date() > dueDate
  const submissionType = content?.submission_type || 'both'

  useEffect(() => {
    if (user?.id && content?.id) {
      fetchSubmissionData()
    }
  }, [user?.id, content?.id])

  const fetchSubmissionData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch latest submission
      const { data: latestSub, error: latestError } = await getLatestSubmission(content.id, user.id)
      if (latestError) throw latestError
      setLatestSubmission(latestSub)

      // Fetch all submissions for history
      const { data: allSubs, error: allError } = await getStudentSubmissions(content.id, user.id)
      if (allError) throw allError
      setAllSubmissions(allSubs || [])

      // Fetch grade
      const { data: gradeData, error: gradeError } = await getStudentGrade(content.id, user.id)
      if (gradeError) throw gradeError
      setGrade(gradeData)

    } catch (err) {
      console.error('Error fetching submission data:', err)
      setError('Failed to load submission data')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (max 50MB for submissions)
      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB')
        return
      }
      setSubmissionFile(file)
      setError(null)
    }
  }

  const handleSubmit = async () => {
    // Validate submission
    if (submissionType === 'file' && !submissionFile) {
      setError('Please upload a file')
      return
    }
    if (submissionType === 'text' && !submissionText.trim()) {
      setError('Please enter your submission text')
      return
    }
    if (submissionType === 'both' && !submissionFile && !submissionText.trim()) {
      setError('Please upload a file or enter text')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let submissionData = {
        type: submissionFile ? 'file' : 'text'
      }

      // Handle file upload
      if (submissionFile) {
        const { data: fileData, error: uploadError } = await uploadSubmissionFile(
          submissionFile, 
          content.id, 
          user.id
        )
        
        if (uploadError) throw uploadError
        
        // Store path only - signed URLs generated on-demand for viewing
        submissionData = {
          type: 'file',
          file_path: fileData.path,
          file_name: fileData.fileName,
          file_size: fileData.fileSize,
          file_type: fileData.fileType
        }
      }

      // Handle text submission
      if (submissionText.trim()) {
        submissionData = {
          ...submissionData,
          type: submissionFile ? 'both' : 'text',
          text_content: submissionText.trim()
        }
      }

      // Create submission
      const { data: newSubmission, error: submitError } = await createSubmission(
        content.id,
        user.id,
        submissionData,
        content.due_date
      )

      if (submitError) throw submitError

      // Update local state
      setLatestSubmission(newSubmission)
      setAllSubmissions(prev => [newSubmission, ...prev])
      setShowSubmissionForm(false)
      setSubmissionText('')
      setSubmissionFile(null)

      // Mark content as complete if first submission
      if (!isCompleted) {
        const { data: progressData } = await markContentComplete(content.id, user.id)
        if (progressData && onProgressUpdate) {
          onProgressUpdate(progressData)
        }
      }

    } catch (err) {
      console.error('Error submitting:', err)
      setError(err.message || 'Failed to submit. Please try again.')
    } finally {
      setIsSubmitting(false)
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
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Assignment Info Card */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Assignment Details</h2>
            {content.description && (
              <p className="text-gray-600 mt-2">{content.description}</p>
            )}
          </div>
          {content.total_points && (
            <div className="text-right">
              <span className="text-2xl font-bold text-primary-600">{content.total_points}</span>
              <span className="text-gray-500 text-sm block">points</span>
            </div>
          )}
        </div>

        {/* Due Date */}
        {dueDate && (
          <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${
            isPastDue ? 'bg-error-50 text-error-700' : 'bg-gray-50 text-gray-700'
          }`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-medium">
              {isPastDue ? 'Past due: ' : 'Due: '}
              {formatDate(dueDate)}
            </span>
            {isPastDue && <span className="ml-auto text-sm">(Late submissions accepted)</span>}
          </div>
        )}

        {/* Submission Requirements */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Submission Requirements</h3>
          <div className="text-sm text-gray-600">
            {submissionType === 'file' && (
              <p>• File upload required</p>
            )}
            {submissionType === 'text' && (
              <p>• Text entry required</p>
            )}
            {submissionType === 'both' && (
              <>
                <p>• File upload and/or text entry accepted</p>
              </>
            )}
          </div>
        </div>

        {/* Evaluation Type Badge */}
        {content.evaluation_type && (
          <div className="mt-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              content.evaluation_type === 'of' 
                ? 'bg-success-100 text-success-700' 
                : content.evaluation_type === 'for'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {content.evaluation_type === 'of' && '✓ Counts toward grade (OF Learning)'}
              {content.evaluation_type === 'for' && 'Practice (FOR Learning)'}
              {content.evaluation_type === 'as' && 'Self-assessment (AS Learning)'}
            </span>
          </div>
        )}
      </div>

      {/* Grade Display (if graded) */}
      {grade && (
        <div className="card p-6 bg-success-50 border-success-200">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-success-800 mb-1">Your Grade</h3>
              <div className="text-3xl font-bold text-success-700">
                {grade.total_score}/{grade.max_score}
                <span className="text-lg ml-2">
                  ({Math.round((grade.total_score / grade.max_score) * 100)}%)
                </span>
              </div>
            </div>
            <div className="text-right text-sm text-success-600">
              Graded {formatDate(grade.graded_at)}
            </div>
          </div>

          {/* Category Breakdown */}
          {grade.category_scores && (
            <div className="mt-4 pt-4 border-t border-success-200">
              <h4 className="text-sm font-medium text-success-800 mb-2">Category Breakdown</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(grade.category_scores).map(([key, score]) => {
                  const maxScore = content.category_weights?.[key]
                  const label = key === 'ku' ? 'Knowledge & Understanding' : 
                    key.charAt(0).toUpperCase() + key.slice(1)
                  return score !== undefined && score !== null && (
                    <div key={key} className="flex justify-between text-success-700">
                      <span>{label}:</span>
                      <span className="font-medium">{score}{maxScore ? `/${maxScore}` : ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Feedback */}
          {grade.feedback && (
            <div className="mt-4 pt-4 border-t border-success-200">
              <h4 className="text-sm font-medium text-success-800 mb-2">Feedback</h4>
              <p className="text-success-700 bg-white/50 rounded p-3">{grade.feedback}</p>
            </div>
          )}
        </div>
      )}

      {/* Submission Status / Form */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Your Submission</h3>
          {latestSubmission && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {showHistory ? 'Hide History' : `View History (${allSubmissions.length})`}
            </button>
          )}
        </div>

        {/* Latest Submission */}
        {latestSubmission && !showSubmissionForm ? (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border ${
              latestSubmission.is_late 
                ? 'bg-yellow-50 border-yellow-200' 
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      Submission #{latestSubmission.version}
                    </span>
                    {latestSubmission.is_late && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                        LATE
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Submitted {formatDate(latestSubmission.submitted_at)}
                  </p>
                </div>
              </div>

              {/* Show submission content */}
              {(latestSubmission.submission_data?.file_path || latestSubmission.submission_data?.file_url) && (
                <SubmissionFileLink 
                  submissionData={latestSubmission.submission_data}
                  formatFileSize={formatFileSize}
                />
              )}

              {latestSubmission.submission_data?.text_content && (
                <div className="mt-3 p-3 bg-white rounded border">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {latestSubmission.submission_data.text_content.substring(0, 500)}
                    {latestSubmission.submission_data.text_content.length > 500 && '...'}
                  </p>
                </div>
              )}
            </div>

            {/* Resubmit Button */}
            <button
              onClick={() => setShowSubmissionForm(true)}
              className="btn btn-secondary w-full"
            >
              Submit New Version
            </button>
          </div>
        ) : showSubmissionForm || !latestSubmission ? (
          /* Submission Form */
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-error-50 border border-error-200 text-error-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* File Upload */}
            {(submissionType === 'file' || submissionType === 'both') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File {submissionType === 'file' && '*'}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary-400 transition-colors">
                  {submissionFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-2xl">📎</span>
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{submissionFile.name}</p>
                        <p className="text-sm text-gray-500">{formatFileSize(submissionFile.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSubmissionFile(null)}
                        className="ml-4 text-gray-400 hover:text-error-600"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <svg className="w-10 h-10 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-600">
                        <span className="text-primary-600 font-medium">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Max file size: 50MB</p>
                      <input
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Text Entry */}
            {(submissionType === 'text' || submissionType === 'both') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Text Entry {submissionType === 'text' && '*'}
                </label>
                <textarea
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  rows={8}
                  className="input"
                  placeholder="Type your submission here..."
                />
              </div>
            )}

            {/* Submit Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn btn-success flex-1 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Submit Assignment
                  </>
                )}
              </button>
              {latestSubmission && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSubmissionForm(false)
                    setSubmissionText('')
                    setSubmissionFile(null)
                    setError(null)
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              )}
            </div>

            {isPastDue && (
              <p className="text-center text-sm text-yellow-600">
                Note: Submitting after the due date will be marked as late.
              </p>
            )}
          </div>
        ) : null}

        {/* Submission History */}
        {showHistory && allSubmissions.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="font-medium text-gray-900 mb-4">Submission History</h4>
            <div className="space-y-3">
              {allSubmissions.map((sub) => (
                <div 
                  key={sub.id} 
                  className={`p-3 rounded-lg border ${
                    sub.is_late ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        Version {sub.version}
                      </span>
                      {sub.is_late && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                          LATE
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDate(sub.submitted_at)}
                    </span>
                  </div>
                  {sub.submission_data?.file_name && (
                    <p className="text-sm text-gray-600 mt-1">
                      📎 {sub.submission_data.file_name}
                    </p>
                  )}
                  {sub.submission_data?.text_content && (
                    <p className="text-sm text-gray-600 mt-1 truncate">
                      📝 {sub.submission_data.text_content.substring(0, 100)}...
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mark Complete Button (only if submitted) */}
      {latestSubmission && !isCompleted && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-blue-900">Submission received!</h3>
              <p className="text-sm text-blue-700">
                Your work has been submitted and is pending review.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * SubmissionFileLink - Component to view submission files with signed URLs
 */
function SubmissionFileLink({ submissionData, formatFileSize }) {
  const [loading, setLoading] = useState(false)

  const handleViewFile = async () => {
    setLoading(true)
    try {
      let storagePath = submissionData.file_path
      
      // If no file_path but has file_url (legacy), extract path from URL
      if (!storagePath && submissionData.file_url) {
        if (submissionData.file_url.startsWith('http')) {
          const match = submissionData.file_url.match(/\/storage\/v1\/object\/public\/course-content\/(.+)$/)
          if (match) {
            storagePath = match[1]
          } else {
            // Can't extract path, try legacy URL directly
            window.open(submissionData.file_url, '_blank')
            setLoading(false)
            return
          }
        } else {
          storagePath = submissionData.file_url
        }
      }

      if (storagePath) {
        // Generate signed URL for private bucket
        const { data, error } = await getSubmissionSignedUrl(storagePath, 3600)
        if (error) {
          console.error('Error generating signed URL:', error)
          alert('Unable to view file. Please try again.')
          return
        }
        window.open(data.signedUrl, '_blank')
      }
    } catch (err) {
      console.error('Error viewing file:', err)
      alert('Unable to view file. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 flex items-center gap-2 p-2 bg-white rounded border">
      <span className="text-2xl">📎</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">
          {submissionData.file_name}
        </p>
        <p className="text-xs text-gray-500">
          {formatFileSize(submissionData.file_size)}
        </p>
      </div>
      <button
        onClick={handleViewFile}
        disabled={loading}
        className="text-primary-600 hover:text-primary-700 text-sm font-medium disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'View'}
      </button>
    </div>
  )
}
