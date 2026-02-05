import { supabase } from './supabase'
import * as offlineDb from './offlineDb'
import { withOfflineSupport } from './offlineWrapper'

/**
 * Find a student by their unique student ID (STU-xxxxxxxx-xxxx format)
 */
export async function findStudentByStudentId(studentId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, student_id, role')
    .eq('student_id', studentId)
    .eq('role', 'student')
    .single()

  return { data, error }
}

/**
 * Enroll a student in a course
 * @param {string} courseId - The course ID
 * @param {string} studentProfileId - The student's profile ID
 * @param {string|null} termId - Optional term ID for the enrollment
 */
export async function enrollStudent(courseId, studentProfileId, termId = null) {
  const insertData = {
    course_id: courseId,
    student_id: studentProfileId,
  }
  
  // Only include term_id if provided
  if (termId) {
    insertData.term_id = termId
  }

  const { data, error } = await supabase
    .from('enrollments')
    .insert(insertData)
    .select(`
      *,
      student:profiles!enrollments_student_id_fkey(id, full_name, student_id),
      term:terms(id, name)
    `)
    .single()

  return { data, error }
}

/**
 * Remove a student enrollment
 */
export async function unenrollStudent(enrollmentId) {
  const { error } = await supabase
    .from('enrollments')
    .delete()
    .eq('id', enrollmentId)

  return { error }
}

/**
 * Get all enrollments for a course (for teachers - class roster)
 * @param {string} courseId - The course ID
 * @param {string|null} termId - Optional term ID to filter by (null = all terms, 'none' = no term)
 */
export async function getCourseEnrollments(courseId, termId = null) {
  let query = supabase
    .from('enrollments')
    .select(`
      id,
      enrolled_at,
      calculated_grade,
      term_id,
      student:profiles!enrollments_student_id_fkey(
        id,
        full_name,
        student_id
      ),
      term:terms(id, name)
    `)
    .eq('course_id', courseId)

  // Filter by term if specified
  if (termId === 'none') {
    // Filter for enrollments with no term
    query = query.is('term_id', null)
  } else if (termId) {
    // Filter for specific term
    query = query.eq('term_id', termId)
  }
  // If termId is null/undefined, return all enrollments

  const { data, error } = await query.order('enrolled_at', { ascending: true })

  return { data, error }
}

/**
 * Get class roster (names only) - for students viewing other students in the course
 */
export async function getClassRoster(courseId) {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      student:profiles!enrollments_student_id_fkey(
        full_name
      )
    `)
    .eq('course_id', courseId)
    .order('enrolled_at', { ascending: true })

  return { data, error }
}

/**
 * Get all enrollments for a student (their enrolled courses) - with offline support
 */
export async function getStudentEnrollments(studentId) {
  return withOfflineSupport({
    apiCall: async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          enrolled_at,
          calculated_grade,
          course:courses(
            id,
            name,
            description,
            teacher:profiles!courses_teacher_id_fkey(full_name)
          )
        `)
        .eq('student_id', studentId)
        .order('enrolled_at', { ascending: false })
      return { data, error }
    },
    getCached: async () => {
      const enrollments = await offlineDb.getCachedEnrollmentsByStudent(studentId)
      // For each enrollment, try to get cached course data
      if (enrollments && enrollments.length > 0) {
        for (const enrollment of enrollments) {
          if (enrollment.course_id) {
            const course = await offlineDb.getCachedCourse(enrollment.course_id)
            enrollment.course = course || null
          }
        }
      }
      return enrollments
    },
    setCached: async (data) => {
      // Cache enrollments with course_id for reference
      const enrollmentsToCache = data.map(e => ({
        ...e,
        course_id: e.course?.id,
        student_id: studentId
      }))
      await offlineDb.cacheEnrollments(enrollmentsToCache)
      // Also cache the courses
      const courses = data.filter(e => e.course).map(e => e.course)
      if (courses.length > 0) {
        await offlineDb.cacheCourses(courses)
      }
    }
  })
}

/**
 * Check if a student is enrolled in a course
 */
export async function checkEnrollment(courseId, studentId) {
  const { data, error } = await supabase
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('student_id', studentId)
    .single()

  return { isEnrolled: !!data, data, error }
}

/**
 * Get enrollment count for a course
 */
export async function getEnrollmentCount(courseId) {
  const { count, error } = await supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)

  return { count: count || 0, error }
}
