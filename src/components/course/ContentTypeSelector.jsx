import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import FileUpload from '../common/FileUpload'

const CONTENT_TYPES = [
  {
    id: 'reading',
    name: 'Reading',
    icon: '📄',
    description: 'PDF or document for students to read',
    color: 'bg-blue-100 text-blue-700',
    requiresFile: true
  },
  {
    id: 'video',
    name: 'Video',
    icon: '🎥',
    description: 'Video lecture or tutorial',
    color: 'bg-purple-100 text-purple-700',
    requiresFile: true
  },
  {
    id: 'assignment',
    name: 'Assignment',
    icon: '📝',
    description: 'Task requiring student submission',
    color: 'bg-green-100 text-green-700',
    requiresFile: false
  },
  {
    id: 'quiz',
    name: 'Quiz',
    icon: '❓',
    description: 'Assessment with auto-grading',
    color: 'bg-orange-100 text-orange-700',
    requiresFile: false
  }
]

/**
 * ContentTypeSelector - Modal for selecting content type when adding new content
 */
export default function ContentTypeSelector({ isOpen, onClose, onSelect }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Content">
      <p className="text-gray-600 mb-6">
        Select the type of content you want to add to this module.
      </p>
      
      <div className="grid grid-cols-2 gap-4">
        {CONTENT_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => {
              onSelect(type.id)
              onClose()
            }}
            className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors text-center"
          >
            <span className={`text-3xl mb-2 w-14 h-14 rounded-full ${type.color} flex items-center justify-center`}>
              {type.icon}
            </span>
            <span className="font-semibold text-gray-900 mb-1">{type.name}</span>
            <span className="text-xs text-gray-500">{type.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

/**
 * ContentForm - Form for creating/editing content based on type
 */
export function ContentForm({ type, courseId, onSubmit, onCancel, initialData = {} }) {
  const [name, setName] = useState(initialData.name || '')
  const [description, setDescription] = useState(initialData.description || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [contentId] = useState(() => crypto.randomUUID())

  // File upload state (for reading/video)
  const [fileData, setFileData] = useState(null)
  const [uploadComplete, setUploadComplete] = useState(false)

  // Assignment-specific fields
  const [submissionType, setSubmissionType] = useState(initialData.submission_type || 'file')
  const [dueDate, setDueDate] = useState(initialData.due_date ? initialData.due_date.split('T')[0] : '')
  const [totalPoints, setTotalPoints] = useState(initialData.total_points || 100)
  const [evaluationType, setEvaluationType] = useState(initialData.evaluation_type || 'of')
  const [categoryWeights, setCategoryWeights] = useState(initialData.category_weights || {
    ku: 25,
    thinking: 25,
    application: 25,
    communication: 25
  })

  const totalWeight = Object.values(categoryWeights).reduce((a, b) => a + b, 0)
  const isValidWeight = totalWeight === 100

  const contentTypeInfo = CONTENT_TYPES.find(t => t.id === type)
  const requiresFile = contentTypeInfo?.requiresFile

  const handleFileUploadComplete = (data) => {
    setFileData(data)
    setUploadComplete(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter a name')
      return
    }

    // Validate file upload for reading/video
    if (requiresFile && !uploadComplete) {
      setError('Please upload a file before creating this content')
      return
    }

    if ((type === 'assignment' || type === 'quiz') && !isValidWeight) {
      setError('Category weights must sum to 100%')
      return
    }

    setLoading(true)

    const contentData = {
      type,
      name: name.trim(),
      description: description.trim() || null
    }

    // Add file data for reading/video
    if (requiresFile && fileData) {
      contentData.fileUrl = fileData.url
      contentData.fileSize = fileData.fileSize
      contentData.fileType = fileData.fileType
    }

    // Add assignment-specific fields
    if (type === 'assignment' || type === 'quiz') {
      contentData.submissionType = submissionType
      contentData.dueDate = dueDate ? new Date(dueDate).toISOString() : null
      contentData.totalPoints = parseInt(totalPoints)
      contentData.evaluationType = evaluationType
      contentData.categoryWeights = categoryWeights
    }

    const result = await onSubmit(contentData)

    if (result?.error) {
      setError(result.error)
    }
    setLoading(false)
  }

  const handleWeightChange = (category, value) => {
    setCategoryWeights(prev => ({
      ...prev,
      [category]: parseInt(value) || 0
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-error-50 border border-error-500 text-error-600 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Content Type Badge */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
        <span className="text-2xl">{contentTypeInfo?.icon}</span>
        <div>
          <span className="font-medium text-gray-900">{contentTypeInfo?.name}</span>
          <p className="text-xs text-gray-500">{contentTypeInfo?.description}</p>
        </div>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="contentName" className="label">Name *</label>
        <input
          id="contentName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder={`e.g., ${type === 'reading' ? 'Chapter 1 Reading' : type === 'video' ? 'Lecture Video' : type === 'assignment' ? 'Practice Problems' : 'Unit Quiz'}`}
          required
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="contentDescription" className="label">Description</label>
        <textarea
          id="contentDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input"
          rows={2}
          placeholder="Brief description or instructions..."
        />
      </div>

      {/* Assignment/Quiz specific fields */}
      {(type === 'assignment' || type === 'quiz') && (
        <>
          {/* Submission Type (Assignment only) */}
          {type === 'assignment' && (
            <div>
              <label className="label">Submission Type</label>
              <div className="flex gap-4 mt-1">
                {[
                  { value: 'file', label: 'File Upload' },
                  { value: 'text', label: 'Text Entry' },
                  { value: 'both', label: 'Both' }
                ].map(option => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="submissionType"
                      value={option.value}
                      checked={submissionType === option.value}
                      onChange={(e) => setSubmissionType(e.target.value)}
                      className="text-primary-600"
                    />
                    <span className="text-sm text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Due Date */}
          <div>
            <label htmlFor="dueDate" className="label">Due Date (optional)</label>
            <input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input"
            />
          </div>

          {/* Total Points */}
          <div>
            <label htmlFor="totalPoints" className="label">Total Points</label>
            <input
              id="totalPoints"
              type="number"
              min="1"
              value={totalPoints}
              onChange={(e) => setTotalPoints(e.target.value)}
              className="input w-32"
            />
          </div>

          {/* Evaluation Type */}
          <div>
            <label className="label">Evaluation Type</label>
            <p className="text-xs text-gray-500 mb-2">
              Only "OF Learning" assignments count toward the final grade.
            </p>
            <div className="flex gap-4">
              {[
                { value: 'for', label: 'FOR Learning', desc: 'Diagnostic' },
                { value: 'as', label: 'AS Learning', desc: 'Practice' },
                { value: 'of', label: 'OF Learning', desc: 'Counts toward grade' }
              ].map(option => (
                <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="evaluationType"
                    value={option.value}
                    checked={evaluationType === option.value}
                    onChange={(e) => setEvaluationType(e.target.value)}
                    className="text-primary-600"
                  />
                  <span className="text-sm">
                    <span className="text-gray-900 font-medium">{option.label}</span>
                    <span className="text-gray-500 ml-1">({option.desc})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Category Weights */}
          <div>
            <label className="label">Category Weights (must total 100%)</label>
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
                    value={categoryWeights[key]}
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
        </>
      )}

      {/* File Upload for reading/video */}
      {requiresFile && courseId && (
        <div>
          <label className="label">
            {type === 'reading' ? 'Upload Document' : 'Upload Video'} *
          </label>
          <FileUpload
            contentType={type}
            courseId={courseId}
            contentId={contentId}
            onUploadComplete={handleFileUploadComplete}
            onUploadError={(err) => setError(err.message)}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading || ((type === 'assignment' || type === 'quiz') && !isValidWeight) || (requiresFile && !uploadComplete)}
          className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create Content'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
