import { useState, useRef, useCallback } from 'react'
import { uploadFile, validateFile, formatFileSize, FILE_LIMITS } from '../../services/uploads'

/**
 * FileUpload - Reusable file upload component with progress bar and retry functionality
 * 
 * @param {Object} props
 * @param {'reading' | 'video'} props.contentType - Type of content being uploaded
 * @param {string} props.courseId - Course ID for storage path
 * @param {string} props.contentId - Content ID for storage path
 * @param {function} props.onUploadComplete - Callback when upload completes successfully
 * @param {function} props.onUploadError - Optional callback when upload fails
 * @param {string} props.existingFileUrl - Optional existing file URL to display
 * @param {string} props.existingFileName - Optional existing file name
 */
export default function FileUpload({
  contentType,
  courseId,
  contentId,
  onUploadComplete,
  onUploadError,
  existingFileUrl,
  existingFileName
}) {
  const [file, setFile] = useState(null)
  const [uploadState, setUploadState] = useState('idle') // idle, validating, uploading, success, error
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState(existingFileUrl || '')
  const [uploadedFileName, setUploadedFileName] = useState(existingFileName || '')
  
  const fileInputRef = useRef(null)
  const uploadAbortRef = useRef(null)

  const limits = FILE_LIMITS[contentType]

  const handleFileSelect = useCallback((e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setError('')
    setUploadState('validating')
    setFile(selectedFile)

    // Validate file
    const validation = validateFile(selectedFile, contentType)
    if (!validation.valid) {
      setError(validation.error)
      setUploadState('error')
      return
    }

    setUploadState('idle')
  }, [contentType])

  const handleUpload = useCallback(() => {
    if (!file || !courseId || !contentId) {
      setError('Missing required information for upload')
      return
    }

    setUploadState('uploading')
    setProgress(0)
    setError('')

    const { abort } = uploadFile(file, courseId, contentId, contentType, {
      onProgress: (percentage, bytesUploaded, bytesTotal) => {
        setProgress(percentage)
      },
      onError: (err) => {
        setUploadState('error')
        setError(err.message || 'Upload failed. Please try again.')
        if (onUploadError) {
          onUploadError(err)
        }
      },
      onSuccess: (data) => {
        setUploadState('success')
        setProgress(100)
        setUploadedUrl(data.path) // Store path for display purposes
        setUploadedFileName(file.name)
        if (onUploadComplete) {
          onUploadComplete({
            path: data.path,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type
          })
        }
      }
    })

    uploadAbortRef.current = abort
  }, [file, courseId, contentId, contentType, onUploadComplete, onUploadError])

  const handleRetry = useCallback(() => {
    if (file) {
      handleUpload()
    } else {
      setUploadState('idle')
      setError('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [file, handleUpload])

  const handleCancel = useCallback(() => {
    if (uploadAbortRef.current) {
      uploadAbortRef.current()
    }
    setUploadState('idle')
    setProgress(0)
    setFile(null)
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleRemoveFile = useCallback(() => {
    setFile(null)
    setUploadState('idle')
    setProgress(0)
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      // Simulate file input change
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(droppedFile)
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files
        handleFileSelect({ target: { files: dataTransfer.files } })
      }
    }
  }, [handleFileSelect])

  // Already uploaded state
  if (uploadedUrl && uploadState !== 'uploading') {
    return (
      <div className="border-2 border-success-200 bg-success-50 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-success-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{uploadedFileName || 'File uploaded'}</p>
            <p className="text-sm text-success-600">Upload complete</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setUploadedUrl('')
              setUploadedFileName('')
              setFile(null)
              setUploadState('idle')
            }}
            className="text-gray-400 hover:text-gray-600"
            title="Replace file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          uploadState === 'error' 
            ? 'border-error-300 bg-error-50' 
            : uploadState === 'uploading'
            ? 'border-primary-300 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        }`}
      >
        {uploadState === 'uploading' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
            <p className="font-medium text-gray-900">{file?.name}</p>
            <div className="w-full max-w-xs mx-auto">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              {file && (
                <p className="text-xs text-gray-500 mt-2">
                  {formatFileSize(file.size * (progress / 100))} of {formatFileSize(file.size)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-error-600 hover:text-error-700"
            >
              Cancel upload
            </button>
          </div>
        ) : file && uploadState !== 'error' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">
                {contentType === 'video' ? '🎥' : '📄'}
              </span>
              <p className="font-medium text-gray-900">{file.name}</p>
            </div>
            <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={handleUpload}
                className="btn btn-primary"
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="btn btn-secondary"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-primary-600 hover:text-primary-700 font-medium">
                  Click to upload
                </span>
                <span className="text-gray-600"> or drag and drop</span>
              </label>
              <input
                ref={fileInputRef}
                id="file-upload"
                type="file"
                accept={limits?.extensions?.join(',')}
                onChange={handleFileSelect}
                className="sr-only"
              />
            </div>
            <p className="text-xs text-gray-500">
              {limits?.label} (max {formatFileSize(limits?.maxSize)})
            </p>
          </div>
        )}
      </div>

      {/* Error state with retry */}
      {uploadState === 'error' && error && (
        <div className="bg-error-50 border border-error-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-error-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-error-800">Upload failed</p>
              <p className="text-sm text-error-600 mt-1">{error}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="btn bg-error-600 text-white hover:bg-error-700 text-sm"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="btn btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
