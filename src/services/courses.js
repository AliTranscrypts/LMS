import { supabase } from './supabase'
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
 * Create a new course
 */
export async function createCourse(teacherId, courseData) {
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

  return { data, error }
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
