/**
 * Offline-capable wrapper for API calls
 * Provides Network-First strategy with IndexedDB fallback
 */

import * as offlineDb from './offlineDb'

/**
 * Execute an API call with offline fallback
 * @param {Object} options - Configuration options
 * @param {Function} options.apiCall - The API function to call
 * @param {Function} options.getCached - Function to get cached data from IndexedDB
 * @param {Function} options.setCached - Function to cache data to IndexedDB
 * @param {boolean} options.forceRefresh - Force network fetch even if cached data exists
 * @returns {Object} - { data, error, isFromCache }
 */
export async function withOfflineSupport({ 
  apiCall, 
  getCached, 
  setCached, 
  forceRefresh = false 
}) {
  const isOnline = navigator.onLine

  // If online, try network first
  if (isOnline) {
    try {
      const { data, error } = await apiCall()
      
      if (!error && data && setCached) {
        // Cache the fresh data
        try {
          await setCached(data)
        } catch (cacheError) {
          console.warn('Failed to cache data:', cacheError)
        }
      }
      
      return { data, error, isFromCache: false }
    } catch (networkError) {
      console.warn('Network request failed, falling back to cache:', networkError)
      // Fall through to cache
    }
  }

  // Offline or network failed - try cache
  if (getCached) {
    try {
      const cachedData = await getCached()
      if (cachedData) {
        return { 
          data: cachedData, 
          error: null, 
          isFromCache: true 
        }
      }
    } catch (cacheError) {
      console.warn('Failed to retrieve cached data:', cacheError)
    }
  }

  // No cache available
  return { 
    data: null, 
    error: new Error('No internet connection and no cached data available'), 
    isFromCache: false 
  }
}

/**
 * Fetch courses with offline support for a teacher
 */
export async function fetchTeacherCoursesOffline(teacherId, apiCall) {
  return withOfflineSupport({
    apiCall,
    getCached: () => offlineDb.getCachedCoursesByTeacher(teacherId),
    setCached: (data) => offlineDb.cacheCourses(data)
  })
}

/**
 * Fetch a single course with offline support
 */
export async function fetchCourseOffline(courseId, apiCall) {
  return withOfflineSupport({
    apiCall,
    getCached: () => offlineDb.getCachedCourse(courseId),
    setCached: (data) => offlineDb.cacheCourse(data)
  })
}

/**
 * Fetch course modules with offline support
 */
export async function fetchModulesOffline(courseId, apiCall) {
  return withOfflineSupport({
    apiCall,
    getCached: () => offlineDb.getCachedModulesByCourse(courseId),
    setCached: (data) => offlineDb.cacheModules(data)
  })
}

/**
 * Fetch enrollments with offline support
 */
export async function fetchEnrollmentsOffline(studentId, apiCall) {
  return withOfflineSupport({
    apiCall,
    getCached: () => offlineDb.getCachedEnrollmentsByStudent(studentId),
    setCached: (data) => offlineDb.cacheEnrollments(data)
  })
}

/**
 * Submit assignment with offline queuing
 * @param {Object} submission - The submission data
 * @param {Function} apiCall - The API function to submit
 * @returns {Object} - { data, error, queued }
 */
export async function submitAssignmentOffline(submission, apiCall) {
  const isOnline = navigator.onLine

  if (isOnline) {
    try {
      const { data, error } = await apiCall()
      
      if (!error && data) {
        return { data, error: null, queued: false }
      }
      
      // API error but online - don't queue, return error
      if (error) {
        return { data: null, error, queued: false }
      }
    } catch (networkError) {
      console.warn('Network error during submission, queueing...', networkError)
      // Fall through to queue
    }
  }

  // Offline or network failed - queue submission
  try {
    const id = await offlineDb.addPendingSubmission({
      assignment_id: submission.assignmentId,
      student_id: submission.studentId,
      submission_data: submission.data,
      due_date: submission.dueDate
    })
    
    return { 
      data: { id, queued: true }, 
      error: null, 
      queued: true 
    }
  } catch (queueError) {
    return { 
      data: null, 
      error: queueError, 
      queued: false 
    }
  }
}

/**
 * Cache content item (syllabus, reading, video info) for offline viewing
 */
export async function cacheContentForOffline(content) {
  try {
    await offlineDb.cacheContent(content)
    return { success: true }
  } catch (error) {
    console.warn('Failed to cache content:', error)
    return { success: false, error }
  }
}

/**
 * Get cached content by ID
 */
export async function getCachedContent(contentId) {
  try {
    return await offlineDb.getCachedContent(contentId)
  } catch (error) {
    console.warn('Failed to get cached content:', error)
    return null
  }
}

export default withOfflineSupport
