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
  const TIMEOUT_MS = 30000 // 30 seconds (increased for slow connections)
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Request timed out after 30s. Please check your internet connection and try again.'))
    }, TIMEOUT_MS)
  })

  const createPromise = (async () => {
    try {
      console.log('[createCourse] Starting...')
      console.log('[createCourse] teacher_id:', teacherId)
      
      // Skip session validation since we already have the user - go straight to insert
      // The RLS policies will validate the user anyway
      console.log('[createCourse] Sending insert request to Supabase...')
      const startTime = Date.now()
      
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

      const elapsed = Date.now() - startTime
      console.log(`[createCourse] Supabase responded in ${elapsed}ms`)

      if (error) {
        console.error('[createCourse] Supabase error:', error)
        console.error('[createCourse] Error code:', error.code)
        console.error('[createCourse] Error message:', error.message)
        console.error('[createCourse] Error details:', error.details)
        console.error('[createCourse] Error hint:', error.hint)
        
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
        console.error('[createCourse] No data returned - possible RLS issue')
        return { 
          data: null, 
          error: { message: 'Course creation failed. This may be a permissions issue.' } 
        }
      }

      console.log('[createCourse] Success! Course ID:', data.id)
      return { data, error: null }
    } catch (err) {
      console.error('[createCourse] Exception:', err)
      return { data: null, error: { message: err.message || 'Network error or service unavailable' } }
    }
  })()

  try {
    return await Promise.race([createPromise, timeoutPromise])
  } catch (err) {
    console.error('[createCourse] Timed out or failed:', err)
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
