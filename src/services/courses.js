import { supabase } from './supabase'

/**
 * Get all courses for a teacher
 */
export async function getTeacherCourses(teacherId) {
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
}

/**
 * Get a single course by ID
 */
export async function getCourse(courseId) {
  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      teacher:profiles!courses_teacher_id_fkey(id, full_name)
    `)
    .eq('id', courseId)
    .single()

  return { data, error }
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
 * Get modules for a course
 */
export async function getCourseModules(courseId) {
  const { data, error } = await supabase
    .from('modules')
    .select(`
      *,
      content:content(*)
    `)
    .eq('course_id', courseId)
    .order('order_index', { ascending: true })

  return { data, error }
}
