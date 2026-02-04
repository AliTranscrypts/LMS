import { supabase } from './supabase'

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
 */
export async function enrollStudent(courseId, studentProfileId) {
  const { data, error } = await supabase
    .from('enrollments')
    .insert({
      course_id: courseId,
      student_id: studentProfileId,
    })
    .select(`
      *,
      student:profiles!enrollments_student_id_fkey(id, full_name, student_id)
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
 */
export async function getCourseEnrollments(courseId) {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      enrolled_at,
      calculated_grade,
      student:profiles!enrollments_student_id_fkey(
        id,
        full_name,
        student_id
      )
    `)
    .eq('course_id', courseId)
    .order('enrolled_at', { ascending: true })

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
 * Get all enrollments for a student (their enrolled courses)
 */
export async function getStudentEnrollments(studentId) {
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
