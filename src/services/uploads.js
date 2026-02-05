import * as tus from 'tus-js-client'
import { supabase } from './supabase'

// File validation constants
export const FILE_LIMITS = {
  reading: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['.pdf', '.doc', '.docx'],
    label: 'PDF or Word document'
  },
  video: {
    maxSize: 2 * 1024 * 1024 * 1024, // 2GB
    allowedTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'],
    extensions: ['.mp4', '.mov', '.webm', '.avi'],
    label: 'MP4, MOV, WebM, or AVI video'
  },
  // Assignment attachments - supports both documents and videos for worksheets, instructions, etc.
  assignment_document: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/jpeg', 'image/png', 'image/gif'],
    extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif'],
    label: 'PDF, Word, Excel, PowerPoint, or image file'
  },
  assignment_video: {
    maxSize: 2 * 1024 * 1024 * 1024, // 2GB
    allowedTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'],
    extensions: ['.mp4', '.mov', '.webm', '.avi'],
    label: 'MP4, MOV, WebM, or AVI video'
  }
}

// Chunk size for resumable uploads (10MB)
const CHUNK_SIZE = 10 * 1024 * 1024

/**
 * Validate file before upload
 * @param {File} file - The file to validate
 * @param {'reading' | 'video'} contentType - The type of content
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFile(file, contentType) {
  const limits = FILE_LIMITS[contentType]
  
  if (!limits) {
    return { valid: false, error: 'Invalid content type' }
  }

  // Check file size
  if (file.size > limits.maxSize) {
    const maxSizeMB = limits.maxSize / (1024 * 1024)
    const maxSizeFormatted = maxSizeMB >= 1024 ? `${maxSizeMB / 1024}GB` : `${maxSizeMB}MB`
    return { 
      valid: false, 
      error: `File size exceeds the maximum limit of ${maxSizeFormatted}` 
    }
  }

  // Check file type
  if (!limits.allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: `Invalid file type. Please upload a ${limits.label}` 
    }
  }

  // Check extension as fallback
  const ext = '.' + file.name.split('.').pop().toLowerCase()
  if (!limits.extensions.includes(ext)) {
    return { 
      valid: false, 
      error: `Invalid file extension. Allowed: ${limits.extensions.join(', ')}` 
    }
  }

  return { valid: true }
}

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Generate storage path for file
 * @param {string} courseId - Course UUID
 * @param {string} fileId - Unique file identifier
 * @param {string} fileName - Original file name
 * @returns {string} Storage path
 */
export function generateStoragePath(courseId, fileId, fileName) {
  const ext = fileName.split('.').pop()
  return `courses/${courseId}/content/${fileId}.${ext}`
}

/**
 * Create an incomplete upload record for tracking
 * @param {string} courseId - Course UUID
 * @param {string} filePath - Storage file path
 * @param {File} file - The file being uploaded
 * @param {string} uploadId - TUS upload ID
 */
export async function createIncompleteUpload(courseId, filePath, file, uploadId = null) {
  const { data, error } = await supabase
    .from('incomplete_uploads')
    .insert({
      course_id: courseId,
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      upload_id: uploadId
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Remove incomplete upload record (called after successful upload)
 * @param {string} filePath - Storage file path
 */
export async function removeIncompleteUpload(filePath) {
  const { error } = await supabase
    .from('incomplete_uploads')
    .delete()
    .eq('file_path', filePath)

  return { error }
}

/**
 * Upload file using standard Supabase Storage (for smaller files)
 * @param {File} file - The file to upload
 * @param {string} path - Storage path
 * @param {function} onProgress - Progress callback (percentage: number)
 * @returns {Promise<{ data: { path: string }, error: any }>}
 */
export async function uploadFileStandard(file, path, onProgress) {
  try {
    // For smaller files, use standard upload with XMLHttpRequest for progress
    const { data, error } = await supabase.storage
      .from('course-content')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true
      })

    if (error) {
      return { data: null, error }
    }

    // For standard uploads, we'll simulate progress at 100%
    if (onProgress) {
      onProgress(100)
    }

    // Return the storage path - signed URLs will be generated on-demand when viewing
    return {
      data: {
        path: data.path
      },
      error: null
    }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Upload file using TUS protocol for resumable uploads (for larger files)
 * @param {File} file - The file to upload
 * @param {string} path - Storage path
 * @param {string} courseId - Course ID for tracking
 * @param {object} callbacks - Callback functions
 * @param {function} callbacks.onProgress - Progress callback (percentage: number, bytesUploaded: number, bytesTotal: number)
 * @param {function} callbacks.onError - Error callback (error: Error)
 * @param {function} callbacks.onSuccess - Success callback ({ path: string, url: string })
 * @returns {{ upload: tus.Upload, abort: function }} Upload instance and abort function
 */
export function uploadFileTus(file, path, courseId, callbacks = {}) {
  const { onProgress, onError, onSuccess } = callbacks

  // Get Supabase session for auth
  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      authorization: `Bearer ${session?.access_token}`,
      'x-upsert': 'true'
    }
  }

  let upload = null

  const startUpload = async () => {
    const headers = await getAuthHeaders()
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

    upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      headers,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: CHUNK_SIZE,
      metadata: {
        bucketName: 'course-content',
        objectName: path,
        contentType: file.type,
        cacheControl: '3600'
      },
      onError: async (error) => {
        console.error('TUS upload error:', error)
        if (onError) {
          onError(error)
        }
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = Math.round((bytesUploaded / bytesTotal) * 100)
        if (onProgress) {
          onProgress(percentage, bytesUploaded, bytesTotal)
        }
      },
      onSuccess: async () => {
        // Remove incomplete upload record
        await removeIncompleteUpload(path)

        // Return the storage path - signed URLs will be generated on-demand when viewing
        if (onSuccess) {
          onSuccess({
            path
          })
        }
      }
    })

    // Create incomplete upload record for cleanup
    await createIncompleteUpload(courseId, path, file, null)

    // Check for previous uploads to resume
    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0])
      }
      upload.start()
    })
  }

  startUpload()

  return {
    upload,
    abort: () => {
      if (upload) {
        upload.abort()
      }
    }
  }
}

/**
 * Smart upload function that chooses the best upload method based on file size
 * @param {File} file - The file to upload
 * @param {string} courseId - Course ID
 * @param {string} contentId - Content ID for the file name
 * @param {'reading' | 'video'} contentType - Type of content
 * @param {object} callbacks - Callback functions
 * @returns {{ abort?: function }}
 */
export function uploadFile(file, courseId, contentId, contentType, callbacks = {}) {
  const { onProgress, onError, onSuccess } = callbacks

  // Validate file first
  const validation = validateFile(file, contentType)
  if (!validation.valid) {
    if (onError) {
      onError(new Error(validation.error))
    }
    return {}
  }

  // Generate storage path
  const path = generateStoragePath(courseId, contentId, file.name)

  // Use TUS for files larger than 50MB, standard upload otherwise
  const useTus = file.size > 50 * 1024 * 1024

  if (useTus) {
    return uploadFileTus(file, path, courseId, callbacks)
  } else {
    // Standard upload
    uploadFileStandard(file, path, onProgress)
      .then(({ data, error }) => {
        if (error) {
          if (onError) onError(error)
        } else {
          if (onSuccess) onSuccess(data)
        }
      })
      .catch((err) => {
        if (onError) onError(err)
      })

    return {}
  }
}

/**
 * Delete a file from storage
 * @param {string} path - Storage path
 */
export async function deleteFile(path) {
  const { error } = await supabase.storage
    .from('course-content')
    .remove([path])

  return { error }
}

/**
 * Get signed URL for a file (for private access)
 * @param {string} path - Storage path
 * @param {number} expiresIn - Expiry time in seconds (default: 1 hour)
 */
export async function getSignedUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from('course-content')
    .createSignedUrl(path, expiresIn)

  return { data, error }
}

/**
 * Get public URL for a file
 * @param {string} path - Storage path
 */
export function getPublicUrl(path) {
  const { data } = supabase.storage
    .from('course-content')
    .getPublicUrl(path)

  return data.publicUrl
}
