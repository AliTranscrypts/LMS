import { supabase, ensureValidSession } from './supabase'
import * as offlineDb from './offlineDb'
import { withOfflineSupport } from './offlineWrapper'

/**
 * Get all courses for a teacher (with offline support)
 */
export async function getTeacherCourses(teacherId) {
  return withOfflineSupport({
    apiCall: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          modules:modules(count),
          enrollments:enrollments(count)
        `)
        .eq('teacher_id', teacherId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
      return { data, error }
    },
    getCached: () => offlineDb.getCachedCoursesByTeacher(teacherId),
    setCached: (data) => offlineDb.cacheCourses(data)
  })
}

/**
 * Get a single course by ID (with offline support)
 */
export async function getCourse(courseId) {
  return withOfflineSupport({
    apiCall: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          teacher:profiles!courses_teacher_id_fkey(id, full_name)
        `)
        .eq('id', courseId)
        .single()
      return { data, error }
    },
    getCached: () => offlineDb.getCachedCourse(courseId),
    setCached: (data) => offlineDb.cacheCourse(data)
  })
}

/**
 * Create a new course with timeout handling and session validation
 */
export async function createCourse(teacherId, courseData) {
  // Add a timeout to prevent indefinite hanging
  const TIMEOUT_MS = 15000 // 15 seconds
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Request timed out. Please check your connection and try again.'))
    }, TIMEOUT_MS)
  })

  const createPromise = (async () => {
    try {
      console.log('Creating course with teacher_id:', teacherId)
      console.log('Course data:', JSON.stringify(courseData, null, 2))
      
      // Ensure we have a valid session before making the request
      const sessionCheck = await ensureValidSession()
      if (!sessionCheck.valid) {
        console.error('Session validation failed:', sessionCheck.error)
        return { 
          data: null, 
          error: { message: 'Your session has expired. Please refresh the page and sign in again.' } 
        }
      }
      console.log('Session valid, user:', sessionCheck.session?.user?.id)
      
      // Verify the session user matches the teacher ID
      if (sessionCheck.session?.user?.id !== teacherId) {
        console.error('Session user ID mismatch:', sessionCheck.session?.user?.id, '!==', teacherId)
        return {
          data: null,
          error: { message: 'Authentication mismatch. Please sign out and sign in again.' }
        }
      }
      
      const { data, error } = await supabase
        .from('courses')
        .insert({
          teacher_id: teacherId,
          name: courseData.name,
          description: courseData.description,
          syllabus: courseData.syllabus,
          category_weights: courseData.categoryWeights || {
            ku: 25,
            thinking: 25,
            application: 25,
            communication: 25
          }
        })
        .select()
        .single()

      if (error) {
        console.error('Supabase createCourse error:', error)
        console.error('Error code:', error.code)
        console.error('Error message:', error.message)
        console.error('Error details:', error.details)
        console.error('Error hint:', error.hint)
        
        // Provide more helpful error messages for common issues
        if (error.code === '42501' || error.message?.includes('permission')) {
          return { 
            data: null, 
            error: { message: 'Permission denied. Please ensure your account has teacher privileges.' } 
          }
        }
        if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
          return { 
            data: null, 
            error: { message: 'Authentication error. Please sign out and sign in again.' } 
          }
        }
        
        return { data: null, error }
      }

      if (!data) {
        console.error('No data returned from createCourse - possible RLS issue')
        return { 
          data: null, 
          error: { message: 'Course creation failed. This may be a permissions issue - please ensure your profile has teacher role.' } 
        }
      }

      console.log('Course created successfully:', data.id)
      return { data, error: null }
    } catch (err) {
      console.error('Unexpected error in createCourse:', err)
      return { data: null, error: { message: err.message || 'Network error or service unavailable' } }
    }
  })()

  try {
    return await Promise.race([createPromise, timeoutPromise])
  } catch (err) {
    console.error('createCourse timed out or failed:', err)
    return { data: null, error: { message: err.message } }
  }
}

/**
 * Update a course
 */
export async function updateCourse(courseId, updates) {
  const { data, error } = await supabase
    .from('courses')
    .update(updates)
    .eq('id', courseId)
    .select()
    .single()

  return { data, error }
}

/**
 * Archive a course (soft delete)
 */
export async function archiveCourse(courseId) {
  const { data, error } = await supabase
    .from('courses')
    .update({ is_archived: true })
    .eq('id', courseId)
    .select()
    .single()

  return { data, error }
}

/**
 * Get modules for a course (with offline support)
 */
export async function getCourseModules(courseId) {
  return withOfflineSupport({
    apiCall: async () => {
      const { data, error } = await supabase
        .from('modules')
        .select(`
          *,
          content:content(*)
        `)
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })
      return { data, error }
    },
    getCached: async () => {
      const modules = await offlineDb.getCachedModulesByCourse(courseId)
      // Also get cached content for each module
      if (modules && modules.length > 0) {
        for (const module of modules) {
          const content = await offlineDb.getCachedContentByModule(module.id)
          module.content = content || []
        }
      }
      return modules
    },
    setCached: async (data) => {
      // Cache modules
      await offlineDb.cacheModules(data)
      // Cache content items within modules
      const allContent = data.flatMap(m => m.content || [])
      if (allContent.length > 0) {
        await offlineDb.cacheContentItems(allContent)
      }
    }
  })
}
